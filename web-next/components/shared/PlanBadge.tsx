'use client';

// PlanBadge — compact plan indicator rendered inside the sidebar brand block,
// directly below the school name + city line.
//
// Visual modes:
//   - Pro (paid subscription) → tiny purple gradient badge "⭐ Pro"
//   - Trial                   → SAME purple gradient badge with countdown:
//                               "⭐ Pro · Trial — 26d left" (urgent: amber)
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

  const urgent = isTrial && days !== null && days <= 5;

  // ── Pro (paid OR trial): purple gradient badge.
  //    Trial uses the SAME badge so the user sees what they have today;
  //    the countdown is appended so they know it's time-bound. Urgent
  //    (<=5 days) flips to amber to nudge subscription.
  if (isSub || isTrial) {
    const isUrgentTrial = isTrial && urgent;
    return (
      <button
        onClick={(e) => { e.stopPropagation(); router.push('/billing'); }}
        title={isSub ? 'Manage billing' : 'Subscribe before trial ends'}
        style={{
          marginTop: 6,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '2px 8px',
          borderRadius: 12,
          border: 'none',
          background: isUrgentTrial
            ? 'linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)'
            : 'linear-gradient(135deg, #7C3AED 0%, #DC4EFF 100%)',
          color: '#fff',
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: '0.04em',
          cursor: 'pointer',
          textTransform: 'uppercase',
        }}
      >
        <span aria-hidden style={{ fontSize: 10 }}>{isUrgentTrial ? '⏰' : '★'}</span>
        {isTrial ? `Pro · Trial — ${days}d left` : 'Pro'}
      </button>
    );
  }

  // ── Free / default ── (trial + paid already handled above)
  const label = 'Upgrade →';

  // Capsule variant — small pill button (used in the mobile drawer footer)
  if (variant === 'capsule') {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); router.push('/billing'); }}
        title="Upgrade to Pro"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '4px 10px',
          borderRadius: 999,
          border: '1px solid rgba(167,139,250,0.45)',
          background: 'rgba(167,139,250,0.08)',
          color: '#A78BFA',
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
      title="Upgrade to Pro"
      style={{
        marginTop: 6,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: 0,
        background: 'none',
        border: 'none',
        color: '#A78BFA',
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
