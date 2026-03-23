const pool = require('../../config/db');
const bcrypt = require('bcryptjs');

exports.list = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT s.*,
        COUNT(DISTINCT st.id) as student_count,
        COUNT(DISTINCT b.id)  as batch_count,
        u.id    as admin_id,
        u.name  as admin_name,
        u.email as admin_email
      FROM schools s
      LEFT JOIN students st ON st.school_id = s.id AND st.is_active = 1
      LEFT JOIN batches  b  ON b.school_id  = s.id AND b.is_active  = 1
      LEFT JOIN users    u  ON u.school_id  = s.id AND u.role = 'school_admin'
      GROUP BY s.id, u.id, u.name, u.email
      ORDER BY s.created_at DESC
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.resetAdminPassword = async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  try {
    const hash = bcrypt.hashSync(password, 10);
    const [result] = await pool.query(
      `UPDATE users SET password = ? WHERE school_id = ? AND role = 'school_admin'`,
      [hash, req.params.id]
    );
    if (result.affectedRows === 0)
      return res.status(404).json({ error: 'No admin user found for this school' });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.get = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM schools WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'School not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.create = async (req, res) => {
  const { name, owner_name, email, phone, city, address, dance_style, admin_email, admin_password } = req.body;
  if (!name || !owner_name) return res.status(400).json({ error: 'Name and owner name required' });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [sr] = await conn.query(
      'INSERT INTO schools (name,owner_name,email,phone,city,address,dance_style) VALUES (?,?,?,?,?,?,?)',
      [name, owner_name, email, phone, city, address, dance_style]
    );
    const schoolId = sr.insertId;
    if (admin_email && admin_password) {
      const hash = bcrypt.hashSync(admin_password, 10);
      await conn.query('INSERT INTO users (name,email,password,role,school_id) VALUES (?,?,?,?,?)',
        [owner_name, admin_email, hash, 'school_admin', schoolId]);
    }
    await conn.commit();
    const [newSchool] = await pool.query('SELECT * FROM schools WHERE id = ?', [schoolId]);
    res.status(201).json(newSchool[0]);
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally { conn.release(); }
};

exports.update = async (req, res) => {
  const { name, owner_name, email, phone, city, address, dance_style, is_active } = req.body;
  try {
    await pool.query(
      'UPDATE schools SET name=?,owner_name=?,email=?,phone=?,city=?,address=?,dance_style=?,is_active=? WHERE id=?',
      [name, owner_name, email, phone, city, address, dance_style, is_active ?? 1, req.params.id]
    );
    const [rows] = await pool.query('SELECT * FROM schools WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.stats = async (req, res) => {
  const id = req.params.id;
  try {
    const [[students]] = await pool.query('SELECT COUNT(*) as count FROM students WHERE school_id=? AND is_active=1', [id]);
    const [[batches]] = await pool.query('SELECT COUNT(*) as count FROM batches WHERE school_id=? AND is_active=1', [id]);
    const [[schedules]] = await pool.query('SELECT COUNT(*) as count FROM schedules WHERE school_id=? AND is_active=1', [id]);
    const [[recitals]] = await pool.query('SELECT COUNT(*) as count FROM recitals WHERE school_id=? AND status NOT IN ("Completed","Cancelled")', [id]);
    const [[fees]] = await pool.query('SELECT COALESCE(SUM(amount),0) as total FROM student_fees WHERE school_id=? AND status="Paid"', [id]);
    const [[pending]] = await pool.query('SELECT COALESCE(SUM(amount),0) as total FROM student_fees WHERE school_id=? AND status="Pending"', [id]);
    res.json({
      students: students.count, batches: batches.count,
      schedules: schedules.count, upcoming_recitals: recitals.count,
      fees_collected: parseFloat(fees.total), fees_pending: parseFloat(pending.total)
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
};