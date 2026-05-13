// Billing routes — Stripe Checkout, Portal, Webhook, plan info.
// All endpoints (except the webhook) are auth-gated.

const router = require('express').Router();
const { auth } = require('../middleware/auth');
const { pool } = require('../database');
const { effectivePlan, FREE_LIMITS, PAID_LIMITS } = require('../lib/plan');
const { getTodayCount } = require('../middleware/smartUsage');

// Owner-only guard — checks the active school_id from JWT against the
// matching membership row. Returns null if OK, or sends a 403 and returns
// the response object so caller can early-return.
async function requireOwnerOfCurrentSchool(req, res) {
  if (req.user.role === 'superadmin') return null;
  const [[m]] = await pool.query(
    `SELECT is_owner FROM school_memberships
      WHERE user_id = ? AND school_id = ? AND removed_at IS NULL LIMIT 1`,
    [req.user.id, req.user.school_id]
  );
  if (!m || !m.is_owner) {
    res.status(403).json({
      error: 'owner_required',
      message: 'Only the school owner can manage billing.',
    });
    return res;
  }
  return null;
}

// Mirror of webhook helper: pulls current_period_end from old or new Stripe
// API shapes, with a 31-day fallback so subscriptions always register.
function extractPeriodEnd(sub) {
  if (!sub) return null;
  if (typeof sub.current_period_end === 'number') return new Date(sub.current_period_end * 1000);
  const itemEnd = sub.items?.data?.[0]?.current_period_end;
  if (typeof itemEnd === 'number') return new Date(itemEnd * 1000);
  return new Date(Date.now() + 31 * 24 * 60 * 60 * 1000);
}

// ── GET /api/billing/me — current plan + limits for the signed-in school ──
router.get('/me', auth(), async (req, res) => {
  try {
    const sid = req.user.school_id;
    if (!sid) return res.status(403).json({ error: 'school context required' });
    const eff = await effectivePlan(Number(sid));

    // Also surface current usage so the frontend can paint the upgrade pressure
    const [[counts]] = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM students WHERE school_id = ?) AS students,
         (SELECT COUNT(*) FROM batches  WHERE school_id = ?) AS batches,
         (SELECT COUNT(*) FROM recitals WHERE school_id = ?) AS recitals`,
      [sid, sid, sid]
    );

    // Is the caller the owner of this school?
    let isOwner = req.user.role === 'superadmin';
    let ownerName = null;
    if (!isOwner) {
      const [[m]] = await pool.query(
        `SELECT is_owner FROM school_memberships
          WHERE user_id = ? AND school_id = ? AND removed_at IS NULL LIMIT 1`,
        [req.user.id, sid]
      );
      isOwner = !!(m && m.is_owner);
    }
    if (!isOwner) {
      // Fetch the actual owner's name so non-owners can see who to talk to
      const [[ow]] = await pool.query(
        `SELECT u.name FROM school_memberships sm
           JOIN users u ON u.id = sm.user_id
          WHERE sm.school_id = ? AND sm.is_owner = 1 AND sm.removed_at IS NULL LIMIT 1`,
        [sid]
      );
      ownerName = ow?.name || null;
    }

    // Today's shared AI usage for the school
    const smartUsedToday = await getTodayCount(sid).catch(() => 0);

    res.json({
      plan: eff.plan,
      source: eff.source,            // 'subscription' | 'trial' | 'default'
      trial_ends_at: eff.trial_ends_at,
      is_owner: isOwner,
      owner_name: ownerName,
      limits: {
        students: eff.limits.students === Infinity ? null : eff.limits.students,
        batches: eff.limits.batches === Infinity ? null : eff.limits.batches,
        recitals: eff.limits.recitals === Infinity ? null : eff.limits.recitals,
        smart_calls_per_day: eff.limits.smart_calls_per_day,
      },
      usage: {
        students: Number(counts.students),
        batches: Number(counts.batches),
        recitals: Number(counts.recitals),
        smart_today: smartUsedToday,
      },
      free_limits: FREE_LIMITS,
      paid_limits: { ...PAID_LIMITS, recitals: null, batches: null, students: null },
    });
  } catch (err) {
    console.error('[billing] /me', err);
    res.status(500).json({ error: 'Failed to load plan' });
  }
});

// ── POST /api/billing/checkout — Stripe Checkout (placeholder until keys) ──
router.post('/checkout', auth('school_admin', 'superadmin'), async (req, res) => {
  if (await requireOwnerOfCurrentSchool(req, res)) return;
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_PRICE_ID) {
    return res.status(503).json({ error: 'Billing not yet configured' });
  }
  try {
    const Stripe = require('stripe');
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    const sid = req.user.school_id;
    const [[school]] = await pool.query('SELECT id, name, email, stripe_customer_id FROM schools WHERE id = ? LIMIT 1', [sid]);
    if (!school) return res.status(404).json({ error: 'School not found' });

    // Create customer if first checkout
    let customerId = school.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: school.email || req.user.email,
        name: school.name,
        metadata: { school_id: String(sid) },
      });
      customerId = customer.id;
      await pool.query('UPDATE schools SET stripe_customer_id = ? WHERE id = ?', [customerId, sid]);
    }

    const origin = req.headers.origin || 'https://manchq.com';
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      success_url: `${origin}/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/billing?checkout=cancelled`,
      allow_promotion_codes: true,
      metadata: { school_id: String(sid) },
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('[billing] checkout', err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/billing/sync — pull latest subscription state from Stripe ────
// Safety valve for when the webhook misses or fires before the DB is ready.
// Idempotent: lists the school's Stripe subscriptions and updates plan/period
// from the most recent active/trialing one (or downgrades if none found).
router.post('/sync', auth('school_admin', 'superadmin'), async (req, res) => {
  if (await requireOwnerOfCurrentSchool(req, res)) return;
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({ error: 'Billing not yet configured' });
  }
  try {
    const Stripe = require('stripe');
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const sid = req.user.school_id;
    if (!sid) return res.status(403).json({ error: 'school context required' });

    const [[school]] = await pool.query(
      'SELECT id, stripe_customer_id FROM schools WHERE id = ? LIMIT 1', [sid]
    );
    if (!school) return res.status(404).json({ error: 'School not found' });
    if (!school.stripe_customer_id) {
      return res.json({ synced: false, reason: 'no_stripe_customer' });
    }

    // Pull all subscriptions for this customer, pick most recent active-ish one
    const subs = await stripe.subscriptions.list({
      customer: school.stripe_customer_id,
      status: 'all',
      limit: 10,
    });
    const active = subs.data.find(s => ['active', 'trialing', 'past_due'].includes(s.status));

    if (!active) {
      // No live subscription — make sure DB reflects that
      await pool.query(
        `UPDATE schools SET plan_tier = 'free', stripe_subscription_id = NULL WHERE id = ?`,
        [sid]
      );
      return res.json({ synced: true, status: 'no_active_subscription' });
    }

    const periodEnd = extractPeriodEnd(active);
    await pool.query(
      `UPDATE schools
          SET plan_tier = 'paid',
              stripe_subscription_id = ?,
              current_period_end = ?
        WHERE id = ?`,
      [active.id, periodEnd, sid]
    );
    console.log('[billing] manual sync for school', sid, 'sub', active.id, 'periodEnd', periodEnd);
    res.json({
      synced: true,
      status: active.status,
      subscription_id: active.id,
      period_end: periodEnd,
    });
  } catch (err) {
    console.error('[billing] sync', err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/billing/portal — Stripe Customer Portal ──────────────────────
router.post('/portal', auth('school_admin', 'superadmin'), async (req, res) => {
  if (await requireOwnerOfCurrentSchool(req, res)) return;
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({ error: 'Billing not yet configured' });
  }
  try {
    const Stripe = require('stripe');
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const sid = req.user.school_id;
    const [[school]] = await pool.query('SELECT stripe_customer_id FROM schools WHERE id = ? LIMIT 1', [sid]);
    if (!school?.stripe_customer_id) return res.status(400).json({ error: 'No Stripe customer yet — subscribe first' });

    const origin = req.headers.origin || 'https://manchq.com';
    const portal = await stripe.billingPortal.sessions.create({
      customer: school.stripe_customer_id,
      // Auto-sync on return so cancellations etc. reflect immediately
      return_url: `${origin}/billing?portal=returned`,
    });
    res.json({ url: portal.url });
  } catch (err) {
    console.error('[billing] portal', err);
    res.status(500).json({ error: err.message });
  }
});

// Note: /webhook lives in routes/billingWebhook.js (mounted separately
// with express.raw so signature verification can run on the raw body).

// ── DELETE /api/billing/school — owner-only soft-delete the current school
// 30-day grace period (soft delete only). Cancels Stripe subscription
// immediately. Marks every membership for this school as removed.
// After deletion the user is sent back to /auth/choose-school (or /login
// if they have no remaining memberships).
router.delete('/school', auth('school_admin', 'superadmin'), async (req, res) => {
  if (await requireOwnerOfCurrentSchool(req, res)) return;
  const sid = req.user.school_id;
  const confirmName = String(req.body?.confirm_name || '').trim();
  if (!sid) return res.status(403).json({ error: 'school context required' });

  try {
    const [[school]] = await pool.query(
      'SELECT id, name, stripe_subscription_id, stripe_customer_id FROM schools WHERE id = ? AND deleted_at IS NULL LIMIT 1',
      [sid]
    );
    if (!school) return res.status(404).json({ error: 'School not found.' });

    if (!confirmName || confirmName.toLowerCase() !== school.name.toLowerCase()) {
      return res.status(400).json({
        error: 'confirmation_mismatch',
        message: 'Confirmation name does not match this studio.',
      });
    }

    // Cancel Stripe subscription immediately (best effort)
    if (school.stripe_subscription_id && process.env.STRIPE_SECRET_KEY) {
      try {
        const Stripe = require('stripe');
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
        await stripe.subscriptions.cancel(school.stripe_subscription_id);
      } catch (e) {
        console.warn('[delete-school] Stripe cancel failed (continuing):', e.message);
      }
    }

    // Soft delete + revoke memberships
    await pool.query(
      `UPDATE schools SET deleted_at = NOW(), is_active = 0,
                          plan_tier = 'free', stripe_subscription_id = NULL
         WHERE id = ?`,
      [sid]
    );
    await pool.query(
      `UPDATE school_memberships SET removed_at = NOW() WHERE school_id = ?`,
      [sid]
    );

    // Clear users.school_id mirror for anyone whose active session is here.
    // They'll bounce to /auth/choose-school (or /login if no others) on next request.
    await pool.query(
      `UPDATE users SET school_id = NULL, role = 'orphan', is_owner = 0
         WHERE school_id = ?`,
      [sid]
    );

    console.log(`[delete-school] Soft-deleted school #${sid} (${school.name}) by user #${req.user.id}`);
    res.json({ ok: true, message: `${school.name} has been deleted. You have 30 days to contact support if you want to restore it.` });
  } catch (err) {
    console.error('[delete-school]', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
