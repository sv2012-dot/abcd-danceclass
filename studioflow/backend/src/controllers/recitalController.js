const pool = require('../../config/db');

function slugify(str) {
  return (str || '').toLowerCase().trim()
    .replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 80);
}
async function uniqueRecitalSlug(pool, schoolId, title, excludeId = null) {
  let base = slugify(title);
  let slug = base;
  let i = 2;
  while (true) {
    const q = excludeId
      ? 'SELECT id FROM recitals WHERE school_id=? AND slug=? AND id!=? LIMIT 1'
      : 'SELECT id FROM recitals WHERE school_id=? AND slug=? LIMIT 1';
    const params = excludeId ? [schoolId, slug, excludeId] : [schoolId, slug];
    const [rows] = await pool.query(q, params);
    if (!rows[0]) return slug;
    slug = `${base}-${i++}`;
  }
}

exports.list = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT r.*,
        COUNT(rt.id) as task_count,
        SUM(rt.is_done) as tasks_done
      FROM recitals r
      LEFT JOIN recital_tasks rt ON rt.recital_id = r.id
      WHERE r.school_id = ?
      GROUP BY r.id ORDER BY r.event_date DESC
    `, [req.params.schoolId]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.get = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT r.*, s.slug AS school_slug
      FROM recitals r
      JOIN schools s ON s.id = r.school_id
      WHERE r.id = ? AND r.school_id = ?
    `, [req.params.id, req.params.schoolId]);
    if (!rows[0]) return res.status(404).json({ error: 'Recital not found' });
    // Parse important_info JSON array
    const rec = rows[0];
    if (rec.important_info) { try { rec.important_info = JSON.parse(rec.important_info); } catch { rec.important_info = []; } }
    const [tasks] = await pool.query('SELECT * FROM recital_tasks WHERE recital_id = ? ORDER BY sort_order, id', [req.params.id]);
    const [[rsvpRow]] = await pool.query(
      `SELECT
        COUNT(*) AS total,
        SUM(rsvp_status = 'Confirmed') AS confirmed,
        SUM(rsvp_status = 'Declined')  AS declined,
        SUM(rsvp_status = 'Pending')   AS pending
       FROM recital_participants WHERE recital_id = ?`,
      [req.params.id]
    );
    res.json({ ...rec, tasks, rsvp_stats: rsvpRow });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Default "Important information" bullets seeded on every new recital.
// Restored from the original CRA build — teachers were re-typing these
// for every show, and the previous app shipped them by default.
const DEFAULT_IMPORTANT_INFO = [
  'Doors open 30 minutes before showtime',
  'Students must arrive 1 hour early for costume and makeup',
  'Photography and videography by approved vendors only during performance',
  'Reserved seating for family members (2 tickets per student)',
  'Reception to follow in the lobby',
];

exports.create = async (req, res) => {
  // event_time: e.g. "18:00" (stored as VARCHAR, formatted on client)
  const { title, event_date, event_time, venue, status, description, participant_count, tasks, important_info } = req.body;
  if (!title || !event_date) return res.status(400).json({ error: 'Title and event_date required' });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const slug = await uniqueRecitalSlug(pool, req.params.schoolId, title);
    // Seed default Important Information if the caller didn't provide
    // their own list. Store as JSON for parity with /update.
    const infoToStore = JSON.stringify(
      Array.isArray(important_info) && important_info.length > 0
        ? important_info
        : DEFAULT_IMPORTANT_INFO
    );
    const [r] = await conn.query(
      'INSERT INTO recitals (school_id,title,slug,event_date,event_time,venue,status,description,participant_count,important_info) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [req.params.schoolId, title, slug, event_date, event_time||null, venue||null, status||'Planning', description||null, participant_count != null ? Number(participant_count) : null, infoToStore]
    );
    if (tasks && tasks.length) {
      const vals = tasks.map((t, i) => [r.insertId, t.text || t, 0, i]);
      await conn.query('INSERT INTO recital_tasks (recital_id,task_text,is_done,sort_order) VALUES ?', [vals]);
    }
    await conn.commit();
    const [rows] = await pool.query('SELECT * FROM recitals WHERE id = ?', [r.insertId]);
    const [taskRows] = await pool.query('SELECT * FROM recital_tasks WHERE recital_id = ?', [r.insertId]);
    res.status(201).json({ ...rows[0], tasks: taskRows });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally { conn.release(); }
};

exports.update = async (req, res) => {
  const { title, event_date, event_time, venue, status, description, is_featured, participant_count, important_info } = req.body;
  try {
    const [curRows] = await pool.query('SELECT title, slug FROM recitals WHERE id=?', [req.params.id]);
    let slug = curRows[0]?.slug;
    if (!slug || curRows[0]?.title !== title) {
      slug = await uniqueRecitalSlug(pool, req.params.schoolId, title, Number(req.params.id));
    }
    // important_info: store as JSON string if array provided, keep existing if undefined
    const infoVal = important_info !== undefined
      ? (Array.isArray(important_info) ? JSON.stringify(important_info) : important_info)
      : undefined;
    const sets = ['title=?','slug=?','event_date=?','event_time=?','venue=?','status=?','description=?','is_featured=?','participant_count=?'];
    const vals = [title, slug, event_date, event_time||null, venue||null, status||'Planning', description||null, is_featured ? 1 : 0, participant_count != null ? Number(participant_count) : null];
    if (infoVal !== undefined) { sets.push('important_info=?'); vals.push(infoVal); }
    vals.push(req.params.id, req.params.schoolId);
    await pool.query(`UPDATE recitals SET ${sets.join(',')} WHERE id=? AND school_id=?`, vals);
    const [rows] = await pool.query('SELECT * FROM recitals WHERE id = ?', [req.params.id]);
    const rec = rows[0];
    if (rec && rec.important_info) { try { rec.important_info = JSON.parse(rec.important_info); } catch { rec.important_info = []; } }
    res.json(rec);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.remove = async (req, res) => {
  try {
    // Fetch the recital title before deleting so we can clean up the events table
    const [recitalRows] = await pool.query(
      'SELECT title FROM recitals WHERE id = ? AND school_id = ?',
      [req.params.id, req.params.schoolId]
    );
    if (!recitalRows[0]) return res.status(404).json({ error: 'Recital not found' });

    // Delete any matching Recital-type events in the events table (legacy entries)
    await pool.query(
      "DELETE FROM events WHERE school_id = ? AND type = 'Recital' AND LOWER(title) = LOWER(?)",
      [req.params.schoolId, recitalRows[0].title]
    );

    await pool.query('DELETE FROM recitals WHERE id = ? AND school_id = ?', [req.params.id, req.params.schoolId]);
    res.json({ message: 'Recital deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.uploadPoster = async (req, res) => {
  const { poster_url } = req.body;
  if (poster_url === undefined) return res.status(400).json({ error: 'poster_url required' });
  // Allow empty string (removes poster), data URLs (base64), or plain https URLs
  if (poster_url !== '' && !poster_url.startsWith('data:image/') && !poster_url.startsWith('https://')) {
    return res.status(400).json({ error: 'Invalid image format' });
  }
  try {
    await pool.query(
      'UPDATE recitals SET poster_url=? WHERE id=? AND school_id=?',
      [poster_url || null, req.params.id, req.params.schoolId]
    );
    res.json({ poster_url });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.addTask = async (req, res) => {
  const { task_text } = req.body;
  if (!task_text) return res.status(400).json({ error: 'task_text required' });
  try {
    const [r] = await pool.query('INSERT INTO recital_tasks (recital_id,task_text) VALUES (?,?)', [req.params.id, task_text]);
    const [rows] = await pool.query('SELECT * FROM recital_tasks WHERE id = ?', [r.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.toggleTask = async (req, res) => {
  try {
    await pool.query('UPDATE recital_tasks SET is_done = NOT is_done WHERE id = ? AND recital_id = ?', [req.params.taskId, req.params.id]);
    const [rows] = await pool.query('SELECT * FROM recital_tasks WHERE id = ?', [req.params.taskId]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.deleteTask = async (req, res) => {
  try {
    await pool.query('DELETE FROM recital_tasks WHERE id = ? AND recital_id = ?', [req.params.taskId, req.params.id]);
    res.json({ message: 'Task deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ── Participants (Invitees) ────────────────────────────────────────────────────

exports.listParticipants = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM recital_participants WHERE recital_id = ? AND school_id = ? ORDER BY created_at DESC',
      [req.params.id, req.params.schoolId]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.addParticipant = async (req, res) => {
  const { name, email, phone, type, plus_ones, rsvp_status, role } = req.body;
  if (!name && !email) return res.status(400).json({ error: 'Name or email required' });
  try {
    const [r] = await pool.query(
      'INSERT INTO recital_participants (recital_id, school_id, name, email, phone, type, plus_ones, rsvp_status, role) VALUES (?,?,?,?,?,?,?,?,?)',
      [req.params.id, req.params.schoolId, name || '', email ? email.toLowerCase() : null,
       phone || null, type || 'Performer', Number(plus_ones) || 0, rsvp_status || 'Pending', role || null]
    );
    const [rows] = await pool.query('SELECT * FROM recital_participants WHERE id = ?', [r.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ error: 'This email is already added to the recital' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
};

exports.updateParticipantRsvp = async (req, res) => {
  const { name, email, phone, type, plus_ones, rsvp_status, role } = req.body;
  try {
    const sets = ['updated_at=NOW()'];
    const vals = [];
    if (name        !== undefined) { sets.push('name=?');       vals.push(name); }
    if (email       !== undefined) { sets.push('email=?');      vals.push(email ? email.toLowerCase() : null); }
    if (phone       !== undefined) { sets.push('phone=?');      vals.push(phone || null); }
    if (type        !== undefined) { sets.push('type=?');       vals.push(type); }
    if (plus_ones   !== undefined) { sets.push('plus_ones=?');  vals.push(Number(plus_ones)); }
    if (rsvp_status !== undefined) { sets.push('rsvp_status=?'); vals.push(rsvp_status); }
    if (role        !== undefined) { sets.push('role=?');       vals.push(role || null); }
    vals.push(req.params.participantId, req.params.id, req.params.schoolId);
    await pool.query(
      `UPDATE recital_participants SET ${sets.join(',')} WHERE id=? AND recital_id=? AND school_id=?`, vals
    );
    const [rows] = await pool.query('SELECT * FROM recital_participants WHERE id = ?', [req.params.participantId]);
    if (!rows[0]) return res.status(404).json({ error: 'Participant not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.deleteParticipant = async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM recital_participants WHERE id = ? AND recital_id = ? AND school_id = ?',
      [req.params.participantId, req.params.id, req.params.schoolId]
    );
    res.json({ message: 'Participant removed' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};