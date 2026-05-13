const router = require('express').Router();
const c = require('../controllers/teamController');
const { auth } = require('../middleware/auth');

// Public — preview an invite before accepting (no auth required)
router.get('/invitations/:token/preview', c.previewInvite);

// Authenticated team management (school_admin / superadmin checked in controller)
router.get   ('/',                          auth(), c.list);
router.post  ('/invitations',               auth(), c.invite);
router.post  ('/invitations/:id/resend',    auth(), c.resendInvite);
router.delete('/invitations/:id',           auth(), c.revokeInvite);
router.patch ('/members/:id',               auth(), c.updateRole);
router.delete('/members/:id',               auth(), c.removeMember);
router.post  ('/transfer-ownership',        auth(), c.transferOwnership);

module.exports = router;
