# MariaDB Password Configuration

## Current Setup (Testing)

The `store_event.py` script currently uses a hardcoded password for testing:
- Password: `jacket` (hardcoded in script)
- User: `homeassistant`
- This is fine for the experimental branch

## Production Setup Options

### Option 1: Use HA secrets.yaml (Recommended)

1. Add to `/config/secrets.yaml`:
   ```yaml
   mariadb_password: your_secure_password_here
   ```

2. Update `store_event.py` to read from secrets:
   ```python
   # In store_event.py
   mariadb_password = hass.config.secrets.get("mariadb_password", "jacket")
   ```

**Note**: `secrets.yaml` is already in `.gitignore`, so passwords won't be committed.

### Option 2: Use .my.cnf file

1. Create `/config/.my.cnf`:
   ```ini
   [client]
   host=core-mariadb
   user=homeassistant
   password=your_secure_password_here
   database=manhattan_app_usage
   ssl=0
   ```

2. Update `store_event.py` to use `--defaults-file`:
   ```python
   cmd = [
       "mariadb",
       "--defaults-file=/config/.my.cnf",
       "manhattan_app_usage",
       "-e", sql
   ]
   ```

**Note**: Add `/config/.my.cnf` to `.gitignore` if not already there.

### Option 3: Store in manhattan_dashboard folder

If you want to keep everything in the `manhattan_dashboard` folder:

1. Create `/config/manhattan_dashboard/.my.cnf`:
   ```ini
   [client]
   host=core-mariadb
   user=homeassistant
   password=your_secure_password_here
   database=manhattan_app_usage
   ssl=0
   ```

2. Update `store_event.py`:
   ```python
   cmd = [
       "mariadb",
       "--defaults-file=/config/manhattan_dashboard/.my.cnf",
       "manhattan_app_usage",
       "-e", sql
   ]
   ```

3. Add to `.gitignore`:
   ```
   manhattan_dashboard/.my.cnf
   ```

## Security Best Practices

1. **Never commit passwords to git** - Use `.gitignore`
2. **Use strong passwords** - Don't use "jacket" in production
3. **Limit permissions** - Create dedicated user with only INSERT permission
4. **Use secrets.yaml** - HA's built-in secrets management
5. **Rotate passwords** - Change passwords periodically

## Creating Dedicated User (Future)

For better security, create a dedicated user with limited permissions:

```sql
-- Connect as root
mariadb -h core-mariadb --ssl=0 -u root -p

-- Create dedicated user
CREATE USER 'dashboard_user'@'%' IDENTIFIED BY 'secure_password';

-- Grant only INSERT permission (dashboard reads via separate user/service)
GRANT INSERT ON manhattan_app_usage.app_usage_events TO 'dashboard_user'@'%';

FLUSH PRIVILEGES;
```

Then update `store_event.py` to use `dashboard_user` instead of `homeassistant`.

## Current Status

- ✅ Testing: Hardcoded password "jacket" (experimental branch only)
- ⏭️ Production: Move to secrets.yaml or .my.cnf
- ⏭️ Security: Create dedicated user with limited permissions



