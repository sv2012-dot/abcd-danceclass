// /ipad layout — minimal touch-friendly shell hardened for iPad WebKit.
//
// Deliberately stripped down: no React Portal modals, no fancy sidebar, no
// dependency on any (dashboard) components. The whole /ipad app is a flat set
// of full-page screens linked via plain <a href> so iPad Safari/Chrome can
// never lose tap handling.
//
// Viewport / iOS defenses applied here:
//   - viewport-fit=cover  → makes env(safe-area-inset-*) values non-zero on
//                            iPad Pro / iPads with notch, so we can pad
//                            content away from the home indicator
//   - maximum-scale=1     → no pinch-zoom during demo (intentional)
//   - apple-mobile-web-app-capable → if added to home screen, runs full-screen
//   - status-bar-style    → matches the demo's purple/light theme

import React from 'react';
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'ManchQ — iPad Demo',
  other: {
    // Add-to-Home-Screen / standalone mode appearance on iPad
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'default',
    'apple-mobile-web-app-title': 'ManchQ',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function IpadLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="ipad-root"
      style={{
        // 100dvh > 100vh on iPad: dvh accounts for the Safari address bar
        // expanding/collapsing during scroll, so the layout doesn't get a
        // mystery 60-80px gap at the bottom mid-scroll.
        minHeight: '100dvh',
        background: 'var(--background)',
        color: 'var(--foreground)',
        // Disable iOS double-tap-zoom + 300ms tap delay globally for /ipad.
        // Same defenses we use on individual buttons in the main app, scoped
        // here to the whole /ipad subtree.
        touchAction: 'manipulation',
        WebkitTapHighlightColor: 'transparent',
        WebkitTouchCallout: 'none',
        // Stop iOS from auto-resizing text when the iPad rotates between
        // landscape and portrait.
        WebkitTextSizeAdjust: '100%',
        // Block pull-to-refresh / rubber-band scroll from bubbling up through
        // /ipad. Important because a tap-and-drag during demo could otherwise
        // reload the page or expose the parent scroll.
        overscrollBehavior: 'contain',
        // Pad inside the safe-area on iPads with notch / home indicator.
        // env() returns 0 on non-notched iPads so this is a no-op there.
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      {children}
    </div>
  );
}
