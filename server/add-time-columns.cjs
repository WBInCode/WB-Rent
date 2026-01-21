// Migration script to add time columns to existing reservations table
const { Pool } = require('pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_sbeg4V6awAND@ep-rapid-lab-agvd56a5-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Adding time columns to reservations table...');
    
    // Add start_time column if not exists
    await client.query(`
      ALTER TABLE reservations 
      ADD COLUMN IF NOT EXISTS start_time TEXT DEFAULT '09:00'
    `);
    console.log('✅ Added start_time column');
    
    // Add end_time column if not exists
    await client.query(`
      ALTER TABLE reservations 
      ADD COLUMN IF NOT EXISTS end_time TEXT DEFAULT '09:00'
    `);
    console.log('✅ Added end_time column');
    
    // Verify columns
    const result = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'reservations'
      ORDER BY ordinal_position
    `);
    
    console.log('\n📋 Current reservations table structure:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (default: ${row.column_default || 'none'})`);
    });
    
    console.log('\n✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
