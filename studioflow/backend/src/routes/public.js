const router = require('express').Router();
const c = require('../controllers/publicController');

router.get('/:schoolSlug/:recitalSlug',       c.getRecital);
router.post('/:schoolSlug/:recitalSlug/rsvp', c.submitRsvp);

module.exports = router;
