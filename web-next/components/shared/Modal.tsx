'use client';

// Shared modal — used by 4 dashboard pages (batches, studios, recitals, home).
//
// Responsive shape:
//   - Desktop (>= 769px): centered card with backdrop blur, rounded corners,
//     max-width 460/680, max-height 90vh. Click-outside / Escape dismiss.
//   - Mobile (<= 768px): full-screen "page" — no backdrop padding, no rounded
//     corners, fills 100dvh, sticky header. Feels like a route, not a popup.
//     The class .sf-modal-mobile-fullscreen in globals.css drives this with
//     a media query (inline styles can't do media queries).
//
// Body scroll lock:
//   While the modal is open we freeze the underlying page using the
//   position-fixed pattern (not just overflow:hidden, which iOS Safari
//   ignores). This:
//     - prevents the dashboard scroll from bleeding through when the user
//       scrolls inside the modal
//     - eliminates the "gap between modal header and top nav" artefact the
//       user reported, where the underlying page would shift slightly and
//       peek through above the modal
//     - restores the original scroll position on unmount

import React, { useEffect } from 'react';

export default function Modal({ title, onClose, children, wide }: any) {
  // Escape-to-close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Lock body scroll while the modal is mounted.
  // Why position:fixed instead of just overflow:hidden — iOS Safari ignores
  // overflow:hidden on <body>, so the dashboard would still scroll behind
  // the modal and leak a gap above the modal header. position:fixed +
  // top:-scrollY freezes the layout and restoring scrollY on unmount keeps
  // the user where they were.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const scrollY = window.scrollY;
    const body = document.body;
    // Capture previous values so we restore exactly, not blindly clear.
    const prev = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow,
      paddingRight: body.style.paddingRight,
    };
    // Compensate for the vertical scrollbar disappearing when we lock body
    // scroll — without this, desktop layouts shift ~15px right on Windows
    // when the modal opens (and shift back when it closes), producing a
    // jarring jump on the underlying chrome (top nav etc.).
    const scrollbarWidth = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.width = '100%';
    body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;
    return () => {
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.width = prev.width;
      body.style.overflow = prev.overflow;
      body.style.paddingRight = prev.paddingRight;
      // Restore the page to the same scroll position the user was at when
      // the modal opened. Without this, closing the modal jumps to the top.
      window.scrollTo(0, scrollY);
    };
  }, []);

  return (
    <div
      className="sf-modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(20,10,30,0.6)',
        backdropFilter: 'blur(4px)',
        zIndex: 600,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        // Use 100dvh so iOS Safari's collapsing address bar doesn't leave a
        // ghost strip at the bottom of the overlay.
        height: '100dvh',
      }}
    >
      <div
        className="sf-modal-card"
        style={{
          background: 'var(--card)',
          borderRadius: 20,
          width: '100%',
          maxWidth: wide ? 680 : 460,
          maxHeight: '90dvh',
          overflow: 'auto',
          boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
          // Smooth momentum scrolling on iOS for long forms.
          WebkitOverflowScrolling: 'touch',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Sticky header so the title + close stay visible while scrolling
            long forms. position:sticky inside an overflow:auto parent works
            on iOS Safari 13+. */}
        <div
          className="sf-modal-header"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 24px 14px',
            position: 'sticky',
            top: 0,
            background: 'var(--card)',
            zIndex: 1,
            borderBottom: '1px solid transparent', // gets a real border on mobile via CSS
          }}
        >
          <h2 style={{ fontFamily: 'var(--font-d)', fontSize: 18, color: 'var(--text)' }}>{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--muted)',
              cursor: 'pointer',
              fontSize: 24,
              lineHeight: 1,
              padding: '8px 10px',
              // Apple HIG: tap target >= 44pt on mobile
              minWidth: 44,
              minHeight: 44,
              borderRadius: 8,
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            ×
          </button>
        </div>
        <div className="sf-modal-body" style={{ padding: '6px 24px 24px' }}>{children}</div>
      </div>
    </div>
  );
}
