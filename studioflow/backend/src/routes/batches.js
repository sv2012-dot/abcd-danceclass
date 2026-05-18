const router = require('express').Router({ mergeParams: true });
const c = require('../controllers/batchController');
const { auth } = require('../middleware/auth');
const { withinFreeLimits } = require('../lib/plan');

router.get('/',                 auth(), c.list);
router.post('/',                auth('superadmin','school_admin'), withinFreeLimits('batches'), c.create);
router.get('/:id',              auth(), c.get);
router.get('/:id/delete-preview', auth('superadmin','school_admin'), c.deletePreview);
router.put('/:id',              auth('superadmin','school_admin'), c.update);
router.delete('/:id',           auth('superadmin','school_admin'), c.remove);
router.post('/:id/restore',     auth('superadmin','school_admin'), c.restore);
router.put('/:id/enroll',       auth('superadmin','school_admin'), c.enroll);
router.patch('/:id/cover',      auth('superadmin','school_admin','teacher'), c.uploadCover);

module.exports = router;