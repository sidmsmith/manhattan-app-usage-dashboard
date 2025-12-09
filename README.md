# Manhattan App Usage Dashboard

A standalone web dashboard for monitoring Manhattan Associates application usage, fetching data from Home Assistant.

## Features

- **Overall Summary**: Aggregate metrics across all applications
- **Recent Events**: Real-time event feed across all apps
- **Individual App Cards**: Detailed metrics and recent events for each application
- **Configurable Sorting**: Sort cards by Recent, 24H, Events, Opens, Alphabetical, or Manual (drag-and-drop)
- **Drag and Drop**: Reorder cards manually when in "Manual" sort mode
- **Responsive Design**: Mobile-friendly with single-column layout
- **Auto-refresh**: Automatically updates data every 60 seconds

## Setup

### 1. Home Assistant Connectivity

See [HA_CONNECTIVITY_SETUP.md](./HA_CONNECTIVITY_SETUP.md) for detailed instructions on:
- Creating a Long-Lived Access Token
- Configuring API access
- Setting up environment variables

### 2. Environment Variables

#### Local Development

Copy `config.js.example` to `config.js` and fill in your values:

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

### 3. Local Development

```bash
# Using a simple HTTP server (Python)
python -m http.server 8000

# Or using Node.js http-server
npx http-server

# Or using Vite (if you want hot reload)
npm install -g vite
vite
```

Then open `http://localhost:8000` (or the port your server uses).

### 4. Deploy to Vercel

1. Push your code to GitHub: `https://github.com/sidmsmith/manhattan-app-usage-dashboard.git`
2. Import the repository in Vercel
3. Add environment variables:
   - `HA_URL`: Your Home Assistant URL
   - `HA_TOKEN`: Your Long-Lived Access Token
4. Deploy!

## Configuration

### App List

Apps are defined in `app.js` in the `APPS` array. To add or modify apps:

```javascript
const APPS = [
  { id: 'app_id', name: 'Display Name', icon: '🔓' },
  // ...
];
```

### Refresh Interval

Change the auto-refresh interval in `app.js`:

```javascript
const CONFIG = {
  refreshInterval: 60000, // milliseconds (60 seconds)
};
```

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile browsers (iOS Safari, Chrome Mobile)

## License

Private project for Manhattan Associates.
