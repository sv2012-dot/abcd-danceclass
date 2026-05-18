// jobs/purgeDeletedBatches.js
//
// Hard-deletes batches that were soft-deleted more than 30 days ago,
// plus all of their dependent rows (schedules, events, attendance,
// batch_students). Runs as a Railway cron job once a day. Idempotent
// — safe to run multiple times; nothing happens if no batches qualify.
//
// Entry point: `node src/jobs/purgeDeletedBatches.js`
//   Set this as the cron command on Railway.
//
// To dry-run locally:
//   node src/jobs/purgeDeletedBatches.js --dry-run
//
// Logs to stdout. On any error mid-transaction it rolls back and exits 1
// so Railway marks the run as failed.

require('dotenv').config({ path: '.env.railway' });

const pool = require('../../config/db');

const RETENTION_DAYS = 30;
const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  const conn = await pool.getConnection();
  try {
    // Find candidates first so we can log + return counts.
    const [candidates] = await conn.query(`
      SELECT id, school_id, name, deleted_at
        FROM batches
       WHERE deleted_at IS NOT NULL
         AND deleted_at < (NOW() - INTERVAL ${RETENTION_DAYS} DAY)
    `);

    if (candidates.length === 0) {
      console.log('[purge-batches] No batches to purge.');
      return { purged: 0, candidates: [] };
    }

    console.log(`[purge-batches] ${DRY_RUN ? '[DRY RUN] ' : ''}Found ${candidates.length} batch(es) past retention:`);
    for (const c of candidates) {
      console.log(`  - id=${c.id} school=${c.school_id} name="${c.name}" deleted_at=${c.deleted_at.toISOString()}`);
    }

    if (DRY_RUN) {
      console.log('[purge-batches] Dry run — no rows deleted.');
      return { purged: 0, candidates };
    }

    await conn.beginTransaction();
    const ids = candidates.map(c => c.id);

    // Order matters — children before parents.
    //
    // 1. attendance rows attached to this batch's events
    const [attRes] = await conn.query(
      `DELETE a FROM attendance a
        JOIN events e ON e.id = a.event_id
       WHERE e.batch_id IN (?)`,
      [ids]
    );
    // 2. batch_students junction rows
    const [bsRes] = await conn.query(
      `DELETE FROM batch_students WHERE batch_id IN (?)`,
      [ids]
    );
    // 3. events linked to this batch (one-off events)
    const [evRes] = await conn.query(
      `DELETE FROM events WHERE batch_id IN (?)`,
      [ids]
    );
    // 4. schedule_exceptions linked to this batch's schedules
    const [seRes] = await conn.query(
      `DELETE se FROM schedule_exceptions se
        JOIN schedules sc ON sc.id = se.schedule_id
       WHERE sc.batch_id IN (?)`,
      [ids]
    ).catch(() => [{ affectedRows: 0 }]); // table may not exist on older deploys
    // 5. schedules (recurring class definitions)
    const [scRes] = await conn.query(
      `DELETE FROM schedules WHERE batch_id IN (?)`,
      [ids]
    );
    // 6. the batches themselves
    const [bRes] = await conn.query(
      `DELETE FROM batches WHERE id IN (?)`,
      [ids]
    );

    await conn.commit();

    console.log('[purge-batches] Done. Rows removed:', {
      attendance:           attRes.affectedRows,
      batch_students:       bsRes.affectedRows,
      events:               evRes.affectedRows,
      schedule_exceptions:  seRes.affectedRows,
      schedules:            scRes.affectedRows,
      batches:              bRes.affectedRows,
    });

    return { purged: bRes.affectedRows, candidates };
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    console.error('[purge-batches] FAILED:', err);
    throw err;
  } finally {
    conn.release();
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { main };
