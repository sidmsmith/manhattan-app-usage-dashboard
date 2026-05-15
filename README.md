# Manhattan App Usage Dashboard v2.5.0

A standalone web dashboard for monitoring Manhattan Associates application usage from **Neon PostgreSQL** only (via the dashboard `usage-ingest` API and `fetch-neon` serverless routes).

## Overview

This dashboard shows aggregate statistics, recent events, and per-app metrics. Data is stored in **Neon** when each app posts to `MANHATTAN_USAGE_INGEST_URL` (the dashboard **usage-ingest** API).

**Repository**: https://github.com/sidmsmith/manhattan-app-usage-dashboard.git  
**Deployment**: Vercel (serverless functions)  
**Data source**: **Neon PostgreSQL** — see [`VERCEL_ENV_SETUP.md`](./VERCEL_ENV_SETUP.md) for `NEON_DATABASE_URL` and related settings.

Historical Home Assistant / SQL sensor material may still exist under `manhattan_dashboard/` for documentation or migration only; **the deployed UI no longer reads Home Assistant.**

### Tracked apps: canonical `app_name` and events

`app_name` in Neon must match `neonAppName` in `app.js`. Representative `event_name` values:

| App | `app_name` (Neon) | Events |
|-----|-------------------|--------|
| Item Generator | `item-generator-gallery` | `app_opened`, `auth_*`, `generate_items_*`, `gallery_generate_*`, `gallery_finalize_*`, `upload_cloudinary_*`, `update_wm_*` |
| Driver Pickup | `driver-pickup` | `app_opened`, `auth_*`, `barcode_validation_*`, `barcode_scanned`, `barcode_scan_invalid`, `pickup_*` |
| Order Generator | `order-generator-app` | `app_opened`, `auth_*`, `find_order_*`, `create_order_*`, `bulk_import_orders_*` |
| Proof of Delivery | `proofofdelivery` | Same pickup/signature flow as Driver Pickup (`auth_*`, `barcode_*`, `pickup_*`) plus delivery-specific API actions (not all tracked as separate `event_name` yet) |
| Work Order Update | `work-order-update` | `app_opened`, `auth_*`, `work_order_search_*`, `work_order_descriptions_*` |
| Import Forecast | `forecast-import` | `app_opened`, `auth_*`, `forecast_file_loaded`, `location_file_loaded`, `file_load_failed`, `upload_forecast_*`, `upload_locations_*` |
| SCP Store | `scp-store` | `app_opened`, `auth_*`, `store_id_entered`, `card_clicked`; optional legacy `forecast_*` / `upload_*` if that code path is used |
| Banding | `banding` | `app_opened`, `auth_*`, `banding_search_orders_*`, `banding_order_selected`, `banding_order_detail_*`, `banding_add_to_bundle_*`, `banding_remove_from_bundle_*`, `banding_back_to_order_list`, `banding_sort_changed`, `banding_theme_changed`, `banding_console_toggled` |
| Dispatch | `dispatch` | `app_opened`, `auth_attempt`, `auth_success`, `auth_failed`, `dispatch_search_trips`, `dispatch_assign_trip` |
| Manual Dispatch Request | `dispatch-request` | `app_opened`, `auth_attempt`, `auth_success`, `auth_failed`, `dispatch_request_submit` |
| POS Items | `pos-items-app` | `app_opened`, `auth_*` (generation / import / gallery events per UI) |
| Item Master Update | `item-update` | `app_opened`, `auth_*`, `item_scanned` |
| Todo List | `todolist` | `app_opened`, `auth_*` (todo CRUD per frontend) |
| Check In Kiosk | `appt-app` | `app_opened`, `auth_*`, appointment search / check-in flow events |

Other apps follow the same pattern; see the `APPS` comment block at the top of `app.js`.

## Architecture

```
┌──────────────────┐     MANHATTAN_USAGE_INGEST_URL      ┌─────────────────────┐
│  Manhattan apps  │  ─────────────────────────────────►│ Vercel usage-ingest │
│  (Flask / Node)  │         (JSON POST + optional secret)│  → Neon (JSONB)     │
└──────────────────┘                                    └──────────┬──────────┘
                                                                   │
                                                          ┌────────▼─────────┐
                                                          │ Dashboard (UI)   │
                                                          │ fetch-neon API   │
                                                          └──────────────────┘
```

- **Neon PostgreSQL:** Database for the dashboard UI (full `event_data` JSONB).
- **Usage ingest:** Each app forwards events server-side so `app_name` / `app_version` stay canonical.

## Features

- **Overall Summary**: Aggregate metrics across all applications
  - Total Events (all time)
  - Events Last 24 Hours
  - Total App Opens
  - Recent Events feed (last 15 events across all apps)
  
- **Individual App Cards**: Detailed metrics for each application
  - Total Events
  - Events Last 24 Hours
  - Total Opens
  - Recent Events (last 15 events for that app)
  
- **Configurable Sorting**: Sort cards by:
  - **Recent**: Most recent event first
  - **24H**: Highest 24-hour activity first
  - **Events**: Most total events first
  - **Opens**: Most app opens first
  - **Alphabetical**: A-Z by app name
  - **Manual**: Drag-and-drop reordering
  
- **Drag and Drop**: Reorder cards manually when in "Manual" sort mode
- **Responsive Design**: Mobile-friendly with single-column layout
- **Auto-refresh**: Automatically updates data every 60 seconds
- **Timezone Support**: Events displayed in local browser timezone (24-hour format)
- **Event Details Modal**: Click any Recent Event to view full JSON details
  - Pretty-printed JSON display
  - Context-aware navigation (summary vs app-specific)
  - Pre-loaded navigation for smooth browsing
  - Dynamic modal header with app name

## Setup

### Prerequisites

1. **GitHub Account** (for the repository)
2. **Vercel Account** (for deployment)
3. **Neon PostgreSQL** project and connection string (**required** — see [`VERCEL_ENV_SETUP.md`](./VERCEL_ENV_SETUP.md) and [`NEON_SETUP.md`](./NEON_SETUP.md))

### Environment variables (Vercel)

Configure at least:

- `NEON_DATABASE_URL` — read access for `api/fetch-neon.js`

Set on **each Manhattan app** that records usage:

- `MANHATTAN_USAGE_INGEST_URL` — URL of this dashboard’s `usage-ingest` endpoint
- Optional: `MANHATTAN_USAGE_INGEST_SECRET` if your ingest checks `Authorization`

### Local development

```bash
cd apps_dashboard
python -m http.server 8000
```

Open `http://localhost:8000`. Static assets work with a simple file server; **Neon-backed APIs** (`/api/fetch-neon`, `/api/usage-ingest`) need `vercel dev` or a deployed environment with `NEON_DATABASE_URL` set.

Optional: add a `config.js` (gitignored) if you add local-only client settings later; the dashboard no longer uses Home Assistant client config.

### Deploy to Vercel

1. Push this repository to GitHub.
2. Import the project in Vercel and set `NEON_DATABASE_URL` (and any ingest secrets).
3. Redeploy after variable changes.

## Configuration

### App list

Apps are defined in `app.js` in the `APPS` array. Each entry includes:

- `id`: Stable key used for card `data-app`, ordering, and styling
- `name`: Display title
- `icon`: Emoji for the card
- `neonAppName`: Canonical `app_name` stored in Neon (must match ingest payloads)

```javascript
const APPS = [
  { id: 'banding', name: 'Banding', icon: '📎', neonAppName: 'banding' },
  // …
];
```

### Refresh Interval

Change the auto-refresh interval in `app.js`:

```javascript
const CONFIG = {
  refreshInterval: 60000, // milliseconds (60 seconds)
};
```

### Version Number

The version is displayed in the dashboard title and badge. Update in two places:

1. **`index.html`**: Update the `<title>` and version badge
2. **`app.js`**: Update `DASHBOARD_VERSION` constant

```javascript
// In app.js
const DASHBOARD_VERSION = '1.0.0';

// In index.html
<title>Manhattan App Usage Dashboard v2.0.0</title>
<h2>📊 Overall Summary <span class="version-badge">v2.0.0</span></h2>
```

## Legacy Home Assistant material

Older webhook / SQL sensor / AppDaemon docs and YAML under `manhattan_dashboard/` remain for archival or migration. **They are not used by the Neon-only dashboard.**

## File structure

```
apps_dashboard/
├── api/
│   ├── fetch-neon.js       # Queries Neon for statistics and recent events
│   └── usage-ingest.js     # Receives events from Manhattan apps → Neon
├── manhattan_dashboard/    # Historical HA / MariaDB helpers (optional)
├── index.html
├── app.js
├── styles.css
├── vercel.json
├── package.json
├── README.md
└── .gitignore
```

## API (Neon paths)

The browser loads data via `/api/fetch-neon`:

- Query `statistics` — overall or per-app counters
- Query `recent-events` — chronological events with Neon `id` for the detail modal

The dashboard does **not** call Home Assistant or `fetch-sensor`.

## Troubleshooting

### Metrics show zeros or Recent Events are empty

1. Confirm `NEON_DATABASE_URL` in Vercel and redeploy if it changed.
2. Confirm apps have `MANHATTAN_USAGE_INGEST_URL` set and events appear in Neon.
3. Check the browser Network tab for `/api/fetch-neon` responses and Vercel function logs.

### Event modal says missing id

Only rows authored through Neon ingest include stable `id` values needed for `/api/event-detail`; older mirrored rows without `id` are display-only.


## Version History

- **v2.5.0** — Neon-only dashboard (`fetch-sensor` removed); added Dispatch apps to roster; HA fallbacks removed from `app.js`.
- **v2.1.0** — "Modal Works" - Complete modal functionality with context-aware navigation
- **v2.0.0** - "Fully works with Neon before Modal" - Neon PostgreSQL integration, performance optimizations
- **v1.0.0** - Baseline version with organized HA configuration
  - All HA config files moved to `manhattan_dashboard/` folder
  - Cleaned up unused scripts and test files
  - Repository cleanup and organization
  - Complete documentation

- **v0.3.7** - Removed modal functionality
- **v0.3.6** - Cleanup of unused API files
- **v0.3.5** - Fixed Recent Events (read from attributes.events)
- **v0.1.0-v0.1.2** - Initial working versions

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile browsers (iOS Safari, Chrome Mobile)
- Requires JavaScript enabled
- Requires fetch API support

## Development

### Adding a new app

1. Add `{ id, name, icon, neonAppName }` to the `APPS` array in `app.js`.
2. Ensure the app POSTs usage to the ingest URL with `app_name` equal to `neonAppName`.
3. Optionally extend `getAppShortName()` for nicer labels in the Recent Events strip.
4. Add a `[data-app="…"]` border rule in `styles.css` if you want a distinct card color.

### Modifying Neon queries

Server-side query shapes live in `api/fetch-neon.js`; update there if you change table or column names.

## License

Private project for Manhattan Associates.
