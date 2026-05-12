// Standalone Stripe webhook handler. Mounted on its own path with
// express.raw() so signature verification works on the raw payload.

const express = require('express');
const router = express.Router();
const { pool } = require('../database');

router.post('/', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) return res.status(400).json({ error: 'Webhook not configured' });

  let event;
  try {
    const Stripe = require('stripe');
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    event = stripe.webhooks.constructEvent(req.body, sig, secret);
  } catch (err) {
    console.error('[stripe-webhook] signature verification failed', err.message);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  // Idempotency
  try {
    const [existing] = await pool.query('SELECT id FROM stripe_events WHERE id = ?', [event.id]);
    if (existing[0]) return res.json({ received: true, duplicate: true });
    await pool.query('INSERT INTO stripe_events (id, type) VALUES (?, ?)', [event.id, event.type]);
  } catch (err) {
    console.error('[stripe-webhook] dedup', err);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const schoolId = session.metadata?.school_id;
        if (schoolId && session.subscription) {
          // Pull the subscription object directly so we can capture
          // current_period_end in the same update — don't rely on the
          // separate customer.subscription.created event to arrive.
          let periodEnd = null;
          try {
            const Stripe = require('stripe');
            const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
            const sub = await stripe.subscriptions.retrieve(session.subscription);
            if (sub?.current_period_end) {
              periodEnd = new Date(sub.current_period_end * 1000);
            }
          } catch (err) {
            console.error('[stripe-webhook] failed to retrieve subscription', err.message);
          }
          await pool.query(
            `UPDATE schools
                SET plan_tier = 'paid',
                    stripe_subscription_id = ?,
                    current_period_end = COALESCE(?, current_period_end)
              WHERE id = ?`,
            [session.subscription, periodEnd, schoolId]
          );
        }
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.created': {
        const sub = event.data.object;
        const isActive = ['active', 'trialing'].includes(sub.status);
        const periodEnd = new Date(sub.current_period_end * 1000);
        await pool.query(
          `UPDATE schools
              SET plan_tier = ?,
                  stripe_subscription_id = ?,
                  current_period_end = ?
            WHERE stripe_customer_id = ?`,
          [isActive ? 'paid' : 'free', sub.id, periodEnd, sub.customer]
        );
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        await pool.query(
          `UPDATE schools SET plan_tier = 'free', stripe_subscription_id = NULL WHERE stripe_customer_id = ?`,
          [sub.customer]
        );
        break;
      }
      case 'invoice.payment_failed': {
        console.log('[stripe-webhook] invoice.payment_failed for', event.data.object.customer);
        break;
      }
      default:
        console.log('[stripe-webhook] unhandled', event.type);
    }
    res.json({ received: true });
  } catch (err) {
    console.error('[stripe-webhook] handler', err);
    res.status(500).json({ error: 'Handler error' });
  }
});

module.exports = router;
