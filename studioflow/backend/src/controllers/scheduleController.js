const pool = require('../../config/db');

exports.list = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT sc.*, b.name as batch_name, b.dance_style, b.level
      FROM schedules sc JOIN batches b ON b.id = sc.batch_id
      WHERE sc.school_id = ?
      ORDER BY FIELD(sc.day_of_week,'Mon','Tue','Wed','Thu','Fri','Sat','Sun'), sc.start_time
    `, [req.params.schoolId]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.create = async (req, res) => {
  const { batch_id, day_of_week, start_time, end_time, room, frequency, notes } = req.body;
  if (!batch_id || !day_of_week || !start_time || !end_time) return res.status(400).json({ error: 'batch_id, day_of_week, start_time, end_time required' });
  try {
    const [r] = await pool.query(
      'INSERT INTO schedules (school_id,batch_id,day_of_week,start_time,end_time,room,frequency,notes) VALUES (?,?,?,?,?,?,?,?)',
      [req.params.schoolId, batch_id, day_of_week, start_time, end_time, room||null, frequency||'Weekly', notes||null]
    );
    const [rows] = await pool.query(`
      SELECT sc.*, b.name as batch_name, b.dance_style, b.level
      FROM schedules sc JOIN batches b ON b.id = sc.batch_id WHERE sc.id = ?
    `, [r.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.update = async (req, res) => {
  const { batch_id, day_of_week, start_time, end_time, room, frequency, notes } = req.body;
  try {
    await pool.query(
      'UPDATE schedules SET batch_id=?,day_of_week=?,start_time=?,end_time=?,room=?,frequency=?,notes=? WHERE id=? AND school_id=?',
      [batch_id, day_of_week, start_time, end_time, room||null, frequency||'Weekly', notes||null, req.params.id, req.params.schoolId]
    );
    const [rows] = await pool.query(`
      SELECT sc.*, b.name as batch_name FROM schedules sc JOIN batches b ON b.id = sc.batch_id WHERE sc.id = ?
    `, [req.params.id]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.remove = async (req, res) => {
  try {
    await pool.query('DELETE FROM schedules WHERE id = ? AND school_id = ?', [req.params.id, req.params.schoolId]);
    res.json({ message: 'Schedule deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};