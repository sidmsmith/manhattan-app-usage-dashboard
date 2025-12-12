/**
 * Script to fix timestamps in Neon database
 * Extracts correct timestamp from event_data JSON and updates the timestamp column
 * 
 * Usage: node scripts/fix-neon-timestamps.js
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

async function fixTimestamps() {
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

    // Step 1: Check how many records need fixing
    console.log('📊 Checking records with bad timestamps...');
    const checkResult = await client.query(`
      SELECT 
        COUNT(*) as records_to_fix,
        MIN(timestamp) as min_timestamp,
        MAX(timestamp) as max_timestamp
      FROM app_usage_events
      WHERE timestamp < '1970-01-01'::timestamp
    `);

    const { records_to_fix, min_timestamp, max_timestamp } = checkResult.rows[0];
    console.log(`   Found ${records_to_fix} records with bad timestamps`);
    console.log(`   Min timestamp: ${min_timestamp}`);
    console.log(`   Max timestamp: ${max_timestamp}\n`);

    if (parseInt(records_to_fix) === 0) {
      console.log('✅ No records need fixing!');
      return;
    }

    // Step 2: Preview what will be updated (first 5 records)
    console.log('🔍 Preview of records to be fixed (first 5):');
    const previewResult = await client.query(`
      SELECT 
        id,
        app_name,
        event_name,
        timestamp as current_timestamp,
        event_data->>'timestamp' as json_timestamp,
        CASE 
          WHEN event_data->>'timestamp' IS NOT NULL THEN
            CAST(
              REPLACE(
                REPLACE(event_data->>'timestamp', 'Z', ''),
                'T', ' '
              ) AS TIMESTAMP
            )
          ELSE NULL
        END as new_timestamp
      FROM app_usage_events
      WHERE timestamp < '1970-01-01'::timestamp
        AND event_data->>'timestamp' IS NOT NULL
        AND event_data->>'timestamp' != ''
      LIMIT 5
    `);

    if (previewResult.rows.length === 0) {
      console.log('   ⚠️  No records found with valid timestamp in event_data JSON');
      console.log('   Cannot fix these records automatically.\n');
      return;
    }

    previewResult.rows.forEach((row, idx) => {
      console.log(`   ${idx + 1}. ID ${row.id} (${row.app_name}):`);
      console.log(`      Current: ${row.current_timestamp}`);
      console.log(`      JSON:    ${row.json_timestamp}`);
      console.log(`      New:     ${row.new_timestamp}`);
    });

    console.log('\n');

    // Step 3: Perform the update
    console.log('🔧 Updating timestamps...');
    const updateResult = await client.query(`
      UPDATE app_usage_events
      SET timestamp = CAST(
        REPLACE(
          REPLACE(event_data->>'timestamp', 'Z', ''),
          'T', ' '
        ) AS TIMESTAMP
      )
      WHERE 
        timestamp < '1970-01-01'::timestamp
        AND event_data->>'timestamp' IS NOT NULL
        AND event_data->>'timestamp' != ''
    `);

    console.log(`   ✅ Updated ${updateResult.rowCount} records\n`);

    // Step 4: Verify the fix
    console.log('✅ Verifying fix...');
    const verifyResult = await client.query(`
      SELECT COUNT(*) as remaining_bad_timestamps
      FROM app_usage_events
      WHERE timestamp < '1970-01-01'::timestamp
    `);

    const remaining = parseInt(verifyResult.rows[0].remaining_bad_timestamps);
    if (remaining === 0) {
      console.log('   ✅ All timestamps fixed!\n');
    } else {
      console.log(`   ⚠️  ${remaining} records still have bad timestamps`);
      console.log('   These may not have a valid timestamp in event_data JSON\n');
    }

    // Step 5: Show some fixed records
    console.log('📋 Sample of fixed records:');
    const sampleResult = await client.query(`
      SELECT 
        id,
        app_name,
        event_name,
        timestamp,
        event_data->>'timestamp' as original_json_timestamp
      FROM app_usage_events
      WHERE timestamp >= '1970-01-01'::timestamp
      ORDER BY timestamp DESC
      LIMIT 5
    `);

    sampleResult.rows.forEach((row, idx) => {
      console.log(`   ${idx + 1}. ${row.app_name} - ${row.event_name}`);
      console.log(`      Timestamp: ${row.timestamp}`);
    });

    console.log('\n✅ Timestamp fix completed!');

  } catch (error) {
    console.error('❌ Error fixing timestamps:', error);
    throw error;
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

// Run the fix
fixTimestamps()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Failed:', error);
    process.exit(1);
  });
