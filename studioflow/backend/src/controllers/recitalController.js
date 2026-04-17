const pool = require('../../config/db');

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
    const [rows] = await pool.query('SELECT * FROM recitals WHERE id = ? AND school_id = ?', [req.params.id, req.params.schoolId]);
    if (!rows[0]) return res.status(404).json({ error: 'Recital not found' });
    const [tasks] = await pool.query('SELECT * FROM recital_tasks WHERE recital_id = ? ORDER BY sort_order, id', [req.params.id]);
    res.json({ ...rows[0], tasks });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.create = async (req, res) => {
  // event_time: e.g. "18:00" (stored as VARCHAR, formatted on client)
  const { title, event_date, event_time, venue, status, description, tasks } = req.body;
  if (!title || !event_date) return res.status(400).json({ error: 'Title and event_date required' });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [r] = await conn.query(
      'INSERT INTO recitals (school_id,title,event_date,event_time,venue,status,description) VALUES (?,?,?,?,?,?,?)',
      [req.params.schoolId, title, event_date, event_time||null, venue||null, status||'Planning', description||null]
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
  const { title, event_date, event_time, venue, status, description, is_featured } = req.body;
  try {
    await pool.query(
      'UPDATE recitals SET title=?,event_date=?,event_time=?,venue=?,status=?,description=?,is_featured=? WHERE id=? AND school_id=?',
      [title, event_date, event_time||null, venue||null, status||'Planning', description||null, is_featured ? 1 : 0, req.params.id, req.params.schoolId]
    );
    const [rows] = await pool.query('SELECT * FROM recitals WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
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