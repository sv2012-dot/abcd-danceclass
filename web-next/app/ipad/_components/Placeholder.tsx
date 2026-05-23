'use client';

// Shared "coming soon" placeholder for /ipad section pages that haven't been
// built yet. Keeps tile destinations resolvable so taps don't 404.

import React from 'react';

export default function Placeholder({ title, emoji }: { title: string; emoji: string }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)' }}>
      <header
        style={{
          background: 'var(--card)',
          borderBottom: '1px solid var(--border)',
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <a
          href="/ipad"
          style={{
            color: 'var(--primary)',
            textDecoration: 'none',
            fontSize: 15,
            fontWeight: 600,
            padding: '6px 10px',
            borderRadius: 8,
          }}
        >
          ← Back
        </a>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{title}</h1>
      </header>
      <div
        style={{
          padding: '60px 24px',
          textAlign: 'center',
          maxWidth: 460,
          margin: '0 auto',
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 16 }}>{emoji}</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>
          {title} — coming soon
        </h2>
        <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.6 }}>
          This page lands in the next iPad demo push. Sign-in flow is being tested first.
        </p>
      </div>
    </div>
  );
}
