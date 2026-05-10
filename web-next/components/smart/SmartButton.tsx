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

const Sparkle = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden style={{ flexShrink: 0 }}>
    <path d="M12 2l1.8 5.4L19 9.2l-5.2 1.8L12 16l-1.8-5L5 9.2l5.2-1.8L12 2zM19 14l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3zM5 14l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z" />
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
