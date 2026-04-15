/**
 * patchTables.js
 * Adds tables / columns introduced after the initial migration.
 * Uses CREATE TABLE IF NOT EXISTS + INFORMATION_SCHEMA checks for ALTER TABLE
 * so it is safe to run on every startup across all MySQL versions (5.7+).
 */
const { pool } = require('../database');

/** Add a column only if it doesn't already exist — works on MySQL 5.7+ */
async function addColumnIfMissing(table, column, definition) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS cnt
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME   = ?
       AND COLUMN_NAME  = ?`,
    [table, column]
  );
  if (rows[0].cnt === 0) {
    await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
    console.log(`  ➕ Added ${table}.${column}`);
  }
}

async function patchTables() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS todos (
        id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        school_id   INT UNSIGNED NOT NULL,
        user_id     INT UNSIGNED NULL,
        title       VARCHAR(255) NOT NULL,
        notes       TEXT         NULL,
        is_complete TINYINT(1)   NOT NULL DEFAULT 0,
        event_id    INT UNSIGNED NULL,
        recital_id  INT UNSIGNED NULL,
        due_date    DATE         NULL,
        created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_school (school_id),
        INDEX idx_user   (user_id),
        FOREIGN KEY (school_id)  REFERENCES schools(id)  ON DELETE CASCADE,
        FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE SET NULL,
        FOREIGN KEY (event_id)   REFERENCES events(id)   ON DELETE SET NULL,
        FOREIGN KEY (recital_id) REFERENCES recitals(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS studios (
        id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        school_id    INT UNSIGNED NOT NULL,
        name         VARCHAR(180) NOT NULL,
        address      VARCHAR(255) NULL,
        city         VARCHAR(80)  NULL,
        state        VARCHAR(80)  NULL,
        zip          VARCHAR(20)  NULL,
        phone        VARCHAR(40)  NULL,
        email        VARCHAR(180) NULL,
        website      VARCHAR(255) NULL,
        capacity     SMALLINT UNSIGNED NULL,
        hourly_rate  DECIMAL(8,2) NULL,
        notes        TEXT         NULL,
        is_favorite  TINYINT(1)   NOT NULL DEFAULT 0,
        is_active    TINYINT(1)   NOT NULL DEFAULT 1,
        created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_school (school_id),
        FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Column patches — uses INFORMATION_SCHEMA so they work on MySQL 5.7+
    await addColumnIfMissing('schools',  'profile_json', 'LONGTEXT NULL');
    await addColumnIfMissing('students', 'avatar',       'VARCHAR(100) NULL');
    await addColumnIfMissing('todos',    'assigned_to',  'VARCHAR(100) NULL');
    await addColumnIfMissing('recitals', 'is_featured',  'TINYINT(1) NOT NULL DEFAULT 0');
    await addColumnIfMissing('recitals', 'poster_url',   'MEDIUMTEXT NULL');

    // Vendors table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS vendors (
        id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        school_id    INT UNSIGNED NOT NULL,
        name         VARCHAR(200) NOT NULL,
        category     VARCHAR(80)  NOT NULL DEFAULT 'Other',
        contact_name VARCHAR(140) NULL,
        phone        VARCHAR(40)  NULL,
        email        VARCHAR(180) NULL,
        website      VARCHAR(255) NULL,
        instagram    VARCHAR(120) NULL,
        price_range  VARCHAR(80)  NULL,
        notes        TEXT         NULL,
        is_favorite  TINYINT(1)   NOT NULL DEFAULT 0,
        is_active    TINYINT(1)   NOT NULL DEFAULT 1,
        created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_school (school_id),
        FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Seed vendors for school 1 (only if table is empty for that school)
    const [[vCount]] = await pool.query('SELECT COUNT(*) as n FROM vendors WHERE school_id = 1');
    if (vCount.n === 0) {
      await pool.query(`
        INSERT INTO vendors (school_id, name, category, contact_name, phone, email, website, instagram, price_range, notes, is_favorite) VALUES
        (1,'Priya Lens Studio','Photographer','Priya Nair','+1 206 555 0101','priya@priyalens.com','https://priyalens.com','@priyalens','$400–$800','Specialises in Bharatanatyam recital photography. Brings extra lighting rigs.',1),
        (1,'Reel Motion Films','Videographer','Arjun Menon','+1 206 555 0102','arjun@reelmotion.com','https://reelmotion.com','@reelmotionfilms','$600–$1200','Full recital packages with multi-camera setup. Drone available at extra cost.',1),
        (1,'Kalai Costumes','Costume Provider','Lakshmi Iyer','+1 425 555 0103','lakshmi@kalaicostumes.com','https://kalaicostumes.com','@kalaicostumes','Custom pricing','Classical Bharatanatyam and folk costume rentals and tailoring. 3-week lead time.',0),
        (1,'Glam by Divya','Makeup Artist','Divya Sharma','+1 206 555 0104','divya@glambydivya.com',NULL,'@glambydivya','$80/artist','Stage makeup specialist for classical dance. Group rates available.',0),
        (1,'Blooms & Petals','Florist','Meena Raj','+1 425 555 0105','meena@bloomsandpetals.com','https://bloomsandpetals.com',NULL,'$150–$500','Stage flower arrangements and garlands for recitals.',0),
        (1,'SoundWave AV','Sound & Music','Kevin Thomas','+1 206 555 0106','kevin@soundwaveav.com','https://soundwaveav.com',NULL,'$300/event','Full PA system, wireless mics, mixing. Free setup consultation.',0),
        (1,'Pixel Perfect Events','Photographer','Rahul Gupta','+1 206 555 0107','rahul@pixelperfect.com',NULL,'@pixelperfectevents','$300–$600','Action shots during performances. Candid and posed portfolios.',0),
        (1,'Stage Light Co','Lighting','Amanda Cross','+1 253 555 0108','amanda@stagelightco.com','https://stagelightco.com',NULL,'$250–$700','Theatre-grade LED rigs with colour profiles for Indian classical performances.',0)
      `);
    }

    console.log('✅ patchTables complete');
  } catch (err) {
    // Non-fatal — log but don't crash the server
    console.warn('⚠ patchTables warning:', err.message);
  }
}

module.exports = patchTables;
