/**
 * Plan helpers — single source of truth for "is this school on the paid plan?"
 *
 * A school is "effectively paid" if:
 *   1. They have an active Stripe subscription (current_period_end > now), OR
 *   2. They're inside their 30-day trial window (trial_ends_at > now)
 *
 * The DB column plan_tier is the *intended* tier (set by webhooks). The
 * trial window is computed on the fly so we don't need a cron to downgrade.
 */

const { pool } = require('../database');

const FREE_LIMITS = {
  recitals: 4,
  batches: 2,
  students: 30,
  smart_calls_per_day: 20,
  // Multi-user: free = owner only. No invites allowed.
  team_members: 1,
};
const PAID_LIMITS = {
  recitals: Infinity,
  batches: Infinity,
  students: Infinity,
  smart_calls_per_day: 60,
  team_members: Infinity,
};

/**
 * Returns { plan: 'free'|'paid', source: 'subscription'|'trial'|'default',
 *           trial_ends_at, limits } for the given school row OR schoolId.
 */
async function effectivePlan(schoolOrId) {
  let school = schoolOrId;
  if (typeof schoolOrId === 'number' || typeof schoolOrId === 'string') {
    const [rows] = await pool.query(
      `SELECT id, plan_tier, trial_ends_at, stripe_subscription_id, current_period_end
         FROM schools WHERE id = ? LIMIT 1`,
      [schoolOrId]
    );
    school = rows[0];
    if (!school) return { plan: 'free', source: 'default', trial_ends_at: null, limits: FREE_LIMITS };
  }

  const now = new Date();

  // Active subscription wins
  if (school.stripe_subscription_id && school.current_period_end && new Date(school.current_period_end) > now) {
    return { plan: 'paid', source: 'subscription', trial_ends_at: school.trial_ends_at, limits: PAID_LIMITS };
  }
  // Trial still open
  if (school.trial_ends_at && new Date(school.trial_ends_at) > now) {
    return { plan: 'paid', source: 'trial', trial_ends_at: school.trial_ends_at, limits: PAID_LIMITS };
  }
  // Default — free
  return { plan: 'free', source: 'default', trial_ends_at: school.trial_ends_at, limits: FREE_LIMITS };
}

/**
 * Express middleware: blocks the add op if the school is on the free plan
 * and already at or over the limit for `resource`.
 *
 * resource: 'students' | 'batches' | 'recitals'
 * Looks up the school's count via a count query. Returns 402 with structured
 * error so the frontend can show the upgrade modal.
 */
function withinFreeLimits(resource) {
  return async (req, res, next) => {
    try {
      const schoolId = req.user?.school_id || req.params.schoolId;
      if (!schoolId) return res.status(403).json({ error: 'school context required' });

      const eff = await effectivePlan(Number(schoolId));
      if (eff.plan === 'paid') return next();  // unlimited

      // For free plan, count current records
      const table = resource === 'students' ? 'students'
                  : resource === 'batches'  ? 'batches'
                  : resource === 'recitals' ? 'recitals'
                  : null;
      if (!table) return next();  // unknown resource, don't block

      const [[row]] = await pool.query(
        `SELECT COUNT(*) AS n FROM ${table} WHERE school_id = ?`,
        [schoolId]
      );
      const limit = eff.limits[resource];
      if (row.n >= limit) {
        return res.status(402).json({
          error: 'plan_limit_reached',
          resource,
          limit,
          current: row.n,
          message: `Free plan allows up to ${limit} ${resource}. Upgrade to add more.`,
        });
      }
      next();
    } catch (err) {
      console.error('[withinFreeLimits]', err);
      next();  // fail open — don't block on infra errors
    }
  };
}

module.exports = { effectivePlan, withinFreeLimits, FREE_LIMITS, PAID_LIMITS };
