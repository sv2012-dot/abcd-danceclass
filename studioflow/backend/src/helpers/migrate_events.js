require('dotenv').config();
const pool = require('../../config/db');

async function migrate() {
  const conn = await pool.getConnection();
  try {
    console.log('🔧 Adding events table...');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS events (
        id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        school_id       INT UNSIGNED NOT NULL,
        title           VARCHAR(200) NOT NULL,
        type            ENUM('Class','Recital','Rehearsal','Workshop','Other') NOT NULL DEFAULT 'Class',
        batch_id        INT UNSIGNED NULL,
        start_datetime  DATETIME     NOT NULL,
        end_datetime    DATETIME     NOT NULL,
        location        VARCHAR(180) NULL,
        requires_studio TINYINT(1)   NOT NULL DEFAULT 0,
        studio_booked   TINYINT(1)   NOT NULL DEFAULT 0,
        recurrence      ENUM('none','weekly','biweekly') NOT NULL DEFAULT 'none',
        recurrence_end  DATE         NULL,
        color           VARCHAR(10)  NULL,
        notes           TEXT         NULL,
        created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_school    (school_id),
        INDEX idx_start     (start_datetime),
        INDEX idx_type      (type),
        FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
        FOREIGN KEY (batch_id)  REFERENCES batches(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('✅ Events table ready.');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    conn.release();
    pool.end();
  }
}
migrate();