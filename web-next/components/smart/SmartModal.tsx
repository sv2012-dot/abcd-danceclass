'use client';

import React, { useEffect } from 'react';

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

const SparkleHeader = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="url(#smartGrad)" aria-hidden style={{ flexShrink: 0 }}>
    <defs>
      <linearGradient id="smartGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#7C3AED" />
        <stop offset="100%" stopColor="#DC4EFF" />
      </linearGradient>
    </defs>
    <path d="M12 2l1.8 5.4L19 9.2l-5.2 1.8L12 16l-1.8-5L5 9.2l5.2-1.8L12 2zM19 14l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3zM5 14l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z" />
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
  // Only lock body scroll / ESC in modal mode. Inline embedding shouldn't
  // hijack global keyboard or scroll behavior.
  useEffect(() => {
    if (!open || inline) return;
    const orig = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = orig;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, inline]);

  if (!open) return null;

  // Inline = render the card content directly with no overlay / centering.
  // Used when the consumer wants the dialog body to appear inside a parent
  // section instead of as a top-level overlay.
  const card = (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        background: 'var(--card)',
        borderRadius: inline ? 12 : 16,
        width: '100%',
        maxWidth: inline ? undefined : maxWidth,
        boxShadow: inline ? 'none' : '0 20px 60px rgba(0,0,0,0.4)',
        border: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: inline ? undefined : 'calc(100vh - 80px)',
      }}
    >
        {/* Header */}
        <div
          style={{
            padding: '18px 20px 14px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <SparkleHeader />
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: 'var(--text)' }}>{title}</h2>
              {subtitle && (
                <p style={{ fontSize: 12, margin: '3px 0 0', color: 'var(--muted)' }}>{subtitle}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--muted)',
              padding: 4,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body — scrollable */}
        <div style={{ padding: '18px 20px', overflowY: 'auto', flex: 1 }}>{children}</div>

        {/* Footer (optional) */}
        {footer && (
          <div
            style={{
              padding: '12px 20px',
              borderTop: '1px solid var(--border)',
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

  // Modal mode: overlay + click-outside-to-close
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(4px)',
        zIndex: 500,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '40px 16px',
        overflowY: 'auto',
      }}
    >
      {card}
    </div>
  );
}
