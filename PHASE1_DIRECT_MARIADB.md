# Phase 1: Direct MariaDB Connection Implementation

## Overview

Phase 1 implements a **direct MariaDB connection** from Vercel to your Home Assistant MariaDB instance via Cloudflare Tunnel, bypassing AppDaemon REST endpoints entirely.

## Architecture

```
Vercel Serverless Function (mysql2)
  ↓
Cloudflare Tunnel (mariadb.sidmsmith.zapto.org:3306)
  ↓
MariaDB (manhattan_app_usage database)
```

**Key Points:**
- **No AppDaemon** involved in queries (only for writing events)
- **Direct SQL** connection (full query power)
- **Secure tunnel** (Cloudflare handles encryption)
- **Hybrid approach**: SQL sensors for stats, MariaDB for recent events

## What Was Changed

### Files Created

1. **`CLOUDFLARE_TUNNEL_SETUP.md`**
   - Comprehensive step-by-step guide for setting up Cloudflare Tunnel
   - Includes account creation, add-on installation, configuration
   - DNS setup, security configuration, troubleshooting

2. **`MARIADB_USER_SETUP.md`**
   - Guide for creating read-only MariaDB user
   - Permission setup, testing, security best practices

3. **`PHASE1_DIRECT_MARIADB.md`** (this file)
   - Implementation summary and quick reference

### Files Modified

1. **`api/fetch-mariadb.js`**
   - **Before**: Proxied requests to AppDaemon HTTP API (port 5051)
   - **After**: Direct MySQL connection using `mysql2` package
   - Connects to MariaDB via Cloudflare Tunnel endpoint
   - Full SQL query support (recent-events, statistics, event-details, health)

2. **`package.json`**
   - Added `mysql2` dependency (version ^3.6.5)

3. **`app.js`**
   - Updated comment to reflect direct connection (no code changes needed)
   - Existing `fetchMariaDBData()` function works as-is

4. **`README.md`**
   - Updated architecture diagram
   - Updated setup instructions
   - Removed AppDaemon HTTP API references

### Files Removed

1. **`manhattan_dashboard/appdaemon/apps/mariadb_query_api.py`**
   - No longer needed (AppDaemon not used for queries)

2. **`manhattan_dashboard/appdaemon/MARIADB_QUERY_API.md`**
   - Documentation no longer applicable

3. **`manhattan_dashboard/appdaemon/apps/apps.yaml`**
   - Removed `mariadb_query_api` configuration
   - Kept `custom_event_logger` (still needed for writing events)

## Setup Checklist

### Prerequisites
- [ ] MariaDB add-on installed and running
- [ ] Database `manhattan_app_usage` created
- [ ] Table `app_usage_events` created
- [ ] AppDaemon installed (for writing events only)

### Cloudflare Setup
- [ ] Cloudflare account created (free tier)
- [ ] Zero Trust enabled
- [ ] Cloudflare Tunnel created
- [ ] Cloudflared add-on installed in HA
- [ ] Tunnel configured and running
- [ ] DNS configured (if using custom domain)

### MariaDB Setup
- [ ] Read-only user `dashboard_reader` created
- [ ] SELECT permissions granted
- [ ] Connection tested from HA terminal

### Vercel Setup
- [ ] Environment variables added:
  - `MARIADB_HOST`
  - `MARIADB_PORT`
  - `MARIADB_USER`
  - `MARIADB_PASSWORD`
  - `MARIADB_DATABASE`
  - `CF_ACCESS_CLIENT_ID` (if using Cloudflare Access)
  - `CF_ACCESS_CLIENT_SECRET` (if using Cloudflare Access)
- [ ] `mysql2` package installed (via `package.json`)
- [ ] Code deployed to Vercel

### Testing
- [ ] Tunnel health check: `curl http://localhost:5051/health` (if AppDaemon was used)
- [ ] MariaDB connection test from HA terminal
- [ ] Vercel endpoint test: `/api/fetch-mariadb?query=health`
- [ ] Dashboard loads recent events from MariaDB
- [ ] Fallback to SQL sensors works if MariaDB unavailable

## Environment Variables Reference

### Required (Vercel)

| Variable | Example | Description |
|----------|---------|-------------|
| `MARIADB_HOST` | `mariadb.sidmsmith.zapto.org` | Cloudflare Tunnel endpoint |
| `MARIADB_PORT` | `3306` | MariaDB port (usually 3306) |
| `MARIADB_USER` | `dashboard_reader` | Read-only user |
| `MARIADB_PASSWORD` | `YourSecurePassword123!` | User password |
| `MARIADB_DATABASE` | `manhattan_app_usage` | Database name |

### Optional (Cloudflare Access)

| Variable | Example | Description |
|----------|---------|-------------|
| `CF_ACCESS_CLIENT_ID` | `abc123...` | Cloudflare Access Client ID |
| `CF_ACCESS_CLIENT_SECRET` | `def456...` | Cloudflare Access Client Secret |

## API Endpoints

The `/api/fetch-mariadb` endpoint supports:

### `GET /api/fetch-mariadb?query=recent-events&app_name=mhe-console&limit=15`

Returns recent events, optionally filtered by app.

**Response:**
```json
{
  "events": [
    {
      "id": 5,
      "app_name": "mhe-console",
      "event_name": "generate_message_completed",
      "org": "SS-DEMO",
      "timestamp": "2025-12-11 05:33:27",
      "event_data": { /* full JSON */ },
      "created_at": "2025-12-11 00:33:27"
    }
  ],
  "count": 1
}
```

### `GET /api/fetch-mariadb?query=statistics&app_name=mhe-console`

Returns statistics for an app (or all apps if app_name omitted).

**Response:**
```json
{
  "app_name": "mhe-console",
  "total_events": 150,
  "events_last_24h": 25,
  "total_opens": 45
}
```

### `GET /api/fetch-mariadb?query=event-details&id=5`

Returns full event details by ID.

**Response:**
```json
{
  "id": 5,
  "event_id": null,
  "app_name": "mhe-console",
  "event_name": "generate_message_completed",
  "org": "SS-DEMO",
  "timestamp": "2025-12-11 05:33:27",
  "event_data": { /* full JSON */ },
  "created_at": "2025-12-11 00:33:27",
  "updated_at": "2025-12-11 00:33:27"
}
```

### `GET /api/fetch-mariadb?query=health`

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "service": "mariadb-direct-connection",
  "database": "manhattan_app_usage",
  "server_time": "2025-12-11T12:00:00.000Z"
}
```

## Troubleshooting

### Connection Issues

**Problem:** Vercel function can't connect to MariaDB

**Solutions:**
1. Verify tunnel is healthy in Cloudflare dashboard
2. Test connection from HA terminal: `nc -zv mariadb.sidmsmith.zapto.org 3306`
3. Check Cloudflared add-on logs in HA
4. Verify environment variables in Vercel are correct

### Authentication Errors

**Problem:** "Access denied" or "Authentication failed"

**Solutions:**
1. Verify MariaDB user password in Vercel environment variables
2. Test user connection from HA terminal
3. Check user permissions: `SHOW GRANTS FOR 'dashboard_reader'@'%';`
4. Ensure `FLUSH PRIVILEGES;` was run after creating user

### DNS Issues

**Problem:** Can't resolve `mariadb.sidmsmith.zapto.org`

**Solutions:**
1. Verify DNS record exists (NOIP or Cloudflare)
2. Wait 5-10 minutes for DNS propagation
3. Test with: `nslookup mariadb.sidmsmith.zapto.org`
4. Use Cloudflare's free subdomain for testing

### Query Errors

**Problem:** SQL queries fail

**Solutions:**
1. Verify database name: `manhattan_app_usage`
2. Check table exists: `SHOW TABLES;`
3. Test query directly in MariaDB
4. Check serverless function logs in Vercel

## Benefits of Direct Connection

1. **Performance**: No HTTP/REST layer overhead
2. **Flexibility**: Full SQL power (JOINs, subqueries, etc.)
3. **Simplicity**: One less component (no AppDaemon HTTP API)
4. **Reliability**: Direct connection, fewer failure points
5. **Security**: Cloudflare Tunnel handles encryption

## Next Steps (Phase 2)

Once Phase 1 is working and tested:

1. **Migrate summary stats to MariaDB**
   - Update dashboard to use MariaDB for all queries
   - Remove SQL sensors from HA config
   - Keep SQLite as backup only

2. **Performance optimization**
   - Add query caching
   - Optimize refresh frequency
   - Consider WebSocket for real-time updates

3. **Enhanced features**
   - Historical analytics
   - Advanced filtering
   - Export capabilities

## Support

- **Cloudflare Tunnel Setup**: See `CLOUDFLARE_TUNNEL_SETUP.md`
- **MariaDB User Setup**: See `MARIADB_USER_SETUP.md`
- **AppDaemon Setup**: See `manhattan_dashboard/appdaemon/README.md`

---

**Implementation Complete!** Your dashboard now connects directly to MariaDB via Cloudflare Tunnel.
