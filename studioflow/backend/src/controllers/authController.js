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

// Google OAuth Login — accepts either an ID-token credential or an access_token
exports.googleLogin = async (req, res) => {
  const { credential, access_token } = req.body;
  if (!credential && !access_token) {
    return res.status(400).json({ error: 'Google credential or access token required' });
  }

  let email, name, picture;

  try {
    if (credential) {
      // Legacy ID-token flow (GoogleLogin component)
      const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      email   = payload.email;
      name    = payload.name;
      picture = payload.picture;
    } else {
      // Access-token flow (custom button via useGoogleLogin)
      const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      if (!userInfoRes.ok) {
        return res.status(401).json({ error: 'Invalid Google access token' });
      }
      const userInfo = await userInfoRes.json();
      email   = userInfo.email;
      name    = userInfo.name;
      picture = userInfo.picture;
    }

    // Check if user already exists
    const [existingUser] = await pool.query(
      'SELECT id, name, email, role, school_id, is_active FROM users WHERE email = ? AND is_active = 1',
      [email.toLowerCase()]
    );

    if (existingUser[0]) {
      const user = existingUser[0];
      await pool.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);
      const token = signToken(user);
      let school = null;
      if (user.school_id) {
        const [sr] = await pool.query('SELECT id, name, city, dance_style FROM schools WHERE id = ?', [user.school_id]);
        school = sr[0] || null;
      }
      return res.json({ token, user, school });
    }

    // New user — return user data and flag for registration
    res.status(201).json({
      requiresRegistration: true,
      googleData: { name, email: email.toLowerCase(), picture },
    });
  } catch (error) {
    console.error('Google login error:', error);
    res.status(401).json({ error: 'Invalid Google token' });
  }
};

// ── Seed helper — runs AFTER commit using pool directly (never blocks registration) ──
async function seedDummyData(schoolId, danceStyle) {
  const ds      = danceStyle || 'Classical Dance';
  const today   = new Date();
  const addDays = n => { const d = new Date(today); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

  // 2 batches (cover_url added via patchTables — INSERT safely without it if missing)
  let batch1Id, batch2Id;
  try {
    const [b1] = await pool.query(
      'INSERT INTO batches (school_id, name, dance_style, level, teacher_name, max_size, cover_url) VALUES (?,?,?,?,?,?,?)',
      [schoolId, 'Morning Beginners', ds, 'Beginner', 'Your Name', 12,
       '/seeds/Gemini_Generated_Image_pglg7zpglg7zpglg.png']
    );
    batch1Id = b1.insertId;
  } catch {
    const [b1] = await pool.query(
      'INSERT INTO batches (school_id, name, dance_style, level, teacher_name, max_size) VALUES (?,?,?,?,?,?)',
      [schoolId, 'Morning Beginners', ds, 'Beginner', 'Your Name', 12]
    );
    batch1Id = b1.insertId;
  }
  try {
    const [b2] = await pool.query(
      'INSERT INTO batches (school_id, name, dance_style, level, teacher_name, max_size, cover_url) VALUES (?,?,?,?,?,?,?)',
      [schoolId, 'Evening Intermediate', ds, 'Intermediate', 'Your Name', 10,
       '/seeds/Gemini_Generated_Image_uq97ywuq97ywuq97.png']
    );
    batch2Id = b2.insertId;
  } catch {
    const [b2] = await pool.query(
      'INSERT INTO batches (school_id, name, dance_style, level, teacher_name, max_size) VALUES (?,?,?,?,?,?)',
      [schoolId, 'Evening Intermediate', ds, 'Intermediate', 'Your Name', 10]
    );
    batch2Id = b2.insertId;
  }

  // 4 students (2 per batch)
  const students = [
    { name:'Aarav Sharma',  guardian:'Priya Sharma',  phone:'9800000001', batch: batch1Id },
    { name:'Diya Nair',     guardian:'Meena Nair',    phone:'9800000002', batch: batch1Id },
    { name:'Rohan Patel',   guardian:'Suresh Patel',  phone:'9800000003', batch: batch2Id },
    { name:'Ananya Singh',  guardian:'Kavita Singh',  phone:'9800000004', batch: batch2Id },
  ];
  for (const s of students) {
    const [sr] = await pool.query(
      'INSERT INTO students (school_id, name, guardian_name, guardian_phone, join_date) VALUES (?,?,?,?,?)',
      [schoolId, s.name, s.guardian, s.phone, today.toISOString().slice(0, 10)]
    );
    await pool.query(
      'INSERT INTO batch_students (batch_id, student_id) VALUES (?,?)',
      [s.batch, sr.insertId]
    );
  }

  // Schedules — Mon/Wed for batch 1, Tue/Thu for batch 2
  const schedules = [
    { batch: batch1Id, day: 'Mon', start: '09:00', end: '10:00' },
    { batch: batch1Id, day: 'Wed', start: '09:00', end: '10:00' },
    { batch: batch2Id, day: 'Tue', start: '18:00', end: '19:00' },
    { batch: batch2Id, day: 'Thu', start: '18:00', end: '19:00' },
  ];
  for (const s of schedules) {
    await pool.query(
      'INSERT INTO schedules (school_id, batch_id, day_of_week, start_time, end_time) VALUES (?,?,?,?,?)',
      [schoolId, s.batch, s.day, s.start, s.end]
    );
  }

  // 4 recitals — try with poster_url (patchTables column), fall back without
  const recitals = [
    { title:'Annual Day Showcase',    days:14, poster:'/seeds/Gemini_Generated_Image_fx3w4cfx3w4cfx3w.png' },
    { title:'Mid-Season Performance', days:28, poster:'/seeds/Gemini_Generated_Image_8n8ni8n8ni8n8ni8-2.png' },
    { title:'Guest Artist Workshop',  days:42, poster:'/seeds/Kathak-poster.png' },
    { title:'Year-End Recital',       days:56, poster:'/seeds/Gemini_Generated_Image_al11y9al11y9al11.png' },
  ];
  for (const r of recitals) {
    try {
      await pool.query(
        'INSERT INTO recitals (school_id, title, event_date, status, poster_url) VALUES (?,?,?,?,?)',
        [schoolId, r.title, addDays(r.days), 'Planning', r.poster]
      );
    } catch {
      await pool.query(
        'INSERT INTO recitals (school_id, title, event_date, status) VALUES (?,?,?,?)',
        [schoolId, r.title, addDays(r.days), 'Planning']
      );
    }
  }

  // 5 to-do items
  const todos = [
    'Set up your fee plans',
    'Add remaining students to batches',
    'Customize batch schedules',
    'Upload batch cover photos',
    'Share the parent portal link with guardians',
  ];
  for (const title of todos) {
    await pool.query(
      'INSERT INTO todos (school_id, user_id, title) VALUES (?,NULL,?)',
      [schoolId, title]
    );
  }
}

// Exported so superadmin can trigger it on demand
exports.seedSampleData = seedDummyData;

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

    const userId = userResult.insertId;

    await conn.commit();

    // Seed sample data after commit — non-blocking, never fails registration
    seedDummyData(schoolId, danceStyle).catch(err =>
      console.warn('Seed sample data skipped:', err.message)
    );
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