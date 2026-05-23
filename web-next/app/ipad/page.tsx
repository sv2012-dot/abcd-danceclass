'use client';

// /ipad — home/landing screen for the iPad demo replica.
//
// Renders three big tap-target tiles: Students, Schedule, Batches, plus a
// Sign-out button. Tiles are plain <a href> links so iPad WebKit never loses
// tap handling. Read-only summary header at the top.
//
// First-push scope: just auth + landing. Subsequent pushes will add data
// pages under /ipad/students, /ipad/schedule, /ipad/batches. Until those
// land, those tiles route to placeholder pages (created in the same commit).
//
// iOS defenses:
//   - 100dvh containers
//   - All tappable elements have minHeight ≥ 48px (HIG: 44pt)
//   - touch-action / -webkit-tap-highlight reasserted per-tile

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  getIpadToken,
  getIpadUser,
  getIpadSchool,
  clearIpadSession,
} from './_lib/api';

const TILES = [
  { label: 'Students', emoji: '🧑‍🎓', href: '/ipad/students' },
  { label: 'Schedule', emoji: '📅', href: '/ipad/schedule' },
  { label: 'Batches', emoji: '🩰', href: '/ipad/batches' },
];

export default function IpadHomePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [school, setSchool] = useState<any>(null);
  const [checked, setChecked] = useState(false);

  // Guard: if no /ipad token, bounce to /ipad/login. Done client-side to
  // avoid SSR complexity — we never SSR-render protected /ipad content.
  useEffect(() => {
    const token = getIpadToken();
    if (!token) {
      router.replace('/ipad/login');
      return;
    }
    setUser(getIpadUser());
    setSchool(getIpadSchool());
    setChecked(true);
  }, [router]);

  if (!checked) {
    return (
      <div
        style={{
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--background)',
        }}
      >
        <p style={{ color: 'var(--muted)' }}>Loading…</p>
      </div>
    );
  }

  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  function handleSignOut() {
    clearIpadSession();
    router.replace('/ipad/login');
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--background)', paddingBottom: 80 }}>
      {/* Top bar */}
      <header
        style={{
          background: 'var(--card)',
          borderBottom: '1px solid var(--border)',
          padding: '18px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--primary)',
              marginBottom: 2,
            }}
          >
            iPad Demo
          </div>
          <h1
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: 'var(--text)',
              maxWidth: '60vw',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {school?.name || 'ManchQ'}
          </h1>
        </div>
        <button
          onClick={handleSignOut}
          style={{
            background: 'transparent',
            border: '1px solid var(--border)',
            color: 'var(--muted)',
            padding: '12px 18px',
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            minHeight: 48, // HIG tap-target
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          Sign out
        </button>
      </header>

      {/* Greeting */}
      <section style={{ padding: '28px 24px 8px', userSelect: 'none', WebkitUserSelect: 'none' }}>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>{todayLabel}</p>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>
          Welcome{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
        </h2>
      </section>

      {/* Tile grid */}
      <section
        style={{
          padding: '20px 24px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
        }}
      >
        {TILES.map((t) => (
          <a
            key={t.label}
            href={t.href}
            style={{
              display: 'block',
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 16,
              padding: '24px 20px',
              textDecoration: 'none',
              color: 'var(--text)',
              minHeight: 132,
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent',
              userSelect: 'none',
              WebkitUserSelect: 'none',
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 10 }} aria-hidden>{t.emoji}</div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>{t.label}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>Tap to open</div>
          </a>
        ))}
      </section>

      {/* Footer note */}
      <p
        style={{
          marginTop: 32,
          padding: '0 24px',
          fontSize: 11,
          color: 'var(--muted)',
          textAlign: 'center',
          lineHeight: 1.6,
        }}
      >
        Signed in as {user?.email || 'unknown'} · iPad session only
      </p>
    </div>
  );
}
