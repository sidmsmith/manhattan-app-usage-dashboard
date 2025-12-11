// Vercel serverless function to fetch data directly from MariaDB via Cloudflare Tunnel
// This connects directly to MariaDB without AppDaemon, providing full SQL query capabilities

import mysql from 'mysql2/promise';

// Create connection pool (reuses connections for better performance)
let pool = null;

function getPool() {
  if (!pool) {
    const config = {
      host: process.env.MARIADB_HOST,
      port: parseInt(process.env.MARIADB_PORT || '3306'),
      user: process.env.MARIADB_USER,
      password: process.env.MARIADB_PASSWORD,
      database: process.env.MARIADB_DATABASE || 'manhattan_app_usage',
      ssl: {
        rejectUnauthorized: false  // Required for Cloudflare Tunnel
      },
      // Connection pool settings
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0
    };

    // Add Cloudflare Access headers if configured
    if (process.env.CF_ACCESS_CLIENT_ID && process.env.CF_ACCESS_CLIENT_SECRET) {
      // Note: mysql2 doesn't support custom headers directly
      // Cloudflare Access will be handled at the tunnel level via service token
      // The tunnel itself authenticates using the service token
    }

    pool = mysql.createPool(config);
  }
  return pool;
}

export default async function (req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query, app_name, limit, id } = req.query;

  if (!query) {
    return res.status(400).json({ 
      error: 'query parameter is required. Options: recent-events, statistics, event-details, health' 
    });
  }

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS (CORS preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const dbPool = getPool();
  let connection = null;

  try {
    connection = await dbPool.getConnection();

    let result;

    switch (query) {
      case 'recent-events':
        result = await queryRecentEvents(connection, app_name, parseInt(limit || '15'));
        break;

      case 'statistics':
        result = await queryStatistics(connection, app_name);
        break;

      case 'event-details':
        if (!id) {
          return res.status(400).json({ error: 'id parameter required for event-details query' });
        }
        result = await queryEventDetails(connection, parseInt(id));
        break;

      case 'health':
        result = await queryHealth(connection);
        break;

      default:
        return res.status(400).json({ 
          error: `Unknown query type: ${query}. Options: recent-events, statistics, event-details, health` 
        });
    }

    return res.status(200).json(result);

  } catch (error) {
    console.error('[fetch-mariadb] Database error:', error.message);
    
    return res.status(500).json({ 
      error: 'Database query failed',
      message: error.message,
      query: query
    });
  } finally {
    if (connection) {
      connection.release(); // Return connection to pool
    }
  }
}

// Query recent events, optionally filtered by app_name
async function queryRecentEvents(connection, app_name, limit) {
  let query, params;

  if (app_name) {
    query = `
      SELECT 
        id,
        app_name,
        event_name,
        org,
        timestamp,
        event_data,
        created_at
      FROM app_usage_events
      WHERE app_name = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `;
    params = [app_name, limit];
  } else {
    query = `
      SELECT 
        id,
        app_name,
        event_name,
        org,
        timestamp,
        event_data,
        created_at
      FROM app_usage_events
      ORDER BY timestamp DESC
      LIMIT ?
    `;
    params = [limit];
  }

  const [rows] = await connection.execute(query, params);

  // Parse JSON event_data if stored as string
  const events = rows.map(row => {
    const event = { ...row };
    if (typeof event.event_data === 'string') {
      try {
        event.event_data = JSON.parse(event.event_data);
      } catch (e) {
        // Keep as string if parsing fails
      }
    }
    return event;
  });

  return {
    events: events,
    count: events.length
  };
}

// Query statistics (total events, events last 24h, total opens)
async function queryStatistics(connection, app_name) {
  let query, params;

  if (app_name) {
    query = `
      SELECT 
        app_name,
        COUNT(*) AS total_events,
        COUNT(CASE WHEN timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 END) AS events_last_24h,
        COUNT(CASE WHEN JSON_EXTRACT(event_data, '$.event_name') = 'app_opened' THEN 1 END) AS total_opens
      FROM app_usage_events
      WHERE app_name = ?
      GROUP BY app_name
    `;
    params = [app_name];
  } else {
    query = `
      SELECT 
        'all_apps' AS app_name,
        COUNT(*) AS total_events,
        COUNT(CASE WHEN timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 END) AS events_last_24h,
        COUNT(CASE WHEN JSON_EXTRACT(event_data, '$.event_name') = 'app_opened' THEN 1 END) AS total_opens
      FROM app_usage_events
    `;
    params = [];
  }

  const [rows] = await connection.execute(query, params);
  const result = rows[0] || {
    app_name: app_name || 'all_apps',
    total_events: 0,
    events_last_24h: 0,
    total_opens: 0
  };

  return result;
}

// Query full event details by ID
async function queryEventDetails(connection, event_id) {
  const query = `
    SELECT 
      id,
      event_id,
      app_name,
      event_name,
      org,
      timestamp,
      event_data,
      created_at,
      updated_at
    FROM app_usage_events
    WHERE id = ?
  `;

  const [rows] = await connection.execute(query, [event_id]);

  if (rows.length === 0) {
    return { error: 'Event not found' };
  }

  const event = { ...rows[0] };

  // Parse JSON event_data if stored as string
  if (typeof event.event_data === 'string') {
    try {
      event.event_data = JSON.parse(event.event_data);
    } catch (e) {
      // Keep as string if parsing fails
    }
  }

  return event;
}

// Health check - test database connection
async function queryHealth(connection) {
  try {
    const [rows] = await connection.execute('SELECT 1 AS health, NOW() AS server_time, DATABASE() AS database_name');
    return {
      status: 'ok',
      service: 'mariadb-direct-connection',
      database: rows[0].database_name,
      server_time: rows[0].server_time
    };
  } catch (error) {
    return {
      status: 'error',
      service: 'mariadb-direct-connection',
      error: error.message
    };
  }
}
