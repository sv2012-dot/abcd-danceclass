// /api/ipad/* — isolated endpoints for the iPad demo replica at /ipad on the
// frontend. The ONLY thing different from the main /auth/magic-link flow is
// that the email link points to /ipad/magic (not /auth/magic), so consumers
// land in the /ipad app instead of the main dashboard. Token consume reuses
// the existing /auth/magic-link/consume endpoint — the magic_tokens table is
// the same.
//
// This file is purely additive: it doesn't import or modify any existing
// auth/route code, so it can't break the live site.

const router = require('express').Router();
const crypto = require('crypto');
const pool = require('../../config/db');
const { sendMagicLinkEmail } = require('../services/emailService');

const MAGIC_LINK_TTL_MIN = 15;
const APP_URL = () => (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// POST /api/ipad/magic-link — body { email }
// Always returns 200 (no email enumeration). If the email is on ManchQ,
// sends a magic-link email whose URL lands on /ipad/magic?token=...
router.post('/magic-link', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return res.json({ message: 'If that email is on ManchQ, a link is on its way.' });
  }
  try {
    const [rows] = await pool.query(
      'SELECT id FROM users WHERE email = ? AND is_active = 1 AND removed_at IS NULL',
      [email]
    );
    if (rows[0]) {
      const token = generateToken();
      await pool.query(
        `INSERT INTO magic_tokens (token, email, purpose, expires_at)
         VALUES (?, ?, 'signin', DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
        [token, email, MAGIC_LINK_TTL_MIN]
      );
      const link = `${APP_URL()}/ipad/magic?token=${token}`;
      sendMagicLinkEmail(email, link).catch(err =>
        console.error('iPad magic-link email failed:', err.message)
      );
    }
    return res.json({ message: 'If that email is on ManchQ, a link is on its way.' });
  } catch (err) {
    console.error('ipad requestMagicLink error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
