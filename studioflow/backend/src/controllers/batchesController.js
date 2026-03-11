const { pool } = require('../database');

const list = async (req, res) => {
  try {
    const [batches] = await pool.query(
      `SELECT b.*,
        COUNT(DISTINCT bs.student_id) as enrolled_count,
        u.name as teacher_user_name
       FROM batches b
       LEFT JOIN batch_students bs ON bs.batch_id = b.id
       LEFT JOIN users u ON u.id = b.teacher_id
       WHERE b.school_id = ? AND b.is_active = 1
       GROUP BY b.id ORDER BY b.name`,
      [req.params.schoolId]
    );
    res.json({ batches });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
};

const get = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT b.*, COUNT(DISTINCT bs.student_id) as enrolled_count
       FROM batches b
       LEFT JOIN batch_students bs ON bs.batch_id = b.id
       WHERE b.id = ? AND b.school_id = ?
       GROUP BY b.id`, [req.params.batchId, req.params.schoolId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Batch not found' });

    const [students] = await pool.query(
      `SELECT s.* FROM students s
       JOIN batch_students bs ON bs.student_id = s.id
       WHERE bs.batch_id = ? AND s.is_active = 1 ORDER BY s.name`,
      [req.params.batchId]
    );
    res.json({ batch: rows[0], students });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
};

const create = async (req, res) => {
  try {
    const { name, dance_style, level, teacher_id, teacher_name, max_size, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'Batch name required' });
    const [result] = await pool.query(
      `INSERT INTO batches (school_id, name, dance_style, level, teacher_id, teacher_name, max_size, notes)
       VALUES (?,?,?,?,?,?,?,?)`,
      [req.params.schoolId, name, dance_style||null, level||'Beginner', teacher_id||null, teacher_name||null, max_size||null, notes||null]
    );
    const [batch] = await pool.query('SELECT * FROM batches WHERE id = ?', [result.insertId]);
    res.status(201).json({ batch: batch[0] });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
};

const update = async (req, res) => {
  try {
    const { name, dance_style, level, teacher_id, teacher_name, max_size, notes, is_active } = req.body;
    await pool.query(
      `UPDATE batches SET name=COALESCE(?,name), dance_style=COALESCE(?,dance_style),
       level=COALESCE(?,level), teacher_id=COALESCE(?,teacher_id),
       teacher_name=COALESCE(?,teacher_name), max_size=COALESCE(?,max_size),
       notes=COALESCE(?,notes), is_active=COALESCE(?,is_active)
       WHERE id=? AND school_id=?`,
      [name,dance_style,level,teacher_id,teacher_name,max_size,notes,is_active, req.params.batchId, req.params.schoolId]
    );
    const [updated] = await pool.query('SELECT * FROM batches WHERE id=?', [req.params.batchId]);
    res.json({ batch: updated[0] });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
};

const remove = async (req, res) => {
  try {
    await pool.query('UPDATE batches SET is_active=0 WHERE id=? AND school_id=?', [req.params.batchId, req.params.schoolId]);
    res.json({ message: 'Batch removed' });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
};

const enrol = async (req, res) => {
  try {
    const { student_ids, action = 'add' } = req.body;
    if (!student_ids?.length) return res.status(400).json({ error: 'student_ids required' });
    if (action === 'remove') {
      await pool.query(`DELETE FROM batch_students WHERE batch_id=? AND student_id IN (?)`, [req.params.batchId, student_ids]);
    } else {
      const values = student_ids.map(id => [req.params.batchId, id]);
      await pool.query(`INSERT IGNORE INTO batch_students (batch_id, student_id) VALUES ?`, [values]);
    }
    res.json({ message: `Students ${action === 'remove' ? 'removed from' : 'added to'} batch` });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
};

module.exports = { list, get, create, update, remove, enrol };
