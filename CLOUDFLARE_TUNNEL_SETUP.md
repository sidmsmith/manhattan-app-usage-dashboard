# Cloudflare Tunnel Setup Guide - Direct MariaDB Connection

This guide walks you through setting up a Cloudflare Tunnel to securely expose your MariaDB instance for direct connection from Vercel, bypassing AppDaemon REST endpoints.

## Prerequisites

- Home Assistant instance running (with MariaDB add-on installed)
- NOIP DDNS setup working (`sidmsmith.zapto.org:8123`)
- Access to Home Assistant Supervisor (for add-on installation)
- 30-45 minutes for setup

## Step 1: Create Cloudflare Account (Free)

### 1.1 Sign Up for Cloudflare

1. Go to **https://dash.cloudflare.com/sign-up**
2. Enter your email address and create a password
3. Verify your email address (check inbox)
4. Complete the sign-up process

**Note:** Cloudflare's free tier includes:
- Unlimited tunnels
- Zero Trust features (for securing access)
- No credit card required

### 1.2 Add Your Domain to Cloudflare (Optional but Recommended)

**Option A: Use Your Existing NOIP Domain (Recommended)**

If you want to use `mariadb.sidmsmith.zapto.org`, you'll need to:
- Add `sidmsmith.zapto.org` as a domain in Cloudflare (if NOIP allows DNS management)
- OR use a Cloudflare-managed subdomain (see Option B)

**Option B: Use Cloudflare's Free Subdomain**

Cloudflare can provide a free subdomain like `yourname.trycloudflare.com` for testing.

**For this guide, we'll assume you're using your NOIP domain or a Cloudflare-managed domain.**

## Step 2: Set Up Cloudflare Zero Trust (Free)

### 2.1 Enable Zero Trust

1. Log into Cloudflare Dashboard: **https://dash.cloudflare.com**
2. In the left sidebar, click **Zero Trust** (or go to **https://one.dash.cloudflare.com**)
3. If prompted, click **Get Started** or **Upgrade** (it's free)
4. Complete the Zero Trust setup wizard (choose free plan)

### 2.2 Verify Zero Trust Access

You should now see the Zero Trust dashboard with:
- **Networks** (for tunnels)
- **Access** (for authentication policies)
- **Gateway** (for filtering)

## Step 3: Create Cloudflare Tunnel

### 3.1 Create Tunnel in Cloudflare Dashboard

1. In Zero Trust dashboard, go to **Networks** → **Tunnels**
2. Click **Create a tunnel**
3. Select **Cloudflared** as the connector type
4. Name your tunnel: `ha-mariadb` (or any name you prefer)
5. Click **Save tunnel**

### 3.2 Copy Tunnel Token

After creating the tunnel, you'll see a page with:
- **Tunnel ID** (e.g., `abc123...`)
- **Tunnel Token** (long string starting with `eyJ...`)

**IMPORTANT:** Copy the **Tunnel Token** - you'll need it in the next step.

**Example token format:**
```
eyJhIjoiYWJjMTIzNDU2Nzg5MCIsInQiOiJkZWZhdWx0IiwicyI6InNlY3JldCJ9
```

Keep this page open or save the token securely.

## Step 4: Install Cloudflared Add-on in Home Assistant

### 4.1 Enable Community Add-ons Repository

1. In Home Assistant, go to **Settings** → **Add-ons** → **Add-on Store**
2. Click the three dots (⋮) in the top right
3. Select **Repositories**
4. If you don't see the Community Add-ons repository, click **Add** and enter:
   ```
   https://github.com/hassio-addons/repository
   ```
5. Click **Add** and wait for it to load

### 4.2 Install Cloudflared Add-on

1. In the Add-on Store, search for **"Cloudflared"**
2. Find **"Cloudflared"** by **brenner-tobias** (official one)
3. Click on it
4. Click **Install**
5. Wait for installation to complete (1-2 minutes)

### 4.3 Configure Cloudflared Add-on

1. After installation, click **Configuration** tab
2. You'll see a configuration editor with YAML format
3. Replace the content with:

```yaml
tunnel: ""  # Leave empty - we'll use token instead
token: "YOUR_TUNNEL_TOKEN_HERE"  # Paste the token from Step 3.2
```

**Replace `YOUR_TUNNEL_TOKEN_HERE` with the actual token you copied.**

4. Click **Save**

### 4.4 Configure Ingress Rules (Public Hostname)

Still in the **Configuration** tab, scroll down or look for **Ingress** section. Add this configuration:

```yaml
tunnel: ""
token: "YOUR_TUNNEL_TOKEN_HERE"
ingress:
  - hostname: mariadb.sidmsmith.zapto.org
    service: tcp://localhost:3306
  - service: http_status:404
```

**Important Notes:**
- Replace `mariadb.sidmsmith.zapto.org` with your desired subdomain
- If using a Cloudflare-managed domain, use that instead
- The `tcp://localhost:3306` points to MariaDB inside HA
- The `http_status:404` is a catch-all for unmatched requests

**Alternative if using Cloudflare subdomain:**
```yaml
ingress:
  - hostname: mariadb.yourname.trycloudflare.com
    service: tcp://localhost:3306
  - service: http_status:404
```

5. Click **Save** again

### 4.5 Start Cloudflared Add-on

1. Go to the **Info** tab
2. Toggle **Start on boot** to ON (recommended)
3. Click **Start**
4. Wait 10-15 seconds for it to start

### 4.6 Verify Tunnel is Running

1. Go to **Logs** tab
2. You should see messages like:
   ```
   Cloudflared started
   +--------------------------------------------------------------------------------------------+
   |  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable): |
   |  https://mariadb.sidmsmith.zapto.org                                                      |
   +--------------------------------------------------------------------------------------------+
   ```

3. In Cloudflare Dashboard (Zero Trust → Networks → Tunnels), you should see:
   - Tunnel status: **Healthy** (green)
   - Connector: **Connected** (showing your HA instance)

**If you see errors:**
- Check that the token is correct (no extra spaces)
- Verify MariaDB add-on is running
- Check Cloudflared logs for specific error messages

## Step 5: Configure DNS (If Using Custom Domain)

### 5.1 If Using NOIP Domain

If you're using `mariadb.sidmsmith.zapto.org`:

1. **Option A: NOIP DNS Management** (if available)
   - Log into NOIP dashboard
   - Add a CNAME record: `mariadb` → point to your Cloudflare tunnel endpoint
   - OR add an A record pointing to Cloudflare's IP

2. **Option B: Cloudflare DNS** (if you added your domain to Cloudflare)
   - In Cloudflare Dashboard → **DNS** → **Records**
   - Add a CNAME record:
     - Name: `mariadb`
     - Target: `your-tunnel-id.cfargotunnel.com` (found in tunnel settings)
     - Proxy status: **DNS only** (gray cloud, not orange)

### 5.2 If Using Cloudflare Subdomain

If using `mariadb.yourname.trycloudflare.com`, DNS is handled automatically - no configuration needed.

## Step 6: Test Tunnel Connection

### 6.1 Test from HA Terminal

1. In Home Assistant, go to **Settings** → **Add-ons** → **Terminal & SSH** (or use Advanced Terminal)
2. Test the tunnel endpoint:

```bash
# Test TCP connection (should connect)
nc -zv mariadb.sidmsmith.zapto.org 3306
```

**Expected output:**
```
Connection to mariadb.sidmsmith.zapto.org 3306 port [tcp/mysql] succeeded!
```

### 6.2 Test from External Tool (Optional)

You can test from your local machine using MySQL client:

```bash
mysql -h mariadb.sidmsmith.zapto.org -P 3306 -u homeassistant -p
```

Enter your MariaDB password when prompted.

**Note:** This may fail if Cloudflare Access is enabled (see Step 7). That's expected - we'll configure access next.

## Step 7: Secure Tunnel with Cloudflare Access (Recommended)

### 7.1 Create Service Token (For Vercel)

1. In Cloudflare Zero Trust dashboard, go to **Access** → **Service Tokens**
2. Click **Create Service Token**
3. Name it: `vercel-dashboard-reader`
4. Click **Create Token**
5. **IMPORTANT:** Copy both:
   - **Client ID** (starts with long string)
   - **Client Secret** (starts with long string)
   
   **Save these securely - you'll need them for Vercel environment variables!**

### 7.2 Create Access Application

1. In Zero Trust dashboard, go to **Access** → **Applications**
2. Click **Add an application**
3. Select **Self-hosted**
4. Configure:
   - **Application name**: `MariaDB Access`
   - **Session duration**: `24 hours` (or your preference)
   - **Application domain**: `mariadb.sidmsmith.zapto.org`
   - **Path**: Leave empty (applies to all paths)
5. Click **Next**

### 7.3 Configure Access Policy

1. In **Policies**, click **Add a policy**
2. Name: `Allow Vercel Service Token`
3. **Action**: Allow
4. **Include**:
   - Select **Service Token**
   - Choose the token you created: `vercel-dashboard-reader`
5. Click **Next**
6. Click **Add application**

### 7.4 Test Access

The tunnel is now protected. Only requests with the service token will be allowed.

## Step 8: Create MariaDB Read-Only User

### 8.1 Connect to MariaDB

From HA Terminal:

```bash
mariadb -h core-mariadb --ssl=0 -u root -p
```

Enter your MariaDB root password.

### 8.2 Create Dashboard User

```sql
-- Create read-only user for dashboard
CREATE USER IF NOT EXISTS 'dashboard_reader'@'%' IDENTIFIED BY 'YOUR_SECURE_PASSWORD_HERE';

-- Grant SELECT permissions on manhattan_app_usage database
GRANT SELECT ON manhattan_app_usage.* TO 'dashboard_reader'@'%';

-- Apply changes
FLUSH PRIVILEGES;

-- Verify user was created
SELECT User, Host FROM mysql.user WHERE User = 'dashboard_reader';

-- Test permissions (should show tables)
USE manhattan_app_usage;
SHOW TABLES;
```

**Important:**
- Replace `YOUR_SECURE_PASSWORD_HERE` with a strong password
- Save this password - you'll need it for Vercel environment variables
- The `'%'` allows connection from any host (tunnel endpoint)

### 8.3 Test User Permissions

```sql
-- Switch to dashboard_reader user (from root session)
-- Or create a new connection:
-- mariadb -h core-mariadb -u dashboard_reader -p

-- Test SELECT (should work)
SELECT COUNT(*) FROM app_usage_events;

-- Test INSERT (should fail - read-only)
INSERT INTO app_usage_events (event_name, app_name, timestamp, event_data) 
VALUES ('test', 'test', NOW(), '{}');
-- Expected: ERROR 1142 (42000): INSERT command denied
```

## Step 9: Configure Vercel Environment Variables

### 9.1 Add Environment Variables

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add the following variables:

| Name | Value | Environment |
|------|-------|-------------|
| `MARIADB_HOST` | `mariadb.sidmsmith.zapto.org` | Production, Preview, Development |
| `MARIADB_PORT` | `3306` | Production, Preview, Development |
| `MARIADB_USER` | `dashboard_reader` | Production, Preview, Development |
| `MARIADB_PASSWORD` | `YOUR_DASHBOARD_READER_PASSWORD` | Production, Preview, Development |
| `MARIADB_DATABASE` | `manhattan_app_usage` | Production, Preview, Development |
| `CF_ACCESS_CLIENT_ID` | `YOUR_CLIENT_ID_FROM_STEP_7.1` | Production, Preview, Development |
| `CF_ACCESS_CLIENT_SECRET` | `YOUR_CLIENT_SECRET_FROM_STEP_7.1` | Production, Preview, Development |

**Important:**
- Replace all `YOUR_*` placeholders with actual values
- `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET` are only needed if you enabled Cloudflare Access (Step 7)

### 9.2 Save and Redeploy

After adding variables:
1. Click **Save**
2. Go to **Deployments** tab
3. Click **Redeploy** on the latest deployment (or push a new commit)

## Step 10: Verify Everything Works

### 10.1 Check Tunnel Status

1. In Cloudflare Zero Trust → **Networks** → **Tunnels**
2. Verify tunnel shows **Healthy** and **Connected**

### 10.2 Check Cloudflared Logs

In HA → **Add-ons** → **Cloudflared** → **Logs**
- Should show no errors
- Should show connection established

### 10.3 Test from Vercel

After deploying updated code, test the endpoint:
- Visit: `https://your-vercel-app.vercel.app/api/fetch-mariadb?query=health`
- Should return database connection status

## Troubleshooting

### Tunnel Not Connecting

**Symptoms:** Tunnel shows "Disconnected" in Cloudflare dashboard

**Solutions:**
1. Check Cloudflared add-on is running (HA → Add-ons → Cloudflared → Info)
2. Verify token is correct (no extra spaces, complete token)
3. Check Cloudflared logs for errors
4. Restart Cloudflared add-on

### DNS Not Resolving

**Symptoms:** Can't connect to `mariadb.sidmsmith.zapto.org`

**Solutions:**
1. Verify DNS record exists (NOIP or Cloudflare DNS)
2. Wait 5-10 minutes for DNS propagation
3. Test with: `nslookup mariadb.sidmsmith.zapto.org`
4. Try using Cloudflare's free subdomain for testing

### Connection Timeout from Vercel

**Symptoms:** Vercel function times out connecting to MariaDB

**Solutions:**
1. Verify tunnel is healthy in Cloudflare dashboard
2. Test connection from HA terminal: `nc -zv mariadb.sidmsmith.zapto.org 3306`
3. Check Cloudflare Access policies (if enabled)
4. Verify service token is correct in Vercel environment variables
5. Check MariaDB user permissions

### Authentication Errors

**Symptoms:** "Access denied" or "Authentication failed"

**Solutions:**
1. Verify MariaDB user password in Vercel environment variables
2. Test user connection from HA terminal
3. Check user has SELECT permissions: `SHOW GRANTS FOR 'dashboard_reader'@'%';`
4. Verify database name is correct

### Cloudflare Access Blocking Requests

**Symptoms:** Requests fail with 403 or authentication required

**Solutions:**
1. Verify service token is added to Vercel environment variables
2. Check Access policy includes the service token
3. Verify application domain matches tunnel hostname
4. Test with service token headers manually

## Next Steps

Once the tunnel is working:

1. ✅ Update Vercel serverless function to use direct MySQL connection
2. ✅ Remove AppDaemon HTTP API code (keep event logger)
3. ✅ Test dashboard queries MariaDB directly
4. ✅ Monitor Cloudflared logs for any issues

## Security Notes

- **Service Token**: Keep `CF_ACCESS_CLIENT_SECRET` secure - never commit to git
- **MariaDB Password**: Use strong password for `dashboard_reader` user
- **Read-Only User**: Only grants SELECT permissions - cannot modify data
- **Tunnel**: All traffic is encrypted via Cloudflare's network
- **Access Policies**: Can be further restricted by IP, time, etc.

## Support Resources

- **Cloudflare Tunnel Docs**: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/
- **Cloudflared Add-on**: https://github.com/hassio-addons/addon-cloudflared
- **Cloudflare Zero Trust**: https://one.dash.cloudflare.com

---

**Setup Complete!** Your MariaDB is now accessible via secure tunnel at `mariadb.sidmsmith.zapto.org:3306`
