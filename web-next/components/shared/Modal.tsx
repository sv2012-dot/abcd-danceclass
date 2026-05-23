'use client';

// Shared modal — used by 4 dashboard pages (batches, studios, recitals, home).
//
// Responsive shape:
//   - Desktop (>= 769px): centered card with backdrop blur, rounded corners,
//     max-width 460/680, max-height 90vh. Click-outside / Escape dismiss.
//     Header shows the title left + an X close button on the right.
//   - Mobile (<= 768px): full-bleed "page" that slots BELOW the 56px
//     AppShell top nav (top:56, bottom:0) so the dashboard nav stays
//     visible above and the page scrolls below it — same chrome pattern as
//     the recital details page. Header shows a rounded Back pill on the
//     left (matching the recital details back pill) and the title beside
//     it; the desktop X is hidden via CSS on mobile.
//
// Why we Portal to document.body:
//   The modal is rendered from inside AppShell's <main> (overflow:auto)
//   which sits below a static dashboard top nav. Nested inside that tree,
//   even position:fixed had stacking-order issues on iOS where the nav
//   could win over the modal. Portaling removes the modal from that
//   tree entirely; positioning is then purely vs the viewport.
//
// Body scroll lock:
//   While the modal is open we freeze the underlying page using the
//   position-fixed pattern (not just overflow:hidden, which iOS Safari
//   ignores). On mobile, window.scrollY is always 0 on the dashboard
//   (AppShell main is the only scroller), so the position:fixed top:0
//   doesn't shift the nav up — it stays put at viewport y=0.

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

// AppShell top nav height — modal slots directly below this on mobile.
const TOP_NAV_H = 56;

export default function Modal({ title, onClose, children, wide }: any) {
  // Portal target is mounted client-side; SSR pass renders nothing so the
  // markup doesn't appear in the dashboard tree during hydration.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Escape-to-close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Lock body scroll while the modal is mounted.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const scrollY = window.scrollY;
    const body = document.body;
    const prev = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow,
      paddingRight: body.style.paddingRight,
    };
    // Compensate for the vertical scrollbar disappearing when we lock body
    // scroll — without this, desktop layouts shift ~15px right on Windows
    // when the modal opens (and shift back when it closes).
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
      window.scrollTo(0, scrollY);
    };
  }, []);

  if (!mounted) return null;

  const node = (
    <div
      className="sf-modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed',
        // Desktop default — full viewport. Mobile overrides top:TOP_NAV_H
        // via the .sf-modal-overlay @media rule in globals.css so the
        // dashboard nav stays visible above the modal.
        inset: 0,
        background: 'rgba(20,10,30,0.6)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
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
          WebkitOverflowScrolling: 'touch',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Sticky header — stays visible while scrolling long forms. */}
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
            gap: 12,
            borderBottom: '1px solid transparent', // real border on mobile via CSS
          }}
        >
          {/* Mobile-only Back pill — same shape as the recital details back
              button (rounded pill, arrow + Back label). Hidden on desktop
              via .sf-modal-back-pill CSS. */}
          <button
            className="sf-modal-back-pill"
            onClick={onClose}
            aria-label="Back"
            style={{
              display: 'none', // shown on mobile via globals.css media query
              alignItems: 'center',
              gap: 6,
              padding: '7px 14px 7px 11px',
              borderRadius: 20,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              minHeight: 36,
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent',
              flexShrink: 0,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            Back
          </button>

          <h2 className="sf-modal-title" style={{ fontFamily: 'var(--font-d)', fontSize: 18, color: 'var(--text)' }}>{title}</h2>

          {/* Desktop X close — hidden on mobile (the Back pill is the
              dismiss UI there). */}
          <button
            className="sf-modal-close-x"
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

  return createPortal(node, document.body);
}
