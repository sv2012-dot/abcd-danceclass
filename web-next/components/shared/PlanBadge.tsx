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

// Module-level cache so the badge survives sidebar remounts without
// flashing to null while re-fetching. SidebarContent is defined inline
// inside AppShell, so any parent state change (nav hover, menu toggle,
// etc.) remounts this component — and a null state on remount = flicker.
let _planCache: PlanInfo | null = null;
let _cacheTime = 0;
const CACHE_TTL_MS = 60_000; // refetch at most once per minute

export default function PlanBadge({ variant = 'inline' }: { variant?: 'inline' | 'capsule' } = {}) {
  const router = useRouter();
  const [info, setInfo] = useState<PlanInfo | null>(_planCache);

  useEffect(() => {
    let cancelled = false;
    // Skip if cache is still fresh — no need to refetch every mount
    if (_planCache && Date.now() - _cacheTime < CACHE_TTL_MS) {
      setInfo(_planCache);
      return;
    }
    (api.get('/billing/me') as any)
      .then((d: any) => {
        _planCache = d;
        _cacheTime = Date.now();
        if (!cancelled) setInfo(d);
      })
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
        onClick={(e) => { e.stopPropagation(); router.push('/billing'); }}
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

  // ── Trial / Free ──
  const urgent = isTrial && days !== null && days <= 5;
  const label = isTrial
    ? `Upgrade ↗ · ${days}d ${urgent ? '⏰' : 'trial'}`
    : 'Upgrade →';

  // Capsule variant — small pill button (used in the mobile drawer footer)
  if (variant === 'capsule') {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); router.push('/billing'); }}
        title={isTrial ? 'Subscribe before trial ends' : 'Upgrade to Pro'}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '4px 10px',
          borderRadius: 999,
          border: `1px solid ${urgent ? 'rgba(245,158,11,0.45)' : 'rgba(167,139,250,0.45)'}`,
          background: urgent ? 'rgba(245,158,11,0.08)' : 'rgba(167,139,250,0.08)',
          color: urgent ? '#F59E0B' : '#A78BFA',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '-0.005em',
          cursor: 'pointer',
        }}
      >
        {label}
      </button>
    );
  }

  // Default inline link variant
  return (
    <button
      onClick={(e) => { e.stopPropagation(); router.push('/billing'); }}
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
