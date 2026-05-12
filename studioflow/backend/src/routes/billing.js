// Billing routes — Stripe Checkout, Portal, Webhook, plan info.
// All endpoints (except the webhook) are auth-gated.

const router = require('express').Router();
const { auth } = require('../middleware/auth');
const { pool } = require('../database');
const { effectivePlan, FREE_LIMITS, PAID_LIMITS } = require('../lib/plan');

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

    res.json({
      plan: eff.plan,
      source: eff.source,            // 'subscription' | 'trial' | 'default'
      trial_ends_at: eff.trial_ends_at,
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

module.exports = router;
