/**
 * StudioFlow — Add events & event_batches tables to Railway
 * Run: node database/migrate-events.js
 * Safe to run multiple times (uses CREATE TABLE IF NOT EXISTS)
 */
const mysql = require('mysql2/promise');

async function migrate() {
  const conn = await mysql.createConnection({
    host: 'tramway.proxy.rlwy.net',
    port: 18420,
    user: 'root',
    password: 'ShmLxiruXfeRQHYvdCSidWzXePNuDFQH',
    database: 'railway',
    ssl: { rejectUnauthorized: false },
  });
  console.log('✅ Connected to Railway MySQL');

  await conn.query('SET FOREIGN_KEY_CHECKS = 0');

  await conn.query(`
    CREATE TABLE IF NOT EXISTS events (
      id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      school_id        INT UNSIGNED NOT NULL,
      title            VARCHAR(180) NOT NULL,
      type             ENUM('Class','Recital','Rehearsal','Workshop','Other') NOT NULL DEFAULT 'Class',
      batch_id         INT UNSIGNED NULL,
      start_datetime   DATETIME     NOT NULL,
      end_datetime     DATETIME     NOT NULL,
      location         VARCHAR(180) NULL,
      requires_studio  TINYINT(1)   NOT NULL DEFAULT 0,
      studio_booked    TINYINT(1)   NOT NULL DEFAULT 0,
      recurrence       ENUM('none','weekly','biweekly') NOT NULL DEFAULT 'none',
      recurrence_end   DATE         NULL,
      color            VARCHAR(20)  NULL,
      notes            TEXT         NULL,
      created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_school (school_id),
      INDEX idx_start  (start_datetime),
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
      FOREIGN KEY (batch_id)  REFERENCES batches(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  console.log('✅ events table ready');

  await conn.query(`
    CREATE TABLE IF NOT EXISTS event_batches (
      id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      event_id   INT UNSIGNED NOT NULL,
      batch_id   INT UNSIGNED NOT NULL,
      UNIQUE KEY uq_event_batch (event_id, batch_id),
      FOREIGN KEY (event_id) REFERENCES events(id)  ON DELETE CASCADE,
      FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  console.log('✅ event_batches table ready');

  await conn.query('SET FOREIGN_KEY_CHECKS = 1');
  await conn.end();
  console.log('\n🎉 Migration complete! Create Event should now work.');
}

migrate().catch(e => { console.error('❌ Migration failed:', e.message); process.exit(1); });
