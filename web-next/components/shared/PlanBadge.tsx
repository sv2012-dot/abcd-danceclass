'use client';

// PlanBadge — small clickable chip showing trial countdown / Pro / Free.
// Renders in the AppShell sidebar so admins always know where they stand.

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
      .catch(() => { /* silent — backend may not have shipped yet */ });
    return () => { cancelled = true; };
  }, []);

  if (!info) return null;

  const isSub = info.source === 'subscription';
  const isTrial = info.source === 'trial';
  const days = daysUntil(info.trial_ends_at);

  let label = '';
  let icon = '';
  let bg = '';
  let color = '';

  if (isSub) {
    label = 'Pro';
    icon = '⭐';
    bg = 'linear-gradient(135deg, rgba(124,58,237,0.18) 0%, rgba(220,78,255,0.12) 100%)';
    color = '#A78BFA';
  } else if (isTrial && days !== null) {
    const urgent = days <= 5;
    label = `Trial · ${days}d left`;
    icon = urgent ? '⏰' : '✨';
    bg = urgent ? 'rgba(245,158,11,0.12)' : 'rgba(124,58,237,0.10)';
    color = urgent ? '#F59E0B' : '#C4B5FD';
  } else {
    label = 'Free plan';
    icon = '🎓';
    bg = 'rgba(255,255,255,0.04)';
    color = 'var(--sidebar-muted)';
  }

  return (
    <button
      onClick={() => router.push('/billing')}
      style={{
        margin: '8px 14px 0',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        borderRadius: 10,
        border: '1px solid rgba(124,58,237,0.18)',
        background: bg,
        color,
        fontSize: 12,
        fontWeight: 700,
        cursor: 'pointer',
        width: 'calc(100% - 28px)',
        textAlign: 'left',
        transition: 'transform .08s, opacity .15s',
      }}
      onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.98)')}
      onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      title={isSub ? 'Manage billing' : isTrial ? 'Subscribe before trial ends' : 'Upgrade to Pro'}
    >
      <span aria-hidden style={{ fontSize: 14 }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {(isTrial || info.source === 'default') && (
        <span style={{ fontSize: 10, opacity: 0.7 }}>→</span>
      )}
    </button>
  );
}
