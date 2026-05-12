'use client';

// RosterTabs — header tab bar rendered at the top of /batches and /students.
// Lets the user flip between the two views without bouncing through the
// sidebar nav. Page contents stay in their own routes — URLs preserved.

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';

const TABS: { label: string; path: string }[] = [
  { label: 'Batches',  path: '/batches'  },
  { label: 'Students', path: '/students' },
];

export default function RosterTabs() {
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
      {TABS.map((t) => {
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
