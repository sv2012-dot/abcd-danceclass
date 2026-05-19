'use client';

// useUpgradeOnLimit — listens for 402 / 429 responses fired from the
// API client and surfaces an UpgradeModal automatically. Mount once
// near the top of the dashboard layout; pages don't need to handle
// limit errors individually.
//
// Wire-up:
//   - lib/api/client.ts dispatches a CustomEvent('sf:limit-reached', {
//       detail: { resource: 'batches'|'students'|... , current, limit }
//     }) on 402/429 responses.
//   - This hook listens, owns the modal-open state, and renders the
//     UpgradeModal mounted at the dashboard layout level.

import { useEffect, useState } from 'react';
import type { LimitKey } from './UpgradeModal';

type LimitEvent = {
  resource: LimitKey | string;
  current?: number;
  limit?: number;
};

// Map backend resource names → modal LimitKey. Some backend names
// (ai_daily) don't match the UI keys exactly.
function normalizeResource(r: string): LimitKey | null {
  if (r === 'batches' || r === 'students' || r === 'recitals' || r === 'team' || r === 'ai') return r;
  if (r === 'ai_daily') return 'ai';
  if (r === 'team_members') return 'team';
  return null;
}

export function useUpgradeOnLimit() {
  const [state, setState] = useState<{ open: boolean; limit: LimitKey | null; current?: number; cap?: number }>({
    open: false, limit: null,
  });

  useEffect(() => {
    const onLimit = (e: Event) => {
      const detail = (e as CustomEvent<LimitEvent>).detail || ({} as LimitEvent);
      const limit = normalizeResource(String(detail.resource || ''));
      if (!limit) return;
      setState({ open: true, limit, current: detail.current, cap: detail.limit });
    };
    window.addEventListener('sf:limit-reached', onLimit);
    return () => window.removeEventListener('sf:limit-reached', onLimit);
  }, []);

  const close = () => setState({ open: false, limit: null });

  return { ...state, close };
}
