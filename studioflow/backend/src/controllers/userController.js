const pool = require('../../config/db');
const bcrypt = require('bcryptjs');

exports.list = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id,name,email,role,school_id,is_active,last_login,created_at FROM users WHERE school_id = ? ORDER BY name',
      [req.params.schoolId]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.create = async (req, res) => {
  const { name, email, password, role, student_id } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password required' });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const hash = bcrypt.hashSync(password, 10);
    const [r] = await conn.query(
      'INSERT INTO users (name,email,password,role,school_id) VALUES (?,?,?,?,?)',
      [name, email.toLowerCase(), hash, role||'parent', req.params.schoolId]
    );
    if ((role === 'parent' || !role) && student_id) {
      await conn.query('INSERT IGNORE INTO parent_students (parent_id,student_id) VALUES (?,?)', [r.insertId, student_id]);
    }
    await conn.commit();
    const [rows] = await pool.query('SELECT id,name,email,role,school_id,is_active,created_at FROM users WHERE id = ?', [r.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Email already registered' });
    res.status(500).json({ error: err.message });
  } finally { conn.release(); }
};

exports.update = async (req, res) => {
  const { name, email, role, is_active, password } = req.body;
  try {
    if (password) {
      const hash = bcrypt.hashSync(password, 10);
      await pool.query('UPDATE users SET name=?,email=?,role=?,is_active=?,password=? WHERE id=? AND school_id=?',
        [name, email, role, is_active??1, hash, req.params.id, req.params.schoolId]);
    } else {
      await pool.query('UPDATE users SET name=?,email=?,role=?,is_active=? WHERE id=? AND school_id=?',
        [name, email, role, is_active??1, req.params.id, req.params.schoolId]);
    }
    const [rows] = await pool.query('SELECT id,name,email,role,school_id,is_active FROM users WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.parentStudents = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT s.*, GROUP_CONCAT(b.name SEPARATOR ", ") as batches
      FROM students s
      JOIN parent_students ps ON ps.student_id = s.id
      LEFT JOIN batch_students bs ON bs.student_id = s.id
      LEFT JOIN batches b ON b.id = bs.batch_id
      WHERE ps.parent_id = ?
      GROUP BY s.id
    `, [req.user.id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
};