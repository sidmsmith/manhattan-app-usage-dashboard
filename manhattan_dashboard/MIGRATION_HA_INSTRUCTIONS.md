# Running Migration Script from Home Assistant

This guide explains how to run the migration script directly from your Home Assistant instance.

## Quick Start

### Step 1: Install psycopg2-binary in HA

You need to install the PostgreSQL client library in Home Assistant.

#### Option A: Install in HA Core Container (Recommended)

1. **Open HA Terminal:**
   - Go to **Settings** → **Add-ons** → **Terminal & SSH** (or use Advanced Terminal)
   - Or use SSH if configured

2. **Install psycopg2-binary:**
   ```bash
   docker exec -it homeassistant pip install psycopg2-binary
   ```

#### Option B: Install in AppDaemon Container

If you have AppDaemon running:

1. **Open AppDaemon Terminal:**
   - Go to **Settings** → **Add-ons** → **AppDaemon**
   - Click **Terminal** tab

2. **Install psycopg2-binary:**
   ```bash
   pip install psycopg2-binary
   ```

#### Option C: Add to AppDaemon Python Packages

If AppDaemon is already configured:

1. **Edit AppDaemon Configuration:**
   - Go to **Settings** → **Add-ons** → **AppDaemon** → **Configuration**
   - Add to `python_packages`:
   ```yaml
   python_packages:
     - psycopg2-binary
   ```
2. **Restart AppDaemon**

### Step 2: Copy Script to HA

The script is already in your Git repository at:
```
manhattan_dashboard/migrate_ha_to_neon.py
```

**If using File Editor:**
1. Open **File Editor** add-on in HA
2. Navigate to `/config/manhattan_dashboard/`
3. Create new file: `migrate_ha_to_neon.py`
4. Copy contents from the script in the repository

**If using SCP/SSH:**
```bash
# From your local machine
scp apps_dashboard/manhattan_dashboard/migrate_ha_to_neon.py \
    root@your-ha-ip:/config/manhattan_dashboard/
```

**If using Samba/Network Share:**
- Copy the file to your HA config directory
- Place in `manhattan_dashboard/` folder

### Step 3: Run the Script

#### Option A: From HA Terminal

1. **Open Terminal:**
   - Go to **Settings** → **Add-ons** → **Terminal & SSH**
   - Or use **Advanced Terminal** (Settings → Advanced → Terminal)

2. **Navigate and run:**
   ```bash
   cd /config
   python3 manhattan_dashboard/migrate_ha_to_neon.py
   ```

#### Option B: From AppDaemon Terminal

1. **Open AppDaemon Terminal:**
   - Go to **Settings** → **Add-ons** → **AppDaemon** → **Terminal**

2. **Run script:**
   ```bash
   python3 /config/manhattan_dashboard/migrate_ha_to_neon.py
   ```

#### Option C: From SSH

If you have SSH access:

```bash
ssh root@your-ha-ip
cd /config
python3 manhattan_dashboard/migrate_ha_to_neon.py
```

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

📊 Events by app:
   mhe-console: 45 events
   order-generator: 30 events
   schedule-app: 25 events
   ...

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

📊 Events in Neon by app:
   mhe-console: 45 events
   order-generator: 30 events
   schedule-app: 25 events
   ...

🔌 Database connections closed.
```

## Troubleshooting

### Error: "psycopg2-binary is not installed"

**Fix:**
- Install using one of the methods in Step 1 above
- Verify installation: `python3 -c "import psycopg2; print('OK')"`

### Error: "HA database not found"

**Fix:**
- Verify database exists: `ls -la /config/home-assistant_v2.db`
- Check if using different database name (some HA installs use different names)
- Update `HA_DB_PATH` in script if needed

### Error: "Neon connection failed"

**Fix:**
- Verify connection string is correct in script
- Check network connectivity from HA to Neon
- Ensure SSL mode is `require`

### Error: "Permission denied"

**Fix:**
- Run as root or user with database access
- Check file permissions: `chmod +x /config/manhattan_dashboard/migrate_ha_to_neon.py`

### Script Not Found

**Fix:**
- Verify script location: `ls -la /config/manhattan_dashboard/migrate_ha_to_neon.py`
- Use absolute path: `python3 /config/manhattan_dashboard/migrate_ha_to_neon.py`

## Verification After Migration

1. **Check Neon Database:**
   - Go to Neon SQL Editor
   - Run: `SELECT COUNT(*) FROM app_usage_events;`
   - Should match the number of events migrated

2. **Check Dashboard:**
   - Open your dashboard
   - Verify historical events are showing
   - Check event counts match expectations

## Notes

- **One-time use:** This script is designed for a single migration
- **Safe to re-run:** Will skip duplicates if run multiple times
- **Read-only on HA:** Only reads from HA database, never modifies
- **Progress reporting:** Shows status every 50 events

---

**Ready to migrate!** Once `psycopg2-binary` is installed, you can run the script from HA.

