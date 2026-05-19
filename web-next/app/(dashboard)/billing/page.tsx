'use client';

// /billing — the customer-facing subscription page.
// Shows current plan, usage vs limits, and upgrade / manage-billing
// buttons that bounce through Stripe Checkout / Portal.

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import api from '@/lib/api/client';
import { useAuth } from '@/lib/context/AuthContext';

// Viewport detector — used to switch the Hobby vs Pro comparison from
// a 3-column table (desktop) to stacked rows (mobile).
function useIsMobile(bp = 600) {
  const [m, setM] = useState(false);
  useEffect(() => {
    const fn = () => setM(window.innerWidth < bp);
    fn();
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, [bp]);
  return m;
}

type PlanInfo = {
  plan: 'free' | 'paid';
  source: 'subscription' | 'trial' | 'default';
  trial_ends_at: string | null;
  is_owner: boolean;
  owner_name: string | null;
  limits: { students: number | null; batches: number | null; recitals: number | null; smart_calls_per_day: number };
  usage: { students: number; batches: number; recitals: number; smart_today: number };
  free_limits: { recitals: number; batches: number; students: number; smart_calls_per_day: number };
};

const PURPLE = '#7C3AED';
const MAGENTA = '#DC4EFF';
const GRAD = `linear-gradient(135deg, ${PURPLE} 0%, ${MAGENTA} 100%)`;

function daysBetween(future: string | null) {
  if (!future) return null;
  const ms = new Date(future).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

function BillingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { school } = useAuth() as any;
  const [info, setInfo] = useState<PlanInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'checkout' | 'portal' | 'sync' | null>(null);

  const refresh = () => {
    setLoading(true);
    (api.get('/billing/me') as any)
      .then((data: any) => setInfo(data))
      .catch(() => setInfo(null))
      .finally(() => setLoading(false));
  };

  // Pull subscription state directly from Stripe — bypasses the webhook.
  // Used both on return-from-checkout and as a user-facing "Sync" button.
  const syncFromStripe = async (silent = false): Promise<boolean> => {
    if (!silent) setBusy('sync');
    try {
      const data: any = await api.post('/billing/sync', {});
      if (data?.synced && data?.status && data.status !== 'no_active_subscription') {
        if (!silent) toast.success('Synced from Stripe — you\'re subscribed ✓');
        await refresh();
        return true;
      }
      if (!silent) toast(data?.reason === 'no_stripe_customer'
        ? 'No Stripe customer on file yet — try Subscribe.'
        : 'No active subscription found in Stripe.');
      return false;
    } catch (e: any) {
      if (!silent) toast.error(e?.error || 'Sync failed');
      return false;
    } finally {
      if (!silent) setBusy(null);
    }
  };

  useEffect(() => { refresh(); }, []);

  // Handle return from Stripe Checkout — sync directly from Stripe so we
  // don't depend on the webhook race-condition.
  useEffect(() => {
    const checkout = searchParams.get('checkout');
    if (checkout === 'success') {
      toast.success('Welcome to Pro! ☕ Your subscription is active.');
      // Try webhook-driven refresh first (gives webhook a moment to land),
      // then fall back to direct Stripe sync so the UI always reflects truth.
      (async () => {
        await new Promise(r => setTimeout(r, 1500));
        await refresh();
        // If still not showing as subscriber, pull straight from Stripe
        setTimeout(async () => {
          const fresh = await (api.get('/billing/me') as any).catch(() => null);
          if (fresh && fresh.source !== 'subscription') {
            await syncFromStripe(true);
          }
        }, 3000);
      })();
      router.replace('/billing');
    } else if (checkout === 'cancelled') {
      toast("Cancelled — you're still on the same plan.");
      router.replace('/billing');
    } else if (searchParams.get('portal') === 'returned') {
      // User just came back from Stripe Customer Portal — they may have
      // cancelled, updated payment, etc. Pull fresh state from Stripe.
      syncFromStripe(true).then(() => router.replace('/billing'));
    }
  }, [searchParams, router]);

  const handleUpgrade = async () => {
    setBusy('checkout');
    try {
      const data: any = await api.post('/billing/checkout', {});
      if (data?.url) window.location.href = data.url;
      else toast.error('Could not start checkout');
    } catch (e: any) {
      if (e?.error === 'Billing not yet configured') {
        toast.error('Subscriptions are coming very soon! Hang tight.');
      } else {
        toast.error(e?.error || 'Could not start checkout');
      }
    } finally {
      setBusy(null);
    }
  };

  const handlePortal = async () => {
    setBusy('portal');
    try {
      const data: any = await api.post('/billing/portal', {});
      if (data?.url) window.location.href = data.url;
      else toast.error('Could not open billing portal');
    } catch (e: any) {
      toast.error(e?.error || 'Could not open billing portal');
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
        <p>Loading plan…</p>
      </div>
    );
  }
  if (!info) {
    return (
      <div style={{ padding: 40 }}>
        <p style={{ color: '#EF4444' }}>Couldn't load billing info. Try refreshing.</p>
      </div>
    );
  }

  const isPaid = info.plan === 'paid';
  const isSub = info.source === 'subscription';
  // isTrial / daysLeft removed — no trial path in the Hobby/Pro
  // freemium model. Backend's effectivePlan returns trial_ends_at:
  // null for everyone now, so these were always falsy anyway.

  const schoolName = school?.name || 'this studio';

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '20px 8px' }}>
      <h1 style={{ fontFamily: 'var(--font-d)', fontSize: 28, fontWeight: 800, margin: '0 0 6px', letterSpacing: '-0.5px' }}>
        Billing for {schoolName}
      </h1>
      <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 18px' }}>
        Each studio is billed separately. {info.is_owner
          ? 'You own this studio, so you manage the subscription here.'
          : `Subscription is managed by ${info.owner_name || 'the owner'}.`}
      </p>

      {/* Non-owner banner */}
      {!info.is_owner && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', marginBottom: 18, fontSize: 13, color: 'var(--muted)', lineHeight: 1.55 }}>
          <strong style={{ color: 'var(--text)' }}>Read-only view.</strong> Your team's plan and limits are shown below. To upgrade or change billing, reach out to {info.owner_name ? <strong style={{ color: 'var(--text)' }}>{info.owner_name}</strong> : 'the studio owner'}.
        </div>
      )}

      {/* Plan card */}
      <div
        style={{
          background: isPaid ? 'linear-gradient(160deg,rgba(124,58,237,0.10) 0%,rgba(220,78,255,0.05) 100%)' : 'var(--card)',
          border: `1.5px solid ${isPaid ? 'rgba(124,58,237,0.4)' : 'var(--border)'}`,
          borderRadius: 16,
          padding: 24,
          marginBottom: 22,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: isPaid ? MAGENTA : 'var(--muted)', marginBottom: 6 }}>
              Current plan
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 900, margin: 0, color: 'var(--text)' }}>
              {isPaid ? '⭐ Pro' : '🎓 Hobby'}
            </h2>
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: '6px 0 0' }}>
              {isSub  && '$5.99/month · billed via Stripe'}
              {!isSub && 'Free forever · upgrade to Pro for unlimited everything'}
            </p>
          </div>
          <div>
            {info.is_owner && isSub && (
              <button
                onClick={handlePortal}
                disabled={busy !== null}
                style={{
                  padding: '10px 18px',
                  borderRadius: 10,
                  border: '1.5px solid var(--border)',
                  background: 'var(--card)',
                  color: 'var(--text)',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: busy === null ? 'pointer' : 'wait',
                }}
              >
                {busy === 'portal' ? 'Opening…' : 'Manage billing'}
              </button>
            )}
            {info.is_owner && !isSub && (
              <button
                onClick={handleUpgrade}
                disabled={busy !== null}
                style={{
                  padding: '10px 20px',
                  borderRadius: 10,
                  border: 'none',
                  background: GRAD,
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: 14,
                  cursor: busy === null ? 'pointer' : 'wait',
                  boxShadow: '0 4px 18px rgba(124,58,237,0.4)',
                }}
              >
                {busy === 'checkout' ? 'Loading…' : '☕ Upgrade to Pro · $5.99/mo'}
              </button>
            )}
          </div>
        </div>

        {/* Trial UI removed — there are no trials in the Hobby/Pro
            freemium model. The plan card simply shows current state. */}
      </div>

      {/* Usage cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 8 }}>
        <UsageCard label="Students" used={info.usage.students} cap={info.limits.students ?? info.free_limits.students} isPaid={isPaid} />
        <UsageCard label="Batches" used={info.usage.batches} cap={info.limits.batches ?? info.free_limits.batches} isPaid={isPaid} />
        <UsageCard label="Recitals" used={info.usage.recitals} cap={info.limits.recitals ?? info.free_limits.recitals} isPaid={isPaid} />
        <UsageCard label="AI today" used={info.usage.smart_today ?? 0} cap={info.limits.smart_calls_per_day} isPaid={isPaid} isDaily />
      </div>
      <p style={{ fontSize: 11, color: 'var(--muted)', margin: '0 0 16px', lineHeight: 1.5 }}>
        AI usage is shared across your whole team. Resets at midnight.
      </p>

      {/* Manual sync — owner-only recovery valve */}
      {info.is_owner && (
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <button
            onClick={() => syncFromStripe(false)}
            disabled={busy !== null}
            style={{
              background: 'none',
              border: '1px dashed var(--border)',
              borderRadius: 8,
              padding: '8px 14px',
              fontSize: 12,
              color: 'var(--muted)',
              cursor: busy === null ? 'pointer' : 'wait',
            }}
          >
            {busy === 'sync'
              ? 'Syncing…'
              : info.source === 'subscription'
                ? '⟳ Refresh subscription state'
                : '⟳ Already paid? Sync from Stripe'}
          </button>
        </div>
      )}

      {/* Hobby vs Pro comparison — surfaced for non-subscribers so the
          user sees exactly what upgrade unlocks. Hidden once they're
          an active subscriber. */}
      {!isSub && (
        <PlanCompareTable
          freeLimits={info.free_limits}
          onUpgrade={handleUpgrade}
          busy={busy}
        />
      )}

      {/* Danger zone — owner-only delete */}
      {info.is_owner && (
        <DeleteSchoolBlock schoolName={schoolName} />
      )}
    </div>
  );
}

function PlanCompareTable({
  freeLimits, onUpgrade, busy,
}: {
  freeLimits: any;
  onUpgrade: () => void;
  busy: string | null;
}) {
  const isMobile = useIsMobile();
  const rows = [
    { label: 'Students',              free: String(freeLimits.students ?? 30),                   pro: 'Unlimited' },
    { label: 'Batches / classes',     free: String(freeLimits.batches ?? 2),                     pro: 'Unlimited' },
    { label: 'Recitals',              free: String(freeLimits.recitals ?? 4),                    pro: 'Unlimited' },
    { label: 'Team members',          free: `${freeLimits.team_members ?? 1} (owner only)`,      pro: 'Unlimited' },
    { label: 'Smart ManchQ AI / day', free: `${freeLimits.smart_calls_per_day ?? 10} actions`,   pro: '60 actions' },
    { label: 'Smart Announce',        free: 'Included',                                          pro: 'Included' },
    { label: 'Smart Add (bulk)',      free: 'Included',                                          pro: 'Included' },
    { label: 'Per-event cover art',   free: '—',                                                 pro: 'Included' },
  ];
  return (
    <div style={{
      background: 'var(--card)',
      border: '1.5px solid var(--border)',
      borderRadius: 16,
      padding: isMobile ? '18px 16px' : '20px 22px',
      marginBottom: 22,
    }}>
      <h3 style={{ fontSize: 14, fontWeight: 800, margin: '0 0 4px', color: 'var(--text)' }}>
        Hobby vs Pro
      </h3>
      <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 16px' }}>
        Upgrade for $5.99/month to unlock everything below.
      </p>

      {isMobile ? (
        /* ── Mobile: each row stacks the feature label on top, with
            Hobby + Pro chips below. Pills are easier to scan than a
            cramped 3-column table on a 360px screen. */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map((r) => (
            <div key={r.label} style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '10px 12px',
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
                {r.label}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 2 }}>🎓 Hobby</div>
                  <div style={{ fontSize: 13, color: r.free === '—' ? 'var(--muted)' : 'var(--text)', fontWeight: 600 }}>{r.free}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: MAGENTA, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 2 }}>⭐ Pro</div>
                  <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 700 }}>{r.pro}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* ── Desktop: classic 3-column table. */
        <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--border)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface)' }}>
                <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Feature</th>
                <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>🎓 Hobby</th>
                <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 700, color: MAGENTA, textTransform: 'uppercase', letterSpacing: '0.06em' }}>⭐ Pro</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text)' }}>{r.label}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--muted)' }}>{r.free}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--text)', fontWeight: 700 }}>{r.pro}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ marginTop: 16, textAlign: 'center' }}>
        <button
          onClick={onUpgrade}
          disabled={busy !== null}
          style={{
            padding: '10px 22px',
            borderRadius: 24,
            border: 'none',
            background: GRAD,
            color: '#fff',
            fontSize: 13,
            fontWeight: 800,
            cursor: busy === null ? 'pointer' : 'wait',
            boxShadow: '0 4px 18px rgba(124,58,237,0.32)',
          }}
        >
          {busy === 'checkout' ? 'Loading…' : '☕ Subscribe — $5.99/mo'}
        </button>
      </div>
    </div>
  );
}

function DeleteSchoolBlock({ schoolName }: { schoolName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const canDelete = confirm.trim().toLowerCase() === schoolName.toLowerCase();

  const handleDelete = async () => {
    if (!canDelete) return;
    setBusy(true);
    try {
      await (api as any).delete('/billing/school', { data: { confirm_name: confirm.trim() } });
      toast.success(`${schoolName} has been deleted.`);
      // Clear session so AuthContext picks up the change
      try { sessionStorage.removeItem('sf_token'); localStorage.removeItem('sf_token'); localStorage.removeItem('sf_user'); localStorage.removeItem('sf_school'); } catch (_) {}
      window.location.href = '/login';
    } catch (err: any) {
      toast.error(err?.error || 'Could not delete the studio.');
      setBusy(false);
    }
  };

  return (
    <div style={{ marginTop: 32, padding: 20, background: 'rgba(220,38,38,0.04)', border: '1px solid rgba(220,38,38,0.35)', borderRadius: 12 }}>
      <h3 style={{ fontSize: 15, fontWeight: 800, color: '#DC2626', margin: '0 0 8px' }}>Danger zone</h3>
      <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 14px', lineHeight: 1.55 }}>
        Deleting this studio cancels its subscription immediately and removes all access for your team. We hold the data for 30 days &mdash; reach out to <a href="mailto:support@manchq.com" style={{ color: '#7C3AED' }}>support@manchq.com</a> within that window to restore.
      </p>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          style={{ background: 'transparent', color: '#DC2626', border: '1.5px solid #DC2626', padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
        >
          Delete this studio →
        </button>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ fontSize: 13, color: 'var(--text)', margin: 0, lineHeight: 1.5 }}>
            Type <strong>{schoolName}</strong> below to confirm.
          </p>
          <input
            type="text"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={schoolName}
            style={{ width: '100%', boxSizing: 'border-box', background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 14, color: 'var(--text)', outline: 'none' }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => { setOpen(false); setConfirm(''); }}
              style={{ background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border)', padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={!canDelete || busy}
              style={{ background: '#DC2626', color: '#fff', border: 'none', padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: canDelete && !busy ? 'pointer' : 'not-allowed', opacity: canDelete && !busy ? 1 : 0.55 }}
            >
              {busy ? 'Deleting…' : 'Permanently delete'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function UsageCard({ label, used, cap, isPaid, isDaily }: { label: string; used: number | null; cap: number; isPaid: boolean; isDaily?: boolean }) {
  // For non-daily counts on a paid plan: unlimited.
  // For daily AI calls: always show used / cap, even on paid (limit is 60).
  const isUnlimited = !isDaily && isPaid;
  const pct = isUnlimited
    ? 0
    : used !== null
      ? Math.min(100, Math.round((used / cap) * 100))
      : 0;
  const color = pct >= 100 ? '#EF4444' : pct >= 80 ? '#F59E0B' : '#10B981';

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 14 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', lineHeight: 1.2 }}>
        {isUnlimited ? (
          <>Unlimited <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>✨</span></>
        ) : (
          <>{used ?? 0} <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>{isDaily ? `of ${cap} today` : `of ${cap}`}</span></>
        )}
      </div>
      {!isUnlimited && (
        <div style={{ marginTop: 8, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: color, transition: 'width .3s' }} />
        </div>
      )}
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40 }}>Loading…</div>}>
      <BillingContent />
    </Suspense>
  );
}
