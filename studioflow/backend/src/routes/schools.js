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