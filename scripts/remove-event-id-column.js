/**
 * Script to remove event_id column from Neon database
 * We're using 'id' (primary key) instead
 * 
 * Usage: node scripts/remove-event-id-column.js
 */

import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get Neon connection string from environment
const connectionString = process.env.NEON_DATABASE_URL;

if (!connectionString) {
  console.error('❌ NEON_DATABASE_URL environment variable is not set');
  console.error('   Set it in your .env file or export it:');
  console.error('   export NEON_DATABASE_URL="postgresql://user:pass@host/db"');
  process.exit(1);
}

async function removeEventIdColumn() {
  const pool = new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });

  let client = null;

  try {
    client = await pool.connect();
    console.log('✅ Connected to Neon database\n');

    // Check if column exists
    console.log('📊 Checking if event_id column exists...');
    const checkResult = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'app_usage_events' AND column_name = 'event_id'
    `);

    if (checkResult.rows.length === 0) {
      console.log('   ✅ event_id column does not exist (already removed)\n');
      return;
    }

    console.log('   Found event_id column\n');

    // Drop index first
    console.log('🗑️  Dropping idx_event_id index...');
    await client.query('DROP INDEX IF EXISTS idx_event_id');
    console.log('   ✅ Index dropped\n');

    // Remove column
    console.log('🗑️  Removing event_id column...');
    await client.query('ALTER TABLE app_usage_events DROP COLUMN IF EXISTS event_id');
    console.log('   ✅ Column removed\n');

    // Verify removal
    console.log('✅ Verifying removal...');
    const verifyResult = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'app_usage_events' 
      ORDER BY ordinal_position
    `);

    console.log('   Current columns:');
    verifyResult.rows.forEach(row => {
      console.log(`      - ${row.column_name} (${row.data_type})`);
    });

    console.log('\n✅ event_id column removal completed!');

  } catch (error) {
    console.error('❌ Error removing event_id column:', error);
    throw error;
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

// Run the removal
removeEventIdColumn()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Failed:', error);
    process.exit(1);
  });
