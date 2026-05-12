'use client';

// /billing — the customer-facing subscription page.
// Shows current plan, trial countdown, usage vs limits, and upgrade /
// manage-billing buttons that bounce through Stripe Checkout / Portal.

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import api from '@/lib/api/client';

type PlanInfo = {
  plan: 'free' | 'paid';
  source: 'subscription' | 'trial' | 'default';
  trial_ends_at: string | null;
  limits: { students: number | null; batches: number | null; recitals: number | null; smart_calls_per_day: number };
  usage: { students: number; batches: number; recitals: number };
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
  const [info, setInfo] = useState<PlanInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'checkout' | 'portal' | null>(null);

  const refresh = () => {
    setLoading(true);
    (api.get('/billing/me') as any)
      .then((data: any) => setInfo(data))
      .catch(() => setInfo(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => { refresh(); }, []);

  // Handle return from Stripe Checkout
  useEffect(() => {
    const checkout = searchParams.get('checkout');
    if (checkout === 'success') {
      toast.success('Welcome to Spotlight! ☕ Your subscription is active.');
      // Webhook usually fires within a second or two — small delay then refresh
      setTimeout(refresh, 1500);
      router.replace('/billing');
    } else if (checkout === 'cancelled') {
      toast("Cancelled — you're still on the same plan.");
      router.replace('/billing');
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
  const isTrial = info.source === 'trial';
  const isSub = info.source === 'subscription';
  const daysLeft = daysBetween(info.trial_ends_at);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '20px 8px' }}>
      <h1 style={{ fontFamily: 'var(--font-d)', fontSize: 28, fontWeight: 800, margin: '0 0 6px', letterSpacing: '-0.5px' }}>
        Your Plan
      </h1>
      <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 24px' }}>
        Manage your subscription and see how much room you have on your current plan.
      </p>

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
              {isPaid ? '⭐ Spotlight' : '🎓 Debut'}
            </h2>
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: '6px 0 0' }}>
              {isSub  && '$5.99/month · billed via Stripe'}
              {isTrial && `Free trial · ${daysLeft} day${daysLeft === 1 ? '' : 's'} left`}
              {info.source === 'default' && 'Free forever — limited features'}
            </p>
          </div>
          <div>
            {isPaid ? (
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
            ) : (
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
                {busy === 'checkout' ? 'Loading…' : '☕ Upgrade for $5.99/mo'}
              </button>
            )}
          </div>
        </div>

        {/* Trial countdown banner */}
        {isTrial && daysLeft !== null && (
          <div
            style={{
              marginTop: 18,
              padding: '12px 14px',
              background: daysLeft <= 5 ? 'rgba(245,158,11,0.1)' : 'rgba(124,58,237,0.08)',
              border: `1px solid ${daysLeft <= 5 ? 'rgba(245,158,11,0.3)' : 'rgba(124,58,237,0.25)'}`,
              borderRadius: 10,
              fontSize: 13,
              color: daysLeft <= 5 ? '#B45309' : 'var(--text)',
            }}
          >
            {daysLeft <= 5 ? (
              <>⏰ Your trial ends in <strong>{daysLeft} day{daysLeft === 1 ? '' : 's'}</strong>. Add a payment method to keep unlimited everything.</>
            ) : (
              <>You're on a free trial. After {daysLeft} days you'll drop to the Debut plan unless you subscribe — then you'll never lose access to your data.</>
            )}
            <div style={{ marginTop: 10 }}>
              <button
                onClick={handleUpgrade}
                disabled={busy !== null}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: 'none',
                  background: GRAD,
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: busy === null ? 'pointer' : 'wait',
                }}
              >
                {busy === 'checkout' ? 'Loading…' : '☕ Subscribe — $5.99/mo'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Usage cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
        <UsageCard label="Students" used={info.usage.students} cap={info.limits.students ?? info.free_limits.students} isPaid={isPaid} />
        <UsageCard label="Batches" used={info.usage.batches} cap={info.limits.batches ?? info.free_limits.batches} isPaid={isPaid} />
        <UsageCard label="Recitals" used={info.usage.recitals} cap={info.limits.recitals ?? info.free_limits.recitals} isPaid={isPaid} />
        <UsageCard label="AI / day" used={null} cap={info.limits.smart_calls_per_day} isPaid={isPaid} isDaily />
      </div>

      {/* Coffee hook footer */}
      <div
        style={{
          textAlign: 'center',
          padding: '18px 16px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          fontSize: 13,
          color: 'var(--muted)',
        }}
      >
        ☕ ManchQ is $5.99/month — less than a Starbucks coffee. Less than the time you'd save in the first week.
      </div>
    </div>
  );
}

function UsageCard({ label, used, cap, isPaid, isDaily }: { label: string; used: number | null; cap: number; isPaid: boolean; isDaily?: boolean }) {
  const isUnlimited = !isDaily && isPaid;
  const pct = isUnlimited ? 0 : used !== null ? Math.min(100, Math.round((used / cap) * 100)) : 0;
  const color = pct >= 100 ? '#EF4444' : pct >= 80 ? '#F59E0B' : '#10B981';

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 14 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', lineHeight: 1.2 }}>
        {isUnlimited ? (
          <>Unlimited <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>✨</span></>
        ) : isDaily ? (
          <>{cap} <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>/day</span></>
        ) : (
          <>{used} <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>of {cap}</span></>
        )}
      </div>
      {!isUnlimited && !isDaily && (
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
