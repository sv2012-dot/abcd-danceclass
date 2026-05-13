// Persistent daily counter for Smart ManchQ usage, keyed by school.
//
// Why this exists alongside express-rate-limit:
//   - express-rate-limit lives in process memory; a server restart resets it.
//   - We want a durable count for the UI ("X / Y calls today") AND for the
//     /billing page so school admins see what their team is using.
//
// This middleware does two things:
//   1. Pre-check: read today's count, reject if already at limit.
//   2. Post-call: increment the count once the underlying handler succeeded
//      (we attach res.locals.smartCountIncrement = true and increment in the
//      `finish` event for 2xx responses).

const pool = require('../../config/db');
const { effectivePlan, FREE_LIMITS } = require('../lib/plan');

function todayLocal() {
  // YYYY-MM-DD in server local TZ; matches DATE column behavior in MySQL.
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function getTodayCount(schoolId) {
  const [[row]] = await pool.query(
    `SELECT count FROM smart_usage_daily WHERE school_id = ? AND usage_date = ? LIMIT 1`,
    [schoolId, todayLocal()]
  );
  return row?.count || 0;
}

async function incrementToday(schoolId) {
  await pool.query(
    `INSERT INTO smart_usage_daily (school_id, usage_date, count)
     VALUES (?, ?, 1)
     ON DUPLICATE KEY UPDATE count = count + 1`,
    [schoolId, todayLocal()]
  );
}

// Middleware: pre-check + register post-handler increment hook.
async function smartUsageMiddleware(req, res, next) {
  const sid = req.user?.school_id;
  if (!sid) return next();

  try {
    const eff = await effectivePlan(Number(sid));
    const limit = eff.limits.smart_calls_per_day;
    const used = await getTodayCount(sid);

    if (used >= limit) {
      return res.status(429).json({
        error: 'rate_limit_exceeded',
        plan: eff.plan,
        limit,
        used,
        message: eff.plan === 'free'
          ? `Your studio has used all ${limit} Smart actions for today. Upgrade for more, or wait until tomorrow.`
          : `Your studio has used all ${limit} Smart actions for today. Resets at midnight.`,
        retry_after_seconds: 86400,
      });
    }

    // Attach so the route can decide what counts. Default: increment for any 2xx.
    res.locals.smartUsage = { schoolId: sid, limit, beforeUsed: used };

    res.on('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        incrementToday(sid).catch(err =>
          console.warn('[smartUsage] increment failed:', err.message)
        );
      }
    });

    next();
  } catch (err) {
    console.warn('[smartUsage] middleware error (fail open):', err.message);
    next();
  }
}

// GET /smart/usage/today — read the shared school counter
async function getUsageHandler(req, res) {
  const sid = req.user?.school_id;
  if (!sid) return res.status(400).json({ error: 'No school context.' });
  try {
    const eff = await effectivePlan(Number(sid));
    const used = await getTodayCount(sid);
    // Resets at next local midnight
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
    res.json({
      used,
      limit: eff.limits.smart_calls_per_day,
      plan: eff.plan,
      source: eff.source,
      resets_at: tomorrow.toISOString(),
    });
  } catch (err) {
    console.error('[smartUsage.get]', err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = { smartUsageMiddleware, getUsageHandler, getTodayCount };
