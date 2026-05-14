'use client';

// RegisterCarousel — 5 auto-rotating slides showcasing ManchQ's key benefits.
// Used on the /register page in the left panel (desktop) / above the form (mobile).
//
// Behavior:
//   - Auto-advance every ~6s (pauses on hover / focus / prefers-reduced-motion)
//   - Manual dots + arrow keys
//   - Swipe on touch devices
//   - Soft cross-fade transition (no slide-from-side)

import { useEffect, useRef, useState } from 'react';

const PURPLE = '#7C3AED';
const MAGENTA = '#DC4EFF';
const GRAD = `linear-gradient(135deg, ${PURPLE} 0%, ${MAGENTA} 100%)`;

type Slide = {
  emoji: string;
  title: string;
  body: string;
};

const SLIDES: Slide[] = [
  {
    emoji: '✨',
    title: 'Smart Add',
    body: 'Paste your week as plain text. AI turns it into scheduled classes in seconds.',
  },
  {
    emoji: '🎬',
    title: 'Smart Plan',
    body: 'Tell ManchQ when your recital is — we generate the full countdown to-do list.',
  },
  {
    emoji: '✅',
    title: 'One-tap attendance',
    body: 'Mark a whole class present in a single tap. Swipe individuals as exceptions.',
  },
  {
    emoji: '📨',
    title: 'Smart Reply',
    body: 'Draft parent messages with the right tone in 3 seconds.',
  },
  {
    emoji: '💌',
    title: 'Free for 30 days',
    body: 'No credit card. Cancel anytime. Just $5.99/month per studio after.',
  },
];

const ROTATE_MS = 6000;

export default function RegisterCarousel({ compact = false }: { compact?: boolean }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const touchStartX = useRef<number | null>(null);

  // Honor prefers-reduced-motion
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  // Auto-rotate
  useEffect(() => {
    if (paused || reduced) return;
    const t = setInterval(() => setI(prev => (prev + 1) % SLIDES.length), ROTATE_MS);
    return () => clearInterval(t);
  }, [paused, reduced]);

  // Arrow keys (only if the carousel is in focus)
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
        height: '100%',
        minHeight: compact ? 180 : 460,
        background: 'linear-gradient(160deg, #1a0e30 0%, #110820 55%, #1a0e30 100%)',
        borderRadius: compact ? 16 : 24,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: compact ? '20px 18px 14px' : '40px 32px 28px',
        boxSizing: 'border-box',
      }}
    >
      {/* Soft gradient blobs (motion-static) */}
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
          key={i /* re-mount triggers fade */}
          style={{
            animation: reduced ? 'none' : 'sf-fade-in 0.55s ease-out',
            color: '#fff',
          }}
        >
          <div style={{ fontSize: compact ? 36 : 56, marginBottom: compact ? 10 : 18, lineHeight: 1 }}>{slide.emoji}</div>
          <h3 style={{
            fontSize: compact ? 20 : 28,
            fontWeight: 800,
            margin: '0 0 10px',
            letterSpacing: '-0.5px',
            background: GRAD,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            lineHeight: 1.15,
          }}>
            {slide.title}
          </h3>
          <p style={{ fontSize: compact ? 14 : 16, color: '#D1D5DB', margin: 0, lineHeight: 1.6, maxWidth: 380 }}>
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
              width: idx === i ? 24 : 7,
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
