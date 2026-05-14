// Centralized POST endpoint: Manhattan apps send usage JSON here → Neon app_usage_events.
// Env: NEON_DATABASE_URL (required). Optional: MANHATTAN_USAGE_INGEST_SECRET — if set, require
//   Authorization: Bearer <secret>  (or header X-Usage-Ingest-Secret: <secret>).

import pg from 'pg';

const { Pool } = pg;

let pool = null;

function getPool() {
  if (!pool) {
    const connectionString = process.env.NEON_DATABASE_URL;
    if (!connectionString) {
      throw new Error('NEON_DATABASE_URL environment variable is required');
    }
    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
    pool.on('error', (err) => {
      console.error('[usage-ingest] pool error', err);
    });
  }
  return pool;
}

function checkIngestAuth(req) {
  const secret = process.env.MANHATTAN_USAGE_INGEST_SECRET;
  if (!secret) {
    return true;
  }
  const auth = req.headers.authorization || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const header = req.headers['x-usage-ingest-secret'];
  if (bearer === secret || header === secret) {
    return true;
  }
  return false;
}

function normalizePayload(body) {
  if (!body || typeof body !== 'object') {
    return null;
  }
  const app_name = String(body.app_name ?? 'unknown');
  const event_name = String(body.event_name ?? 'unknown');
  const orgRaw = body.org;
  const org =
    orgRaw === undefined || orgRaw === null
      ? null
      : typeof orgRaw === 'string'
        ? orgRaw
        : String(orgRaw);

  let ts = new Date();
  if (body.timestamp) {
    const parsed = new Date(body.timestamp);
    if (!Number.isNaN(parsed.getTime())) {
      ts = parsed;
    }
  }

  return {
    app_name,
    event_name,
    org,
    tsIso: ts.toISOString(),
    event_data: JSON.stringify(body),
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Usage-Ingest-Secret');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!checkIngestAuth(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
  }

  const row = normalizePayload(body);
  if (!row) {
    return res.status(400).json({ error: 'Expected JSON object body' });
  }

  const client = await getPool().connect();
  try {
    await client.query(
      `INSERT INTO app_usage_events (event_name, app_name, org, "timestamp", event_data)
       VALUES ($1, $2, $3, $4::timestamptz, $5::jsonb)`,
      [row.event_name, row.app_name, row.org, row.tsIso, row.event_data]
    );
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[usage-ingest]', err.message);
    return res.status(500).json({ error: 'Insert failed', message: err.message });
  } finally {
    client.release();
  }
}
