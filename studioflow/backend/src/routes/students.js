const router = require('express').Router({ mergeParams: true });
const c = require('../controllers/studentController');
const { auth } = require('../middleware/auth');

router.get('/',     auth('superadmin','school_admin','teacher'), c.list);
router.post('/',    auth('superadmin','school_admin'), c.create);
router.get('/:id',  auth('superadmin','school_admin','teacher'), c.get);
router.put('/:id',  auth('superadmin','school_admin'), c.update);
router.delete('/:id', auth('superadmin','school_admin'), c.remove);

module.exports = router;