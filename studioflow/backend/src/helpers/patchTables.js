/**
 * patchTables.js
 * Adds tables that were introduced after the initial migration.
 * Uses CREATE TABLE IF NOT EXISTS — safe to run on every startup.
 */
const { pool } = require('../database');

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

    // Add profile_json column to schools if missing (added in a later release)
    await pool.query(`
      ALTER TABLE schools
        ADD COLUMN IF NOT EXISTS profile_json LONGTEXT NULL
    `).catch(() => {
      // ALTER TABLE ... ADD COLUMN IF NOT EXISTS is MySQL 8+ only; silently ignore on older versions
    });

    // Add avatar column to students (added for avatar-picker feature)
    await pool.query(`
      ALTER TABLE students
        ADD COLUMN IF NOT EXISTS avatar VARCHAR(100) NULL
    `).catch(() => {});

    // Add assigned_to column to todos (added for assignee feature)
    await pool.query(`
      ALTER TABLE todos
        ADD COLUMN IF NOT EXISTS assigned_to VARCHAR(100) NULL
    `).catch(() => {});

    console.log('✅ patchTables: todos, studios, schools.profile_json, students.avatar, todos.assigned_to ensured');
  } catch (err) {
    // Non-fatal — log but don't crash the server
    console.warn('⚠ patchTables warning:', err.message);
  }
}

module.exports = patchTables;
