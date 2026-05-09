'use client';

import React, { useState } from 'react';

export const CARD_TOKENS = {
  bg: 'var(--card)',
  border: 'var(--border)',
  borderWidth: '1.5px',
  radius: 14,
  radiusRow: 10,
  shadow: '0 1px 3px rgba(0,0,0,.05)',
  shadowHover: '0 4px 16px rgba(0,0,0,.08)',
  shadowPress: '0 2px 8px rgba(0,0,0,.10)',
  activeBorder: '#7C3AED',
  activeRing: '0 0 0 3px rgba(124,58,237,.12)',
};

export default function Card({
  children,
  variant = 'default',
  clickable,
  active,
  padding,
  style,
  onClick,
  className,
}: any) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const isClickable = !!(clickable || onClick);
  const T = CARD_TOKENS;

  const variants: Record<string, any> = {
    default: { borderRadius: T.radius, padding: padding ?? 20, shadow: T.shadow },
    row: { borderRadius: T.radiusRow, padding: padding ?? '12px 16px', shadow: 'none' },
    flat: { borderRadius: T.radius, padding: padding ?? 20, shadow: 'none' },
  };
  const base = variants[variant] || variants.default;

  const shadow = active
    ? T.activeRing
    : pressed
    ? T.shadowPress
    : hovered
    ? T.shadowHover
    : base.shadow;

  return (
    <div
      className={className}
      onClick={onClick}
      onMouseEnter={() => isClickable && setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => isClickable && setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{
        background: T.bg,
        border: `${T.borderWidth} solid ${active ? T.activeBorder : T.border}`,
        borderRadius: base.borderRadius,
        padding: base.padding,
        boxShadow: shadow,
        cursor: isClickable ? 'pointer' : 'default',
        transition: 'box-shadow .18s, border-color .18s',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
