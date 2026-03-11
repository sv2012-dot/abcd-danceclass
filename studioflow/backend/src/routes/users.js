const router = require('express').Router({ mergeParams: true });
const c = require('../controllers/userController');
const { auth } = require('../middleware/auth');

router.get('/',     auth('superadmin','school_admin'), c.list);
router.post('/',    auth('superadmin','school_admin'), c.create);
router.put('/:id',  auth('superadmin','school_admin'), c.update);

module.exports = router;