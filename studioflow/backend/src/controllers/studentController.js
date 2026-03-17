const pool = require('../../config/db');

// Strip time so MySQL DATE column always receives 'YYYY-MM-DD'
const toDate = v => (v ? String(v).split('T')[0] : null);

exports.list = async (req, res) => {
  const schoolId = req.params.schoolId;
  try {
    const [rows] = await pool.query(`
      SELECT s.*,
        GROUP_CONCAT(b.name ORDER BY b.name SEPARATOR ", ") as batches,
        GROUP_CONCAT(b.id   ORDER BY b.name SEPARATOR ",")  as batch_ids,
        sf_cur.status   as current_fee_status,
        sf_cur.id       as current_fee_id,
        sf_cur.due_date as current_fee_due
      FROM students s
      LEFT JOIN batch_students bs ON bs.student_id = s.id
      LEFT JOIN batches b ON b.id = bs.batch_id
      LEFT JOIN student_fees sf_cur
             ON sf_cur.student_id = s.id
            AND sf_cur.school_id  = s.school_id
            AND DATE_FORMAT(sf_cur.due_date,'%Y-%m') = DATE_FORMAT(CURDATE(),'%Y-%m')
      WHERE s.school_id = ? AND s.is_active = 1
      GROUP BY s.id, sf_cur.status, sf_cur.id, sf_cur.due_date ORDER BY s.name
    `, [schoolId]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.get = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM students WHERE id = ? AND school_id = ?', [req.params.id, req.params.schoolId]);
    if (!rows[0]) return res.status(404).json({ error: 'Student not found' });
    const [batches] = await pool.query(`
      SELECT b.id, b.name, b.dance_style, b.level FROM batches b
      JOIN batch_students bs ON bs.batch_id = b.id WHERE bs.student_id = ?
    `, [req.params.id]);
    const [fees] = await pool.query('SELECT * FROM student_fees WHERE student_id = ? ORDER BY due_date DESC LIMIT 12', [req.params.id]);
    res.json({ ...rows[0], batches, fees });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.create = async (req, res) => {
  const { school_id, name, age, phone, email, guardian_name, guardian_phone, guardian_email, join_date, notes, avatar } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  try {
    const [r] = await pool.query(
      'INSERT INTO students (school_id,name,age,phone,email,guardian_name,guardian_phone,guardian_email,join_date,notes,avatar) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [school_id || req.params.schoolId, name, age||null, phone||null, email||null, guardian_name||null, guardian_phone||null, guardian_email||null, toDate(join_date), notes||null, avatar||null]
    );
    const [rows] = await pool.query('SELECT * FROM students WHERE id = ?', [r.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.update = async (req, res) => {
  const { name, age, phone, email, guardian_name, guardian_phone, guardian_email, join_date, notes, is_active, avatar } = req.body;
  try {
    await pool.query(
      'UPDATE students SET name=?,age=?,phone=?,email=?,guardian_name=?,guardian_phone=?,guardian_email=?,join_date=?,notes=?,is_active=?,avatar=? WHERE id=? AND school_id=?',
      [name, age||null, phone||null, email||null, guardian_name||null, guardian_phone||null, guardian_email||null, toDate(join_date), notes||null, is_active??1, avatar||null, req.params.id, req.params.schoolId]
    );
    const [rows] = await pool.query('SELECT * FROM students WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.setBatches = async (req, res) => {
  const { batch_ids = [] } = req.body;
  const studentId = Number(req.params.id);
  const schoolId  = Number(req.params.schoolId);
  try {
    // Remove student from every batch belonging to this school
    await pool.query(
      `DELETE bs FROM batch_students bs
       JOIN batches b ON b.id = bs.batch_id
       WHERE bs.student_id = ? AND b.school_id = ?`,
      [studentId, schoolId]
    );
    // Re-enroll in selected batches
    if (batch_ids.length > 0) {
      const vals = batch_ids.map(bid => [Number(bid), studentId]);
      await pool.query('INSERT IGNORE INTO batch_students (batch_id, student_id) VALUES ?', [vals]);
    }
    res.json({ message: 'Enrollment updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.remove = async (req, res) => {
  try {
    await pool.query('UPDATE students SET is_active = 0 WHERE id = ? AND school_id = ?', [req.params.id, req.params.schoolId]);
    res.json({ message: 'Student removed' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
