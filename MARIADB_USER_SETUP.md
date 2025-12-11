# MariaDB User Setup for Dashboard

This guide shows how to create a read-only MariaDB user for the dashboard to connect via Cloudflare Tunnel.

## Prerequisites

- MariaDB add-on installed and running in Home Assistant
- Access to MariaDB root user (or admin user)
- HA Terminal or SSH access

## Step 1: Connect to MariaDB

### Option A: From HA Terminal

1. Go to **Settings** → **Add-ons** → **Terminal & SSH** (or use Advanced Terminal)
2. Connect to MariaDB:

```bash
mariadb -h core-mariadb --ssl=0 -u root -p
```

Enter your MariaDB root password when prompted.

### Option B: From SSH

If you have SSH access to your HA instance:

```bash
ssh homeassistant@your-ha-ip
mariadb -h core-mariadb --ssl=0 -u root -p
```

## Step 2: Create Read-Only User

### 2.1 Create User

```sql
-- Create read-only user for dashboard
CREATE USER IF NOT EXISTS 'dashboard_reader'@'%' IDENTIFIED BY 'YOUR_SECURE_PASSWORD_HERE';
```

**Important:**
- Replace `YOUR_SECURE_PASSWORD_HERE` with a strong, unique password
- Save this password - you'll need it for Vercel environment variables
- The `'%'` allows connection from any host (needed for Cloudflare Tunnel)

**Example:**
```sql
CREATE USER IF NOT EXISTS 'dashboard_reader'@'%' IDENTIFIED BY 'MySecureP@ssw0rd123!';
```

### 2.2 Grant SELECT Permissions

```sql
-- Grant SELECT (read-only) permissions on manhattan_app_usage database
GRANT SELECT ON manhattan_app_usage.* TO 'dashboard_reader'@'%';
```

This grants:
- **SELECT**: Can read data from all tables
- **No INSERT/UPDATE/DELETE**: Cannot modify data
- **No CREATE/DROP**: Cannot modify schema

### 2.3 Apply Changes

```sql
-- Apply the permission changes
FLUSH PRIVILEGES;
```

## Step 3: Verify User Setup

### 3.1 Check User Exists

```sql
-- List all users (verify dashboard_reader exists)
SELECT User, Host FROM mysql.user WHERE User = 'dashboard_reader';
```

**Expected output:**
```
+------------------+------+
| User             | Host |
+------------------+------+
| dashboard_reader | %    |
+------------------+------+
```

### 3.2 Check Permissions

```sql
-- Show grants for dashboard_reader user
SHOW GRANTS FOR 'dashboard_reader'@'%';
```

**Expected output:**
```
+------------------------------------------------------------------------------------------------+
| Grants for dashboard_reader@%                                                                |
+------------------------------------------------------------------------------------------------+
| GRANT USAGE ON *.* TO `dashboard_reader`@`%`                                                 |
| GRANT SELECT ON `manhattan_app_usage`.* TO `dashboard_reader`@`%`                            |
+------------------------------------------------------------------------------------------------+
```

### 3.3 Test SELECT Permissions

```sql
-- Switch to manhattan_app_usage database
USE manhattan_app_usage;

-- Test SELECT (should work)
SELECT COUNT(*) AS total_events FROM app_usage_events;

-- Test SELECT with WHERE (should work)
SELECT app_name, COUNT(*) AS count 
FROM app_usage_events 
GROUP BY app_name 
LIMIT 5;
```

Both queries should execute successfully.

### 3.4 Test Write Permissions (Should Fail)

```sql
-- Test INSERT (should fail - read-only user)
INSERT INTO app_usage_events (event_name, app_name, timestamp, event_data) 
VALUES ('test', 'test', NOW(), '{}');
```

**Expected error:**
```
ERROR 1142 (42000): INSERT command denied to user 'dashboard_reader'@'%' for table 'app_usage_events'
```

This confirms the user is read-only (which is correct).

## Step 4: Test Connection from External Tool (Optional)

### 4.1 Test from Local Machine

Once Cloudflare Tunnel is set up, test the connection:

```bash
mysql -h mariadb.sidmsmith.zapto.org -P 3306 -u dashboard_reader -p
```

Enter the password you created.

**Expected:**
```
Welcome to the MariaDB monitor. Commands end with ; or \g.
...
MariaDB [(none)]>
```

### 4.2 Test Database Access

```sql
-- Switch to database
USE manhattan_app_usage;

-- Query data
SELECT COUNT(*) FROM app_usage_events;
```

Should return the count of events.

## Step 5: Add to Vercel Environment Variables

1. Go to Vercel project → **Settings** → **Environment Variables**
2. Add:
   - `MARIADB_USER` = `dashboard_reader`
   - `MARIADB_PASSWORD` = `YOUR_SECURE_PASSWORD_HERE` (the password you created)

## Security Best Practices

### Password Requirements

- **Minimum 16 characters**
- **Mix of uppercase, lowercase, numbers, special characters**
- **Unique password** (not used elsewhere)
- **Store securely** (password manager)

### Example Strong Password

```
D@shb0ard_R3@d0nly_2024!
```

### Additional Security (Optional)

If you want to restrict access further:

```sql
-- Restrict to specific host (if you know Vercel's IP ranges)
-- Note: Cloudflare Tunnel uses dynamic IPs, so '%' is usually needed
CREATE USER 'dashboard_reader'@'specific-ip' IDENTIFIED BY 'password';
GRANT SELECT ON manhattan_app_usage.* TO 'dashboard_reader'@'specific-ip';
```

**However**, with Cloudflare Tunnel, `'%'` is recommended since the tunnel endpoint IPs can change.

## Troubleshooting

### User Already Exists

If you get "User already exists" error:

```sql
-- Drop existing user first
DROP USER IF EXISTS 'dashboard_reader'@'%';

-- Then create again
CREATE USER 'dashboard_reader'@'%' IDENTIFIED BY 'password';
GRANT SELECT ON manhattan_app_usage.* TO 'dashboard_reader'@'%';
FLUSH PRIVILEGES;
```

### Permission Denied

If queries fail with "Access denied":

1. Verify user exists: `SELECT User, Host FROM mysql.user WHERE User = 'dashboard_reader';`
2. Verify grants: `SHOW GRANTS FOR 'dashboard_reader'@'%';`
3. Ensure `FLUSH PRIVILEGES;` was run
4. Check database name is correct: `manhattan_app_usage`

### Connection Refused

If you can't connect:

1. Verify MariaDB add-on is running
2. Check hostname: `core-mariadb` (for internal HA connections)
3. For external connections: Use Cloudflare Tunnel endpoint
4. Verify port: `3306`

## Summary

You've created:
- ✅ Read-only user: `dashboard_reader`
- ✅ SELECT permissions on `manhattan_app_usage` database
- ✅ No write/modify permissions (secure)

**Next Steps:**
1. Set up Cloudflare Tunnel (see `CLOUDFLARE_TUNNEL_SETUP.md`)
2. Add credentials to Vercel environment variables
3. Test connection from Vercel serverless function
