'use client';

// PlanBadge — compact plan indicator rendered inside the sidebar brand block,
// directly below the school name + city line.
//
// Visual modes:
//   - Pro (paid subscription) → tiny purple gradient badge "⭐ Pro"
//   - Trial                   → small inline link "Upgrade ↗  •  30d left"
//   - Free / default          → small inline link "Upgrade →"
//
// All variants navigate to /billing on click.

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api/client';

type PlanInfo = {
  plan: 'free' | 'paid';
  source: 'subscription' | 'trial' | 'default';
  trial_ends_at: string | null;
};

function daysUntil(iso: string | null) {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

export default function PlanBadge() {
  const router = useRouter();
  const [info, setInfo] = useState<PlanInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    (api.get('/billing/me') as any)
      .then((d: any) => { if (!cancelled) setInfo(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (!info) return null;

  const isSub = info.source === 'subscription';
  const isTrial = info.source === 'trial';
  const days = daysUntil(info.trial_ends_at);

  // ── Pro: small gradient badge ──
  if (isSub) {
    return (
      <button
        onClick={() => router.push('/billing')}
        title="Manage billing"
        style={{
          marginTop: 6,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '2px 8px',
          borderRadius: 12,
          border: 'none',
          background: 'linear-gradient(135deg, #7C3AED 0%, #DC4EFF 100%)',
          color: '#fff',
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: '0.04em',
          cursor: 'pointer',
          textTransform: 'uppercase',
        }}
      >
        <span aria-hidden style={{ fontSize: 10 }}>★</span>
        Pro
      </button>
    );
  }

  // ── Trial / Free: small inline link ──
  const urgent = isTrial && days !== null && days <= 5;
  const label = isTrial
    ? `Upgrade ↗ · ${days}d ${urgent ? '⏰' : 'trial'}`
    : 'Upgrade →';

  return (
    <button
      onClick={() => router.push('/billing')}
      title={isTrial ? 'Subscribe before trial ends' : 'Upgrade to Pro'}
      style={{
        marginTop: 6,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: 0,
        background: 'none',
        border: 'none',
        color: urgent ? '#F59E0B' : '#A78BFA',
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '-0.005em',
        cursor: 'pointer',
        textDecoration: 'none',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.textDecoration = 'underline'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.textDecoration = 'none'; }}
    >
      {label}
    </button>
  );
}
