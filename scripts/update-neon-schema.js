// Script to update Neon PostgreSQL schema
// Adds missing columns, indexes, and views
// Run: node scripts/update-neon-schema.js

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get connection string from environment or use hardcoded (for one-time setup)
const connectionString = process.env.NEON_DATABASE_URL || 
  'postgresql://neondb_owner:npg_HCWtem4D6fcR@ep-small-firefly-aha9kbbm-pooler.c-3.us-east-1.aws.neon.tech:5432/neondb?sslmode=require';

async function updateSchema() {
  const pool = new Pool({
    connectionString: connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });

  let client;
  try {
    client = await pool.connect();
    console.log('✅ Connected to Neon database');

    // Read SQL script
    const sqlPath = path.join(__dirname, '../manhattan_dashboard/neon_schema_update.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Execute SQL script
    console.log('📝 Executing schema update...');
    await client.query(sql);
    
    console.log('✅ Schema update complete!');

    // Verify changes
    console.log('\n📊 Verifying changes...');
    
    // Check columns
    const columnsResult = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'app_usage_events'
      ORDER BY ordinal_position
    `);
    console.log('\n📋 Columns:');
    columnsResult.rows.forEach(row => {
      console.log(`   - ${row.column_name} (${row.data_type})`);
    });

    // Check indexes
    const indexesResult = await client.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'app_usage_events'
    `);
    console.log(`\n🔍 Indexes (${indexesResult.rows.length} total):`);
    indexesResult.rows.forEach(row => {
      console.log(`   - ${row.indexname}`);
    });

    // Check views
    const viewsResult = await client.query(`
      SELECT table_name 
      FROM information_schema.views 
      WHERE table_schema = 'public' 
      AND (table_name LIKE '%statistics%' OR table_name LIKE '%events%')
    `);
    console.log(`\n👁️  Views (${viewsResult.rows.length} total):`);
    viewsResult.rows.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });

    console.log('\n✅ All done! Schema is up to date.');

  } catch (error) {
    console.error('❌ Error updating schema:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

updateSchema();

