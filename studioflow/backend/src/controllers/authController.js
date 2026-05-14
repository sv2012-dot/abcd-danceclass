const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const pool = require('../../config/db');
const { OAuth2Client } = require('google-auth-library');
const {
  sendWelcomeEmail,
  sendMagicLinkEmail,
} = require('../services/emailService');

// Magic-link config
const MAGIC_LINK_TTL_MIN = 15;
const CHOOSER_TTL_MIN    = 10;
const APP_URL = () =>
  (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');

function generateToken() {
  return crypto.randomBytes(32).toString('hex'); // 64 chars
}

async function buildSchool(schoolId) {
  if (!schoolId) return null;
  const [sr] = await pool.query(
    'SELECT id, name, city, dance_style FROM schools WHERE id = ?',
    [schoolId]
  );
  return sr[0] || null;
}

// Fetch all ACTIVE memberships for a user (joined to school info).
// Filters out memberships pointing at soft-deleted schools.
async function fetchActiveMemberships(userId) {
  const [rows] = await pool.query(
    `SELECT sm.school_id, sm.role, sm.is_owner, sm.last_used_at, sm.joined_at,
            s.name AS school_name, s.city AS school_city,
            s.dance_style, s.plan_tier, s.trial_ends_at,
            s.stripe_subscription_id, s.current_period_end
       FROM school_memberships sm
       JOIN schools s ON s.id = sm.school_id
      WHERE sm.user_id = ?
        AND sm.removed_at IS NULL
        AND s.deleted_at IS NULL
        AND s.is_active = 1
      ORDER BY sm.last_used_at IS NULL, sm.last_used_at DESC, sm.joined_at DESC`,
    [userId]
  );
  return rows;
}

// Issue a full session JWT scoped to a specific membership.
// Also mirrors role+school_id onto users (legacy fields) and bumps last_used_at.
async function issueScopedToken(user, membership) {
  // Mirror onto users for backward compat with code that still reads
  // req.user.school_id / req.user.role
  await pool.query(
    `UPDATE users SET school_id = ?, role = ?, is_owner = ?,
                       last_login = NOW(), last_sign_in_at = NOW()
       WHERE id = ?`,
    [membership.school_id, membership.role, membership.is_owner ? 1 : 0, user.id]
  );
  await pool.query(
    `UPDATE school_memberships SET last_used_at = NOW()
       WHERE user_id = ? AND school_id = ?`,
    [user.id, membership.school_id]
  );
  const tokenUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: membership.role,
    school_id: membership.school_id,
    is_owner: membership.is_owner ? 1 : 0,
  };
  return jwt.sign(
    tokenUser,
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

// Issue a short-lived chooser token so the frontend can show the chooser
// screen and POST back a selected school_id.
async function issueChooserToken(userId) {
  const token = generateToken();
  await pool.query(
    `INSERT INTO chooser_tokens (token, user_id, expires_at)
     VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
    [token, userId, CHOOSER_TTL_MIN]
  );
  return token;
}

// After any successful auth event, branch on membership count.
//   0  → orphan account (no school) — sign in anyway, no school context
//   1  → issue full scoped JWT, return { token, user, school }
//   N  → issue chooser token, return { requires_choice, chooser_token, memberships }
//
// `superadmin` users bypass this entirely — they have cross-school access by
// role and don't need memberships (handled by callers).
async function finalizeAuth(user) {
  const memberships = await fetchActiveMemberships(user.id);

  if (memberships.length === 0) {
    // Orphan — user exists but isn't in any school. Issue a token without
    // a school context. They probably want /register, but we leave that
    // decision to the frontend.
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role || 'orphan' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
    return { token, user: { ...user, school_id: null, role: 'orphan' }, school: null, memberships: [] };
  }

  if (memberships.length === 1) {
    const m = memberships[0];
    const token = await issueScopedToken(user, m);
    const school = await buildSchool(m.school_id);
    return {
      token,
      user: { ...user, school_id: m.school_id, role: m.role, is_owner: m.is_owner },
      school,
      memberships,
    };
  }

  // 2+ memberships → require a choice
  const chooser_token = await issueChooserToken(user.id);
  return {
    requires_choice: true,
    chooser_token,
    memberships,
    user: { id: user.id, email: user.email, name: user.name },
  };
}

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
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE email = ? AND is_active = 1 AND removed_at IS NULL',
      [email.toLowerCase()]
    );
    const user = rows[0];
    if (!user || !user.password || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    delete user.password;
    if (user.role === 'superadmin') {
      // Superadmins bypass memberships and the chooser
      await pool.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);
      const token = signToken(user);
      return res.json({ token, user });
    }
    const result = await finalizeAuth(user);
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.me = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, name, email, role, school_id, is_active, is_owner,
              email_verified_at, last_login, last_sign_in_at, created_at
       FROM users WHERE id = ?`,
      [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    const user = rows[0];
    const school = await buildSchool(user.school_id);
    // Memberships: only relevant for non-superadmins. Used by the sidebar's
    // "Switch school" link and by the team page.
    let memberships = [];
    if (user.role !== 'superadmin') {
      memberships = await fetchActiveMemberships(user.id);
    }
    res.json({ user, school, memberships });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// POST /auth/choose-school { chooser_token, school_id }
// Consumes a chooser token and issues a full JWT scoped to the chosen school.
// Also used by the in-app "Switch school" link.
exports.chooseSchool = async (req, res) => {
  const ct = String(req.body.chooser_token || '').trim();
  const sid = Number(req.body.school_id);
  if (!ct || !sid) return res.status(400).json({ error: 'chooser_token and school_id required.' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [tokens] = await conn.query(
      `SELECT id, user_id, expires_at, consumed_at FROM chooser_tokens WHERE token = ? LIMIT 1`,
      [ct]
    );
    const tok = tokens[0];
    if (!tok)                              { await conn.rollback(); return res.status(400).json({ error: 'Invalid chooser token.' }); }
    if (tok.consumed_at)                   { await conn.rollback(); return res.status(400).json({ error: 'Chooser link already used.' }); }
    if (new Date(tok.expires_at) < new Date()) {
      await conn.rollback();
      return res.status(400).json({ error: 'Chooser link expired. Sign in again.' });
    }

    await conn.query('UPDATE chooser_tokens SET consumed_at = NOW() WHERE id = ?', [tok.id]);

    // Verify the user actually has an active membership for the requested school
    const [memRows] = await conn.query(
      `SELECT sm.school_id, sm.role, sm.is_owner
         FROM school_memberships sm
         JOIN schools s ON s.id = sm.school_id
        WHERE sm.user_id = ?
          AND sm.school_id = ?
          AND sm.removed_at IS NULL
          AND s.deleted_at IS NULL
          AND s.is_active = 1
        LIMIT 1`,
      [tok.user_id, sid]
    );
    const m = memRows[0];
    if (!m) {
      await conn.rollback();
      return res.status(403).json({ error: 'You do not have access to that school.' });
    }

    const [userRows] = await conn.query(
      `SELECT id, name, email, role FROM users WHERE id = ?`,
      [tok.user_id]
    );
    const user = userRows[0];

    const token = await issueScopedToken(user, m);
    const school = await buildSchool(m.school_id);

    await conn.commit();
    res.json({
      token,
      user: { ...user, school_id: m.school_id, role: m.role, is_owner: m.is_owner },
      school,
    });
  } catch (err) {
    await conn.rollback();
    console.error('chooseSchool error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
};

// POST /auth/switch-school — for already-signed-in users who want to swap
// schools without having to re-do the magic-link dance. Issues a chooser
// token bound to the current JWT user, so the frontend can redirect to
// /auth/choose-school.
exports.requestSwitch = async (req, res) => {
  try {
    const chooser_token = await issueChooserToken(req.user.id);
    const memberships = await fetchActiveMemberships(req.user.id);
    res.json({ chooser_token, memberships });
  } catch (err) {
    console.error('requestSwitch error:', err);
    res.status(500).json({ error: err.message });
  }
};

// ──────────────────────────────────────────────────────────────────────
// Magic-link auth
// ──────────────────────────────────────────────────────────────────────
//
// POST /auth/magic-link
//   Body: { email }
//   Always returns 200 (no email enumeration). If the email is known, send
//   a sign-in link. If unknown, silently no-op so attackers can't probe.
exports.requestMagicLink = async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    // Still 200 — same shape, don't help bots
    return res.json({ message: 'If that email is on ManchQ, a link is on its way.' });
  }
  try {
    const [rows] = await pool.query(
      'SELECT id FROM users WHERE email = ? AND is_active = 1 AND removed_at IS NULL',
      [email]
    );
    if (rows[0]) {
      const token = generateToken();
      await pool.query(
        `INSERT INTO magic_tokens (token, email, purpose, expires_at)
         VALUES (?, ?, 'signin', DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
        [token, email, MAGIC_LINK_TTL_MIN]
      );
      const link = `${APP_URL()}/auth/magic?token=${token}`;
      sendMagicLinkEmail(email, link).catch(err =>
        console.error('Magic-link email failed:', err.message)
      );
    }
    return res.json({ message: 'If that email is on ManchQ, a link is on its way.' });
  } catch (err) {
    console.error('requestMagicLink error:', err);
    res.status(500).json({ error: err.message });
  }
};

// POST /auth/magic-link/consume
//   Body: { token }
//   Consumes a single-use magic token. For purpose='invite', also runs the
//   invitation-accept side effects (attach to school, set role).
exports.consumeMagicLink = async (req, res) => {
  const token = String(req.body.token || '').trim();
  if (!token) return res.status(400).json({ error: 'Token required' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      `SELECT id, token, email, purpose, school_id, role, expires_at, consumed_at
       FROM magic_tokens WHERE token = ? LIMIT 1`,
      [token]
    );
    const t = rows[0];
    if (!t) {
      await conn.rollback();
      return res.status(400).json({ error: 'Invalid or expired link.' });
    }
    if (t.consumed_at) {
      await conn.rollback();
      return res.status(400).json({ error: 'This link has already been used.' });
    }
    if (new Date(t.expires_at).getTime() < Date.now()) {
      await conn.rollback();
      return res.status(400).json({ error: 'This link has expired. Request a new one.' });
    }

    // Mark consumed immediately to make it single-use
    await conn.query(
      'UPDATE magic_tokens SET consumed_at = NOW() WHERE id = ?',
      [t.id]
    );

    // Find or create the user
    const email = t.email.toLowerCase();
    let [users] = await conn.query(
      'SELECT id, name, email, role, school_id, is_active, is_owner FROM users WHERE email = ? LIMIT 1',
      [email]
    );
    let user = users[0];

    if (!user) {
      // Only invite-purpose tokens may create a brand-new user.
      if (t.purpose !== 'invite') {
        await conn.commit();
        return res.status(404).json({ error: 'No account found for this email.' });
      }
      const defaultName = email.split('@')[0];
      const [ins] = await conn.query(
        `INSERT INTO users (name, email, role, school_id, is_active, email_verified_at)
         VALUES (?, ?, ?, ?, 1, NOW())`,
        [defaultName, email, t.role || 'teacher', t.school_id]
      );
      [users] = await conn.query(
        'SELECT id, name, email, role, school_id, is_active, is_owner FROM users WHERE id = ?',
        [ins.insertId]
      );
      user = users[0];
    } else {
      // Existing user — just refresh sign-in timestamps. The invite-attach
      // logic below now inserts a NEW membership instead of overwriting the
      // user's school_id, so multi-school users keep their existing schools.
      await conn.query(
        `UPDATE users SET
           email_verified_at = COALESCE(email_verified_at, NOW()),
           last_sign_in_at   = NOW(),
           last_login        = NOW()
         WHERE id = ?`,
        [user.id]
      );
    }

    // INVITE path: insert a school_memberships row (idempotent on the
    // unique (user_id, school_id) constraint — if they already had a
    // removed membership, un-remove it).
    let acceptedSchoolId = null;
    if (t.purpose === 'invite' && t.school_id) {
      const role = t.role || 'teacher';
      const [existing] = await conn.query(
        `SELECT id, removed_at FROM school_memberships
          WHERE user_id = ? AND school_id = ? LIMIT 1`,
        [user.id, t.school_id]
      );
      if (existing[0]) {
        // Re-activate / update existing membership (was removed previously)
        await conn.query(
          `UPDATE school_memberships
              SET role = ?, is_owner = 0, removed_at = NULL, joined_at = COALESCE(joined_at, NOW())
            WHERE id = ?`,
          [role, existing[0].id]
        );
      } else {
        await conn.query(
          `INSERT INTO school_memberships (user_id, school_id, role, is_owner, joined_at)
           VALUES (?, ?, ?, 0, NOW())`,
          [user.id, t.school_id, role]
        );
      }
      // For brand-new users (no other memberships), set users.school_id so
      // finalizeAuth can drop them straight in. For existing multi-school
      // users, finalizeAuth will route them through the chooser.
      const [[cnt]] = await conn.query(
        `SELECT COUNT(*) AS n FROM school_memberships
          WHERE user_id = ? AND removed_at IS NULL`,
        [user.id]
      );
      if (cnt.n === 1) {
        await conn.query('UPDATE users SET school_id = ?, role = ? WHERE id = ?',
          [t.school_id, role, user.id]);
        user.school_id = t.school_id;
        user.role = role;
      }
      acceptedSchoolId = t.school_id;

      await conn.query(
        `UPDATE invitations SET status='accepted', accepted_at = NOW()
         WHERE token = ? AND status = 'pending'`,
        [t.token]
      );
    }

    await conn.commit();

    // Superadmins bypass the chooser
    if (user.role === 'superadmin') {
      const token_jwt = signToken(user);
      return res.json({ token: token_jwt, user });
    }

    // Hand off to finalizeAuth — handles 0 / 1 / N membership branching.
    // If this was an invite accept and the user has multiple memberships,
    // we still want to land them in the school they just joined, so we
    // hint that via accepted_school_id.
    const result = await finalizeAuth(user);
    if (acceptedSchoolId && result.requires_choice) {
      result.accepted_school_id = acceptedSchoolId;
    }
    res.json(result);
  } catch (err) {
    await conn.rollback();
    console.error('consumeMagicLink error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
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
      if (user.role === 'superadmin') {
        await pool.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);
        const token = signToken(user);
        return res.json({ token, user });
      }
      const result = await finalizeAuth(user);
      return res.json(result);
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
      'INSERT INTO todos (school_id, title) VALUES (?,?)',
      [schoolId, title]
    );
  }
}

// Exported so superadmin can trigger it on demand
exports.seedSampleData = seedDummyData;

// Register School (Self-Service)
//
// Accepts EITHER:
//   - { ownerName, ownerEmail, schoolName, city?, danceStyle? }  → email path
//     (no password; we send a magic-link for first sign-in)
//   - { ownerName, schoolName, city?, danceStyle?, google_access_token }
//     → Google path (verifies the token, extracts a trusted email)
//
// If the resolved email already has a user account, we DO NOT silently merge.
// We return { existing_user: true, schools: [...] } so the frontend can
// explicitly ask the user whether they meant to register another studio or
// sign in. The caller re-submits with `acknowledge_existing: true` to proceed.
exports.registerSchool = async (req, res) => {
  let { ownerName, ownerEmail, schoolName, city, danceStyle,
        google_access_token, acknowledge_existing } = req.body;

  if (!schoolName || !ownerName) {
    return res.status(400).json({ error: 'Owner name and school name are required.' });
  }

  // If a Google token is supplied, that's our source of email + name.
  if (google_access_token) {
    try {
      const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${google_access_token}` },
      });
      if (!userInfoRes.ok) {
        return res.status(401).json({ error: 'Google sign-in failed. Please try again.' });
      }
      const userInfo = await userInfoRes.json();
      ownerEmail = (userInfo.email || '').toLowerCase();
      // Prefer the Google name only if no name was provided
      if (!ownerName || !ownerName.trim()) ownerName = userInfo.name || ownerEmail.split('@')[0];
    } catch (e) {
      return res.status(401).json({ error: 'Could not verify Google sign-in.' });
    }
  }

  if (!ownerEmail) {
    return res.status(400).json({ error: 'Owner email is required.' });
  }
  ownerEmail = ownerEmail.toLowerCase();

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Check if this email already has an account on ManchQ
    const [existingUsers] = await conn.query(
      `SELECT id, name, email FROM users WHERE email = ? LIMIT 1`,
      [ownerEmail]
    );
    if (existingUsers[0] && !acknowledge_existing) {
      // Surface their existing schools so the UI can show a confirm dialog
      const [memberships] = await conn.query(
        `SELECT s.name AS school_name, s.city AS school_city
           FROM school_memberships sm
           JOIN schools s ON s.id = sm.school_id
          WHERE sm.user_id = ? AND sm.removed_at IS NULL
            AND s.deleted_at IS NULL AND s.is_active = 1`,
        [existingUsers[0].id]
      );
      await conn.rollback();
      return res.status(200).json({
        existing_user: true,
        email: ownerEmail,
        schools: memberships,
        message: 'This email already has an account on ManchQ.',
      });
    }

    // Create school — new schools start with a 30-day trial of paid features
    // (plan_tier='paid' + trial_ends_at). When trial expires they drop to
    // 'free' on the fly via the effectivePlan() helper.
    const [schoolResult] = await conn.query(
      `INSERT INTO schools (name, owner_name, email, city, dance_style, is_active, plan_tier, trial_ends_at)
       VALUES (?, ?, ?, ?, ?, 1, 'paid', DATE_ADD(NOW(), INTERVAL 30 DAY))`,
      [schoolName, ownerName, ownerEmail, city || null, danceStyle || null]
    );

    const schoolId = schoolResult.insertId;

    // If this email already has a user (multi-school case), reuse it.
    // Otherwise, create a new user.
    let userId;
    const [existing] = await conn.query(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      [ownerEmail.toLowerCase()]
    );
    if (existing[0]) {
      userId = existing[0].id;
      // Mirror the new school onto the user record (legacy fields).
      await conn.query(
        `UPDATE users SET school_id = ?, role = 'school_admin', is_owner = 1,
                            email_verified_at = COALESCE(email_verified_at, NOW())
           WHERE id = ?`,
        [schoolId, userId]
      );
    } else {
      const [userResult] = await conn.query(
        `INSERT INTO users (name, email, role, school_id, is_active, is_owner, email_verified_at)
         VALUES (?, ?, 'school_admin', ?, 1, 1, NOW())`,
        [ownerName, ownerEmail.toLowerCase(), schoolId]
      );
      userId = userResult.insertId;
    }

    // Owner membership for the new school
    await conn.query(
      `INSERT INTO school_memberships (user_id, school_id, role, is_owner, joined_at)
       VALUES (?, ?, 'school_admin', 1, NOW())`,
      [userId, schoolId]
    );

    await conn.commit();

    // Seed sample data after commit — non-blocking, never fails registration
    seedDummyData(schoolId, danceStyle).catch(err =>
      console.warn('Seed sample data skipped:', err.message)
    );

    // Send welcome email asynchronously (don't wait for it)
    sendWelcomeEmail(schoolName, ownerEmail, ownerName, schoolId).catch(error => {
      console.error('Welcome email failed (non-blocking):', error.message);
    });

    const userObj = {
      id: userId,
      name: ownerName,
      email: ownerEmail,
      role: 'school_admin',
      school_id: schoolId,
      is_active: 1,
      is_owner: 1,
    };

    // Google path → already verified email, sign them in immediately.
    // Email path → send a magic-link sign-in so the email gets verified,
    //              return "check your inbox" instead of a JWT.
    if (google_access_token) {
      const result = await finalizeAuth(userObj);
      return res.status(201).json({
        ...result,
        message: 'School registered successfully!',
      });
    }

    // Email path → issue a magic-link sign-in to verify the email
    const linkToken = generateToken();
    await pool.query(
      `INSERT INTO magic_tokens (token, email, purpose, expires_at)
       VALUES (?, ?, 'signin', DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
      [linkToken, ownerEmail, MAGIC_LINK_TTL_MIN]
    );
    const link = `${APP_URL()}/auth/magic?token=${linkToken}`;
    sendMagicLinkEmail(ownerEmail, link).catch(err =>
      console.error('Welcome magic-link email failed:', err.message)
    );

    return res.status(201).json({
      magic_link_sent: true,
      email: ownerEmail,
      school: { id: schoolId, name: schoolName },
      message: 'School created. Check your inbox to sign in.',
    });
  } catch (error) {
    await conn.rollback();
    console.error('Register school error:', error);
    res.status(500).json({ error: error.message });
  } finally {
    await conn.release();
  }
};