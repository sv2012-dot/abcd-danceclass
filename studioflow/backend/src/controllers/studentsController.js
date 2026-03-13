const { pool } = require('../database');

// Strip time component so MySQL DATE column always receives 'YYYY-MM-DD'
const toDateOnly = v => (v ? String(v).split('T')[0] : null);

const list = async (req, res) => {
  try {
    const { search, batch_id, active = 1 } = req.query;
    let sql = `SELECT s.*,
      GROUP_CONCAT(b.name ORDER BY b.name SEPARATOR ', ') as batch_names,
      GROUP_CONCAT(b.id ORDER BY b.id SEPARATOR ',') as batch_ids
      FROM students s
      LEFT JOIN batch_students bs ON bs.student_id = s.id
      LEFT JOIN batches b ON b.id = bs.batch_id AND b.is_active = 1
      WHERE s.school_id = ? AND s.is_active = ?`;
    const params = [req.params.schoolId, parseInt(active)];
    if (search) { sql += ' AND s.name LIKE ?'; params.push(`%${search}%`); }
    if (batch_id) { sql += ' AND bs.batch_id = ?'; params.push(batch_id); }
    sql += ' GROUP BY s.id ORDER BY s.name';
    const [students] = await pool.query(sql, params);
    res.json({ students });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
};

const get = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT s.*,
        GROUP_CONCAT(b.name ORDER BY b.name SEPARATOR ', ') as batch_names
       FROM students s
       LEFT JOIN batch_students bs ON bs.student_id = s.id
       LEFT JOIN batches b ON b.id = bs.batch_id
       WHERE s.id = ? AND s.school_id = ?
       GROUP BY s.id`,
      [req.params.studentId, req.params.schoolId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Student not found' });

    // Get fee summary
    const [fees] = await pool.query(
      `SELECT status, COUNT(*) as count, SUM(amount) as total
       FROM student_fees WHERE student_id = ? GROUP BY status`,
      [req.params.studentId]
    );
    res.json({ student: rows[0], fees });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
};

const create = async (req, res) => {
  try {
    const { name, age, phone, email, guardian_name, guardian_phone, guardian_email, join_date, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'Student name required' });
    const [result] = await pool.query(
      `INSERT INTO students (school_id, name, age, phone, email, guardian_name, guardian_phone, guardian_email, join_date, notes)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [req.params.schoolId, name, age||null, phone||null, email||null, guardian_name||null, guardian_phone||null, guardian_email||null, toDateOnly(join_date), notes||null]
    );
    const [student] = await pool.query('SELECT * FROM students WHERE id = ?', [result.insertId]);
    res.status(201).json({ student: student[0] });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
};

const update = async (req, res) => {
  try {
    const { name, age, phone, email, guardian_name, guardian_phone, guardian_email, join_date, notes, is_active } = req.body;
    await pool.query(
      `UPDATE students SET
        name=COALESCE(?,name), age=COALESCE(?,age), phone=COALESCE(?,phone),
        email=COALESCE(?,email), guardian_name=COALESCE(?,guardian_name),
        guardian_phone=COALESCE(?,guardian_phone), guardian_email=COALESCE(?,guardian_email),
        join_date=COALESCE(?,join_date), notes=COALESCE(?,notes),
        is_active=COALESCE(?,is_active)
       WHERE id = ? AND school_id = ?`,
      [name,age,phone,email,guardian_name,guardian_phone,guardian_email,toDateOnly(join_date),notes,is_active, req.params.studentId, req.params.schoolId]
    );
    const [updated] = await pool.query('SELECT * FROM students WHERE id = ?', [req.params.studentId]);
    res.json({ student: updated[0] });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
};

const remove = async (req, res) => {
  try {
    await pool.query('UPDATE students SET is_active = 0 WHERE id = ? AND school_id = ?', [req.params.studentId, req.params.schoolId]);
    res.json({ message: 'Student removed' });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
};

module.exports = { list, get, create, update, remove };
