import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { batches as api, students as studentsApi, schedules as schedulesApi, recitals as recitalsApi } from "../api";
import toast from "react-hot-toast";
import Card from "../components/shared/Card";
import Button from "../components/shared/Button";
import Badge from "../components/shared/Badge";
import Modal from "../components/shared/Modal";
import { Field, Input, Select, Textarea } from "../components/shared/Field";

const LEVELS = ["Beginner","Intermediate","Advanced","Mixed"];
const BATCH_COLORS = ["#e8607a","#6a7fdb","#f4a041","#52c4a0","#b47fe8","#e87a52"];
const DAY_ORDER = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const DAY_FULL  = { Mon:"Monday", Tue:"Tuesday", Wed:"Wednesday", Thu:"Thursday", Fri:"Friday", Sat:"Saturday", Sun:"Sunday" };
const EMPTY     = { name:"", dance_style:"", level:"Beginner", teacher_name:"", max_size:"", notes:"" };
const EMPTY_SCH = { day_of_week:"Mon", start_time:"09:00", end_time:"10:00", room:"" };
const TIME_SLOTS = Array.from({ length:24*4 }, (_,i) => {
  const h = String(Math.floor(i/4)).padStart(2,"0");
  const m = String((i%4)*15).padStart(2,"0");
  return `${h}:${m}`;
});

function PSection({ title, children }) {
  return (
    <div style={{ marginBottom:20 }}>
      <div style={{ fontSize:10, fontWeight:700, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".08em", marginBottom:10, paddingBottom:6, borderBottom:"1px solid var(--border)" }}>{title}</div>
      {children}
    </div>
  );
}

export default function BatchesPage() {
  const { user } = useAuth();
  const sid = user?.school_id;
  const qc  = useQueryClient();

  const [activeId,       setActiveId]       = useState(null);
  const [view,           setView]           = useState("grid");
  const [modal,          setModal]          = useState(null);
  const [form,           setForm]           = useState(EMPTY);
  const [enrollModal,    setEnrollModal]    = useState(null);
  const [enrollSel,      setEnrollSel]      = useState([]);
  const [detailStudents, setDetailStudents] = useState([]);
  const [loadingDetail,  setLoadingDetail]  = useState(false);
  const [formSchedules,  setFormSchedules]  = useState([]);
  const [saving,         setSaving]         = useState(false);
  const PANEL_W = 440;

  const { data: list=[], isLoading } = useQuery({ queryKey:["batches",sid], queryFn:()=>api.list(sid), enabled:!!sid });
  const { data: allStudents=[]     } = useQuery({ queryKey:["students",sid], queryFn:()=>studentsApi.list(sid), enabled:!!sid });
  const { data: allSchedules=[]   } = useQuery({ queryKey:["schedules",sid], queryFn:()=>schedulesApi.list(sid), enabled:!!sid });
  const { data: allRecitals=[]    } = useQuery({ queryKey:["recitals",sid],  queryFn:()=>recitalsApi.list(sid), enabled:!!sid });

  const activeBatch   = list.find(b => b.id === activeId) || null;
  const colorIndex    = activeBatch ? list.indexOf(activeBatch) : 0;
  const activeColor   = BATCH_COLORS[colorIndex % BATCH_COLORS.length];
  const batchSchedules = allSchedules.filter(s => s.batch_id === activeId);
  const sortedSchedules = [...batchSchedules].sort((a,b) => DAY_ORDER.indexOf(a.day_of_week) - DAY_ORDER.indexOf(b.day_of_week));
  const upcomingRecitals = allRecitals
    .filter(r => new Date(r.event_date) >= new Date() && r.status !== "Cancelled")
    .sort((a,b) => new Date(a.event_date) - new Date(b.event_date))
    .slice(0, 3);
  const pct = activeBatch?.max_size
    ? Math.min(100, Math.round(((activeBatch.student_count||0) / activeBatch.max_size) * 100))
    : null;

  const getBatchDays = id =>
    [...new Set(allSchedules.filter(s => s.batch_id === id).map(s => s.day_of_week))]
      .sort((a,b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b));

  useEffect(() => {
    if (!activeId || !sid) { setDetailStudents([]); return; }
    setLoadingDetail(true);
    api.get(sid, activeId)
      .then(res => setDetailStudents(res.students || []))
      .catch(() => setDetailStudents([]))
      .finally(() => setLoadingDetail(false));
  }, [activeId, sid]);

  const refreshDetail = () => {
    if (!activeId || !sid) return;
    api.get(sid, activeId).then(res => setDetailStudents(res.students || [])).catch(() => {});
  };

  // ── Save batch + schedules ──
  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    try {
      let batchId = modal?.id;
      if (batchId) { await api.update(sid, batchId, form); }
      else          { const c = await api.create(sid, form); batchId = c.id; }

      const existingIds = batchSchedules.map(s => s.id);
      const keptIds     = formSchedules.filter(s => s.id).map(s => s.id);
      await Promise.all(existingIds.filter(id => !keptIds.includes(id)).map(id => schedulesApi.remove(sid, id)));
      for (const sch of formSchedules) {
        const payload = { batch_id:batchId, day_of_week:sch.day_of_week, start_time:sch.start_time, end_time:sch.end_time, room:sch.room||null };
        if (sch.id) await schedulesApi.update(sid, sch.id, payload);
        else        await schedulesApi.create(sid, payload);
      }
      qc.invalidateQueries(["batches",sid]);
      qc.invalidateQueries(["schedules",sid]);
      toast.success(modal?.id ? "Batch updated" : "Batch created");
      setModal(null);
    } catch (err) { toast.error(err.error || "Failed to save"); }
    finally       { setSaving(false); }
  };

  const deleteMutation = useMutation({
    mutationFn: id => api.remove(sid, id),
    onSuccess: (_,id) => { qc.invalidateQueries(["batches",sid]); toast.success("Batch deleted"); if (activeId===id) setActiveId(null); },
    onError: err => toast.error(err.error || "Failed"),
  });

  const enrollMutation = useMutation({
    mutationFn: () => api.enroll(sid, enrollModal.id, enrollSel),
    onSuccess: () => { qc.invalidateQueries(["batches",sid]); qc.invalidateQueries(["students",sid]); toast.success("Enrolment saved"); setEnrollModal(null); refreshDetail(); },
    onError: err => toast.error(err.error || "Failed"),
  });

  const openAdd = () => { setForm(EMPTY); setFormSchedules([]); setModal({}); };
  const openEdit = (batch) => {
    const target = batch || activeBatch;
    if (!target) return;
    const targetSchedules = allSchedules.filter(s => s.batch_id === target.id);
    setForm({ name:target.name||"", dance_style:target.dance_style||"", level:target.level||"Beginner", teacher_name:target.teacher_name||"", max_size:target.max_size||"", notes:target.notes||"" });
    setFormSchedules(targetSchedules.map(s => ({ id:s.id, day_of_week:s.day_of_week, start_time:s.start_time?.slice(0,5)||"09:00", end_time:s.end_time?.slice(0,5)||"10:00", room:s.room||"" })));
    setActiveId(target.id);
    setModal(target);
  };
  const openEnroll = () => { if (!activeBatch) return; setEnrollSel(detailStudents.map(s=>s.id)); setEnrollModal(activeBatch); };
  const toggleEnroll = id => setEnrollSel(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev,id]);

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div style={{ paddingRight: activeBatch ? PANEL_W+20 : 0, transition:"padding .25s ease" }}>

      {/* ── Header ── */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20, flexWrap:"wrap", gap:10 }}>
        <div>
          <h1 style={{ fontFamily:"var(--font-d)", fontSize:24, marginBottom:2 }}>Batches</h1>
          <p style={{ color:"var(--muted)", fontSize:12 }}>{list.length} active groups</p>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center", marginLeft:"auto" }}>
          <div style={{ display:"flex", border:"1.5px solid var(--border)", borderRadius:9, overflow:"hidden" }}>
            <button onClick={() => setView("grid")}
              style={{ padding:"7px 13px", border:"none", cursor:"pointer", fontSize:16, lineHeight:1, transition:"all .15s",
                background:view==="grid" ? "var(--accent)" : "transparent", color:view==="grid" ? "#fff" : "var(--muted)" }}>⊞</button>
            <button onClick={() => setView("table")}
              style={{ padding:"7px 13px", border:"none", borderLeft:"1.5px solid var(--border)", cursor:"pointer", fontSize:16, lineHeight:1, transition:"all .15s",
                background:view==="table" ? "var(--accent)" : "transparent", color:view==="table" ? "#fff" : "var(--muted)" }}>☰</button>
          </div>
          <Button onClick={openAdd} icon="➕">New Batch</Button>
        </div>
      </div>

      {/* ── Content ── */}
      {isLoading ? (
        <p style={{ color:"var(--muted)" }}>Loading…</p>

      ) : list.length === 0 ? (
        <Card style={{ textAlign:"center", padding:48, border:"1.5px dashed var(--border)" }}>
          <div style={{ fontSize:32, marginBottom:12 }}>📚</div>
          <p style={{ fontWeight:700, marginBottom:4 }}>No batches yet</p>
          <p style={{ color:"var(--muted)", fontSize:13, marginBottom:16 }}>Create your first batch to group students by level or style.</p>
          <Button onClick={openAdd}>New Batch</Button>
        </Card>

      ) : view === "grid" ? (
        /* ── Grid cards ── */
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(280px, 1fr))", gap:16 }}>
          {list.map((b,i) => {
            const color  = BATCH_COLORS[i % BATCH_COLORS.length];
            const active = b.id === activeId;
            const days   = getBatchDays(b.id);
            const capPct = b.max_size ? Math.min(100, Math.round(((b.student_count||0)/b.max_size)*100)) : null;
            const schedules = allSchedules.filter(s => s.batch_id === b.id);
            const firstSch  = schedules[0];
            return (
              <div key={b.id} onClick={() => setActiveId(active ? null : b.id)} style={{
                background:"var(--card)", borderRadius:14, overflow:"hidden",
                border:`1.5px solid ${active ? color : "var(--border)"}`,
                boxShadow: active ? `0 0 0 3px ${color}22` : "0 2px 8px rgba(0,0,0,.06)",
                transition:"all .15s", display:"flex", flexDirection:"column",
                cursor:"pointer",
              }}>
                <div style={{ padding:"18px 18px 14px" }}>
                  {/* Name + color dot */}
                  <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:8, marginBottom:4 }}>
                    <div style={{ fontWeight:700, fontSize:15, lineHeight:1.3, color:"var(--foreground)" }}>{b.name}</div>
                    <div style={{ width:10, height:10, borderRadius:"50%", background:color, flexShrink:0, marginTop:4 }} />
                  </div>
                  {/* Instructor */}
                  {b.teacher_name && <div style={{ fontSize:13, color:"var(--muted)", marginBottom:12 }}>Instructor: {b.teacher_name}</div>}
                  {/* Badges */}
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:14 }}>
                    {b.dance_style && <span style={{ fontSize:11, fontWeight:600, background:color+"18", color, borderRadius:20, padding:"3px 10px", border:`1px solid ${color}30` }}>{b.dance_style}</span>}
                    <span style={{ fontSize:11, fontWeight:600, background:"#F3F4F6", color:"#6B7280", borderRadius:20, padding:"3px 10px", border:"1px solid #E5E7EB" }}>{b.level}</span>
                  </div>
                  {/* Schedule row */}
                  {firstSch && (
                    <div style={{ display:"flex", gap:16, marginBottom:10 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, color:"var(--muted)" }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        {days.length > 0 ? days.join(" & ") : firstSch.day_of_week}, {firstSch.start_time?.slice(0,5)}
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, color:"var(--muted)" }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        {(() => { if (!firstSch.start_time || !firstSch.end_time) return "—"; const [sh,sm]=firstSch.start_time.split(":").map(Number); const [eh,em]=firstSch.end_time.split(":").map(Number); return `${(eh*60+em)-(sh*60+sm)} min`; })()}
                      </div>
                    </div>
                  )}
                  {/* Enrollment row */}
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color:"var(--muted)",flexShrink:0}}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    <span style={{ fontSize:12, color:"var(--muted)", flex:1 }}>Enrollment</span>
                    <span style={{ fontSize:12, fontWeight:700, color:"var(--foreground)" }}>
                      {b.student_count||0}{b.max_size ? `/${b.max_size}` : ""}
                    </span>
                  </div>
                  {capPct !== null && (
                    <div style={{ height:5, borderRadius:3, background:"#E5E7EB", overflow:"hidden", marginBottom:2 }}>
                      <div style={{ height:"100%", width:capPct+"%", background: capPct>=90 ? "#EF4444" : "#111827", borderRadius:3, transition:"width .3s" }} />
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
                {["Batch","Style","Level","Instructor","Students","Schedule",""].map(h => (
                  <th key={h} style={{ padding:"11px 14px", textAlign:"left", fontSize:11, fontWeight:700, letterSpacing:".06em", textTransform:"uppercase", color:"var(--muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((b,i) => {
                const color  = BATCH_COLORS[i % BATCH_COLORS.length];
                const active = b.id === activeId;
                const days   = getBatchDays(b.id);
                return (
                  <tr key={b.id} onClick={() => setActiveId(b.id)} style={{
                    borderTop:"1px solid var(--border)", cursor:"pointer",
                    background: active ? color+"08" : "transparent", transition:"background .1s"
                  }}>
                    <td style={{ padding:"10px 14px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                        <div style={{ width:6, height:32, borderRadius:3, background:color, flexShrink:0 }} />
                        <span style={{ fontWeight:700, fontSize:13 }}>{b.name}</span>
                      </div>
                    </td>
                    <td style={{ padding:"10px 14px", fontSize:12, color:"var(--muted)" }}>{b.dance_style||"—"}</td>
                    <td style={{ padding:"10px 14px" }}>
                      <span style={{ fontSize:11, background:color+"22", color, borderRadius:20, padding:"2px 8px", fontWeight:700 }}>{b.level}</span>
                    </td>
                    <td style={{ padding:"10px 14px", fontSize:12, color:"var(--muted)" }}>{b.teacher_name||"—"}</td>
                    <td style={{ padding:"10px 14px", fontSize:13, fontWeight:700, color }}>{b.student_count||0}{b.max_size ? `/${b.max_size}` : ""}</td>
                    <td style={{ padding:"10px 14px" }}>
                      <div style={{ display:"flex", gap:3 }}>
                        {days.map(d => <span key={d} style={{ fontSize:9, fontWeight:700, background:color+"20", color, borderRadius:4, padding:"2px 5px" }}>{d}</span>)}
                        {days.length === 0 && <span style={{ color:"var(--muted)", fontSize:12 }}>—</span>}
                      </div>
                    </td>
                    <td style={{ padding:"10px 14px" }}>
                      <button onClick={e => { e.stopPropagation(); if(window.confirm(`Delete "${b.name}"?`)) deleteMutation.mutate(b.id); }}
                        style={{ background:"none", border:"none", cursor:"pointer", fontSize:14, color:"var(--muted)", padding:"3px 7px", borderRadius:6, opacity:.6 }}>🗑</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Right Detail Panel ── */}
      {activeBatch && (
        <div style={{
          position:"fixed", right:0, top:0, bottom:0, width:PANEL_W,
          background:"var(--card)", borderLeft:"1.5px solid var(--border)",
          display:"flex", flexDirection:"column", zIndex:300,
          boxShadow:"-6px 0 32px rgba(0,0,0,.09)"
        }}>
          {/* Panel header */}
          <div style={{ padding:"16px 20px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
            <span style={{ fontSize:11, fontWeight:700, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".08em" }}>Batch Details</span>
            <button onClick={() => setActiveId(null)}
              style={{ background:"none", border:"none", fontSize:18, cursor:"pointer", color:"var(--muted)", lineHeight:1, padding:4, borderRadius:6 }}>✕</button>
          </div>

          {/* Batch hero */}
          <div style={{ padding:"20px 22px 16px", borderBottom:"1px solid var(--border)", flexShrink:0, background:"var(--surface)" }}>
            <div style={{ display:"flex", alignItems:"flex-start", gap:10, marginBottom:6 }}>
              <div style={{ width:6, height:42, borderRadius:3, background:activeColor, flexShrink:0, marginTop:2 }} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontFamily:"var(--font-d)", fontSize:18, fontWeight:800, marginBottom:6 }}>{activeBatch.name}</div>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap", alignItems:"center" }}>
                  <span style={{ fontSize:11, background:activeColor+"22", color:activeColor, borderRadius:20, padding:"2px 8px", fontWeight:700 }}>{activeBatch.level}</span>
                  {activeBatch.dance_style && <span style={{ fontSize:12, color:"var(--muted)" }}>{activeBatch.dance_style}</span>}
                </div>
              </div>
            </div>
            {activeBatch.teacher_name && <div style={{ fontSize:12, color:"var(--muted)", marginBottom:8, marginLeft:16 }}>👩‍🏫 {activeBatch.teacher_name}</div>}
            <div style={{ marginLeft:16, display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:13, fontWeight:700, color:activeColor }}>{activeBatch.student_count||0}{activeBatch.max_size ? `/${activeBatch.max_size}` : ""}</span>
              <span style={{ fontSize:12, color:"var(--muted)" }}>students enrolled</span>
              {pct !== null && (
                <div style={{ flex:1, height:5, borderRadius:3, background:"var(--border)", overflow:"hidden" }}>
                  <div style={{ height:"100%", width:pct+"%", background:pct>=90 ? "var(--danger)" : activeColor, borderRadius:3, transition:"width .3s" }} />
                </div>
              )}
            </div>
          </div>

          {/* Scrollable body */}
          <div style={{ flex:1, overflowY:"auto", padding:"20px 22px" }}>

            {/* Class Schedule */}
            <PSection title="Class Schedule">
              <div style={{ display:"flex", gap:3, marginBottom:12 }}>
                {DAY_ORDER.map(d => {
                  const has = batchSchedules.some(s => s.day_of_week === d);
                  return <div key={d} style={{ width:36, height:26, borderRadius:6, fontSize:9, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center",
                    background:has ? activeColor : "var(--surface)", color:has ? "#fff" : "var(--muted)", transition:"all .15s" }}>{d}</div>;
                })}
              </div>
              {sortedSchedules.length === 0 ? (
                <p style={{ fontSize:12, color:"var(--muted)", margin:0 }}>No classes scheduled.</p>
              ) : (
                <div style={{ display:"grid", gap:6 }}>
                  {sortedSchedules.map(s => (
                    <div key={s.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px", borderRadius:9, background:activeColor+"12", border:`1px solid ${activeColor}25` }}>
                      <div style={{ fontWeight:800, fontSize:12, color:activeColor, minWidth:30 }}>{s.day_of_week}</div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:12, fontWeight:600 }}>{s.start_time?.slice(0,5)} – {s.end_time?.slice(0,5)}</div>
                        {s.room && <div style={{ fontSize:10, color:"var(--muted)" }}>📍 {s.room}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </PSection>

            {/* Students */}
            <PSection title={`Students · ${detailStudents.length}`}>
              {loadingDetail ? <p style={{ fontSize:12, color:"var(--muted)" }}>Loading…</p> :
                detailStudents.length === 0 ? (
                  <div style={{ textAlign:"center", padding:"12px 0" }}>
                    <p style={{ fontSize:12, color:"var(--muted)", marginBottom:8 }}>No students enrolled yet.</p>
                    <Button size="sm" variant="outline" onClick={openEnroll}>Enrol Students</Button>
                  </div>
                ) : (
                  <>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginBottom:10 }}>
                      {detailStudents.map(s => (
                        <div key={s.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 9px", borderRadius:8, background:"var(--surface)" }}>
                          <div style={{ width:28, height:28, borderRadius:"50%", background:`hsl(${s.name.charCodeAt(0)*7%360},55%,68%)`, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, color:"#fff", fontSize:12, flexShrink:0 }}>{s.name[0]}</div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontWeight:600, fontSize:12, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{s.name}</div>
                            {s.age && <div style={{ fontSize:10, color:"var(--muted)" }}>Age {s.age}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                    <Button size="sm" variant="ghost" onClick={openEnroll}>👥 Manage Students</Button>
                  </>
                )
              }
            </PSection>

            {/* Upcoming Events */}
            <PSection title="Upcoming Events">
              {upcomingRecitals.length === 0 ? (
                <p style={{ fontSize:12, color:"var(--muted)", margin:0 }}>No upcoming events.</p>
              ) : (
                <div style={{ display:"grid", gap:7 }}>
                  {upcomingRecitals.map(r => {
                    const d  = new Date(r.event_date);
                    const sc = { Planning:"#6a7fdb", Confirmed:"#52c4a0", Rehearsals:"#f4a041", Completed:"#8ab4c0" }[r.status] || "#888";
                    return (
                      <div key={r.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 10px", borderRadius:8, background:"var(--surface)" }}>
                        <div style={{ textAlign:"center", minWidth:36, background:sc+"20", borderRadius:7, padding:"4px 3px", flexShrink:0 }}>
                          <div style={{ fontSize:13, fontWeight:800, color:sc, lineHeight:1 }}>{d.getDate()}</div>
                          <div style={{ fontSize:8, color:"var(--muted)", textTransform:"uppercase" }}>{d.toLocaleString("default",{month:"short"})}</div>
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontWeight:600, fontSize:12, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.title}</div>
                          {r.venue && <div style={{ fontSize:10, color:"var(--muted)" }}>📍 {r.venue}</div>}
                        </div>
                        <Badge>{r.status}</Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </PSection>

            {/* Notes */}
            {activeBatch.notes && (
              <PSection title="Notes">
                <p style={{ fontSize:13, color:"var(--muted)", lineHeight:1.6, background:"var(--surface)", borderRadius:9, padding:"10px 12px", margin:0 }}>{activeBatch.notes}</p>
              </PSection>
            )}

            {/* Actions */}
            <div style={{ display:"flex", gap:9, marginTop:24 }}>
              <button onClick={() => openEdit()}
                style={{ flex:1, padding:"9px 16px", borderRadius:9, border:"1.5px solid var(--accent)", background:"var(--accent)", color:"#fff", cursor:"pointer", fontSize:13, fontFamily:"var(--font-b)", fontWeight:600 }}>
                ✏️ Edit Batch
              </button>
              <button onClick={() => { if(window.confirm(`Delete "${activeBatch.name}"?`)) deleteMutation.mutate(activeBatch.id); }}
                style={{ padding:"9px 14px", borderRadius:9, border:"1.5px solid #e05c6a", background:"transparent", color:"#e05c6a", cursor:"pointer", fontSize:13, fontFamily:"var(--font-b)", flexShrink:0 }}>🗑</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create / Edit Modal ── */}
      {modal !== null && (
        <Modal title={modal.id ? "Edit Batch" : "New Batch"} onClose={() => setModal(null)} wide>
          {/* Batch Details section */}
          <div style={{ marginBottom:18 }}>
            <div style={{ fontSize:11, fontWeight:700, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".06em", marginBottom:12 }}>Batch Details</div>
            <Field label="Batch Name *">
              <Input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="e.g. Junior Ballet" />
            </Field>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 16px" }}>
              <Field label="Dance Style"><Input value={form.dance_style} onChange={e=>setForm({...form,dance_style:e.target.value})} placeholder="e.g. Ballet" /></Field>
              <Field label="Level"><Select value={form.level} onChange={e=>setForm({...form,level:e.target.value})}>{LEVELS.map(l=><option key={l}>{l}</option>)}</Select></Field>
              <Field label="Instructor Name"><Input value={form.teacher_name} onChange={e=>setForm({...form,teacher_name:e.target.value})} placeholder="e.g. Swapna Varma" /></Field>
              <Field label="Max Capacity"><Input type="number" value={form.max_size} onChange={e=>setForm({...form,max_size:e.target.value})} placeholder="e.g. 12" /></Field>
            </div>
          </div>

          {/* Class Schedule section */}
          <div style={{ marginBottom:18 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
              <div style={{ fontSize:11, fontWeight:700, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".06em" }}>Class Schedule</div>
              <Button size="sm" variant="ghost" onClick={() => setFormSchedules([...formSchedules,{...EMPTY_SCH}])}>+ Add Class</Button>
            </div>
            {formSchedules.length === 0 ? (
              <p style={{ fontSize:13, color:"var(--muted)", margin:0 }}>No classes added yet. Click "+ Add Class" to schedule days.</p>
            ) : (
              <div style={{ display:"grid", gap:10 }}>
                {formSchedules.map((sch,idx) => (
                  <div key={idx} style={{ padding:"14px 16px", borderRadius:10, background:"var(--surface)", border:"1px solid var(--border)" }}>
                    <div style={{ display:"flex", gap:10, alignItems:"flex-end" }}>
                      <Field label="Day" style={{ flex:"0 0 140px", marginBottom:0 }}>
                        <Select value={sch.day_of_week} onChange={e=>{const u=[...formSchedules];u[idx]={...u[idx],day_of_week:e.target.value};setFormSchedules(u);}}>
                          {DAY_ORDER.map(d=><option key={d} value={d}>{DAY_FULL[d]}</option>)}
                        </Select>
                      </Field>
                      <Field label="Start" style={{ flex:"0 0 120px", marginBottom:0 }}>
                        <Select value={sch.start_time} onChange={e=>{const u=[...formSchedules];u[idx]={...u[idx],start_time:e.target.value};setFormSchedules(u);}}>
                          {TIME_SLOTS.map(t=><option key={t} value={t}>{t}</option>)}
                        </Select>
                      </Field>
                      <Field label="End" style={{ flex:"0 0 120px", marginBottom:0 }}>
                        <Select value={sch.end_time} onChange={e=>{const u=[...formSchedules];u[idx]={...u[idx],end_time:e.target.value};setFormSchedules(u);}}>
                          {TIME_SLOTS.map(t=><option key={t} value={t}>{t}</option>)}
                        </Select>
                      </Field>
                      <button onClick={()=>setFormSchedules(formSchedules.filter((_,i)=>i!==idx))}
                        style={{ background:"none", border:"none", color:"var(--danger)", cursor:"pointer", fontSize:16, padding:"4px 8px", borderRadius:6, flexShrink:0, marginBottom:2 }}>✕</button>
                    </div>
                    <div style={{ marginTop:10 }}>
                      <Field label="Studio / Location" style={{ marginBottom:0 }}>
                        <Input value={sch.room} onChange={e=>{const u=[...formSchedules];u[idx]={...u[idx],room:e.target.value};setFormSchedules(u);}} placeholder="e.g. Studio A, Hall 2" />
                      </Field>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Field label="Notes"><Textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Any additional notes about this batch…" /></Field>
          <div style={{ display:"flex", gap:9, marginTop:8 }}>
            <Button onClick={handleSave} disabled={!form.name||saving}>{saving ? "Saving…" : modal.id ? "Save Changes" : "Create Batch"}</Button>
            <Button variant="outline" onClick={()=>setModal(null)}>Cancel</Button>
          </div>
        </Modal>
      )}

      {/* ── Enrol Students Modal ── */}
      {enrollModal && (
        <Modal title={`Enrol Students — ${enrollModal.name}`} onClose={()=>setEnrollModal(null)} wide>
          <p style={{ color:"var(--muted)", fontSize:13, marginBottom:14 }}>Select which students belong to this batch. {enrollSel.length} selected.</p>
          {allStudents.length === 0 ? <p style={{ color:"var(--muted)" }}>No students yet. Add students first.</p> : (
            <div style={{ display:"grid", gap:7, maxHeight:340, overflowY:"auto", marginBottom:16 }}>
              {allStudents.map(s => {
                const checked = enrollSel.includes(s.id);
                return (
                  <div key={s.id} onClick={()=>toggleEnroll(s.id)}
                    style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 13px", borderRadius:10,
                      border:`1.5px solid ${checked ? "var(--accent)" : "var(--border)"}`,
                      background:checked ? "#c4527a11" : "#faf8fc", cursor:"pointer", transition:"all .15s" }}>
                    <div style={{ width:22, height:22, borderRadius:6, border:`2px solid ${checked ? "var(--accent)" : "var(--border)"}`,
                      background:checked ? "var(--accent)" : "transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                      {checked && <span style={{ color:"#fff", fontSize:12, fontWeight:800 }}>✓</span>}
                    </div>
                    <div style={{ width:32, height:32, borderRadius:"50%", background:`hsl(${s.name.charCodeAt(0)*7%360},55%,68%)`, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, color:"#fff", fontSize:13, flexShrink:0 }}>{s.name[0]}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:600, fontSize:13 }}>{s.name}</div>
                      {s.age && <div style={{ fontSize:11, color:"var(--muted)" }}>Age {s.age}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div style={{ display:"flex", gap:9, paddingTop:8, borderTop:"1px solid var(--border)" }}>
            <Button onClick={()=>enrollMutation.mutate()} disabled={enrollMutation.isPending}>{enrollMutation.isPending ? "Saving…" : `Save Enrolment (${enrollSel.length})`}</Button>
            <Button variant="outline" onClick={()=>setEnrollModal(null)}>Cancel</Button>
            <Button variant="ghost" onClick={()=>setEnrollSel(allStudents.map(s=>s.id))} style={{ marginLeft:"auto" }}>Select All</Button>
            <Button variant="ghost" onClick={()=>setEnrollSel([])}>Clear</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
