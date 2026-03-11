const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../../config/db');

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, school_id: user.school_id, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

exports.login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ? AND is_active = 1', [email.toLowerCase()]);
    const user = rows[0];
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    await pool.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);
    const token = signToken(user);
    delete user.password;
    res.json({ token, user });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.me = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, email, role, school_id, is_active, last_login, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    let school = null;
    if (rows[0].school_id) {
      const [sr] = await pool.query('SELECT id, name, city, dance_style FROM schools WHERE id = ?', [rows[0].school_id]);
      school = sr[0] || null;
    }
    res.json({ user: rows[0], school });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.changePassword = async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) return res.status(400).json({ error: 'Both passwords required' });
  if (new_password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  try {
    const [rows] = await pool.query('SELECT password FROM users WHERE id = ?', [req.user.id]);
    if (!bcrypt.compareSync(current_password, rows[0].password)) {
      return res.status(401).json({ error: 'Current password incorrect' });
    }
    const hashed = bcrypt.hashSync(new_password, 10);
    await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashed, req.user.id]);
    res.json({ message: 'Password changed successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};