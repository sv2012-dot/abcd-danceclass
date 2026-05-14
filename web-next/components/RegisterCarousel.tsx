'use client';

// RegisterCarousel — 5 auto-rotating slides showcasing ManchQ's key benefits.
// Used on the /register page inside the unified "island" container.
//
// Behavior:
//   - Auto-advance every ~6s (pauses on hover / focus / prefers-reduced-motion)
//   - Manual dots + arrow keys
//   - Swipe on touch devices
//   - Soft cross-fade transition
//   - Line-art SVG icons (matches the homepage feature grid)
//   - No own border-radius — the parent island clips the corners

import { useEffect, useRef, useState } from 'react';

const PURPLE = '#7C3AED';
const MAGENTA = '#DC4EFF';
const GRAD = `linear-gradient(135deg, ${PURPLE} 0%, ${MAGENTA} 100%)`;

// ── Line-art icons (matches the homepage style) ──────────────────────
function LineIcon({ paths, size = 32, color = '#fff', sw = 1.5 }: { paths: string[]; size?: number; color?: string; sw?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      {paths.map((p, i) => <path key={i} d={p} />)}
    </svg>
  );
}

type Slide = {
  iconPaths: string[];
  title: string;
  body: string;
};

const SLIDES: Slide[] = [
  {
    // 1. Free trial — leading hook
    iconPaths: [
      'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z',
    ],
    title: 'Free for 30 days',
    body: 'No credit card. Cancel anytime. Just $5.99/month per studio after.',
  },
  {
    // 2. Smart Add — wand / sparkle
    iconPaths: [
      'M12 3v3',
      'M12 18v3',
      'M3 12h3',
      'M18 12h3',
      'M5.6 5.6l2.1 2.1',
      'M16.3 16.3l2.1 2.1',
      'M5.6 18.4l2.1-2.1',
      'M16.3 7.7l2.1-2.1',
      'M12 8l1.4 2.6L16 12l-2.6 1.4L12 16l-1.4-2.6L8 12l2.6-1.4z',
    ],
    title: 'Smart Add',
    body: 'Paste your week as plain text. AI turns it into scheduled classes in seconds.',
  },
  {
    // 3. Smart Plan — checklist
    iconPaths: [
      'M9 11l3 3L22 4',
      'M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
    ],
    title: 'Smart Plan',
    body: 'Tell ManchQ when your recital is — we generate the full countdown to-do list.',
  },
  {
    // 4. Attendance — check-square
    iconPaths: [
      'M9 11l3 3L22 4',
      'M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
      'M3 8h6M3 12h4M3 16h5',
    ],
    title: 'One-tap attendance',
    body: 'Mark a whole class present in a single tap. Swipe individuals as exceptions.',
  },
  {
    // 5. Smart Reply — message/chat
    iconPaths: [
      'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
      'M8 9h8',
      'M8 13h5',
    ],
    title: 'Smart Reply',
    body: 'Draft parent messages with the right tone in 3 seconds.',
  },
];

const ROTATE_MS = 6000;

export default function RegisterCarousel({ compact = false }: { compact?: boolean }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  useEffect(() => {
    if (paused || reduced) return;
    const t = setInterval(() => setI(prev => (prev + 1) % SLIDES.length), ROTATE_MS);
    return () => clearInterval(t);
  }, [paused, reduced]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft')  { setI(prev => (prev - 1 + SLIDES.length) % SLIDES.length); }
    if (e.key === 'ArrowRight') { setI(prev => (prev + 1) % SLIDES.length); }
  };
  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) {
      setI(prev => dx < 0 ? (prev + 1) % SLIDES.length : (prev - 1 + SLIDES.length) % SLIDES.length);
    }
    touchStartX.current = null;
  };

  const slide = SLIDES[i];

  return (
    <div
      tabIndex={0}
      onKeyDown={onKey}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      role="region"
      aria-label="ManchQ feature highlights"
      aria-roledescription="carousel"
      style={{
        outline: 'none',
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: compact ? 220 : 460,
        background: 'linear-gradient(160deg, #1a0e30 0%, #110820 55%, #1a0e30 100%)',
        // No own border-radius — the parent island clips us. Edges are flush.
        borderRadius: 0,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: compact ? '28px 24px 20px' : '48px 40px 32px',
        boxSizing: 'border-box',
      }}
    >
      {/* Soft gradient blobs */}
      <div aria-hidden style={{
        position: 'absolute', top: -60, right: -40, width: 220, height: 220, borderRadius: '50%',
        background: `radial-gradient(circle, ${MAGENTA}55 0%, transparent 70%)`, pointerEvents: 'none',
      }} />
      <div aria-hidden style={{
        position: 'absolute', bottom: -80, left: -60, width: 260, height: 260, borderRadius: '50%',
        background: `radial-gradient(circle, ${PURPLE}55 0%, transparent 70%)`, pointerEvents: 'none',
      }} />

      {/* Slide content */}
      <div style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div
          key={i}
          style={{
            animation: reduced ? 'none' : 'sf-fade-in 0.55s ease-out',
            color: '#fff',
          }}
        >
          {/* Icon — line-art, white */}
          <div style={{
            width: compact ? 56 : 72,
            height: compact ? 56 : 72,
            borderRadius: 16,
            background: 'rgba(255,255,255,0.06)',
            border: '1.5px solid rgba(255,255,255,0.14)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: compact ? 20 : 28,
          }}>
            <LineIcon paths={slide.iconPaths} size={compact ? 28 : 38} color="#fff" sw={1.5} />
          </div>

          {/* Title — white, large (2x previous size) */}
          <h3 style={{
            fontSize: compact ? 40 : 56,
            fontWeight: 800,
            margin: '0 0 14px',
            letterSpacing: '-1px',
            color: '#fff',
            lineHeight: 1.05,
          }}>
            {slide.title}
          </h3>

          <p style={{
            fontSize: compact ? 14 : 16,
            color: '#D1D5DB',
            margin: 0,
            lineHeight: 1.6,
            maxWidth: 380,
          }}>
            {slide.body}
          </p>
        </div>
      </div>

      {/* Dots */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: 8, justifyContent: compact ? 'center' : 'flex-start', marginTop: 16 }}>
        {SLIDES.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setI(idx)}
            aria-label={`Go to slide ${idx + 1}`}
            aria-current={idx === i}
            style={{
              width: idx === i ? 26 : 7,
              height: 7,
              borderRadius: 99,
              background: idx === i ? GRAD : 'rgba(255,255,255,0.25)',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              transition: 'width .35s ease, background .35s ease',
            }}
          />
        ))}
      </div>

      <style jsx>{`
        @keyframes sf-fade-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
