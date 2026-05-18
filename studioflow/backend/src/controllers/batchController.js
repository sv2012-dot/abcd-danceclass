const pool = require('../../config/db');

exports.list = async (req, res) => {
  try {
    // ?include_deleted=true returns soft-deleted batches alongside active
    // ones, each tagged with days_until_purge so the UI can render a
    // countdown badge. Default behavior (no flag) hides soft-deleted.
    const includeDeleted = req.query.include_deleted === 'true' || req.query.include_deleted === '1';
    const where = includeDeleted
      ? 'WHERE b.school_id = ?'
      : 'WHERE b.school_id = ? AND b.deleted_at IS NULL';
    const [rows] = await pool.query(`
      SELECT b.*, COUNT(bs.student_id) as student_count,
             CASE
               WHEN b.deleted_at IS NULL THEN NULL
               ELSE GREATEST(0, 30 - TIMESTAMPDIFF(DAY, b.deleted_at, NOW()))
             END as days_until_purge
      FROM batches b
      LEFT JOIN batch_students bs ON bs.batch_id = b.id
      ${where}
      GROUP BY b.id ORDER BY b.deleted_at IS NULL DESC, b.name
    `, [req.params.schoolId]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Preview what a soft-delete would hide. Used by the confirmation
// dialog so the user sees exactly what's at stake before typing the
// batch name to confirm.
exports.deletePreview = async (req, res) => {
  try {
    const sid = req.params.schoolId;
    const id  = req.params.id;
    const [[b]] = await pool.query('SELECT id, name FROM batches WHERE id = ? AND school_id = ?', [id, sid]);
    if (!b) return res.status(404).json({ error: 'Batch not found' });
    const [[counts]] = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM schedules     WHERE batch_id = ?) AS schedule_count,
        (SELECT COUNT(*) FROM events        WHERE batch_id = ?) AS event_count,
        (SELECT COUNT(*) FROM batch_students WHERE batch_id = ?) AS student_count,
        (SELECT COUNT(*) FROM attendance a
            JOIN events e ON e.id = a.event_id
            WHERE e.batch_id = ?) AS attendance_count
    `, [id, id, id, id]);
    res.json({ batch: b, ...counts });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.get = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM batches WHERE id = ? AND school_id = ?', [req.params.id, req.params.schoolId]);
    if (!rows[0]) return res.status(404).json({ error: 'Batch not found' });
    const [students] = await pool.query(`
      SELECT s.id, s.name, s.age, s.phone, s.avatar FROM students s
      JOIN batch_students bs ON bs.student_id = s.id
      WHERE bs.batch_id = ? AND s.is_active = 1 ORDER BY s.name
    `, [req.params.id]);
    res.json({ ...rows[0], students });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.create = async (req, res) => {
  const { name, dance_style, level, teacher_id, teacher_name, max_size, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'Batch name required' });
  try {
    const [r] = await pool.query(
      'INSERT INTO batches (school_id,name,dance_style,level,teacher_id,teacher_name,max_size,notes) VALUES (?,?,?,?,?,?,?,?)',
      [req.params.schoolId, name, dance_style||null, level||'Beginner', teacher_id||null, teacher_name||null, max_size||null, notes||null]
    );
    const [rows] = await pool.query('SELECT * FROM batches WHERE id = ?', [r.insertId]);
    res.status(201).json({ ...rows[0], student_count: 0 });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.update = async (req, res) => {
  const { name, dance_style, level, teacher_id, teacher_name, max_size, notes, is_active } = req.body;
  try {
    await pool.query(
      'UPDATE batches SET name=?,dance_style=?,level=?,teacher_id=?,teacher_name=?,max_size=?,notes=?,is_active=? WHERE id=? AND school_id=?',
      [name, dance_style||null, level||'Beginner', teacher_id||null, teacher_name||null, max_size||null, notes||null, is_active??1, req.params.id, req.params.schoolId]
    );
    const [rows] = await pool.query('SELECT * FROM batches WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Soft delete — flips is_active = 0 and stamps deleted_at = NOW(). The
// row stays in the DB for 30 days, after which jobs/purgeDeletedBatches
// hard-deletes it + cascades to schedules / events / attendance /
// batch_students. Users can restore via POST /batches/:id/restore.
//
// Cascade hiding (no data loss):
//   - schedules join WHERE b.deleted_at IS NULL → hides this batch's
//     recurring class instances from the calendar immediately
//   - events list filters WHERE batch deleted_at IS NULL → hides
//     one-off events linked to this batch immediately
//   - attendance records stay attached to their events (which are now
//     hidden) — they reappear automatically on restore
exports.remove = async (req, res) => {
  try {
    await pool.query(
      'UPDATE batches SET is_active = 0, deleted_at = NOW() WHERE id = ? AND school_id = ? AND deleted_at IS NULL',
      [req.params.id, req.params.schoolId]
    );
    res.json({ message: 'Batch moved to trash. Will be permanently deleted in 30 days unless restored.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Restore — clears the soft-delete and brings everything back. Safe to
// call within the 30-day window. After that the row is gone and this
// returns 404.
exports.restore = async (req, res) => {
  try {
    const [r] = await pool.query(
      'UPDATE batches SET is_active = 1, deleted_at = NULL WHERE id = ? AND school_id = ? AND deleted_at IS NOT NULL',
      [req.params.id, req.params.schoolId]
    );
    if (r.affectedRows === 0) {
      return res.status(404).json({ error: 'Batch not found or already active.' });
    }
    res.json({ message: 'Batch restored. All schedules, events, and attendance are visible again.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.uploadCover = async (req, res) => {
  const { cover_url } = req.body;
  // Accept a data URL, an empty string (clear), or null
  if (cover_url && !String(cover_url).startsWith('data:image/')) {
    return res.status(400).json({ error: 'cover_url must be a data: image URL or empty' });
  }
  try {
    await pool.query(
      'UPDATE batches SET cover_url = ? WHERE id = ? AND school_id = ?',
      [cover_url || null, req.params.id, req.params.schoolId]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.enroll = async (req, res) => {
  const { student_ids } = req.body;
  if (!Array.isArray(student_ids)) return res.status(400).json({ error: 'student_ids array required' });
  try {
    await pool.query('DELETE FROM batch_students WHERE batch_id = ?', [req.params.id]);
    if (student_ids.length) {
      const vals = student_ids.map(sid => [req.params.id, sid]);
      await pool.query('INSERT IGNORE INTO batch_students (batch_id, student_id) VALUES ?', [vals]);
    }
    res.json({ message: 'Enrolment updated', count: student_ids.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
};