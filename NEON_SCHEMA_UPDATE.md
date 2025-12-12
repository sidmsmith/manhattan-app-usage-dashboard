# Neon Database Schema Update Guide

This guide explains how to update your Neon PostgreSQL database with missing columns, indexes, and views.

## Current Issue

The Neon table is missing:
- `created_at` column (causing query errors)
- `updated_at` column (optional, but useful)
- Proper indexes for performance
- Views for common queries

## Quick Fix: Run SQL Script

### Option 1: Using Neon SQL Editor (Recommended)

1. **Open Neon Dashboard:**
   - Go to https://console.neon.tech
   - Select your project

2. **Open SQL Editor:**
   - Click **"SQL Editor"** in the left sidebar
   - Create a new query

3. **Copy and Paste:**
   - Open `manhattan_dashboard/neon_schema_update.sql`
   - Copy the entire contents
   - Paste into Neon SQL Editor
   - Click **"Run"**

4. **Verify:**
   - Check for "Schema update complete!" message
   - Review the index and view counts

### Option 2: Using psql (Command Line)

If you have `psql` installed:

```bash
# Connect to Neon (use your connection string)
psql "postgresql://neondb_owner:npg_HCWtem4D6fcR@ep-small-firefly-aha9kbbm-pooler.c-3.us-east-1.aws.neon.tech:5432/neondb?sslmode=require"

# Run the script
\i manhattan_dashboard/neon_schema_update.sql
```

### Option 3: Using neonctl (If Configured)

```bash
# If neonctl is configured
neonctl sql --execute "$(cat manhattan_dashboard/neon_schema_update.sql)"
```

## What the Script Does

1. **Adds Missing Columns:**
   - `created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`
   - `updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`

2. **Creates Indexes:**
   - `idx_app_name` - Fast lookups by app
   - `idx_timestamp` - Fast time-based queries
   - `idx_event_name` - Fast event type lookups
   - `idx_org` - Fast org filtering
   - `idx_app_timestamp` - Composite index for app + time queries
   - `idx_event_data_gin` - GIN index for JSONB searches

3. **Creates Views:**
   - `recent_events_by_app` - Recent events grouped by app
   - `app_statistics` - Per-app aggregate statistics
   - `all_apps_statistics` - Overall aggregate statistics

## Verification

After running the script, verify:

```sql
-- Check columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'app_usage_events'
ORDER BY ordinal_position;

-- Check indexes exist
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'app_usage_events';

-- Check views exist
SELECT table_name 
FROM information_schema.views 
WHERE table_schema = 'public';
```

## Expected Results

**Columns:**
- id (bigint)
- event_id (integer)
- event_name (varchar)
- app_name (varchar)
- org (varchar)
- timestamp (timestamp)
- event_data (jsonb)
- created_at (timestamp) ← **NEW**
- updated_at (timestamp) ← **NEW**

**Indexes:** 7 indexes total (including GIN index)

**Views:** 3 views (recent_events_by_app, app_statistics, all_apps_statistics)

## After Update

Once the schema is updated:

1. **Update AppDaemon (Optional):**
   - The `created_at` and `updated_at` columns will auto-populate
   - No changes needed to `custom_event_logger.py` (columns have defaults)

2. **Update API Queries (Optional):**
   - Can now safely SELECT `created_at` and `updated_at` in queries
   - Views can be used for optimized queries

3. **Test Endpoints:**
   - Health: `/api/fetch-neon?query=health`
   - Recent Events: `/api/fetch-neon?query=recent-events&limit=5`
   - Statistics: `/api/fetch-neon?query=statistics`

## Troubleshooting

**Error: "column already exists"**
- Safe to ignore - the script uses `IF NOT EXISTS` checks
- Columns may have been added manually

**Error: "permission denied"**
- Verify you're using the correct user (neondb_owner)
- Check user has CREATE INDEX and CREATE VIEW permissions

**Error: "relation does not exist"**
- Table `app_usage_events` must exist first
- Create table using the schema in `NEON_SETUP.md` if needed

---

**Ready to update!** Run the SQL script in Neon SQL Editor to complete the schema setup.
