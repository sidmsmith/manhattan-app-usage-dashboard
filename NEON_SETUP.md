# Neon PostgreSQL Setup Guide

This guide explains how to set up Neon PostgreSQL for the Manhattan App Usage Dashboard.

## Overview

Neon is a serverless PostgreSQL database that provides:
- Cloud-based storage (accessible from Vercel without tunnels)
- Automatic backups and scaling
- Free tier available
- Full PostgreSQL compatibility

## Step 1: Create Neon Account and Database

1. **Sign up for Neon:**
   - Go to https://neon.tech
   - Sign up for a free account (no credit card required for free tier)

2. **Create a New Project:**
   - Click **"Create Project"**
   - Choose a project name (e.g., "manhattan-app-usage")
   - Select a region (choose closest to your Vercel deployment)
   - Click **"Create Project"**

3. **Note Your Connection Details:**
   - After creation, Neon will show connection details
   - **Important:** Use the **Pooler endpoint** (recommended for serverless)
   - Connection string format: `postgresql://user:password@host:port/database?sslmode=require`

## Step 2: Create Database Schema

### Option A: Using Neon SQL Editor

1. In Neon dashboard, go to **SQL Editor**
2. Create the table using PostgreSQL syntax:

```sql
-- Create app_usage_events table (PostgreSQL version)
CREATE TABLE IF NOT EXISTS app_usage_events (
    id BIGSERIAL PRIMARY KEY,
    event_id INTEGER NULL,  -- Original HA event_id (for reference, may be NULL)
    event_name VARCHAR(255) NOT NULL,
    app_name VARCHAR(255) NOT NULL,
    org VARCHAR(255) NULL,
    timestamp TIMESTAMP NOT NULL,
    event_data JSONB NOT NULL,  -- Full JSON payload (JSONB for better performance)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes for common queries
    CONSTRAINT idx_app_name CHECK (app_name IS NOT NULL),
    CONSTRAINT idx_event_name CHECK (event_name IS NOT NULL)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_app_name ON app_usage_events(app_name);
CREATE INDEX IF NOT EXISTS idx_timestamp ON app_usage_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_event_name ON app_usage_events(event_name);
CREATE INDEX IF NOT EXISTS idx_org ON app_usage_events(org);
CREATE INDEX IF NOT EXISTS idx_app_timestamp ON app_usage_events(app_name, timestamp);
CREATE INDEX IF NOT EXISTS idx_app_time_range ON app_usage_events(app_name, timestamp);

-- Create GIN index for JSONB queries (for efficient JSON searches)
CREATE INDEX IF NOT EXISTS idx_event_data_gin ON app_usage_events USING GIN (event_data);
```

### Option B: Adapt from MariaDB Schema

If you have the MariaDB schema (`mariadb_create_table.sql`), adapt it:

**Key Differences:**
- `INT AUTO_INCREMENT` → `BIGSERIAL` (PostgreSQL auto-increment)
- `JSON` → `JSONB` (PostgreSQL JSON binary type, better performance)
- `DATETIME` → `TIMESTAMP`
- `TIMESTAMP DEFAULT CURRENT_TIMESTAMP` → `TIMESTAMP DEFAULT CURRENT_TIMESTAMP`
- Index syntax is similar

## Step 3: Get Connection String

1. In Neon dashboard, go to **Connection Details**
2. Select **"Pooler"** tab (not "Direct connection")
3. Copy the connection string
   - Format: `postgresql://user:password@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require`
   - Or note individual components:
     - Host: `ep-xxx-pooler.region.aws.neon.tech`
     - Database: `neondb` (or your database name)
     - User: `neondb_owner` (or your user)
     - Password: (your password)
     - Port: `5432` (default PostgreSQL port)

## Step 4: Add to Vercel Environment Variables

1. Go to Vercel project → **Settings** → **Environment Variables**
2. Add:
   - **Name:** `NEON_DATABASE_URL`
   - **Value:** Your full connection string from Step 3
   - **Environment:** Production, Preview, Development (all)

**Example:**
```
NEON_DATABASE_URL=postgresql://neondb_owner:password@ep-small-firefly-aha9kbbm-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require
```

## Step 5: Verify Connection

### Test from Vercel Function

After deploying, test the health endpoint:
```
https://your-vercel-app.vercel.app/api/fetch-neon?query=health
```

**Expected response:**
```json
{
  "status": "ok",
  "service": "neon-postgresql-connection",
  "database": "neondb",
  "server_time": "2025-12-11T12:00:00.000Z"
}
```

### Test from Local Machine (Optional)

If you have `psql` installed:

```bash
psql "postgresql://user:password@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require"
```

Then run:
```sql
SELECT COUNT(*) FROM app_usage_events;
```

## Step 6: Verify Data is Being Written

1. **Check AppDaemon Logs:**
   - In HA, go to **AppDaemon** add-on → **Logs**
   - Look for: `🟢 Neon: Inserted {app_name} - {event_name}`
   - If you see `🟡 Neon insert failed`, check credentials

2. **Query Neon Database:**
   - Use Neon SQL Editor or `psql`
   - Run: `SELECT COUNT(*) FROM app_usage_events;`
   - Should show increasing count as events are logged

## PostgreSQL vs MySQL/MariaDB Differences

| Feature | MySQL/MariaDB | PostgreSQL |
|---------|---------------|------------|
| Auto-increment | `INT AUTO_INCREMENT` | `BIGSERIAL` |
| JSON type | `JSON` | `JSONB` (binary, faster) |
| Parameter placeholders | `?` | `$1, $2, $3...` |
| JSON extraction | `JSON_EXTRACT(data, '$.key')` | `data->>'key'` (text) or `data->'key'` (JSONB) |
| Date arithmetic | `DATE_SUB(NOW(), INTERVAL 24 HOUR)` | `NOW() - INTERVAL '24 hours'` |
| Database function | `DATABASE()` | `current_database()` |

## Troubleshooting

### Connection Errors

**Error:** "Connection refused" or "timeout"
- **Fix:** Verify connection string is correct
- **Fix:** Ensure you're using **Pooler endpoint** (not direct connection)
- **Fix:** Check SSL mode is `require` in connection string

**Error:** "password authentication failed"
- **Fix:** Verify password in connection string
- **Fix:** Check user has proper permissions

**Error:** "database does not exist"
- **Fix:** Verify database name in connection string
- **Fix:** Create database if it doesn't exist

### Query Errors

**Error:** "column does not exist"
- **Fix:** Verify table schema matches (run `\d app_usage_events` in psql)
- **Fix:** Check column names match (case-sensitive in PostgreSQL)

**Error:** "syntax error at or near..."
- **Fix:** Verify SQL uses PostgreSQL syntax (not MySQL)
- **Fix:** Check parameter placeholders are `$1, $2` not `?`

### Performance Issues

**Slow queries:**
- **Fix:** Ensure indexes are created (see schema above)
- **Fix:** Use JSONB GIN index for JSON queries
- **Fix:** Check query execution plan: `EXPLAIN ANALYZE SELECT ...`

## Security Best Practices

1. **Connection String:**
   - Store in Vercel environment variables (never commit to Git)
   - Use pooler endpoint for better connection management
   - Enable SSL (`sslmode=require`)

2. **Database User:**
   - Create read-only user for dashboard queries (if needed)
   - Use strong passwords
   - Rotate passwords periodically

3. **Network Access:**
   - Neon is cloud-based, accessible from anywhere
   - No firewall configuration needed
   - SSL encryption protects data in transit

## Next Steps

1. ✅ Neon database created
2. ✅ Schema created
3. ✅ Connection string added to Vercel
4. ✅ AppDaemon writing to Neon (verify logs)
5. ✅ Dashboard queries Neon (test `/api/fetch-neon?query=health`)

## Support Resources

- **Neon Documentation:** https://neon.tech/docs
- **PostgreSQL Documentation:** https://www.postgresql.org/docs/
- **Node.js pg Library:** https://node-postgres.com/

---

**Setup Complete!** Your dashboard can now query Neon PostgreSQL for full event data.

