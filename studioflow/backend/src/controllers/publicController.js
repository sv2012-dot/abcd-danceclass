const pool = require('../../config/db');

function slugify(str) {
  return (str || '').toLowerCase().trim()
    .replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 80);
}

// GET /public/:schoolSlug/:recitalSlug
exports.getRecital = async (req, res) => {
  try {
    const { schoolSlug, recitalSlug } = req.params;
    const [schools] = await pool.query(
      'SELECT id, name, city, slug FROM schools WHERE slug = ? AND deleted_at IS NULL LIMIT 1',
      [schoolSlug]
    );
    if (!schools[0]) return res.status(404).json({ error: 'School not found' });
    const school = schools[0];

    const [recitals] = await pool.query(
      'SELECT id, title, event_date, event_time, venue, status, description, poster_url, slug FROM recitals WHERE school_id = ? AND slug = ? LIMIT 1',
      [school.id, recitalSlug]
    );
    if (!recitals[0]) return res.status(404).json({ error: 'Recital not found' });
    const recital = recitals[0];

    const [[stats]] = await pool.query(
      `SELECT COUNT(*) AS total,
        SUM(CASE WHEN rsvp_status='Confirmed' THEN 1 ELSE 0 END) AS confirmed
       FROM recital_participants WHERE recital_id = ?`,
      [recital.id]
    );

    res.json({
      school: { name: school.name, city: school.city, slug: school.slug },
      recital: { ...recital, rsvp_stats: { total: Number(stats.total), confirmed: Number(stats.confirmed) } },
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// POST /public/:schoolSlug/:recitalSlug/rsvp
exports.submitRsvp = async (req, res) => {
  try {
    const { schoolSlug, recitalSlug } = req.params;
    const { name, email, response, plus_ones = 0 } = req.body;

    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
    if (!['Confirmed', 'Declined'].includes(response)) return res.status(400).json({ error: 'response must be Confirmed or Declined' });

    const [schools] = await pool.query(
      'SELECT id FROM schools WHERE slug = ? AND deleted_at IS NULL LIMIT 1', [schoolSlug]
    );
    if (!schools[0]) return res.status(404).json({ error: 'Not found' });

    const [recitals] = await pool.query(
      'SELECT id FROM recitals WHERE school_id = ? AND slug = ? LIMIT 1', [schools[0].id, recitalSlug]
    );
    if (!recitals[0]) return res.status(404).json({ error: 'Not found' });

    const recitalId = recitals[0].id;
    const schoolId  = schools[0].id;
    const emailVal  = email ? email.toLowerCase().trim() : null;

    // Upsert: if email exists, update; else insert
    if (emailVal) {
      const [existing] = await pool.query(
        'SELECT id FROM recital_participants WHERE recital_id = ? AND email = ? LIMIT 1',
        [recitalId, emailVal]
      );
      if (existing[0]) {
        await pool.query(
          'UPDATE recital_participants SET name=?, rsvp_status=?, plus_ones=? WHERE id=?',
          [name.trim(), response, Number(plus_ones), existing[0].id]
        );
      } else {
        await pool.query(
          'INSERT INTO recital_participants (recital_id, school_id, name, email, type, plus_ones, rsvp_status) VALUES (?,?,?,?,?,?,?)',
          [recitalId, schoolId, name.trim(), emailVal, 'Guest', Number(plus_ones), response]
        );
      }
    } else {
      await pool.query(
        'INSERT INTO recital_participants (recital_id, school_id, name, type, plus_ones, rsvp_status) VALUES (?,?,?,?,?,?)',
        [recitalId, schoolId, name.trim(), 'Guest', Number(plus_ones), response]
      );
    }

    const [[stats]] = await pool.query(
      `SELECT SUM(CASE WHEN rsvp_status='Confirmed' THEN 1 ELSE 0 END) AS confirmed FROM recital_participants WHERE recital_id=?`,
      [recitalId]
    );

    res.json({ message: 'RSVP recorded', status: response, confirmed: Number(stats.confirmed) });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
