'use client';

// SmartModal — wrapper used by the Smart Add / Announce / Plan dialogs.
//
// Aligned with the shared <Modal> component pattern so all dialogs in the
// app share the same chrome on mobile:
//   - Portals to document.body (escapes AppShell's overflow:hidden + the
//     dashboard nav's stacking context)
//   - On mobile (<=768px): full-bleed below the 56px AppShell top nav
//     (top:56, bottom:0) so the nav stays clickable above
//   - Body scroll locked while open
//   - X close button on the right of the header
//   - Optional footer renders as a non-sticky strip at the bottom of the
//     card body (callers pass primary CTA / cancel into footer)

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: number;
  // When true, renders inline (no fixed overlay, no body-scroll lock).
  // Used when embedding the modal content directly inside a parent panel.
  inline?: boolean;
};

const TOP_NAV_H = 56;

// Header sparkle — same Lucide "sparkles" path as the SmartButton
// Sparkle. Stroked with the brand gradient (vs SmartButton's
// currentColor) so it reads as the Smart feature accent in the
// modal header. Sized 24 to be visually weighty next to the title.
const SparkleHeader = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="url(#smartGrad)"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
    style={{ flexShrink: 0 }}
  >
    <defs>
      <linearGradient id="smartGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#7C3AED" />
        <stop offset="100%" stopColor="#DC4EFF" />
      </linearGradient>
    </defs>
    <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
    <path d="M20 3v4" />
    <path d="M22 5h-4" />
    <path d="M4 17v2" />
    <path d="M5 18H3" />
  </svg>
);

export default function SmartModal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = 640,
  inline = false,
}: Props) {
  // Portal target must mount client-side.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Listen for the global "dismiss all modals" event the AppShell top nav
  // dispatches when the school name / hamburger is clicked.
  useEffect(() => {
    if (!open || inline) return;
    const handler = () => onClose();
    window.addEventListener('sf:dismiss-modals', handler);
    return () => window.removeEventListener('sf:dismiss-modals', handler);
  }, [open, onClose, inline]);

  // Lock body scroll + Escape-to-close while the modal is open.
  // Uses the position:fixed pattern (matches the shared <Modal>) so iOS
  // Safari can't scroll the page underneath the overlay.
  useEffect(() => {
    if (!open || inline || typeof window === 'undefined') return;
    const scrollY = window.scrollY;
    const body = document.body;
    const prev = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow,
      paddingRight: body.style.paddingRight,
    };
    const scrollbarWidth = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.width = '100%';
    body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.width = prev.width;
      body.style.overflow = prev.overflow;
      body.style.paddingRight = prev.paddingRight;
      window.removeEventListener('keydown', onKey);
      window.scrollTo(0, scrollY);
    };
  }, [open, onClose, inline]);

  if (!open) return null;

  const card = (
    <div
      onClick={(e) => e.stopPropagation()}
      className="sf-modal-card"
      style={{
        background: 'var(--card)',
        borderRadius: inline ? 12 : 16,
        width: '100%',
        maxWidth: inline ? undefined : maxWidth,
        boxShadow: inline ? 'none' : '0 20px 60px rgba(0,0,0,0.4)',
        border: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: inline ? undefined : '90dvh',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {/* Header — non-sticky, compact. Matches the shared <Modal>'s
          padding/layout. The vertical sparkle bar sits to the left of
          the title in lieu of the typed accent bar used elsewhere. */}
      {/* Header — title + sparkle icon ONLY, no subtitle. Subtitle/
          description text (when passed) renders as a standalone
          paragraph at the top of the body so it visually separates
          from the title bar instead of crowding it. */}
      <div
        className="sf-modal-header"
        style={{
          padding: '12px 14px 12px 18px',
          background: 'var(--card)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          borderBottom: '1px solid transparent',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <SparkleHeader />
          <h2 className="sf-modal-title" style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--text)', fontFamily: 'var(--font-d)' }}>{title}</h2>
        </div>
        <button
          className="sf-modal-close-x"
          onClick={onClose}
          aria-label="Close"
          style={{
            marginLeft: 'auto',
            background: 'none',
            border: 'none',
            color: 'var(--muted)',
            cursor: 'pointer',
            fontSize: 22,
            lineHeight: 1,
            padding: 0,
            width: 36,
            height: 36,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 8,
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent',
            flexShrink: 0,
          }}
        >
          ×
        </button>
      </div>

      {/* Body — scrollable. Subtitle (if any) renders as a body
          paragraph here so it's visually separated from the title row. */}
      <div className="sf-modal-body" style={{ padding: '6px 20px 20px', overflowY: 'auto', flex: 1 }}>
        {subtitle && (
          <p style={{ fontSize: 13, margin: '8px 0 18px', color: 'var(--muted)', lineHeight: 1.55 }}>{subtitle}</p>
        )}
        {children}
      </div>

      {/* Footer (optional). Flows with the form per the same pattern
          as the Create New Event CTA row (no border-top separator). */}
      {footer && (
        <div
          style={{
            padding: '12px 20px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 10,
            flexShrink: 0,
          }}
        >
          {footer}
        </div>
      )}
    </div>
  );

  // Inline mode: just the card, no overlay
  if (inline) return card;

  if (!mounted) return null;

  // Overlay — Portal to body so the dashboard nav's stacking context
  // can't trap us. CSS @media (max-width: 768px) in globals.css
  // overrides top to 56px so the modal slots below the AppShell nav.
  const overlay = (
    <div
      className="sf-modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
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
      {card}
    </div>
  );

  return createPortal(overlay, document.body);
}
