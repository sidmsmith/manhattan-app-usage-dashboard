# Home Assistant Connectivity Setup

## Step 1: Create a Long-Lived Access Token

1. Log into your Home Assistant instance
2. Click on your profile icon (bottom left)
3. Scroll down to **"Long-Lived Access Tokens"**
4. Click **"Create Token"**
5. Give it a name: `Manhattan App Usage Dashboard`
6. Copy the token immediately (you won't be able to see it again)
7. Save it securely - you'll need it for the environment variable

## Step 2: Determine Your Home Assistant URL

You have two options:

### Option A: Local Network Access (Development)
- URL: `http://homeassistant.local:8123` or `http://YOUR_HA_IP:8123`
- **Note**: This will only work if your Vercel deployment can access your local network (unlikely). You'll need Option B for production.

### Option B: Public Access (Recommended for Vercel)
- If you have Home Assistant exposed publicly via:
  - Nabu Casa (cloud URL)
  - Reverse proxy (your domain)
  - Port forwarding (less secure)
- Use that public URL

**For now, use your local URL for development/testing.**

## Step 3: Test API Access

You can test the API connection using curl or a browser:

```bash
# Replace YOUR_TOKEN and YOUR_URL with actual values
curl -X GET \
  "http://homeassistant.local:8123/api/states/sensor.all_apps_total_events" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

Expected response:
```json
{
  "entity_id": "sensor.all_apps_total_events",
  "state": "236",
  "attributes": {...},
  "last_changed": "...",
  "last_updated": "..."
}
```

## Step 4: CORS Configuration (If Needed)

If you get CORS errors when testing locally, you may need to add to your Home Assistant `configuration.yaml`:

```yaml
http:
  cors_allowed_origins:
    - http://localhost:3000
    - http://localhost:5173
    - https://your-vercel-app.vercel.app
```

Then restart Home Assistant.

## Step 5: Environment Variables for Vercel

Once you have your token and URL, you'll set these in Vercel:

1. Go to your Vercel project settings
2. Navigate to **Environment Variables**
3. Add:
   - `HA_URL` = `http://homeassistant.local:8123` (or your public URL)
   - `HA_TOKEN` = `your_long_lived_access_token_here`

**Important**: For local development, create a `.env.local` file (don't commit this):
```
HA_URL=http://homeassistant.local:8123
HA_TOKEN=your_token_here
```

## Step 6: Sensors to Fetch

Based on your dashboard, you'll need to fetch these sensors:

### Overall Summary:
- `sensor.all_apps_total_events`
- `sensor.all_apps_events_last_24h`
- `sensor.all_apps_total_opens`
- `sensor.all_apps_recent_events` (contains `events` attribute with JSON array)

### Individual App Cards (for each app):
- `sensor.{app_name}_total_events`
- `sensor.{app_name}_events_last_24h`
- `sensor.{app_name}_total_opens`
- `sensor.{app_name}_recent_events` (contains `events` attribute)

### App List (you'll need to define this):
Based on your previous dashboard, the apps are:
- lpn_unlock_app
- mhe_console
- appt_app
- pos_items
- driver_pickup
- facility_addresses
- forecast_import
- apps_homepage
- item_generator_gallery
- order_generator
- schedule_app
- todolist
- update_appt

## Step 7: API Endpoints You'll Use

```
GET /api/states/{entity_id}
GET /api/states (get all states)
```

Example fetch in JavaScript:
```javascript
const response = await fetch(`${HA_URL}/api/states/sensor.all_apps_total_events`, {
  headers: {
    'Authorization': `Bearer ${HA_TOKEN}`,
    'Content-Type': 'application/json'
  }
});
const data = await response.json();
```

## Troubleshooting

- **401 Unauthorized**: Check your token is correct
- **CORS errors**: Add your origin to HA's CORS config
- **Network errors**: Verify HA_URL is accessible from your location
- **404 Not Found**: Check entity_id spelling

---

Once you have the token and can successfully make API calls, let me know and I'll continue with the dashboard build!
