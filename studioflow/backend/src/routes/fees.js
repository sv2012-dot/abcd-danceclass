const router = require('express').Router({ mergeParams: true });
const c = require('../controllers/feeController');
const { auth } = require('../middleware/auth');

router.get('/plans',          auth('superadmin','school_admin'), c.listPlans);
router.post('/plans',         auth('superadmin','school_admin'), c.createPlan);
router.get('/summary',        auth('superadmin','school_admin'), c.summary);
router.get('/',               auth('superadmin','school_admin'), c.listFees);
router.post('/',              auth('superadmin','school_admin'), c.createFee);
router.put('/:feeId/status',  auth('superadmin','school_admin'), c.updateFeeStatus);
router.post('/toggle-current/:studentId', auth('superadmin','school_admin'), c.toggleCurrentFee);

module.exports = router;