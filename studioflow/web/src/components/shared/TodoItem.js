import React, { useState, useRef, useEffect } from 'react';
import Card from './Card';

/* ─── helpers ─────────────────────────────────────── */
export function formatDueDate(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = (dateStr || '').slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

export function isOverdue(dateStr) {
  if (!dateStr) return false;
  const [y, m, d] = (dateStr || '').slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return false;
  const due = new Date(y, m - 1, d);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return due < today;
}

/* ─── animation keyframes ─────────────────────────── */
export const TodoKeyframeStyles = () => (
  <style>{`
    @keyframes checkBounce {
      0%   { transform: scale(0.3);  }
      35%  { transform: scale(1.50); }
      60%  { transform: scale(0.85); }
      80%  { transform: scale(1.12); }
      100% { transform: scale(1);    }
    }
    @keyframes checkDraw {
      from { stroke-dashoffset: 30; }
      to   { stroke-dashoffset: 0;  }
    }
    /* Real confetti: burst up, arc out, fall with gravity, flutter (scaleX flip) */
    @keyframes confettiRain {
      0%   {
        opacity: 1;
        transform: translate(0, 0) rotate(0deg) scaleX(1);
      }
      20%  {
        opacity: 1;
        transform: translate(calc(var(--tx) * .38), calc(var(--arc)))
                   rotate(calc(var(--tr) * .25)) scaleX(-0.6);
      }
      50%  {
        opacity: 1;
        transform: translate(calc(var(--tx) * .68), calc(var(--arc) * .25 + var(--ty) * .42))
                   rotate(calc(var(--tr) * .58)) scaleX(0.85);
      }
      80%  {
        opacity: 0.85;
        transform: translate(calc(var(--tx) * .9), calc(var(--ty) * .82))
                   rotate(calc(var(--tr) * .85)) scaleX(-0.4);
      }
      100% {
        opacity: 0;
        transform: translate(var(--tx), var(--ty)) rotate(var(--tr)) scaleX(0.2);
      }
    }
  `}</style>
);

export const CONFETTI_COLORS = [
  '#7C3AED','#DC4EFF','#34c759','#f4a041',
  '#6a7fdb','#FF6B6B','#22d3ee','#f59e0b',
  '#e879f9','#4ade80','#fb923c','#38bdf8',
];

/* ─── icons ──────────────────────────────────────── */
export const TrashIcon = ({ onClick }) => (
  <button
    onClick={onClick}
    title="Delete"
    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c7c7cc', padding: 4, display: 'flex', alignItems: 'center', flexShrink: 0 }}
    onMouseEnter={e => { e.currentTarget.style.color = '#ff3b30'; }}
    onMouseLeave={e => { e.currentTarget.style.color = '#c7c7cc'; }}
  >
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3,6 5,6 21,6" />
      <path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a1,1,0,0,1,1-1h4a1,1,0,0,1,1,1v2" />
    </svg>
  </button>
);

export const PersonIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);

export const CalSmIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);

/* ─── animated check circle ───────────────────────── */
export const AnimatedCheckCircle = ({ visuallyComplete, animating, particles, onClick }) => (
  <div style={{ position: 'relative', width: 20, height: 20, flexShrink: 0 }}>
    {/* Confetti burst — real paper shapes with arc + flutter */}
    {animating && particles.map((p, i) => (
      <span key={i} style={{
        position: 'absolute', top: '50%', left: '50%',
        width: p.w, height: p.h,
        marginTop: -p.h / 2, marginLeft: -p.w / 2,
        borderRadius: 1,
        background: p.color,
        '--tx':  `${Math.round(Math.cos(p.angle) * p.distance)}px`,
        '--ty':  `${Math.round(Math.sin(p.angle) * p.distance)}px`,
        '--tr':  `${p.rotation}deg`,
        '--arc': `${p.arc}px`,
        animation: `confettiRain ${1.5 + (i % 6) * 0.12}s cubic-bezier(0.22,0.68,0,1.2) ${i * 0.018}s forwards`,
        pointerEvents: 'none', zIndex: 20, display: 'block',
      }} />
    ))}
    {/* Circle button */}
    <div
      onClick={onClick}
      title={visuallyComplete ? 'Mark incomplete' : 'Mark complete'}
      style={{
        width: 20, height: 20, borderRadius: '50%',
        border: visuallyComplete ? '2px solid #34c759' : '2px solid var(--border)',
        background: visuallyComplete ? '#34c759' : 'var(--card)',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', zIndex: 1,
        ...(animating
          ? { animation: 'checkBounce 1.3s cubic-bezier(0.34,1.56,0.64,1) forwards' }
          : { transition: 'background .2s, border-color .2s' }),
      }}
    >
      {visuallyComplete && (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff"
          strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
          style={{
            strokeDasharray: 30,
            ...(animating
              ? { animation: 'checkDraw 0.8s 0.2s ease-out forwards' }
              : { strokeDashoffset: 0 }),
          }}
        >
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      )}
    </div>
  </div>
);

/* ─── shared TodoRow ──────────────────────────────── */
/**
 * Animation sequence (incomplete → complete):
 *   0ms    : check turns green, bounce + confetti start
 *   900ms  : strikethrough appears on text
 *   3000ms : onToggle() called → server saves → item moves to completed section
 *
 * compact=false (default) — full row with metadata (TodosPage)
 * compact=true            — title + check + trash only (Dashboard widget)
 */
export function TodoRow({ todo, onToggle, onDelete, compact = false }) {
  const serverComplete = !!todo.is_complete;

  // Local visual state — drives appearance before server confirms
  const [localComplete, setLocalComplete] = useState(false);
  const [striked,       setStriked]       = useState(serverComplete);
  const [animating,     setAnimating]     = useState(false);
  const particles = useRef([]);
  const pending   = useRef(false);
  const timers    = useRef([]);

  // Keep striked in sync when server state changes (e.g. page load, undo)
  useEffect(() => { setStriked(serverComplete); }, [serverComplete]);

  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };

  const visuallyComplete = serverComplete || localComplete;
  const overdue = !compact && !visuallyComplete && isOverdue(todo.due_date);
  const linkedLabel = todo.event_title || todo.recital_title;
  const linkedColor = todo.event_title ? '#6a7fdb' : '#c4527a';

  const handleClick = () => {
    if (serverComplete) {
      // Toggling back to incomplete: immediate, no animation
      onToggle();
      setLocalComplete(false);
      setStriked(false);
      return;
    }
    if (pending.current) return; // prevent double-click during animation
    pending.current = true;

    // Step 1 (0ms): check turns green + bounce + confetti
    particles.current = Array.from({ length: 30 }, (_, i) => {
      const isStrip = i % 3 !== 0; // 2/3 are long thin strips, 1/3 squarish
      return {
        angle:    (i / 30) * Math.PI * 2 + (Math.random() - 0.5) * 0.4,
        distance: 32 + Math.floor(Math.random() * 44),
        color:    CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        // Rectangle dimensions: strips vs. squares
        w: isStrip ? 8 + Math.floor(Math.random() * 7)  : 5 + Math.floor(Math.random() * 4),
        h: isStrip ? 3 + Math.floor(Math.random() * 2)  : 5 + Math.floor(Math.random() * 4),
        rotation: Math.floor(Math.random() * 540) - 180,
        // Upward arc kick: all pieces burst upward first, then gravity pulls them
        arc: -(24 + Math.floor(Math.random() * 22)),
      };
    });
    setLocalComplete(true);
    setAnimating(true);

    // Step 2 (600ms): strikethrough appears after check settles
    timers.current.push(setTimeout(() => setStriked(true), 600));

    // Step 3 (2000ms): confetti finishes, state changes via onToggle
    timers.current.push(setTimeout(() => {
      setAnimating(false);
      onToggle();        // fires the mutation — item will move/fade after this
      pending.current = false;
      setLocalComplete(false); // cleanup: server state now owns it
    }, 2000));
  };

  return (
    <Card
      variant="row"
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        marginBottom: 4,
        opacity: serverComplete ? 0.65 : 1,
        transition: 'box-shadow .18s, border-color .18s, opacity .5s',
      }}
    >
      <AnimatedCheckCircle
        visuallyComplete={visuallyComplete}
        animating={animating}
        particles={particles.current}
        onClick={handleClick}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Title with sequenced strikethrough */}
        <span style={{
          fontSize: 13, fontWeight: 500, lineHeight: 1.4, display: 'block',
          color: visuallyComplete ? 'var(--muted)' : 'var(--text)',
          textDecoration: (visuallyComplete && striked) ? 'line-through' : 'none',
          transition: 'color .4s, text-decoration .3s',
        }}>
          {todo.title}
        </span>

        {/* Full metadata — hidden in compact mode */}
        {!compact && (
          <>
            {todo.notes && (
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{todo.notes}</div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{
                display: 'flex', alignItems: 'center', gap: 4,
                fontSize: 11, fontWeight: 600,
                color: todo.assigned_to ? 'var(--text)' : 'var(--muted)',
                background: 'var(--surface)', padding: '2px 8px', borderRadius: 999,
              }}>
                <PersonIcon />{todo.assigned_to || 'Not assigned'}
              </span>
              {todo.due_date && (
                <span style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: 11, fontWeight: 600,
                  color: overdue ? '#ff3b30' : 'var(--muted)',
                  background: overdue ? '#fff0ee' : 'var(--surface)',
                  padding: '2px 8px', borderRadius: 999,
                }}>
                  <CalSmIcon />{overdue && '⚠ '}End by {formatDueDate(todo.due_date)}
                </span>
              )}
              {todo.recital_id && (
                <span style={{ fontSize: 11, color: '#c4527a', background: '#c4527a15', border: '1px solid #c4527a30', padding: '2px 8px', borderRadius: 999, fontWeight: 700 }}>
                  Recital
                </span>
              )}
              {linkedLabel && (
                <span style={{ fontSize: 11, color: '#fff', background: linkedColor, padding: '2px 8px', borderRadius: 999, fontWeight: 600 }}>
                  {linkedLabel}
                </span>
              )}
            </div>
          </>
        )}
      </div>
      <TrashIcon onClick={onDelete} />
    </Card>
  );
}
