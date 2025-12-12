# Phase 4: Neon Connection Testing Guide

This guide walks you through testing the Neon PostgreSQL integration after setting up the environment variable in Vercel.

## Prerequisites

✅ **Completed:**
- [x] Neon database created and schema set up
- [x] AppDaemon writing events to Neon (verify in HA logs)
- [x] `NEON_DATABASE_URL` environment variable set in Vercel
- [x] Code deployed to Vercel (with `pg` package installed)

## Step 1: Verify Environment Variable

1. **Check Vercel Dashboard:**
   - Go to your project → **Settings** → **Environment Variables**
   - Verify `NEON_DATABASE_URL` is set
   - Value should be: `postgresql://neondb_owner:npg_HCWtem4D6fcR@ep-small-firefly-aha9kbbm-pooler.c-3.us-east-1.aws.neon.tech:5432/neondb?sslmode=require`

2. **Redeploy if needed:**
   - If you just added the variable, trigger a new deployment
   - Go to **Deployments** → Click **"..."** → **Redeploy**

## Step 2: Test Health Endpoint

**Test the basic connection:**

```bash
# Replace with your Vercel app URL
curl "https://your-app.vercel.app/api/fetch-neon?query=health"
```

**Expected Response:**
```json
{
  "status": "ok",
  "service": "neon-postgresql-connection",
  "database": "neondb",
  "server_time": "2025-12-11T12:00:00.000Z"
}
```

**If you get an error:**
- Check Vercel logs: **Deployments** → Click deployment → **Functions** → `api/fetch-neon.js` → **Logs**
- Common issues:
  - `NEON_DATABASE_URL not set` → Environment variable missing
  - `Connection refused` → Check connection string format
  - `password authentication failed` → Verify credentials

## Step 3: Test Recent Events Query

**Test fetching recent events (all apps):**

```bash
curl "https://your-app.vercel.app/api/fetch-neon?query=recent-events&limit=5"
```

**Expected Response:**
```json
{
  "events": [
    {
      "id": 1,
      "app_name": "mhe-console",
      "event_name": "app_opened",
      "org": null,
      "timestamp": "2025-12-11T12:00:00.000Z",
      "event_data": {
        "app_name": "mhe-console",
        "event_name": "app_opened",
        "timestamp": "2025-12-11T12:00:00.000Z",
        ...
      },
      "created_at": "2025-12-11T12:00:00.000Z"
    },
    ...
  ],
  "count": 5
}
```

**If empty array:**
- Check if AppDaemon is writing to Neon (see Step 4)
- Verify table exists: `SELECT COUNT(*) FROM app_usage_events;` in Neon SQL Editor

## Step 4: Test App-Specific Query

**Test fetching events for a specific app:**

```bash
curl "https://your-app.vercel.app/api/fetch-neon?query=recent-events&app_name=mhe-console&limit=3"
```

**Expected Response:**
```json
{
  "events": [
    {
      "id": 10,
      "app_name": "mhe-console",
      "event_name": "generate_message_completed",
      ...
    },
    ...
  ],
  "count": 3
}
```

## Step 5: Test Statistics Query

**Test fetching statistics:**

```bash
# All apps
curl "https://your-app.vercel.app/api/fetch-neon?query=statistics"

# Specific app
curl "https://your-app.vercel.app/api/fetch-neon?query=statistics&app_name=mhe-console"
```

**Expected Response:**
```json
{
  "app_name": "mhe-console",
  "total_events": 150,
  "events_last_24h": 25,
  "total_opens": 45
}
```

## Step 6: Verify AppDaemon is Writing to Neon

1. **Check Home Assistant Logs:**
   - Go to **AppDaemon** add-on → **Logs**
   - Look for: `🟢 Neon: Inserted {app_name} - {event_name}`
   - If you see `🟡 Neon insert failed`, check credentials in `custom_event_logger.py`

2. **Check Neon Database:**
   - Go to Neon dashboard → **SQL Editor**
   - Run: `SELECT COUNT(*) FROM app_usage_events;`
   - Should show increasing count as events are logged

3. **Trigger a Test Event:**
   - Use one of your Manhattan apps to generate an event
   - Check AppDaemon logs for Neon insert confirmation
   - Query Neon to verify the event appears

## Step 7: Test Dashboard Integration

1. **Open Dashboard:**
   - Navigate to your deployed dashboard URL
   - Open browser DevTools (F12) → **Console** tab

2. **Check Console Logs:**
   - Look for: `[loadOverallSummary] Using Neon data for recent events: X`
   - Or: `[loadOverallSummary] Using SQL sensor data for recent events: X (Neon unavailable)`
   - If you see "Neon unavailable", check Vercel logs for errors

3. **Verify Data Display:**
   - Recent Events section should show events
   - App cards should show recent events
   - If empty, check:
     - Vercel function logs
     - Browser console for errors
     - Network tab for failed requests

## Step 8: Test Fallback Behavior

**Simulate Neon failure to test fallback:**

1. **Temporarily break connection:**
   - In Vercel, change `NEON_DATABASE_URL` to invalid value
   - Redeploy

2. **Verify fallback:**
   - Dashboard should still work
   - Console should show: `Using SQL sensor data... (Neon unavailable)`
   - Data should come from HA SQL sensors (limited, but functional)

3. **Restore connection:**
   - Fix `NEON_DATABASE_URL` back to correct value
   - Redeploy

## Troubleshooting

### Error: "NEON_DATABASE_URL environment variable is required"

**Fix:**
- Verify environment variable is set in Vercel
- Check variable name is exactly `NEON_DATABASE_URL` (case-sensitive)
- Redeploy after adding variable

### Error: "Connection refused" or "timeout"

**Fix:**
- Verify connection string format is correct
- Check you're using **pooler endpoint** (not direct connection)
- Ensure SSL mode is `require` in connection string
- Check Neon dashboard for service status

### Error: "password authentication failed"

**Fix:**
- Verify password in connection string matches Neon dashboard
- Check user has proper permissions
- Try resetting password in Neon dashboard

### Error: "relation 'app_usage_events' does not exist"

**Fix:**
- Table doesn't exist in Neon
- Run schema creation SQL in Neon SQL Editor
- See `NEON_SETUP.md` for schema

### Empty Results (No Events)

**Possible Causes:**
1. **AppDaemon not writing:**
   - Check AppDaemon logs for errors
   - Verify `custom_event_logger.py` has correct Neon credentials
   - Check HA automation is firing

2. **Table is empty:**
   - Query Neon: `SELECT COUNT(*) FROM app_usage_events;`
   - If 0, AppDaemon may not be writing successfully

3. **Query issue:**
   - Check Vercel function logs for SQL errors
   - Verify PostgreSQL syntax is correct

### Dashboard Shows "Neon unavailable"

**Check:**
- Vercel function logs for errors
- Browser console for network errors
- Verify `/api/fetch-neon` endpoint is accessible
- Test health endpoint directly

## Success Criteria

✅ **Phase 4 Complete When:**
- [x] Health endpoint returns `status: "ok"`
- [x] Recent events query returns data
- [x] Statistics query returns correct counts
- [x] Dashboard displays events from Neon
- [x] Console shows "Using Neon data" messages
- [x] Fallback to SQL sensors works if Neon fails

## Next Steps

After Phase 4 testing is complete:

1. **Monitor Performance:**
   - Check Vercel function execution times
   - Monitor Neon database query performance
   - Verify connection pooling is working

2. **Optimize if Needed:**
   - Add query caching if needed
   - Optimize indexes in Neon
   - Adjust connection pool settings

3. **Documentation:**
   - Update README with any findings
   - Document any custom configurations

---

**Phase 4 Testing Complete!** 🎉

Your dashboard should now be fully integrated with Neon PostgreSQL and displaying full event data.
