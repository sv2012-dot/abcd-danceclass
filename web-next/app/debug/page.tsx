'use client';

// /debug — touch-event diagnostic page for the iPad click issue.
//
// This page is intentionally bare-bones (no shared layout, no providers
// pulling in side effects). If taps DON'T register here, the problem is
// environmental (browser, OS, network). If taps DO register here but not
// on the homepage, the homepage has a layout-level blocker.
//
// Safe to leave in prod — unlinked from the rest of the app, just sits at
// /debug for diagnostic use.

import { useEffect, useRef, useState } from 'react';

type TapEvent = {
  ts: string;
  type: string;
  target: string;
  coords: string;
};

export default function DebugPage() {
  const [tapCount, setTapCount] = useState(0);
  const [events, setEvents] = useState<TapEvent[]>([]);
  const [ua, setUa] = useState('');
  const [viewport, setViewport] = useState('');
  const [scrollY, setScrollY] = useState(0);
  const logRef = useRef<TapEvent[]>([]);

  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    setUa(navigator.userAgent);
    setViewport(`${window.innerWidth}×${window.innerHeight} · dpr ${window.devicePixelRatio}`);

    function logEvent(type: string, e: any) {
      const target = e.target instanceof Element ? `${e.target.tagName}${e.target.id ? '#' + e.target.id : ''}` : '?';
      const x = e.touches?.[0]?.clientX ?? e.clientX ?? '?';
      const y = e.touches?.[0]?.clientY ?? e.clientY ?? '?';
      const entry: TapEvent = {
        ts: new Date().toISOString().slice(11, 23),
        type,
        target,
        coords: `${x},${y}`,
      };
      logRef.current = [entry, ...logRef.current].slice(0, 12);
      setEvents([...logRef.current]);
    }

    const onTouchStart = (e: TouchEvent) => logEvent('touchstart', e);
    const onPointerDown = (e: PointerEvent) => logEvent('pointerdown', e);
    const onClick = (e: MouseEvent) => logEvent('click', e);
    const onScroll = () => setScrollY(window.scrollY);

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('click', onClick);
    window.addEventListener('scroll', onScroll);
    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('click', onClick);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      padding: 20,
      background: '#0a0a0f',
      color: '#f5f5f7',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      lineHeight: 1.5,
    }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 8px' }}>Tap diagnostic</h1>
      <p style={{ fontSize: 13, color: '#9ca3af', margin: '0 0 16px' }}>
        Tap anywhere. Big buttons should bump the counter. The log below shows every touch/pointer/click your device fires.
      </p>

      <div style={{
        background: '#1a1a26',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        fontSize: 12,
        fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
        color: '#9ca3af',
      }}>
        <div><b style={{ color: '#fff' }}>UA</b>: {ua || '…'}</div>
        <div><b style={{ color: '#fff' }}>Viewport</b>: {viewport || '…'}</div>
        <div><b style={{ color: '#fff' }}>Scroll Y</b>: {scrollY}</div>
        <div><b style={{ color: '#fff' }}>Counter</b>: {tapCount}</div>
        <div><b style={{ color: '#fff' }}>Build</b>: debug-v1</div>
      </div>

      <button
        type="button"
        onClick={() => setTapCount(c => c + 1)}
        style={{
          width: '100%',
          padding: '20px 24px',
          background: 'linear-gradient(135deg, #7C3AED, #DC4EFF)',
          color: '#fff',
          fontSize: 18,
          fontWeight: 800,
          border: 'none',
          borderRadius: 14,
          cursor: 'pointer',
          marginBottom: 12,
          touchAction: 'manipulation',
        }}
      >
        Tap me · Big button
      </button>

      <a
        href="/login"
        style={{
          display: 'block',
          textAlign: 'center',
          padding: '16px 24px',
          background: '#1a1a26',
          color: '#fff',
          fontSize: 16,
          fontWeight: 700,
          border: '1.5px solid rgba(255,255,255,0.18)',
          borderRadius: 12,
          marginBottom: 12,
          textDecoration: 'none',
          touchAction: 'manipulation',
        }}
      >
        Plain &lt;a&gt; link → /login
      </a>

      <a
        href="/"
        style={{
          display: 'block',
          textAlign: 'center',
          padding: '16px 24px',
          background: '#1a1a26',
          color: '#fff',
          fontSize: 16,
          fontWeight: 700,
          border: '1.5px solid rgba(255,255,255,0.18)',
          borderRadius: 12,
          marginBottom: 24,
          textDecoration: 'none',
          touchAction: 'manipulation',
        }}
      >
        Plain &lt;a&gt; link → / (homepage)
      </a>

      <h2 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 8px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        Event log (newest first, max 12)
      </h2>
      <div style={{
        background: '#1a1a26',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12,
        padding: 12,
        fontSize: 11,
        fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
        color: '#d1d5db',
        minHeight: 200,
      }}>
        {events.length === 0 && (
          <div style={{ color: '#6b7280', fontStyle: 'italic' }}>
            (no events yet — tap anywhere to start logging)
          </div>
        )}
        {events.map((e, i) => (
          <div key={i} style={{
            padding: '4px 0',
            borderBottom: i < events.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
          }}>
            <span style={{ color: '#6b7280' }}>{e.ts}</span>
            <span style={{
              color: e.type === 'click' ? '#10b981' : e.type === 'pointerdown' ? '#fbbf24' : '#7C3AED',
              fontWeight: 700,
              minWidth: 80,
            }}>{e.type}</span>
            <span style={{ color: '#fff' }}>{e.target}</span>
            <span style={{ color: '#6b7280' }}>({e.coords})</span>
          </div>
        ))}
      </div>

      <p style={{ fontSize: 11, color: '#6b7280', marginTop: 16, lineHeight: 1.6 }}>
        <b style={{ color: '#9ca3af' }}>What to look for:</b><br/>
        • <b>touchstart</b> fires on every finger-down — if you tap and don't see it, the OS is swallowing the event.<br/>
        • <b>pointerdown</b> is the modern unified event — should fire alongside touchstart.<br/>
        • <b>click</b> is the final tap — if touchstart fires but click doesn't, a gesture recognizer is hijacking the tap.
      </p>
    </div>
  );
}
