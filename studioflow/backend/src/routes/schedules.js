const router = require('express').Router({ mergeParams: true });
const c = require('../controllers/scheduleController');
const { auth } = require('../middleware/auth');

router.get('/',       auth(), c.list);
router.post('/',      auth('superadmin','school_admin'), c.create);
router.put('/:id',    auth('superadmin','school_admin'), c.update);
router.delete('/:id', auth('superadmin','school_admin'), c.remove);

module.exports = router;