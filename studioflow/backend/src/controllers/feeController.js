const pool = require('../../config/db');

exports.listPlans = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM fee_plans WHERE school_id = ? AND is_active = 1 ORDER BY name', [req.params.schoolId]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.createPlan = async (req, res) => {
  const { name, amount, currency, period, description } = req.body;
  if (!name || !amount) return res.status(400).json({ error: 'Name and amount required' });
  try {
    const [r] = await pool.query('INSERT INTO fee_plans (school_id,name,amount,currency,period,description) VALUES (?,?,?,?,?,?)',
      [req.params.schoolId, name, amount, currency||'USD', period||'Monthly', description||null]);
    const [rows] = await pool.query('SELECT * FROM fee_plans WHERE id = ?', [r.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.listFees = async (req, res) => {
  const { status, student_id } = req.query;
  let q = `SELECT sf.*, s.name as student_name, fp.name as plan_name
    FROM student_fees sf
    JOIN students s ON s.id = sf.student_id
    LEFT JOIN fee_plans fp ON fp.id = sf.fee_plan_id
    WHERE sf.school_id = ?`;
  const params = [req.params.schoolId];
  if (status) { q += ' AND sf.status = ?'; params.push(status); }
  if (student_id) { q += ' AND sf.student_id = ?'; params.push(student_id); }
  q += ' ORDER BY sf.due_date DESC';
  try {
    const [rows] = await pool.query(q, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.createFee = async (req, res) => {
  const { student_id, fee_plan_id, amount, currency, due_date, notes } = req.body;
  if (!student_id || !amount || !due_date) return res.status(400).json({ error: 'student_id, amount, due_date required' });
  try {
    const [r] = await pool.query(
      'INSERT INTO student_fees (school_id,student_id,fee_plan_id,amount,currency,due_date,notes) VALUES (?,?,?,?,?,?,?)',
      [req.params.schoolId, student_id, fee_plan_id||null, amount, currency||'USD', due_date, notes||null]
    );
    const [rows] = await pool.query('SELECT sf.*, s.name as student_name FROM student_fees sf JOIN students s ON s.id = sf.student_id WHERE sf.id = ?', [r.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.updateFeeStatus = async (req, res) => {
  const { status, paid_date, notes } = req.body;
  try {
    await pool.query('UPDATE student_fees SET status=?,paid_date=?,notes=? WHERE id=? AND school_id=?',
      [status, paid_date||null, notes||null, req.params.feeId, req.params.schoolId]);
    const [rows] = await pool.query('SELECT * FROM student_fees WHERE id = ?', [req.params.feeId]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.summary = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        SUM(CASE WHEN status="Paid" THEN amount ELSE 0 END) as collected,
        SUM(CASE WHEN status="Pending" THEN amount ELSE 0 END) as pending,
        SUM(CASE WHEN status="Overdue" THEN amount ELSE 0 END) as overdue,
        COUNT(CASE WHEN status="Paid" THEN 1 END) as paid_count,
        COUNT(CASE WHEN status="Pending" THEN 1 END) as pending_count,
        COUNT(CASE WHEN status="Overdue" THEN 1 END) as overdue_count
      FROM student_fees WHERE school_id = ?
    `, [req.params.schoolId]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.toggleCurrentFee = async (req, res) => {
  const studentId = Number(req.params.studentId);
  const schoolId  = Number(req.params.schoolId);
  const dueDay    = Math.min(28, Math.max(1, Number(req.body.due_day) || 1));
  const now       = new Date();
  const yyyy      = now.getFullYear();
  const mm        = String(now.getMonth() + 1).padStart(2, '0');
  const yearMonth = `${yyyy}-${mm}`;
  const dueDate   = `${yearMonth}-${String(dueDay).padStart(2, '0')}`;

  try {
    const [existing] = await pool.query(
      `SELECT * FROM student_fees WHERE student_id = ? AND school_id = ? AND DATE_FORMAT(due_date,'%Y-%m') = ?`,
      [studentId, schoolId, yearMonth]
    );
    if (existing.length === 0) {
      // No record yet → create as Paid
      await pool.query(
        `INSERT INTO student_fees (school_id, student_id, amount, currency, due_date, status, paid_date, description)
         VALUES (?, ?, 0, 'USD', ?, 'Paid', ?, 'Monthly fee')`,
        [schoolId, studentId, dueDate, now.toISOString().slice(0, 10)]
      );
    } else {
      const rec = existing[0];
      const newStatus  = rec.status === 'Paid' ? 'Pending' : 'Paid';
      const paidDate   = newStatus === 'Paid' ? now.toISOString().slice(0, 10) : null;
      await pool.query(
        `UPDATE student_fees SET status = ?, paid_date = ? WHERE id = ?`,
        [newStatus, paidDate, rec.id]
      );
    }
    // Return updated record
    const [rows] = await pool.query(
      `SELECT * FROM student_fees WHERE student_id = ? AND school_id = ? AND DATE_FORMAT(due_date,'%Y-%m') = ?`,
      [studentId, schoolId, yearMonth]
    );
    res.json({ fee: rows[0] || null });
  } catch (err) { res.status(500).json({ error: err.message }); }
};