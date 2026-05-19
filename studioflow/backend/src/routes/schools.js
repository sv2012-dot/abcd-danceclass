const router = require('express').Router();
const c = require('../controllers/schoolController');
const { auth } = require('../middleware/auth');
const { seedSampleData } = require('../controllers/authController');

router.get('/',        auth('superadmin'), c.list);
router.post('/',       auth('superadmin'), c.create);
router.get('/:id',     auth(), c.get);
router.put('/:id',     auth('superadmin','school_admin'), c.update);
router.delete('/:id',  auth('superadmin'), c.softDelete);
router.post('/:id/restore', auth('superadmin'), c.restore);
router.get('/:id/stats', auth(), c.stats);
router.post('/:id/reset-admin-password', auth('superadmin'), c.resetAdminPassword);
router.post('/:id/reset-stripe',         auth('superadmin'), c.resetStripe);

// Superadmin telemetry: which limits are pushing users toward upgrade.
// Returns a rollup by resource for the requested window (default 30d).
router.get('/admin/limit-blocks', auth('superadmin'), async (req, res) => {
  try {
    const pool = require('../../config/db');
    const days = Math.max(1, Math.min(365, parseInt(req.query.days || '30', 10)));
    const [byResource] = await pool.query(
      `SELECT resource, COUNT(*) AS hits, COUNT(DISTINCT school_id) AS schools_blocked
         FROM limit_blocks
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        GROUP BY resource
        ORDER BY hits DESC`,
      [days]
    );
    const [recent] = await pool.query(
      `SELECT lb.*, s.name AS school_name
         FROM limit_blocks lb
         LEFT JOIN schools s ON s.id = lb.school_id
        WHERE lb.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        ORDER BY lb.created_at DESC
        LIMIT 50`,
      [days]
    );
    res.json({ window_days: days, by_resource: byResource, recent });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.post('/:id/seed-sample', auth('superadmin'), async (req, res) => {
  try {
    const pool = require('../../config/db');
    const schoolId = parseInt(req.params.id, 10);
    const [[row]] = await pool.query('SELECT dance_style FROM schools WHERE id = ?', [schoolId]);
    await seedSampleData(schoolId, row?.dance_style);
    res.json({ message: 'Sample data seeded successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;