const router = require('express').Router({ mergeParams: true });
const c = require('../controllers/recitalController');
const { auth } = require('../middleware/auth');

router.get('/',                       auth(), c.list);
router.post('/',                      auth('superadmin','school_admin'), c.create);
router.get('/:id',                    auth(), c.get);
router.put('/:id',                    auth('superadmin','school_admin'), c.update);
router.delete('/:id',                 auth('superadmin','school_admin'), c.remove);
router.patch('/:id/poster',           auth('superadmin','school_admin'), c.uploadPoster);
router.post('/:id/tasks',             auth('superadmin','school_admin'), c.addTask);
router.put('/:id/tasks/:taskId/toggle', auth('superadmin','school_admin'), c.toggleTask);
router.delete('/:id/tasks/:taskId',   auth('superadmin','school_admin'), c.deleteTask);

// Participants (Invitees)
router.get('/:id/participants',       auth(), c.listParticipants);
router.post('/:id/participants',      auth('superadmin','school_admin'), c.addParticipant);
router.put('/:id/participants/:participantId', auth('superadmin','school_admin'), c.updateParticipantRsvp);
router.delete('/:id/participants/:participantId', auth('superadmin','school_admin'), c.deleteParticipant);

module.exports = router;