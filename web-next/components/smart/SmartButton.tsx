'use client';

import React from 'react';

const PURPLE = '#7C3AED';
const MAGENTA = '#DC4EFF';
const GRAD = `linear-gradient(135deg, ${PURPLE} 0%, ${MAGENTA} 100%)`;

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'sm' | 'md';

type Props = {
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: Variant;
  size?: Size;
  children: React.ReactNode;
  type?: 'button' | 'submit';
  style?: React.CSSProperties;
  title?: string;
};

// Single 4-point sparkle star with one accent dot — matches the icon
// the user mocked for the Smart Add primary CTA. Used universally
// wherever Smart features render (SmartButton + SmartModal header).
const Sparkle = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden style={{ flexShrink: 0 }}>
    <path d="M12 2 L13.6 10.4 L22 12 L13.6 13.6 L12 22 L10.4 13.6 L2 12 L10.4 10.4 Z" />
    <circle cx="19" cy="5" r="1.3" />
  </svg>
);

const Spinner = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden style={{ flexShrink: 0, animation: 'smart-spin 0.8s linear infinite' }}>
    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="3" opacity="0.25" />
    <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

export default function SmartButton({
  onClick,
  disabled,
  loading,
  variant = 'primary',
  size = 'sm',
  children,
  type = 'button',
  style,
  title,
}: Props) {
  const isDisabled = disabled || loading;
  const padY = size === 'sm' ? 7 : 10;
  const padX = size === 'sm' ? 14 : 18;
  const fontSize = size === 'sm' ? 12 : 14;

  const styles: Record<Variant, React.CSSProperties> = {
    primary: {
      background: GRAD,
      color: '#fff',
      border: 'none',
      boxShadow: '0 2px 10px rgba(124,58,237,0.28)',
    },
    secondary: {
      background: 'rgba(124,58,237,0.10)',
      color: PURPLE,
      border: '1.5px solid rgba(124,58,237,0.35)',
      boxShadow: 'none',
    },
    ghost: {
      background: 'transparent',
      color: PURPLE,
      border: '1.5px solid var(--border)',
      boxShadow: 'none',
    },
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: `${padY}px ${padX}px`,
        borderRadius: 8,
        fontWeight: 700,
        letterSpacing: '0.01em',
        fontSize,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.7 : 1,
        transition: 'transform .08s, opacity .15s',
        whiteSpace: 'nowrap',
        ...styles[variant],
        ...style,
      }}
      onMouseDown={(e) => !isDisabled && (e.currentTarget.style.transform = 'scale(0.98)')}
      onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
    >
      <style>{`@keyframes smart-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
      {loading ? <Spinner size={fontSize + 1} /> : <Sparkle size={fontSize + 1} />}
      {children}
    </button>
  );
}
