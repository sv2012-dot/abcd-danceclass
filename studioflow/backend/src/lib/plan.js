/**
 * Plan helpers — single source of truth for "is this school on the paid plan?"
 *
 * Two-tier freemium model (Hobby ⇄ Pro). No trial period — new schools
 * start on Hobby (free) immediately. They upgrade to Pro ($5.99/mo)
 * when they hit a limit and tap the upgrade prompt.
 *
 * A school is "effectively paid" if they have an active Stripe
 * subscription (current_period_end > now). That's the only path.
 *
 * NOTE: trial_ends_at column still exists for backwards compat but is
 * ignored everywhere. patchTables clears any leftover trial values on
 * boot (one-time migration — easy because there are no real users yet).
 */

const { pool } = require('../database');

const FREE_LIMITS = {
  recitals: 4,
  batches: 2,
  students: 30,
  smart_calls_per_day: 10,
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
 * Returns { plan: 'free'|'paid', source: 'subscription'|'default',
 *           limits } for the given school row OR schoolId.
 *
 * trial_ends_at is no longer consulted; it's surfaced as null for
 * compatibility with callers that still read it from the response.
 */
async function effectivePlan(schoolOrId) {
  let school = schoolOrId;
  if (typeof schoolOrId === 'number' || typeof schoolOrId === 'string') {
    const [rows] = await pool.query(
      `SELECT id, plan_tier, stripe_subscription_id, current_period_end
         FROM schools WHERE id = ? LIMIT 1`,
      [schoolOrId]
    );
    school = rows[0];
    if (!school) return { plan: 'free', source: 'default', trial_ends_at: null, limits: FREE_LIMITS };
  }

  const now = new Date();

  // Active subscription wins
  if (school.stripe_subscription_id && school.current_period_end && new Date(school.current_period_end) > now) {
    return { plan: 'paid', source: 'subscription', trial_ends_at: null, limits: PAID_LIMITS };
  }
  // Default — Hobby (free). No trial path anymore.
  return { plan: 'free', source: 'default', trial_ends_at: null, limits: FREE_LIMITS };
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
        // Telemetry: log the block so we can see which limits are
        // pushing conversion. Fire-and-forget — never blocks the 402.
        pool.query(
          `INSERT INTO limit_blocks (school_id, user_id, resource, current_count, plan_limit) VALUES (?,?,?,?,?)`,
          [schoolId, req.user?.id || null, resource, row.n, limit]
        ).catch(err => console.warn('[limit_blocks] insert failed:', err.message));
        return res.status(402).json({
          error: 'plan_limit_reached',
          resource,
          limit,
          current: row.n,
          message: `Hobby plan allows up to ${limit} ${resource}. Upgrade to Pro for unlimited.`,
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
