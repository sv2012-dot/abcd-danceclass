const router = require('express').Router();
const c = require('../controllers/authController');
const { auth } = require('../middleware/auth');

router.post('/login',           c.login);
router.get('/me',               auth(), c.me);
router.put('/change-password',  auth(), c.changePassword);

module.exports = router;