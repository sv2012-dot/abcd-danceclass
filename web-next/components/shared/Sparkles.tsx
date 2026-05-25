// Single source of truth for the "sparkles" icon used everywhere in
// the app (Smart Add / Announce / Plan buttons + headers, dashboard
// banner, marketing carousel, landing page feature cards).
//
// Path data is the exact public/sparkles.svg the user supplied. To
// change the sparkle icon app-wide, edit only this file.

import React from 'react';

type Props = {
  size?: number;
  stroke?: string;     // CSS color or url(#gradId) for a gradient stroke
  strokeWidth?: number;
  style?: React.CSSProperties;
  className?: string;
};

export default function Sparkles({
  size = 18,
  stroke = 'currentColor',
  strokeWidth = 2,
  style,
  className,
}: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
      style={{ flexShrink: 0, ...style }}
    >
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v4" />
      <path d="M19 17v4" />
      <path d="M3 5h4" />
      <path d="M17 19h4" />
    </svg>
  );
}
