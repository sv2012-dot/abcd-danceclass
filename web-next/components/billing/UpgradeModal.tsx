'use client';

// UpgradeModal — surfaced when a Hobby (free) user bumps into a plan
// limit. Mounted near the limit-creating action; opens on a 402
// response from the backend OR when explicitly triggered.
//
// One component handles all five limit moments via the `limit` prop:
//   batches   → "You've used your 2 free batches"
//   students  → "You've reached the 30-student limit"
//   recitals  → "You've used your 4 free recitals"
//   team      → "Hobby plan is owner-only"
//   ai        → "Daily AI limit reached"
//
// On confirm, kicks off the existing Stripe checkout flow via
// billing.checkout(). Returns the user to /billing?checkout=success
// where the webhook has already flipped their plan.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api/client';
import toast from 'react-hot-toast';

const PURPLE  = '#7C3AED';
const MAGENTA = '#DC4EFF';
const GRAD    = `linear-gradient(135deg, ${PURPLE} 0%, ${MAGENTA} 100%)`;

export type LimitKey = 'batches' | 'students' | 'recitals' | 'team' | 'ai';

type Props = {
  open: boolean;
  limit: LimitKey | null;
  onClose: () => void;
  // Optional: pass the current count from the 402 response so the modal
  // can say "30 of 30 students used" instead of generic copy.
  current?: number;
  cap?: number;
};

const COPY: Record<LimitKey, { title: string; body: string; perk: string }> = {
  batches: {
    title: "You've hit your batch limit",
    body: "Hobby plan includes 2 batches. To create another, upgrade to Pro for unlimited batches plus everything below.",
    perk: 'Unlimited batches',
  },
  students: {
    title: "You've reached your student limit",
    body: "Hobby plan includes 30 students. To add another, upgrade to Pro for unlimited students plus everything below.",
    perk: 'Unlimited students',
  },
  recitals: {
    title: "You've used your recital allotment",
    body: "Hobby plan includes 4 recitals. To plan another, upgrade to Pro for unlimited recitals plus everything below.",
    perk: 'Unlimited recitals',
  },
  team: {
    title: 'Add your team with Pro',
    body: "Hobby plan is owner-only. Upgrade to Pro to invite teachers and co-admins to your studio.",
    perk: 'Unlimited team members',
  },
  ai: {
    title: "You've used your AI for today",
    body: "Hobby plan includes 10 Smart actions per day, shared across your team. Upgrade to Pro for 60/day, or wait until midnight.",
    perk: '60 Smart actions per day (vs. 10)',
  },
};

const PRO_PERKS = [
  'Unlimited batches, students, recitals',
  'Invite your full team (teachers + co-admins)',
  '60 Smart actions per day (vs. 10 on Hobby)',
  'Per-event cover photos + branded public recital pages',
  'Cancel anytime · $5.99/month',
];

export default function UpgradeModal({ open, limit, onClose, current, cap }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (!open || !limit) return null;
  const copy = COPY[limit];

  const handleUpgrade = async () => {
    setBusy(true);
    try {
      const res: any = await api.post('/billing/checkout', {});
      if (res?.url) {
        window.location.href = res.url;
      } else {
        toast.error('Could not start checkout. Please try again.');
        setBusy(false);
      }
    } catch (err: any) {
      const msg = err?.error || err?.message || 'Could not start checkout.';
      // 503 = "Billing not yet configured" (live keys missing on backend)
      if (err?.error === 'Billing not yet configured') {
        toast.error('Billing isn\'t set up yet — please contact support@manchq.com.');
      } else {
        toast.error(msg);
      }
      setBusy(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 2500,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--card)', color: 'var(--text)',
          borderRadius: 18, padding: 28, maxWidth: 460, width: '100%',
          boxShadow: '0 24px 64px rgba(0,0,0,.4)',
        }}
      >
        {/* Gradient pip */}
        <div style={{
          width: 56, height: 56, borderRadius: 16,
          background: GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 16,
          boxShadow: '0 12px 32px rgba(124,58,237,0.32)',
        }}>
          <span style={{ fontSize: 26 }}>☕</span>
        </div>

        <h2 style={{ fontSize: 19, fontWeight: 800, margin: '0 0 6px', color: 'var(--text)' }}>
          {copy.title}
        </h2>
        {current != null && cap != null && (
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '.06em' }}>
            {current} of {cap} used
          </p>
        )}
        <p style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--muted)', margin: '0 0 18px' }}>
          {copy.body}
        </p>

        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, padding: '14px 16px', marginBottom: 22,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
            What you get with Pro
          </div>
          <ul style={{ margin: 0, padding: '0 0 0 6px', listStyle: 'none' }}>
            {PRO_PERKS.map((p) => (
              <li key={p} style={{ fontSize: 13, color: 'var(--text)', padding: '5px 0', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ color: '#52c4a0', fontWeight: 800, lineHeight: 1.5 }}>✓</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>

        <button
          onClick={handleUpgrade}
          disabled={busy}
          style={{
            width: '100%', padding: '13px', borderRadius: 12, border: 'none',
            background: GRAD, color: '#fff',
            fontSize: 14, fontWeight: 800, cursor: busy ? 'wait' : 'pointer',
            boxShadow: '0 8px 22px rgba(124,58,237,0.4)',
            marginBottom: 8,
          }}
        >
          {busy ? 'Opening checkout…' : '☕ Upgrade to Pro · $5.99/month'}
        </button>
        <button
          onClick={onClose}
          style={{
            width: '100%', padding: '10px', borderRadius: 10,
            background: 'transparent', color: 'var(--muted)',
            border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}
