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
    // 1. Free forever — leading hook
    iconPaths: [
      'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z',
    ],
    title: 'Free forever',
    body: 'Free forever — no credit card needed. Upgrade to Pro for $5.99/month per studio whenever you outgrow the free tier.',
  },
  {
    // 2. Smart Features — wand / sparkle
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
    title: 'Smart Features',
    body: 'AI turns plain-text prompts into scheduled classes in seconds. Draft WhatsApp-ready messages in one click.',
  },
  {
    // 3. Manage Recitals — music note (matches the homepage recital icon)
    iconPaths: [
      'M9 18V5l12-2v13',
      'M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
      'M18 19a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    ],
    title: 'Manage Recitals',
    body: 'Plan and run your whole recital from one place. AI generates the full countdown to-do list — done for you.',
  },
  {
    // 4. Public Invites — paper plane / send
    iconPaths: [
      'M22 2L11 13',
      'M22 2l-7 20-4-9-9-4z',
    ],
    title: 'Public Invites',
    body: 'Share public recital invites with any guest. No login, no account, and no app required for your invitees.',
  },
  {
    // 5. Manage Classes — calendar
    iconPaths: [
      'M8 2v4',
      'M16 2v4',
      'M3 10h18',
      'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
    ],
    title: 'Manage Classes',
    body: 'Easy scheduling and batch-level preferences. Mark a class present in one tap; swipe individual exceptions.',
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
        // Lighter purple base so the panel reads as distinct from the
        // near-black page background instead of bleeding into it.
        background: 'linear-gradient(160deg, #3a2070 0%, #281550 55%, #3a2070 100%)',
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
      {/* Brighter, more visible corner glows so the panel separates from
          the dark video background instead of bleeding into it. */}
      <div aria-hidden style={{
        position: 'absolute', top: -60, right: -40, width: 240, height: 240, borderRadius: '50%',
        background: `radial-gradient(circle, ${MAGENTA}80 0%, transparent 72%)`, pointerEvents: 'none',
      }} />
      <div aria-hidden style={{
        position: 'absolute', bottom: -80, left: -60, width: 280, height: 280, borderRadius: '50%',
        background: `radial-gradient(circle, ${PURPLE}80 0%, transparent 72%)`, pointerEvents: 'none',
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

          {/* Title — white, large, single-line.
              lineHeight 1.25 + small pad-bottom so descenders ("g", "p", "y")
              don't get clipped by overflow:hidden. */}
          <h3 style={{
            fontSize: compact ? 32 : 44,
            fontWeight: 800,
            margin: '0 0 14px',
            paddingBottom: 2,
            letterSpacing: '-0.6px',
            color: '#fff',
            lineHeight: 1.25,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
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
