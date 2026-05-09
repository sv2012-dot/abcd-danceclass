'use client';

import React from 'react';

const PRESET: Record<string, string> = {
  Advanced: '#7C3AED',
  Intermediate: '#2563EB',
  Beginner: '#059669',
  Professional: '#D97706',
  Mixed: '#6B7280',
  Paid: '#059669',
  Pending: '#D97706',
  Overdue: '#DC2626',
  Waived: '#6B7280',
  Planning: '#2563EB',
  Confirmed: '#059669',
  Rehearsals: '#D97706',
  Completed: '#6B7280',
  Cancelled: '#DC2626',
};

export default function Badge({ children, color }: { children: any; color?: string }) {
  const key = typeof children === 'string' ? children : '';
  const col = color || PRESET[key] || '#7C3AED';
  const r = parseInt(col.slice(1, 3), 16);
  const g = parseInt(col.slice(3, 5), 16);
  const b = parseInt(col.slice(5, 7), 16);
  return (
    <span style={{
      display: 'inline-block',
      padding: '3px 10px',
      borderRadius: 20,
      fontSize: 11,
      fontWeight: 600,
      background: `rgba(${r},${g},${b},0.12)`,
      color: col,
      border: `1px solid rgba(${r},${g},${b},0.2)`,
      whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  );
}
