// /ipad layout — minimal touch-friendly shell.
//
// Deliberately stripped down: no React Portal modals, no fancy sidebar, no
// dependency on any (dashboard) components. The whole /ipad app is a flat set
// of full-page screens linked via plain <a href> so iPad Safari/Chrome can
// never lose tap handling.

import React from 'react';

export const metadata = {
  title: 'ManchQ — iPad Demo',
};

export default function IpadLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--background)',
        color: 'var(--foreground)',
        // Disable iOS double-tap-zoom + tap delay globally for /ipad.
        // Same defenses we use on individual buttons in the main app, scoped
        // here to the whole /ipad subtree.
        touchAction: 'manipulation',
        WebkitTapHighlightColor: 'transparent',
        WebkitTouchCallout: 'none',
      }}
    >
      {children}
    </div>
  );
}
