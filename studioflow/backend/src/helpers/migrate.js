require('dotenv').config();
const pool = require('../../config/db');

async function migrate() {
  const conn = await pool.getConnection();
  try {
    console.log('🔧 Running migrations...');
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');

    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name         VARCHAR(120)  NOT NULL,
        email        VARCHAR(180)  NOT NULL UNIQUE,
        password     VARCHAR(255)  NOT NULL,
        role         ENUM('superadmin','school_admin','teacher','parent') NOT NULL DEFAULT 'parent',
        school_id    INT UNSIGNED  NULL,
        is_active    TINYINT(1)    NOT NULL DEFAULT 1,
        last_login   DATETIME      NULL,
        created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS schools (
        id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name         VARCHAR(180)  NOT NULL,
        owner_name   VARCHAR(120)  NOT NULL,
        email        VARCHAR(180)  NULL,
        phone        VARCHAR(40)   NULL,
        city         VARCHAR(80)   NULL,
        address      TEXT          NULL,
        dance_style  VARCHAR(80)   NULL,
        is_active    TINYINT(1)    NOT NULL DEFAULT 1,
        created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS students (
        id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        school_id       INT UNSIGNED NOT NULL,
        name            VARCHAR(120) NOT NULL,
        age             TINYINT UNSIGNED NULL,
        phone           VARCHAR(40)  NULL,
        email           VARCHAR(180) NULL,
        guardian_name   VARCHAR(120) NULL,
        guardian_phone  VARCHAR(40)  NULL,
        guardian_email  VARCHAR(180) NULL,
        join_date       DATE         NULL,
        is_active       TINYINT(1)   NOT NULL DEFAULT 1,
        notes           TEXT         NULL,
        created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_school (school_id),
        FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS batches (
        id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        school_id    INT UNSIGNED NOT NULL,
        name         VARCHAR(120) NOT NULL,
        dance_style  VARCHAR(80)  NULL,
        level        ENUM('Beginner','Intermediate','Advanced','Mixed') NOT NULL DEFAULT 'Beginner',
        teacher_id   INT UNSIGNED NULL,
        teacher_name VARCHAR(120) NULL,
        max_size     TINYINT UNSIGNED NULL,
        notes        TEXT         NULL,
        is_active    TINYINT(1)   NOT NULL DEFAULT 1,
        created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_school (school_id),
        FOREIGN KEY (school_id)  REFERENCES schools(id) ON DELETE CASCADE,
        FOREIGN KEY (teacher_id) REFERENCES users(id)   ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS batch_students (
        id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        batch_id    INT UNSIGNED NOT NULL,
        student_id  INT UNSIGNED NOT NULL,
        enrolled_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_batch_student (batch_id, student_id),
        FOREIGN KEY (batch_id)   REFERENCES batches(id)  ON DELETE CASCADE,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS schedules (
        id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        school_id    INT UNSIGNED NOT NULL,
        batch_id     INT UNSIGNED NOT NULL,
        day_of_week  ENUM('Mon','Tue','Wed','Thu','Fri','Sat','Sun') NOT NULL,
        start_time   TIME NOT NULL,
        end_time     TIME NOT NULL,
        room         VARCHAR(80)  NULL,
        frequency    ENUM('Weekly','Bi-weekly','Monthly') NOT NULL DEFAULT 'Weekly',
        notes        TEXT         NULL,
        is_active    TINYINT(1)   NOT NULL DEFAULT 1,
        created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_school (school_id),
        FOREIGN KEY (school_id) REFERENCES schools(id)  ON DELETE CASCADE,
        FOREIGN KEY (batch_id)  REFERENCES batches(id)  ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS recitals (
        id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        school_id    INT UNSIGNED NOT NULL,
        title        VARCHAR(180) NOT NULL,
        event_date   DATE         NOT NULL,
        venue        VARCHAR(180) NULL,
        status       ENUM('Planning','Confirmed','Rehearsals','Completed','Cancelled') NOT NULL DEFAULT 'Planning',
        description  TEXT         NULL,
        created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_school (school_id),
        FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS recital_tasks (
        id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        recital_id  INT UNSIGNED NOT NULL,
        task_text   VARCHAR(255) NOT NULL,
        is_done     TINYINT(1)   NOT NULL DEFAULT 0,
        sort_order  SMALLINT     NOT NULL DEFAULT 0,
        created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (recital_id) REFERENCES recitals(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS fee_plans (
        id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        school_id   INT UNSIGNED NOT NULL,
        name        VARCHAR(120) NOT NULL,
        amount      DECIMAL(10,2) NOT NULL,
        currency    VARCHAR(5)   NOT NULL DEFAULT 'USD',
        period      ENUM('Monthly','Term','Annual','One-time') NOT NULL DEFAULT 'Monthly',
        description TEXT         NULL,
        is_active   TINYINT(1)   NOT NULL DEFAULT 1,
        created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_school (school_id),
        FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS student_fees (
        id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        school_id    INT UNSIGNED NOT NULL,
        student_id   INT UNSIGNED NOT NULL,
        fee_plan_id  INT UNSIGNED NULL,
        amount       DECIMAL(10,2) NOT NULL,
        currency     VARCHAR(5)   NOT NULL DEFAULT 'USD',
        due_date     DATE         NOT NULL,
        paid_date    DATE         NULL,
        status       ENUM('Pending','Paid','Overdue','Waived') NOT NULL DEFAULT 'Pending',
        notes        TEXT         NULL,
        created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_school   (school_id),
        INDEX idx_student  (student_id),
        INDEX idx_status   (status),
        FOREIGN KEY (school_id)  REFERENCES schools(id)   ON DELETE CASCADE,
        FOREIGN KEY (student_id) REFERENCES students(id)  ON DELETE CASCADE,
        FOREIGN KEY (fee_plan_id) REFERENCES fee_plans(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS parent_students (
        id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        parent_id   INT UNSIGNED NOT NULL,
        student_id  INT UNSIGNED NOT NULL,
        UNIQUE KEY uq_parent_student (parent_id, student_id),
        FOREIGN KEY (parent_id)  REFERENCES users(id)    ON DELETE CASCADE,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

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
        INDEX idx_school      (school_id),
        INDEX idx_start       (start_datetime),
        FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
        FOREIGN KEY (batch_id)  REFERENCES batches(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

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

    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('✅ All tables created successfully.');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    conn.release();
    pool.end();
  }
}

migrate();
