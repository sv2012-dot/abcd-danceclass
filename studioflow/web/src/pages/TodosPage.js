import React, { useState, useMemo, useRef, useEffect } from 'react';
import Card from '../components/shared/Card';
import { TodoKeyframeStyles, TodoRow } from '../components/shared/TodoItem';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { todos as todosApi, events as eventsApi, recitals as recitalsApi } from '../api';
import toast from 'react-hot-toast';


const AllClearIllustration = () => (
  <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="22" y="18" width="76" height="90" rx="10" fill="var(--surface)" stroke="var(--border)" strokeWidth="2"/>
    <rect x="42" y="12" width="36" height="14" rx="7" fill="var(--card)" stroke="var(--border)" strokeWidth="2"/>
    <rect x="50" y="15" width="20" height="8" rx="4" fill="var(--border)"/>
    {[38, 58, 78].map((cy, i) => (
      <g key={cy}>
        <circle cx="40" cy={cy} r="8" fill={i < 2 ? '#34c759' : 'var(--surface)'} stroke={i < 2 ? '#34c759' : 'var(--border)'} strokeWidth="1.5"/>
        {i < 2
          ? <polyline points={`36,${cy} 39,${cy+3} 44,${cy-3}`} stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          : <line x1="37" y1={cy} x2="43" y2={cy} stroke="var(--border)" strokeWidth="2" strokeLinecap="round"/>
        }
        <rect x="54" y={cy - 3} width={i === 2 ? 30 : 38} height="6" rx="3"
          fill={i === 2 ? 'var(--border)' : i === 0 ? '#c4527a22' : '#6a7fdb22'}
          opacity={i === 2 ? 0.5 : 1}
        />
      </g>
    ))}
    <circle cx="90" cy="30" r="3" fill="#f4a041" opacity="0.7"/>
    <circle cx="98" cy="22" r="2" fill="#c4527a" opacity="0.7"/>
    <circle cx="83" cy="22" r="1.5" fill="#6a7fdb" opacity="0.7"/>
  </svg>
);

/* ─── page ─────────────────────────────────────────── */
export default function TodosPage() {
  const { school } = useAuth();
  const sid = school?.id;
  const qc  = useQueryClient();
  const inputRef = useRef(null);

  const [quickTitle,      setQuickTitle]      = useState('');
  const [showExtra,       setShowExtra]       = useState(false);
  const [extraDueDate,    setExtraDueDate]    = useState('');
  const [extraAssignedTo, setExtraAssignedTo] = useState('');
  const [extraAssoc,      setExtraAssoc]      = useState('');
  const [activeTab,       setActiveTab]       = useState('all');

  // Auto-focus the input when the page mounts
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  const { data: todosData,   isLoading } = useQuery({ queryKey: ['todos',   sid], queryFn: () => todosApi.list(sid),    enabled: !!sid });
  const { data: eventsData  }            = useQuery({ queryKey: ['events',  sid], queryFn: () => eventsApi.list(sid),   enabled: !!sid });
  const { data: recitalsData }           = useQuery({ queryKey: ['recitals',sid], queryFn: () => recitalsApi.list(sid), enabled: !!sid });

  const todos        = todosData?.todos     || [];
  const eventsList   = eventsData?.events   || [];
  const recitalsList = recitalsData?.recitals || [];

  const createMut = useMutation({
    mutationFn: (data) => todosApi.create(sid, data),
    onSuccess: () => {
      qc.invalidateQueries(['todos', sid]);
      setQuickTitle('');
      setExtraDueDate('');
      setExtraAssignedTo('');
      setExtraAssoc('');
      setShowExtra(false);
      toast.success('To-do added');
      setTimeout(() => inputRef.current?.focus(), 50);
    },
    onError: (err) => toast.error(err?.error || err?.message || 'Failed to create'),
  });

  const toggleMut = useMutation({
    mutationFn: (id) => todosApi.toggle(sid, id),
    onMutate: async (id) => {
      await qc.cancelQueries(['todos', sid]);
      const prev = qc.getQueryData(['todos', sid]);
      qc.setQueryData(['todos', sid], old => old?.todos
        ? { ...old, todos: old.todos.map(t => t.id === id ? { ...t, is_complete: t.is_complete ? 0 : 1 } : t) }
        : old);
      return { prev };
    },
    onError: (_e, _id, ctx) => { qc.setQueryData(['todos', sid], ctx.prev); },
    onSettled: () => qc.invalidateQueries(['todos', sid]),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => todosApi.remove(sid, id),
    onSuccess: () => { qc.invalidateQueries(['todos', sid]); toast.success('Deleted'); },
    onError: () => toast.error('Failed to delete'),
  });

  const handleAdd = () => {
    if (!quickTitle.trim()) return;
    const payload = { title: quickTitle.trim() };
    if (extraDueDate)    payload.due_date    = extraDueDate;
    if (extraAssignedTo) payload.assigned_to = extraAssignedTo.trim();
    if (extraAssoc) {
      const [type, id] = extraAssoc.split(':');
      if (type === 'event')   payload.event_id   = Number(id);
      if (type === 'recital') payload.recital_id = Number(id);
    }
    createMut.mutate(payload);
  };

  const handleInputKeyDown = (e) => {
    if (e.key === 'Enter')  { e.preventDefault(); handleAdd(); }
    if (e.key === 'Escape') { e.preventDefault(); setShowExtra(false); setQuickTitle(''); inputRef.current?.blur(); }
  };

  const linkedTabs = useMemo(() => {
    const seen = new Set();
    const tabs = [];
    todos.forEach(t => {
      if (t.event_id   && t.event_title)   { const k = `event:${t.event_id}`;    if (!seen.has(k)) { seen.add(k); tabs.push({ key: k, label: t.event_title   }); } }
      if (t.recital_id && t.recital_title) { const k = `recital:${t.recital_id}`; if (!seen.has(k)) { seen.add(k); tabs.push({ key: k, label: t.recital_title }); } }
    });
    return tabs;
  }, [todos]);

  const filtered = useMemo(() => {
    if (activeTab === 'all')       return todos;
    if (activeTab === 'open')      return todos.filter(t => !t.is_complete);
    if (activeTab === 'completed') return todos.filter(t =>  t.is_complete);
    const [type, id] = activeTab.split(':');
    const numId = Number(id);
    if (type === 'event')   return todos.filter(t => t.event_id   === numId);
    if (type === 'recital') return todos.filter(t => t.recital_id === numId);
    return todos;
  }, [todos, activeTab]);

  const openTodos      = filtered.filter(t => !t.is_complete);
  const completedTodos = filtered.filter(t =>  t.is_complete);

  const tabStyle = (key) => ({
    padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
    fontSize: 12, fontWeight: 600,
    background: activeTab === key ? 'var(--accent)' : 'var(--surface)',
    color:      activeTab === key ? '#fff'          : 'var(--text)',
    transition: 'all .15s',
  });

  const hasLinkedOptions = eventsList.length > 0 || recitalsList.length > 0;

  return (
    <div>
      <TodoKeyframeStyles />
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: 'var(--font-d)', fontSize: 28, margin: 0 }}>To-Dos</h1>
      </div>

      {/* ── Quick-add bar — top of page ── */}
      <Card
        padding={0}
        style={{
          marginBottom: 28,
          overflow: 'hidden',
          boxShadow: showExtra ? '0 6px 28px rgba(0,0,0,0.10)' : undefined,
        }}
      >
        {/* single-line row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 18px' }}>
          <div style={{
            width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
            border: '2px dashed var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none',
          }}>
            <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
              <line x1="5" y1="1" x2="5" y2="9" stroke="var(--border)" strokeWidth="2" strokeLinecap="round"/>
              <line x1="1" y1="5" x2="9" y2="5" stroke="var(--border)" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>

          <input
            ref={inputRef}
            type="text"
            value={quickTitle}
            onChange={e => setQuickTitle(e.target.value)}
            onFocus={() => setShowExtra(true)}
            onKeyDown={handleInputKeyDown}
            placeholder="What needs to be done? (press Enter to add)"
            style={{
              flex: 1, border: 'none', outline: 'none',
              background: 'transparent', fontSize: 15,
              color: 'var(--text)', fontFamily: 'var(--font-sans)',
            }}
          />

          {quickTitle.trim() && (
            <button
              type="button"
              onClick={handleAdd}
              disabled={createMut.isLoading}
              style={{
                padding: '6px 16px', borderRadius: 9, border: 'none',
                background: 'var(--accent)', color: '#fff',
                fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
              }}
            >
              {createMut.isLoading ? '…' : 'Add'}
            </button>
          )}
        </div>

        {/* expandable extras */}
        {showExtra && (
          <div style={{
            borderTop: '1px solid var(--border)',
            padding: '12px 18px 14px',
            display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center',
            background: 'var(--surface)',
          }}>
            {/* end by date */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)', cursor: 'pointer' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <span style={{ fontWeight: 600 }}>End by</span>
              <input
                type="date"
                value={extraDueDate}
                onChange={e => setExtraDueDate(e.target.value)}
                style={{
                  border: 'none', background: 'transparent', outline: 'none',
                  fontSize: 12, color: extraDueDate ? 'var(--text)' : 'var(--muted)',
                  fontFamily: 'var(--font-sans)', cursor: 'pointer',
                }}
              />
            </label>

            {/* assigned to */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)', cursor: 'pointer' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
              <span style={{ fontWeight: 600 }}>Assign to</span>
              <input
                type="text"
                value={extraAssignedTo}
                onChange={e => setExtraAssignedTo(e.target.value)}
                placeholder="Not assigned"
                style={{
                  border: 'none', background: 'transparent', outline: 'none',
                  fontSize: 12, color: extraAssignedTo ? 'var(--text)' : 'var(--muted)',
                  fontFamily: 'var(--font-sans)',
                  width: 110,
                }}
              />
            </label>

            {/* association */}
            {hasLinkedOptions && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                </svg>
                <select
                  value={extraAssoc}
                  onChange={e => setExtraAssoc(e.target.value)}
                  style={{
                    border: 'none', background: 'transparent', outline: 'none',
                    fontSize: 12, color: extraAssoc ? 'var(--text)' : 'var(--muted)',
                    fontFamily: 'var(--font-sans)', cursor: 'pointer',
                  }}
                >
                  <option value="">Link to event / recital</option>
                  {eventsList.length > 0 && (
                    <optgroup label="Events">
                      {eventsList.map(ev => <option key={`event:${ev.id}`} value={`event:${ev.id}`}>{ev.title}</option>)}
                    </optgroup>
                  )}
                  {recitalsList.length > 0 && (
                    <optgroup label="Recitals">
                      {recitalsList.map(r => <option key={`recital:${r.id}`} value={`recital:${r.id}`}>{r.title}</option>)}
                    </optgroup>
                  )}
                </select>
              </label>
            )}

            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)', opacity: 0.6 }}>
              Esc to dismiss
            </span>
          </div>
        )}
      </Card>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {[{ key: 'all', label: 'All' }, { key: 'open', label: 'Open' }, { key: 'completed', label: 'Completed' }, ...linkedTabs].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={tabStyle(tab.key)}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Todo list */}
      {isLoading ? (
        <div style={{ color: 'var(--muted)', textAlign: 'center', marginTop: 60 }}>Loading…</div>
      ) : todos.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: '52px 20px 40px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <AllClearIllustration />
          </div>
          <div style={{ fontFamily: 'var(--font-d)', fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
            You're all caught up!
          </div>
          <div style={{ fontSize: 14, color: 'var(--muted)', maxWidth: 280, margin: '0 auto' }}>
            No tasks on the list. Use the bar above to add your first to-do.
          </div>
        </Card>
      ) : (
        <>
          {openTodos.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
                Open · {openTodos.length}
              </div>
              {openTodos.map(t => (
                <TodoRow key={t.id} todo={t}
                  onToggle={() => toggleMut.mutate(t.id)}
                  onDelete={() => deleteMut.mutate(t.id)}
                />
              ))}
            </div>
          )}

          {completedTodos.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
                Completed · {completedTodos.length}
              </div>
              {completedTodos.map(t => (
                <TodoRow key={t.id} todo={t}
                  onToggle={() => toggleMut.mutate(t.id)}
                  onDelete={() => deleteMut.mutate(t.id)}
                />
              ))}
            </div>
          )}

          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, padding: '40px 20px' }}>
              Nothing here yet.
            </div>
          )}
        </>
      )}
    </div>
  );
}
