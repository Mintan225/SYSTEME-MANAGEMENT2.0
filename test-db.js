const { Pool } = require('pg');
require('dotenv/config');

async function testDBConnection() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('render.com') ? {
      rejectUnauthorized: false,
    } : false
  });

  try {
    console.log('🔄 Testing database connection...');
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set (hidden for security)' : 'NOT SET');
    
    const client = await pool.connect();
    console.log('✅ Database connection successful!');
    
    // Test basic query
    const result = await client.query('SELECT NOW() as current_time');
    console.log('⏰ Current database time:', result.rows[0].current_time);
    
    // Check if tables exist
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `;
    
    const tablesResult = await client.query(tablesQuery);
    console.log('📊 Available tables:', tablesResult.rows.map(r => r.table_name));
    
    client.release();
    
  } catch (error) {
    console.error('❌ Database connection failed:');
    console.error('Error:', error.message);
    console.error('Code:', error.code);
    if (error.detail) console.error('Detail:', error.detail);
  } finally {
    await pool.end();
  }
}

testDBConnection();
