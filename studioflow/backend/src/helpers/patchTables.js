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

    // ── Billing / Stripe ────────────────────────────────────────────────
    // Single paid tier ($5.99/mo). New schools start with a 30-day trial
    // (plan_tier='paid', trial_ends_at set 30 days out). Webhook updates
    // these on subscription events.
    await addColumnIfMissing('schools', 'plan_tier',             "ENUM('free','paid') NOT NULL DEFAULT 'free'");
    await addColumnIfMissing('schools', 'trial_ends_at',         'DATETIME NULL DEFAULT NULL');
    await addColumnIfMissing('schools', 'stripe_customer_id',    'VARCHAR(64) NULL DEFAULT NULL');
    await addColumnIfMissing('schools', 'stripe_subscription_id','VARCHAR(64) NULL DEFAULT NULL');
    await addColumnIfMissing('schools', 'current_period_end',    'DATETIME NULL DEFAULT NULL');

    // Stripe webhook idempotency — record processed event IDs so retries
    // don't double-apply subscription updates.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS stripe_events (
        id           VARCHAR(64) PRIMARY KEY,
        type         VARCHAR(80) NOT NULL,
        received_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Grandfather: any existing school that's never been on a plan gets a
    // fresh 30-day trial so demo/early-tester data stays usable.
    await pool.query(`
      UPDATE schools
         SET plan_tier = 'paid',
             trial_ends_at = DATE_ADD(NOW(), INTERVAL 30 DAY)
       WHERE plan_tier = 'free'
         AND trial_ends_at IS NULL
         AND stripe_subscription_id IS NULL
    `);

    await addColumnIfMissing('batches',   'cover_url',         'MEDIUMTEXT NULL');

    // Public page slugs
    await addColumnIfMissing('schools',  'slug', 'VARCHAR(80) NULL');
    await addColumnIfMissing('recitals', 'slug', 'VARCHAR(120) NULL');

    // Important information bullet points (JSON array of strings)
    await addColumnIfMissing('recitals', 'important_info', 'TEXT NULL');

    // recital_participants new fields
    await addColumnIfMissing('recital_participants', 'name',          'VARCHAR(120) NOT NULL DEFAULT ""');
    await addColumnIfMissing('recital_participants', 'type',          "ENUM('Performer','Guest') NOT NULL DEFAULT 'Performer'");
    await addColumnIfMissing('recital_participants', 'plus_ones',     'TINYINT UNSIGNED NOT NULL DEFAULT 0');
    await addColumnIfMissing('recital_participants', 'rsvp_token',    'VARCHAR(64) NULL');
    await addColumnIfMissing('recital_participants', 'email_sent_at', 'DATETIME NULL');
    await ensureColumnNullable('recital_participants', 'email', 'VARCHAR(180) NULL');
    // Expand type from 2-value ENUM to VARCHAR so Volunteer/Audience/Other are valid
    await (async () => {
      const [cols] = await pool.query(
        `SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'recital_participants' AND COLUMN_NAME = 'type'`
      );
      if (cols[0] && cols[0].DATA_TYPE === 'enum') {
        await pool.query(`ALTER TABLE recital_participants MODIFY COLUMN type VARCHAR(30) NOT NULL DEFAULT 'Performer'`);
        console.log('  ✏️  Changed recital_participants.type from ENUM to VARCHAR(30)');
      }
    })();
    await addColumnIfMissing('recital_participants', 'phone', 'VARCHAR(30) NULL');
    await addColumnIfMissing('recital_participants', 'role',  'VARCHAR(200) NULL');

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

    // ── Auto-generate slugs for existing records ─────────────────────────────
    function slugify(str) {
      return (str || '').toLowerCase().trim()
        .replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 80);
    }
    const [schoolsNoSlug] = await pool.query('SELECT id, name FROM schools WHERE slug IS NULL OR slug = ""');
    for (const s of schoolsNoSlug) {
      await pool.query('UPDATE schools SET slug = ? WHERE id = ?', [slugify(s.name), s.id]);
    }
    const [recitalsNoSlug] = await pool.query('SELECT id, title FROM recitals WHERE slug IS NULL OR slug = ""');
    for (const r of recitalsNoSlug) {
      await pool.query('UPDATE recitals SET slug = ? WHERE id = ?', [slugify(r.title), r.id]);
    }

    // ── Attendance table ────────────────────────────────────────────────
    // Tracks per-student attendance for either an event (one-off) or a
    // recurring class instance (schedule_id + class_date). Exactly one of
    // event_id / schedule_id is set per row.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS attendance (
        id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        school_id       INT UNSIGNED NOT NULL,
        student_id      INT UNSIGNED NOT NULL,
        event_id        INT UNSIGNED NULL,
        schedule_id     INT UNSIGNED NULL,
        class_date      DATE         NOT NULL,
        status          ENUM('present','absent','excused','late') NOT NULL DEFAULT 'present',
        notes           VARCHAR(255) NULL,
        marked_by_user_id INT UNSIGNED NULL,
        marked_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_attendance_event    (school_id, student_id, class_date, event_id),
        UNIQUE KEY uniq_attendance_schedule (school_id, student_id, class_date, schedule_id),
        INDEX idx_school_date (school_id, class_date),
        INDEX idx_student     (student_id),
        INDEX idx_event       (event_id),
        INDEX idx_schedule    (schedule_id),
        FOREIGN KEY (school_id)         REFERENCES schools(id)   ON DELETE CASCADE,
        FOREIGN KEY (student_id)        REFERENCES students(id)  ON DELETE CASCADE,
        FOREIGN KEY (event_id)          REFERENCES events(id)    ON DELETE CASCADE,
        FOREIGN KEY (marked_by_user_id) REFERENCES users(id)     ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // ── Magic-link auth + multi-user invitations ───────────────────────
    // Single token table shared by sign-in links and team invites.
    // purpose='signin' → just authenticates the email.
    // purpose='invite' → also attaches the user to school_id with role.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS magic_tokens (
        id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        token        VARCHAR(64)  NOT NULL UNIQUE,
        email        VARCHAR(180) NOT NULL,
        purpose      ENUM('signin','invite') NOT NULL DEFAULT 'signin',
        school_id    INT UNSIGNED NULL,
        role         VARCHAR(40)  NULL,
        invited_by   INT UNSIGNED NULL,
        expires_at   DATETIME     NOT NULL,
        consumed_at  DATETIME     NULL,
        created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_email   (email),
        INDEX idx_expires (expires_at),
        FOREIGN KEY (school_id)  REFERENCES schools(id) ON DELETE CASCADE,
        FOREIGN KEY (invited_by) REFERENCES users(id)   ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS invitations (
        id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        school_id           INT UNSIGNED NOT NULL,
        email               VARCHAR(180) NOT NULL,
        role                VARCHAR(40)  NOT NULL,
        token               VARCHAR(64)  NOT NULL UNIQUE,
        invited_by_user_id  INT UNSIGNED NULL,
        status              ENUM('pending','accepted','revoked','expired') NOT NULL DEFAULT 'pending',
        created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        accepted_at         DATETIME NULL,
        INDEX idx_school (school_id),
        INDEX idx_email  (email),
        FOREIGN KEY (school_id)          REFERENCES schools(id) ON DELETE CASCADE,
        FOREIGN KEY (invited_by_user_id) REFERENCES users(id)   ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Add columns to users table for new auth model
    await addColumnIfMissing('users', 'email_verified_at', 'DATETIME NULL');
    await addColumnIfMissing('users', 'is_owner',          'TINYINT(1) NOT NULL DEFAULT 0');
    await addColumnIfMissing('users', 'last_sign_in_at',   'DATETIME NULL');
    await addColumnIfMissing('users', 'removed_at',        'DATETIME NULL');
    // Make password column nullable — new users won't have one
    try {
      await ensureColumnNullable('users', 'password', 'VARCHAR(255) NULL');
    } catch (_) { /* column type may differ across deployments */ }

    // Grandfather existing users: mark all current emails as verified,
    // and pick a single owner per school (the lowest-id school_admin).
    await pool.query(
      `UPDATE users SET email_verified_at = NOW() WHERE email_verified_at IS NULL`
    );
    const [ownerCandidates] = await pool.query(`
      SELECT u.id, u.school_id
      FROM users u
      INNER JOIN (
        SELECT school_id, MIN(id) AS first_admin_id
        FROM users
        WHERE role = 'school_admin' AND school_id IS NOT NULL
        GROUP BY school_id
      ) f ON f.first_admin_id = u.id
      WHERE u.is_owner = 0
    `);
    for (const u of ownerCandidates) {
      await pool.query('UPDATE users SET is_owner = 1 WHERE id = ?', [u.id]);
    }
    if (ownerCandidates.length > 0) {
      console.log(`  👑 Marked ${ownerCandidates.length} existing school_admin(s) as owners`);
    }

    // Resolve any school that ended up with multiple owners. Source of truth:
    // schools.email = the email used at registration. If a user in that school
    // matches that email, they're the owner; everyone else is demoted.
    const [dupes] = await pool.query(`
      SELECT school_id, COUNT(*) AS n
      FROM users
      WHERE is_owner = 1 AND school_id IS NOT NULL AND removed_at IS NULL
      GROUP BY school_id
      HAVING n > 1
    `);
    let demoted = 0;
    for (const d of dupes) {
      // Prefer the user whose email matches schools.email
      const [r1] = await pool.query(
        `UPDATE users u
           JOIN schools s ON s.id = u.school_id
            SET u.is_owner = 0
          WHERE u.school_id = ? AND u.is_owner = 1
            AND LOWER(u.email) <> LOWER(s.email)`,
        [d.school_id]
      );
      demoted += r1.affectedRows || 0;

      // If still multiple (no email match found), keep only the lowest-id one
      const [[after]] = await pool.query(
        `SELECT COUNT(*) AS n FROM users
          WHERE is_owner = 1 AND school_id = ? AND removed_at IS NULL`,
        [d.school_id]
      );
      if (after.n > 1) {
        const [r2] = await pool.query(
          `UPDATE users
              SET is_owner = 0
            WHERE school_id = ? AND is_owner = 1
              AND id <> (SELECT min_id FROM (
                  SELECT MIN(id) AS min_id FROM users
                   WHERE school_id = ? AND is_owner = 1 AND removed_at IS NULL
              ) x)`,
          [d.school_id, d.school_id]
        );
        demoted += r2.affectedRows || 0;
      }
    }
    if (demoted > 0) {
      console.log(`  🧹 Demoted ${demoted} duplicate owner(s) — each school now has exactly one`);
    }

    // Attribution columns — added now so future auth+team work has them.
    // Nullable to keep all existing rows valid.
    for (const tbl of ['batches','students','recitals','todos','schedules']) {
      try { await addColumnIfMissing(tbl, 'created_by_user_id', 'INT UNSIGNED NULL'); } catch (_) {}
    }

    // ── Multi-school memberships ──────────────────────────────────────────
    // One row per (user, school). Role + is_owner live here, NOT on users.
    // Existing users.school_id / users.role / users.is_owner are kept as
    // "current active session" mirror columns — JWT remains the runtime
    // source of truth — but ownership and per-school roles live here.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS school_memberships (
        id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id       INT UNSIGNED NOT NULL,
        school_id     INT UNSIGNED NOT NULL,
        role          VARCHAR(40)  NOT NULL DEFAULT 'teacher',
        is_owner      TINYINT(1)   NOT NULL DEFAULT 0,
        joined_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_used_at  DATETIME     NULL,
        removed_at    DATETIME     NULL,
        UNIQUE KEY uniq_user_school (user_id, school_id),
        INDEX idx_user   (user_id),
        INDEX idx_school (school_id),
        FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE,
        FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Short-lived "you have N schools, pick one" tokens. Issued after a
    // successful auth event (magic-link, Google, demo) when the user has
    // >1 active membership. Consumed by POST /auth/choose-school.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chooser_tokens (
        id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        token        VARCHAR(64)  NOT NULL UNIQUE,
        user_id      INT UNSIGNED NOT NULL,
        expires_at   DATETIME     NOT NULL,
        consumed_at  DATETIME     NULL,
        created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_expires (expires_at),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Per-school per-day AI call counter. The rate-limit middleware is the
    // fast path; this table is the persistent source of truth so a backend
    // restart can't accidentally hand out extra free calls.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS smart_usage_daily (
        school_id   INT UNSIGNED NOT NULL,
        usage_date  DATE         NOT NULL,
        count       INT UNSIGNED NOT NULL DEFAULT 0,
        updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (school_id, usage_date),
        FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Backfill memberships from existing users.school_id rows
    const [orphans] = await pool.query(`
      SELECT u.id AS user_id, u.school_id, u.role, COALESCE(u.is_owner,0) AS is_owner
        FROM users u
        LEFT JOIN school_memberships sm
          ON sm.user_id = u.id AND sm.school_id = u.school_id
       WHERE u.school_id IS NOT NULL
         AND (u.removed_at IS NULL)
         AND sm.id IS NULL
    `);
    for (const o of orphans) {
      try {
        await pool.query(
          `INSERT INTO school_memberships (user_id, school_id, role, is_owner, joined_at)
           VALUES (?, ?, ?, ?, NOW())`,
          [o.user_id, o.school_id, o.role || 'teacher', o.is_owner ? 1 : 0]
        );
      } catch (_) { /* unique key collision is fine */ }
    }
    if (orphans.length > 0) {
      console.log(`  🔗 Backfilled ${orphans.length} membership(s) from users.school_id`);
    }

    console.log('✅ patchTables complete');
  } catch (err) {
    // Non-fatal — log but don't crash the server
    console.warn('⚠ patchTables warning:', err.message);
  }
}

module.exports = patchTables;
