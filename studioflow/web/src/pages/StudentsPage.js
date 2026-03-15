import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { students as api } from "../api";
import toast from "react-hot-toast";
import Card from "../components/shared/Card";
import Button from "../components/shared/Button";
import Modal from "../components/shared/Modal";
import { Field, Input, Textarea } from "../components/shared/Field";

// ─── Avatar helper ──────────────────────────────────────────────────────────
// Cheerful emoji avatars — no stock photos
const HAPPY_EMOJIS = ['💃','🌟','🎵','🌺','⭐','🎶','✨','🌸','🦋','🎀','🌻','💫','🎭','🌈','🏵️','🎊','🌼','🎯','🪷','🎤'];
const AVATAR_COLORS = ['#FFB347','#FF6B9D','#7E57C2','#42A5F5','#26C99E','#FFCA28','#EF5350','#29B6F6','#AB47BC','#66BB6A'];

function getStudentEmoji(student) {
  const i = ((student.id || 0) * 7 + (student.name?.charCodeAt(0) || 0)) % HAPPY_EMOJIS.length;
  return HAPPY_EMOJIS[i];
}
function getStudentColor(student) {
  const i = ((student.id || 0) * 13 + (student.name?.charCodeAt(1) || 0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[i];
}

function StudentAvatar({ student, size = 44, border, active }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: getStudentColor(student),
      border: border || `2px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.46, lineHeight: 1, transition: 'border-color .15s',
      userSelect: 'none',
    }}>
      {getStudentEmoji(student)}
    </div>
  );
}

// ─── Small helpers ───────────────────────────────────────────────────────────
function InfoRow({ icon, label, value }) {
  if (!value) return null;
  return (
    <div style={{ display:"flex", gap:10, marginBottom:10, alignItems:"flex-start" }}>
      <span style={{ fontSize:14, flexShrink:0, width:20, textAlign:"center", marginTop:1 }}>{icon}</span>
      <div>
        <div style={{ fontSize:10, color:"var(--muted)", fontWeight:700, textTransform:"uppercase", letterSpacing:".05em", marginBottom:2 }}>{label}</div>
        <div style={{ fontSize:13, fontWeight:500, wordBreak:"break-word" }}>{value}</div>
      </div>
    </div>
  );
}

function PanelSection({ title, children }) {
  return (
    <div style={{ marginBottom:20 }}>
      <div style={{ fontSize:10, fontWeight:700, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".08em", marginBottom:10, paddingBottom:6, borderBottom:"1px solid var(--border)" }}>{title}</div>
      {children}
    </div>
  );
}

const EMPTY = { name:"", age:"", phone:"", email:"", guardian_name:"", guardian_phone:"", guardian_email:"", join_date:"", notes:"" };

export default function StudentsPage() {
  const { user } = useAuth();
  const sid = user?.school_id;
  const qc = useQueryClient();

  const [search, setSearch]       = useState("");
  const [view, setView]           = useState("grid"); // "grid" | "table"
  const [selected, setSelected]   = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm]   = useState({});
  const [showAdd, setShowAdd]     = useState(false);
  const [addForm, setAddForm]     = useState(EMPTY);

  const PANEL_W = 400;

  // ── Responsive panel ─────────────────────────────────────────────────────
  const [windowWidth, setWindowWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    const h = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  const isMobile = windowWidth < 768; // matches AppShell mobile breakpoint

  // ── Data ────────────────────────────────────────────────────────────────
  const { data: list = [], isLoading } = useQuery({
    queryKey: ["students", sid],
    queryFn: () => api.list(sid),
    enabled: !!sid,
  });

  const invalidate = () => { qc.invalidateQueries(["students", sid]); qc.invalidateQueries(["stats", sid]); };

  const addMutation = useMutation({
    mutationFn: data => api.create(sid, data),
    onSuccess: () => { invalidate(); toast.success("Student added"); setShowAdd(false); setAddForm(EMPTY); },
    onError: err => toast.error(err?.error || "Failed to add student"),
  });

  const editMutation = useMutation({
    mutationFn: data => api.update(sid, selected.id, data),
    onSuccess: (_, vars) => {
      invalidate();
      toast.success("Student updated");
      setSelected({ ...selected, ...vars });
      setIsEditing(false);
    },
    onError: err => toast.error(err?.error || "Failed to save"),
  });

  const deleteMutation = useMutation({
    mutationFn: id => api.remove(sid, id),
    onSuccess: (_, id) => {
      invalidate();
      toast.success("Student removed");
      if (selected?.id === id) setSelected(null);
    },
    onError: err => toast.error(err?.error || "Failed to remove"),
  });

  // ── Helpers ─────────────────────────────────────────────────────────────
  const filtered = list.filter(s => s.name?.toLowerCase().includes(search.toLowerCase()));
  const fmtLong  = d => { if (!d) return null; const [y,m,dy] = (d||'').slice(0,10).split('-').map(Number); return (y&&m&&dy) ? new Date(y,m-1,dy).toLocaleDateString("en",{year:"numeric",month:"long",day:"numeric"}) : null; };
  const fmtShort = d => { if (!d) return null; const [y,m,dy] = (d||'').slice(0,10).split('-').map(Number); return (y&&m&&dy) ? new Date(y,m-1,dy).toLocaleDateString("en",{month:"short",year:"numeric"}) : null; };

  // Age display: ≤8 blue · ≤12 yellow · ≤18 green · 18+ Adult · unset hidden
  const ageLabel = age => { const n = Number(age); if (!age && age !== 0) return null; return n > 18 ? "Adult" : `${n} yrs`; };
  const ageDot   = age => { const n = Number(age); if (!age && age !== 0) return "#aaa"; if (n <= 8) return "#6a7fdb"; if (n <= 12) return "#f4a041"; if (n <= 18) return "#52c4a0"; return "#52c4a0"; };

  const openAdd  = () => { setAddForm({ ...EMPTY, join_date: new Date().toISOString().split("T")[0] }); setShowAdd(true); };
  const pick     = s  => { setSelected(s); setIsEditing(false); };
  const startEdit = () => { setEditForm({ ...selected }); setIsEditing(true); };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ paddingRight: selected && !isMobile ? PANEL_W + 20 : 0, transition:"padding .25s ease" }}>

      {/* ── Header ── */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20, flexWrap:"wrap", gap:10 }}>
        <div>
          <h1 style={{ fontFamily:"var(--font-d)", fontSize:24, marginBottom:2 }}>Students</h1>
          <p style={{ color:"var(--muted)", fontSize:12 }}>{list.length} enrolled</p>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center", marginLeft:"auto" }}>
          {/* View toggle */}
          <div style={{ display:"flex", border:"1.5px solid var(--border)", borderRadius:9, overflow:"hidden" }}>
            <button onClick={() => setView("grid")} title="Grid view"
              style={{ padding:"7px 13px", border:"none", cursor:"pointer", fontSize:16, lineHeight:1, transition:"all .15s",
                background: view === "grid" ? "var(--accent)" : "transparent",
                color: view === "grid" ? "#fff" : "var(--muted)" }}>⊞</button>
            <button onClick={() => setView("table")} title="Table view"
              style={{ padding:"7px 13px", border:"none", borderLeft:"1.5px solid var(--border)", cursor:"pointer", fontSize:16, lineHeight:1, transition:"all .15s",
                background: view === "table" ? "var(--accent)" : "transparent",
                color: view === "table" ? "#fff" : "var(--muted)" }}>☰</button>
          </div>
          <Button onClick={openAdd} icon="➕">Add Student</Button>
        </div>
      </div>

      {/* ── Search ── */}
      <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search students…" style={{ maxWidth:280, marginBottom:18 }} />

      {/* ── Content ── */}
      {isLoading ? (
        <p style={{ color:"var(--muted)" }}>Loading…</p>

      ) : filtered.length === 0 ? (
        <Card style={{ textAlign:"center", padding:48, border:"1.5px dashed var(--border)" }}>
          <div style={{ fontSize:40, marginBottom:12 }}>🌟</div>
          <p style={{ fontWeight:700, marginBottom:4 }}>No students yet</p>
          <p style={{ color:"var(--muted)", fontSize:13, marginBottom:16 }}>Add your first student to get started.</p>
          <Button onClick={openAdd}>Add Student</Button>
        </Card>

      ) : view === "grid" ? (
        /* ── Grid cards ── */
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(270px, 1fr))", gap:16 }}>
          {filtered.map(s => {
            const active    = selected?.id === s.id;
            const batches   = s.batches ? String(s.batches).split(",").map(b => b.trim()).filter(Boolean) : [];
            const noEnroll  = batches.length === 0;
            const label     = ageLabel(s.age);
            const dotColor  = ageDot(s.age);
            const joinStr   = fmtShort(s.join_date);

            return (
              <div key={s.id} onClick={() => pick(s)} style={{
                background:"var(--card)", borderRadius:14, cursor:"pointer",
                border:`1.5px solid ${active ? "var(--accent)" : "var(--border)"}`,
                boxShadow: active ? "0 0 0 3px rgba(196,82,122,.13)" : "0 2px 8px rgba(0,0,0,.05)",
                transition:"all .15s", overflow:"hidden",
              }}>
                {/* ── Card header: avatar + name + age ── */}
                <div style={{ padding:"18px 18px 14px", display:"flex", alignItems:"center", gap:14 }}>
                  <StudentAvatar student={s} size={52} active={active} />
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontWeight:700, fontSize:15, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", color:"var(--text)" }}>
                      {s.name}
                    </div>
                    {label && (
                      <div style={{ display:"flex", alignItems:"center", gap:5, marginTop:4 }}>
                        <div style={{ width:7, height:7, borderRadius:"50%", background:dotColor, flexShrink:0 }} />
                        <span style={{ fontSize:12, color:"var(--muted)", fontWeight:500 }}>{label}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Divider ── */}
                <div style={{ height:1, background:"var(--border)", margin:"0 18px" }} />

                {/* ── Join date row ── */}
                <div style={{ padding:"10px 18px", display:"flex", alignItems:"center", gap:8 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
                    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                  <span style={{ fontSize:12, color: joinStr ? "var(--muted)" : "var(--border)", fontStyle: joinStr ? "normal" : "italic" }}>
                    {joinStr ? `Joined ${joinStr}` : "No join date recorded"}
                  </span>
                </div>

                {/* ── Divider ── */}
                <div style={{ height:1, background:"var(--border)", margin:"0 18px" }} />

                {/* ── Enrolled batches ── */}
                <div style={{ padding:"10px 18px 14px" }}>
                  <div style={{ fontSize:10, fontWeight:700, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".07em", marginBottom:7 }}>
                    Enrolled Classes
                  </div>
                  {noEnroll ? (
                    <span style={{
                      display:"inline-flex", alignItems:"center", gap:5,
                      background:"#fff8e6", border:"1.5px dashed #f4a041",
                      borderRadius:20, padding:"3px 10px",
                      fontSize:11, color:"#b45309", fontWeight:600,
                    }}>
                      ⚠ Not enrolled in any batch
                    </span>
                  ) : (
                    <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                      {batches.map((b,i) => (
                        <span key={i} style={{ fontSize:11, background:"var(--surface)", color:"var(--text)", borderRadius:20, padding:"3px 10px", border:"1px solid var(--border)", fontWeight:500 }}>
                          {b}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

      ) : (
        /* ── Table view ── */
        <div style={{ background:"var(--card)", borderRadius:14, border:"1px solid var(--border)", overflow:"hidden" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ background:"var(--surface)" }}>
                {["Student","Age","Contact","Batch","Joined",""].map(h => (
                  <th key={h} style={{ padding:"11px 14px", textAlign:"left", fontSize:11, fontWeight:700, letterSpacing:".06em", textTransform:"uppercase", color:"var(--muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => {
                const active = selected?.id === s.id;
                return (
                  <tr key={s.id} onClick={() => pick(s)} style={{
                    borderTop:"1px solid var(--border)", cursor:"pointer",
                    background: active ? "rgba(196,82,122,.04)" : "transparent", transition:"background .1s"
                  }}>
                    <td style={{ padding:"10px 14px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                        <StudentAvatar student={s} size={34} />
                        <span style={{ fontWeight:600, fontSize:13 }}>{s.name}</span>
                      </div>
                    </td>
                    <td style={{ padding:"10px 14px", fontSize:13, color:"var(--muted)" }}>{ageLabel(s.age) || "—"}</td>
                    <td style={{ padding:"10px 14px", fontSize:12, color:"var(--muted)", maxWidth:180, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{s.email || s.phone || "—"}</td>
                    <td style={{ padding:"10px 14px" }}>
                      {s.batches
                        ? <span style={{ fontSize:11, background:"var(--accent)18", color:"var(--accent)", borderRadius:20, padding:"2px 9px", fontWeight:600 }}>{String(s.batches).split(",")[0].trim()}</span>
                        : <span style={{ color:"var(--muted)", fontSize:12 }}>—</span>}
                    </td>
                    <td style={{ padding:"10px 14px", fontSize:12, color:"var(--muted)" }}>{fmtShort(s.join_date) || "—"}</td>
                    <td style={{ padding:"10px 14px" }}>
                      <button onClick={e => { e.stopPropagation(); if(window.confirm("Remove student?")) deleteMutation.mutate(s.id); }}
                        style={{ background:"none", border:"none", cursor:"pointer", fontSize:14, color:"var(--muted)", padding:"3px 7px", borderRadius:6, opacity:.6 }}>🗑</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Right detail panel ── */}
      {selected && isMobile && (
        <div onClick={()=>{setSelected(null);setIsEditing(false);}}
          style={{position:"fixed",inset:0,top:56,background:"rgba(0,0,0,0.4)",zIndex:399}} />
      )}
      {selected && (
        <div style={{
          position:"fixed", right:0, bottom:0, zIndex:400,
          top:    isMobile ? 56 : 0,
          width:  isMobile ? '100vw' : PANEL_W,
          left:   isMobile ? 0 : 'auto',
          background:"var(--card)",
          borderLeft: isMobile ? 'none' : "1.5px solid var(--border)",
          display:"flex", flexDirection:"column",
          boxShadow: isMobile ? "0 -4px 32px rgba(0,0,0,.14)" : "-6px 0 32px rgba(0,0,0,.09)",
        }}>
          {/* Panel header */}
          <div style={{ padding:"16px 20px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
            <span style={{ fontSize:11, fontWeight:700, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".08em" }}>Student Profile</span>
            <button onClick={() => { setSelected(null); setIsEditing(false); }}
              style={{ background:"none", border:"none", fontSize:18, cursor:"pointer", color:"var(--muted)", lineHeight:1, padding:4, borderRadius:6 }}>✕</button>
          </div>

          {/* Profile hero */}
          <div style={{ padding:"28px 24px 20px", textAlign:"center", borderBottom:"1px solid var(--border)", flexShrink:0, background:"var(--surface)" }}>
            <div style={{ display:"flex", justifyContent:"center", marginBottom:14 }}>
              <StudentAvatar student={selected} size={80} border="3px solid var(--accent)" />
            </div>
            <div style={{ fontFamily:"var(--font-d)", fontSize:18, fontWeight:800, marginBottom:3 }}>{selected.name}</div>
            {selected.age && <div style={{ fontSize:13, color:"var(--muted)", marginBottom:10 }}>Age {selected.age}</div>}
            {selected.batches && (
              <div style={{ display:"flex", gap:5, justifyContent:"center", flexWrap:"wrap" }}>
                {String(selected.batches).split(",").map((b,i) => (
                  <span key={i} style={{ fontSize:11, background:"var(--accent)22", color:"var(--accent)", borderRadius:20, padding:"3px 10px", fontWeight:600 }}>{b.trim()}</span>
                ))}
              </div>
            )}
          </div>

          {/* Scrollable body */}
          <div style={{ flex:1, overflowY:"auto", padding:"22px 24px" }}>
            {!isEditing ? (
              /* View mode */
              <>
                <PanelSection title="Contact">
                  <InfoRow icon="✉️" label="Email" value={selected.email} />
                  <InfoRow icon="📞" label="Phone" value={selected.phone} />
                  {!selected.email && !selected.phone && <p style={{ fontSize:12, color:"var(--muted)" }}>No contact info on record</p>}
                </PanelSection>

                {(selected.guardian_name || selected.guardian_phone || selected.guardian_email) && (
                  <PanelSection title="Guardian">
                    <InfoRow icon="🌸" label="Name"  value={selected.guardian_name} />
                    <InfoRow icon="📞" label="Phone" value={selected.guardian_phone} />
                    <InfoRow icon="✉️" label="Email" value={selected.guardian_email} />
                  </PanelSection>
                )}

                <PanelSection title="Enrollment">
                  <InfoRow icon="📅" label="Joined" value={fmtLong(selected.join_date)} />
                </PanelSection>

                {selected.notes && (
                  <PanelSection title="Notes">
                    <p style={{ fontSize:13, color:"var(--muted)", lineHeight:1.6, background:"var(--surface)", borderRadius:9, padding:"10px 12px", margin:0 }}>
                      {selected.notes}
                    </p>
                  </PanelSection>
                )}

                <div style={{ display:"flex", gap:9, marginTop:24 }}>
                  <button onClick={startEdit} style={{
                    flex:1, padding:"9px 16px", borderRadius:9, border:"1.5px solid var(--accent)",
                    background:"var(--accent)", color:"#fff", cursor:"pointer", fontSize:13, fontFamily:"var(--font-b)", fontWeight:600
                  }}>✏️ Edit Profile</button>
                  <button onClick={() => { if(window.confirm("Remove this student?")) deleteMutation.mutate(selected.id); }}
                    style={{ padding:"9px 14px", borderRadius:9, border:"1.5px solid #e05c6a", background:"transparent", color:"#e05c6a", cursor:"pointer", fontSize:13, fontFamily:"var(--font-b)" }}>🗑</button>
                </div>
              </>
            ) : (
              /* Edit mode */
              <>
                {(() => {
                  const ea = Number(editForm.age);
                  const eKnown = String(editForm.age ?? "").trim() !== "" && !isNaN(ea) && ea > 0;
                  const eMinor = eKnown && ea <= 18;
                  const eAdult = eKnown && ea > 18;
                  return (<>
                    <Field label="Full Name"><Input value={editForm.name||""} onChange={e=>setEditForm({...editForm,name:e.target.value})} /></Field>
                    <Field label="Age"><Input type="number" value={editForm.age||""} onChange={e=>setEditForm({...editForm,age:e.target.value})} placeholder="e.g. 12" min="0" max="99"/></Field>
                    {(!eKnown || eAdult) && (<>
                      <Field label="Phone / WhatsApp"><Input value={editForm.phone||""} onChange={e=>setEditForm({...editForm,phone:e.target.value})} /></Field>
                      <Field label="Email"><Input value={editForm.email||""} onChange={e=>setEditForm({...editForm,email:e.target.value})} /></Field>
                    </>)}
                    {eMinor && (<>
                      <Field label="Guardian Name"><Input value={editForm.guardian_name||""} onChange={e=>setEditForm({...editForm,guardian_name:e.target.value})} /></Field>
                      <Field label="Guardian Phone"><Input value={editForm.guardian_phone||""} onChange={e=>setEditForm({...editForm,guardian_phone:e.target.value})} /></Field>
                      <Field label="Guardian Email"><Input value={editForm.guardian_email||""} onChange={e=>setEditForm({...editForm,guardian_email:e.target.value})} /></Field>
                    </>)}
                    <Field label="Join Date"><Input type="date" value={(editForm.join_date||"").split("T")[0]} onChange={e=>setEditForm({...editForm,join_date:e.target.value})} /></Field>
                    <Field label="Notes"><Textarea value={editForm.notes||""} onChange={e=>setEditForm({...editForm,notes:e.target.value})} placeholder="Any notes…"/></Field>
                  </>);
                })()}
                <div style={{ display:"flex", gap:9, marginTop:14 }}>
                  <Button onClick={() => editMutation.mutate(editForm)} disabled={!editForm.name || editMutation.isPending}>
                    {editMutation.isPending ? "Saving…" : "Save Changes"}
                  </Button>
                  <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Add Student Modal ── */}
      {showAdd && (() => {
        const addAge     = Number(addForm.age);
        const ageKnown   = String(addForm.age ?? "").trim() !== "" && !isNaN(addAge) && addAge > 0;
        const isMinor    = ageKnown && addAge <= 18;
        const isAdult    = ageKnown && addAge > 18;
        return (
        <Modal title="Add Student" onClose={() => setShowAdd(false)} wide>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 16px" }}>
            <Field label="Full Name *"><Input value={addForm.name} onChange={e=>setAddForm({...addForm,name:e.target.value})} placeholder="Student name"/></Field>
            <Field label="Age"><Input type="number" value={addForm.age} onChange={e=>setAddForm({...addForm,age:e.target.value})} placeholder="e.g. 12" min="0" max="99"/></Field>

            {/* ── Contact: age unknown or adult → own phone/email ── */}
            {(!ageKnown || isAdult) && (
              <>
                <Field label="Phone / WhatsApp"><Input value={addForm.phone} onChange={e=>setAddForm({...addForm,phone:e.target.value})} placeholder="+1 555 000 0000"/></Field>
                <Field label="Email"><Input value={addForm.email} onChange={e=>setAddForm({...addForm,email:e.target.value})} placeholder="email@example.com"/></Field>
              </>
            )}

            {/* ── Guardian: only when age is known and ≤ 18 ── */}
            {isMinor && (
              <>
                <Field label="Guardian Name *"><Input value={addForm.guardian_name} onChange={e=>setAddForm({...addForm,guardian_name:e.target.value})} placeholder="Parent or guardian"/></Field>
                <Field label="Guardian Phone"><Input value={addForm.guardian_phone} onChange={e=>setAddForm({...addForm,guardian_phone:e.target.value})} placeholder="+1 555 000 0000"/></Field>
                <Field label="Guardian Email"><Input value={addForm.guardian_email} onChange={e=>setAddForm({...addForm,guardian_email:e.target.value})} placeholder="parent@email.com"/></Field>
              </>
            )}

            <Field label="Join Date"><Input type="date" value={addForm.join_date} onChange={e=>setAddForm({...addForm,join_date:e.target.value})}/></Field>
          </div>
          <Field label="Notes"><Textarea value={addForm.notes} onChange={e=>setAddForm({...addForm,notes:e.target.value})} placeholder="Any notes…"/></Field>
          <div style={{ display:"flex", gap:9, marginTop:8 }}>
            <Button onClick={() => addMutation.mutate(addForm)} disabled={!addForm.name || addMutation.isPending}>
              {addMutation.isPending ? "Adding…" : "Add Student"}
            </Button>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
          </div>
        </Modal>
        );
      })()}
    </div>
  );
}
