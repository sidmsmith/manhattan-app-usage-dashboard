# Manhattan App Usage Dashboard

A standalone web dashboard for monitoring Manhattan Associates application usage, fetching data from Home Assistant.

## Overview

This dashboard provides real-time visibility into app usage metrics across multiple Manhattan Associates applications. It displays aggregate statistics, recent events, and individual app performance metrics in a clean, responsive interface.

**Repository**: https://github.com/sidmsmith/manhattan-app-usage-dashboard.git  
**Deployment**: Vercel (serverless functions)  
**Data Sources**: 
- Home Assistant API (SQL sensors from SQLite) - Summary statistics
- Neon PostgreSQL (cloud database) - Full event data for dashboard

## Architecture

### Current Architecture (Neon PostgreSQL Integration)

```
┌─────────────────┐
│  Manhattan Apps  │
│  (Python/JS)     │
└────────┬─────────┘
         │ POST /api/webhook/manhattan_app_usage
         ▼
┌─────────────────────────────────────┐
│      Home Assistant                 │
│  ┌───────────────────────────────┐ │
│  │ Automation → Python Script    │ │
│  │   ↓                            │ │
│  │ HA Event Bus                   │ │
│  │   ├─→ SQLite (default)        │ │
│  │   │   └─→ SQL Sensors         │ │
│  │   └─→ AppDaemon               │ │
│  │       ├─→ MariaDB (local)     │ │
│  │       └─→ Neon PostgreSQL      │ │
│  └───────────────────────────────┘ │
└────────┬───────────────────────────┘
         │
         ├─→ GET /api/states/{entity_id} (SQL Sensors)
         │   └─→ Vercel: /api/fetch-sensor.js
         │       └─→ Dashboard (summary statistics)
         │
         └─→ Neon PostgreSQL (cloud)
             └─→ Vercel: /api/fetch-neon.js (to be created)
                 └─→ Dashboard (full event data)
```

**Current Architecture:**
- **SQL Sensors** (SQLite): Used for summary statistics (total events, 24h events, total opens)
- **Neon PostgreSQL** (cloud): Primary database for dashboard - stores all events with full JSON data
- **MariaDB** (local): Backup/legacy support - AppDaemon writes to both databases independently
- **AppDaemon**: Listens for `app_usage_event` and writes to both MariaDB and Neon (dual-write)
- **Fallback**: If Neon query fails, dashboard falls back to SQL sensors

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

## Setup

### Prerequisites

1. **Home Assistant Instance** (running and accessible)
2. **GitHub Account** (for repository)
3. **Vercel Account** (for deployment)
4. **Long-Lived Access Token** from Home Assistant

### Step 1: Home Assistant Configuration

**IMPORTANT**: Before the dashboard can work, you must configure Home Assistant. See the detailed guide in [`manhattan_dashboard/README.md`](./manhattan_dashboard/README.md) for:

- Setting up the webhook automation
- Installing SQL and template sensors
- Configuring the Python script
- Setting up `configuration.yaml` includes

**Quick Checklist:**
- [ ] Copy `manhattan_dashboard/` files to `/config/manhattan_dashboard/` in HA
- [ ] Create symlink for `store_event.py` to `python_scripts/`
- [ ] Add includes to `configuration.yaml`
- [ ] Create automation for webhook `manhattan_app_usage`
- [ ] Restart Home Assistant
- [ ] Verify sensors are created (check Developer Tools > States)

### Step 1.5: Neon PostgreSQL Integration (Required for Full Event Data)

**See [`VERCEL_ENV_SETUP.md`](./VERCEL_ENV_SETUP.md) for the exact connection string to use in Vercel.**

**For full event data access (no 255-char limit):**

1. **Create Neon PostgreSQL Database** (cloud-based, free tier available)
   - Sign up at https://neon.tech
   - Create a new project
   - Note your connection string (pooler endpoint recommended)

2. **Create Database Schema** in Neon
   - Use the same schema as MariaDB (see [`manhattan_dashboard/mariadb_create_table.sql`](./manhattan_dashboard/mariadb_create_table.sql))
   - Adapt SQL syntax for PostgreSQL (JSON → JSONB, etc.)

3. **Install AppDaemon Add-on** in Home Assistant
   - Required for writing events to Neon
   - See [`manhattan_dashboard/appdaemon/README.md`](./manhattan_dashboard/appdaemon/README.md) for setup

4. **Configure AppDaemon** with Neon credentials
   - Update `custom_event_logger.py` with Neon connection details
   - Add `psycopg2-binary` to AppDaemon's `python_packages`

5. **Deploy AppDaemon Files** to HA
   - Copy files from Git structure to HA's required locations
   - See [`manhattan_dashboard/appdaemon/README.md`](./manhattan_dashboard/appdaemon/README.md) deployment guide

**Benefits:**
- Full event JSON data (no truncation)
- Cloud-based (accessible from Vercel without tunnels)
- Better performance for serverless functions
- Automatic backups and scaling

**Note:** The dashboard will work without Neon, but will use SQL sensors with limited data. Neon integration is recommended for full functionality.

### Step 2: Home Assistant Connectivity

See [HA_CONNECTIVITY_SETUP.md](./HA_CONNECTIVITY_SETUP.md) for detailed instructions on:
- Creating a Long-Lived Access Token
- Configuring API access
- Setting up environment variables
- Testing API connectivity

### Step 3: Environment Variables

#### Local Development

For local testing, you can create a `config.js` file (not committed to git):

```javascript
window.CONFIG = {
  HA_URL: 'http://homeassistant.local:8123',
  HA_TOKEN: 'your_long_lived_access_token_here'
};
```

**Note**: `config.js` is in `.gitignore` and won't be committed to git.

#### Vercel Deployment

The dashboard uses a serverless function (`api/fetch-sensor.js`) to securely fetch data from Home Assistant. Add these as environment variables in your Vercel project settings:

- `HA_URL`: Your Home Assistant URL (e.g., `https://your-ha-instance.duckdns.org` or your public URL)
- `HA_TOKEN`: Your Long-Lived Access Token

The serverless function keeps your token server-side and handles CORS automatically.

**To set environment variables in Vercel:**
1. Go to your project in Vercel dashboard
2. Navigate to **Settings** > **Environment Variables**
3. Add `HA_URL` and `HA_TOKEN`
4. Redeploy the application

### Step 4: Local Development

```bash
# Navigate to the project directory
cd apps_dashboard

# Using a simple HTTP server (Python)
python -m http.server 8000

# Or using Node.js http-server
npx http-server

# Or using Vite (if you want hot reload)
npm install -g vite
vite
```

Then open `http://localhost:8000` (or the port your server uses).

**Note**: For local development, you'll need to either:
- Use `config.js` with your local HA URL
- Or set up CORS in Home Assistant to allow `http://localhost:8000`

### Step 5: Deploy to Vercel

1. **Push code to GitHub**: Ensure your code is in `https://github.com/sidmsmith/manhattan-app-usage-dashboard.git`
2. **Import repository in Vercel**:
   - Go to Vercel dashboard
   - Click "Add New Project"
   - Import from GitHub
   - Select `manhattan-app-usage-dashboard`
3. **Add environment variables** (see Step 3 above)
4. **Deploy**: Vercel will automatically deploy on every push to `main`

## Configuration

### App List

Apps are defined in `app.js` in the `APPS` array. Each app has:
- `id`: The sensor prefix (e.g., `lpn_unlock_app` matches `sensor.lpn_unlock_app_total_events`)
- `name`: Display name shown in the dashboard
- `icon`: Emoji icon for the app card

To add or modify apps:

```javascript
const APPS = [
  { id: 'lpn_unlock_app', name: 'LPN Unlock App', icon: '🔓' },
  { id: 'mhe_console', name: 'MHE Console', icon: '💻' },
  // Add more apps here...
];
```

**Important**: The `id` must match the sensor naming convention in Home Assistant:
- Sensor names: `sensor.{id}_total_events`, `sensor.{id}_events_last_24h`, etc.
- The SQL sensors in `manhattan_dashboard/sql_sensors.yaml` use `app_name` from the database, which should match your app's internal identifier

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
<title>Manhattan App Usage Dashboard v1.0.0</title>
<h2>📊 Overall Summary <span class="version-badge">v1.0.0</span></h2>
```

## Home Assistant Configuration

All Home Assistant configuration files are stored in the `manhattan_dashboard/` folder:

- **`templates.yaml`** - Template sensors for aggregated totals across all apps
- **`sql_sensors.yaml`** - SQL sensors for querying app usage events from HA database
- **`store_event.py`** - Python script for processing webhook events
- **`README.md`** - Detailed HA configuration documentation

**See [`manhattan_dashboard/README.md`](./manhattan_dashboard/README.md) for complete Home Assistant setup instructions.**

### Quick Overview

1. **Webhook** → Apps send events to `/api/webhook/manhattan_app_usage`
2. **Automation** → Triggers on webhook, calls `python_script.store_event`
3. **Python Script** → Fires HA event `app_usage_event` with event data
4. **HA Database** → Automatically stores events in `events` and `event_data` tables
5. **SQL Sensors** → Query database to aggregate and format data (run every 60 seconds)
6. **Template Sensors** → Aggregate totals across all apps
7. **Dashboard** → Reads sensors via HA API and displays data

## File Structure

```
apps_dashboard/
├── api/
│   └── fetch-sensor.js          # Vercel serverless function (fetches HA sensor data)
├── manhattan_dashboard/         # Home Assistant configuration files
│   ├── templates.yaml           # Template sensors
│   ├── sql_sensors.yaml         # SQL sensors
│   ├── store_event.py           # Python script
│   └── README.md                # HA setup guide
├── index.html                   # Main HTML file
├── app.js                       # Dashboard JavaScript logic
├── styles.css                   # Dashboard styling
├── vercel.json                  # Vercel configuration
├── package.json                 # Node.js dependencies
├── README.md                    # This file
├── HA_CONNECTIVITY_SETUP.md     # HA API setup guide
└── .gitignore                   # Git ignore rules
```

## API Endpoints

The dashboard fetches data from Home Assistant using these sensors:

### Overall Summary Sensors:
- `sensor.all_apps_total_events` - Total events across all apps
- `sensor.all_apps_events_last_24h` - Events in last 24 hours
- `sensor.all_apps_total_opens` - Total app opens
- `sensor.all_apps_recent_events` - Recent events (attributes.events contains JSON array)

### Per-App Sensors (for each app in APPS array):
- `sensor.{app_id}_total_events` - Total events for this app
- `sensor.{app_id}_events_last_24h` - Events in last 24 hours
- `sensor.{app_id}_total_opens` - Total opens for this app
- `sensor.{app_id}_recent_events` - Recent events (attributes.events contains JSON array)

**Note**: Recent events sensors store data in `attributes.events` (not `state`) to avoid HA's 255-character state limit.

## Troubleshooting

### Dashboard shows "Loading..." or no data

1. **Check browser console** (F12) for errors
2. **Verify environment variables** in Vercel are set correctly
3. **Test HA API access**:
   ```bash
   curl -X GET "https://your-ha-url/api/states/sensor.all_apps_total_events" \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```
4. **Verify sensors exist** in Home Assistant (Developer Tools > States)
5. **Check Vercel function logs** for errors

### Recent Events not showing

1. **Check sensor attributes**: Recent events are in `attributes.events`, not `state`
2. **Verify SQL sensors are working**: Check HA logs for SQL errors
3. **Check database**: Ensure events are being stored (check `event_data` table)
4. **Verify webhook is firing**: Check HA automation logs

### CORS Errors

If testing locally, add to Home Assistant `configuration.yaml`:

```yaml
http:
  cors_allowed_origins:
    - http://localhost:8000
    - http://localhost:3000
    - https://your-vercel-app.vercel.app
```

Then restart Home Assistant.

### Authentication Errors

- **401 Unauthorized**: Check your `HA_TOKEN` is correct and not expired
- **403 Forbidden**: Verify token has proper permissions
- **Token expired**: Create a new Long-Lived Access Token

## Version History

- **v1.0.0** (Current) - Baseline version with organized HA configuration
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

### Adding a New App

1. **Add to `app.js` APPS array**:
   ```javascript
   { id: 'new_app', name: 'New App', icon: '🆕' }
   ```

2. **Add SQL sensors** in `manhattan_dashboard/sql_sensors.yaml`:
   - Total Events sensor
   - Events Last 24h sensor
   - Total Opens sensor
   - Recent Events sensor

3. **Update template sensors** in `manhattan_dashboard/templates.yaml`:
   - Add the new app's sensors to the aggregation formulas

4. **Restart Home Assistant** to load new sensors

5. **Test**: Verify sensors appear in HA and dashboard displays the new app

### Modifying Sensor Queries

SQL sensors are in `manhattan_dashboard/sql_sensors.yaml`. Each app has 4 sensors:
- Total Events: `COUNT(*)` query
- Events Last 24h: `COUNT(*)` with time filter
- Total Opens: `COUNT(*)` where `event_name = 'app_opened'`
- Recent Events: `json_group_array` with last 15 events

See the file for examples and modify as needed.

## License

Private project for Manhattan Associates.
