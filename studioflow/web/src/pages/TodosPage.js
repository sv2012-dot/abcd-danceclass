import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { todos as todosApi, events as eventsApi, recitals as recitalsApi } from '../api';
import toast from 'react-hot-toast';

function formatDueDate(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function isOverdue(dateStr) {
  if (!dateStr) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  const due = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}

const CheckCircle = ({ complete, onClick }) => (
  <div
    onClick={onClick}
    title={complete ? 'Mark incomplete' : 'Mark complete'}
    style={{
      width: 20, height: 20, borderRadius: '50%',
      border: complete ? '2px solid #34c759' : '2px solid #d2d2d7',
      background: complete ? '#34c759' : '#fff',
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

export default function TodosPage() {
  const { school } = useAuth();
  const sid = school?.id;
  const qc = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', notes: '', due_date: '', association: '' });
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

  const todos = todosData?.data?.todos || [];
  const eventsList = eventsData?.data?.events || [];
  const recitalsList = recitalsData?.data?.recitals || [];

  const createMut = useMutation({
    mutationFn: (data) => todosApi.create(sid, data),
    onSuccess: () => {
      qc.invalidateQueries(['todos', sid]);
      setForm({ title: '', notes: '', due_date: '', association: '' });
      setShowForm(false);
      toast.success('To-do added');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to create'),
  });

  const toggleMut = useMutation({
    mutationFn: (id) => todosApi.toggle(sid, id),
    onMutate: async (id) => {
      await qc.cancelQueries(['todos', sid]);
      const prev = qc.getQueryData(['todos', sid]);
      qc.setQueryData(['todos', sid], old => {
        if (!old?.data?.todos) return old;
        return { ...old, data: { todos: old.data.todos.map(t => t.id === id ? { ...t, is_complete: t.is_complete ? 0 : 1 } : t) } };
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

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    const payload = { title: form.title.trim(), notes: form.notes || undefined, due_date: form.due_date || undefined };
    if (form.association) {
      const [type, id] = form.association.split(':');
      if (type === 'event') payload.event_id = Number(id);
      if (type === 'recital') payload.recital_id = Number(id);
    }
    createMut.mutate(payload);
  };

  // Build tab list from todos that have linked events/recitals
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
        background: '#fff', borderRadius: 10,
        border: '1px solid var(--border)',
        marginBottom: 6,
        opacity: complete ? 0.7 : 1,
        transition: 'opacity .15s',
      }}>
        <CheckCircle complete={complete} onClick={() => toggleMut.mutate(todo.id)} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14,
            color: complete ? '#aeaeb2' : '#1d1d1f',
            textDecoration: complete ? 'line-through' : 'none',
            fontWeight: 500,
          }}>
            {todo.title}
          </div>
          {todo.notes && (
            <div style={{ fontSize: 12, color: '#8e8e93', marginTop: 2 }}>{todo.notes}</div>
          )}
          <div style={{ display: 'flex', gap: 6, marginTop: linkedLabel || todo.due_date ? 5 : 0, flexWrap: 'wrap', alignItems: 'center' }}>
            {linkedLabel && (
              <span style={{
                fontSize: 11, color: '#fff',
                background: linkedColor,
                padding: '2px 8px', borderRadius: 999, fontWeight: 600,
              }}>
                {linkedLabel}
              </span>
            )}
            {todo.due_date && (
              <span style={{
                fontSize: 11,
                color: overdue ? '#ff3b30' : '#6e6e73',
                background: overdue ? '#fff0ee' : '#f5f5f7',
                padding: '2px 8px', borderRadius: 999, fontWeight: 600,
              }}>
                {formatDueDate(todo.due_date)}
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
    background: activeTab === key ? 'var(--accent)' : '#f5f5f7',
    color: activeTab === key ? '#fff' : '#1d1d1f',
    transition: 'all .15s',
  });

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontFamily: 'var(--font-d)', fontSize: 28, margin: 0 }}>To-Dos</h1>
        <button
          onClick={() => setShowForm(s => !s)}
          style={{
            padding: '9px 18px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 13,
            display: 'flex', alignItems: 'center', gap: 7,
          }}
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Add To-Do
        </button>
      </div>

      {/* Inline Add Form */}
      {showForm && (
        <div style={{
          background: '#fff', borderRadius: 14, border: '1.5px solid var(--accent)',
          padding: '20px 22px', marginBottom: 24,
          boxShadow: '0 4px 20px rgba(0,0,0,0.07)',
          animation: 'fadeInDown .2s ease',
        }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>New To-Do</div>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 5 }}>
                Title *
              </label>
              <input
                type="text"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="What needs to be done?"
                required
                autoFocus
                style={{
                  width: '100%', padding: '9px 12px', borderRadius: 8,
                  border: '1.5px solid var(--border)', fontSize: 14,
                  fontFamily: 'var(--font-sans)', boxSizing: 'border-box', outline: 'none',
                }}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 5 }}>
                Notes
              </label>
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Optional details..."
                rows={2}
                style={{
                  width: '100%', padding: '9px 12px', borderRadius: 8,
                  border: '1.5px solid var(--border)', fontSize: 13, resize: 'vertical',
                  fontFamily: 'var(--font-sans)', boxSizing: 'border-box', outline: 'none',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 160px' }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 5 }}>
                  Due Date
                </label>
                <input
                  type="date"
                  value={form.due_date}
                  onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                  style={{
                    width: '100%', padding: '9px 12px', borderRadius: 8,
                    border: '1.5px solid var(--border)', fontSize: 13,
                    fontFamily: 'var(--font-sans)', boxSizing: 'border-box', outline: 'none',
                  }}
                />
              </div>
              <div style={{ flex: '1 1 220px' }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 5 }}>
                  Associate With
                </label>
                <select
                  value={form.association}
                  onChange={e => setForm(f => ({ ...f, association: e.target.value }))}
                  style={{
                    width: '100%', padding: '9px 12px', borderRadius: 8,
                    border: '1.5px solid var(--border)', fontSize: 13,
                    fontFamily: 'var(--font-sans)', boxSizing: 'border-box', outline: 'none',
                    background: '#fff',
                  }}
                >
                  <option value="">None</option>
                  {eventsList.length > 0 && (
                    <optgroup label="Events">
                      {eventsList.map(ev => (
                        <option key={`event:${ev.id}`} value={`event:${ev.id}`}>{ev.title}</option>
                      ))}
                    </optgroup>
                  )}
                  {recitalsList.length > 0 && (
                    <optgroup label="Recitals">
                      {recitalsList.map(r => (
                        <option key={`recital:${r.id}`} value={`recital:${r.id}`}>{r.title}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => { setShowForm(false); setForm({ title: '', notes: '', due_date: '', association: '' }); }}
                style={{ padding: '8px 18px', borderRadius: 8, border: '1.5px solid var(--border)', background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createMut.isLoading || !form.title.trim()}
                style={{
                  padding: '8px 22px', borderRadius: 8, border: 'none',
                  background: form.title.trim() ? 'var(--accent)' : '#d2d2d7',
                  color: '#fff', cursor: form.title.trim() ? 'pointer' : 'not-allowed',
                  fontWeight: 700, fontSize: 13,
                }}
              >
                {createMut.isLoading ? 'Adding...' : 'Add To-Do'}
              </button>
            </div>
          </form>
        </div>
      )}

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
        <div style={{ color: 'var(--muted)', textAlign: 'center', marginTop: 40 }}>Loading...</div>
      ) : todos.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '60px 20px',
          color: 'var(--muted)', fontSize: 14,
          background: '#fff', borderRadius: 14, border: '1.5px dashed var(--border)',
        }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>No to-dos yet.</div>
          <div>Add one above to get started.</div>
        </div>
      ) : (
        <>
          {/* Open section */}
          {openTodos.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
                Open ({openTodos.length})
              </div>
              {openTodos.map(todo => <TodoRow key={todo.id} todo={todo} />)}
            </div>
          )}

          {/* Completed section */}
          {completedTodos.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
                Completed ({completedTodos.length})
              </div>
              {completedTodos.map(todo => <TodoRow key={todo.id} todo={todo} />)}
            </div>
          )}

          {/* Active tab is filtered and shows nothing */}
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, padding: '40px 20px' }}>
              No to-dos in this category.
            </div>
          )}
        </>
      )}
    </div>
  );
}
