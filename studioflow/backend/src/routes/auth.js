const router = require('express').Router();
const c = require('../controllers/authController');
const { auth } = require('../middleware/auth');

// Legacy password login — kept for one release while we monitor usage.
// Remove in the follow-up release once telemetry shows zero hits.
router.post('/login',           c.login);

router.post('/google',          c.googleLogin);
router.post('/register',        c.registerSchool);

// Magic-link auth (new primary path)
router.post('/magic-link',         c.requestMagicLink);
router.post('/magic-link/consume', c.consumeMagicLink);

// Multi-school chooser
router.post('/choose-school',      c.chooseSchool);
router.post('/switch-school',      auth(), c.requestSwitch);

router.get('/me',               auth(), c.me);
router.put('/change-password',  auth(), c.changePassword);

module.exports = router;
