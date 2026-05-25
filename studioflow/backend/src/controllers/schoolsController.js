const { pool } = require('../database');
const bcrypt = require('bcryptjs');

const list = async (req, res) => {
  try {
    const [schools] = await pool.query(
      `SELECT s.*,
        (SELECT COUNT(*) FROM students WHERE school_id = s.id AND is_active=1) as student_count,
        (SELECT COUNT(*) FROM batches  WHERE school_id = s.id AND is_active=1) as batch_count
       FROM schools s ORDER BY s.name`
    );
    res.json({ schools });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
};

const get = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT s.*,
        (SELECT COUNT(*) FROM students WHERE school_id = s.id AND is_active=1) as student_count,
        (SELECT COUNT(*) FROM batches  WHERE school_id = s.id AND is_active=1) as batch_count,
        (SELECT COUNT(*) FROM schedules WHERE school_id = s.id AND is_active=1) as schedule_count,
        (SELECT COUNT(*) FROM recitals  WHERE school_id = s.id AND event_date >= CURDATE()) as upcoming_recitals
       FROM schools s WHERE s.id = ?`, [req.params.schoolId]
    );
    if (!rows.length) return res.status(404).json({ error: 'School not found' });
    res.json({ school: rows[0] });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
};

const create = async (req, res) => {
  try {
    const { name, owner_name, email, phone, city, address, dance_style, admin_email, admin_password } = req.body;
    if (!name || !owner_name) return res.status(400).json({ error: 'Name and owner required' });
    const [result] = await pool.query(
      `INSERT INTO schools (name, owner_name, email, phone, city, address, dance_style) VALUES (?,?,?,?,?,?,?)`,
      [name, owner_name, email||null, phone||null, city||null, address||null, dance_style||null]
    );
    const schoolId = result.insertId;
    // Create school admin user
    if (admin_email && admin_password) {
      const hashed = await bcrypt.hash(admin_password, 12);
      await pool.query(
        `INSERT INTO users (name, email, password, role, school_id) VALUES (?,?,?,'school_admin',?)`,
        [owner_name, admin_email, hashed, schoolId]
      );
    }
    const [newSchool] = await pool.query('SELECT * FROM schools WHERE id = ?', [schoolId]);
    res.status(201).json({ school: newSchool[0] });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Email already exists' });
    res.status(500).json({ error: 'Server error' });
  }
};

const update = async (req, res) => {
  try {
    const {
      name, owner_name, email, phone, city, address, dance_style, is_active, profile_json,
      // Free-form public-contact fields (Team page → Public Contact).
      // Passed independently of owner_name/email/phone above. An explicit
      // empty string clears the value (NULLIF) so admins can blank them
      // out; an undefined leaves the existing value untouched.
      public_contact_name, public_contact_email, public_contact_phone,
    } = req.body;
    const pj = profile_json !== undefined ? JSON.stringify(profile_json) : null;
    // Helper: pick the new value if defined (incl. empty string → NULL),
    // otherwise pass null so COALESCE keeps the existing column value.
    const newOrKeep = (v) => v === undefined ? null : (v === '' ? null : v);
    const pcName  = public_contact_name  !== undefined ? newOrKeep(public_contact_name)  : undefined;
    const pcEmail = public_contact_email !== undefined ? newOrKeep(public_contact_email) : undefined;
    const pcPhone = public_contact_phone !== undefined ? newOrKeep(public_contact_phone) : undefined;
    await pool.query(
      `UPDATE schools SET
        name=COALESCE(?,name), owner_name=COALESCE(?,owner_name),
        email=COALESCE(?,email), phone=COALESCE(?,phone), city=COALESCE(?,city),
        address=COALESCE(?,address), dance_style=COALESCE(?,dance_style),
        is_active=COALESCE(?,is_active),
        profile_json=IF(? IS NOT NULL, ?, profile_json),
        public_contact_name  = IF(? = 1, ?, public_contact_name),
        public_contact_email = IF(? = 1, ?, public_contact_email),
        public_contact_phone = IF(? = 1, ?, public_contact_phone)
       WHERE id=?`,
      [
        name, owner_name, email, phone, city, address, dance_style, is_active, pj, pj,
        public_contact_name  !== undefined ? 1 : 0, pcName,
        public_contact_email !== undefined ? 1 : 0, pcEmail,
        public_contact_phone !== undefined ? 1 : 0, pcPhone,
        req.params.schoolId,
      ]
    );
    const [updated] = await pool.query('SELECT * FROM schools WHERE id=?', [req.params.schoolId]);
    res.json({ school: updated[0] });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
};

const remove = async (req, res) => {
  try {
    await pool.query('UPDATE schools SET is_active = 0 WHERE id = ?', [req.params.schoolId]);
    res.json({ message: 'School deactivated' });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
};

module.exports = { list, get, create, update, remove };
