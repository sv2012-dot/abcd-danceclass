// Attendance routes — mounted at /api/schools/:schoolId/attendance
const router = require('express').Router({ mergeParams: true });
const { auth } = require('../middleware/auth');
const c = require('../controllers/attendanceController');

// All endpoints require auth (admin / teacher)
router.use(auth('superadmin', 'school_admin', 'teacher'));

// Save attendance for an event instance
router.post('/events/:eventId/bulk',       c.bulkSaveEvent);
router.get ('/events/:eventId',            c.getForEvent);

// Save attendance for a recurring class instance
router.post('/schedule/:scheduleId/bulk',  c.bulkSaveSchedule);
router.get ('/schedule/:scheduleId',       c.getForSchedule);

// Read-only summaries
router.get ('/students/:studentId',        c.getForStudent);
router.get ('/batches/:batchId/stats',     c.getBatchStats);

module.exports = router;
