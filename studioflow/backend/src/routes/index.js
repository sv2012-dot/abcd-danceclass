const router = require('express').Router();
const { auth } = require('../middleware/auth');

router.use('/auth',     require('./auth'));
router.use('/schools',  require('./schools'));
router.use('/schools/:schoolId/students',  require('./students'));
router.use('/schools/:schoolId/batches',   require('./batches'));
router.use('/schools/:schoolId/schedules', require('./schedules'));
router.use('/schools/:schoolId/recitals',  require('./recitals'));
router.use('/schools/:schoolId/fees',      require('./fees'));
router.use('/schools/:schoolId/users',     require('./users'));
router.use('/schools/:schoolId/events',   require('./events'));
router.use('/parent',  require('./parent'));

module.exports = router;