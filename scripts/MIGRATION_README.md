# Data Migration: Home Assistant → Neon PostgreSQL

This guide explains how to migrate existing `app_usage_event` data from Home Assistant's SQLite database to Neon PostgreSQL.

## Overview

The migration script (`migrate_ha_to_neon.py`) is a **one-time data load** tool that:
- Reads all `app_usage_event` records from HA SQLite database
- Transforms the data to match Neon schema
- Inserts into Neon PostgreSQL (skipping duplicates)
- Provides progress and summary statistics

## Prerequisites

1. **Python 3.7+** installed
2. **psycopg2-binary** package:
   ```bash
   pip install psycopg2-binary
   ```
3. **Access to HA database file:**
   - Default location: `/config/home-assistant_v2.db`
   - Or set `HA_DB_PATH` environment variable
4. **Neon connection string** (already configured in script)

## Usage

### Option 1: Run from Home Assistant (Recommended)

If you have SSH/terminal access to your HA instance:

```bash
# Navigate to your HA config directory
cd /config

# Copy the script to HA (or run from network share)
# Then run:
python3 migrate_ha_to_neon.py
```

### Option 2: Run from Local Machine

If you have the HA database file accessible:

```bash
# Set the HA database path
export HA_DB_PATH="/path/to/home-assistant_v2.db"

# Or modify the script directly
# Then run:
python3 scripts/migrate_ha_to_neon.py
```

### Option 3: Run from AppDaemon Container

If you have access to the AppDaemon container:

```bash
# Copy script to AppDaemon container
# Then run:
python3 migrate_ha_to_neon.py
```

## Configuration

### Update Database Paths

Edit `migrate_ha_to_neon.py`:

```python
# Home Assistant database path
HA_DB_PATH = '/config/home-assistant_v2.db'  # Update if different

# Neon connection string (already set, but can override with env var)
NEON_CONNECTION_STRING = 'postgresql://...'
```

### Environment Variables

You can also use environment variables:

```bash
export HA_DB_PATH="/custom/path/to/home-assistant_v2.db"
export NEON_DATABASE_URL="postgresql://user:pass@host/db"
python3 migrate_ha_to_neon.py
```

## What the Script Does

1. **Connects to both databases:**
   - HA SQLite: Reads from `events` and `event_data` tables
   - Neon PostgreSQL: Writes to `app_usage_events` table

2. **Fetches events:**
   - Filters for `event_type = 'app_usage_event'`
   - Joins with `event_data` to get JSON payload
   - Parses timestamps (converts from microseconds to datetime)

3. **Transforms data:**
   - Extracts `app_name`, `event_name`, `org` from JSON
   - Converts HA timestamp to PostgreSQL timestamp
   - Preserves full JSON in `event_data` column

4. **Inserts into Neon:**
   - Batch inserts (100 events at a time)
   - Skips duplicates (checks by `event_id`)
   - Commits periodically for safety
   - Shows progress every 50 events

5. **Verification:**
   - Shows summary statistics
   - Counts total events in Neon after migration

## Expected Output

```
🚀 Starting Home Assistant → Neon Migration
============================================================

📂 Connecting to HA database: /config/home-assistant_v2.db
   ✅ Connected to HA database

☁️  Connecting to Neon database...
   ✅ Connected to Neon database

📥 Fetching app_usage_event records from HA...
   ✅ Found 150 events

📋 Sample event:
   Event ID: 12345
   App: mhe-console
   Event: app_opened
   Timestamp: 2025-12-10 10:30:00

⚠️  Ready to migrate 150 events to Neon.
   Continue? (yes/no): yes

📦 Inserting 150 events into Neon...
   Progress: 50 inserted, 0 skipped, 0 errors
   Progress: 100 inserted, 0 skipped, 0 errors
   Progress: 150 inserted, 0 skipped, 0 errors

============================================================
✅ Migration Complete!
   Inserted: 150
   Skipped (duplicates): 0
   Errors: 0
   Total processed: 150

📊 Total events in Neon: 150

🔌 Database connections closed.
```

## Data Mapping

| HA SQLite | Neon PostgreSQL |
|-----------|----------------|
| `events.event_id` | `app_usage_events.event_id` |
| `events.time_fired_ts` | `app_usage_events.timestamp` (converted) |
| `event_data.shared_data` (JSON) | `app_usage_events.event_data` (JSONB) |
| `event_data.shared_data.app_name` | `app_usage_events.app_name` |
| `event_data.shared_data.event_name` | `app_usage_events.event_name` |
| `event_data.shared_data.org` | `app_usage_events.org` |
| - | `app_usage_events.created_at` (auto) |
| - | `app_usage_events.updated_at` (auto) |

## Safety Features

- **Duplicate Prevention:** Checks `event_id` before inserting
- **Transaction Safety:** Commits in batches, rolls back on errors
- **Error Handling:** Continues on individual errors, reports summary
- **Confirmation Prompt:** Asks before proceeding with migration
- **Progress Reporting:** Shows status every 50 events

## Troubleshooting

### Error: "HA database not found"

**Fix:**
- Verify the database path is correct
- Check file permissions
- Use absolute path if relative path doesn't work

### Error: "Neon connection failed"

**Fix:**
- Verify connection string is correct
- Check network connectivity
- Ensure SSL mode is `require`

### Error: "No events found"

**Possible causes:**
- No `app_usage_event` events in HA database yet
- Wrong event type name (should be exactly `app_usage_event`)
- Database path is incorrect

**Fix:**
- Verify events exist: `SELECT COUNT(*) FROM events e JOIN event_types et ON e.event_type_id = et.event_type_id WHERE et.event_type = 'app_usage_event';`

### Error: "IntegrityError" or "duplicate key"

**This is normal!** The script skips duplicates automatically. If you see many skipped events, they were already migrated.

### Performance Issues

**For large datasets (>10,000 events):**
- Increase batch size: Change `batch_size=100` to `batch_size=500`
- Run during off-peak hours
- Monitor Neon database performance

## After Migration

1. **Verify data:**
   ```sql
   -- In Neon SQL Editor
   SELECT COUNT(*) FROM app_usage_events;
   SELECT app_name, COUNT(*) FROM app_usage_events GROUP BY app_name;
   ```

2. **Test dashboard:**
   - Check if dashboard shows historical events
   - Verify event counts match expectations

3. **Clean up (optional):**
   - Script is one-time use, can be deleted after successful migration
   - Or keep for future migrations if needed

## Notes

- **One-time script:** This is not meant to run continuously
- **Idempotent:** Safe to run multiple times (skips duplicates)
- **Read-only on HA:** Only reads from HA, never modifies
- **Preserves data:** Full JSON payload is preserved in `event_data`

---

**Ready to migrate!** Run the script when you're ready to copy historical data to Neon.

