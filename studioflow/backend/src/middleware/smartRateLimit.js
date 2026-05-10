// ── Smart ManchQ rate limit ────────────────────────────────────────────────
// Caps each school at 30 Smart calls per 24h. Counts all 3 features
// combined so abuse on any single endpoint can't blow the budget.
//
// Keyed by school_id (from JWT) so multiple users in the same school share
// the bucket. Falls back to user_id if school_id missing (superadmin case).

const rateLimit = require('express-rate-limit');

const smartRateLimit = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24h
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const sid = req.user?.school_id;
    const uid = req.user?.id;
    return sid ? `sf-smart-school-${sid}` : `sf-smart-user-${uid}`;
  },
  handler: (req, res) => {
    res.status(429).json({
      error: 'rate_limit_exceeded',
      message: 'Smart ManchQ daily limit reached (30/day). Resets in ~24h.',
      retry_after_seconds: 86400,
    });
  },
});

module.exports = smartRateLimit;
