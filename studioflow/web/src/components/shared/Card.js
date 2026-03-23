import React, { useState } from 'react';

// ── Card design tokens — the single source of truth for ALL card visuals ──────
// Import CARD_TOKENS in any page that needs card-adjacent styling (batch rows,
// schedule items, etc.) so every surface stays visually consistent.
export const CARD_TOKENS = {
  bg:           '#FFFFFF',
  border:       '#EAECF0',
  borderWidth:  '1.5px',
  radius:       14,      // default container card
  radiusRow:    10,      // list-item row card
  shadow:       '0 1px 3px rgba(0,0,0,.05)',
  shadowHover:  '0 4px 16px rgba(0,0,0,.08)',
  shadowPress:  '0 2px 8px rgba(0,0,0,.10)',
  // Selected / active state
  activeBorder: '#7C3AED',
  activeRing:   '0 0 0 3px rgba(124,58,237,.12)',
};

/**
 * Card — the unified card component for the entire app.
 *
 * variant   "default"  Container / widget. Border + subtle shadow.
 *           "row"      List-item row. No shadow, tighter radius (10 px).
 *           "flat"     Border only, no shadow. Table wrappers, form panels.
 *
 * clickable  Pointer cursor + hover / press shadow transitions.
 * active     Selected state: purple border + glow ring.
 * padding    Override the variant default.
 * style      Extra inline overrides (applied last — can override anything).
 */
export default function Card({
  children,
  variant = 'default',
  clickable,
  active,
  padding,
  style,
  onClick,
  className,
}) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const isClickable = !!(clickable || onClick);
  const T = CARD_TOKENS;

  const base = {
    default: { borderRadius: T.radius,    padding: padding ?? 20,          shadow: T.shadow   },
    row:     { borderRadius: T.radiusRow, padding: padding ?? '12px 16px', shadow: 'none'     },
    flat:    { borderRadius: T.radius,    padding: padding ?? 20,          shadow: 'none'     },
  }[variant] || { borderRadius: T.radius, padding: padding ?? 20, shadow: T.shadow };

  const shadow = active    ? T.activeRing
               : pressed   ? T.shadowPress
               : hovered   ? T.shadowHover
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
        background:   T.bg,
        border:       `${T.borderWidth} solid ${active ? T.activeBorder : T.border}`,
        borderRadius: base.borderRadius,
        padding:      base.padding,
        boxShadow:    shadow,
        cursor:       isClickable ? 'pointer' : 'default',
        transition:   'box-shadow .18s, border-color .18s',
        boxSizing:    'border-box',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
