/**
 * patchTables.js
 * Adds tables / columns introduced after the initial migration.
 * Uses CREATE TABLE IF NOT EXISTS + INFORMATION_SCHEMA checks for ALTER TABLE
 * so it is safe to run on every startup across all MySQL versions (5.7+).
 */
const { pool } = require('../database');
const bcrypt = require('bcryptjs');

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

/** Ensure an existing column is nullable — fixes old schemas where it was NOT NULL */
async function ensureColumnNullable(table, column, fullDefinition) {
  const [rows] = await pool.query(
    `SELECT IS_NULLABLE
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME   = ?
       AND COLUMN_NAME  = ?`,
    [table, column]
  );
  if (rows[0] && rows[0].IS_NULLABLE === 'NO') {
    await pool.query(`ALTER TABLE \`${table}\` MODIFY COLUMN \`${column}\` ${fullDefinition}`);
    console.log(`  ✏️  Made ${table}.${column} nullable`);
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

    // Schedule exceptions — one row per cancelled/skipped recurring slot
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schedule_exceptions (
        id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        school_id      INT UNSIGNED NOT NULL,
        schedule_id    INT UNSIGNED NOT NULL,
        exception_date DATE         NOT NULL,
        created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_school   (school_id),
        INDEX idx_schedule (schedule_id),
        UNIQUE KEY uq_exc (schedule_id, exception_date),
        FOREIGN KEY (school_id)   REFERENCES schools(id)   ON DELETE CASCADE,
        FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Column patches — uses INFORMATION_SCHEMA so they work on MySQL 5.7+
    await ensureColumnNullable('todos', 'user_id', 'INT UNSIGNED NULL');
    await addColumnIfMissing('schools',   'profile_json',      'LONGTEXT NULL');
    await addColumnIfMissing('students',  'avatar',            'VARCHAR(100) NULL');
    await addColumnIfMissing('todos',     'assigned_to',       'VARCHAR(100) NULL');
    await addColumnIfMissing('recitals',  'is_featured',       'TINYINT(1) NOT NULL DEFAULT 0');
    await addColumnIfMissing('recitals',  'poster_url',        'MEDIUMTEXT NULL');
    await addColumnIfMissing('recitals',  'event_time',        'VARCHAR(10) NULL');
    await addColumnIfMissing('recitals',  'participant_count', 'INT NULL');
    await addColumnIfMissing('studios',   'is_quick_add',      'TINYINT(1) NOT NULL DEFAULT 0');
    await addColumnIfMissing('schools',   'deleted_at',        'DATETIME NULL DEFAULT NULL');
    await addColumnIfMissing('batches',   'cover_url',         'MEDIUMTEXT NULL');
    await addColumnIfMissing('schedules', 'is_active',         'TINYINT(1) NOT NULL DEFAULT 1');

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

    // ── Demo school for manchq.com accounts (idempotent) ────────────────────
    const [[demoCheck]] = await pool.query(
      "SELECT id FROM users WHERE email = 'teacher@manchq.com' LIMIT 1"
    );
    if (!demoCheck) {
      const hash = pw => bcrypt.hashSync(pw, 10);

      // School
      const [demoSchoolRes] = await pool.query(
        `INSERT INTO schools (name, owner_name, email, phone, city, dance_style)
         VALUES ('Demo Academy', 'Demo Teacher', 'teacher@manchq.com', '+1 555 000 0001', 'San Francisco', 'Bharatanatyam')`
      );
      const demoSchoolId = demoSchoolRes.insertId;

      // Admin / teacher account
      await pool.query(
        `INSERT INTO users (name, email, password, role, school_id)
         VALUES ('Demo Teacher', 'teacher@manchq.com', ?, 'school_admin', ?)`,
        [hash('School123!'), demoSchoolId]
      );

      // Student
      const [stuRes] = await pool.query(
        `INSERT INTO students (school_id, name, phone, email, guardian_name, guardian_email, guardian_phone, join_date, notes)
         VALUES (?, 'Arjun Sharma', '+1 555 100 0011', 'arjun@demo.com',
                 'Meena Sharma', 'parent@manchq.com', '+1 555 100 0012', '2025-09-01', 'Demo student')`,
        [demoSchoolId]
      );
      const demoStudentId = stuRes.insertId;

      // Parent account linked to student
      const [parRes] = await pool.query(
        `INSERT INTO users (name, email, password, role, school_id)
         VALUES ('Meena Sharma', 'parent@manchq.com', ?, 'parent', ?)`,
        [hash('Parent123!'), demoSchoolId]
      );
      await pool.query(
        `INSERT IGNORE INTO parent_students (parent_id, student_id) VALUES (?, ?)`,
        [parRes.insertId, demoStudentId]
      );

      // Batch
      const [batchRes] = await pool.query(
        `INSERT INTO batches (school_id, name, dance_style, level, teacher_name, max_size)
         VALUES (?, 'Classical Foundations', 'Bharatanatyam', 'Beginner', 'Demo Teacher', 12)`,
        [demoSchoolId]
      );
      const demoBatchId = batchRes.insertId;
      await pool.query(
        `INSERT INTO batch_students (batch_id, student_id) VALUES (?, ?)`,
        [demoBatchId, demoStudentId]
      );

      // Weekly class schedule
      await pool.query(
        `INSERT INTO schedules (school_id, batch_id, day_of_week, start_time, end_time, room, frequency)
         VALUES (?, ?, 'Sat', '10:00', '11:30', 'Studio A', 'Weekly')`,
        [demoSchoolId, demoBatchId]
      );

      // Upcoming recital
      const [recRes] = await pool.query(
        `INSERT INTO recitals (school_id, title, event_date, event_time, venue, status, description, is_featured)
         VALUES (?, 'Annual Showcase 2026', '2026-06-14', '18:00',
                 'City Arts Theater', 'Rehearsals',
                 'Our annual year-end showcase featuring students from all batches.', 1)`,
        [demoSchoolId]
      );
      const demoRecitalId = recRes.insertId;
      const recitalTasks = [
        ['Book venue', 1], ['Send parent invitations', 1],
        ['Confirm costume orders', 0], ['Arrange sound system', 0],
        ['Schedule dress rehearsal', 0], ['Print programs', 0],
      ];
      for (const [text, done] of recitalTasks) {
        await pool.query(
          `INSERT INTO recital_tasks (recital_id, task_text, is_done) VALUES (?, ?, ?)`,
          [demoRecitalId, text, done]
        );
      }

      // A few upcoming class events on the calendar
      const classEvents = [
        ['Classical Foundations — Class', '2026-04-19T10:00', '2026-04-19T11:30'],
        ['Classical Foundations — Class', '2026-04-26T10:00', '2026-04-26T11:30'],
        ['Annual Showcase Rehearsal',     '2026-05-03T10:00', '2026-05-03T12:00'],
        ['Classical Foundations — Class', '2026-05-10T10:00', '2026-05-10T11:30'],
      ];
      for (const [title, start, end] of classEvents) {
        const [evRes] = await pool.query(
          `INSERT INTO events (school_id, title, type, start_datetime, end_datetime, location)
           VALUES (?, ?, 'Class', ?, ?, 'Studio A')`,
          [demoSchoolId, title, start, end]
        );
        await pool.query(
          `INSERT IGNORE INTO event_batches (event_id, batch_id) VALUES (?, ?)`,
          [evRes.insertId, demoBatchId]
        );
      }

      console.log('  🎭 Demo school seeded: teacher@manchq.com / parent@manchq.com');
    }

    // ── Additional demo data (idempotent — runs on every boot) ──────────────
    const [[demoSchool]] = await pool.query(
      "SELECT id FROM schools WHERE email = 'teacher@manchq.com' LIMIT 1"
    );
    if (demoSchool) {
      const dsid = demoSchool.id;

      // 9 more students (Arjun already seeded above = 10 total)
      const extraStudents = [
        { name:'Priya Patel',   phone:'+1 555 100 0021', email:'priya@demo.com',   guardian_name:'Kavita Patel',    guardian_email:'kavita@demo.com'  },
        { name:'Riya Sharma',   phone:'+1 555 100 0031', email:'riya@demo.com',    guardian_name:'Sunita Sharma',   guardian_email:'sunita@demo.com'  },
        { name:'Ananya Nair',   phone:'+1 555 100 0041', email:'ananya@demo.com',  guardian_name:'Lakshmi Nair',    guardian_email:'lakshmi@demo.com' },
        { name:'Meera Iyer',    phone:'+1 555 100 0051', email:'meera@demo.com',   guardian_name:'Priya Iyer',      guardian_email:'priyai@demo.com'  },
        { name:'Diya Krishnan', phone:'+1 555 100 0061', email:'diya@demo.com',    guardian_name:'Geetha Krishnan', guardian_email:'geetha@demo.com'  },
        { name:'Kavya Menon',   phone:'+1 555 100 0071', email:'kavya@demo.com',   guardian_name:'Smitha Menon',    guardian_email:'smitha@demo.com'  },
        { name:'Aisha Reddy',   phone:'+1 555 100 0081', email:'aisha@demo.com',   guardian_name:'Sudha Reddy',     guardian_email:'sudha@demo.com'   },
        { name:'Sara Thomas',   phone:'+1 555 100 0091', email:'sara@demo.com',    guardian_name:'Bindu Thomas',    guardian_email:'bindu@demo.com'   },
        { name:'Tara Pillai',   phone:'+1 555 100 0101', email:'tara@demo.com',    guardian_name:'Usha Pillai',     guardian_email:'usha@demo.com'    },
      ];
      for (const stu of extraStudents) {
        const [[ex]] = await pool.query(
          'SELECT id FROM students WHERE school_id=? AND name=?', [dsid, stu.name]
        );
        if (!ex) {
          await pool.query(
            `INSERT INTO students (school_id, name, phone, email, guardian_name, guardian_email, join_date)
             VALUES (?, ?, ?, ?, ?, ?, '2025-09-01')`,
            [dsid, stu.name, stu.phone, stu.email, stu.guardian_name, stu.guardian_email]
          );
        }
      }

      // 2 more batches (Classical Foundations already seeded = 3 total)
      const extraBatches = [
        { name:'Advanced Classical', level:'Advanced', max_size:8  },
        { name:'Junior Stars',       level:'Beginner', max_size:15 },
      ];
      for (const b of extraBatches) {
        const [[ex]] = await pool.query(
          'SELECT id FROM batches WHERE school_id=? AND name=?', [dsid, b.name]
        );
        if (!ex) {
          await pool.query(
            `INSERT INTO batches (school_id, name, dance_style, level, teacher_name, max_size)
             VALUES (?, ?, 'Bharatanatyam', ?, 'Demo Teacher', ?)`,
            [dsid, b.name, b.level, b.max_size]
          );
        }
      }

      // 2 more recitals (Annual Showcase 2026 already seeded = 3 total)
      const extraRecitals = [
        { title:'Spring Festival 2026', date:'2026-03-21', time:'17:00', venue:'Community Arts Center', status:'Planning',   desc:'Spring celebration showcasing student progress across all batches.' },
        { title:'Winter Showcase 2025', date:'2025-12-20', time:'18:30', venue:'School Auditorium',     status:'Completed',  desc:'Our annual winter showcase featuring students from all batches.'   },
      ];
      for (const r of extraRecitals) {
        const [[ex]] = await pool.query(
          'SELECT id FROM recitals WHERE school_id=? AND title=?', [dsid, r.title]
        );
        if (!ex) {
          await pool.query(
            `INSERT INTO recitals (school_id, title, event_date, event_time, venue, status, description)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [dsid, r.title, r.date, r.time, r.venue, r.status, r.desc]
          );
        }
      }
    }

    console.log('✅ patchTables complete');
  } catch (err) {
    // Non-fatal — log but don't crash the server
    console.warn('⚠ patchTables warning:', err.message);
  }
}

module.exports = patchTables;
