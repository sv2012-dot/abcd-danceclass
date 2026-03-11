const router = require('express').Router({ mergeParams: true });
const c = require('../controllers/batchController');
const { auth } = require('../middleware/auth');

router.get('/',              auth(), c.list);
router.post('/',             auth('superadmin','school_admin'), c.create);
router.get('/:id',           auth(), c.get);
router.put('/:id',           auth('superadmin','school_admin'), c.update);
router.delete('/:id',        auth('superadmin','school_admin'), c.remove);
router.put('/:id/enroll',    auth('superadmin','school_admin'), c.enroll);

module.exports = router;