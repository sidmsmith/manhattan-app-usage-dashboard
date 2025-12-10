# Python Script MariaDB Integration

## Current Implementation

The `store_event.py` script now writes to both:
1. **HA Event Bus** (SQLite) - Existing functionality, always works
2. **MariaDB** - New parallel storage, experimental

## Connection Details

- **Host**: `core-mariadb`
- **User**: `homeassistant`
- **Database**: `manhattan_app_usage`
- **SSL**: Disabled (`--ssl=0`)
- **Method**: `subprocess` calling `mariadb` CLI

## Password Handling

The script currently relies on:
- MariaDB password stored in `.my.cnf` file, OR
- Password-less authentication for `homeassistant` user, OR
- Environment variable (if HA Python scripts support it)

### Setting up Password-less Access (Recommended for Testing)

Create `.my.cnf` in `/config/`:

```ini
[client]
host=core-mariadb
user=homeassistant
database=manhattan_app_usage
ssl=0
```

Then set the password:
```bash
# In HA terminal
mariadb -h core-mariadb --ssl=0 -u homeassistant -p manhattan_app_usage
# Enter password, then:
SET PASSWORD FOR 'homeassistant'@'%' = PASSWORD('your_password');
```

Or create `.my.cnf` with password (less secure):
```ini
[client]
host=core-mariadb
user=homeassistant
password=your_password
database=manhattan_app_usage
ssl=0
```

## Troubleshooting

### MariaDB Write Fails Silently

The script is designed to fail silently if MariaDB write doesn't work. Check HA logs:

```bash
# In HA terminal
tail -f /config/home-assistant.log | grep -i mariadb
```

Or check Python script logs in HA UI: **Developer Tools** > **Logs**

### subprocess Not Available

If `subprocess` is not available in HA Python scripts, we'll need to use an alternative approach (see `store_event_mariadb_alternative.py`).

### Password Authentication Issues

If password prompts cause issues:
1. Set up `.my.cnf` with credentials
2. Or create a dedicated user with no password (less secure)
3. Or modify script to use a different authentication method

## Testing

After deploying the script, test by:
1. Trigger a webhook event from one of your apps
2. Check HA logs for "MariaDB write successful" message
3. Connect to MariaDB and verify:
   ```sql
   SELECT * FROM app_usage_events ORDER BY created_at DESC LIMIT 5;
   ```

## Security Considerations

- **Current**: Uses `homeassistant` user (shared with HA core)
- **Future**: Should create dedicated `dashboard_user` with limited permissions
- **Password**: Store in `.my.cnf` or use environment variables (if supported)

## Creating Dedicated User (Future Enhancement)

```sql
-- Connect as root
mariadb -h core-mariadb --ssl=0 -u root -p

-- Create user
CREATE USER 'dashboard_user'@'%' IDENTIFIED BY 'secure_password';

-- Grant permissions (only what's needed)
GRANT SELECT, INSERT ON manhattan_app_usage.app_usage_events TO 'dashboard_user'@'%';

FLUSH PRIVILEGES;
```

Then update `store_event.py` to use `dashboard_user` instead of `homeassistant`.

