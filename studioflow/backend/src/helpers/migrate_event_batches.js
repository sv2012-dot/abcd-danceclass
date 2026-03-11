const pool = require('../../config/db');

async function run() {
  const conn = await pool.getConnection();
  try {
    console.log('🔧 Adding event_batches junction table...');

    // Create without foreign keys to avoid constraint issues
    await conn.query(`
      CREATE TABLE IF NOT EXISTS event_batches (
        event_id  INT NOT NULL,
        batch_id  INT NOT NULL,
        PRIMARY KEY (event_id, batch_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Migrate existing batch_id values into the junction table
    console.log('🔄 Migrating existing batch_id data...');
    await conn.query(`
      INSERT IGNORE INTO event_batches (event_id, batch_id)
      SELECT id, batch_id FROM events WHERE batch_id IS NOT NULL
    `);

    console.log('✅ event_batches table ready.');
  } catch (err) {
    console.error('❌', err.message);
    process.exit(1);
  } finally {
    conn.release();
    pool.end();
  }
}

run();
