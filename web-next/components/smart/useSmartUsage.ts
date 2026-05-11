'use client';

// Small hook that listens to the 'sf:smart-usage' window event dispatched by
// lib/api/client.ts after each Smart ManchQ API call and exposes the latest
// limit / remaining / resetInSeconds.

import { useEffect, useState } from 'react';

export type SmartUsage = {
  remaining: number;
  limit: number;
  resetInSeconds: number | null;
};

let _lastSnapshot: SmartUsage | null = null;  // module-level cache for new mounts

export function useSmartUsage() {
  const [usage, setUsage] = useState<SmartUsage | null>(_lastSnapshot);

  useEffect(() => {
    const fn = (ev: any) => {
      const next = ev.detail as SmartUsage;
      _lastSnapshot = next;
      setUsage(next);
    };
    window.addEventListener('sf:smart-usage', fn);
    return () => window.removeEventListener('sf:smart-usage', fn);
  }, []);

  return usage;
}
