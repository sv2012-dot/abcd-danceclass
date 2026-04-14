import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { recitals as recitalApi, students as studentApi, batches as batchApi, events as eventApi, todos as todoApi, schools as schoolsApi } from '../api';
import Card from '../components/shared/Card';
import Badge from '../components/shared/Badge';
import Button, { BTN_GRAD } from '../components/shared/Button';
import { TodoKeyframeStyles, TodoRow as SharedTodoRow } from '../components/shared/TodoItem';

// ── Design tokens ──────────────────────────────────────────────────────────────
const C = {
  // Text hierarchy
  ebony:      'var(--text)',
  boulder:    'var(--muted)',
  grayChate:  'var(--muted)',
  // Accent
  accentPurple: '#7C3AED', // Primary accent
  accentMagenta:'#D946EF', // Secondary accent
  accentGrad: BTN_GRAD,
  // Surfaces
  white:  'var(--card)',
  bg:     'var(--background)',
  border: 'var(--border)',
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function getGreeting() {
  const h = new Date().getHours();
  if (h >= 5  && h < 12) return 'Good morning';
  if (h >= 12 && h < 17) return 'Good afternoon';
  if (h >= 17 && h < 21) return 'Good evening';
  return 'Good night';
}

function fmtTime(dt) {
  if (!dt) return '';
  return new Date(dt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function useWindowWidth() {
  const [w, setW] = useState(() => typeof window !== 'undefined' ? window.innerWidth : 1024);
  useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return w;
}

// ── Date block (left-bar style matching screenshot) ────────────────────────────
function DateBlock({ dateStr, accentColor }) {
  const d = new Date(dateStr);
  const col = accentColor || C.accentPurple;
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', gap: 10, flexShrink: 0 }}>
      <div style={{ width: 3, borderRadius: 99, background: col, minHeight: 36 }} />
      <div style={{ textAlign: 'center', minWidth: 30 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: C.ebony, lineHeight: 1, fontFamily: 'var(--font-d)' }}>
          {d.getDate()}
        </div>
        <div style={{ fontSize: 9, color: C.grayChate, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '.04em', marginTop: 2 }}>
          {d.toLocaleString('default', { month: 'short' })}
        </div>
      </div>
    </div>
  );
}

// ── Stat card ──────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, accentColor, isMobile }) {
  const col = accentColor || C.accentPurple;
  return (
    <div style={{
      background: C.white, borderRadius: 14, border: `1.5px solid ${C.border}`,
      padding: isMobile ? '12px 16px' : '14px 20px',
      minWidth: isMobile ? 0 : 100,
      flex: isMobile ? 1 : 'none',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: 10, flexShrink: 0,
        background: col + '14',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: col,
      }}>{icon}</div>
      <div style={{ fontSize: isMobile ? 22 : 28, fontWeight: 800, color: C.ebony, fontFamily: 'var(--font-d)', lineHeight: 1 }}>
        {value ?? '—'}
      </div>
      <div style={{ fontSize: 10, fontWeight: 700, color: C.grayChate, textTransform: 'uppercase', letterSpacing: '.08em' }}>
        {label}
      </div>
    </div>
  );
}

// ── Widget wrapper ─────────────────────────────────────────────────────────────
function Widget({ title, onViewAll, children, minHeight }) {
  return (
    <div style={{
      background: C.white, borderRadius: 16, border: `1.5px solid ${C.border}`,
      overflow: 'hidden', display: 'flex', flexDirection: 'column',
      minHeight: minHeight || 240,
      boxShadow: '0 1px 4px rgba(0,0,0,.04)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 18px 12px', borderBottom: `1px solid ${C.border}`,
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: C.grayChate, textTransform: 'uppercase', letterSpacing: '.12em' }}>
          {title}
        </div>
        <Button variant="secondary" size="sm" onClick={onViewAll}>View All</Button>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>{children}</div>
    </div>
  );
}

// ── Recital row ────────────────────────────────────────────────────────────────
const RECITAL_COL = '#C026D3';
function RecitalRow({ r }) {
  const eventDate = new Date(r.event_date);
  const tod = new Date(); tod.setHours(0,0,0,0); eventDate.setHours(0,0,0,0);
  const diff = Math.round((eventDate - tod) / 86400000);
  const daysLabel = diff === 0 ? 'Today!' : diff === 1 ? 'Tomorrow' : diff > 0 ? `${diff}d to go` : `${Math.abs(diff)}d ago`;
  const pillBg   = diff <= 7 ? '#FFF1F3' : diff <= 30 ? '#FFF8ED' : '#F0FDF4';
  const pillCol  = diff <= 7 ? '#BE123C' : diff <= 30 ? '#B45309' : '#15803D';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 18px', borderBottom: `1px solid ${C.border}`,
    }}>
      <DateBlock dateStr={r.event_date} accentColor={RECITAL_COL} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: C.ebony, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {r.title}
        </div>
        <div style={{ fontSize: 11, color: C.boulder, marginTop: 2 }}>{r.venue || '—'}</div>
      </div>
      <span style={{
        fontSize: 11, fontWeight: 700, color: pillCol, background: pillBg,
        borderRadius: 20, padding: '3px 10px', whiteSpace: 'nowrap', flexShrink: 0,
      }}>{daysLabel}</span>
    </div>
  );
}

// ── Event row ──────────────────────────────────────────────────────────────────
const TYPE_COLOR = { Class: '#0EA5E9', Recital: RECITAL_COL, Rehearsal: '#8B5CF6', Workshop: '#F59E0B', Other: '#6B7280' };
function EventRow({ e }) {
  const col = TYPE_COLOR[e.type] || '#6B7280';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 18px', borderBottom: `1px solid ${C.border}`,
    }}>
      <DateBlock dateStr={e.start_datetime} accentColor={col} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: C.ebony, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {e.title}
        </div>
        <div style={{ fontSize: 11, color: C.boulder, marginTop: 2 }}>
          {fmtTime(e.start_datetime)}{e.location ? ` · ${e.location}` : ''}
        </div>
      </div>
      <Badge color={col}>{e.type}</Badge>
    </div>
  );
}


// ── Icon SVGs ──────────────────────────────────────────────────────────────────
const IconStudents = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);
const IconBatches = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
    <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
  </svg>
);
const IconRecitals = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);


// ── Gradient text helper ───────────────────────────────────────────────────────
const GRAD_TEXT = {
  background: BTN_GRAD,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
};

function SectionTitle({ first, accent, onViewAll }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: C.ebony, margin: 0, letterSpacing: '-0.02em', textTransform: 'uppercase' }}>
        {first}{' '}
        <span style={GRAD_TEXT}>{accent}</span>
      </h2>
      {onViewAll && (
        <button onClick={onViewAll} style={{ fontSize: 12, fontWeight: 600, color: C.accentPurple, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          View All →
        </button>
      )}
    </div>
  );
}

// ── Week event row ─────────────────────────────────────────────────────────────
function WeekEventRow({ e }) {
  const d = new Date(e.start_datetime);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const eventDay = new Date(d); eventDay.setHours(0, 0, 0, 0);
  const diff = Math.round((eventDay - today) / 86400000);
  const daysLabel = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : `${diff} days`;
  const col = TYPE_COLOR[e.type] || C.accentPurple;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: `1px solid ${C.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <div style={{ width: 3, height: 44, borderRadius: 99, background: col, flexShrink: 0 }} />
        <div style={{ textAlign: 'center', minWidth: 28 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.ebony, lineHeight: 1, fontFamily: 'var(--font-d)' }}>{d.getDate()}</div>
          <div style={{ fontSize: 9, fontWeight: 700, color: C.grayChate, textTransform: 'uppercase', letterSpacing: '.05em', marginTop: 2 }}>
            {d.toLocaleString('default', { month: 'short' })}
          </div>
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: C.ebony, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</div>
        <div style={{ fontSize: 12, color: C.boulder, marginTop: 2 }}>{e.location || '—'}</div>
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.boulder, background: C.bg, borderRadius: 20, padding: '4px 12px', whiteSpace: 'nowrap', flexShrink: 0 }}>
        {daysLabel}
      </div>
    </div>
  );
}

// ── Recital image card ─────────────────────────────────────────────────────────
const CARD_GRADS = [
  'linear-gradient(135deg, #1a1035 0%, #2d1b69 100%)',
  'linear-gradient(135deg, #0d1b2a 0%, #1b4332 100%)',
  'linear-gradient(135deg, #1a0533 0%, #7c1d6f 100%)',
  'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)',
];

function RecitalCard({ r, index, onClick }) {
  const bg = CARD_GRADS[index % CARD_GRADS.length];
  return (
    <div onClick={onClick} style={{ position: 'relative', height: 190, borderRadius: 16, overflow: 'hidden', cursor: 'pointer', background: bg }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(0,0,0,.22)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,.88) 0%, rgba(0,0,0,.25) 55%, transparent 100%)' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '14px 14px' }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: '.03em', lineHeight: 1.25 }}>{r.title}</div>
        {r.venue && <div style={{ fontSize: 11, color: 'rgba(255,255,255,.65)', marginTop: 4 }}>{r.venue}</div>}
      </div>
    </div>
  );
}

function FeaturedRecitalCard({ r, onClick }) {
  return (
    <div onClick={onClick} style={{ position: 'relative', height: 280, borderRadius: 16, overflow: 'hidden', cursor: 'pointer', background: CARD_GRADS[0] }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(0,0,0,.22)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,.92) 0%, rgba(0,0,0,.45) 55%, transparent 100%)' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '20px 18px' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.55)', textTransform: 'uppercase', letterSpacing: '.14em', marginBottom: 7 }}>Featured Recital</div>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', textTransform: 'uppercase', lineHeight: 1.2, letterSpacing: '.02em' }}>{r.title}</div>
        {r.venue && <div style={{ fontSize: 12, color: 'rgba(255,255,255,.65)', marginTop: 6 }}>{r.venue}</div>}
      </div>
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user, school } = useAuth();
  const sid = user?.school_id;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const windowWidth = useWindowWidth();
  const isMobile = windowWidth < 768;
  const [newTodo, setNewTodo] = useState('');
  const [addingTodo, setAddingTodo] = useState(false);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const createMenuRef = useRef(null);

  useEffect(() => {
    if (!createMenuOpen) return;
    const handler = (e) => {
      if (createMenuRef.current && !createMenuRef.current.contains(e.target)) {
        setCreateMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('touchstart', handler); };
  }, [createMenuOpen]);

  if (user?.role === 'superadmin') return <SuperAdminDash />;

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: recitalList  = [] } = useQuery({ queryKey: ['recitals',  sid], queryFn: () => recitalApi.list(sid), enabled: !!sid });
  const { data: studentList  = [] } = useQuery({ queryKey: ['students',  sid], queryFn: () => studentApi.list(sid), enabled: !!sid });
  const { data: batchList    = [] } = useQuery({ queryKey: ['batches',   sid], queryFn: () => batchApi.list(sid),   enabled: !!sid });
  const { data: todoRaw } = useQuery({ queryKey: ['todos', sid], queryFn: () => todoApi.list(sid), enabled: !!sid });
  const todoList = Array.isArray(todoRaw) ? todoRaw : (todoRaw?.todos || []);
  const { data: eventList    = [] } = useQuery({
    queryKey: ['events', sid, 'dashboard'],
    queryFn: () => {
      const from = new Date().toISOString().slice(0, 10);
      const to   = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
      return eventApi.list(sid, { from, to });
    },
    enabled: !!sid,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────────
  const addTodo = useMutation({
    mutationFn: title => todoApi.create(sid, { title }),
    onSuccess: () => { qc.invalidateQueries(['todos', sid]); setNewTodo(''); setAddingTodo(false); },
  });
  const toggleTodo = useMutation({
    mutationFn: id => todoApi.toggle(sid, id),
    onMutate: async id => {
      await qc.cancelQueries(['todos', sid]);
      const prev = qc.getQueryData(['todos', sid]);
      qc.setQueryData(['todos', sid], old => {
        const a = Array.isArray(old) ? old : (old?.todos || []);
        const updated = a.map(t => t.id === id ? { ...t, is_complete: t.is_complete ? 0 : 1 } : t);
        return Array.isArray(old) ? updated : { ...old, todos: updated };
      });
      return { prev };
    },
    onError: (_e, _id, ctx) => { qc.setQueryData(['todos', sid], ctx.prev); },
    onSettled: () => qc.invalidateQueries(['todos', sid]),
  });
  const deleteTodo = useMutation({
    mutationFn: id => todoApi.remove(sid, id),
    onSuccess: () => qc.invalidateQueries(['todos', sid]),
  });

  // ── Derived data ──────────────────────────────────────────────────────────────
  const now = new Date();
  const upcomingRecitals = recitalList
    .filter(r => {
      const [yr, mo, dy] = (r.event_date||'').slice(0,10).split('-').map(Number);
      return yr && new Date(yr, mo-1, dy) >= new Date(now.getFullYear(), now.getMonth(), now.getDate());
    })
    .sort((a, b) => new Date(a.event_date) - new Date(b.event_date));
  const upcomingEvents = (eventList || [])
    .filter(e => new Date(e.start_datetime) >= now)
    .sort((a, b) => new Date(a.start_datetime) - new Date(b.start_datetime));
  const thisWeekEvents = upcomingEvents.filter(e => (new Date(e.start_datetime) - now) / 86400000 <= 7);
  const openTodos = todoList.filter(t => !t.is_complete);

  const dateStr = now.toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const firstName = user?.name?.split(' ')[0] || user?.name || '';

  // ── Create menu options ────────────────────────────────────────────────────────
  const CREATE_OPTIONS = [
    {
      label: 'Create Event', color: '#0EA5E9',
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
      onClick: () => { navigate('/schedule'); setCreateMenuOpen(false); },
    },
    {
      label: 'Create Recital', color: RECITAL_COL,
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
      onClick: () => { navigate('/recitals?new=1'); setCreateMenuOpen(false); },
    },
    {
      label: 'Add Student', color: C.accentPurple,
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>,
      onClick: () => { navigate('/students'); setCreateMenuOpen(false); },
    },
  ];

  // ── Widgets block ─────────────────────────────────────────────────────────────
  const widgetsBlock = (
    // TodoKeyframeStyles is included here so animations work in both mobile & desktop layouts
    <><TodoKeyframeStyles />
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 18 }}>
      {/* Upcoming Recitals */}
      <Widget title="Upcoming Recitals" onViewAll={() => navigate('/recitals')}>
        {upcomingRecitals.length === 0
          ? <div style={{ padding: '28px 18px', color: C.grayChate, fontSize: 13, textAlign: 'center' }}>No upcoming recitals</div>
          : upcomingRecitals.slice(0, 4).map(r => <RecitalRow key={r.id} r={r} />)
        }
      </Widget>

      {/* Upcoming Classes */}
      <Widget title="Upcoming Classes" onViewAll={() => navigate('/schedule')}>
        {upcomingEvents.length === 0
          ? <div style={{ padding: '28px 18px', color: C.grayChate, fontSize: 13, textAlign: 'center' }}>No upcoming events</div>
          : upcomingEvents.slice(0, 4).map(e => <EventRow key={e.id} e={e} />)
        }
      </Widget>

      {/* To-Dos */}
      <Widget title="To-Do" onViewAll={() => navigate('/todos')}>
        {openTodos.length === 0 && !addingTodo
          ? <div style={{ padding: '28px 18px', color: C.grayChate, fontSize: 13, textAlign: 'center' }}>All caught up!</div>
          : openTodos.slice(0, 4).map(t => (
              <SharedTodoRow key={t.id} todo={t} compact
                onToggle={() => toggleTodo.mutate(t.id)}
                onDelete={() => deleteTodo.mutate(t.id)}
              />
            ))
        }
        <div style={{ padding: '10px 18px', marginTop: 'auto' }}>
          {addingTodo ? (
            <form onSubmit={e => { e.preventDefault(); if (newTodo.trim()) addTodo.mutate(newTodo.trim()); }}
              style={{ display: 'flex', gap: 8 }}>
              <input
                autoFocus value={newTodo}
                onChange={e => setNewTodo(e.target.value)}
                placeholder="What needs doing?"
                style={{
                  flex: 1, padding: '6px 10px', borderRadius: 8,
                  border: `1.5px solid ${C.accentPurple}`,
                  background: '#fff', color: C.ebony, fontSize: 13, outline: 'none',
                }}
                onKeyDown={e => { if (e.key === 'Escape') { setAddingTodo(false); setNewTodo(''); } }}
              />
              <Button type="submit" size="sm">Add</Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => { setAddingTodo(false); setNewTodo(''); }} style={{ color: C.boulder }}>✕</Button>
            </form>
          ) : (
            <button onClick={() => setAddingTodo(true)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: C.accentPurple, fontSize: 13, fontWeight: 600, padding: 0,
            }}>+ Add to-do</button>
          )}
        </div>
      </Widget>
    </div>
    </>
  );

  // ── Stat cards block ───────────────────────────────────────────────────────────
  const statsBlock = (
    <div style={{ display: 'flex', gap: 12, flexShrink: 0, flexWrap: isMobile ? 'nowrap' : 'wrap' }}>
      <StatCard label="Students" value={studentList.length}           icon={<IconStudents />} accentColor={C.accentPurple}  isMobile={isMobile} />
      <StatCard label="Batches"  value={batchList.length}             icon={<IconBatches  />} accentColor="#0EA5E9"           isMobile={isMobile} />
      <StatCard label="Recitals" value={upcomingRecitals.length}      icon={<IconRecitals />} accentColor={C.accentMagenta}  isMobile={isMobile} />
    </div>
  );

  // ── MOBILE LAYOUT ─────────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{ paddingBottom: 24 }}>
        {/* Greeting */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontFamily: 'var(--font-d)', fontSize: 22, fontWeight: 800, color: C.ebony, marginBottom: 4, lineHeight: 1.2 }}>
            {getGreeting()}, {firstName}! 👋
          </h1>
          <p style={{ color: C.boulder, fontSize: 12 }}>
            {school?.name} · {now.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })}
          </p>
        </div>

        {/* Consolidated create button */}
        <div style={{ position: 'relative', marginBottom: 24 }} ref={createMenuRef}>
          <button
            onClick={() => setCreateMenuOpen(o => !o)}
            style={{
              width: '100%', padding: '13px 20px',
              borderRadius: 14, border: 'none',
              background: BTN_GRAD, color: '#fff',
              fontSize: 15, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              boxShadow: '0 4px 20px rgba(124,58,237,0.3)',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Create New
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ marginLeft: 'auto', transition: 'transform .2s', transform: createMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>

          {createMenuOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0, zIndex: 200,
              background: C.white, borderRadius: 14, border: `1.5px solid ${C.border}`,
              boxShadow: '0 8px 32px rgba(0,0,0,.14)', overflow: 'hidden',
            }}>
              {CREATE_OPTIONS.map((opt, i) => (
                <button key={i} onClick={opt.onClick} style={{
                  width: '100%', padding: '15px 20px',
                  background: 'none', border: 'none',
                  borderBottom: i < CREATE_OPTIONS.length - 1 ? `1px solid ${C.border}` : 'none',
                  cursor: 'pointer', textAlign: 'left',
                  display: 'flex', alignItems: 'center', gap: 14,
                  color: C.ebony, fontSize: 14, fontWeight: 600,
                }}
                  onMouseEnter={e => e.currentTarget.style.background = C.bg}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  <span style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    background: opt.color + '14', color: opt.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{opt.icon}</span>
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Widgets */}
        {widgetsBlock}

        {/* Stats — bottom */}
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.grayChate, textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 10 }}>
            Studio Overview
          </div>
          {statsBlock}
        </div>
      </div>
    );
  }

  // ── DESKTOP LAYOUT ─────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Top row: greeting + action buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32, gap: 20 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-d)', fontSize: 28, fontWeight: 800, color: C.ebony, marginBottom: 6, lineHeight: 1.1 }}>
            {getGreeting()}, {firstName}!
          </h1>
          <p style={{ color: C.boulder, fontSize: 13 }}>{school?.name} · {dateStr}</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexShrink: 0, position: 'relative' }} ref={createMenuRef}>
          <Button variant="secondary" onClick={() => setCreateMenuOpen(o => !o)}>+ Create</Button>
          <Button variant="primary" onClick={() => navigate('/schedule')}>View Schedule →</Button>
          {createMenuOpen && (
            <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 200, background: C.white, borderRadius: 14, border: `1.5px solid ${C.border}`, boxShadow: '0 8px 32px rgba(0,0,0,.14)', overflow: 'hidden', minWidth: 210 }}>
              {CREATE_OPTIONS.map((opt, i) => (
                <button key={i} onClick={opt.onClick} style={{ width: '100%', padding: '14px 18px', background: 'none', border: 'none', borderBottom: i < CREATE_OPTIONS.length - 1 ? `1px solid ${C.border}` : 'none', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12, color: C.ebony, fontSize: 14, fontWeight: 600 }}
                  onMouseEnter={e => e.currentTarget.style.background = C.bg}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  <span style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, background: opt.color + '14', color: opt.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{opt.icon}</span>
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main 2-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 36, alignItems: 'start' }}>

        {/* ── Left column ── */}
        <div>
          {/* THIS WEEK */}
          <SectionTitle first="THIS" accent="WEEK" onViewAll={() => navigate('/schedule')} />
          <div style={{ background: C.white, borderRadius: 16, border: `1.5px solid ${C.border}`, overflow: 'hidden', marginBottom: 36 }}>
            {thisWeekEvents.length === 0
              ? <div style={{ padding: '28px 20px', color: C.grayChate, fontSize: 13, textAlign: 'center' }}>No events this week</div>
              : thisWeekEvents.slice(0, 5).map(e => <WeekEventRow key={e.id} e={e} />)
            }
          </div>

          {/* UPCOMING RECITALS */}
          <SectionTitle first="UPCOMING" accent="RECITALS" onViewAll={() => navigate('/recitals')} />
          {upcomingRecitals.length === 0 ? (
            <div style={{ padding: '28px 20px', color: C.grayChate, fontSize: 13, textAlign: 'center', background: C.white, borderRadius: 16, border: `1.5px solid ${C.border}` }}>
              No upcoming recitals
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {upcomingRecitals.slice(0, 3).map((r, i) => (
                <RecitalCard key={r.id} r={r} index={i} onClick={() => navigate('/recitals')} />
              ))}
            </div>
          )}
        </div>

        {/* ── Right column ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {/* Featured Recital */}
          {upcomingRecitals[0] && (
            <div>
              <SectionTitle first="FEATURED" accent="RECITAL" />
              <FeaturedRecitalCard r={upcomingRecitals[0]} onClick={() => navigate('/recitals')} />
            </div>
          )}

          {/* TO DOs */}
          <div>
            <SectionTitle first="TO" accent="DOs" />
            <div style={{ background: C.white, borderRadius: 16, border: `1.5px solid ${C.border}`, overflow: 'hidden' }}>
              {openTodos.length === 0 && !addingTodo
                ? <div style={{ padding: '28px 20px', color: C.grayChate, fontSize: 13, textAlign: 'center' }}>All caught up!</div>
                : openTodos.slice(0, 5).map(t => (
                    <SharedTodoRow key={t.id} todo={t} compact
                      onToggle={() => toggleTodo.mutate(t.id)}
                      onDelete={() => deleteTodo.mutate(t.id)}
                    />
                  ))
              }
              <div style={{ padding: '10px 18px' }}>
                {addingTodo ? (
                  <form onSubmit={e => { e.preventDefault(); if (newTodo.trim()) addTodo.mutate(newTodo.trim()); }}
                    style={{ display: 'flex', gap: 8 }}>
                    <input
                      autoFocus value={newTodo}
                      onChange={e => setNewTodo(e.target.value)}
                      placeholder="What needs doing?"
                      style={{ flex: 1, padding: '6px 10px', borderRadius: 8, border: `1.5px solid ${C.accentPurple}`, background: '#fff', color: C.ebony, fontSize: 13, outline: 'none' }}
                      onKeyDown={e => { if (e.key === 'Escape') { setAddingTodo(false); setNewTodo(''); } }}
                    />
                    <Button type="submit" size="sm">Add</Button>
                    <Button type="button" variant="secondary" size="sm" onClick={() => { setAddingTodo(false); setNewTodo(''); }}>✕</Button>
                  </form>
                ) : (
                  <button onClick={() => setAddingTodo(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.accentPurple, fontSize: 13, fontWeight: 600, padding: 0 }}>
                    + Add to-do
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Super admin dashboard ───────────────────────────────────────────────────────
const EMPTY_SCHOOL = { name:'', owner_name:'', email:'', phone:'', city:'', dance_style:'', admin_email:'', admin_password:'' };

function SuperAdminDash() {
  const qc = useQueryClient();
  const { data: schoolList = [], isLoading } = useQuery({
    queryKey: ['schools'],
    queryFn: () => schoolsApi.list(),
  });

  // ── Reset password state (per school)
  const [resetId,  setResetId]  = useState(null);
  const [resetPw,  setResetPw]  = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [resetDone, setResetDone] = useState(null); // schoolId of last success

  // ── Create school state
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_SCHOOL);
  const [created, setCreated] = useState(null); // { name, admin_email, admin_password }

  const resetMut = useMutation({
    mutationFn: ({ id, password }) => schoolsApi.resetAdminPassword(id, password),
    onSuccess: (_, { id }) => {
      setResetDone(id);
      setResetId(null);
      setResetPw('');
      setTimeout(() => setResetDone(null), 4000);
    },
  });

  const createMut = useMutation({
    mutationFn: (data) => schoolsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries(['schools']);
      setCreated({ name: form.name, admin_email: form.admin_email, admin_password: form.admin_password });
      setShowCreate(false);
      setForm(EMPTY_SCHOOL);
    },
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const LabelInput = ({ label, value, onChange, type='text', placeholder='' }) => (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.boulder, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 5 }}>{label}</div>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: `1.5px solid ${C.border}`,
          fontSize: 13, color: C.ebony, background: C.white, outline: 'none', boxSizing: 'border-box',
          fontFamily: 'inherit' }}
        onFocus={e => e.target.style.borderColor = C.accentPurple}
        onBlur={e => e.target.style.borderColor = C.border}
      />
    </div>
  );

  return (
    <div style={{ maxWidth: 760 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-d)', fontSize: 26, color: C.ebony, marginBottom: 4 }}>Super Admin</h1>
          <p style={{ color: C.boulder, fontSize: 13 }}>Manage all schools and their login credentials</p>
        </div>
        <Button onClick={() => { setShowCreate(true); setCreated(null); }}>+ Add School</Button>
      </div>

      {/* Credentials created banner */}
      {created && (
        <div style={{ background: '#F0FDF4', border: '1.5px solid #86EFAC', borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#15803D', marginBottom: 10 }}>
            ✅ School "{created.name}" created — save these login details now:
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 24px' }}>
            <CredRow label="Admin Email" value={created.admin_email} />
            <CredRow label="Password" value={created.admin_password} secret />
          </div>
          <button onClick={() => setCreated(null)} style={{ marginTop: 10, fontSize: 12, color: '#15803D', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600 }}>Dismiss</button>
        </div>
      )}

      {/* School list */}
      {isLoading ? (
        <div style={{ color: C.boulder, fontSize: 13, padding: 24 }}>Loading schools…</div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {schoolList.map(s => {
            const hue = s.name.charCodeAt(0) * 7 % 360;
            const isResetting = resetId === s.id;
            const justReset   = resetDone === s.id;

            return (
              <div key={s.id} style={{ background: C.white, border: `1.5px solid ${justReset ? '#86EFAC' : C.border}`, borderRadius: 14, overflow: 'hidden', transition: 'border-color .3s' }}>
                {/* Main row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px' }}>
                  {/* Avatar */}
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: `hsl(${hue},55%,64%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#fff', fontSize: 18, flexShrink: 0 }}>
                    {s.name[0]}
                  </div>

                  {/* School info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: C.ebony }}>{s.name}</div>
                    <div style={{ color: C.boulder, fontSize: 12, marginTop: 2 }}>{s.city}{s.dance_style ? ` · ${s.dance_style}` : ''}</div>
                  </div>

                  {/* Stats */}
                  <div style={{ fontSize: 12, color: C.grayChate, textAlign: 'right', flexShrink: 0 }}>
                    <div>{s.student_count} students</div>
                    <div>{s.batch_count} batches</div>
                  </div>
                </div>

                {/* Credentials bar */}
                <div style={{ borderTop: `1px solid ${C.border}`, padding: '10px 18px', background: '#FAFAFA', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: C.grayChate, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 3 }}>Admin Login</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: C.ebony, fontFamily: 'monospace' }}>{s.admin_email || <span style={{ color: C.grayChate, fontFamily: 'inherit', fontWeight: 400 }}>No admin set</span>}</span>
                      {s.admin_email && (
                        <button
                          onClick={() => navigator.clipboard?.writeText(s.admin_email)}
                          title="Copy email"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.grayChate, padding: '1px 4px', borderRadius: 4, fontSize: 11 }}>
                          ⎘
                        </button>
                      )}
                    </div>
                  </div>

                  {justReset ? (
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#15803D' }}>✓ Password updated</span>
                  ) : isResetting ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        autoFocus
                        type={showPw ? 'text' : 'password'}
                        value={resetPw}
                        onChange={e => setResetPw(e.target.value)}
                        placeholder="New password (min 6)"
                        onKeyDown={e => { if (e.key === 'Enter' && resetPw.length >= 6) resetMut.mutate({ id: s.id, password: resetPw }); if (e.key === 'Escape') { setResetId(null); setResetPw(''); }}}
                        style={{ padding: '6px 10px', borderRadius: 8, border: `1.5px solid ${C.accentPurple}`, fontSize: 12, outline: 'none', width: 180, fontFamily: 'monospace' }}
                      />
                      <button onClick={() => setShowPw(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: C.boulder }}>
                        {showPw ? '🙈' : '👁'}
                      </button>
                      <Button size="sm" onClick={() => resetMut.mutate({ id: s.id, password: resetPw })} disabled={resetPw.length < 6 || resetMut.isPending}>
                        {resetMut.isPending ? '…' : 'Save'}
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => { setResetId(null); setResetPw(''); }}>Cancel</Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="secondary" onClick={() => { setResetId(s.id); setResetPw(''); setShowPw(false); }}>
                      🔑 Reset Password
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create School modal */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) setShowCreate(false); }}>
          <div style={{ background: C.white, borderRadius: 18, width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,.22)' }}>
            <div style={{ padding: '20px 24px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: 16, color: C.ebony }}>Add New School</span>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: C.boulder, lineHeight: 1 }}>×</button>
            </div>
            <div style={{ padding: '20px 24px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.grayChate, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 14 }}>School Details</div>
              <LabelInput label="School Name *" value={form.name} onChange={v => set('name', v)} placeholder="e.g. Rhythm & Grace Academy" />
              <LabelInput label="Owner Name *" value={form.owner_name} onChange={v => set('owner_name', v)} placeholder="Full name" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 14px' }}>
                <LabelInput label="City" value={form.city} onChange={v => set('city', v)} placeholder="City" />
                <LabelInput label="Dance Style" value={form.dance_style} onChange={v => set('dance_style', v)} placeholder="e.g. Ballet" />
              </div>
              <LabelInput label="School Email" value={form.email} onChange={v => set('email', v)} type="email" placeholder="contact@school.com" />
              <LabelInput label="Phone" value={form.phone} onChange={v => set('phone', v)} placeholder="+1 …" />

              <div style={{ borderTop: `1px solid ${C.border}`, margin: '16px 0' }} />
              <div style={{ fontSize: 11, fontWeight: 700, color: C.grayChate, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 14 }}>Admin Login Credentials</div>
              <LabelInput label="Admin Email *" value={form.admin_email} onChange={v => set('admin_email', v)} type="email" placeholder="admin@school.com" />
              <LabelInput label="Password *" value={form.admin_password} onChange={v => set('admin_password', v)} type="text" placeholder="Min 6 characters" />
              <div style={{ fontSize: 11, color: C.boulder, marginTop: -10, marginBottom: 14 }}>
                ⚠ Save these credentials — the password cannot be recovered after creation (only reset).
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
                <Button
                  onClick={() => createMut.mutate(form)}
                  disabled={!form.name || !form.owner_name || !form.admin_email || !form.admin_password || createMut.isPending}
                >
                  {createMut.isPending ? 'Creating…' : 'Create School'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Credential display row helper
function CredRow({ label, value, secret }) {
  const [vis, setVis] = useState(!secret);
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#15803D', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 2 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600, fontFamily: 'monospace', color: '#065F46' }}>{vis ? value : '••••••••'}</span>
        {secret && <button onClick={() => setVis(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#15803D' }}>{vis ? 'hide' : 'show'}</button>}
        <button onClick={() => navigator.clipboard?.writeText(value)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#15803D' }}>⎘ copy</button>
      </div>
    </div>
  );
}
