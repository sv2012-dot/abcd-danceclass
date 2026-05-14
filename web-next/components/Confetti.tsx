'use client';

// Lightweight CSS-only confetti. No external deps.
// 80 small colored rectangles drop from above the viewport at random
// columns / delays / speeds / rotations. Pauses honoring prefers-reduced-motion.
// Fixed-position, pointer-events: none — purely decorative.

import { useEffect, useMemo, useState } from 'react';

const COLORS = ['#7C3AED', '#DC4EFF', '#F59E0B', '#10B981', '#EF4444', '#3B82F6'];

export default function Confetti({
  pieces = 80,
  durationSec = 4,
}: {
  pieces?: number;
  durationSec?: number;
}) {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  const items = useMemo(() => {
    if (reduced) return [];
    return Array.from({ length: pieces }, (_, i) => ({
      key: i,
      left: Math.random() * 100,
      color: COLORS[i % COLORS.length],
      delay: Math.random() * 1.5,
      duration: 2.5 + Math.random() * 2.5,
      rotate: Math.random() * 360,
      width: 6 + Math.random() * 7,
      height: 9 + Math.random() * 8,
      drift: (Math.random() - 0.5) * 80, // horizontal drift in vw
    }));
  }, [pieces, reduced]);

  if (reduced) return null;

  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 9999,
        overflow: 'hidden',
      }}
    >
      {items.map((p) => (
        <span
          key={p.key}
          style={{
            position: 'absolute',
            top: -24,
            left: `${p.left}%`,
            width: p.width,
            height: p.height,
            background: p.color,
            opacity: 0.92,
            borderRadius: 2,
            transform: `rotate(${p.rotate}deg)`,
            // @ts-ignore — custom CSS var
            ['--drift' as any]: `${p.drift}vw`,
            animation: `sf-confetti-fall ${p.duration}s ${p.delay}s linear forwards`,
          }}
        />
      ))}
      <style jsx global>{`
        @keyframes sf-confetti-fall {
          to {
            transform: translate(var(--drift, 0vw), 110vh) rotate(720deg);
            opacity: 0.55;
          }
        }
      `}</style>
    </div>
  );
}
