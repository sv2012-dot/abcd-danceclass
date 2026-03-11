const { pool } = require('../database');

// ── SCHEDULES ──────────────────────────────────────────────────────────────
const schedulesList = async (req, res) => {
  try {
    const [schedules] = await pool.query(
      `SELECT sc.*, b.name as batch_name, b.dance_style, b.level
       FROM schedules sc JOIN batches b ON b.id = sc.batch_id
       WHERE sc.school_id = ? AND sc.is_active = 1
       ORDER BY FIELD(sc.day_of_week,'Mon','Tue','Wed','Thu','Fri','Sat','Sun'), sc.start_time`,
      [req.params.schoolId]
    );
    res.json({ schedules });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
};

const schedulesCreate = async (req, res) => {
  try {
    const { batch_id, day_of_week, start_time, end_time, room, frequency, notes } = req.body;
    if (!batch_id || !day_of_week || !start_time || !end_time) {
      return res.status(400).json({ error: 'batch_id, day, start_time, end_time required' });
    }
    const [result] = await pool.query(
      `INSERT INTO schedules (school_id, batch_id, day_of_week, start_time, end_time, room, frequency, notes)
       VALUES (?,?,?,?,?,?,?,?)`,
      [req.params.schoolId, batch_id, day_of_week, start_time, end_time, room||null, frequency||'Weekly', notes||null]
    );
    const [s] = await pool.query(
      `SELECT sc.*, b.name as batch_name FROM schedules sc JOIN batches b ON b.id=sc.batch_id WHERE sc.id=?`,
      [result.insertId]
    );
    res.status(201).json({ schedule: s[0] });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
};

const schedulesUpdate = async (req, res) => {
  try {
    const { batch_id, day_of_week, start_time, end_time, room, frequency, notes, is_active } = req.body;
    await pool.query(
      `UPDATE schedules SET batch_id=COALESCE(?,batch_id), day_of_week=COALESCE(?,day_of_week),
       start_time=COALESCE(?,start_time), end_time=COALESCE(?,end_time),
       room=COALESCE(?,room), frequency=COALESCE(?,frequency), notes=COALESCE(?,notes),
       is_active=COALESCE(?,is_active) WHERE id=? AND school_id=?`,
      [batch_id,day_of_week,start_time,end_time,room,frequency,notes,is_active, req.params.scheduleId, req.params.schoolId]
    );
    const [updated] = await pool.query(
      `SELECT sc.*, b.name as batch_name FROM schedules sc JOIN batches b ON b.id=sc.batch_id WHERE sc.id=?`,
      [req.params.scheduleId]
    );
    res.json({ schedule: updated[0] });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
};

const schedulesDelete = async (req, res) => {
  try {
    await pool.query('UPDATE schedules SET is_active=0 WHERE id=? AND school_id=?', [req.params.scheduleId, req.params.schoolId]);
    res.json({ message: 'Schedule removed' });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
};

// ── RECITALS ───────────────────────────────────────────────────────────────
const recitalsList = async (req, res) => {
  try {
    const [recitals] = await pool.query(
      `SELECT r.*,
        COUNT(rt.id) as task_count,
        SUM(rt.is_done) as tasks_done
       FROM recitals r LEFT JOIN recital_tasks rt ON rt.recital_id = r.id
       WHERE r.school_id = ? GROUP BY r.id ORDER BY r.event_date DESC`,
      [req.params.schoolId]
    );
    res.json({ recitals });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
};

const recitalsGet = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM recitals WHERE id=? AND school_id=?', [req.params.recitalId, req.params.schoolId]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const [tasks] = await pool.query('SELECT * FROM recital_tasks WHERE recital_id=? ORDER BY sort_order, id', [req.params.recitalId]);
    res.json({ recital: rows[0], tasks });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
};

const recitalsCreate = async (req, res) => {
  try {
    const { title, event_date, venue, status, description, tasks } = req.body;
    if (!title || !event_date) return res.status(400).json({ error: 'Title and date required' });
    const [result] = await pool.query(
      `INSERT INTO recitals (school_id, title, event_date, venue, status, description) VALUES (?,?,?,?,?,?)`,
      [req.params.schoolId, title, event_date, venue||null, status||'Planning', description||null]
    );
    const recitalId = result.insertId;
    if (tasks?.length) {
      const vals = tasks.map((t, i) => [recitalId, t.text || t, 0, i]);
      await pool.query('INSERT INTO recital_tasks (recital_id, task_text, is_done, sort_order) VALUES ?', [vals]);
    }
    const [recital] = await pool.query('SELECT * FROM recitals WHERE id=?', [recitalId]);
    const [taskRows] = await pool.query('SELECT * FROM recital_tasks WHERE recital_id=? ORDER BY sort_order', [recitalId]);
    res.status(201).json({ recital: recital[0], tasks: taskRows });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
};

const recitalsUpdate = async (req, res) => {
  try {
    const { title, event_date, venue, status, description } = req.body;
    await pool.query(
      `UPDATE recitals SET title=COALESCE(?,title), event_date=COALESCE(?,event_date),
       venue=COALESCE(?,venue), status=COALESCE(?,status), description=COALESCE(?,description)
       WHERE id=? AND school_id=?`,
      [title,event_date,venue,status,description, req.params.recitalId, req.params.schoolId]
    );
    const [updated] = await pool.query('SELECT * FROM recitals WHERE id=?', [req.params.recitalId]);
    res.json({ recital: updated[0] });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
};

const recitalsDelete = async (req, res) => {
  try {
    await pool.query('DELETE FROM recitals WHERE id=? AND school_id=?', [req.params.recitalId, req.params.schoolId]);
    res.json({ message: 'Recital deleted' });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
};

const taskCreate = async (req, res) => {
  try {
    const { task_text } = req.body;
    if (!task_text) return res.status(400).json({ error: 'task_text required' });
    const [[{maxOrder}]] = await pool.query('SELECT MAX(sort_order) as maxOrder FROM recital_tasks WHERE recital_id=?', [req.params.recitalId]);
    const [result] = await pool.query(
      'INSERT INTO recital_tasks (recital_id, task_text, sort_order) VALUES (?,?,?)',
      [req.params.recitalId, task_text, (maxOrder||0)+1]
    );
    const [task] = await pool.query('SELECT * FROM recital_tasks WHERE id=?', [result.insertId]);
    res.status(201).json({ task: task[0] });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
};

const taskUpdate = async (req, res) => {
  try {
    const { task_text, is_done } = req.body;
    await pool.query(
      'UPDATE recital_tasks SET task_text=COALESCE(?,task_text), is_done=COALESCE(?,is_done) WHERE id=? AND recital_id=?',
      [task_text, is_done !== undefined ? (is_done ? 1 : 0) : null, req.params.taskId, req.params.recitalId]
    );
    const [task] = await pool.query('SELECT * FROM recital_tasks WHERE id=?', [req.params.taskId]);
    res.json({ task: task[0] });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
};

const taskDelete = async (req, res) => {
  try {
    await pool.query('DELETE FROM recital_tasks WHERE id=? AND recital_id=?', [req.params.taskId, req.params.recitalId]);
    res.json({ message: 'Task deleted' });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
};

// ── FEES ───────────────────────────────────────────────────────────────────
const feesList = async (req, res) => {
  try {
    const { student_id, status } = req.query;
    let sql = `SELECT sf.*, s.name as student_name, fp.name as plan_name
               FROM student_fees sf
               JOIN students s ON s.id = sf.student_id
               LEFT JOIN fee_plans fp ON fp.id = sf.fee_plan_id
               WHERE sf.school_id = ?`;
    const params = [req.params.schoolId];
    if (student_id) { sql += ' AND sf.student_id=?'; params.push(student_id); }
    if (status) { sql += ' AND sf.status=?'; params.push(status); }
    sql += ' ORDER BY sf.due_date DESC';
    const [fees] = await pool.query(sql, params);
    res.json({ fees });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
};

const feesSummary = async (req, res) => {
  try {
    const [[summary]] = await pool.query(
      `SELECT
        SUM(CASE WHEN status='Paid'    THEN amount ELSE 0 END) as total_paid,
        SUM(CASE WHEN status='Pending' THEN amount ELSE 0 END) as total_pending,
        SUM(CASE WHEN status='Overdue' THEN amount ELSE 0 END) as total_overdue,
        COUNT(CASE WHEN status='Paid'    THEN 1 END) as count_paid,
        COUNT(CASE WHEN status='Pending' THEN 1 END) as count_pending,
        COUNT(CASE WHEN status='Overdue' THEN 1 END) as count_overdue
       FROM student_fees WHERE school_id=?`, [req.params.schoolId]
    );
    res.json({ summary });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
};

const feesCreate = async (req, res) => {
  try {
    const { student_id, fee_plan_id, description, amount, currency, due_date, status, notes } = req.body;
    if (!student_id || !amount || !due_date) return res.status(400).json({ error: 'student_id, amount, due_date required' });
    const [result] = await pool.query(
      `INSERT INTO student_fees (school_id, student_id, fee_plan_id, description, amount, currency, due_date, status, notes)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [req.params.schoolId, student_id, fee_plan_id||null, description||null, amount, currency||'USD', due_date, status||'Pending', notes||null]
    );
    const [fee] = await pool.query(
      `SELECT sf.*, s.name as student_name FROM student_fees sf JOIN students s ON s.id=sf.student_id WHERE sf.id=?`,
      [result.insertId]
    );
    res.status(201).json({ fee: fee[0] });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
};

const feesUpdate = async (req, res) => {
  try {
    const { status, paid_date, amount, due_date, notes } = req.body;
    await pool.query(
      `UPDATE student_fees SET status=COALESCE(?,status), paid_date=COALESCE(?,paid_date),
       amount=COALESCE(?,amount), due_date=COALESCE(?,due_date), notes=COALESCE(?,notes)
       WHERE id=? AND school_id=?`,
      [status, paid_date, amount, due_date, notes, req.params.feeId, req.params.schoolId]
    );
    const [updated] = await pool.query(
      `SELECT sf.*, s.name as student_name FROM student_fees sf JOIN students s ON s.id=sf.student_id WHERE sf.id=?`,
      [req.params.feeId]
    );
    res.json({ fee: updated[0] });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
};

// Fee plans
const plansList = async (req, res) => {
  try {
    const [plans] = await pool.query('SELECT * FROM fee_plans WHERE school_id=? AND is_active=1 ORDER BY name', [req.params.schoolId]);
    res.json({ plans });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
};

const plansCreate = async (req, res) => {
  try {
    const { name, amount, currency, period, description } = req.body;
    if (!name || !amount) return res.status(400).json({ error: 'Name and amount required' });
    const [result] = await pool.query(
      'INSERT INTO fee_plans (school_id, name, amount, currency, period, description) VALUES (?,?,?,?,?,?)',
      [req.params.schoolId, name, amount, currency||'USD', period||'Monthly', description||null]
    );
    const [plan] = await pool.query('SELECT * FROM fee_plans WHERE id=?', [result.insertId]);
    res.status(201).json({ plan: plan[0] });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
};

// ── PARENT PORTAL ─────────────────────────────────────────────────────────
const parentChildren = async (req, res) => {
  try {
    const [children] = await pool.query(
      `SELECT s.*,
        GROUP_CONCAT(b.name ORDER BY b.name SEPARATOR ', ') as batch_names
       FROM students s
       JOIN parent_students ps ON ps.student_id = s.id
       LEFT JOIN batch_students bs ON bs.student_id = s.id
       LEFT JOIN batches b ON b.id = bs.batch_id AND b.is_active=1
       WHERE ps.parent_id = ? GROUP BY s.id`,
      [req.user.id]
    );
    res.json({ children });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
};

const parentSchedules = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT student_id FROM parent_students WHERE parent_id=?', [req.user.id]);
    if (!rows.length) return res.json({ schedules: [] });
    const studentIds = rows.map(r => r.student_id);
    const [schedules] = await pool.query(
      `SELECT DISTINCT sc.*, b.name as batch_name, b.dance_style, b.level
       FROM schedules sc
       JOIN batches b ON b.id = sc.batch_id
       JOIN batch_students bs ON bs.batch_id = b.id
       WHERE bs.student_id IN (?) AND sc.is_active=1
       ORDER BY FIELD(sc.day_of_week,'Mon','Tue','Wed','Thu','Fri','Sat','Sun'), sc.start_time`,
      [studentIds]
    );
    res.json({ schedules });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
};

const parentRecitals = async (req, res) => {
  try {
    const [[schoolRow]] = await pool.query('SELECT school_id FROM users WHERE id=?', [req.user.id]);
    const [recitals] = await pool.query(
      `SELECT r.*,
        COUNT(rt.id) as task_count, SUM(rt.is_done) as tasks_done
       FROM recitals r LEFT JOIN recital_tasks rt ON rt.recital_id=r.id
       WHERE r.school_id=? AND r.event_date >= CURDATE()
       GROUP BY r.id ORDER BY r.event_date`,
      [schoolRow.school_id]
    );
    res.json({ recitals });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
};

const parentFees = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT student_id FROM parent_students WHERE parent_id=?', [req.user.id]);
    if (!rows.length) return res.json({ fees: [] });
    const studentIds = rows.map(r => r.student_id);
    const [fees] = await pool.query(
      `SELECT sf.*, s.name as student_name FROM student_fees sf
       JOIN students s ON s.id=sf.student_id
       WHERE sf.student_id IN (?) ORDER BY sf.due_date DESC`,
      [studentIds]
    );
    res.json({ fees });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
};

module.exports = {
  schedulesList, schedulesCreate, schedulesUpdate, schedulesDelete,
  recitalsList, recitalsGet, recitalsCreate, recitalsUpdate, recitalsDelete,
  taskCreate, taskUpdate, taskDelete,
  feesList, feesSummary, feesCreate, feesUpdate, plansList, plansCreate,
  parentChildren, parentSchedules, parentRecitals, parentFees,
};
