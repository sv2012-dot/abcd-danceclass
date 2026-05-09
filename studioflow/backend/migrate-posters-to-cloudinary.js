/**
 * One-time migration: upload all base64 poster_url values to Cloudinary
 * and replace them with the returned https:// URL across all schools.
 *
 * Usage:
 *   node migrate-posters-to-cloudinary.js
 *
 * Requires the same .env file used by the backend (DB_* + CLOUDINARY_* vars).
 */

require('dotenv').config();
const mysql      = require('mysql2/promise');
const cloudinary = require('cloudinary').v2;

// ── Cloudinary config ────────────────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ── DB pool ──────────────────────────────────────────────────────────────────
const pool = mysql.createPool({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT) || 3306,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASS,
  waitForConnections: true,
  connectionLimit: 5,
  ssl: { rejectUnauthorized: false },
});

// ── Main ─────────────────────────────────────────────────────────────────────
async function run() {
  const conn = await pool.getConnection();
  try {
    // Find every recital that still has a base64 poster
    const [rows] = await conn.query(
      `SELECT id, school_id, title, LENGTH(poster_url) AS bytes
       FROM recitals
       WHERE poster_url LIKE 'data:image/%'
       ORDER BY school_id, id`
    );

    if (rows.length === 0) {
      console.log('✅  No base64 posters found — nothing to migrate.');
      return;
    }

    console.log(`Found ${rows.length} recital(s) with base64 posters. Starting migration…\n`);

    let ok = 0, fail = 0;

    for (const row of rows) {
      const label = `[school ${row.school_id}] recital ${row.id} "${row.title}"`;
      const kb    = Math.round(row.bytes / 1024);
      process.stdout.write(`  ${label}  (${kb} KB) … `);

      try {
        // Re-fetch the full poster_url for this row (LENGTH() was just for display)
        const [[full]] = await conn.query(
          'SELECT poster_url FROM recitals WHERE id = ? LIMIT 1', [row.id]
        );

        const result = await cloudinary.uploader.upload(full.poster_url, {
          folder:        'recital-posters',
          resource_type: 'image',
          transformation: [
            { width: 1200, height: 630, crop: 'fill', quality: 'auto:good', fetch_format: 'auto' },
          ],
        });

        await conn.query(
          'UPDATE recitals SET poster_url = ? WHERE id = ?',
          [result.secure_url, row.id]
        );

        console.log(`✅  ${result.secure_url}`);
        ok++;
      } catch (err) {
        console.log(`❌  ${err.message}`);
        fail++;
      }
    }

    console.log(`\nDone — ${ok} migrated, ${fail} failed.`);

  } finally {
    conn.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
