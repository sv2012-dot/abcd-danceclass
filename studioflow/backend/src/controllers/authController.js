const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../../config/db');
const { OAuth2Client } = require('google-auth-library');
const { sendWelcomeEmail } = require('../services/emailService');

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

// Google OAuth Login
exports.googleLogin = async (req, res) => {
  const { credential } = req.body;
  if (!credential) return res.status(400).json({ error: 'Google credential token required' });

  try {
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

    // Verify the token
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const googleUser = ticket.getPayload();
    const { email, name, picture } = googleUser;

    // Check if user already exists
    const [existingUser] = await pool.query(
      'SELECT id, name, email, role, school_id, is_active FROM users WHERE email = ? AND is_active = 1',
      [email.toLowerCase()]
    );

    if (existingUser[0]) {
      // Existing user - return token
      const user = existingUser[0];
      await pool.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);

      const token = signToken(user);

      // Fetch school info if user has one
      let school = null;
      if (user.school_id) {
        const [sr] = await pool.query('SELECT id, name, city, dance_style FROM schools WHERE id = ?', [user.school_id]);
        school = sr[0] || null;
      }

      return res.json({ token, user, school });
    }

    // New user - return user data and flag for registration
    res.status(201).json({
      requiresRegistration: true,
      googleData: {
        name,
        email: email.toLowerCase(),
        picture,
      },
    });
  } catch (error) {
    console.error('Google login error:', error);
    res.status(401).json({ error: 'Invalid Google token' });
  }
};

// Register School (Self-Service)
exports.registerSchool = async (req, res) => {
  const { ownerName, ownerEmail, schoolName, city, danceStyle } = req.body;

  // Validation
  if (!ownerEmail || !ownerName || !schoolName) {
    return res.status(400).json({ error: 'Owner email, name, and school name are required' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Check if email already exists
    const [existingEmail] = await conn.query('SELECT id FROM users WHERE email = ?', [ownerEmail.toLowerCase()]);
    if (existingEmail[0]) {
      await conn.rollback();
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Create school
    const [schoolResult] = await conn.query(
      'INSERT INTO schools (name, owner_name, email, city, dance_style, is_active) VALUES (?, ?, ?, ?, ?, 1)',
      [schoolName, ownerName, ownerEmail, city || null, danceStyle || null]
    );

    const schoolId = schoolResult.insertId;

    // Create admin user with random password (Google OAuth users)
    const randomPassword = require('crypto').randomBytes(16).toString('hex');
    const hashedPassword = bcrypt.hashSync(randomPassword, 10);

    const [userResult] = await conn.query(
      'INSERT INTO users (name, email, password, role, school_id, is_active) VALUES (?, ?, ?, ?, ?, 1)',
      [ownerName, ownerEmail.toLowerCase(), hashedPassword, 'school_admin', schoolId]
    );

    await conn.commit();

    const userId = userResult.insertId;
    const user = {
      id: userId,
      name: ownerName,
      email: ownerEmail.toLowerCase(),
      role: 'school_admin',
      school_id: schoolId,
      is_active: 1,
    };

    const school = {
      id: schoolId,
      name: schoolName,
      owner_name: ownerName,
      email: ownerEmail,
      city: city || null,
      dance_style: danceStyle || null,
    };

    // Generate token
    const token = signToken(user);

    // Send welcome email asynchronously (don't wait for it)
    sendWelcomeEmail(schoolName, ownerEmail, ownerName, schoolId).catch(error => {
      console.error('Welcome email failed (non-blocking):', error.message);
    });

    res.status(201).json({
      token,
      user,
      school,
      message: 'School registered successfully! Welcome email sent.',
    });
  } catch (error) {
    await conn.rollback();
    console.error('Register school error:', error);
    res.status(500).json({ error: error.message });
  } finally {
    await conn.release();
  }
};