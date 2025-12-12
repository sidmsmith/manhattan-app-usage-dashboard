// Quick script to add event_id column to Neon
// Run: node scripts/add-event-id-column.js

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const connectionString = process.env.NEON_DATABASE_URL || 
  'postgresql://neondb_owner:npg_HCWtem4D6fcR@ep-small-firefly-aha9kbbm-pooler.c-3.us-east-1.aws.neon.tech:5432/neondb?sslmode=require';

async function addEventIdColumn() {
  const pool = new Pool({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
  });

  let client;
  try {
    client = await pool.connect();
    console.log('✅ Connected to Neon database');

    // Check if column exists
    const checkResult = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'app_usage_events' AND column_name = 'event_id'
    `);

    if (checkResult.rows.length > 0) {
      console.log('✅ event_id column already exists');
    } else {
      console.log('📝 Adding event_id column...');
      
      // Add column
      await client.query(`
        ALTER TABLE app_usage_events 
        ADD COLUMN event_id INTEGER NULL
      `);
      
      // Create index
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_event_id ON app_usage_events(event_id)
      `);
      
      console.log('✅ event_id column added successfully');
    }

    // Verify
    const verifyResult = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'app_usage_events' AND column_name = 'event_id'
    `);
    
    if (verifyResult.rows.length > 0) {
      console.log('\n📋 Column details:');
      console.log(`   Column: ${verifyResult.rows[0].column_name}`);
      console.log(`   Type: ${verifyResult.rows[0].data_type}`);
      console.log(`   Nullable: ${verifyResult.rows[0].is_nullable}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

addEventIdColumn();
