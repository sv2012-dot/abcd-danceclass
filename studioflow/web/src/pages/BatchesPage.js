import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { batches as api, students as studentsApi, schedules as schedulesApi, recitals as recitalsApi } from "../api";
import toast from "react-hot-toast";
import Card, { CARD_TOKENS as CT } from "../components/shared/Card";
import Button from "../components/shared/Button";
import Badge from "../components/shared/Badge";
import Modal from "../components/shared/Modal";
import { Field, Input, Select, Textarea } from "../components/shared/Field";
import SvgIcon from "../components/shared/SvgIcon";

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

// ── Batch cover crop modal — 4:3 landscape, saves at 800×600 ────────────────
function BatchCoverCropModal({ file, onConfirm, onCancel }) {
  const canvasRef = useRef(null);
  const imgRef    = useRef(null);
  const stRef     = useRef({ scale:1, ox:0, oy:0, dragging:false, lastX:0, lastY:0, lastDist:0 });
  const [ready,  setReady]  = useState(false);
  const [saving, setSaving] = useState(false);
  const isMob = typeof window !== 'undefined' && window.innerWidth < 768;

  // Canvas / crop window dimensions — landscape 16:9
  const CW    = isMob ? Math.min(window.innerWidth, 420) : 480;
  const PAD   = isMob ? 14 : 20;
  const CROPW = CW - PAD * 2;
  const CROPH = Math.round(CROPW * 9 / 16);  // 16:9 landscape ratio
  const CH    = CROPH + PAD * 2;
  const CROPX = PAD;
  const CROPY = PAD;

  const draw = () => {
    const canvas = canvasRef.current;
    const img    = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    const { scale, ox, oy } = stRef.current;
    ctx.clearRect(0, 0, CW, CH);
    ctx.drawImage(img, ox, oy, img.naturalWidth * scale, img.naturalHeight * scale);
    ctx.fillStyle = 'rgba(0,0,0,0.58)';
    ctx.fillRect(0, 0, CW, CROPY);
    ctx.fillRect(0, CROPY + CROPH, CW, CH - CROPY - CROPH);
    ctx.fillRect(0, CROPY, CROPX, CROPH);
    ctx.fillRect(CROPX + CROPW, CROPY, CW - CROPX - CROPW, CROPH);
    ctx.strokeStyle = 'rgba(255,255,255,0.88)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(CROPX + 0.75, CROPY + 0.75, CROPW - 1.5, CROPH - 1.5);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    [1, 2].forEach(n => {
      ctx.moveTo(CROPX + CROPW * n / 3, CROPY);
      ctx.lineTo(CROPX + CROPW * n / 3, CROPY + CROPH);
      ctx.moveTo(CROPX, CROPY + CROPH * n / 3);
      ctx.lineTo(CROPX + CROPW, CROPY + CROPH * n / 3);
    });
    ctx.stroke();
    const ARM = 20;
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'square';
    ctx.beginPath();
    [
      [CROPX,         CROPY,          1,  1],
      [CROPX + CROPW, CROPY,         -1,  1],
      [CROPX,         CROPY + CROPH,  1, -1],
      [CROPX + CROPW, CROPY + CROPH, -1, -1],
    ].forEach(([x, y, dx, dy]) => {
      ctx.moveTo(x + dx * ARM, y);
      ctx.lineTo(x, y);
      ctx.lineTo(x, y + dy * ARM);
    });
    ctx.stroke();
  };

  const clampOffset = (ox, oy, scale) => {
    const img = imgRef.current;
    if (!img) return { ox, oy };
    return {
      ox: Math.min(CROPX, Math.max(CROPX + CROPW - img.naturalWidth  * scale, ox)),
      oy: Math.min(CROPY, Math.max(CROPY + CROPH - img.naturalHeight * scale, oy)),
    };
  };

  const applyTransform = (newScale, newOx, newOy) => {
    const img = imgRef.current;
    if (!img) return;
    const minS = Math.max(CROPW / img.naturalWidth, CROPH / img.naturalHeight);
    const s    = Math.min(Math.max(newScale, minS), minS * 5);
    const { ox, oy } = clampOffset(newOx, newOy, s);
    Object.assign(stRef.current, { scale: s, ox, oy });
    draw();
  };

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      URL.revokeObjectURL(url);
      const minS = Math.max(CROPW / img.naturalWidth, CROPH / img.naturalHeight);
      const ox   = CROPX + (CROPW - img.naturalWidth  * minS) / 2;
      const oy   = CROPY + (CROPH - img.naturalHeight * minS) / 2;
      Object.assign(stRef.current, { scale: minS, ox, oy });
      setReady(true);
      requestAnimationFrame(draw);
    };
    img.onerror = () => { URL.revokeObjectURL(url); onCancel(); };
    img.src = url;
  }, []); // eslint-disable-line

  const onMD = e => { stRef.current.dragging = true; stRef.current.lastX = e.clientX; stRef.current.lastY = e.clientY; };
  const onMM = e => {
    if (!stRef.current.dragging) return;
    const { lastX, lastY, scale, ox, oy } = stRef.current;
    stRef.current.lastX = e.clientX; stRef.current.lastY = e.clientY;
    applyTransform(scale, ox + e.clientX - lastX, oy + e.clientY - lastY);
  };
  const onMU = () => { stRef.current.dragging = false; };
  const onWheel = e => {
    e.preventDefault();
    const f  = e.deltaY > 0 ? 0.92 : 1.09;
    const ns = stRef.current.scale * f;
    const rect = canvasRef.current.getBoundingClientRect();
    applyTransform(ns,
      (e.clientX - rect.left) - (e.clientX - rect.left - stRef.current.ox) * (ns / stRef.current.scale),
      (e.clientY - rect.top)  - (e.clientY - rect.top  - stRef.current.oy) * (ns / stRef.current.scale),
    );
  };
  const onTS = e => {
    if (e.touches.length === 1) { stRef.current.dragging = true; stRef.current.lastX = e.touches[0].clientX; stRef.current.lastY = e.touches[0].clientY; }
    else if (e.touches.length === 2) { stRef.current.dragging = false; const dx=e.touches[0].clientX-e.touches[1].clientX; const dy=e.touches[0].clientY-e.touches[1].clientY; stRef.current.lastDist=Math.sqrt(dx*dx+dy*dy); }
  };
  const onTM = e => {
    e.preventDefault();
    const { scale, ox, oy, lastX, lastY } = stRef.current;
    if (e.touches.length === 1 && stRef.current.dragging) {
      stRef.current.lastX = e.touches[0].clientX; stRef.current.lastY = e.touches[0].clientY;
      applyTransform(scale, ox + e.touches[0].clientX - lastX, oy + e.touches[0].clientY - lastY);
    } else if (e.touches.length === 2) {
      const dx=e.touches[0].clientX-e.touches[1].clientX; const dy=e.touches[0].clientY-e.touches[1].clientY;
      const dist=Math.sqrt(dx*dx+dy*dy); const f=dist/stRef.current.lastDist; stRef.current.lastDist=dist;
      const rect=canvasRef.current.getBoundingClientRect();
      const mx=(e.touches[0].clientX+e.touches[1].clientX)/2-rect.left;
      const my=(e.touches[0].clientY+e.touches[1].clientY)/2-rect.top;
      const ns=scale*f;
      applyTransform(ns, mx-(mx-ox)*(ns/scale), my-(my-oy)*(ns/scale));
    }
  };
  const onTE = () => { stRef.current.dragging = false; };

  const handleConfirm = () => {
    if (!imgRef.current) return;
    setSaving(true);
    const { scale, ox, oy } = stRef.current;
    const out = document.createElement('canvas');
    out.width  = 800;
    out.height = 450;  // 16:9 landscape at target resolution
    out.getContext('2d').drawImage(imgRef.current,
      (CROPX - ox) / scale, (CROPY - oy) / scale, CROPW / scale, CROPH / scale,
      0, 0, 800, 450
    );
    onConfirm(out.toDataURL('image/jpeg', 0.78));
  };

  return (
    <div style={{ position:'fixed', inset:0, zIndex:3000, background:'#0c0c0c', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width: isMob ? '100%' : CW, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 20px', boxSizing:'border-box', flexShrink:0 }}>
        <div>
          <div style={{ color:'#fff', fontWeight:700, fontSize:15 }}>Set Batch Cover</div>
          <div style={{ color:'rgba(255,255,255,0.45)', fontSize:11, marginTop:2 }}>
            {isMob ? 'Drag to reposition · Pinch to zoom' : 'Drag to reposition · Scroll to zoom'}
          </div>
        </div>
        <button onClick={onCancel} style={{ background:'rgba(255,255,255,0.1)', border:'none', borderRadius:'50%', width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center', color:'rgba(255,255,255,0.7)', cursor:'pointer', fontSize:18, lineHeight:1, flexShrink:0 }}>✕</button>
      </div>

      {!ready && <div style={{ color:'rgba(255,255,255,0.35)', fontSize:13, padding:60 }}>Loading image…</div>}
      <canvas
        ref={canvasRef}
        width={CW} height={CH}
        style={{ display: ready ? 'block' : 'none', cursor:'grab', touchAction:'none', borderRadius: isMob ? 0 : 12, flexShrink:0 }}
        onMouseDown={onMD} onMouseMove={onMM} onMouseUp={onMU} onMouseLeave={onMU}
        onWheel={onWheel}
        onTouchStart={onTS} onTouchMove={onTM} onTouchEnd={onTE}
      />

      {ready && (
        <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:10 }}>
          <span style={{ background:'rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.55)', fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:20, letterSpacing:'.06em' }}>16 : 9</span>
          <span style={{ color:'rgba(255,255,255,0.35)', fontSize:10 }}>800 × 450 px</span>
        </div>
      )}

      <div style={{ display:'flex', gap:10, marginTop:16, paddingBottom:'max(20px, env(safe-area-inset-bottom))', flexShrink:0 }}>
        <button onClick={onCancel} style={{ padding:'10px 22px', background:'rgba(255,255,255,0.1)', border:'none', borderRadius:9, color:'#fff', fontSize:14, fontWeight:600, cursor:'pointer' }}>
          Cancel
        </button>
        <button onClick={handleConfirm} disabled={!ready || saving}
          style={{ padding:'10px 28px', background:'#7C3AED', border:'none', borderRadius:9, color:'#fff', fontSize:14, fontWeight:700, cursor: ready && !saving ? 'pointer' : 'not-allowed', opacity: ready && !saving ? 1 : 0.6 }}>
          {saving ? 'Saving…' : 'Use this photo →'}
        </button>
      </div>
    </div>
  );
}

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
  const [panelMode,      setPanelMode]      = useState("view"); // "view" | "edit" | "add"
  const [form,           setForm]           = useState(EMPTY);
  const [enrollModal,    setEnrollModal]    = useState(null);
  const [enrollSel,      setEnrollSel]      = useState([]);
  const [detailStudents, setDetailStudents] = useState([]);
  const [loadingDetail,  setLoadingDetail]  = useState(false);
  const [formSchedules,  setFormSchedules]  = useState([]);
  const [saving,         setSaving]         = useState(false);
  const [coverCropFile,  setCoverCropFile]  = useState(null);
  const coverInputRef = useRef(null);
  const PANEL_W = 440;

  // ── Responsive panel ─────────────────────────────────────────────────────
  const [windowWidth, setWindowWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    const h = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  const isMobile = windowWidth < 768;

  const { data: list=[], isLoading } = useQuery({ queryKey:["batches",sid], queryFn:()=>api.list(sid), enabled:!!sid });
  const { data: allStudents=[]     } = useQuery({ queryKey:["students",sid], queryFn:()=>studentsApi.list(sid), enabled:!!sid });
  const { data: allSchedules=[]   } = useQuery({ queryKey:["schedules",sid], queryFn:()=>schedulesApi.list(sid), enabled:!!sid });
  const { data: allRecitals=[]    } = useQuery({ queryKey:["recitals",sid],  queryFn:()=>recitalsApi.list(sid), enabled:!!sid });

  const activeBatch    = list.find(b => b.id === activeId) || null;
  const colorIndex     = activeBatch ? list.indexOf(activeBatch) : 0;
  const activeColor    = BATCH_COLORS[colorIndex % BATCH_COLORS.length];
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

  // Load students for active batch
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

  // ── Save batch + schedules ──────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    try {
      let batchId = panelMode === "edit" ? activeId : null;
      if (batchId) { await api.update(sid, batchId, form); }
      else         { const c = await api.create(sid, form); batchId = c.id; }

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
      toast.success(panelMode === "edit" ? "Batch updated" : "Batch created");
      setActiveId(batchId);
      setPanelMode("view");
    } catch (err) { toast.error(err.error || "Failed to save"); }
    finally       { setSaving(false); }
  };

  const deleteMutation = useMutation({
    mutationFn: id => api.remove(sid, id),
    onSuccess: (_,id) => { qc.invalidateQueries(["batches",sid]); toast.success("Batch deleted"); if (activeId===id) { setActiveId(null); setPanelMode("view"); } },
    onError: err => toast.error(err.error || "Failed"),
  });

  const uploadCoverMutation = useMutation({
    mutationFn: ({ id, cover_url }) => api.uploadCover(sid, id, cover_url),
    onSuccess: () => { qc.invalidateQueries(["batches",sid]); toast.success("Cover photo updated"); },
    onError:   err => toast.error(err.error || "Failed to update cover"),
  });
  const handleCoverConfirm = dataUrl => {
    uploadCoverMutation.mutate({ id: activeId, cover_url: dataUrl });
    setCoverCropFile(null);
  };
  const handleCoverRemove = () => {
    if (!activeId) return;
    uploadCoverMutation.mutate({ id: activeId, cover_url: "" });
  };

  const enrollMutation = useMutation({
    mutationFn: () => api.enroll(sid, enrollModal.id, enrollSel),
    onSuccess: () => { qc.invalidateQueries(["batches",sid]); qc.invalidateQueries(["students",sid]); toast.success("Enrolment saved"); setEnrollModal(null); refreshDetail(); },
    onError: err => toast.error(err.error || "Failed"),
  });

  const openAdd = () => {
    setForm(EMPTY);
    setFormSchedules([]);
    setActiveId(null);
    setPanelMode("add");
  };

  const openEdit = (batch) => {
    const target = batch || activeBatch;
    if (!target) return;
    const targetSchedules = allSchedules.filter(s => s.batch_id === target.id);
    setForm({ name:target.name||"", dance_style:target.dance_style||"", level:target.level||"Beginner", teacher_name:target.teacher_name||"", max_size:target.max_size||"", notes:target.notes||"" });
    setFormSchedules(targetSchedules.map(s => ({ id:s.id, day_of_week:s.day_of_week, start_time:s.start_time?.slice(0,5)||"09:00", end_time:s.end_time?.slice(0,5)||"10:00", room:s.room||"" })));
    setActiveId(target.id);
    setPanelMode("edit");
  };

  const closePanel = () => { setActiveId(null); setPanelMode("view"); };
  const openEnroll = () => { if (!activeBatch) return; setEnrollSel(detailStudents.map(s=>s.id)); setEnrollModal(activeBatch); };
  const toggleEnroll = id => setEnrollSel(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev,id]);

  const panelOpen = !!activeId || panelMode === "add";

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div style={{ paddingRight: panelOpen && !isMobile ? PANEL_W+20 : 0, transition:"padding .25s ease" }}>

      {/* ── Header ── */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20, flexWrap:"wrap", gap:10 }}>
        <div>
          <h1 style={{ fontFamily:"var(--font-d)", fontSize:24, marginBottom:2 }}>Batches</h1>
          <p style={{ color:"var(--muted)", fontSize:12 }}>{list.length} active groups</p>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center", marginLeft:"auto" }}>
          <div style={{ display:"flex", border:"1.5px solid var(--border)", borderRadius:9, overflow:"hidden" }}>
            <button onClick={() => setView("grid")}
              style={{ padding:"7px 13px", border:"none", cursor:"pointer", transition:"all .15s", display:"flex", alignItems:"center", justifyContent:"center",
                background:view==="grid" ? "var(--accent)" : "transparent", color:view==="grid" ? "#fff" : "var(--muted)" }}><SvgIcon name="grid" size={16} /></button>
            <button onClick={() => setView("table")}
              style={{ padding:"7px 13px", border:"none", borderLeft:"1.5px solid var(--border)", cursor:"pointer", transition:"all .15s", display:"flex", alignItems:"center", justifyContent:"center",
                background:view==="table" ? "var(--accent)" : "transparent", color:view==="table" ? "#fff" : "var(--muted)" }}><SvgIcon name="list" size={16} /></button>
          </div>
          <Button onClick={openAdd}>New Batch</Button>
        </div>
      </div>

      {/* ── Content ── */}
      {isLoading ? (
        <p style={{ color:"var(--muted)" }}>Loading…</p>

      ) : list.length === 0 ? (
        <Card style={{ textAlign:"center", padding:48, border:"1.5px dashed var(--border)" }}>
          <div style={{ marginBottom:12 }}><SvgIcon name="book-open" size={40} color="var(--muted)" /></div>
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
              <Card
                key={b.id}
                clickable
                onClick={() => { setActiveId(active ? null : b.id); if (!active) setPanelMode("view"); }}
                style={{
                  overflow: "hidden", display: "flex", flexDirection: "column", padding: 0,
                  // Per-batch colour accent when active (overrides Card default purple)
                  ...(active ? { border: `${CT.borderWidth} solid ${color}`, boxShadow: `0 0 0 3px ${color}22` } : {}),
                }}
              >
                {/* ── Cover thumbnail — 16:9 ── */}
                {b.cover_url ? (
                  <div style={{ position:"relative", paddingTop:"56.25%", overflow:"hidden", flexShrink:0 }}>
                    <img src={b.cover_url} alt={b.name}
                      style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover" }} />
                    <div style={{ position:"absolute", bottom:0, left:0, right:0, height:3, background:color }} />
                  </div>
                ) : (
                  <div style={{ height:4, background:color, flexShrink:0 }} />
                )}
                <div style={{ padding:"11px 16px 12px", flex: 1 }}>
                  <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:8, marginBottom:4 }}>
                    <div style={{ fontWeight:700, fontSize:15, lineHeight:1.3, color:"var(--foreground)" }}>{b.name}</div>
                    {!b.cover_url && <div style={{ width:10, height:10, borderRadius:"50%", background:color, flexShrink:0, marginTop:4 }} />}
                  </div>
                  {b.teacher_name && <div style={{ fontSize:13, color:"var(--muted)", marginBottom:12 }}>Instructor: {b.teacher_name}</div>}
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:14 }}>
                    {b.dance_style && <span style={{ fontSize:11, fontWeight:600, background:color+"18", color, borderRadius:20, padding:"3px 10px", border:`1px solid ${color}30` }}>{b.dance_style}</span>}
                    <span style={{ fontSize:11, fontWeight:600, background:"var(--surface)", color:"var(--muted)", borderRadius:20, padding:"3px 10px", border:"1px solid var(--border)" }}>{b.level}</span>
                  </div>
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
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color:"var(--muted)",flexShrink:0}}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    <span style={{ fontSize:12, color:"var(--muted)", flex:1 }}>Enrollment</span>
                    <span style={{ fontSize:12, fontWeight:700, color:"var(--foreground)" }}>
                      {b.student_count||0}{b.max_size ? `/${b.max_size}` : ""}
                    </span>
                  </div>
                  {capPct !== null && (
                    <div style={{ height:5, borderRadius:3, background:"var(--border)", overflow:"hidden", marginBottom:2 }}>
                      <div style={{ height:"100%", width:capPct+"%", background: capPct>=90 ? "#EF4444" : "var(--text)", borderRadius:3, transition:"width .3s" }} />
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>

      ) : (
        /* ── Table view ── */
        <Card variant="flat" padding={0} style={{ overflow:"hidden" }}>
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
                  <tr key={b.id} onClick={() => { setActiveId(b.id); setPanelMode("view"); }} style={{
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
                        style={{ background:"none", border:"none", cursor:"pointer", color:"var(--muted)", padding:"3px 7px", borderRadius:6, opacity:.6, display:"flex", alignItems:"center" }}><SvgIcon name="trash" size={14} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {/* ── Right Side Panel (view / edit / add) ── */}
      {panelOpen && isMobile && (
        <div onClick={closePanel}
          style={{position:"fixed",inset:0,top:56,background:"rgba(0,0,0,0.4)",zIndex:399}} />
      )}
      {panelOpen && (
        <div style={{
          position:"fixed", right:0, bottom:0, zIndex:400,
          top:    isMobile ? 56 : 0,
          width:  isMobile ? "100vw" : PANEL_W,
          left:   isMobile ? 0 : "auto",
          background:"var(--card)",
          borderLeft: isMobile ? "none" : "1.5px solid var(--border)",
          display:"flex", flexDirection:"column",
          boxShadow: isMobile ? "0 -4px 32px rgba(0,0,0,.14)" : "-6px 0 32px rgba(0,0,0,.09)",
        }}>
          {/* Panel header */}
          <div style={{ padding:"16px 20px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
            <span style={{ fontSize:11, fontWeight:700, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".08em" }}>
              {panelMode === "add" ? "New Batch" : panelMode === "edit" ? "Edit Batch" : "Batch Details"}
            </span>
            <button onClick={closePanel}
              style={{ background:"none", border:"none", cursor:"pointer", color:"var(--muted)", lineHeight:1, padding:4, borderRadius:6, display:"flex", alignItems:"center" }}><SvgIcon name="x" size={18} /></button>
          </div>

          {/* ── VIEW mode: batch hero ── */}
          {panelMode === "view" && activeBatch && (
            <div style={{ flexShrink:0, borderBottom:"1px solid var(--border)" }}>
              {activeBatch.cover_url ? (
                /* ── Has cover photo ── */
                <>
                  <div style={{ position:"relative", paddingTop:"56.25%", overflow:"hidden", background:"var(--surface)" }}>
                    <img src={activeBatch.cover_url} alt={activeBatch.name}
                      style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover" }} />
                    {/* Gradient so text is readable over the photo */}
                    <div style={{ position:"absolute", inset:0, background:"linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.08) 55%, transparent 100%)" }} />
                    {/* Batch name / badges overlay */}
                    <div style={{ position:"absolute", bottom:0, left:0, right:0, padding:"12px 16px" }}>
                      <div style={{ fontFamily:"var(--font-d)", fontSize:17, fontWeight:800, color:"#fff", marginBottom:4, textShadow:"0 1px 4px rgba(0,0,0,0.5)" }}>{activeBatch.name}</div>
                      <div style={{ display:"flex", gap:6, flexWrap:"wrap", alignItems:"center" }}>
                        <span style={{ fontSize:11, background:activeColor+"33", color:"#fff", borderRadius:20, padding:"2px 8px", fontWeight:700, backdropFilter:"blur(4px)" }}>{activeBatch.level}</span>
                        {activeBatch.dance_style && <span style={{ fontSize:12, color:"rgba(255,255,255,0.8)" }}>{activeBatch.dance_style}</span>}
                      </div>
                    </div>
                    {/* Edit cover button */}
                    <button onClick={() => coverInputRef.current?.click()}
                      style={{ position:"absolute", top:10, right:10, background:"rgba(0,0,0,0.52)", border:"1px solid rgba(255,255,255,0.18)", borderRadius:8, padding:"5px 10px", color:"rgba(255,255,255,0.88)", fontSize:11, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", gap:5, backdropFilter:"blur(4px)" }}>
                      <SvgIcon name="camera" size={12} color="rgba(255,255,255,0.88)" /> Edit
                    </button>
                  </div>
                  {/* Instructor + enrollment below cover */}
                  <div style={{ padding:"10px 18px 12px", background:"var(--surface)" }}>
                    {activeBatch.teacher_name && (
                      <div style={{ fontSize:12, color:"var(--muted)", marginBottom:6, display:"flex", alignItems:"center" }}>
                        <SvgIcon name="user" size={12} color="var(--muted)" style={{marginRight:6}} />{activeBatch.teacher_name}
                      </div>
                    )}
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <span style={{ fontSize:13, fontWeight:700, color:activeColor }}>{activeBatch.student_count||0}{activeBatch.max_size ? `/${activeBatch.max_size}` : ""}</span>
                      <span style={{ fontSize:12, color:"var(--muted)" }}>students enrolled</span>
                      {pct !== null && (
                        <div style={{ flex:1, height:5, borderRadius:3, background:"var(--border)", overflow:"hidden" }}>
                          <div style={{ height:"100%", width:pct+"%", background:pct>=90 ? "var(--danger)" : activeColor, borderRadius:3, transition:"width .3s" }} />
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                /* ── No cover photo — original info bar + Add cover button ── */
                <div style={{ padding:"18px 22px 14px", background:"var(--surface)" }}>
                  <div style={{ display:"flex", alignItems:"flex-start", gap:10, marginBottom:6 }}>
                    <div style={{ width:6, height:42, borderRadius:3, background:activeColor, flexShrink:0, marginTop:2 }} />
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontFamily:"var(--font-d)", fontSize:18, fontWeight:800, marginBottom:6 }}>{activeBatch.name}</div>
                      <div style={{ display:"flex", gap:6, flexWrap:"wrap", alignItems:"center" }}>
                        <span style={{ fontSize:11, background:activeColor+"22", color:activeColor, borderRadius:20, padding:"2px 8px", fontWeight:700 }}>{activeBatch.level}</span>
                        {activeBatch.dance_style && <span style={{ fontSize:12, color:"var(--muted)" }}>{activeBatch.dance_style}</span>}
                      </div>
                    </div>
                    <button onClick={() => coverInputRef.current?.click()}
                      style={{ flexShrink:0, background:"var(--surface)", border:"1px solid var(--border)", borderRadius:8, padding:"5px 10px", color:"var(--muted)", fontSize:11, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", gap:5 }}>
                      <SvgIcon name="camera" size={12} color="var(--muted)" /> Add cover
                    </button>
                  </div>
                  {activeBatch.teacher_name && <div style={{ fontSize:12, color:"var(--muted)", marginBottom:8, marginLeft:16, display:"flex", alignItems:"center" }}><SvgIcon name="user" size={12} color="var(--muted)" style={{marginRight:6}} />{activeBatch.teacher_name}</div>}
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
              )}
            </div>
          )}

          {/* ── VIEW mode: scrollable body ── */}
          {panelMode === "view" && activeBatch && (
            <div style={{ flex:1, overflowY:"auto", padding:"14px 18px" }}>
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
                          {s.room && <div style={{ fontSize:10, color:"var(--muted)", display:"flex", alignItems:"center" }}><SvgIcon name="map-pin" size={10} color="var(--muted)" style={{marginRight:4}} />{s.room}</div>}
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
                      <Button size="sm" variant="secondary" onClick={openEnroll}>Enrol Students</Button>
                    </div>
                  ) : (
                    <>
                      <div style={{ display:"grid", gridTemplateColumns:"1fr", gap:5, marginBottom:10 }}>
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
                      <Button size="sm" variant="ghost" onClick={openEnroll}><SvgIcon name="users" size={14} style={{marginRight:6}} /> Manage Students</Button>
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
                            {r.venue && <div style={{ fontSize:10, color:"var(--muted)", display:"flex", alignItems:"center" }}><SvgIcon name="map-pin" size={10} color="var(--muted)" style={{marginRight:4}} />{r.venue}</div>}
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
                  style={{ flex:1, padding:"9px 16px", borderRadius:9, border:"1.5px solid var(--accent)", background:"var(--accent)", color:"#fff", cursor:"pointer", fontSize:13, fontFamily:"var(--font-b)", fontWeight:600, display:"inline-flex", alignItems:"center", justifyContent:"center" }}>
                  <SvgIcon name="pencil" size={14} color="#fff" style={{marginRight:6}} /> Edit Batch
                </button>
                {activeBatch.cover_url && (
                  <button onClick={() => { if(window.confirm("Remove cover photo?")) handleCoverRemove(); }}
                    style={{ padding:"9px 12px", borderRadius:9, border:"1.5px solid var(--border)", background:"transparent", color:"var(--muted)", cursor:"pointer", fontSize:11, fontFamily:"var(--font-b)", flexShrink:0, display:"inline-flex", alignItems:"center", gap:4 }}>
                    <SvgIcon name="camera" size={13} color="var(--muted)" /> Remove cover
                  </button>
                )}
                <button onClick={() => { if(window.confirm(`Delete "${activeBatch.name}"?`)) deleteMutation.mutate(activeBatch.id); }}
                  style={{ padding:"9px 14px", borderRadius:9, border:"1.5px solid #e05c6a", background:"transparent", color:"#e05c6a", cursor:"pointer", fontSize:13, fontFamily:"var(--font-b)", flexShrink:0, display:"inline-flex", alignItems:"center", justifyContent:"center" }}><SvgIcon name="trash" size={14} color="#e05c6a" /></button>
              </div>
            </div>
          )}

          {/* ── EDIT / ADD mode: form ── */}
          {(panelMode === "edit" || panelMode === "add") && (
            <div style={{ flex:1, overflowY:"auto", padding:"20px 22px" }}>
              {/* Batch Details */}
              <div style={{ marginBottom:18 }}>
                <div style={{ fontSize:11, fontWeight:700, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".06em", marginBottom:12 }}>Batch Details</div>
                <Field label="Batch Name *">
                  <Input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="e.g. Junior Ballet" />
                </Field>
                <div style={{ display:"grid", gridTemplateColumns:"1fr", gap:"0" }}>
                  <Field label="Dance Style"><Input value={form.dance_style} onChange={e=>setForm({...form,dance_style:e.target.value})} placeholder="e.g. Ballet" /></Field>
                  <Field label="Level"><Select value={form.level} onChange={e=>setForm({...form,level:e.target.value})}>{LEVELS.map(l=><option key={l}>{l}</option>)}</Select></Field>
                  <Field label="Instructor Name"><Input value={form.teacher_name} onChange={e=>setForm({...form,teacher_name:e.target.value})} placeholder="e.g. Swapna Varma" /></Field>
                  <Field label="Max Capacity"><Input type="number" value={form.max_size} onChange={e=>setForm({...form,max_size:e.target.value})} placeholder="e.g. 12" /></Field>
                </div>
              </div>

              {/* Class Schedule */}
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
                        <div style={{ display:"flex", gap:8, alignItems:"flex-end", flexWrap:"wrap" }}>
                          <Field label="Day" style={{ flex:"0 0 130px", marginBottom:0 }}>
                            <Select value={sch.day_of_week} onChange={e=>{const u=[...formSchedules];u[idx]={...u[idx],day_of_week:e.target.value};setFormSchedules(u);}}>
                              {DAY_ORDER.map(d=><option key={d} value={d}>{DAY_FULL[d]}</option>)}
                            </Select>
                          </Field>
                          <Field label="Start" style={{ flex:"0 0 100px", marginBottom:0 }}>
                            <Select value={sch.start_time} onChange={e=>{const u=[...formSchedules];u[idx]={...u[idx],start_time:e.target.value};setFormSchedules(u);}}>
                              {TIME_SLOTS.map(t=><option key={t} value={t}>{t}</option>)}
                            </Select>
                          </Field>
                          <Field label="End" style={{ flex:"0 0 100px", marginBottom:0 }}>
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

              <div style={{ display:"flex", gap:9, marginTop:16 }}>
                <Button onClick={handleSave} disabled={!form.name||saving}>{saving ? "Saving…" : panelMode === "edit" ? "Save Changes" : "Create Batch"}</Button>
                <Button variant="secondary" onClick={() => { if (panelMode === "add") setActiveId(null); setPanelMode("view"); }}>Cancel</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Hidden cover photo file input ── */}
      <input
        ref={coverInputRef}
        type="file"
        accept="image/*"
        style={{ display:"none" }}
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) { setCoverCropFile(f); e.target.value = ""; }
        }}
      />

      {/* ── Batch cover crop modal ── */}
      {coverCropFile && (
        <BatchCoverCropModal
          file={coverCropFile}
          onConfirm={handleCoverConfirm}
          onCancel={() => setCoverCropFile(null)}
        />
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
                      background:checked ? "#c4527a11" : "var(--surface)", cursor:"pointer", transition:"all .15s" }}>
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
            <Button variant="secondary" onClick={()=>setEnrollModal(null)}>Cancel</Button>
            <Button variant="ghost" onClick={()=>setEnrollSel(allStudents.map(s=>s.id))} style={{ marginLeft:"auto" }}>Select All</Button>
            <Button variant="ghost" onClick={()=>setEnrollSel([])}>Clear</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
