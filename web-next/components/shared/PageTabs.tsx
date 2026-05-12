'use client';

// Generic top-of-page tab bar. Each tab is { label, path } — clicking a tab
// navigates to that URL. Active tab is the one whose path matches the
// current pathname.
//
// Used to merge related pages under a single sidebar nav entry without
// changing URLs:
//   • /batches + /students under "Classes"
//   • /studios + /vendors under "Resources"

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';

export type PageTab = { label: string; path: string };

export default function PageTabs({ tabs }: { tabs: PageTab[] }) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div
      style={{
        display: 'flex',
        gap: 2,
        marginBottom: 22,
        borderBottom: '1px solid var(--border)',
      }}
    >
      {tabs.map((t) => {
        const active = pathname === t.path;
        return (
          <button
            key={t.path}
            onClick={() => router.push(t.path)}
            style={{
              padding: '10px 18px',
              border: 'none',
              background: 'none',
              fontSize: 14,
              fontWeight: active ? 800 : 600,
              color: active ? 'var(--accent)' : 'var(--muted)',
              borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: -1,
              cursor: 'pointer',
              transition: 'color .15s',
              letterSpacing: '-0.005em',
            }}
            onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.color = 'var(--text)'; }}
            onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.color = 'var(--muted)'; }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
