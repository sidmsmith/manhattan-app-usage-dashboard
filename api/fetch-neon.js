// Vercel serverless function to fetch data directly from Neon PostgreSQL
// This connects directly to Neon PostgreSQL, providing full SQL query capabilities

import pg from 'pg';
const { Pool } = pg;

// Create connection pool (reuses connections for better performance)
let pool = null;

function getPool() {
  if (!pool) {
    // Neon connection string format:
    // postgresql://user:password@host:port/database?sslmode=require
    // Or use individual connection parameters
    
    const connectionString = process.env.NEON_DATABASE_URL;
    
    if (!connectionString) {
      throw new Error('NEON_DATABASE_URL environment variable is required');
    }

    const config = {
      connectionString: connectionString,
      ssl: {
        rejectUnauthorized: false  // Required for Neon SSL connections
      },
      // Connection pool settings
      max: 10,  // Maximum number of clients in the pool
      idleTimeoutMillis: 30000,  // Close idle clients after 30 seconds
      connectionTimeoutMillis: 10000,  // Return an error after 10 seconds if connection could not be established
    };

    pool = new Pool(config);
    
    // Handle pool errors
    pool.on('error', (err) => {
      console.error('[fetch-neon] Unexpected error on idle client', err);
    });
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
  let client = null;

  try {
    client = await dbPool.connect();

    let result;

    switch (query) {
      case 'recent-events':
        result = await queryRecentEvents(client, app_name, parseInt(limit || '15'));
        break;

      case 'statistics':
        result = await queryStatistics(client, app_name);
        break;

      case 'event-details':
        if (!id) {
          return res.status(400).json({ error: 'id parameter required for event-details query' });
        }
        result = await queryEventDetails(client, parseInt(id));
        break;

      case 'event-navigation':
        // Get previous/next event IDs for navigation
        // Requires: id (current event), app_name (optional, for app-specific navigation), direction ('prev' or 'next')
        const { app_name: nav_app_name, direction } = req.query;
        if (!id || !direction) {
          return res.status(400).json({ error: 'id and direction parameters required for event-navigation query' });
        }
        result = await queryEventNavigation(client, parseInt(id), nav_app_name, direction);
        break;

      case 'health':
        result = await queryHealth(client);
        break;

      default:
        return res.status(400).json({ 
          error: `Unknown query type: ${query}. Options: recent-events, statistics, event-details, health` 
        });
    }

    return res.status(200).json(result);

  } catch (error) {
    console.error('[fetch-neon] Database error:', error.message);
    
    return res.status(500).json({ 
      error: 'Database query failed',
      message: error.message,
      query: query
    });
  } finally {
    if (client) {
      client.release(); // Return client to pool
    }
  }
}

// Query recent events, optionally filtered by app_name
async function queryRecentEvents(client, app_name, limit) {
  let queryText, params;

  if (app_name) {
    queryText = `
      SELECT 
        id,
        app_name,
        event_name,
        org,
        timestamp,
        event_data,
        created_at
      FROM app_usage_events
      WHERE app_name = $1
      ORDER BY timestamp DESC
      LIMIT $2
    `;
    params = [app_name, limit];
  } else {
    queryText = `
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
      LIMIT $1
    `;
    params = [limit];
  }

  const result = await client.query(queryText, params);
  const rows = result.rows;

  // Parse JSON event_data if stored as string (PostgreSQL JSONB is usually already parsed)
  const events = rows.map(row => {
    const event = { ...row };
    if (typeof event.event_data === 'string') {
      try {
        event.event_data = JSON.parse(event.event_data);
      } catch (e) {
        // Keep as string if parsing fails
      }
    }
    // PostgreSQL JSONB is already an object, no parsing needed
    return event;
  });

  return {
    events: events,
    count: events.length
  };
}

// Query statistics (total events, events last 24h, total opens)
async function queryStatistics(client, app_name) {
  let queryText, params;

  if (app_name) {
    // PostgreSQL syntax: use -> for JSONB access, ->> for text extraction
    queryText = `
      SELECT 
        app_name,
        COUNT(*) AS total_events,
        COUNT(CASE WHEN timestamp >= NOW() - INTERVAL '24 hours' THEN 1 END) AS events_last_24h,
        COUNT(CASE WHEN event_data->>'event_name' = 'app_opened' THEN 1 END) AS total_opens
      FROM app_usage_events
      WHERE app_name = $1
      GROUP BY app_name
    `;
    params = [app_name];
  } else {
    queryText = `
      SELECT 
        'all_apps' AS app_name,
        COUNT(*) AS total_events,
        COUNT(CASE WHEN timestamp >= NOW() - INTERVAL '24 hours' THEN 1 END) AS events_last_24h,
        COUNT(CASE WHEN event_name = 'app_opened' THEN 1 END) AS total_opens
      FROM app_usage_events
    `;
    params = [];
  }

  const result = await client.query(queryText, params);
  const row = result.rows[0] || {
    app_name: app_name || 'all_apps',
    total_events: 0,
    events_last_24h: 0,
    total_opens: 0
  };

  return row;
}

// Query full event details by ID
async function queryEventDetails(client, id) {
  const queryText = `
    SELECT 
      id,
      app_name,
      event_name,
      org,
      timestamp,
      event_data,
      created_at,
      updated_at
    FROM app_usage_events
    WHERE id = $1
  `;

  const result = await client.query(queryText, [id]);

  if (result.rows.length === 0) {
    return { error: 'Event not found' };
  }

  const event = { ...result.rows[0] };

  // Parse JSON event_data if stored as string (PostgreSQL JSONB is usually already parsed)
  if (typeof event.event_data === 'string') {
    try {
      event.event_data = JSON.parse(event.event_data);
    } catch (e) {
      // Keep as string if parsing fails
    }
  }

  return event;
}

// Query event navigation (previous/next event ID)
async function queryEventNavigation(client, current_id, app_name, direction) {
  let queryText, params;
  
  if (app_name) {
    // App-specific navigation: find prev/next event for the same app
    if (direction === 'next') {
      queryText = `
        SELECT id
        FROM app_usage_events
        WHERE app_name = $1 AND id > $2
        ORDER BY id ASC
        LIMIT 1
      `;
      params = [app_name, current_id];
    } else { // prev
      queryText = `
        SELECT id
        FROM app_usage_events
        WHERE app_name = $1 AND id < $2
        ORDER BY id DESC
        LIMIT 1
      `;
      params = [app_name, current_id];
    }
  } else {
    // All events navigation: find prev/next event across all apps
    if (direction === 'next') {
      queryText = `
        SELECT id
        FROM app_usage_events
        WHERE id > $1
        ORDER BY id ASC
        LIMIT 1
      `;
      params = [current_id];
    } else { // prev
      queryText = `
        SELECT id
        FROM app_usage_events
        WHERE id < $1
        ORDER BY id DESC
        LIMIT 1
      `;
      params = [current_id];
    }
  }
  
  const result = await client.query(queryText, params);
  
  if (result.rows.length === 0) {
    return { id: null }; // No next/prev event
  }
  
  return { id: result.rows[0].id };
}

// Health check - test database connection
async function queryHealth(client) {
  try {
    const result = await client.query('SELECT 1 AS health, NOW() AS server_time, current_database() AS database_name');
    return {
      status: 'ok',
      service: 'neon-postgresql-connection',
      database: result.rows[0].database_name,
      server_time: result.rows[0].server_time
    };
  } catch (error) {
    return {
      status: 'error',
      service: 'neon-postgresql-connection',
      error: error.message
    };
  }
}

