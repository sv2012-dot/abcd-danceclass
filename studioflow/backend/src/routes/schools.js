const router = require('express').Router();
const c = require('../controllers/schoolController');
const { auth } = require('../middleware/auth');

router.get('/',        auth('superadmin'), c.list);
router.post('/',       auth('superadmin'), c.create);
router.get('/:id',     auth(), c.get);
router.put('/:id',     auth('superadmin','school_admin'), c.update);
router.get('/:id/stats', auth(), c.stats);
router.post('/:id/reset-admin-password', auth('superadmin'), c.resetAdminPassword);

module.exports = router;