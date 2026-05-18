'use client';

// ── Google Analytics 4 — App Router compatible ─────────────────────────
// The old CRA index.html dropped two gtag.js scripts in <head> and that
// was enough for a multi-page site. App Router is a SPA: route changes
// don't refire the script, so GA's auto-tracked "page_view" only logs
// the initial load. We patch that by listening to usePathname /
// useSearchParams and pushing a manual page_view to dataLayer on every
// nav.
//
// Measurement ID is read from NEXT_PUBLIC_GA_MEASUREMENT_ID with a
// fallback to the property the old CRA build was using so we don't
// orphan the existing GA dashboard while env vars get wired up.

import Script from 'next/script';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, Suspense } from 'react';

const FALLBACK_GA_ID = 'G-V209G5KWYS'; // legacy ID from CRA build

function GAPageViewListener({ gaId }: { gaId: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname || typeof window === 'undefined') return;
    const w = window as any;
    if (typeof w.gtag !== 'function') return;
    const url = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '');
    w.gtag('event', 'page_view', {
      page_path: url,
      page_location: window.location.href,
      page_title: document.title,
      send_to: gaId,
    });
  }, [pathname, searchParams, gaId]);

  return null;
}

export default function GoogleAnalytics() {
  const gaId = (process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || FALLBACK_GA_ID).trim();
  if (!gaId) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          // send_page_view: false → we fire page_view manually on each
          // route change via <GAPageViewListener/>, otherwise the
          // initial config fires one AND we fire another → double-count.
          gtag('config', '${gaId}', { send_page_view: false });
          // Fire the very first page view explicitly so the listener
          // useEffect (which fires on subsequent route changes) doesn't
          // miss the landing-page hit.
          gtag('event', 'page_view', {
            page_path: window.location.pathname + window.location.search,
            page_location: window.location.href,
            page_title: document.title,
          });
        `}
      </Script>
      <Suspense fallback={null}>
        <GAPageViewListener gaId={gaId} />
      </Suspense>
    </>
  );
}
