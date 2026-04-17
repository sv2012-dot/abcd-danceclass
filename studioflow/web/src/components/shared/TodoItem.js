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
      0%   { transform: scale(0.4);  }
      50%  { transform: scale(1.35); }
      75%  { transform: scale(0.9);  }
      100% { transform: scale(1);    }
    }
    @keyframes checkDraw {
      from { stroke-dashoffset: 30; }
      to   { stroke-dashoffset: 0;  }
    }
  `}</style>
);

/* ─── icons ──────────────────────────────────────── */
export const TrashIcon = ({ onClick }) => (
  <button
    onClick={onClick}
    title="Delete"
    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '6px 8px', display: 'flex', alignItems: 'center', flexShrink: 0 }}
    onMouseEnter={e => { e.currentTarget.style.color = '#ff3b30'; }}
    onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; }}
  >
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

/* ─── check circle (visual only — Card handles the click) ─── */
export const AnimatedCheckCircle = ({ visuallyComplete, animating }) => (
  /* 44×44 touch target area, circle stays 20×20 inside.
     pointerEvents:none so all taps fall through to the Card. */
  <div style={{ width: 44, height: 44, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
    <div style={{
      width: 20, height: 20, borderRadius: '50%',
      border: visuallyComplete ? '2px solid #34c759' : '2px solid var(--border)',
      background: visuallyComplete ? '#34c759' : 'var(--card)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
      ...(animating
        ? { animation: 'checkBounce 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards' }
        : { transition: 'background .2s, border-color .2s' }),
    }}>
      {visuallyComplete && (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff"
          strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
          style={{
            strokeDasharray: 30,
            ...(animating
              ? { animation: 'checkDraw 0.35s 0.1s ease-out forwards' }
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
 * compact=false (default) — full row with metadata (TodosPage)
 * compact=true            — title + check + trash only (Dashboard widget)
 *
 * Clicking anywhere on the row (circle or text) toggles the item.
 * Only the trash icon triggers delete.
 */
export function TodoRow({ todo, onToggle, onDelete, compact = false }) {
  const serverComplete = !!todo.is_complete;

  const [localComplete, setLocalComplete] = useState(false);
  const [striked,       setStriked]       = useState(serverComplete);
  const [animating,     setAnimating]     = useState(false);
  const pending = useRef(false);
  const timers  = useRef([]);

  useEffect(() => { setStriked(serverComplete); }, [serverComplete]);

  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };

  const visuallyComplete = serverComplete || localComplete;
  const overdue = !compact && !visuallyComplete && isOverdue(todo.due_date);
  const linkedLabel = todo.event_title || todo.recital_title;
  const linkedColor = todo.event_title ? '#6a7fdb' : '#c4527a';

  const handleClick = () => {
    if (serverComplete) {
      // Un-complete: immediate, no animation
      onToggle();
      setLocalComplete(false);
      setStriked(false);
      return;
    }
    if (pending.current) return;
    pending.current = true;
    clearTimers();

    // Immediately show check + bounce
    setLocalComplete(true);
    setAnimating(true);

    // Strikethrough after bounce settles (~400ms)
    timers.current.push(setTimeout(() => setStriked(true), 400));

    // Fire mutation after short visual confirmation (~800ms)
    timers.current.push(setTimeout(() => {
      setAnimating(false);
      onToggle();
      pending.current = false;
      setLocalComplete(false); // server state takes over
    }, 800));
  };

  return (
    <Card
      variant="row"
      clickable
      onClick={handleClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 4,
        marginBottom: 4,
        opacity: serverComplete ? 0.65 : 1,
        transition: 'box-shadow .18s, border-color .18s, opacity .5s',
      }}
    >
      <AnimatedCheckCircle
        visuallyComplete={visuallyComplete}
        animating={animating}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          fontSize: 13, fontWeight: 500, lineHeight: 1.4, display: 'block',
          color: visuallyComplete ? 'var(--muted)' : 'var(--text)',
          textDecoration: (visuallyComplete && striked) ? 'line-through' : 'none',
          transition: 'color .3s, text-decoration .2s',
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
      <TrashIcon onClick={e => { e.stopPropagation(); onDelete(); }} />
    </Card>
  );
}
