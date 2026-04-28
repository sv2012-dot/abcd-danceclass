/**
 * Migration: Add missing recital-related tables and columns
 * Run: node database/migrate-add-recital-tables.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mysql = require('mysql2/promise');

async function migrate() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
  });

  const dbName = process.env.DB_NAME || 'studioflow';
  console.log(`🔄 Running migration on database: ${dbName}\n`);

  try {
    await conn.query(`USE \`${dbName}\``);

    // Add missing columns to recitals table
    console.log('Adding missing columns to recitals table...');
    try {
      await conn.query(`ALTER TABLE recitals ADD COLUMN event_time VARCHAR(5) NULL`);
      console.log('✓ Added event_time column');
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log('✓ event_time column already exists');
      } else {
        throw e;
      }
    }

    try {
      await conn.query(`ALTER TABLE recitals ADD COLUMN poster_url LONGTEXT NULL`);
      console.log('✓ Added poster_url column');
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log('✓ poster_url column already exists');
      } else {
        throw e;
      }
    }

    try {
      await conn.query(`ALTER TABLE recitals ADD COLUMN is_featured TINYINT(1) NOT NULL DEFAULT 0`);
      console.log('✓ Added is_featured column');
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log('✓ is_featured column already exists');
      } else {
        throw e;
      }
    }

    try {
      await conn.query(`ALTER TABLE recitals ADD COLUMN participant_count INT UNSIGNED NULL`);
      console.log('✓ Added participant_count column');
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log('✓ participant_count column already exists');
      } else {
        throw e;
      }
    }

    // Create recital_participants table if it doesn't exist
    console.log('\nCreating recital_participants table...');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS recital_participants (
        id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        recital_id      INT UNSIGNED NOT NULL,
        school_id       INT UNSIGNED NOT NULL,
        email           VARCHAR(180) NOT NULL,
        student_id      INT UNSIGNED NULL,
        is_guest        TINYINT(1) NOT NULL DEFAULT 0,
        rsvp_status     ENUM('Pending','Confirmed','Declined','No Response') NOT NULL DEFAULT 'Pending',
        created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (recital_id) REFERENCES recitals(id) ON DELETE CASCADE,
        FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL,
        UNIQUE KEY uq_recital_email (recital_id, email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('✓ recital_participants table created/verified');

    console.log('\n✅ Migration completed successfully!\n');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

migrate();
