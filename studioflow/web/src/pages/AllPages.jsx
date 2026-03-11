// ═══════════════════════════════════════════════════════
//  StudentsPage.jsx
// ═══════════════════════════════════════════════════════
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import * as api from '../api';
import { Btn, Input, Select, Field, Card, Avatar, Badge, Modal, Grid2, PageHeader, EmptyState, Spinner, useToast } from '../components/UI';

// ── Helpers ──────────────────────────────────────────
function SInfoRow({ icon, label, value }) {
  if (!value) return null;
  return (
    <div style={{ display:'flex', gap:10, marginBottom:10, alignItems:'flex-start' }}>
      <span style={{ fontSize:14, flexShrink:0, width:20, textAlign:'center', marginTop:1 }}>{icon}</span>
      <div>
        <div style={{ fontSize:10, color:'var(--muted)', fontWeight:700, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:2 }}>{label}</div>
        <div style={{ fontSize:13, fontWeight:500, wordBreak:'break-word' }}>{value}</div>
      </div>
    </div>
  );
}

function SPanelSection({ title, children }) {
  return (
    <div style={{ marginBottom:20 }}>
      <div style={{ fontSize:10, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:10, paddingBottom:6, borderBottom:'1px solid var(--border)' }}>{title}</div>
      {children}
    </div>
  );
}

// Deterministic avatar: mix of real photos (pravatar) + illustrated (DiceBear)
function getStudentAvatar(student) {
  const h = ((student.id || 0) * 13 + (student.name?.charCodeAt(0) || 0)) % 10;
  if (h < 5) return `https://i.pravatar.cc/150?img=${(((student.id || 1) * 7) % 70) + 1}`;
  if (h < 8) return `https://api.dicebear.com/7.x/avataaars/svg?seed=${student.id}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
  return `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${encodeURIComponent(student.name || student.id)}`;
}

export function StudentsPage() {
  const { user } = useAuth();
  const { show, Toast } = useToast();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [view, setView] = useState('grid'); // 'grid' | 'table'
  const [selected, setSelected] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({});
  const sid = user.school_id;
  const PANEL_W = 400;

  const load = () => api.students.list(sid)
    .then(r => setStudents(Array.isArray(r) ? r : (r.students || [])))
    .finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const filtered = students.filter(s => s.name?.toLowerCase().includes(search.toLowerCase()));

  const selectStudent = s => { setSelected(s); setIsEditing(false); };

  const saveEdit = async () => {
    try {
      await api.students.update(sid, selected.id, editForm);
      const updated = { ...selected, ...editForm };
      setStudents(prev => prev.map(s => s.id === selected.id ? updated : s));
      setSelected(updated);
      setIsEditing(false);
      show('Student updated');
    } catch (e) { show(e?.error || 'Error saving', 'error'); }
  };

  const removeStudent = async id => {
    if (!window.confirm('Remove this student?')) return;
    try {
      await api.students.remove(sid, id);
      setStudents(prev => prev.filter(s => s.id !== id));
      if (selected?.id === id) setSelected(null);
      show('Student removed');
    } catch (e) { show('Error removing student', 'error'); }
  };

  const saveNew = async () => {
    try {
      await api.students.create(sid, addForm);
      show('Student added'); setShowAdd(false); load();
    } catch (e) { show(e?.error || 'Error adding student', 'error'); }
  };

  const fmtDate = d => d ? new Date(d).toLocaleDateString('en', { year:'numeric', month:'long', day:'numeric' }) : null;
  const fmtShort = d => d ? new Date(d).toLocaleDateString('en', { month:'short', year:'numeric' }) : null;

  return (
    <div style={{ marginRight: selected ? PANEL_W + 20 : 0, transition:'margin .25s ease' }}>
      <Toast />

      {/* ── Header ── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:10 }}>
        <div>
          <h1 style={{ fontFamily:'var(--font-d)', fontSize:24, marginBottom:2 }}>Students</h1>
          <p style={{ color:'var(--muted)', fontSize:12 }}>{students.length} enrolled</p>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          {/* View toggle */}
          <div style={{ display:'flex', border:'1.5px solid var(--border)', borderRadius:9, overflow:'hidden' }}>
            <button onClick={() => setView('grid')} title="Grid view"
              style={{ padding:'7px 13px', border:'none', background: view==='grid' ? 'var(--accent)' : 'transparent',
                color: view==='grid' ? '#fff' : 'var(--muted)', cursor:'pointer', fontSize:16, lineHeight:1, transition:'all .15s' }}>
              ⊞
            </button>
            <button onClick={() => setView('table')} title="Table view"
              style={{ padding:'7px 13px', border:'none', borderLeft:'1.5px solid var(--border)',
                background: view==='table' ? 'var(--accent)' : 'transparent',
                color: view==='table' ? '#fff' : 'var(--muted)', cursor:'pointer', fontSize:16, lineHeight:1, transition:'all .15s' }}>
              ☰
            </button>
          </div>
          <Btn onClick={() => { setAddForm({ join_date: new Date().toISOString().split('T')[0] }); setShowAdd(true); }}>➕ Add Student</Btn>
        </div>
      </div>

      {/* ── Search ── */}
      <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search students…" style={{ maxWidth:280, marginBottom:18 }} />

      {/* ── Content ── */}
      {loading ? (
        <div style={{ display:'flex', justifyContent:'center', padding:40 }}><Spinner /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon="👤" title="No students yet" message="Add your first student to get started."
          action={<Btn onClick={() => { setAddForm({ join_date: new Date().toISOString().split('T')[0] }); setShowAdd(true); }}>Add Student</Btn>} />
      ) : view === 'grid' ? (
        /* ── Grid view ── */
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(190px, 1fr))', gap:12 }}>
          {filtered.map(s => {
            const avatarUrl = getStudentAvatar(s);
            const isActive = selected?.id === s.id;
            return (
              <div key={s.id} onClick={() => selectStudent(s)} style={{
                background:'var(--card)', borderRadius:14, padding:16, cursor:'pointer',
                border:`2px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                boxShadow: isActive ? '0 0 0 3px color-mix(in srgb, var(--accent) 20%, transparent)' : '0 1px 4px rgba(0,0,0,.05)',
                transition:'all .15s'
              }}>
                {/* Avatar + name */}
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                  <div style={{ width:44, height:44, borderRadius:'50%', overflow:'hidden', flexShrink:0,
                    border:`2px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`, background:'var(--surface)', transition:'border-color .15s' }}>
                    <img src={avatarUrl} alt={s.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                  </div>
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontWeight:700, fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.name}</div>
                    {s.age && <div style={{ fontSize:11, color:'var(--muted)' }}>Age {s.age}</div>}
                  </div>
                </div>
                {/* Email */}
                {s.email && <div style={{ fontSize:11, color:'var(--muted)', marginBottom:6, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>✉ {s.email}</div>}
                {/* Phone (fallback) */}
                {!s.email && s.phone && <div style={{ fontSize:11, color:'var(--muted)', marginBottom:6 }}>📞 {s.phone}</div>}
                {/* Batch pills */}
                {s.batch_names && (
                  <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:8 }}>
                    {s.batch_names.split(',').slice(0,2).map((b,i) => (
                      <span key={i} style={{ fontSize:10, background:'var(--accent)18', color:'var(--accent)', borderRadius:20, padding:'2px 8px', fontWeight:600 }}>{b.trim()}</span>
                    ))}
                    {s.batch_names.split(',').length > 2 && (
                      <span style={{ fontSize:10, color:'var(--muted)', padding:'2px 4px' }}>+{s.batch_names.split(',').length - 2}</span>
                    )}
                  </div>
                )}
                {/* Join date */}
                {s.join_date && <div style={{ fontSize:10, color:'var(--muted)', marginTop:10, opacity:.7 }}>Joined {fmtShort(s.join_date)}</div>}
              </div>
            );
          })}
        </div>
      ) : (
        /* ── Table view ── */
        <div style={{ background:'var(--card)', borderRadius:14, border:'1px solid var(--border)', overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'var(--surface)' }}>
                {['Student','Age','Contact','Batch','Joined',''].map(h => (
                  <th key={h} style={{ padding:'11px 14px', textAlign:'left', fontSize:11, fontWeight:700, letterSpacing:'.06em', textTransform:'uppercase', color:'var(--muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => {
                const avatarUrl = getStudentAvatar(s);
                const isActive = selected?.id === s.id;
                return (
                  <tr key={s.id} onClick={() => selectStudent(s)} style={{
                    borderTop:'1px solid var(--border)', cursor:'pointer',
                    background: isActive ? 'var(--accent)0a' : 'transparent', transition:'background .1s'
                  }}>
                    <td style={{ padding:'10px 14px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <div style={{ width:34, height:34, borderRadius:'50%', overflow:'hidden', flexShrink:0, border:'1.5px solid var(--border)' }}>
                          <img src={avatarUrl} alt={s.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                        </div>
                        <span style={{ fontWeight:600, fontSize:13 }}>{s.name}</span>
                      </div>
                    </td>
                    <td style={{ padding:'10px 14px', fontSize:13, color:'var(--muted)' }}>{s.age || '—'}</td>
                    <td style={{ padding:'10px 14px', fontSize:12, color:'var(--muted)', maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.email || s.phone || '—'}</td>
                    <td style={{ padding:'10px 14px' }}>
                      {s.batch_names
                        ? <span style={{ fontSize:11, background:'var(--accent)18', color:'var(--accent)', borderRadius:20, padding:'2px 9px', fontWeight:600 }}>{s.batch_names.split(',')[0].trim()}</span>
                        : <span style={{ color:'var(--muted)', fontSize:12 }}>—</span>}
                    </td>
                    <td style={{ padding:'10px 14px', fontSize:12, color:'var(--muted)' }}>{fmtShort(s.join_date) || '—'}</td>
                    <td style={{ padding:'10px 14px' }}>
                      <button onClick={e => { e.stopPropagation(); removeStudent(s.id); }}
                        style={{ background:'none', border:'none', cursor:'pointer', fontSize:14, color:'var(--muted)', padding:'3px 7px', borderRadius:6, opacity:.6 }}>🗑</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Right Detail Panel ── */}
      {selected && (
        <div style={{
          position:'fixed', right:0, top:0, bottom:0, width:PANEL_W,
          background:'var(--card)', borderLeft:'1.5px solid var(--border)',
          display:'flex', flexDirection:'column', zIndex:300,
          boxShadow:'-6px 0 32px rgba(0,0,0,.09)'
        }}>
          {/* Panel header */}
          <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
            <span style={{ fontSize:11, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em' }}>Student Profile</span>
            <button onClick={() => { setSelected(null); setIsEditing(false); }}
              style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:'var(--muted)', lineHeight:1, padding:4, borderRadius:6 }}>✕</button>
          </div>

          {/* Profile hero */}
          {(() => {
            const avatarUrl = getStudentAvatar(selected);
            return (
              <div style={{ padding:'28px 24px 20px', textAlign:'center', borderBottom:'1px solid var(--border)', flexShrink:0, background:'var(--surface)' }}>
                <div style={{ width:80, height:80, borderRadius:'50%', overflow:'hidden', margin:'0 auto 14px',
                  border:'3px solid var(--accent)', background:'var(--card)',
                  boxShadow:'0 4px 16px rgba(0,0,0,.12)' }}>
                  <img src={avatarUrl} alt={selected.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                </div>
                <div style={{ fontFamily:'var(--font-d)', fontSize:18, fontWeight:800, marginBottom:3 }}>{selected.name}</div>
                {selected.age && <div style={{ fontSize:13, color:'var(--muted)', marginBottom:10 }}>Age {selected.age}</div>}
                {selected.batch_names && (
                  <div style={{ display:'flex', gap:5, justifyContent:'center', flexWrap:'wrap' }}>
                    {selected.batch_names.split(',').map((b,i) => (
                      <span key={i} style={{ fontSize:11, background:'var(--accent)22', color:'var(--accent)', borderRadius:20, padding:'3px 10px', fontWeight:600 }}>{b.trim()}</span>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Scrollable body */}
          <div style={{ flex:1, overflowY:'auto', padding:'22px 24px' }}>
            {!isEditing ? (
              /* ── View mode ── */
              <>
                <SPanelSection title="Contact">
                  <SInfoRow icon="✉️" label="Email" value={selected.email} />
                  <SInfoRow icon="📞" label="Phone" value={selected.phone} />
                  {!selected.email && !selected.phone && <p style={{ fontSize:12, color:'var(--muted)' }}>No contact info</p>}
                </SPanelSection>

                {(selected.guardian_name || selected.guardian_phone || selected.guardian_email) && (
                  <SPanelSection title="Guardian">
                    <SInfoRow icon="👤" label="Name" value={selected.guardian_name} />
                    <SInfoRow icon="📞" label="Phone" value={selected.guardian_phone} />
                    <SInfoRow icon="✉️" label="Email" value={selected.guardian_email} />
                  </SPanelSection>
                )}

                <SPanelSection title="Enrollment">
                  <SInfoRow icon="📅" label="Joined" value={fmtDate(selected.join_date)} />
                </SPanelSection>

                {selected.notes && (
                  <SPanelSection title="Notes">
                    <p style={{ fontSize:13, color:'var(--muted)', lineHeight:1.6, background:'var(--surface)', borderRadius:9, padding:'10px 12px', margin:0 }}>
                      {selected.notes}
                    </p>
                  </SPanelSection>
                )}

                <div style={{ display:'flex', gap:9, marginTop:24 }}>
                  <Btn onClick={() => { setEditForm({...selected}); setIsEditing(true); }} full>✏️ Edit Profile</Btn>
                  <button onClick={() => removeStudent(selected.id)}
                    style={{ padding:'8px 14px', borderRadius:9, border:'1.5px solid #e05c6a', background:'transparent', color:'#e05c6a', cursor:'pointer', fontSize:13, fontFamily:'var(--font-b)', flexShrink:0 }}>🗑</button>
                </div>
              </>
            ) : (
              /* ── Edit mode ── */
              <>
                <Field label="Full Name"><Input value={editForm.name||''} onChange={e=>setEditForm({...editForm,name:e.target.value})} /></Field>
                <Field label="Age"><Input type="number" value={editForm.age||''} onChange={e=>setEditForm({...editForm,age:e.target.value})} placeholder="e.g. 12"/></Field>
                <Field label="Phone"><Input value={editForm.phone||''} onChange={e=>setEditForm({...editForm,phone:e.target.value})} /></Field>
                <Field label="Email"><Input value={editForm.email||''} onChange={e=>setEditForm({...editForm,email:e.target.value})} /></Field>
                <Field label="Guardian Name"><Input value={editForm.guardian_name||''} onChange={e=>setEditForm({...editForm,guardian_name:e.target.value})} /></Field>
                <Field label="Guardian Phone"><Input value={editForm.guardian_phone||''} onChange={e=>setEditForm({...editForm,guardian_phone:e.target.value})} /></Field>
                <Field label="Guardian Email"><Input value={editForm.guardian_email||''} onChange={e=>setEditForm({...editForm,guardian_email:e.target.value})} /></Field>
                <Field label="Join Date"><Input type="date" value={(editForm.join_date||'').split('T')[0]} onChange={e=>setEditForm({...editForm,join_date:e.target.value})} /></Field>
                <Field label="Notes"><Input value={editForm.notes||''} onChange={e=>setEditForm({...editForm,notes:e.target.value})} placeholder="Any notes…"/></Field>
                <div style={{ display:'flex', gap:9, marginTop:14 }}>
                  <Btn onClick={saveEdit} disabled={!editForm.name} full>Save Changes</Btn>
                  <Btn variant="outline" onClick={() => setIsEditing(false)}>Cancel</Btn>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Add Student Modal ── */}
      {showAdd && (
        <Modal title="Add Student" onClose={() => setShowAdd(false)} wide>
          <Grid2>
            <Field label="Full Name" required><Input value={addForm.name||''} onChange={e=>setAddForm({...addForm,name:e.target.value})} placeholder="Student name"/></Field>
            <Field label="Age"><Input type="number" value={addForm.age||''} onChange={e=>setAddForm({...addForm,age:e.target.value})} placeholder="e.g. 12"/></Field>
            <Field label="Phone / WhatsApp"><Input value={addForm.phone||''} onChange={e=>setAddForm({...addForm,phone:e.target.value})} placeholder="+1 555 000 0000"/></Field>
            <Field label="Email"><Input value={addForm.email||''} onChange={e=>setAddForm({...addForm,email:e.target.value})} placeholder="email@example.com"/></Field>
            <Field label="Guardian Name"><Input value={addForm.guardian_name||''} onChange={e=>setAddForm({...addForm,guardian_name:e.target.value})} placeholder="Parent or guardian"/></Field>
            <Field label="Guardian Phone"><Input value={addForm.guardian_phone||''} onChange={e=>setAddForm({...addForm,guardian_phone:e.target.value})} /></Field>
            <Field label="Guardian Email"><Input value={addForm.guardian_email||''} onChange={e=>setAddForm({...addForm,guardian_email:e.target.value})} placeholder="parent@email.com"/></Field>
            <Field label="Join Date"><Input type="date" value={addForm.join_date||''} onChange={e=>setAddForm({...addForm,join_date:e.target.value})}/></Field>
          </Grid2>
          <Field label="Notes"><Input value={addForm.notes||''} onChange={e=>setAddForm({...addForm,notes:e.target.value})} placeholder="Any notes…"/></Field>
          <div style={{ display:'flex', gap:9, marginTop:6 }}>
            <Btn onClick={saveNew} disabled={!addForm.name}>Add Student</Btn>
            <Btn variant="outline" onClick={() => setShowAdd(false)}>Cancel</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
//  BatchesPage.jsx
// ═══════════════════════════════════════════════════════
import { DANCE_STYLES, LEVELS, BATCH_COLORS } from '../components/UI';

export function BatchesPage() {
  const { user } = useAuth();
  const { show, Toast } = useToast();
  const [batches, setBatches] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [managing, setManaging] = useState(null);
  const [batchStudents, setBatchStudents] = useState([]);
  const [form, setForm] = useState({});
  const sid = user.school_id;

  const load = () => Promise.all([api.getBatches(sid), api.getStudents(sid)])
    .then(([b, s]) => { setBatches(b.data.batches); setStudents(s.data.students); })
    .finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const openManage = async (batch) => {
    const r = await api.getBatch(sid, batch.id);
    setManaging(batch); setBatchStudents(r.data.students.map(s => s.id));
  };

  const saveEnrol = async () => {
    const current = (await api.getBatch(sid, managing.id)).data.students.map(s => s.id);
    const toAdd = batchStudents.filter(id => !current.includes(id));
    const toRemove = current.filter(id => !batchStudents.includes(id));
    if (toAdd.length) await api.enrolStudents(sid, managing.id, { student_ids: toAdd, action:'add' });
    if (toRemove.length) await api.enrolStudents(sid, managing.id, { student_ids: toRemove, action:'remove' });
    show('Enrolment updated'); setManaging(null); load();
  };

  const save = async () => {
    try {
      if (editing) await api.updateBatch(sid, editing, form);
      else await api.createBatch(sid, form);
      show(editing ? 'Batch updated' : 'Batch created'); setShowForm(false); load();
    } catch (e) { show('Error saving', 'error'); }
  };

  const remove = async id => {
    if (!confirm('Delete batch?')) return;
    await api.deleteBatch(sid, id); show('Batch deleted'); load();
  };

  const openAdd = () => { setForm({ dance_style: DANCE_STYLES[0], level:'Beginner', teacher_name: user.name }); setEditing(null); setShowForm(true); };
  const openEdit = b => { setForm({...b}); setEditing(b.id); setShowForm(true); };

  return (
    <div>
      <Toast/>
      <PageHeader title="Batches" subtitle={`${batches.length} batches`}
        action={<Btn onClick={openAdd} icon="➕">New Batch</Btn>}/>
      {loading ? <div style={{display:'flex',justifyContent:'center',padding:40}}><Spinner/></div> :
        batches.length === 0 ? <EmptyState icon="📚" title="No batches yet" message="Create a batch to group students by level or style." action={<Btn onClick={openAdd}>Create Batch</Btn>}/> :
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(270px,1fr))',gap:14}}>
          {batches.map((b,i) => {
            const color = BATCH_COLORS[i % BATCH_COLORS.length];
            return (
              <Card key={b.id} style={{borderTop:`4px solid ${color}`,padding:18}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
                  <div>
                    <div style={{fontWeight:800,fontSize:16,fontFamily:'var(--font-d)'}}>{b.name}</div>
                    <div style={{fontSize:12,color:'var(--muted)',marginTop:2}}>{b.dance_style} · {b.level}</div>
                  </div>
                  <div style={{display:'flex',gap:5}}>
                    <Btn small variant="outline" onClick={() => openEdit(b)}>✏️</Btn>
                    <Btn small variant="danger" onClick={() => remove(b.id)}>🗑</Btn>
                  </div>
                </div>
                <div style={{display:'flex',gap:9,marginBottom:12}}>
                  <div style={{flex:1,background:'var(--surface)',borderRadius:9,padding:'8px 11px',textAlign:'center'}}>
                    <div style={{fontSize:22,fontWeight:800,color,fontFamily:'var(--font-d)'}}>{b.enrolled_count||0}</div>
                    <div style={{fontSize:10,color:'var(--muted)'}}>{b.max_size ? `/ ${b.max_size} max` : 'students'}</div>
                  </div>
                  <div style={{flex:2,background:'var(--surface)',borderRadius:9,padding:'8px 11px'}}>
                    <div style={{fontSize:10,color:'var(--muted)',marginBottom:1}}>Teacher</div>
                    <div style={{fontSize:13,fontWeight:600}}>{b.teacher_name || '—'}</div>
                  </div>
                </div>
                <Btn small variant="outline" full onClick={() => openManage(b)}>👤 Manage Students</Btn>
              </Card>
            );
          })}
        </div>
      }
      {showForm && (
        <Modal title={editing ? 'Edit Batch' : 'Create Batch'} onClose={() => setShowForm(false)}>
          <Field label="Batch Name" required><Input value={form.name||''} onChange={e=>setForm({...form,name:e.target.value})} placeholder="e.g. Monday Beginners"/></Field>
          <Grid2>
            <Field label="Style"><Select value={form.dance_style||''} onChange={e=>setForm({...form,dance_style:e.target.value})}>{DANCE_STYLES.map(s=><option key={s}>{s}</option>)}</Select></Field>
            <Field label="Level"><Select value={form.level||'Beginner'} onChange={e=>setForm({...form,level:e.target.value})}>{LEVELS.map(l=><option key={l}>{l}</option>)}</Select></Field>
            <Field label="Teacher"><Input value={form.teacher_name||''} onChange={e=>setForm({...form,teacher_name:e.target.value})} placeholder="Teacher name"/></Field>
            <Field label="Max Size"><Input type="number" value={form.max_size||''} onChange={e=>setForm({...form,max_size:e.target.value})} placeholder="e.g. 15"/></Field>
          </Grid2>
          <div style={{display:'flex',gap:9}}>
            <Btn onClick={save} disabled={!form.name}>{editing ? 'Save' : 'Create'}</Btn>
            <Btn variant="outline" onClick={() => setShowForm(false)}>Cancel</Btn>
          </div>
        </Modal>
      )}
      {managing && (
        <Modal title={`Students — ${managing.name}`} onClose={() => setManaging(null)} wide>
          {students.length === 0 ? <p style={{color:'var(--muted)',textAlign:'center',padding:20}}>Add students first.</p> :
            <div style={{display:'grid',gap:7,marginBottom:16}}>
              {students.map(s => {
                const enrolled = batchStudents.includes(s.id);
                return (
                  <div key={s.id} onClick={() => setBatchStudents(prev => enrolled ? prev.filter(x=>x!==s.id) : [...prev,s.id])}
                    style={{display:'flex',alignItems:'center',gap:11,padding:'10px 13px',borderRadius:10,
                      border:`1.5px solid ${enrolled?'var(--accent)':'var(--border)'}`,
                      background:enrolled?'#c4527a11':'var(--surface)',cursor:'pointer',transition:'all .15s'}}>
                    <Avatar name={s.name} size={32}/>
                    <div style={{flex:1,fontWeight:600,fontSize:13}}>{s.name}</div>
                    <div style={{width:20,height:20,borderRadius:'50%',border:`2px solid ${enrolled?'var(--accent)':'var(--border)'}`,
                      background:enrolled?'var(--accent)':'transparent',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:11}}>
                      {enrolled && '✓'}
                    </div>
                  </div>
                );
              })}
            </div>
          }
          <div style={{display:'flex',gap:9}}>
            <Btn onClick={saveEnrol}>Save Enrolment</Btn>
            <Btn variant="outline" onClick={() => setManaging(null)}>Cancel</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
//  SchedulePage.jsx
// ═══════════════════════════════════════════════════════
import { DAYS, BATCH_COLORS as BC } from '../components/UI';

export function SchedulePage() {
  const { user } = useAuth();
  const { show, Toast } = useToast();
  const [schedules, setSchedules] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const sid = user.school_id;

  const load = () => Promise.all([api.getSchedules(sid), api.getBatches(sid)])
    .then(([s, b]) => { setSchedules(s.data.schedules); setBatches(b.data.batches); })
    .finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const openAdd = () => { setForm({ batch_id: batches[0]?.id||'', day_of_week:'Mon', start_time:'10:00', end_time:'11:00', frequency:'Weekly' }); setEditing(null); setShowForm(true); };
  const openEdit = s => { setForm({...s, batch_id: s.batch_id}); setEditing(s.id); setShowForm(true); };
  const save = async () => {
    try {
      if (editing) await api.updateSchedule(sid, editing, form);
      else await api.createSchedule(sid, form);
      show('Schedule saved'); setShowForm(false); load();
    } catch (e) { show('Error saving', 'error'); }
  };
  const remove = async id => { if (!confirm('Delete class?')) return; await api.deleteSchedule(sid, id); show('Class removed'); load(); };

  const byDay = DAYS.reduce((a,d) => { a[d] = schedules.filter(s=>s.day_of_week===d).sort((a,b)=>a.start_time.localeCompare(b.start_time)); return a; }, {});

  return (
    <div>
      <Toast/>
      <PageHeader title="Class Schedule" subtitle={`${schedules.length} classes/week`}
        action={<Btn onClick={openAdd} icon="➕" disabled={!batches.length}>Add Class</Btn>}/>
      {!batches.length && <div style={{background:'#fff8e6',border:'1px solid #f4a041',borderRadius:10,padding:'12px 16px',marginBottom:18,fontSize:13,color:'#7a5500'}}>⚠️ Create batches first before scheduling classes.</div>}
      {loading ? <div style={{display:'flex',justifyContent:'center',padding:40}}><Spinner/></div> :
        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:10,overflowX:'auto',minWidth:700}}>
          {DAYS.map(day => (
            <div key={day} style={{minWidth:110}}>
              <div style={{fontWeight:700,fontSize:11,color:'var(--muted)',letterSpacing:'.07em',textTransform:'uppercase',marginBottom:8}}>{day}</div>
              {byDay[day].length === 0
                ? <div style={{padding:10,borderRadius:9,border:'1px dashed var(--border)',textAlign:'center',fontSize:11,color:'#d0c8d8'}}>—</div>
                : byDay[day].map(cls => {
                  const bi = batches.findIndex(b=>b.id===cls.batch_id);
                  const color = BC[bi % BC.length] || '#888';
                  return (
                    <div key={cls.id} style={{background:color+'18',borderLeft:`3px solid ${color}`,borderRadius:'0 9px 9px 0',padding:'8px 10px',marginBottom:7}}>
                      <div style={{fontWeight:700,fontSize:12}}>{cls.batch_name}</div>
                      <div style={{fontSize:10,color:'var(--muted)'}}>{cls.start_time.slice(0,5)}–{cls.end_time.slice(0,5)}</div>
                      {cls.room && <div style={{fontSize:10,color:'var(--muted)'}}>📍{cls.room}</div>}
                      <div style={{marginTop:4,marginBottom:6}}><Badge>{cls.frequency}</Badge></div>
                      <div style={{display:'flex',gap:4}}>
                        <Btn small variant="outline" onClick={() => openEdit(cls)}>✏️</Btn>
                        <Btn small variant="danger" onClick={() => remove(cls.id)}>🗑</Btn>
                      </div>
                    </div>
                  );
                })
              }
            </div>
          ))}
        </div>
      }
      {showForm && (
        <Modal title={editing ? 'Edit Class' : 'Add Class'} onClose={() => setShowForm(false)}>
          <Field label="Batch" required>
            <Select value={form.batch_id||''} onChange={e=>setForm({...form,batch_id:parseInt(e.target.value)})}>
              {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </Field>
          <Grid2>
            <Field label="Day"><Select value={form.day_of_week||'Mon'} onChange={e=>setForm({...form,day_of_week:e.target.value})}>{DAYS.map(d=><option key={d}>{d}</option>)}</Select></Field>
            <Field label="Frequency"><Select value={form.frequency||'Weekly'} onChange={e=>setForm({...form,frequency:e.target.value})}><option>Weekly</option><option>Bi-weekly</option><option>Monthly</option></Select></Field>
            <Field label="Start Time"><Input type="time" value={form.start_time||'10:00'} onChange={e=>setForm({...form,start_time:e.target.value})}/></Field>
            <Field label="End Time"><Input type="time" value={form.end_time||'11:00'} onChange={e=>setForm({...form,end_time:e.target.value})}/></Field>
          </Grid2>
          <Field label="Room"><Input value={form.room||''} onChange={e=>setForm({...form,room:e.target.value})} placeholder="e.g. Studio A"/></Field>
          <div style={{display:'flex',gap:9}}>
            <Btn onClick={save} disabled={!form.batch_id}>{editing ? 'Save' : 'Add Class'}</Btn>
            <Btn variant="outline" onClick={() => setShowForm(false)}>Cancel</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
//  RecitalsPage.jsx
// ═══════════════════════════════════════════════════════
import { StatusBadge, ProgressBar } from '../components/UI';

const STATUS_COLORS = { Planning:'#6a7fdb', Confirmed:'#52c4a0', Rehearsals:'#f4a041', Completed:'#8ab4c0', Cancelled:'#e05c6a' };

export function RecitalsPage() {
  const { user } = useAuth();
  const { show, Toast } = useToast();
  const [recitals, setRecitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailTasks, setDetailTasks] = useState([]);
  const [form, setForm] = useState({});
  const [newTask, setNewTask] = useState('');
  const sid = user.school_id;

  const load = () => api.recitals.list(sid).then(r => setRecitals(r)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const openDetail = async r => {
    const res = await api.recitals.get(sid, r.id);
    const { tasks, ...recital } = res;
    setDetail(recital); setDetailTasks(tasks || []);
  };

  const toggleTask = async (taskId, done) => {
    await api.recitals.toggleTask(sid, detail.id, taskId);
    setDetailTasks(prev => prev.map(t => t.id === taskId ? {...t, is_done: !done} : t));
    load();
  };

  const addTask = async () => {
    if (!newTask.trim()) return;
    const task = await api.recitals.addTask(sid, detail.id, newTask);
    setDetailTasks(prev => [...prev, task]); setNewTask(''); load();
  };

  const save = async () => {
    try {
      if (editing) await api.recitals.update(sid, editing, form);
      else await api.recitals.create(sid, form);
      show(editing ? 'Event updated' : 'Event created'); setShowForm(false); load();
    } catch (e) { show('Error saving', 'error'); }
  };

  const remove = async id => {
    if (!confirm('Delete event?')) return;
    await api.recitals.remove(sid, id); show('Event deleted'); load();
    if (detail?.id === id) setDetail(null);
  };

  const openAdd = () => { setForm({ status:'Planning' }); setEditing(null); setShowForm(true); };
  const openEdit = r => { setForm({...r}); setEditing(r.id); setShowForm(true); };

  const sorted = [...recitals].sort((a,b) => new Date(b.event_date) - new Date(a.event_date));

  return (
    <div>
      <Toast/>
      <PageHeader title="Recitals & Events" subtitle={`${recitals.length} events`}
        action={<Btn onClick={openAdd} icon="➕">New Event</Btn>}/>
      {loading ? <div style={{display:'flex',justifyContent:'center',padding:40}}><Spinner/></div> :
        sorted.length === 0 ? <EmptyState icon="🌟" title="No events yet" message="Plan your first recital or performance!" action={<Btn onClick={openAdd}>New Event</Btn>}/> :
        <div style={{display:'grid',gap:11}}>
          {sorted.map(r => {
            const pct = r.task_count ? Math.round((r.tasks_done/r.task_count)*100) : 0;
            const color = STATUS_COLORS[r.status]||'#888';
            const d = new Date(r.event_date);
            return (
              <Card key={r.id} onClick={() => openDetail(r)} style={{cursor:'pointer'}}>
                <div style={{display:'flex',alignItems:'flex-start',gap:14}}>
                  <div style={{textAlign:'center',minWidth:50,background:color+'20',borderRadius:10,padding:'7px',flexShrink:0}}>
                    <div style={{fontSize:17,fontWeight:800,color,fontFamily:'var(--font-d)'}}>{d.getDate()}</div>
                    <div style={{fontSize:9,color:'var(--muted)',textTransform:'uppercase'}}>{d.toLocaleString('default',{month:'short',year:'2-digit'})}</div>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:3,flexWrap:'wrap'}}>
                      <span style={{fontWeight:800,fontSize:14,fontFamily:'var(--font-d)'}}>{r.title}</span>
                      <StatusBadge status={r.status}/>
                    </div>
                    {r.venue && <div style={{fontSize:12,color:'var(--muted)',marginBottom:7}}>📍 {r.venue}</div>}
                    {r.task_count > 0 && (
                      <div>
                        <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'var(--muted)',marginBottom:4}}>
                          <span>Tasks</span><span>{r.tasks_done}/{r.task_count} done</span>
                        </div>
                        <ProgressBar value={pct} color={color}/>
                      </div>
                    )}
                  </div>
                  <div style={{display:'flex',gap:5,flexShrink:0}} onClick={e=>e.stopPropagation()}>
                    <Btn small variant="outline" onClick={() => openEdit(r)}>✏️</Btn>
                    <Btn small variant="danger" onClick={() => remove(r.id)}>🗑</Btn>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      }

      {/* Detail Modal */}
      {detail && (
        <Modal title={detail.title} onClose={() => setDetail(null)} wide>
          <div style={{display:'flex',gap:9,marginBottom:14,flexWrap:'wrap',alignItems:'center'}}>
            <StatusBadge status={detail.status}/>
            <span style={{fontSize:12,color:'var(--muted)'}}>📅 {new Date(detail.event_date).toLocaleDateString('en',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</span>
            {detail.venue && <span style={{fontSize:12,color:'var(--muted)'}}>📍 {detail.venue}</span>}
          </div>
          {detail.description && <p style={{color:'var(--muted)',fontSize:13,marginBottom:16}}>{detail.description}</p>}
          <h3 style={{fontFamily:'var(--font-d)',fontSize:15,marginBottom:10}}>
            Checklist · {detailTasks.filter(t=>t.is_done).length}/{detailTasks.length}
          </h3>
          <div style={{marginBottom:14}}>
            {detailTasks.map(t => (
              <div key={t.id} onClick={() => toggleTask(t.id, t.is_done)}
                style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',borderRadius:9,
                  border:`1.5px solid ${t.is_done?'var(--accent)':'var(--border)'}`,
                  background:t.is_done?'#c4527a11':'var(--surface)',cursor:'pointer',marginBottom:6,transition:'all .15s'}}>
                <div style={{width:19,height:19,borderRadius:5,border:`2px solid ${t.is_done?'var(--accent)':'var(--border)'}`,
                  background:t.is_done?'var(--accent)':'transparent',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',flexShrink:0,fontSize:11}}>
                  {t.is_done && '✓'}
                </div>
                <span style={{flex:1,fontSize:13,textDecoration:t.is_done?'line-through':'none',opacity:t.is_done?.6:1}}>{t.task_text}</span>
              </div>
            ))}
          </div>
          <div style={{display:'flex',gap:8}}>
            <Input value={newTask} onChange={e=>setNewTask(e.target.value)} placeholder="Add a task…" onKeyDown={e=>e.key==='Enter'&&addTask()}/>
            <Btn onClick={addTask}>Add</Btn>
          </div>
        </Modal>
      )}

      {showForm && (
        <Modal title={editing ? 'Edit Event' : 'New Event'} onClose={() => setShowForm(false)} wide>
          <Field label="Event Title" required><Input value={form.title||''} onChange={e=>setForm({...form,title:e.target.value})} placeholder="e.g. Spring Showcase 2025"/></Field>
          <Grid2>
            <Field label="Date" required><Input type="date" value={form.event_date||''} onChange={e=>setForm({...form,event_date:e.target.value})}/></Field>
            <Field label="Status">
              <Select value={form.status||'Planning'} onChange={e=>setForm({...form,status:e.target.value})}>
                {Object.keys(STATUS_COLORS).map(s=><option key={s}>{s}</option>)}
              </Select>
            </Field>
          </Grid2>
          <Field label="Venue"><Input value={form.venue||''} onChange={e=>setForm({...form,venue:e.target.value})} placeholder="e.g. City Arts Center"/></Field>
          <Field label="Description"><Input value={form.description||''} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Brief description…"/></Field>
          <div style={{display:'flex',gap:9}}>
            <Btn onClick={save} disabled={!form.title||!form.event_date}>{editing ? 'Save' : 'Create'}</Btn>
            <Btn variant="outline" onClick={() => setShowForm(false)}>Cancel</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
//  FeesPage.jsx
// ═══════════════════════════════════════════════════════
export function FeesPage() {
  const { user } = useAuth();
  const { show, Toast } = useToast();
  const [fees, setFees] = useState([]);
  const [summary, setSummary] = useState(null);
  const [students, setStudents] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({});
  const sid = user.school_id;

  const load = () => Promise.all([api.getFees(sid, filter?{status:filter}:{}), api.getFeesSummary(sid), api.getStudents(sid), api.getFeePlans(sid)])
    .then(([f, s, st, p]) => { setFees(f.data.fees); setSummary(s.data.summary); setStudents(st.data.students); setPlans(p.data.plans); })
    .finally(() => setLoading(false));
  useEffect(() => { load(); }, [filter]);

  const markPaid = async id => {
    await api.updateFee(sid, id, { status:'Paid', paid_date: new Date().toISOString().split('T')[0] });
    show('Marked as paid'); load();
  };

  const save = async () => {
    try {
      await api.createFee(sid, form);
      show('Fee record created'); setShowForm(false); load();
    } catch (e) { show('Error creating fee', 'error'); }
  };

  const openAdd = () => { setForm({ currency:'USD', status:'Pending', due_date: new Date().toISOString().split('T')[0] }); setShowForm(true); };

  const fmt = v => `$${parseFloat(v||0).toFixed(2)}`;

  return (
    <div>
      <Toast/>
      <PageHeader title="Fee Management" subtitle="Track and manage student payments"
        action={<Btn onClick={openAdd} icon="➕">Add Fee Record</Btn>}/>

      {summary && (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:12,marginBottom:24}}>
          {[
            {label:'Collected', val:summary.total_paid,    color:'var(--success)', count:summary.count_paid},
            {label:'Pending',   val:summary.total_pending, color:'var(--warning)', count:summary.count_pending},
            {label:'Overdue',   val:summary.total_overdue, color:'var(--danger)',  count:summary.count_overdue},
          ].map(s => (
            <Card key={s.label} style={{padding:16,textAlign:'center'}}>
              <div style={{fontSize:22,fontWeight:800,color:s.color,fontFamily:'var(--font-d)'}}>{fmt(s.val)}</div>
              <div style={{fontSize:11,color:'var(--muted)'}}>{s.label} ({s.count||0})</div>
            </Card>
          ))}
        </div>
      )}

      <div style={{display:'flex',gap:9,marginBottom:16,flexWrap:'wrap'}}>
        {['','Pending','Paid','Overdue','Waived'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            style={{padding:'6px 14px',borderRadius:20,border:'1.5px solid var(--border)',fontSize:13,fontWeight:filter===s?700:500,
              background:filter===s?'var(--accent)':'transparent',color:filter===s?'#fff':'var(--text)',cursor:'pointer',fontFamily:'var(--font-b)'}}>
            {s || 'All'}
          </button>
        ))}
      </div>

      {loading ? <div style={{display:'flex',justifyContent:'center',padding:40}}><Spinner/></div> :
        fees.length === 0 ? <EmptyState icon="💰" title="No fee records" message="Add fee records to start tracking payments." action={<Btn onClick={openAdd}>Add Fee Record</Btn>}/> :
        <div style={{background:'var(--card)',borderRadius:14,border:'1px solid var(--border)',overflow:'hidden'}}>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead>
              <tr style={{background:'var(--surface)'}}>
                {['Student','Description','Amount','Due Date','Status','Actions'].map(h => (
                  <th key={h} style={{padding:'11px 14px',textAlign:'left',fontSize:11,fontWeight:700,letterSpacing:'.06em',textTransform:'uppercase',color:'var(--muted)'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fees.map(f => (
                <tr key={f.id} style={{borderTop:'1px solid var(--border)'}}>
                  <td style={{padding:'11px 14px',fontWeight:600,fontSize:13}}>{f.student_name}</td>
                  <td style={{padding:'11px 14px',fontSize:13,color:'var(--muted)'}}>{f.description || f.plan_name || '—'}</td>
                  <td style={{padding:'11px 14px',fontWeight:700,fontSize:14}}>${parseFloat(f.amount).toFixed(2)}</td>
                  <td style={{padding:'11px 14px',fontSize:13}}>{new Date(f.due_date).toLocaleDateString()}</td>
                  <td style={{padding:'11px 14px'}}><StatusBadge status={f.status}/></td>
                  <td style={{padding:'11px 14px'}}>
                    {f.status !== 'Paid' && f.status !== 'Waived' && (
                      <Btn small variant="success" onClick={() => markPaid(f.id)}>✓ Mark Paid</Btn>
                    )}
                    {f.paid_date && <span style={{fontSize:11,color:'var(--muted)',marginLeft:8}}>Paid {new Date(f.paid_date).toLocaleDateString()}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      }

      {showForm && (
        <Modal title="Add Fee Record" onClose={() => setShowForm(false)}>
          <Field label="Student" required>
            <Select value={form.student_id||''} onChange={e=>setForm({...form,student_id:parseInt(e.target.value)})}>
              <option value="">Select student…</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <Grid2>
            <Field label="Amount ($)" required><Input type="number" step="0.01" value={form.amount||''} onChange={e=>setForm({...form,amount:e.target.value})} placeholder="e.g. 120.00"/></Field>
            <Field label="Due Date" required><Input type="date" value={form.due_date||''} onChange={e=>setForm({...form,due_date:e.target.value})}/></Field>
          </Grid2>
          <Field label="Description"><Input value={form.description||''} onChange={e=>setForm({...form,description:e.target.value})} placeholder="e.g. Monthly Tuition — March"/></Field>
          <Field label="Status"><Select value={form.status||'Pending'} onChange={e=>setForm({...form,status:e.target.value})}><option>Pending</option><option>Paid</option><option>Waived</option></Select></Field>
          <div style={{display:'flex',gap:9}}>
            <Btn onClick={save} disabled={!form.student_id||!form.amount||!form.due_date}>Create</Btn>
            <Btn variant="outline" onClick={() => setShowForm(false)}>Cancel</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
//  SchoolsPage.jsx  (Super Admin only)
// ═══════════════════════════════════════════════════════
export function SchoolsPage() {
  const { show, Toast } = useToast();
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({});

  const load = () => api.getSchools().then(r => setSchools(r.data.schools)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      await api.createSchool(form);
      show('School created'); setShowForm(false); load();
    } catch (e) { show(e.response?.data?.error || 'Error creating', 'error'); }
  };

  return (
    <div>
      <Toast/>
      <PageHeader title="All Schools" subtitle={`${schools.length} schools on platform`}
        action={<Btn onClick={() => { setForm({}); setShowForm(true); }} icon="➕">New School</Btn>}/>
      {loading ? <div style={{display:'flex',justifyContent:'center',padding:40}}><Spinner/></div> :
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:14}}>
          {schools.map(s => (
            <Card key={s.id} style={{borderLeft:'4px solid var(--accent)'}}>
              <div style={{fontWeight:800,fontSize:16,fontFamily:'var(--font-d)',marginBottom:4}}>{s.name}</div>
              <div style={{fontSize:13,color:'var(--muted)',marginBottom:10}}>{s.owner_name} · {s.city || 'No city'}</div>
              <div style={{display:'flex',gap:9}}>
                <div style={{background:'var(--surface)',borderRadius:9,padding:'8px 12px',textAlign:'center',flex:1}}>
                  <div style={{fontWeight:800,fontSize:18,color:'var(--accent)'}}>{s.student_count||0}</div>
                  <div style={{fontSize:10,color:'var(--muted)'}}>Students</div>
                </div>
                <div style={{background:'var(--surface)',borderRadius:9,padding:'8px 12px',textAlign:'center',flex:1}}>
                  <div style={{fontWeight:800,fontSize:18,color:'#6a7fdb'}}>{s.batch_count||0}</div>
                  <div style={{fontSize:10,color:'var(--muted)'}}>Batches</div>
                </div>
              </div>
              <div style={{marginTop:10}}><Badge color={s.is_active?'var(--success)':'var(--danger)'}>{s.is_active?'Active':'Inactive'}</Badge></div>
            </Card>
          ))}
        </div>
      }
      {showForm && (
        <Modal title="Create New School" onClose={() => setShowForm(false)} wide>
          <Grid2>
            <Field label="School Name" required><Input value={form.name||''} onChange={e=>setForm({...form,name:e.target.value})} placeholder="School name"/></Field>
            <Field label="Owner Name" required><Input value={form.owner_name||''} onChange={e=>setForm({...form,owner_name:e.target.value})} placeholder="Owner name"/></Field>
            <Field label="Email"><Input value={form.email||''} onChange={e=>setForm({...form,email:e.target.value})} placeholder="school@email.com"/></Field>
            <Field label="Phone"><Input value={form.phone||''} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="+1 555 000 0000"/></Field>
            <Field label="City"><Input value={form.city||''} onChange={e=>setForm({...form,city:e.target.value})} placeholder="City"/></Field>
            <Field label="Dance Style"><Input value={form.dance_style||''} onChange={e=>setForm({...form,dance_style:e.target.value})} placeholder="e.g. Ballet"/></Field>
          </Grid2>
          <div style={{background:'var(--surface)',borderRadius:10,padding:14,marginBottom:14}}>
            <p style={{fontSize:12,color:'var(--muted)',marginBottom:10,fontWeight:600}}>SCHOOL ADMIN ACCOUNT (optional)</p>
            <Grid2>
              <Field label="Admin Email"><Input value={form.admin_email||''} onChange={e=>setForm({...form,admin_email:e.target.value})} placeholder="admin@school.com"/></Field>
              <Field label="Admin Password"><Input type="password" value={form.admin_password||''} onChange={e=>setForm({...form,admin_password:e.target.value})} placeholder="Min 8 chars"/></Field>
            </Grid2>
          </div>
          <div style={{display:'flex',gap:9}}>
            <Btn onClick={save} disabled={!form.name||!form.owner_name}>Create School</Btn>
            <Btn variant="outline" onClick={() => setShowForm(false)}>Cancel</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
//  ParentPage.jsx
// ═══════════════════════════════════════════════════════
export function ParentPage() {
  const { user } = useAuth();
  const [children, setChildren] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [recitals, setRecitals] = useState([]);
  const [feeData, setFeeData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.parentGetChildren(), api.parentGetSchedules(), api.parentGetRecitals(), api.parentGetFees()])
      .then(([c,s,r,f]) => { setChildren(c.data.children); setSchedules(s.data.schedules); setRecitals(r.data.recitals); setFeeData(f.data.fees); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{display:'flex',justifyContent:'center',padding:60}}><Spinner size={36}/></div>;

  const pendingFees = feeData.filter(f => f.status !== 'Paid' && f.status !== 'Waived');

  return (
    <div className="fade-in">
      <h1 style={{fontFamily:'var(--font-d)',fontSize:26,marginBottom:4}}>My Portal</h1>
      <p style={{color:'var(--muted)',marginBottom:28}}>Welcome, {user.name}!</p>

      {children.length > 0 && (
        <div style={{marginBottom:24}}>
          <h2 style={{fontFamily:'var(--font-d)',fontSize:17,marginBottom:12}}>👤 My Children</h2>
          <div style={{display:'grid',gap:9}}>
            {children.map(c => (
              <Card key={c.id} style={{display:'flex',alignItems:'center',gap:13,padding:15}}>
                <Avatar name={c.name}/>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:14}}>{c.name}</div>
                  <div style={{fontSize:12,color:'var(--muted)'}}>{c.batch_names || 'No batch assigned'}</div>
                </div>
                {c.age && <Badge>Age {c.age}</Badge>}
              </Card>
            ))}
          </div>
        </div>
      )}

      {schedules.length > 0 && (
        <div style={{marginBottom:24}}>
          <h2 style={{fontFamily:'var(--font-d)',fontSize:17,marginBottom:12}}>📅 Class Schedule</h2>
          <div style={{display:'grid',gap:9}}>
            {schedules.map(s => (
              <Card key={s.id} style={{display:'flex',alignItems:'center',gap:13,padding:14}}>
                <div style={{width:44,height:44,borderRadius:10,background:'var(--accent)22',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:800,color:'var(--accent)',flexShrink:0}}>{s.day_of_week}</div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:13}}>{s.batch_name}</div>
                  <div style={{fontSize:12,color:'var(--muted)'}}>{s.start_time.slice(0,5)} – {s.end_time.slice(0,5)}{s.room ? ` · ${s.room}` : ''}</div>
                </div>
                <Badge>{s.frequency}</Badge>
              </Card>
            ))}
          </div>
        </div>
      )}

      {recitals.length > 0 && (
        <div style={{marginBottom:24}}>
          <h2 style={{fontFamily:'var(--font-d)',fontSize:17,marginBottom:12}}>🌟 Upcoming Recitals</h2>
          <div style={{display:'grid',gap:9}}>
            {recitals.map(r => (
              <Card key={r.id} style={{display:'flex',alignItems:'center',gap:13,padding:14}}>
                <div style={{textAlign:'center',minWidth:46,background:'var(--accent)22',borderRadius:9,padding:7}}>
                  <div style={{fontSize:16,fontWeight:800,color:'var(--accent)',fontFamily:'var(--font-d)'}}>{new Date(r.event_date).getDate()}</div>
                  <div style={{fontSize:9,color:'var(--muted)',textTransform:'uppercase'}}>{new Date(r.event_date).toLocaleString('default',{month:'short'})}</div>
                </div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:13}}>{r.title}</div>
                  {r.venue && <div style={{fontSize:12,color:'var(--muted)'}}>📍 {r.venue}</div>}
                </div>
                <StatusBadge status={r.status}/>
              </Card>
            ))}
          </div>
        </div>
      )}

      {pendingFees.length > 0 && (
        <div>
          <h2 style={{fontFamily:'var(--font-d)',fontSize:17,marginBottom:12}}>💰 Outstanding Fees</h2>
          <div style={{display:'grid',gap:9}}>
            {pendingFees.map(f => (
              <Card key={f.id} style={{display:'flex',alignItems:'center',gap:13,padding:14,borderLeft:'3px solid var(--warning)'}}>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:13}}>{f.description || 'Tuition Fee'}</div>
                  <div style={{fontSize:12,color:'var(--muted)'}}>Due {new Date(f.due_date).toLocaleDateString()}</div>
                </div>
                <div style={{fontWeight:800,fontSize:16,color:'var(--warning)'}}>${parseFloat(f.amount).toFixed(2)}</div>
                <StatusBadge status={f.status}/>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
