'use client';

import React from 'react';
import { useSmartUsage } from './useSmartUsage';

// Silent footer line shown at the bottom of Smart ManchQ modals.
// Only renders after at least one Smart call has happened in this session.
// Color goes from muted gray → amber → red as remaining drops, so a user
// approaching the limit gets a gentle nudge without being shouted at.

export default function SmartUsageFooter() {
  const usage = useSmartUsage();
  if (!usage) return null;

  const { remaining, limit } = usage;
  const used = limit - remaining;
  const ratio = limit > 0 ? remaining / limit : 1;

  // Tier the color based on remaining ratio
  let color = 'var(--muted)';
  if (ratio <= 0.1) color = '#DC2626';        // red — basically out
  else if (ratio <= 0.3) color = '#F59E0B';   // amber — slow down

  return (
    <div
      style={{
        marginTop: 14,
        fontSize: 11,
        color,
        textAlign: 'center',
        letterSpacing: '0.02em',
        fontWeight: 500,
        opacity: 0.85,
      }}
      aria-live="polite"
    >
      {used} of {limit} Smart actions used today
      {remaining === 0 && ' — resets in ~24h'}
    </div>
  );
}
