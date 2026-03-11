const router = require('express').Router();
const { auth } = require('../middleware/auth');
const pool = require('../../config/db');
const uc = require('../controllers/userController');

// Parent: get their children
router.get('/students', auth('parent'), uc.parentStudents);

// Parent: view schedule for their school
router.get('/schedule', auth('parent'), async (req, res) => {
  try {
    const [user] = await pool.query('SELECT school_id FROM users WHERE id = ?', [req.user.id]);
    const schoolId = user[0]?.school_id;
    if (!schoolId) return res.status(400).json({ error: 'No school linked' });
    const [rows] = await pool.query(`
      SELECT sc.*, b.name as batch_name, b.dance_style, b.level
      FROM schedules sc JOIN batches b ON b.id = sc.batch_id
      WHERE sc.school_id = ? AND sc.is_active = 1
      ORDER BY FIELD(sc.day_of_week,'Mon','Tue','Wed','Thu','Fri','Sat','Sun'), sc.start_time
    `, [schoolId]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Parent: view upcoming recitals for their school
router.get('/recitals', auth('parent'), async (req, res) => {
  try {
    const [user] = await pool.query('SELECT school_id FROM users WHERE id = ?', [req.user.id]);
    const schoolId = user[0]?.school_id;
    if (!schoolId) return res.status(400).json({ error: 'No school linked' });
    const [rows] = await pool.query(`
      SELECT r.*, COUNT(rt.id) as task_count, SUM(rt.is_done) as tasks_done
      FROM recitals r LEFT JOIN recital_tasks rt ON rt.recital_id = r.id
      WHERE r.school_id = ? AND r.status NOT IN ('Cancelled')
      GROUP BY r.id ORDER BY r.event_date ASC
    `, [schoolId]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;