# MariaDB Setup Guide for Manhattan App Usage Dashboard

This guide walks you through setting up MariaDB as a parallel storage solution for app usage events.

## Prerequisites

- ✅ MariaDB add-on installed in Home Assistant
- ✅ Access to Home Assistant via SSH or File Editor
- ✅ MariaDB add-on is running

## Step 1: Access MariaDB

You have several options to run the setup script:

### Option A: Using MariaDB Add-on's Built-in Tool

1. Go to **Settings** > **Add-ons** > **MariaDB**
2. Click **OPEN WEB UI** (if available)
3. Use the built-in database tool to run SQL commands

### Option B: Using SSH

1. SSH into your Home Assistant instance
2. Navigate to the config directory:
   ```bash
   cd /config/manhattan_dashboard
   ```
3. Run the setup script:
   ```bash
   mysql -u root -p < mariadb_setup.sql
   ```
   (You'll be prompted for the root password)

### Option C: Using File Editor Add-on

1. Open File Editor add-on
2. Navigate to `/config/manhattan_dashboard/`
3. Open `mariadb_setup.sql`
4. Copy the contents
5. Use a database tool (like phpMyAdmin, DBeaver, or MySQL Workbench) to connect and run the script

## Step 2: Run the Setup Script

The setup script (`mariadb_setup.sql`) will:
- Create the `manhattan_app_usage` database
- Create the `dashboard_user` user
- Grant necessary permissions
- Create the `app_usage_events` table
- Create useful views for queries

**Important**: Before running, edit the script and change:
```sql
CREATE USER IF NOT EXISTS 'dashboard_user'@'%' IDENTIFIED BY 'your_secure_password';
```
Replace `'your_secure_password'` with a strong password.

## Step 3: Verify Setup

After running the script, verify everything is set up correctly:

```sql
-- Connect to MariaDB
mysql -u dashboard_user -p manhattan_app_usage

-- Check if table exists
SHOW TABLES;

-- Should show:
-- app_usage_events
-- (and views if created)

-- Check table structure
DESCRIBE app_usage_events;

-- Test insert (optional)
INSERT INTO app_usage_events (event_name, app_name, org, timestamp, event_data)
VALUES ('test_event', 'test-app', 'TEST-ORG', NOW(), '{"test": "data"}');

-- Verify insert
SELECT * FROM app_usage_events LIMIT 1;

-- Clean up test data
DELETE FROM app_usage_events WHERE app_name = 'test-app';
```

## Step 4: Get Connection Details

You'll need these details for configuration:

### From Home Assistant Add-on

1. Go to **Settings** > **Add-ons** > **MariaDB** > **Configuration**
2. Note the port (usually `3306`)
3. Note the host:
   - **From HA**: `localhost` or `core-mariadb`
   - **From external**: Your HA IP address

### Connection Details Summary

```
Database Name: manhattan_app_usage
Host: localhost (or core-mariadb for HA SQL sensors)
Port: 3306
Username: dashboard_user
Password: [the password you set in the SQL script]
```

## Step 5: Test Connection

### From Home Assistant (Python Script)

The Python script will need to connect. Test if `pymysql` is available:

```python
# Test in HA Python script
try:
    import pymysql
    logger.info("pymysql is available")
except ImportError:
    logger.error("pymysql not available - need alternative approach")
```

### From Node.js (Vercel Serverless Function)

Test connection in a serverless function:

```javascript
const mysql = require('mysql2/promise');

const connection = await mysql.createConnection({
  host: process.env.MARIADB_HOST,
  port: process.env.MARIADB_PORT || 3306,
  user: process.env.MARIADB_USER,
  password: process.env.MARIADB_PASSWORD,
  database: process.env.MARIADB_DATABASE
});
```

## Step 6: Configure Environment Variables

### For Vercel (Dashboard Serverless Function)

Add these environment variables in Vercel:

```
MARIADB_HOST=your-ha-ip-or-domain
MARIADB_PORT=3306
MARIADB_USER=dashboard_user
MARIADB_PASSWORD=your_secure_password
MARIADB_DATABASE=manhattan_app_usage
```

**Security Note**: 
- If MariaDB is only accessible from your local network, you may need to:
  - Use SSH tunnel
  - Or expose MariaDB port (less secure)
  - Or query via HA API instead of direct connection

### For Home Assistant (Python Script)

If Python script can access MariaDB, you'll need to store credentials securely. Options:
- Use `secrets.yaml` in HA
- Or hardcode (not recommended for production)

## Step 7: Network Configuration

### If Querying from Vercel (External)

MariaDB add-on by default only accepts local connections. To allow external access:

1. **Option A: SSH Tunnel** (Recommended)
   - Set up SSH tunnel from Vercel to HA
   - Connect through tunnel

2. **Option B: Expose Port** (Less Secure)
   - In MariaDB add-on config, enable external access
   - Configure firewall rules
   - Use strong password and consider IP whitelist

3. **Option C: Query via HA API** (Safest)
   - Create HA sensors that query MariaDB
   - Dashboard queries HA API (as it does now)
   - No direct MariaDB connection needed

## Troubleshooting

### Connection Refused

- Check MariaDB add-on is running
- Verify port is correct (usually 3306)
- Check firewall rules

### Authentication Failed

- Verify username and password
- Check user permissions: `SHOW GRANTS FOR 'dashboard_user'@'%';`
- Try connecting as root first to verify setup

### Table Not Found

- Verify database name: `SHOW DATABASES;`
- Check you're using the correct database: `USE manhattan_app_usage;`
- Verify table exists: `SHOW TABLES;`

### Python Script Can't Connect

- Check if `pymysql` is available (may not be in HA Python scripts)
- Consider alternative: Write to SQLite staging table, sync to MariaDB
- Or use HA REST API to trigger a service that writes to MariaDB

## Next Steps

After setup is complete:

1. ✅ Database created and verified
2. ✅ User created with permissions
3. ✅ Table structure in place
4. ⏭️ Modify Python script to write to MariaDB (next step)
5. ⏭️ Create serverless function to query MariaDB (next step)
6. ⏭️ Update dashboard to support MariaDB queries (next step)

## Security Best Practices

1. **Use Strong Passwords**: Don't use default or weak passwords
2. **Limit Access**: Only grant necessary permissions
3. **Network Security**: Don't expose MariaDB to internet unless necessary
4. **Regular Backups**: Set up automated backups of the database
5. **Monitor Access**: Review connection logs regularly

## Backup and Restore

### Backup Database

```bash
mysqldump -u dashboard_user -p manhattan_app_usage > backup.sql
```

### Restore Database

```bash
mysql -u dashboard_user -p manhattan_app_usage < backup.sql
```

## Support

If you encounter issues:
1. Check MariaDB add-on logs in Home Assistant
2. Verify connection details are correct
3. Test connection from command line first
4. Review error messages for specific issues

