# Fix Timestamps in Neon Database

## Problem
The migrated events from Home Assistant SQLite to Neon have incorrect timestamps (all showing `1969-12-31 19:29:25`). The correct timestamps are stored in the `event_data` JSON column.

## Solution
Extract the timestamp from `event_data->>'timestamp'` and update the `timestamp` column.

## Option 1: Run SQL Script Directly (Recommended)

1. **Open Neon SQL Editor** in your Neon dashboard
2. **Copy and paste** the SQL from `neon_fix_timestamps.sql`
3. **Run the preview query first** to see what will be updated
4. **Run the UPDATE query** to fix the timestamps
5. **Verify** with the verification queries

## Option 2: Run Node.js Script

### Prerequisites
- Node.js installed
- `NEON_DATABASE_URL` environment variable set

### Steps

1. **Set the environment variable:**
   ```bash
   # Windows PowerShell
   $env:NEON_DATABASE_URL="postgresql://neondb_owner:npg_HCWtem4D6fcR@ep-small-firefly-aha9kbbm-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"
   
   # Or create a .env file in apps_dashboard folder:
   # NEON_DATABASE_URL=postgresql://neondb_owner:npg_HCWtem4D6fcR@ep-small-firefly-aha9kbbm-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require
   ```

2. **Run the script:**
   ```bash
   cd apps_dashboard
   npm run fix-neon-timestamps
   ```

   Or directly:
   ```bash
   node scripts/fix-neon-timestamps.js
   ```

## What the Script Does

1. **Checks** how many records have bad timestamps
2. **Previews** what will be updated (first 5 records)
3. **Updates** the timestamp column using the value from `event_data` JSON
4. **Verifies** the fix worked
5. **Shows** a sample of fixed records

## Expected Output

```
✅ Connected to Neon database

📊 Checking records with bad timestamps...
   Found 150 records with bad timestamps
   Min timestamp: 1969-12-31 19:29:25.400008+00
   Max timestamp: 1969-12-31 19:29:25.400008+00

🔍 Preview of records to be fixed (first 5):
   1. ID 123 (Order Generator):
      Current: 1969-12-31 19:29:25.400008+00
      JSON:    2025-12-08T02:40:26.209Z
      New:     2025-12-08 02:40:26.209

🔧 Updating timestamps...
   ✅ Updated 150 records

✅ Verifying fix...
   ✅ All timestamps fixed!

📋 Sample of fixed records:
   1. Order Generator - app_opened
      Timestamp: 2025-12-08 02:40:26.209

✅ Timestamp fix completed!
```

## Safety Features

- Only updates records where `timestamp < '1970-01-01'` (the bad epoch date)
- Only updates if `event_data->>'timestamp'` exists and is not empty
- Shows preview before making changes
- Verifies the fix after completion

## Troubleshooting

**If no records are found:**
- The timestamps may have already been fixed
- Or the `event_data` JSON doesn't contain a `timestamp` field

**If update fails:**
- Check that `NEON_DATABASE_URL` is correct
- Verify you have write permissions on the database
- Check the timestamp format in `event_data` JSON

**If some records still have bad timestamps:**
- These records may not have a `timestamp` field in their `event_data` JSON
- You may need to manually fix these or investigate the source data

## After Fixing

1. **Refresh the dashboard** - timestamps should now display correctly
2. **Verify** a few events show the correct dates/times
3. **Check** that the "12/31 14:29" issue is resolved
