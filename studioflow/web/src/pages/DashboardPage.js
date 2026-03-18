import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { recitals as recitalApi, students as studentApi, batches as batchApi, events as eventApi, todos as todoApi } from '../api';
import Card from '../components/shared/Card';
import Badge from '../components/shared/Badge';

// ── Helpers ──────────────────────────────────────────────────────────────────
function getGreeting() {
  const h = new Date().getHours();
  if (h >= 5  && h < 12) return 'Good morning';
  if (h >= 12 && h < 17) return 'Good afternoon';
  if (h >= 17 && h < 21) return 'Good evening';
  return 'Good night';
}

function fmtTime(dt) {
  if (!dt) return '';
  const d = new Date(dt);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, color, icon }) {
  return (
    <div style={{
      background: 'var(--card)', borderRadius: 14, border: '1.5px solid var(--border)',
      padding: '16px 22px', minWidth: 100, textAlign: 'center',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
    }}>
      <div style={{ color: 'var(--muted)', marginBottom: 2 }}>{icon}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color, fontFamily: 'var(--font-d)', lineHeight: 1 }}>{value ?? '—'}</div>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em' }}>{label}</div>
    </div>
  );
}

// ── Action button ─────────────────────────────────────────────────────────────
function ActionBtn({ children, color, onClick, outline }) {
  const [hov, setHov] = useState(false);
  const base = {
    padding: '8px 18px', borderRadius: 22, border: `1.5px solid ${color || 'var(--border)'}`,
    cursor: 'pointer', fontSize: 13, fontWeight: 700, transition: 'all .15s',
    background: hov ? (outline ? 'var(--surface)' : color + '18') : 'transparent',
    color: outline ? 'var(--text)' : color,
  };
  return (
    <button style={base} onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      {children}
    </button>
  );
}

// ── Section widget wrapper ────────────────────────────────────────────────────
function Widget({ emoji, title, onViewAll, children, minHeight }) {
  return (
    <Card style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: minHeight || 240 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px 10px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.1em' }}>
          {emoji} {title}
        </div>
        <button onClick={onViewAll} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--accent)', fontWeight: 600, padding: 0 }}>
          View all →
        </button>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>{children}</div>
    </Card>
  );
}

// ── Date badge ────────────────────────────────────────────────────────────────
function DateBadge({ dateStr, color }) {
  const d = new Date(dateStr);
  const c = color || '#c4527a';
  return (
    <div style={{ textAlign: 'center', minWidth: 44, background: c + '18', borderRadius: 9, padding: '6px 4px', flexShrink: 0 }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: c, fontFamily: 'var(--font-d)', lineHeight: 1 }}>{d.getDate()}</div>
      <div style={{ fontSize: 9, color: c, textTransform: 'uppercase', fontWeight: 700, marginTop: 1 }}>
        {d.toLocaleString('default', { month: 'short' })}
      </div>
    </div>
  );
}

// ── Recital row ───────────────────────────────────────────────────────────────
function RecitalRow({ r }) {
  const eventDate = new Date(r.event_date);
  const tod = new Date(); tod.setHours(0,0,0,0); eventDate.setHours(0,0,0,0);
  const diff = Math.round((eventDate - tod) / 86400000);
  const daysLabel = diff === 0 ? 'Today!' : diff === 1 ? 'Tomorrow' : diff > 0 ? `${diff}d to go` : `${Math.abs(diff)}d ago`;
  const daysColor = diff <= 7 ? '#e05c6a' : diff <= 30 ? '#f4a041' : '#52c4a0';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 18px', borderBottom: '1px solid var(--border)' }}>
      <DateBadge dateStr={r.event_date} color="#c4527a" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{r.venue || '—'}</div>
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: daysColor, background: daysColor + '18', borderRadius: 20, padding: '3px 9px', whiteSpace: 'nowrap', flexShrink: 0 }}>{daysLabel}</span>
    </div>
  );
}

// ── Event row ─────────────────────────────────────────────────────────────────
const TYPE_COLOR = { Class: '#52c4a0', Recital: '#e8607a', Rehearsal: '#f4a041', Workshop: '#6a7fdb', Other: '#8a7a9a' };
function EventRow({ e }) {
  const c = TYPE_COLOR[e.type] || '#8a7a9a';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 18px', borderBottom: '1px solid var(--border)' }}>
      <DateBadge dateStr={e.start_datetime} color={c} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
          {fmtTime(e.start_datetime)}{e.location ? ` · ${e.location}` : ''}
        </div>
      </div>
      <Badge color={c}>{e.type}</Badge>
    </div>
  );
}

// ── Todo row ──────────────────────────────────────────────────────────────────
function TodoRow({ t, onToggle, onDelete }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px', borderBottom: '1px solid var(--border)' }}>
      <button onClick={() => onToggle(t.id)} style={{
        width: 18, height: 18, borderRadius: '50%', border: '2px solid var(--border)',
        background: 'transparent', cursor: 'pointer', flexShrink: 0, padding: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }} />
      <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{t.title}</span>
      <button onClick={() => onDelete(t.id)} style={{
        background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)',
        fontSize: 14, padding: '2px 4px', borderRadius: 4, opacity: 0.5,
        lineHeight: 1, flexShrink: 0,
      }}>🗑</button>
    </div>
  );
}

// ── Icon SVGs ─────────────────────────────────────────────────────────────────
const IconStudents = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);
const IconBatches = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
    <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
  </svg>
);
const IconRecitals = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);

// ── Main dashboard ─────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user, school } = useAuth();
  const sid = user?.school_id;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [newTodo, setNewTodo] = useState('');
  const [addingTodo, setAddingTodo] = useState(false);

  if (user?.role === 'superadmin') return <SuperAdminDash />;

  // ── Queries ─────────────────────────────────────────────────────────────────
  const { data: recitalList  = [] } = useQuery({ queryKey: ['recitals',  sid], queryFn: () => recitalApi.list(sid), enabled: !!sid });
  const { data: studentList  = [] } = useQuery({ queryKey: ['students',  sid], queryFn: () => studentApi.list(sid), enabled: !!sid });
  const { data: batchList    = [] } = useQuery({ queryKey: ['batches',   sid], queryFn: () => batchApi.list(sid),   enabled: !!sid });
  const { data: todoList     = [] } = useQuery({ queryKey: ['todos',     sid], queryFn: () => todoApi.list(sid),    enabled: !!sid });
  const { data: eventList    = [] } = useQuery({
    queryKey: ['events', sid, 'dashboard'],
    queryFn: () => {
      const from = new Date().toISOString().slice(0, 10);
      const to   = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
      return eventApi.list(sid, { from, to });
    },
    enabled: !!sid,
  });

  // ── Mutations ────────────────────────────────────────────────────────────────
  const addTodo = useMutation({
    mutationFn: title => todoApi.create(sid, { title }),
    onSuccess: () => { qc.invalidateQueries(['todos', sid]); setNewTodo(''); setAddingTodo(false); },
  });
  const toggleTodo = useMutation({
    mutationFn: id => todoApi.toggle(sid, id),
    onSuccess: () => qc.invalidateQueries(['todos', sid]),
  });
  const deleteTodo = useMutation({
    mutationFn: id => todoApi.remove(sid, id),
    onSuccess: () => qc.invalidateQueries(['todos', sid]),
  });

  // ── Derived data ─────────────────────────────────────────────────────────────
  const now             = new Date();
  const upcomingRecitals = recitalList
                            .filter(r => {
                              const [yr, mo, dy] = (r.event_date||'').slice(0,10).split('-').map(Number);
                              return yr && new Date(yr, mo-1, dy) >= new Date(now.getFullYear(), now.getMonth(), now.getDate());
                            })
                            .sort((a, b) => new Date(a.event_date) - new Date(b.event_date));
  const upcomingEvents   = (eventList || []).filter(e => new Date(e.start_datetime) >= now)
                            .sort((a, b) => new Date(a.start_datetime) - new Date(b.start_datetime));
  const openTodos        = todoList.filter(t => !t.is_complete);

  const dateStr = now.toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const firstName = user?.name?.split(' ')[0] || user?.name || '';

  return (
    <div>
      {/* ── Top row: greeting + stat cards ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, gap: 20, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-d)', fontSize: 28, fontWeight: 800, marginBottom: 6, lineHeight: 1.1 }}>
            {getGreeting()}, {firstName}! 👋
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>{school?.name} · {dateStr}</p>
        </div>
        <div style={{ display: 'flex', gap: 12, flexShrink: 0, flexWrap: 'wrap' }}>
          <StatCard label="Students" value={studentList.length}  color="#c4527a" icon={<IconStudents />} />
          <StatCard label="Batches"  value={batchList.length}    color="#6a7fdb" icon={<IconBatches  />} />
          <StatCard label="Recitals" value={upcomingRecitals.length} color="#f4a041" icon={<IconRecitals />} />
        </div>
      </div>

      {/* ── Quick action buttons ── */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 28 }}>
        <ActionBtn color="#c4527a" onClick={() => navigate('/students')}>+ Add Student</ActionBtn>
        <ActionBtn color="#6a7fdb" onClick={() => navigate('/batches')}>+ Create Batch</ActionBtn>
        <ActionBtn color="#52c4a0" onClick={() => navigate('/schedule')}>+ Create Event</ActionBtn>
        <ActionBtn color="#f4a041" onClick={() => navigate('/recitals', { state: { openAdd: true } })}>+ Create Recital</ActionBtn>
        <ActionBtn outline color="var(--border)" onClick={() => navigate('/schedule')}>View Schedule →</ActionBtn>
      </div>

      {/* ── 3-column widget grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>

        {/* Upcoming Recitals */}
        <Widget emoji="🌟" title="Upcoming Recitals" onViewAll={() => navigate('/recitals')}>
          {upcomingRecitals.length === 0
            ? <div style={{ padding: '24px 18px', color: 'var(--muted)', fontSize: 13, textAlign: 'center' }}>No upcoming recitals</div>
            : upcomingRecitals.slice(0, 4).map(r => <RecitalRow key={r.id} r={r} />)
          }
        </Widget>

        {/* Upcoming Classes / Events */}
        <Widget emoji="📅" title="Upcoming Classes" onViewAll={() => navigate('/schedule')}>
          {upcomingEvents.length === 0
            ? <div style={{ padding: '24px 18px', color: 'var(--muted)', fontSize: 13, textAlign: 'center' }}>No upcoming events</div>
            : upcomingEvents.slice(0, 4).map(e => <EventRow key={e.id} e={e} />)
          }
        </Widget>

        {/* Open To-Dos */}
        <Widget emoji="✅" title="Open To-Dos" onViewAll={() => navigate('/todos')}>
          {openTodos.length === 0 && !addingTodo
            ? <div style={{ padding: '24px 18px', color: 'var(--muted)', fontSize: 13, textAlign: 'center' }}>All caught up!</div>
            : openTodos.slice(0, 4).map(t => (
                <TodoRow key={t.id} t={t}
                  onToggle={id => toggleTodo.mutate(id)}
                  onDelete={id => deleteTodo.mutate(id)}
                />
              ))
          }
          {/* Inline quick-add */}
          <div style={{ padding: '10px 18px', marginTop: 'auto' }}>
            {addingTodo ? (
              <form onSubmit={e => { e.preventDefault(); if (newTodo.trim()) addTodo.mutate(newTodo.trim()); }}
                style={{ display: 'flex', gap: 8 }}>
                <input
                  autoFocus
                  value={newTodo}
                  onChange={e => setNewTodo(e.target.value)}
                  placeholder="What needs doing?"
                  style={{
                    flex: 1, padding: '6px 10px', borderRadius: 8, border: '1.5px solid var(--accent)',
                    background: 'var(--surface)', color: 'var(--text)', fontSize: 13, outline: 'none',
                  }}
                  onKeyDown={e => { if (e.key === 'Escape') { setAddingTodo(false); setNewTodo(''); } }}
                />
                <button type="submit" style={{
                  padding: '6px 12px', borderRadius: 8, border: 'none', background: 'var(--accent)',
                  color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                }}>Add</button>
                <button type="button" onClick={() => { setAddingTodo(false); setNewTodo(''); }} style={{
                  padding: '6px 10px', borderRadius: 8, border: '1.5px solid var(--border)',
                  background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontSize: 12,
                }}>✕</button>
              </form>
            ) : (
              <button onClick={() => setAddingTodo(true)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--accent)', fontSize: 13, fontWeight: 600, padding: 0,
              }}>+ Add to-do</button>
            )}
          </div>
        </Widget>
      </div>
    </div>
  );
}

// ── Super admin dashboard ──────────────────────────────────────────────────────
function SuperAdminDash() {
  const { data: schoolList } = useQuery({ queryKey: ['schools'], queryFn: () => import('../api').then(m => m.schools.list()) });
  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-d)', fontSize: 26, marginBottom: 4 }}>Super Admin Dashboard</h1>
      <p style={{ color: 'var(--muted)', marginBottom: 24, fontSize: 13 }}>Manage all schools on the platform</p>
      <h2 style={{ fontFamily: 'var(--font-d)', fontSize: 17, marginBottom: 12 }}>All Schools</h2>
      <div style={{ display: 'grid', gap: 9 }}>
        {(schoolList || []).map(s => (
          <Card key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: `hsl(${s.name.charCodeAt(0)*7%360},55%,68%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#fff', fontSize: 16, flexShrink: 0 }}>{s.name[0]}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{s.name}</div>
              <div style={{ color: 'var(--muted)', fontSize: 12 }}>{s.owner_name} · {s.city} · {s.dance_style}</div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{s.student_count} students · {s.batch_count} batches</div>
          </Card>
        ))}
      </div>
    </div>
  );
}
