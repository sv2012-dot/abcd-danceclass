const router = require('express').Router({ mergeParams: true });
const c = require('../controllers/eventController');
const { auth } = require('../middleware/auth');

router.get('/',              auth(), c.list);
router.post('/',             auth('superadmin','school_admin','teacher'), c.create);
router.put('/:id',           auth('superadmin','school_admin','teacher'), c.update);
router.delete('/:id',        auth('superadmin','school_admin'), c.remove);
router.get('/studio-needed', auth('superadmin','school_admin'), c.studioRequired);

module.exports = router;