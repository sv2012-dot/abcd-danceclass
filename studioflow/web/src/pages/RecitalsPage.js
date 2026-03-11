import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { recitals as api } from "../api";
import toast from "react-hot-toast";
import Card from "../components/shared/Card";
import Button from "../components/shared/Button";
import Badge from "../components/shared/Badge";
import Modal from "../components/shared/Modal";
import { Field, Input, Select, Textarea } from "../components/shared/Field";

const STATUS_OPTIONS = ["Planning","Confirmed","Rehearsals","Completed","Cancelled"];
const STATUS_COLORS  = { Planning:"#6a7fdb", Confirmed:"#52c4a0", Rehearsals:"#f4a041", Completed:"#8ab4c0", Cancelled:"#e05c6a" };
const STATUS_ICONS   = { Planning:"📋", Confirmed:"✅", Rehearsals:"🎵", Completed:"🏆", Cancelled:"❌" };
const EMPTY = { title:"", event_date:"", venue:"", status:"Planning", description:"" };

function PSection({ title, children }) {
  return (
    <div style={{ marginBottom:20 }}>
      <div style={{ fontSize:10, fontWeight:700, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".08em", marginBottom:10, paddingBottom:6, borderBottom:"1px solid var(--border)" }}>{title}</div>
      {children}
    </div>
  );
}

export default function RecitalsPage() {
  const { user } = useAuth();
  const sid = user?.school_id;
  const qc  = useQueryClient();

  const [view,          setView]          = useState("grid");
  const [modal,         setModal]         = useState(null);
  const [form,          setForm]          = useState(EMPTY);
  const [selected,      setSelected]      = useState(null);
  const [selectedTasks, setSelectedTasks] = useState([]);
  const [newTask,       setNewTask]       = useState("");
  const PANEL_W = 420;

  const { data: recitals=[], isLoading } = useQuery({
    queryKey: ["recitals", sid],
    queryFn: () => api.list(sid),
    enabled: !!sid,
  });

  const saveMutation = useMutation({
    mutationFn: data => modal?.id ? api.update(sid, modal.id, data) : api.create(sid, data),
    onSuccess: () => {
      qc.invalidateQueries(["recitals", sid]);
      toast.success(modal?.id ? "Event updated" : "Event created");
      setModal(null);
    },
    onError: err => toast.error(err.error || "Failed to save"),
  });

  const deleteMutation = useMutation({
    mutationFn: id => api.remove(sid, id),
    onSuccess: (_,id) => {
      qc.invalidateQueries(["recitals", sid]);
      toast.success("Event deleted");
      if (selected?.id === id) setSelected(null);
    },
    onError: err => toast.error(err.error || "Failed to delete"),
  });

  const openPanel = async (r) => {
    try {
      const res = await api.get(sid, r.id);
      const { tasks, ...recital } = res;
      setSelected(recital);
      setSelectedTasks(tasks || []);
    } catch { toast.error("Failed to load details"); }
  };

  const toggleTask = async (taskId, done) => {
    try {
      await api.toggleTask(sid, selected.id, taskId);
      setSelectedTasks(prev => prev.map(t => t.id===taskId ? {...t,is_done:!done} : t));
      qc.invalidateQueries(["recitals", sid]);
    } catch { toast.error("Failed to update task"); }
  };

  const addTask = async () => {
    if (!newTask.trim()) return;
    try {
      const task = await api.addTask(sid, selected.id, newTask);
      setSelectedTasks(prev => [...prev, task]);
      setNewTask("");
      qc.invalidateQueries(["recitals", sid]);
    } catch { toast.error("Failed to add task"); }
  };

  const openAdd  = () => { setForm({...EMPTY}); setModal({}); };
  const openEdit = (e, r) => {
    e.stopPropagation();
    setForm({ title:r.title||"", event_date:r.event_date?.split("T")[0]||"", venue:r.venue||"", status:r.status||"Planning", description:r.description||"" });
    setModal(r);
  };

  const sorted = [...recitals].sort((a,b) => new Date(b.event_date) - new Date(a.event_date));

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div style={{ paddingRight: selected ? PANEL_W+20 : 0, transition:"padding .25s ease" }}>

      {/* ── Header ── */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20, flexWrap:"wrap", gap:10 }}>
        <div>
          <h1 style={{ fontFamily:"var(--font-d)", fontSize:24, marginBottom:2 }}>Recitals & Events</h1>
          <p style={{ color:"var(--muted)", fontSize:12 }}>{recitals.length} events</p>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <div style={{ display:"flex", border:"1.5px solid var(--border)", borderRadius:9, overflow:"hidden" }}>
            <button onClick={() => setView("grid")}
              style={{ padding:"7px 13px", border:"none", cursor:"pointer", fontSize:16, lineHeight:1, transition:"all .15s",
                background:view==="grid" ? "var(--accent)" : "transparent", color:view==="grid" ? "#fff" : "var(--muted)" }}>⊞</button>
            <button onClick={() => setView("table")}
              style={{ padding:"7px 13px", border:"none", borderLeft:"1.5px solid var(--border)", cursor:"pointer", fontSize:16, lineHeight:1, transition:"all .15s",
                background:view==="table" ? "var(--accent)" : "transparent", color:view==="table" ? "#fff" : "var(--muted)" }}>☰</button>
          </div>
          <Button onClick={openAdd} icon="➕">New Event</Button>
        </div>
      </div>

      {/* ── Content ── */}
      {isLoading ? (
        <p style={{ color:"var(--muted)" }}>Loading…</p>

      ) : sorted.length === 0 ? (
        <Card style={{ textAlign:"center", padding:48, border:"1.5px dashed var(--border)" }}>
          <div style={{ fontSize:34, marginBottom:12 }}>🌟</div>
          <p style={{ fontWeight:700, marginBottom:4 }}>No events yet</p>
          <p style={{ color:"var(--muted)", fontSize:13, marginBottom:16 }}>Plan your first recital or performance!</p>
          <Button onClick={openAdd}>New Event</Button>
        </Card>

      ) : view === "grid" ? (
        /* ── Grid cards ── */
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(280px, 1fr))", gap:12 }}>
          {sorted.map(r => {
            const color  = STATUS_COLORS[r.status] || "#888";
            const d      = new Date(r.event_date);
            const pct    = r.task_count ? Math.round(((r.tasks_done||0)/r.task_count)*100) : 0;
            const active = selected?.id === r.id;
            return (
              <div key={r.id} onClick={() => openPanel(r)} style={{
                background:"var(--card)", borderRadius:14, cursor:"pointer", overflow:"hidden",
                border:`2px solid ${active ? color : "var(--border)"}`,
                boxShadow: active ? `0 0 0 3px ${color}22` : "0 1px 4px rgba(0,0,0,.05)",
                transition:"all .15s"
              }}>
                {/* Color stripe */}
                <div style={{ height:4, background:color }} />
                <div style={{ padding:"14px 16px 16px" }}>
                  {/* Date + title */}
                  <div style={{ display:"flex", alignItems:"flex-start", gap:12, marginBottom:10 }}>
                    <div style={{ textAlign:"center", minWidth:46, background:color+"20", borderRadius:10, padding:"7px 6px", flexShrink:0 }}>
                      <div style={{ fontSize:18, fontWeight:800, color, fontFamily:"var(--font-d)", lineHeight:1 }}>{d.getDate()}</div>
                      <div style={{ fontSize:9, color:"var(--muted)", textTransform:"uppercase", marginTop:2 }}>{d.toLocaleString("default",{month:"short",year:"2-digit"})}</div>
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontFamily:"var(--font-d)", fontWeight:800, fontSize:14, marginBottom:4, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.title}</div>
                      <span style={{ fontSize:10, background:color+"22", color, borderRadius:20, padding:"2px 8px", fontWeight:700 }}>{r.status}</span>
                    </div>
                  </div>
                  {/* Venue */}
                  {r.venue && <div style={{ fontSize:11, color:"var(--muted)", marginBottom:8, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>📍 {r.venue}</div>}
                  {/* Task progress */}
                  {r.task_count > 0 && (
                    <div>
                      <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:"var(--muted)", marginBottom:4 }}>
                        <span>Checklist</span><span>{r.tasks_done||0}/{r.task_count} done</span>
                      </div>
                      <div style={{ height:5, borderRadius:3, background:"var(--border)", overflow:"hidden" }}>
                        <div style={{ height:"100%", width:pct+"%", background:color, borderRadius:3, transition:"width .3s" }} />
                      </div>
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
                {["Date","Event","Venue","Status","Tasks",""].map(h => (
                  <th key={h} style={{ padding:"11px 14px", textAlign:"left", fontSize:11, fontWeight:700, letterSpacing:".06em", textTransform:"uppercase", color:"var(--muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(r => {
                const color  = STATUS_COLORS[r.status] || "#888";
                const d      = new Date(r.event_date);
                const pct    = r.task_count ? Math.round(((r.tasks_done||0)/r.task_count)*100) : null;
                const active = selected?.id === r.id;
                return (
                  <tr key={r.id} onClick={() => openPanel(r)} style={{
                    borderTop:"1px solid var(--border)", cursor:"pointer",
                    background: active ? color+"08" : "transparent", transition:"background .1s"
                  }}>
                    <td style={{ padding:"10px 14px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <div style={{ textAlign:"center", minWidth:36, background:color+"20", borderRadius:8, padding:"4px 3px" }}>
                          <div style={{ fontSize:13, fontWeight:800, color, lineHeight:1 }}>{d.getDate()}</div>
                          <div style={{ fontSize:8, color:"var(--muted)", textTransform:"uppercase" }}>{d.toLocaleString("default",{month:"short"})}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding:"10px 14px", fontWeight:700, fontSize:13, maxWidth:200, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.title}</td>
                    <td style={{ padding:"10px 14px", fontSize:12, color:"var(--muted)", maxWidth:160, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.venue||"—"}</td>
                    <td style={{ padding:"10px 14px" }}>
                      <span style={{ fontSize:11, background:color+"22", color, borderRadius:20, padding:"2px 9px", fontWeight:700 }}>{r.status}</span>
                    </td>
                    <td style={{ padding:"10px 14px", minWidth:120 }}>
                      {pct !== null ? (
                        <div>
                          <div style={{ fontSize:10, color:"var(--muted)", marginBottom:3 }}>{r.tasks_done||0}/{r.task_count}</div>
                          <div style={{ height:5, borderRadius:3, background:"var(--border)", overflow:"hidden", width:80 }}>
                            <div style={{ height:"100%", width:pct+"%", background:color, borderRadius:3 }} />
                          </div>
                        </div>
                      ) : <span style={{ color:"var(--muted)", fontSize:12 }}>—</span>}
                    </td>
                    <td style={{ padding:"10px 14px" }}>
                      <div style={{ display:"flex", gap:5 }} onClick={e=>e.stopPropagation()}>
                        <Button size="sm" variant="outline" onClick={e=>openEdit(e,r)}>Edit</Button>
                        <Button size="sm" variant="danger" onClick={()=>{if(window.confirm("Delete event?"))deleteMutation.mutate(r.id);}}>Del</Button>
                      </div>
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
          position:"fixed", right:0, top:0, bottom:0, width:PANEL_W,
          background:"var(--card)", borderLeft:"1.5px solid var(--border)",
          display:"flex", flexDirection:"column", zIndex:300,
          boxShadow:"-6px 0 32px rgba(0,0,0,.09)"
        }}>
          {/* Panel header */}
          <div style={{ padding:"16px 20px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
            <span style={{ fontSize:11, fontWeight:700, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".08em" }}>Event Details</span>
            <button onClick={() => { setSelected(null); setSelectedTasks([]); }}
              style={{ background:"none", border:"none", fontSize:18, cursor:"pointer", color:"var(--muted)", lineHeight:1, padding:4, borderRadius:6 }}>✕</button>
          </div>

          {/* Event hero */}
          {(() => {
            const color = STATUS_COLORS[selected.status] || "#888";
            const d     = new Date(selected.event_date);
            const done  = selectedTasks.filter(t=>t.is_done).length;
            const total = selectedTasks.length;
            return (
              <div style={{ padding:"22px 22px 18px", borderBottom:"1px solid var(--border)", flexShrink:0, background:"var(--surface)" }}>
                <div style={{ display:"flex", alignItems:"flex-start", gap:14 }}>
                  {/* Date block */}
                  <div style={{ textAlign:"center", minWidth:54, background:color+"22", borderRadius:12, padding:"10px 8px", flexShrink:0 }}>
                    <div style={{ fontSize:24, fontWeight:800, color, fontFamily:"var(--font-d)", lineHeight:1 }}>{d.getDate()}</div>
                    <div style={{ fontSize:10, color:"var(--muted)", textTransform:"uppercase", marginTop:3 }}>{d.toLocaleString("default",{month:"short"})}</div>
                    <div style={{ fontSize:9, color:"var(--muted)" }}>{d.getFullYear()}</div>
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontFamily:"var(--font-d)", fontSize:17, fontWeight:800, marginBottom:6, lineHeight:1.3 }}>{selected.title}</div>
                    <span style={{ fontSize:11, background:color+"22", color, borderRadius:20, padding:"3px 10px", fontWeight:700 }}>{STATUS_ICONS[selected.status]} {selected.status}</span>
                    {selected.venue && <div style={{ fontSize:12, color:"var(--muted)", marginTop:8 }}>📍 {selected.venue}</div>}
                  </div>
                </div>
                {total > 0 && (
                  <div style={{ marginTop:14 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"var(--muted)", marginBottom:5 }}>
                      <span>Checklist progress</span><span style={{ fontWeight:700 }}>{done}/{total} done</span>
                    </div>
                    <div style={{ height:6, borderRadius:3, background:"var(--border)", overflow:"hidden" }}>
                      <div style={{ height:"100%", width:(total ? (done/total*100) : 0)+"%", background:color, borderRadius:3, transition:"width .3s" }} />
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Scrollable body */}
          <div style={{ flex:1, overflowY:"auto", padding:"20px 22px" }}>

            {/* Description */}
            {selected.description && (
              <PSection title="Description">
                <p style={{ fontSize:13, color:"var(--muted)", lineHeight:1.6, margin:0 }}>{selected.description}</p>
              </PSection>
            )}

            {/* Checklist */}
            <PSection title={`Checklist · ${selectedTasks.filter(t=>t.is_done).length}/${selectedTasks.length}`}>
              {selectedTasks.length === 0 ? (
                <p style={{ fontSize:12, color:"var(--muted)", margin:"0 0 10px" }}>No tasks yet. Add the first one below.</p>
              ) : (
                <div style={{ marginBottom:12 }}>
                  {selectedTasks.map(t => (
                    <div key={t.id} onClick={() => toggleTask(t.id, t.is_done)}
                      style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 11px", borderRadius:9,
                        border:`1.5px solid ${t.is_done ? "var(--accent)" : "var(--border)"}`,
                        background:t.is_done ? "#c4527a11" : "var(--surface)", cursor:"pointer", marginBottom:6, transition:"all .15s" }}>
                      <div style={{ width:18, height:18, borderRadius:5, border:`2px solid ${t.is_done ? "var(--accent)" : "var(--border)"}`,
                        background:t.is_done ? "var(--accent)" : "transparent", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", flexShrink:0, fontSize:10, transition:"all .15s" }}>
                        {t.is_done && "✓"}
                      </div>
                      <span style={{ flex:1, fontSize:13, textDecoration:t.is_done ? "line-through" : "none", opacity:t.is_done ? .55 : 1 }}>{t.task_text}</span>
                    </div>
                  ))}
                </div>
              )}
              {/* Add task input */}
              <div style={{ display:"flex", gap:8 }}>
                <Input value={newTask} onChange={e=>setNewTask(e.target.value)} placeholder="Add a task…" onKeyDown={e=>e.key==="Enter"&&addTask()} style={{ flex:1 }} />
                <Button onClick={addTask} size="sm">Add</Button>
              </div>
            </PSection>

            {/* Actions */}
            <div style={{ display:"flex", gap:9, marginTop:24 }}>
              <button onClick={e => openEdit(e, selected)}
                style={{ flex:1, padding:"9px 16px", borderRadius:9, border:"1.5px solid var(--accent)", background:"var(--accent)", color:"#fff", cursor:"pointer", fontSize:13, fontFamily:"var(--font-b)", fontWeight:600 }}>
                ✏️ Edit Event
              </button>
              <button onClick={() => { if(window.confirm("Delete this event?")) deleteMutation.mutate(selected.id); }}
                style={{ padding:"9px 14px", borderRadius:9, border:"1.5px solid #e05c6a", background:"transparent", color:"#e05c6a", cursor:"pointer", fontSize:13, fontFamily:"var(--font-b)", flexShrink:0 }}>🗑</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create / Edit Modal ── */}
      {modal !== null && (
        <Modal title={modal.id ? "Edit Event" : "New Event"} onClose={()=>setModal(null)} wide>
          <Field label="Event Title *"><Input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="e.g. Spring Showcase 2025" /></Field>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 16px" }}>
            <Field label="Date *"><Input type="date" value={form.event_date} onChange={e=>setForm({...form,event_date:e.target.value})} /></Field>
            <Field label="Status">
              <Select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>
                {STATUS_OPTIONS.map(s=><option key={s}>{s}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Venue"><Input value={form.venue} onChange={e=>setForm({...form,venue:e.target.value})} placeholder="e.g. City Arts Center" /></Field>
          <Field label="Description"><Textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Brief description…" /></Field>
          <div style={{ display:"flex", gap:9, marginTop:8 }}>
            <Button onClick={()=>saveMutation.mutate(form)} disabled={!form.title||!form.event_date||saveMutation.isPending}>
              {saveMutation.isPending ? "Saving…" : modal.id ? "Save Changes" : "Create Event"}
            </Button>
            <Button variant="outline" onClick={()=>setModal(null)}>Cancel</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
