const pool = require('../../config/db');

exports.list = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT b.*, COUNT(bs.student_id) as student_count
      FROM batches b
      LEFT JOIN batch_students bs ON bs.batch_id = b.id
      WHERE b.school_id = ? AND b.is_active = 1
      GROUP BY b.id ORDER BY b.name
    `, [req.params.schoolId]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.get = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM batches WHERE id = ? AND school_id = ?', [req.params.id, req.params.schoolId]);
    if (!rows[0]) return res.status(404).json({ error: 'Batch not found' });
    const [students] = await pool.query(`
      SELECT s.id, s.name, s.age, s.phone FROM students s
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

exports.remove = async (req, res) => {
  try {
    await pool.query('UPDATE batches SET is_active = 0 WHERE id = ? AND school_id = ?', [req.params.id, req.params.schoolId]);
    res.json({ message: 'Batch deleted' });
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