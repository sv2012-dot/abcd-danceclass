import React, { useState } from 'react';

// ── Shared gradient — matches app accent system (#7C3AED purple → #D946EF fuchsia)
export const BTN_GRAD = 'linear-gradient(135deg, #7C3AED 0%, #D946EF 100%)';

const BASE = {
  primary: {
    background: BTN_GRAD,
    color: '#fff',
    border: 'none',
    boxShadow: '0 2px 12px rgba(124,58,237,0.28)',
  },
  secondary: {
    background: 'var(--surface)',
    color: 'var(--text)',
    border: '1.5px solid var(--border)',
    boxShadow: 'none',
  },
  outline: {
    background: 'transparent',
    color: 'var(--text)',
    border: '1.5px solid var(--border)',
    boxShadow: 'none',
  },
  danger: {
    background: '#e05c6a',
    color: '#fff',
    border: 'none',
    boxShadow: 'none',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--text)',
    border: 'none',
    boxShadow: 'none',
  },
};

const HOVER = {
  primary:   { boxShadow: '0 4px 22px rgba(124,58,237,0.42)', transform: 'translateY(-1px)', filter: 'brightness(1.06)' },
  secondary: { background: 'var(--border)' },
  outline:   { background: 'var(--surface)' },
  danger:    { filter: 'brightness(1.1)', boxShadow: '0 2px 10px rgba(224,92,106,0.35)' },
  ghost:     { background: 'var(--surface)' },
};

const SIZES = {
  sm: { padding: '6px 14px',  fontSize: 12, borderRadius: 8  },
  md: { padding: '10px 22px', fontSize: 14, borderRadius: 12 },
  lg: { padding: '13px 28px', fontSize: 15, borderRadius: 12 },
};

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  onClick,
  disabled,
  type = 'button',
  style: s,
  icon,
}) {
  const [hov, setHov] = useState(false);

  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    fontWeight: variant === 'primary' ? 700 : 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all .15s',
    fontFamily: '"Open Sans", system-ui, sans-serif',
    opacity: disabled ? 0.5 : 1,
    lineHeight: 1,
    whiteSpace: 'nowrap',
    textDecoration: 'none',
    letterSpacing: variant === 'primary' ? '0.01em' : 'normal',
  };

  const variantStyle = {
    ...BASE[variant],
    ...(hov && !disabled ? HOVER[variant] : {}),
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ ...base, ...variantStyle, ...SIZES[size], ...s }}
    >
      {icon && <span style={{ display: 'inline-flex' }}>{icon}</span>}
      {children}
    </button>
  );
}
