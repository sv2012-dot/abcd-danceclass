// ── Smart ManchQ rate limit ────────────────────────────────────────────────
// Caps each school per day across all 3 Smart features.
//   Free plan: 20 calls / 24h
//   Paid plan: 60 calls / 24h
//
// Keyed by school_id so multiple users in the same school share the bucket.
// Plan tier is looked up via effectivePlan() per request — adds ~1ms but
// keeps the limit responsive to subscription/trial state.

const rateLimit = require('express-rate-limit');
const { effectivePlan, FREE_LIMITS, PAID_LIMITS } = require('../lib/plan');

const smartRateLimit = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24h
  max: async (req) => {
    const sid = req.user?.school_id;
    if (!sid) return FREE_LIMITS.smart_calls_per_day;
    try {
      const eff = await effectivePlan(Number(sid));
      return eff.limits.smart_calls_per_day;
    } catch {
      return FREE_LIMITS.smart_calls_per_day;
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const sid = req.user?.school_id;
    const uid = req.user?.id;
    return sid ? `sf-smart-school-${sid}` : `sf-smart-user-${uid}`;
  },
  handler: async (req, res) => {
    const sid = req.user?.school_id;
    let plan = 'free', limit = FREE_LIMITS.smart_calls_per_day;
    if (sid) {
      try {
        const eff = await effectivePlan(Number(sid));
        plan = eff.plan;
        limit = eff.limits.smart_calls_per_day;
      } catch { /* fall through */ }
    }
    res.status(429).json({
      error: 'rate_limit_exceeded',
      plan,
      limit,
      message: plan === 'free'
        ? `Free plan allows ${limit} Smart actions per day. Upgrade for ${PAID_LIMITS.smart_calls_per_day}/day.`
        : `You've used ${limit} Smart actions today. Resets in ~24h.`,
      retry_after_seconds: 86400,
    });
  },
});

module.exports = smartRateLimit;
