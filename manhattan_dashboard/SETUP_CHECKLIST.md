# AppDaemon MariaDB Integration - Setup Checklist

## ✅ Files Already in HA

All necessary files are now in Home Assistant:

- ✅ `/config/manhattan_dashboard/store_event.py` - Simplified Python script (just fires events)
- ✅ `/config/manhattan_dashboard/appdaemon/apps.yaml` - AppDaemon app configuration
- ✅ `/config/manhattan_dashboard/appdaemon/custom_event_logger.py` - Event logger app
- ✅ `/config/configuration.yaml` - Updated with includes

## 🔧 Required Setup Steps

### Step 1: Verify Python Script Symlink

The Python script needs to be accessible from `/config/python_scripts/`. Check if symlink exists:

```bash
# In HA Terminal or SSH
ls -la /config/python_scripts/store_event.py
```

If it doesn't exist or shows an error, create the symlink:

```bash
# Remove old file if it exists
rm /config/python_scripts/store_event.py

# Create symlink
ln -s /config/manhattan_dashboard/store_event.py /config/python_scripts/store_event.py
```

### Step 2: Install AppDaemon Add-on

1. Go to **Settings** > **Add-ons** > **Add-on Store**
2. Search for **AppDaemon** (official, by Home Assistant)
3. Click **Install**
4. Wait for installation to complete

### Step 3: Configure AppDaemon

1. Go to **AppDaemon** add-on > **Configuration** tab
2. Add the following configuration:

```yaml
python_packages:
  - mysql-connector-python

system_packages: []
```

3. Click **Save**
4. **Start AppDaemon once** - This creates the `/config/appdaemon` directory
5. **Stop AppDaemon** - We'll restart it after setting up the app files

### Step 4: Set Up AppDaemon App Files

**Note**: The `/config/appdaemon` directory is created when AppDaemon is started for the first time. If you get "no such file or directory", make sure you've installed and started AppDaemon at least once (see Step 3).

You have two options:

#### Option A: Symlinks (Recommended - Keeps files organized)

```bash
# In HA Terminal or SSH
cd /config/appdaemon
mkdir -p apps
ln -s /config/manhattan_dashboard/appdaemon/apps.yaml apps/apps.yaml
ln -s /config/manhattan_dashboard/appdaemon/custom_event_logger.py apps/custom_event_logger.py
```

#### Option B: Copy Files

```bash
# In HA Terminal or SSH
mkdir -p /config/appdaemon/apps
cp /config/manhattan_dashboard/appdaemon/apps.yaml /config/appdaemon/apps/
cp /config/manhattan_dashboard/appdaemon/custom_event_logger.py /config/appdaemon/apps/
```

### Step 5: ⚠️ UPDATE MARIADB PASSWORD

**CRITICAL**: Edit the AppDaemon app to use your actual MariaDB password:

```bash
# Edit the file (use File Editor add-on or SSH)
nano /config/appdaemon/apps/custom_event_logger.py
# OR if using symlinks:
nano /config/manhattan_dashboard/appdaemon/custom_event_logger.py
```

Find this line (around line 28):
```python
password="jacket",  # ⚠️ TODO: Update with your actual password
```

Change `"jacket"` to your actual MariaDB password for the `homeassistant` user.

**Security Note**: For production, consider:
- Using a dedicated MariaDB user with limited permissions
- Storing password in AppDaemon's secrets or environment variables
- See `MARIADB_PASSWORD_SETUP.md` for options

### Step 6: Verify MariaDB Table Exists

Connect to MariaDB and verify the table exists:

```bash
mariadb -h core-mariadb --ssl=0 -u homeassistant -p manhattan_app_usage
```

```sql
DESCRIBE app_usage_events;
-- Should show: id, event_id, event_name, app_name, org, timestamp, event_data, created_at, updated_at
```

If the table doesn't exist, run the setup script:
```bash
mariadb -h core-mariadb --ssl=0 -u homeassistant -p manhattan_app_usage < /config/manhattan_dashboard/mariadb_create_table.sql
```

### Step 7: Start AppDaemon

1. Go to **AppDaemon** add-on
2. Click **Start** (or **Restart** if it was already running)
3. Check the **Log** tab for:
   ```
   CustomEventLogger initialized - listening for app_usage_event
   ```

**Note**: If you see errors about missing files, verify the symlinks were created correctly:
```bash
ls -la /config/appdaemon/apps/
# Should show:
# apps.yaml -> /config/manhattan_dashboard/appdaemon/apps.yaml
# custom_event_logger.py -> /config/manhattan_dashboard/appdaemon/custom_event_logger.py
```

If you see errors, check the troubleshooting section below.

### Step 8: Test

1. Trigger a test event from one of your apps
2. Check AppDaemon logs for:
   ```
   ✅ Logged event to MariaDB: mhe-console - app_opened
   ```
3. Check MariaDB:
   ```sql
   SELECT * FROM app_usage_events ORDER BY created_at DESC LIMIT 5;
   ```

## 🔍 Troubleshooting

### AppDaemon Not Starting
- Check **Log** tab for errors
- Verify `apps.yaml` syntax is correct
- Verify `custom_event_logger.py` is in `/config/appdaemon/apps/`
- If using symlinks, verify they're not broken: `ls -la /config/appdaemon/apps/`

### "Module not found: mysql.connector"
- Verify `python_packages: [mysql-connector-python]` is in AppDaemon configuration
- Restart AppDaemon after adding the package

### "Can't connect to MariaDB"
- Verify MariaDB add-on is running
- Check host is `core-mariadb` (not `localhost`)
- Verify password is correct in `custom_event_logger.py`
- Test connection manually:
  ```bash
  mariadb -h core-mariadb --ssl=0 -u homeassistant -p manhattan_app_usage
  ```

### Events Not Appearing in MariaDB
- Check AppDaemon logs for errors
- Verify `app_usage_event` is being fired (check HA Developer Tools > Events)
- Verify AppDaemon is listening (should see "CustomEventLogger initialized" in logs)
- Verify Python script symlink exists and works

### "Table doesn't exist"
- Run the table creation script:
  ```bash
  mariadb -h core-mariadb --ssl=0 -u homeassistant -p manhattan_app_usage < /config/manhattan_dashboard/mariadb_create_table.sql
  ```

## 📋 Configuration Summary

**Files that need manual configuration:**

1. **`/config/appdaemon/apps/custom_event_logger.py`** (or symlinked from `/config/manhattan_dashboard/appdaemon/custom_event_logger.py`)
   - ⚠️ **REQUIRED**: Update `password="jacket"` to your actual MariaDB password (line 28)

**Files that are ready to use (no changes needed):**

- `/config/manhattan_dashboard/store_event.py` - Already simplified, no MariaDB code
- `/config/manhattan_dashboard/appdaemon/apps.yaml` - AppDaemon config, ready to use
- `/config/configuration.yaml` - Already includes all necessary configs

## ✅ Quick Verification

After setup, verify everything is working:

```bash
# 1. Check Python script symlink
ls -la /config/python_scripts/store_event.py

# 2. Check AppDaemon files
ls -la /config/appdaemon/apps/

# 3. Check AppDaemon logs
# (In HA UI: AppDaemon add-on > Log tab)

# 4. Test MariaDB connection
mariadb -h core-mariadb --ssl=0 -u homeassistant -p manhattan_app_usage -e "SELECT COUNT(*) FROM app_usage_events;"
```

## 🎯 Next Steps After Setup

Once everything is working:
1. Verify events are appearing in MariaDB
2. Update dashboard to optionally query MariaDB directly
3. Consider moving SQL sensors to query MariaDB instead of SQLite
4. Set up proper password management (secrets.yaml or environment variables)


