const router = require('express').Router({ mergeParams: true });
const c = require('../controllers/scheduleController');
const { auth } = require('../middleware/auth');
const { pool } = require('../database');

// ── Schedule exceptions (skip a single recurring instance) ───────────────────

router.get('/exceptions', auth(), async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM schedule_exceptions WHERE school_id = ? ORDER BY exception_date',
      [req.params.schoolId]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/exceptions', auth('superadmin', 'school_admin', 'teacher'), async (req, res) => {
  const { schedule_id, exception_date } = req.body;
  if (!schedule_id || !exception_date) return res.status(400).json({ error: 'schedule_id and exception_date required' });
  try {
    const [r] = await pool.query(
      'INSERT IGNORE INTO schedule_exceptions (school_id, schedule_id, exception_date) VALUES (?,?,?)',
      [req.params.schoolId, schedule_id, exception_date]
    );
    res.status(201).json({ id: r.insertId, school_id: req.params.schoolId, schedule_id, exception_date });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/exceptions/:id', auth('superadmin', 'school_admin', 'teacher'), async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM schedule_exceptions WHERE id = ? AND school_id = ?',
      [req.params.id, req.params.schoolId]
    );
    res.json({ message: 'Exception removed' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Schedule CRUD ─────────────────────────────────────────────────────────────

router.get('/',       auth(), c.list);
router.post('/',      auth('superadmin','school_admin'), c.create);
router.put('/:id',    auth('superadmin','school_admin'), c.update);
router.delete('/:id', auth('superadmin','school_admin'), c.remove);

module.exports = router;
