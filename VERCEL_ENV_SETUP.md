# Vercel Environment Variables Setup

## Required Environment Variable

### NEON_DATABASE_URL

**Value to set in Vercel:**

```
postgresql://neondb_owner:npg_HCWtem4D6fcR@ep-small-firefly-aha9kbbm-pooler.c-3.us-east-1.aws.neon.tech:5432/neondb?sslmode=require
```

**How to add in Vercel:**

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Click **Add New**
4. Enter:
   - **Name:** `NEON_DATABASE_URL`
   - **Value:** `postgresql://neondb_owner:npg_HCWtem4D6fcR@ep-small-firefly-aha9kbbm-pooler.c-3.us-east-1.aws.neon.tech:5432/neondb?sslmode=require`
   - **Environment:** Select all (Production, Preview, Development)
5. Click **Save**

**Important Notes:**
- This connection string uses the **pooler endpoint** (recommended for serverless)
- SSL is required (`sslmode=require`)
- The password is included in the connection string (standard PostgreSQL format)
- After adding, you may need to **redeploy** for changes to take effect

## Verification

After setting the environment variable and deploying:

1. **Test Health Endpoint:**
   ```
   https://your-app.vercel.app/api/fetch-neon?query=health
   ```

2. **Expected Response:**
   ```json
   {
     "status": "ok",
     "service": "neon-postgresql-connection",
     "database": "neondb",
     "server_time": "2025-12-11T12:00:00.000Z"
   }
   ```

3. **Test Recent Events:**
   ```
   https://your-app.vercel.app/api/fetch-neon?query=recent-events&limit=5
   ```

## Usage ingest (`POST /api/usage-ingest`)

Manhattan apps (for example `lpn-unlock-app`) can POST a single usage JSON object to this route on the **same** Vercel project as the dashboard. Only this project needs `NEON_DATABASE_URL`.

**URL (example):** `https://<your-dashboard-host>/api/usage-ingest`

### Optional shared secret

1. In this **dashboard** project, add `MANHATTAN_USAGE_INGEST_SECRET` (any long random string).
2. In each **caller** app, set the same value in `MANHATTAN_USAGE_INGEST_SECRET` and set `MANHATTAN_USAGE_INGEST_URL` to the full ingest URL above.

If `MANHATTAN_USAGE_INGEST_SECRET` is **not** set on the dashboard, ingest accepts unauthenticated POSTs (not recommended for production).

Callers must send either `Authorization: Bearer <secret>` or header `X-Usage-Ingest-Secret: <secret>` when the secret is configured.

## Security Reminder

⚠️ **Never commit this connection string to Git!** It contains sensitive credentials.

The connection string is stored securely in Vercel's environment variables and is only accessible to your serverless functions at runtime.







