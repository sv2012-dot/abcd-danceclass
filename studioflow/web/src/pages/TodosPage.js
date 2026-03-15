import React, { useState, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { todos as todosApi, events as eventsApi, recitals as recitalsApi } from '../api';
import toast from 'react-hot-toast';

function formatDueDate(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = (dateStr || '').slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function isOverdue(dateStr) {
  if (!dateStr) return false;
  const [y, m, d] = (dateStr || '').slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return false;
  const due = new Date(y, m - 1, d);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return due < today;
}

const CheckCircle = ({ complete, onClick }) => (
  <div
    onClick={onClick}
    title={complete ? 'Mark incomplete' : 'Mark complete'}
    style={{
      width: 20, height: 20, borderRadius: '50%',
      border: complete ? '2px solid #34c759' : '2px solid var(--border)',
      background: complete ? '#34c759' : 'var(--card)',
      cursor: 'pointer', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'all .15s',
    }}
  >
    {complete && (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    )}
  </div>
);

const TrashIcon = ({ onClick }) => (
  <button
    onClick={onClick}
    title="Delete"
    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c7c7cc', padding: 4, display: 'flex', alignItems: 'center' }}
    onMouseEnter={e => { e.currentTarget.style.color = '#ff3b30'; }}
    onMouseLeave={e => { e.currentTarget.style.color = '#c7c7cc'; }}
  >
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3,6 5,6 21,6" />
      <path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a1,1,0,0,1,1-1h4a1,1,0,0,1,1,1v2" />
    </svg>
  </button>
);

/* ── Blank-state illustration ── */
const AllClearIllustration = () => (
  <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* clipboard body */}
    <rect x="22" y="18" width="76" height="90" rx="10" fill="var(--surface)" stroke="var(--border)" strokeWidth="2"/>
    {/* clip at top */}
    <rect x="42" y="12" width="36" height="14" rx="7" fill="var(--card)" stroke="var(--border)" strokeWidth="2"/>
    <rect x="50" y="15" width="20" height="8" rx="4" fill="var(--border)"/>
    {/* check rows */}
    {[38, 58, 78].map((y, i) => (
      <g key={y}>
        {/* circle tick */}
        <circle cx="40" cy={y} r="8" fill={i === 2 ? 'var(--surface)' : '#34c759'} stroke={i === 2 ? 'var(--border)' : '#34c759'} strokeWidth="1.5"/>
        {i < 2 && (
          <polyline points={`36,${y} 39,${y+3} 44,${y-3}`} stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        )}
        {i === 2 && (
          <line x1="37" y1={y} x2="43" y2={y} stroke="var(--border)" strokeWidth="2" strokeLinecap="round"/>
        )}
        {/* line */}
        <rect x="54" y={y - 3} width={i === 2 ? 30 : 38} height="6" rx="3"
          fill={i === 2 ? 'var(--border)' : i === 0 ? '#c4527a22' : '#6a7fdb22'}
          opacity={i === 2 ? 0.5 : 1}
        />
      </g>
    ))}
    {/* sparkle top-right */}
    <g opacity="0.7">
      <circle cx="90" cy="30" r="3" fill="#f4a041"/>
      <circle cx="98" cy="22" r="2" fill="#c4527a"/>
      <circle cx="83" cy="22" r="1.5" fill="#6a7fdb"/>
    </g>
  </svg>
);

export default function TodosPage() {
  const { school } = useAuth();
  const sid = school?.id;
  const qc = useQueryClient();
  const inputRef = useRef(null);

  const [quickTitle, setQuickTitle] = useState('');
  const [showExtra, setShowExtra] = useState(false);
  const [extraFields, setExtraFields] = useState({ due_date: '', association: '' });
  const [activeTab, setActiveTab] = useState('all');

  const { data: todosData, isLoading } = useQuery({
    queryKey: ['todos', sid],
    queryFn: () => todosApi.list(sid),
    enabled: !!sid,
  });

  const { data: eventsData } = useQuery({
    queryKey: ['events', sid],
    queryFn: () => eventsApi.list(sid),
    enabled: !!sid,
  });

  const { data: recitalsData } = useQuery({
    queryKey: ['recitals', sid],
    queryFn: () => recitalsApi.list(sid),
    enabled: !!sid,
  });

  const todos = todosData?.todos || [];
  const eventsList = eventsData?.events || [];
  const recitalsList = recitalsData?.recitals || [];

  const createMut = useMutation({
    mutationFn: (data) => todosApi.create(sid, data),
    onSuccess: () => {
      qc.invalidateQueries(['todos', sid]);
      setQuickTitle('');
      setExtraFields({ due_date: '', association: '' });
      setShowExtra(false);
      toast.success('To-do added');
      inputRef.current?.focus();
    },
    onError: (err) => toast.error(err?.error || err?.message || 'Failed to create'),
  });

  const toggleMut = useMutation({
    mutationFn: (id) => todosApi.toggle(sid, id),
    onMutate: async (id) => {
      await qc.cancelQueries(['todos', sid]);
      const prev = qc.getQueryData(['todos', sid]);
      qc.setQueryData(['todos', sid], old => {
        if (!old?.todos) return old;
        return { ...old, todos: old.todos.map(t => t.id === id ? { ...t, is_complete: t.is_complete ? 0 : 1 } : t) };
      });
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
    if (extraFields.due_date) payload.due_date = extraFields.due_date;
    if (extraFields.association) {
      const [type, id] = extraFields.association.split(':');
      if (type === 'event') payload.event_id = Number(id);
      if (type === 'recital') payload.recital_id = Number(id);
    }
    createMut.mutate(payload);
  };

  const linkedTabs = useMemo(() => {
    const seen = new Set();
    const tabs = [];
    todos.forEach(t => {
      if (t.event_id && t.event_title) {
        const key = `event:${t.event_id}`;
        if (!seen.has(key)) { seen.add(key); tabs.push({ key, label: t.event_title }); }
      }
      if (t.recital_id && t.recital_title) {
        const key = `recital:${t.recital_id}`;
        if (!seen.has(key)) { seen.add(key); tabs.push({ key, label: t.recital_title }); }
      }
    });
    return tabs;
  }, [todos]);

  const filtered = useMemo(() => {
    if (activeTab === 'all') return todos;
    if (activeTab === 'open') return todos.filter(t => !t.is_complete);
    if (activeTab === 'completed') return todos.filter(t => t.is_complete);
    const [type, id] = activeTab.split(':');
    const numId = Number(id);
    if (type === 'event') return todos.filter(t => t.event_id === numId);
    if (type === 'recital') return todos.filter(t => t.recital_id === numId);
    return todos;
  }, [todos, activeTab]);

  const openTodos = filtered.filter(t => !t.is_complete);
  const completedTodos = filtered.filter(t => t.is_complete);

  const TodoRow = ({ todo }) => {
    const complete = !!todo.is_complete;
    const overdue = !complete && isOverdue(todo.due_date);
    const linkedLabel = todo.event_title || todo.recital_title;
    const linkedColor = todo.event_title ? '#6a7fdb' : '#c4527a';

    return (
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 12,
        padding: '10px 14px',
        background: 'var(--card)', borderRadius: 10,
        border: '1px solid var(--border)',
        marginBottom: 6,
        opacity: complete ? 0.65 : 1,
        transition: 'opacity .15s',
      }}>
        <CheckCircle complete={complete} onClick={() => toggleMut.mutate(todo.id)} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14,
            color: complete ? 'var(--muted)' : 'var(--text)',
            textDecoration: complete ? 'line-through' : 'none',
            fontWeight: 500,
          }}>
            {todo.title}
          </div>
          {todo.notes && (
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{todo.notes}</div>
          )}
          <div style={{ display: 'flex', gap: 6, marginTop: (linkedLabel || todo.due_date) ? 5 : 0, flexWrap: 'wrap', alignItems: 'center' }}>
            {linkedLabel && (
              <span style={{ fontSize: 11, color: '#fff', background: linkedColor, padding: '2px 8px', borderRadius: 999, fontWeight: 600 }}>
                {linkedLabel}
              </span>
            )}
            {todo.due_date && (
              <span style={{
                fontSize: 11,
                color: overdue ? '#ff3b30' : 'var(--muted)',
                background: overdue ? '#fff0ee' : 'var(--surface)',
                padding: '2px 8px', borderRadius: 999, fontWeight: 600,
              }}>
                {overdue && '⚠ '}{formatDueDate(todo.due_date)}
              </span>
            )}
          </div>
        </div>
        <TrashIcon onClick={() => deleteMut.mutate(todo.id)} />
      </div>
    );
  };

  const tabStyle = (key) => ({
    padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
    fontSize: 12, fontWeight: 600,
    background: activeTab === key ? 'var(--accent)' : 'var(--surface)',
    color: activeTab === key ? '#fff' : 'var(--text)',
    transition: 'all .15s',
  });

  /* ── Quick-add bar (always visible at bottom) ── */
  const QuickAddBar = () => (
    <div style={{
      marginTop: 24,
      background: 'var(--card)',
      borderRadius: 14,
      border: '1.5px solid var(--border)',
      overflow: 'hidden',
      transition: 'box-shadow .2s',
      boxShadow: showExtra ? '0 4px 20px rgba(0,0,0,0.08)' : 'none',
    }}>
      {/* Single-line row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px' }}>
        {/* Dashed placeholder circle */}
        <div style={{
          width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
          border: '2px dashed var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
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
          onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') { setShowExtra(false); setQuickTitle(''); inputRef.current?.blur(); } }}
          placeholder="What needs to be done?"
          style={{
            flex: 1, border: 'none', outline: 'none',
            background: 'transparent', fontSize: 14,
            color: 'var(--text)', fontFamily: 'var(--font-sans)',
          }}
        />

        {quickTitle.trim() && (
          <button
            onClick={handleAdd}
            disabled={createMut.isLoading}
            style={{
              padding: '5px 14px', borderRadius: 8, border: 'none',
              background: 'var(--accent)', color: '#fff',
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            {createMut.isLoading ? '…' : 'Add'}
          </button>
        )}
      </div>

      {/* Expandable extras — shown when focused */}
      {showExtra && (
        <div style={{
          borderTop: '1px solid var(--border)',
          padding: '10px 14px 12px',
          display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center',
          background: 'var(--surface)',
        }}>
          {/* Due date */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)', cursor: 'pointer' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <input
              type="date"
              value={extraFields.due_date}
              onChange={e => setExtraFields(f => ({ ...f, due_date: e.target.value }))}
              style={{
                border: 'none', background: 'transparent', outline: 'none',
                fontSize: 12, color: extraFields.due_date ? 'var(--text)' : 'var(--muted)',
                fontFamily: 'var(--font-sans)', cursor: 'pointer',
              }}
            />
          </label>

          {/* Association */}
          {(eventsList.length > 0 || recitalsList.length > 0) && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
              </svg>
              <select
                value={extraFields.association}
                onChange={e => setExtraFields(f => ({ ...f, association: e.target.value }))}
                style={{
                  border: 'none', background: 'transparent', outline: 'none',
                  fontSize: 12, color: extraFields.association ? 'var(--text)' : 'var(--muted)',
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

          {/* Dismiss hint */}
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)', opacity: 0.6 }}>Esc to dismiss</span>
        </div>
      )}
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--font-d)', fontSize: 28, margin: 0 }}>To-Dos</h1>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {[{ key: 'all', label: 'All' }, { key: 'open', label: 'Open' }, { key: 'completed', label: 'Completed' }, ...linkedTabs].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={tabStyle(tab.key)}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div style={{ color: 'var(--muted)', textAlign: 'center', marginTop: 60 }}>Loading...</div>
      ) : todos.length === 0 ? (
        /* ── All-clear blank state ── */
        <div style={{
          textAlign: 'center', padding: '52px 20px 40px',
          background: 'var(--card)', borderRadius: 16,
          border: '1.5px solid var(--border)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <AllClearIllustration />
          </div>
          <div style={{ fontFamily: 'var(--font-d)', fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
            You're all caught up!
          </div>
          <div style={{ fontSize: 14, color: 'var(--muted)', maxWidth: 280, margin: '0 auto' }}>
            No tasks on the list. Use the bar below to add your first to-do.
          </div>
        </div>
      ) : (
        <>
          {openTodos.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
                Open · {openTodos.length}
              </div>
              {openTodos.map(todo => <TodoRow key={todo.id} todo={todo} />)}
            </div>
          )}

          {completedTodos.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
                Completed · {completedTodos.length}
              </div>
              {completedTodos.map(todo => <TodoRow key={todo.id} todo={todo} />)}
            </div>
          )}

          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, padding: '40px 20px' }}>
              Nothing here yet.
            </div>
          )}
        </>
      )}

      {/* ── Permanent quick-add bar ── */}
      <QuickAddBar />
    </div>
  );
}
