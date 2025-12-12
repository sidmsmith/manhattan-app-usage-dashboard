# AppDaemon Setup Guide for Manhattan App Usage Dashboard

This guide explains how to set up AppDaemon to write `app_usage_event` to MariaDB.

## Why AppDaemon?

- ✅ **Full Python access** - Can import `mysql-connector-python` (no restrictions)
- ✅ **No 255-char limit** - Can store full JSON event data
- ✅ **More reliable** - Runs as dedicated service, not shell commands
- ✅ **Event-driven** - Listens to HA events directly
- ✅ **Better error handling** - Proper logging and retries
- ✅ **Official HA add-on** - Well-supported and maintained

## Step 1: Install AppDaemon Add-on

1. Go to **Settings** > **Add-ons** > **Add-on Store**
2. Search for **AppDaemon** (official, by Home Assistant)
3. Click **Install**
4. Wait for installation to complete

## Step 2: Configure AppDaemon

1. Go to **AppDaemon** add-on > **Configuration** tab
2. Add the following configuration:

```yaml
python_packages:
  - mysql-connector-python

system_packages: []
```

3. Click **Save**
4. Start the add-on

## Step 3: Set Up AppDaemon Files

AppDaemon looks for apps in `/config/appdaemon/apps/`. You have two options:

### Option A: Symlinks (Recommended - Keeps files organized)

Keep source files in `manhattan_dashboard/appdaemon/` and create symlinks:

```bash
# In HA Terminal or SSH
cd /config/appdaemon
mkdir -p apps
ln -s /config/manhattan_dashboard/appdaemon/apps.yaml apps/apps.yaml
ln -s /config/manhattan_dashboard/appdaemon/custom_event_logger.py apps/custom_event_logger.py
```

**Benefits:**
- ✅ Files stay organized in `manhattan_dashboard/` folder
- ✅ Easy to version control (files in git)
- ✅ Single source of truth
- ✅ Updates automatically when you update files in `manhattan_dashboard/`

### Option B: Copy Files (Traditional)

Copy files from `manhattan_dashboard/appdaemon/` to `/config/appdaemon/apps/`:

**Using File Editor (in HA)**
1. Go to **File Editor** add-on
2. Navigate to `/config/appdaemon/`
3. Create `apps/` folder if it doesn't exist
4. Copy `apps.yaml` from `manhattan_dashboard/appdaemon/apps.yaml`
5. Copy `custom_event_logger.py` from `manhattan_dashboard/appdaemon/custom_event_logger.py`

**Using SSH/SCP**
```bash
# From your local machine
scp -r apps_dashboard/manhattan_dashboard/appdaemon/* homeassistant:/config/appdaemon/apps/
```

**Using Git (if you have git in HA)**
```bash
cd /config
git clone https://github.com/sidmsmith/manhattan-app-usage-dashboard.git
cp -r manhattan-app-usage-dashboard/apps_dashboard/manhattan_dashboard/appdaemon/* appdaemon/apps/
```

## Step 4: Update MariaDB Credentials

Edit `/config/appdaemon/apps/custom_event_logger.py` and update the MariaDB connection:

```python
cnx = mysql.connector.connect(
    host="core-mariadb",
    port=3306,
    user="homeassistant",  # Change if using different user
    password="jacket",      # ⚠️ CHANGE THIS to your actual password
    database="manhattan_app_usage",
    autocommit=False
)
```

**Security Note**: For production, consider:
- Using a dedicated MariaDB user with limited permissions
- Storing password in AppDaemon's secrets or environment variables
- See `MARIADB_PASSWORD_SETUP.md` for options

## Step 5: Verify MariaDB Table Exists

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

## Step 6: Restart AppDaemon

1. Go to **AppDaemon** add-on
2. Click **Restart**
3. Check the **Log** tab for:
   ```
   CustomEventLogger initialized - listening for app_usage_event
   ```

## Step 7: Test

1. Trigger a test event from one of your apps
2. Check AppDaemon logs for:
   ```
   ✅ Logged event to MariaDB: mhe-console - app_opened
   ```
3. Check MariaDB:
   ```sql
   SELECT * FROM app_usage_events ORDER BY created_at DESC LIMIT 5;
   ```

## Troubleshooting

### AppDaemon Not Starting
- Check **Log** tab for errors
- Verify `apps.yaml` syntax is correct
- Verify `custom_event_logger.py` is in `/config/appdaemon/apps/`

### "Module not found: mysql.connector"
- Verify `python_packages: [mysql-connector-python]` is in AppDaemon configuration
- Restart AppDaemon after adding the package

### "Can't connect to MariaDB"
- Verify MariaDB add-on is running
- Check host is `core-mariadb` (not `localhost`)
- Verify credentials are correct
- Test connection manually:
  ```bash
  mariadb -h core-mariadb --ssl=0 -u homeassistant -p manhattan_app_usage
  ```

### Events Not Appearing in MariaDB
- Check AppDaemon logs for errors
- Verify `app_usage_event` is being fired (check HA Developer Tools > Events)
- Verify AppDaemon is listening (should see "CustomEventLogger initialized" in logs)

### "Table doesn't exist"
- Run the table creation script:
  ```bash
  mariadb -h core-mariadb --ssl=0 -u homeassistant -p manhattan_app_usage < /config/manhattan_dashboard/mariadb_create_table.sql
  ```

## File Structure

**With Symlinks (Recommended):**
```
/config/
├── appdaemon/
│   ├── apps/
│   │   ├── apps.yaml                    # Symlink → /config/manhattan_dashboard/appdaemon/apps.yaml
│   │   └── custom_event_logger.py      # Symlink → /config/manhattan_dashboard/appdaemon/custom_event_logger.py
│   └── appdaemon.yaml                   # AppDaemon main config (auto-created)
└── manhattan_dashboard/
    ├── store_event.py                   # Simplified - just fires events
    └── appdaemon/                       # Source files (version controlled in git)
        ├── apps.yaml
        └── custom_event_logger.py
```

**With Copied Files:**
```
/config/
├── appdaemon/
│   ├── apps/
│   │   ├── apps.yaml                    # Copied from manhattan_dashboard/appdaemon/
│   │   └── custom_event_logger.py      # Copied from manhattan_dashboard/appdaemon/
│   └── appdaemon.yaml                   # AppDaemon main config (auto-created)
└── manhattan_dashboard/
    ├── store_event.py                   # Simplified - just fires events
    └── appdaemon/                       # Source files (for reference/version control)
        ├── apps.yaml
        └── custom_event_logger.py
```

## How It Works

1. **App sends webhook** → `/api/webhook/manhattan_app_usage`
2. **HA Automation** → Triggers on webhook, calls `python_script.store_event`
3. **Python Script** → Fires `app_usage_event` with event data
4. **AppDaemon** → Listens for `app_usage_event`, writes to MariaDB
5. **Default Recorder** → Also stores in SQLite (for existing dashboard)

## Benefits Over Shell Command Approach

- ✅ No 255-character limit
- ✅ Full JSON event data stored
- ✅ Proper error handling and logging
- ✅ No shell command reliability issues
- ✅ Can handle complex data structures
- ✅ Better performance (connection pooling possible)

## Next Steps

Once AppDaemon is working:
1. Verify events are appearing in MariaDB
2. Update dashboard to optionally query MariaDB directly
3. Consider moving SQL sensors to query MariaDB instead of SQLite
4. Set up proper password management (secrets.yaml or environment variables)


