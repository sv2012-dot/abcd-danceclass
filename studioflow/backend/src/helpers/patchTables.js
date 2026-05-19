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

/** Widen a VARCHAR column to at least N chars. Idempotent. */
async function ensureMinVarcharLength(table, column, minLen) {
  const [rows] = await pool.query(
    `SELECT CHARACTER_MAXIMUM_LENGTH AS len, IS_NULLABLE AS nullable
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  if (!rows[0] || rows[0].len == null) return;
  if (rows[0].len < minLen) {
    const nullable = rows[0].nullable === 'YES' ? 'NULL' : 'NOT NULL';
    await pool.query(`ALTER TABLE \`${table}\` MODIFY COLUMN \`${column}\` VARCHAR(${minLen}) ${nullable}`);
    console.log(`  ⤴  Widened ${table}.${column} from VARCHAR(${rows[0].len}) → VARCHAR(${minLen})`);
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
    await addColumnIfMissing('students',  'avatar',            'VARCHAR(512) NULL');
    // Widen avatar on legacy schemas — Cloudinary URLs are ~80–100 chars
    // plus the 'photo:' prefix, blew past VARCHAR(100) and triggered
    // 'Data too long for column avatar' on save.
    await ensureMinVarcharLength('students', 'avatar', 512);
    // Bio — short, parent-facing self-description that lives on the
    // student profile (distinct from `notes`, which is teacher-only).
    await addColumnIfMissing('students',  'bio',               'TEXT NULL');
    // Per-event cover override — defaults to the linked batch's cover.
    // Cloudinary URLs are ~80–100 chars; MEDIUMTEXT covers data-URLs and
    // headroom for future longer URLs.
    await addColumnIfMissing('events',    'cover_url',         'MEDIUMTEXT NULL');
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

    // ── Limit-block telemetry ─────────────────────────────────────────
    // Logs every time withinFreeLimits blocks a free-plan school from
    // adding a record. Used to measure which limit converts best to Pro.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS limit_blocks (
        id            INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
        school_id     INT UNSIGNED NOT NULL,
        user_id       INT UNSIGNED NULL,
        resource      VARCHAR(40) NOT NULL,
        current_count INT NOT NULL DEFAULT 0,
        plan_limit    INT NOT NULL DEFAULT 0,
        created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY ix_limit_blocks_school (school_id, created_at),
        KEY ix_limit_blocks_resource (resource, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // ── Trial sunset migration ────────────────────────────────────────
    // The old trial-based plan model is gone. Clear any leftover
    // trial_ends_at values so effectivePlan treats everyone consistently
    // (paid via Stripe, or Hobby). Safe to re-run — idempotent.
    await pool.query(`UPDATE schools SET trial_ends_at = NULL WHERE trial_ends_at IS NOT NULL`);

    await addColumnIfMissing('batches',   'cover_url',         'MEDIUMTEXT NULL');
    // Soft-delete with 30-day recovery window. is_active = 0 +
    // deleted_at = NOW() on delete; purge cron permanently removes the
    // row + cascaded children (schedules / events / attendance /
    // batch_students) after 30 days. Restore clears both back.
    await addColumnIfMissing('batches',   'deleted_at',        'TIMESTAMP NULL DEFAULT NULL');

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

    // Demo-school seeding was removed — every new signup now gets its own
    // populated studio via seedDummyData(). The legacy Demo Academy row
    // (if it exists in prod) is left untouched and can be deactivated
    // manually if desired (UPDATE schools SET is_active=0 WHERE email='teacher@manchq.com').

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

    // Heal "orphaned ownerships" — a school registered with a user's email
    // but no school_memberships row pointing at it. This happens when the
    // user accepted an invite to a second school before the multi-school
    // sprint shipped, which overwrote users.school_id and silently dropped
    // their connection to their original studio. We restore by reading the
    // schools.email field as the canonical owner signal.
    const [orphanedOwnerships] = await pool.query(`
      SELECT s.id AS school_id, u.id AS user_id, u.email
        FROM schools s
        JOIN users u ON LOWER(u.email) = LOWER(s.email)
        LEFT JOIN school_memberships sm
          ON sm.user_id = u.id AND sm.school_id = s.id
       WHERE s.deleted_at IS NULL
         AND s.is_active = 1
         AND u.removed_at IS NULL
         AND u.is_active = 1
         AND sm.id IS NULL
    `);
    for (const o of orphanedOwnerships) {
      try {
        await pool.query(
          `INSERT INTO school_memberships (user_id, school_id, role, is_owner, joined_at)
           VALUES (?, ?, 'school_admin', 1, NOW())`,
          [o.user_id, o.school_id]
        );
      } catch (_) { /* uniq key collision = already healed */ }
    }
    if (orphanedOwnerships.length > 0) {
      console.log(`  🩹 Restored ${orphanedOwnerships.length} orphaned ownership(s)`);
    }

    console.log('✅ patchTables complete');
  } catch (err) {
    // Non-fatal — log but don't crash the server
    console.warn('⚠ patchTables warning:', err.message);
  }
}

module.exports = patchTables;
