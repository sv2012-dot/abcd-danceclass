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
      'SELECT id, title, event_date, event_time, venue, status, description, important_info, poster_url, slug FROM recitals WHERE school_id = ? AND slug = ? LIMIT 1',
      [school.id, recitalSlug]
    );
    if (!recitals[0]) return res.status(404).json({ error: 'Recital not found' });
    const recital = recitals[0];
    if (recital.important_info) { try { recital.important_info = JSON.parse(recital.important_info); } catch { recital.important_info = []; } }

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

// GET /public/:schoolSlug/:recitalSlug/og  — returns HTML with Open Graph meta tags
// Vercel Edge Middleware proxies bot requests (WhatsApp/Telegram/etc.) here
exports.ogPreview = async (req, res) => {
  function esc(s) { return String(s || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  try {
    const { schoolSlug, recitalSlug } = req.params;
    const APP_URL = process.env.APP_URL || 'https://manchq.com';

    const [schools] = await pool.query(
      'SELECT id, name FROM schools WHERE slug=? AND deleted_at IS NULL LIMIT 1', [schoolSlug]
    );
    const school = schools[0];
    if (!school) return res.status(404).send('Not found');

    const [recitals] = await pool.query(
      'SELECT title, description, poster_url, event_date, venue FROM recitals WHERE school_id=? AND slug=? LIMIT 1',
      [school.id, recitalSlug]
    );
    const recital = recitals[0];
    const pageUrl = `${APP_URL}/${schoolSlug}/${recitalSlug}`;
    const title   = recital ? `${recital.title} — ${school.name}` : school.name;
    const desc    = recital?.description || `Join us for a performance by ${school.name}. RSVP now!`;
    // Only use https:// image URLs — data: URIs are too large for OG
    const image   = recital?.poster_url?.startsWith('https://') ? recital.poster_url : null;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${esc(pageUrl)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
${image ? `<meta property="og:image" content="${esc(image)}">` : ''}
<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
${image ? `<meta name="twitter:image" content="${esc(image)}">` : ''}
<meta http-equiv="refresh" content="0; url=${esc(pageUrl)}">
</head>
<body>
<p>Redirecting to <a href="${esc(pageUrl)}">${esc(title)}</a>…</p>
</body>
</html>`);
  } catch (err) { res.status(500).send('Error'); }
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
