import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { events as api, batches as batchesApi, students as studentsApi, schools, recitals as recitalApi, todos as todosApi } from "../api";
import toast from "react-hot-toast";
import Button from "../components/shared/Button";
import Modal from "../components/shared/Modal";
import Badge from "../components/shared/Badge";
import { Field, Input, Select, Textarea } from "../components/shared/Field";
import SvgIcon from "../components/shared/SvgIcon";

// ── Constants ─────────────────────────────────────────────────────────────────
const EVENT_TYPES = ["Class", "Recital", "Rehearsal", "Workshop", "Other"];
const TYPE_COLORS = {
  Class: "#6a7fdb", Recital: "#c4527a", Rehearsal: "#f4a041",
  Workshop: "#52c4a0", Other: "#8a7a9a",
};
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAYS_SHORT   = ["Su","Mo","Tu","We","Th","Fr","Sa"];
const LEVELS = ["Beginner","Intermediate","Advanced","Professional"];

const EMPTY_EVENT = {
  title:"", type:"Class", batch_ids:[], start_datetime:"", end_datetime:"", duration:60,
  location:"", requires_studio:false, studio_booked:false,
  recurrence:"none", recurrence_end:"", color:"", notes:"",
};

const DURATION_OPTIONS = [
  { value:15,  label:"15 min" },
  { value:30,  label:"30 min" },
  { value:45,  label:"45 min" },
  { value:60,  label:"1 hr" },
  { value:75,  label:"1 hr 15 min" },
  { value:90,  label:"1 hr 30 min" },
  { value:120, label:"2 hr" },
  { value:150, label:"2 hr 30 min" },
  { value:180, label:"3 hr" },
  { value:240, label:"4 hr" },
];

function computeEndFromDuration(startStr, durationMins) {
  if (!startStr || !durationMins) return "";
  const s = new Date(startStr);
  if (isNaN(s)) return "";
  const pad = n => String(n).padStart(2,"0");
  const e = new Date(s.getTime() + Number(durationMins) * 60000);
  return `${e.getFullYear()}-${pad(e.getMonth()+1)}-${pad(e.getDate())}T${pad(e.getHours())}:${pad(e.getMinutes())}`;
}
const EMPTY_STUDENT = { name:"", age:"", phone:"", guardian_name:"", guardian_phone:"", enrollment_date:"", notes:"" };
const EMPTY_BATCH   = { name:"", dance_style:"", level:"Beginner", teacher_name:"", max_size:"", notes:"" };

// ── Helpers ───────────────────────────────────────────────────────────────────
const pad = n => String(n).padStart(2,"0");
function fmtTime(dt) {
  if (!dt) return "";
  return new Date(dt).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit", hour12:true });
}
function toLocalInput(dt) {
  if (!dt) return "";
  const d = new Date(dt);
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
// Parse a YYYY-MM-DD string as local midnight (avoids UTC shift from mysql2 ISO serialization)
function parseLocalDate(str) {
  const s = (str || "").slice(0, 10);
  const [y, m, d] = s.split("-").map(Number);
  return (y && m && d) ? new Date(y, m - 1, d) : new Date(NaN);
}

// ── DateTimePicker ────────────────────────────────────────────────────────────
function DateTimePicker({ label, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab]   = useState("date");
  const ref = useRef(null);
  const parsed = useMemo(() => { if (!value) return null; const d = new Date(value); return isNaN(d)?null:d; }, [value]);
  const displayVal = useMemo(() => {
    if (!parsed) return null;
    return {
      date: parsed.toLocaleDateString([], { weekday:"short", month:"short", day:"numeric", year:"numeric" }),
      time: parsed.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit", hour12:true }),
    };
  }, [parsed]);
  const [cal, setCal]  = useState(() => { const d = parsed||new Date(); return { year:d.getFullYear(), month:d.getMonth() }; });
  const [hour, setHour] = useState(() => parsed ? parsed.getHours() : 9);
  const [minute, setMin] = useState(() => parsed ? Math.floor(parsed.getMinutes()/15)*15 : 0);

  useEffect(() => {
    if (!open) return;
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const emit = useCallback((y,mo,d,h,min) => onChange(`${y}-${pad(mo+1)}-${pad(d)}T${pad(h)}:${pad(min)}`), [onChange]);
  const selectDay  = day => { emit(cal.year,cal.month,day,hour,minute); setTab("time"); };
  const selectTime = (h,m) => {
    setHour(h); setMin(m);
    if (parsed) emit(parsed.getFullYear(),parsed.getMonth(),parsed.getDate(),h,m);
    else { const t=new Date(); emit(cal.year,cal.month,t.getDate(),h,m); }
  };

  const firstDow = new Date(cal.year,cal.month,1).getDay();
  const dim      = new Date(cal.year,cal.month+1,0).getDate();
  const cells    = [];
  for (let i=0;i<firstDow;i++) cells.push(null);
  for (let d=1;d<=dim;d++) cells.push(d);
  while (cells.length%7!==0) cells.push(null);

  const today      = new Date();
  const isToday    = d => d && cal.year===today.getFullYear() && cal.month===today.getMonth() && d===today.getDate();
  const isSelected = d => d && parsed && cal.year===parsed.getFullYear() && cal.month===parsed.getMonth() && d===parsed.getDate();
  const HOURS = Array.from({length:24},(_,i)=>i);
  const MINS  = [0,15,30,45];

  return (
    <div ref={ref} style={{position:"relative"}}>
      <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.07em",textTransform:"uppercase",color:"var(--muted)",marginBottom:5}}>{label}</div>
      <button type="button" onClick={()=>setOpen(p=>!p)} style={{
        width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",
        background:"var(--surface)",border:`1.5px solid ${open?"var(--accent)":"var(--border)"}`,
        borderRadius:9,padding:"9px 13px",cursor:"pointer",
        boxShadow:open?"0 0 0 3px rgba(196,82,122,0.1)":"none",transition:"all .15s",textAlign:"left",
      }}>
        {displayVal
          ? <div style={{display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:13,fontWeight:600,color:"var(--text)"}}>{displayVal.date}</span>
              <span style={{fontSize:12,color:"var(--muted)",background:"var(--surface)",padding:"2px 8px",borderRadius:6,fontWeight:600}}>{displayVal.time}</span>
            </div>
          : <span style={{fontSize:13,color:"var(--muted)"}}>Pick date & time…</span>
        }
        <SvgIcon name="calendar" size={14} color="var(--muted)" style={{flexShrink:0}} />
      </button>
      {open && (
        <div style={{position:"absolute",top:"calc(100% + 8px)",left:0,zIndex:400,background:"var(--card)",borderRadius:16,boxShadow:"0 12px 40px rgba(0,0,0,0.16)",border:"1px solid var(--border)",width:300,overflow:"hidden"}}>
          <div style={{display:"flex",borderBottom:`1px solid var(--border)`}}>
            {["date","time"].map(t => (
              <button key={t} type="button" onClick={()=>setTab(t)} style={{
                flex:1,padding:"11px 0",fontSize:12,fontWeight:700,border:"none",cursor:"pointer",
                background:tab===t?"var(--card)":"var(--surface)",color:tab===t?"var(--accent)":"var(--muted)",
                borderBottom:tab===t?"2px solid var(--accent)":"2px solid transparent",
              }}>{t==="date"?"Date":"Time"}</button>
            ))}
          </div>
          {tab==="date" && (
            <div style={{padding:14}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                <button type="button" onClick={()=>setCal(c=>c.month===0?{year:c.year-1,month:11}:{...c,month:c.month-1})} style={{background:"var(--surface)",border:"none",borderRadius:7,padding:"5px 10px",cursor:"pointer",fontSize:14}}>‹</button>
                <span style={{fontWeight:700,fontSize:13}}>{MONTHS_SHORT[cal.month]} {cal.year}</span>
                <button type="button" onClick={()=>setCal(c=>c.month===11?{year:c.year+1,month:0}:{...c,month:c.month+1})} style={{background:"var(--surface)",border:"none",borderRadius:7,padding:"5px 10px",cursor:"pointer",fontSize:14}}>›</button>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",marginBottom:4}}>
                {DAYS_SHORT.map(d=><div key={d} style={{textAlign:"center",fontSize:10,fontWeight:700,color:"var(--muted)",padding:"2px 0"}}>{d}</div>)}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
                {cells.map((day,i) => (
                  <button key={i} type="button" disabled={!day} onClick={()=>day&&selectDay(day)} style={{
                    padding:"6px 0",textAlign:"center",fontSize:12,fontWeight:500,border:"none",cursor:day?"pointer":"default",borderRadius:8,
                    background:isSelected(day)?"var(--accent)":isToday(day)?"var(--surface)":"transparent",
                    color:isSelected(day)?"#fff":isToday(day)?"var(--accent)":day?"var(--text)":"transparent",
                    fontWeight:isToday(day)||isSelected(day)?700:500,
                  }}>{day||""}</button>
                ))}
              </div>
            </div>
          )}
          {tab==="time" && (
            <div style={{padding:14}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,maxHeight:220,overflow:"hidden"}}>
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:"var(--muted)",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>Hour</div>
                  <div style={{maxHeight:190,overflowY:"auto",display:"grid",gap:2}}>
                    {HOURS.map(h => {
                      const lbl = h===0?"12 AM":h<12?`${h} AM`:h===12?"12 PM":`${h-12} PM`;
                      return <button key={h} type="button" onClick={()=>selectTime(h,minute)} style={{padding:"5px 8px",borderRadius:6,border:"none",cursor:"pointer",fontSize:12,fontWeight:600,textAlign:"left",background:hour===h?"var(--accent)":"transparent",color:hour===h?"#fff":"var(--text)"}}>{lbl}</button>;
                    })}
                  </div>
                </div>
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:"var(--muted)",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>Minute</div>
                  <div style={{display:"grid",gap:2}}>
                    {MINS.map(m => <button key={m} type="button" onClick={()=>selectTime(hour,m)} style={{padding:"5px 8px",borderRadius:6,border:"none",cursor:"pointer",fontSize:12,fontWeight:600,textAlign:"left",background:minute===m?"var(--accent)":"transparent",color:minute===m?"#fff":"var(--text)"}}>:{String(m).padStart(2,"0")}</button>)}
                  </div>
                </div>
              </div>
            </div>
          )}
          <div style={{borderTop:`1px solid var(--border)`,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontSize:12,color:"var(--muted)",fontWeight:500}}>{displayVal?`${displayVal.date} ${displayVal.time}`:"No date selected"}</span>
            <button type="button" onClick={()=>setOpen(false)} style={{background:"var(--accent)",color:"#fff",border:"none",borderRadius:8,padding:"6px 16px",fontSize:12,fontWeight:700,cursor:"pointer"}}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function HomePage() {
  const { user } = useAuth();
  if (user?.role === "superadmin") return <SuperAdminDash />;
  return <SchoolHomePage />;
}

// ── School Home ───────────────────────────────────────────────────────────────
function SchoolHomePage() {
  const { user, school } = useAuth();
  const sid      = user?.school_id;
  const qc       = useQueryClient();
  const navigate = useNavigate();
  const isAdmin  = ["superadmin","school_admin","teacher"].includes(user?.role);

  // ── data ──────────────────────────────────────────────────────────────────
  const { data: stats }      = useQuery({ queryKey:["stats",sid],    queryFn:()=>schools.stats(sid),   enabled:!!sid, staleTime:0 });
  const { data: recitalList} = useQuery({ queryKey:["recitals",sid], queryFn:()=>recitalApi.list(sid), enabled:!!sid });
  const { data: batches=[]}  = useQuery({ queryKey:["batches",sid],  queryFn:()=>batchesApi.list(sid), enabled:!!sid });
  const { data: todosData }  = useQuery({ queryKey:["todos",sid],    queryFn:()=>todosApi.list(sid),   enabled:!!sid });

  const [today] = useState(new Date());
  const listFrom = useMemo(() => new Date(today.getFullYear(), today.getMonth() - 1, 20).toISOString(), [today]);
  const listTo   = useMemo(() => new Date(today.getFullYear(), today.getMonth() + 3, 10).toISOString(), [today]);
  const { data: rawEvents=[] } = useQuery({
    queryKey: ["events", sid, listFrom, listTo],
    queryFn:  () => api.list(sid, { from: listFrom, to: listTo }),
    enabled:  !!sid,
  });

  // ── responsive ────────────────────────────────────────────────────────────
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  useEffect(() => {
    const h = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  const isMobile = windowWidth < 768;

  // ── modal state ───────────────────────────────────────────────────────────
  const [modal, setModal]           = useState(null);
  const [form, setForm]             = useState(EMPTY_EVENT);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showAddBatch,   setShowAddBatch]   = useState(false);
  const [showAddRecital, setShowAddRecital] = useState(false);
  const [studentForm, setStudentForm]       = useState(EMPTY_STUDENT);
  const [batchForm,   setBatchForm]         = useState(EMPTY_BATCH);
  const [recitalForm, setRecitalForm]       = useState({ title:'', event_date:'', event_time:'', venue:'', description:'' });
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const createMenuRef = useRef(null);

  useEffect(() => {
    if (!createMenuOpen) return;
    const handler = (e) => { if (createMenuRef.current && !createMenuRef.current.contains(e.target)) setCreateMenuOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [createMenuOpen]);

  // ── derived data ──────────────────────────────────────────────────────────
  const upcoming = useMemo(() => {
    const t = new Date();
    const todayStr = `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,"0")}-${String(t.getDate()).padStart(2,"0")}`;
    return (recitalList||[])
      .filter(r => (r.event_date||"").slice(0,10) >= todayStr)
      .sort((a,b) => (a.event_date||"").slice(0,10).localeCompare((b.event_date||"").slice(0,10)))
      .slice(0,3);
  }, [recitalList]);

  const upcomingClasses = useMemo(() => {
    const now = new Date();
    return (rawEvents||[])
      .filter(e => new Date(e.start_datetime) >= now && e.type !== "Recital")
      .sort((a,b) => a.start_datetime.localeCompare(b.start_datetime))
      .slice(0,3);
  }, [rawEvents]);

  // ── mutations ─────────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: data => modal?.id ? api.update(sid,modal.id,data) : api.create(sid,data),
    onSuccess: () => {
      qc.invalidateQueries({queryKey:["events"],exact:false});
      qc.invalidateQueries({queryKey:["stats",sid]});
      toast.success(modal?.id ? "Event updated" : "Event(s) created");
      setModal(null);
    },
    onError: err => toast.error(err.error||"Failed"),
  });
  const addStudentMutation = useMutation({
    mutationFn: data => studentsApi.create(sid,data),
    onSuccess: () => {
      qc.invalidateQueries({queryKey:["students",sid]});
      qc.invalidateQueries({queryKey:["stats",sid]});
      toast.success("Student added!");
      setShowAddStudent(false); setStudentForm(EMPTY_STUDENT);
    },
    onError: err => toast.error(err.error||"Failed to add student"),
  });
  const addBatchMutation = useMutation({
    mutationFn: data => batchesApi.create(sid,data),
    onSuccess: () => {
      qc.invalidateQueries({queryKey:["batches",sid]});
      qc.invalidateQueries({queryKey:["stats",sid]});
      toast.success("Batch created!");
      setShowAddBatch(false); setBatchForm(EMPTY_BATCH);
    },
    onError: err => toast.error(err.error||"Failed to create batch"),
  });
  const recitalSaveMutation = useMutation({
    mutationFn: data => recitalApi.create(sid, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey:["recitals",sid] });
      qc.invalidateQueries({ queryKey:["stats",sid] });
      toast.success("Recital created!");
      setShowAddRecital(false);
      setRecitalForm({ title:'', event_date:'', event_time:'', venue:'', description:'' });
    },
    onError: err => toast.error(err.error||"Failed to create recital"),
  });

  const openAdd = () => {
    const base = new Date(); base.setMinutes(0,0,0);
    const end  = new Date(base); end.setHours(base.getHours()+1);
    setForm({...EMPTY_EVENT, start_datetime:toLocalInput(base), end_datetime:toLocalInput(end), duration:60});
    setModal({});
  };

  // ── greeting ──────────────────────────────────────────────────────────────
  const hr       = new Date().getHours();
  const greeting = hr<12 ? "Good morning" : hr<17 ? "Good afternoon" : "Good evening";
  const todayStr = new Date().toLocaleDateString([],{weekday:"long",month:"long",day:"numeric",year:"numeric"});

  // ── render ────────────────────────────────────────────────────────────────
  const allTodos  = todosData?.todos || [];
  const openTodos = allTodos.filter(t => !t.is_complete).sort((a,b) => new Date(b.created_at)-new Date(a.created_at)).slice(0,5);
  const fmtDue    = str => { if (!str) return null; const d = parseLocalDate(str); return isNaN(d) ? null : d.toLocaleDateString([],{month:"short",day:"numeric"}); };
  const isOverdue = str => { if (!str) return false; const due = parseLocalDate(str); const now = new Date(); now.setHours(0,0,0,0); return !isNaN(due) && due < now; };

  // ── stats block (reused on desktop-top and mobile-bottom) ────────────────
  const statsBlock = stats ? (
    <div style={{display:"flex",gap:10,flexWrap:"wrap",justifyContent:isMobile?"stretch":"flex-end"}}>
      {[
        { label:"Students", value:stats.students??stats.student_count, color:"#c4527a", path:"/students",
          icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
        { label:"Batches",  value:stats.batches??stats.batch_count,    color:"#6a7fdb", path:"/batches",
          icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> },
        { label:"Recitals", value:stats.upcoming_recitals,             color:"#f4a041", path:"/schedule",
          icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
      ].map(({label,value,color,path,icon}) => (
        <div key={label} onClick={()=>navigate(path)} style={{
          background:"var(--card)",borderRadius:14,padding:"14px 18px",
          border:"1.5px solid var(--border)",textAlign:"center",minWidth:isMobile?0:90,flex:isMobile?"1":"0 0 auto",
          cursor:"pointer",transition:"all .15s",display:"flex",flexDirection:"column",alignItems:"center",gap:4,
        }}
          onMouseEnter={e=>{e.currentTarget.style.borderColor=color+"55";e.currentTarget.style.boxShadow=`0 4px 14px ${color}18`;e.currentTarget.style.transform="translateY(-1px)";}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border)";e.currentTarget.style.boxShadow="none";e.currentTarget.style.transform="none";}}
        >
          <div style={{color:"var(--muted)"}}>{icon}</div>
          <div style={{fontSize:24,fontWeight:800,color,fontFamily:"var(--font-d)",lineHeight:1}}>{value||0}</div>
          <div style={{fontSize:10,color:"var(--muted)",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em"}}>{label}</div>
        </div>
      ))}
    </div>
  ) : null;

  return (
    <div>

      {/* ── Top row: greeting (left) + stat cards right (desktop only) ── */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:isMobile?12:24,gap:20,flexWrap:"wrap"}}>
        <div>
          <h1 style={{fontFamily:"var(--font-d)",fontSize:26,marginBottom:3,lineHeight:1.15}}>
            {greeting}, {user?.name?.split(" ")[0]}!
          </h1>
          <p style={{color:"var(--muted)",fontSize:13}}>{school?.name} · {todayStr}</p>
        </div>
        {!isMobile && statsBlock}
      </div>

      {/* ── Mobile: consolidated Create button ── */}
      {isMobile && isAdmin && (
        <div ref={createMenuRef} style={{position:"relative",marginBottom:20}}>
          <button onClick={()=>setCreateMenuOpen(o=>!o)} style={{
            width:"100%",padding:"12px 18px",borderRadius:12,border:"1.5px solid var(--accent)",
            background:"var(--accent)",color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer",
            display:"flex",alignItems:"center",justifyContent:"center",gap:8,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Create New
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{marginLeft:2,transition:"transform .2s",transform:createMenuOpen?"rotate(180deg)":"none"}}><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          {createMenuOpen && (
            <div style={{position:"absolute",top:"calc(100% + 8px)",left:0,right:0,background:"var(--card)",border:"1.5px solid var(--border)",borderRadius:12,boxShadow:"0 8px 24px rgba(0,0,0,.15)",zIndex:200,overflow:"hidden"}}>
              {[
                { label:"Create Event",   color:"#52c4a0", action:()=>{ openAdd(); setCreateMenuOpen(false); } },
                { label:"Create Recital", color:"#c4527a", action:()=>{ setShowAddRecital(true); setCreateMenuOpen(false); } },
                { label:"Add Student",    color:"#6a7fdb", action:()=>{ setShowAddStudent(true); setCreateMenuOpen(false); } },
              ].map(({label,color,action}) => (
                <button key={label} onClick={action} style={{
                  width:"100%",padding:"13px 18px",background:"transparent",border:"none",
                  borderBottom:"1px solid var(--border)",color:"var(--text)",fontSize:14,fontWeight:600,
                  cursor:"pointer",display:"flex",alignItems:"center",gap:10,textAlign:"left",
                }}
                  onMouseEnter={e=>{e.currentTarget.style.background="var(--surface)";}}
                  onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}
                >
                  <span style={{width:8,height:8,borderRadius:"50%",background:color,display:"inline-block",flexShrink:0}} />
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Desktop: Quick action buttons ── */}
      {!isMobile && isAdmin && (
        <div style={{display:"flex",gap:10,marginBottom:28,flexWrap:"wrap"}}>
          {[
            { label:"+ Add Student",    color:"#c4527a", bg:"#c4527a12", border:"#c4527a33", action:()=>setShowAddStudent(true) },
            { label:"+ Create Batch",   color:"#6a7fdb", bg:"#6a7fdb12", border:"#6a7fdb33", action:()=>setShowAddBatch(true)   },
            { label:"+ Create Event",   color:"#52c4a0", bg:"#52c4a012", border:"#52c4a033", action:openAdd                     },
            { label:"+ Create Recital", color:"#c4527a", bg:"#c4527a12", border:"#c4527a33", action:()=>setShowAddRecital(true)  },
            { label:"View Schedule →",  color:"#8a7a9a", bg:"#8a7a9a12", border:"#8a7a9a33", action:()=>navigate("/schedule")   },
          ].map(({label,color,bg,border,action}) => (
            <button key={label} onClick={action} style={{
              padding:"9px 18px",borderRadius:22,border:`1.5px solid ${border}`,
              background:bg,color,fontWeight:700,fontSize:13,cursor:"pointer",transition:"all .15s",
            }}
              onMouseEnter={e=>{e.currentTarget.style.background=color+"22";e.currentTarget.style.boxShadow=`0 4px 12px ${color}33`;}}
              onMouseLeave={e=>{e.currentTarget.style.background=bg;e.currentTarget.style.boxShadow="none";}}
            >{label}</button>
          ))}
        </div>
      )}

      {/* ── 3-column widget grid ── */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:20}}>

        {/* Upcoming Recitals */}
        <div style={{background:"var(--card)",borderRadius:14,border:"1.5px solid var(--border)",overflow:"hidden",display:"flex",flexDirection:"column"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"13px 18px 11px",borderBottom:"1px solid var(--border)"}}>
            <div style={{fontSize:10,fontWeight:700,color:"var(--muted)",textTransform:"uppercase",letterSpacing:".1em",display:"flex",alignItems:"center"}}><SvgIcon name="star" size={13} color="var(--muted)" style={{marginRight:5}} /> Upcoming Recitals</div>
            <button onClick={()=>navigate("/schedule")} style={{background:"none",border:"none",cursor:"pointer",fontSize:12,color:"var(--accent)",fontWeight:600,padding:0}}>View all →</button>
          </div>
          {upcoming.length === 0
            ? <div style={{padding:"28px 18px",color:"var(--muted)",fontSize:13,textAlign:"center"}}>No upcoming recitals</div>
            : upcoming.map(r => {
                const d = parseLocalDate(r.event_date);
                const tod = new Date(); tod.setHours(0,0,0,0);
                const ed = parseLocalDate(r.event_date); ed.setHours(0,0,0,0);
                const diff = Math.round((ed - tod) / 86400000);
                const daysLabel = diff === 0 ? 'Today!' : diff === 1 ? 'Tomorrow' : diff > 0 ? `${diff}d to go` : `${Math.abs(diff)}d ago`;
                const daysColor = diff <= 7 ? '#e05c6a' : diff <= 30 ? '#f4a041' : '#52c4a0';
                return (
                  <div key={r.id} onClick={()=>navigate("/schedule",{state:{recitalId:r.id}})}
                    style={{display:"flex",alignItems:"center",gap:12,padding:"11px 18px",borderBottom:"1px solid var(--border)",cursor:"pointer",transition:"background .1s"}}
                    onMouseEnter={e=>{e.currentTarget.style.background="var(--surface)";}}
                    onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}
                  >
                    <div style={{textAlign:"center",minWidth:44,background:"#c4527a15",borderRadius:10,padding:"6px 5px",flexShrink:0}}>
                      <div style={{fontSize:18,fontWeight:800,color:"#c4527a",fontFamily:"var(--font-d)",lineHeight:1}}>{isNaN(d)?"—":d.getDate()}</div>
                      <div style={{fontSize:9,color:"#c4527a",textTransform:"uppercase",fontWeight:700,marginTop:1}}>{isNaN(d)?"":d.toLocaleString("default",{month:"short"})}</div>
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:700,fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.title}</div>
                      <div style={{color:"var(--muted)",fontSize:11,marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.venue||"—"}</div>
                    </div>
                    <span style={{fontSize:11,fontWeight:700,color:daysColor,background:daysColor+"18",borderRadius:20,padding:"3px 9px",whiteSpace:"nowrap",flexShrink:0}}>{daysLabel}</span>
                  </div>
                );
              })
          }
        </div>

        {/* Upcoming Classes */}
        <div style={{background:"var(--card)",borderRadius:14,border:"1.5px solid var(--border)",overflow:"hidden",display:"flex",flexDirection:"column"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"13px 18px 11px",borderBottom:"1px solid var(--border)"}}>
            <div style={{fontSize:10,fontWeight:700,color:"var(--muted)",textTransform:"uppercase",letterSpacing:".1em",display:"flex",alignItems:"center"}}><SvgIcon name="calendar" size={13} color="var(--muted)" style={{marginRight:5}} /> Upcoming Classes</div>
            <button onClick={()=>navigate("/schedule")} style={{background:"none",border:"none",cursor:"pointer",fontSize:12,color:"var(--accent)",fontWeight:600,padding:0}}>View all →</button>
          </div>
          {upcomingClasses.length === 0
            ? <div style={{padding:"28px 18px",color:"var(--muted)",fontSize:13,textAlign:"center"}}>No upcoming events</div>
            : upcomingClasses.map(e => {
                const color = e.color || TYPE_COLORS[e.type] || "#8a7a9a";
                const d     = parseLocalDate((e.start_datetime||"").slice(0,10));
                return (
                  <div key={e.id} onClick={()=>navigate("/schedule")}
                    style={{display:"flex",alignItems:"center",gap:12,padding:"11px 18px",borderBottom:"1px solid var(--border)",cursor:"pointer",transition:"background .1s"}}
                    onMouseEnter={ev=>{ev.currentTarget.style.background="var(--surface)";}}
                    onMouseLeave={ev=>{ev.currentTarget.style.background="transparent";}}
                  >
                    <div style={{textAlign:"center",minWidth:44,background:color+"18",borderRadius:10,padding:"6px 5px",flexShrink:0}}>
                      <div style={{fontSize:18,fontWeight:800,color,fontFamily:"var(--font-d)",lineHeight:1}}>{isNaN(d)?"—":d.getDate()}</div>
                      <div style={{fontSize:9,color,textTransform:"uppercase",fontWeight:700,marginTop:1}}>{isNaN(d)?"":d.toLocaleString("default",{month:"short"})}</div>
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:700,fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.title}</div>
                      <div style={{color:"var(--muted)",fontSize:11,marginTop:1}}>{fmtTime(e.start_datetime)}{e.location?" · "+e.location:""}</div>
                    </div>
                    <Badge color={color}>{e.type}</Badge>
                  </div>
                );
              })
          }
        </div>

        {/* Open To-Dos */}
        <div style={{background:"var(--card)",borderRadius:14,border:"1.5px solid var(--border)",overflow:"hidden",display:"flex",flexDirection:"column"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"13px 18px 11px",borderBottom:"1px solid var(--border)"}}>
            <div style={{fontSize:10,fontWeight:700,color:"var(--muted)",textTransform:"uppercase",letterSpacing:".1em",display:"flex",alignItems:"center"}}><SvgIcon name="check-circle" size={13} color="var(--muted)" style={{marginRight:5}} /> Open To-Dos</div>
            <button onClick={()=>navigate("/todos")} style={{background:"none",border:"none",cursor:"pointer",fontSize:12,color:"var(--accent)",fontWeight:600,padding:0}}>View all →</button>
          </div>
          {openTodos.length === 0
            ? <div style={{padding:"20px 18px",color:"var(--muted)",fontSize:13,textAlign:"center"}}>All caught up!</div>
            : openTodos.map((todo,idx) => {
                const od = isOverdue(todo.due_date);
                return (
                  <div key={todo.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 16px",borderBottom:"1px solid var(--border)"}}>
                    <div onClick={()=>{
                        qc.setQueryData(["todos",sid], old => { if (!old?.todos) return old; return {...old,todos:old.todos.map(t=>t.id===todo.id?{...t,is_complete:1}:t)}; });
                        todosApi.toggle(sid,todo.id).then(()=>qc.invalidateQueries(["todos",sid]));
                      }}
                      style={{width:18,height:18,borderRadius:"50%",border:"2px solid var(--border)",background:"transparent",cursor:"pointer",flexShrink:0,transition:"all .15s"}}
                      onMouseEnter={e=>{e.currentTarget.style.borderColor="#52c4a0";e.currentTarget.style.background="#52c4a015";}}
                      onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border)";e.currentTarget.style.background="transparent";}}
                    />
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{todo.title}</div>
                      <div style={{display:"flex",gap:6,marginTop:3,flexWrap:"wrap",alignItems:"center"}}>
                        <span style={{fontSize:11,fontWeight:600,color:todo.assigned_to?"var(--text)":"var(--muted)",background:"var(--surface)",padding:"1px 7px",borderRadius:999,display:"inline-flex",alignItems:"center"}}>
                          <SvgIcon name="user" size={11} style={{marginRight:3}} /> {todo.assigned_to||"Not assigned"}
                        </span>
                        {(todo.event_title||todo.recital_title) && (
                          <span style={{fontSize:11,color:"var(--muted)"}}>
                            {todo.recital_title?todo.recital_title:todo.event_title}
                          </span>
                        )}
                      </div>
                    </div>
                    {todo.due_date && (
                      <span style={{fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius:999,flexShrink:0,color:od?"#ff3b30":"var(--muted)",background:od?"#fff0ee":"var(--surface)",display:"inline-flex",alignItems:"center"}}>
                        {od && <SvgIcon name="alert-triangle" size={11} color="#ff3b30" style={{marginRight:3}} />}{fmtDue(todo.due_date)}
                      </span>
                    )}
                    <button onClick={()=>todosApi.remove(sid,todo.id).then(()=>qc.invalidateQueries(["todos",sid]))}
                      style={{background:"none",border:"none",cursor:"pointer",color:"#c7c7cc",padding:4,display:"flex",alignItems:"center",flexShrink:0,transition:"color .15s"}}
                      onMouseEnter={e=>{e.currentTarget.style.color="#ff3b30";}} onMouseLeave={e=>{e.currentTarget.style.color="#c7c7cc";}}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3,6 5,6 21,6"/><path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a1,1,0,0,1,1-1h4a1,1,0,0,1,1,1v2"/></svg>
                    </button>
                  </div>
                );
              })
          }
          <div style={{padding:"10px 16px",borderTop:"1px solid var(--border)"}}>
            <button onClick={()=>navigate("/todos")} style={{background:"none",border:"none",cursor:"pointer",fontSize:12,color:"var(--accent)",fontWeight:600,padding:0}}>+ Add to-do</button>
          </div>
        </div>

      </div>

      {/* ── Mobile: stats at bottom ── */}
      {isMobile && stats && (
        <div style={{marginTop:24}}>
          <div style={{fontSize:10,fontWeight:700,color:"var(--muted)",textTransform:"uppercase",letterSpacing:".1em",marginBottom:10}}>Studio Overview</div>
          {statsBlock}
        </div>
      )}

      {/* ── Add Student Modal ────────────────────────────────────────────── */}
      {showAddStudent && (
        <Modal title="Add Student" onClose={()=>{setShowAddStudent(false);setStudentForm(EMPTY_STUDENT);}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
            <Field label="Full Name *" style={{gridColumn:"1/-1"}}><Input value={studentForm.name} onChange={e=>setStudentForm({...studentForm,name:e.target.value})} placeholder="e.g. Aanya Patel" /></Field>
            <Field label="Age"><Input type="number" value={studentForm.age} onChange={e=>setStudentForm({...studentForm,age:e.target.value})} placeholder="e.g. 10" /></Field>
            <Field label="Phone"><Input value={studentForm.phone} onChange={e=>setStudentForm({...studentForm,phone:e.target.value})} placeholder="e.g. 212-555-0101" /></Field>
            <Field label="Guardian Name"><Input value={studentForm.guardian_name} onChange={e=>setStudentForm({...studentForm,guardian_name:e.target.value})} placeholder="e.g. Meera Patel" /></Field>
            <Field label="Guardian Phone"><Input value={studentForm.guardian_phone} onChange={e=>setStudentForm({...studentForm,guardian_phone:e.target.value})} placeholder="e.g. 212-555-0100" /></Field>
            <Field label="Enrollment Date" style={{gridColumn:"1/-1"}}><Input type="date" value={studentForm.enrollment_date} onChange={e=>setStudentForm({...studentForm,enrollment_date:e.target.value})} /></Field>
            <Field label="Notes" style={{gridColumn:"1/-1"}}><Textarea value={studentForm.notes} onChange={e=>setStudentForm({...studentForm,notes:e.target.value})} placeholder="Any additional notes…" /></Field>
          </div>
          <div style={{display:"flex",gap:9,marginTop:8}}>
            <Button onClick={()=>addStudentMutation.mutate(studentForm)} disabled={!studentForm.name||addStudentMutation.isPending}>
              {addStudentMutation.isPending?"Saving…":"Add Student"}
            </Button>
            <Button variant="outline" onClick={()=>{setShowAddStudent(false);setStudentForm(EMPTY_STUDENT);}}>Cancel</Button>
            <Button variant="ghost" style={{marginLeft:"auto"}} onClick={()=>{setShowAddStudent(false);navigate("/students");}}>Go to Students →</Button>
          </div>
        </Modal>
      )}

      {/* ── Add Batch Modal ──────────────────────────────────────────────── */}
      {showAddBatch && (
        <Modal title="Create Batch" onClose={()=>{setShowAddBatch(false);setBatchForm(EMPTY_BATCH);}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
            <Field label="Batch Name *" style={{gridColumn:"1/-1"}}><Input value={batchForm.name} onChange={e=>setBatchForm({...batchForm,name:e.target.value})} placeholder="e.g. Junior Ballet" /></Field>
            <Field label="Dance Style"><Input value={batchForm.dance_style} onChange={e=>setBatchForm({...batchForm,dance_style:e.target.value})} placeholder="e.g. Ballet" /></Field>
            <Field label="Level"><Select value={batchForm.level} onChange={e=>setBatchForm({...batchForm,level:e.target.value})}>{LEVELS.map(l=><option key={l}>{l}</option>)}</Select></Field>
            <Field label="Instructor"><Input value={batchForm.teacher_name} onChange={e=>setBatchForm({...batchForm,teacher_name:e.target.value})} placeholder="e.g. Swapna Varma" /></Field>
            <Field label="Max Capacity"><Input type="number" value={batchForm.max_size} onChange={e=>setBatchForm({...batchForm,max_size:e.target.value})} placeholder="e.g. 12" /></Field>
            <Field label="Notes" style={{gridColumn:"1/-1"}}><Textarea value={batchForm.notes} onChange={e=>setBatchForm({...batchForm,notes:e.target.value})} placeholder="Any additional notes…" /></Field>
          </div>
          <div style={{display:"flex",gap:9,marginTop:8}}>
            <Button onClick={()=>addBatchMutation.mutate(batchForm)} disabled={!batchForm.name||addBatchMutation.isPending}>
              {addBatchMutation.isPending?"Saving…":"Create Batch"}
            </Button>
            <Button variant="outline" onClick={()=>{setShowAddBatch(false);setBatchForm(EMPTY_BATCH);}}>Cancel</Button>
            <Button variant="ghost" style={{marginLeft:"auto"}} onClick={()=>{setShowAddBatch(false);navigate("/batches");}}>Go to Batches →</Button>
          </div>
        </Modal>
      )}

      {/* ── Add Recital Modal ───────────────────────────────────────────── */}
      {showAddRecital && (
        <Modal title="New Recital" onClose={()=>{setShowAddRecital(false);setRecitalForm({title:'',event_date:'',event_time:'',venue:'',description:''});}}>
          <div style={{height:4,background:"linear-gradient(90deg,#c4527a,#e8607a)",borderRadius:4,marginBottom:16}} />
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
            <Field label="Recital Title *" style={{gridColumn:"1/-1"}}><Input value={recitalForm.title} onChange={e=>setRecitalForm({...recitalForm,title:e.target.value})} placeholder="e.g. Spring Showcase 2026" /></Field>
            <Field label="Date *"><Input type="date" value={recitalForm.event_date} onChange={e=>setRecitalForm({...recitalForm,event_date:e.target.value})} /></Field>
            <Field label="Time"><Input type="time" value={recitalForm.event_time} onChange={e=>setRecitalForm({...recitalForm,event_time:e.target.value})} /></Field>
            <Field label="Venue" style={{gridColumn:"1/-1"}}><Input value={recitalForm.venue} onChange={e=>setRecitalForm({...recitalForm,venue:e.target.value})} placeholder="e.g. Riverside Auditorium" /></Field>
            <Field label="Notes" style={{gridColumn:"1/-1"}}><Textarea value={recitalForm.description} onChange={e=>setRecitalForm({...recitalForm,description:e.target.value})} placeholder="Any notes about the recital…" /></Field>
          </div>
          <div style={{display:"flex",gap:9,marginTop:8}}>
            <Button onClick={()=>recitalSaveMutation.mutate(recitalForm)} disabled={!recitalForm.title||!recitalForm.event_date||recitalSaveMutation.isPending} style={{background:"#c4527a",borderColor:"#c4527a"}}>
              {recitalSaveMutation.isPending?"Creating…":"Create Recital"}
            </Button>
            <Button variant="outline" onClick={()=>{setShowAddRecital(false);setRecitalForm({title:'',event_date:'',event_time:'',venue:'',description:''});}}>Cancel</Button>
          </div>
        </Modal>
      )}

      {/* ── Add Event Modal ──────────────────────────────────────────────── */}
      {modal !== null && (
        <Modal title={modal.id ? "Edit Event" : "New Event"} onClose={()=>setModal(null)} wide>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
            <Field label="Title *" style={{gridColumn:"1/-1"}}><Input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="e.g. Junior Ballet Class" /></Field>
            <Field label="Event Type"><Select value={form.type} onChange={e=>setForm({...form,type:e.target.value})}>{EVENT_TYPES.map(t=><option key={t}>{t}</option>)}</Select></Field>
            <div style={{gridColumn:"1/-1"}}>
              <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.07em",textTransform:"uppercase",color:"var(--muted)",marginBottom:6}}>Batches (optional)</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
                {batches.map(b => {
                  const checked = form.batch_ids.includes(b.id)||form.batch_ids.includes(String(b.id));
                  return (
                    <button key={b.id} type="button" onClick={()=>setForm(f=>({...f,batch_ids:checked?f.batch_ids.filter(x=>x!==b.id&&x!==String(b.id)):[...f.batch_ids,b.id]}))} style={{display:"inline-flex",alignItems:"center",gap:6,padding:"5px 13px",borderRadius:20,cursor:"pointer",fontSize:12,fontWeight:700,border:`1.5px solid ${checked?"#6a7fdb":"var(--border)"}`,background:checked?"#6a7fdb22":"transparent",color:checked?"#6a7fdb":"var(--muted)"}}>
                      {checked&&<span>✓</span>}{b.name}
                    </button>
                  );
                })}
                {batches.length===0 && <span style={{fontSize:12,color:"var(--muted)"}}>No batches yet</span>}
              </div>
            </div>
            <DateTimePicker label="Start *" value={form.start_datetime} onChange={v=>setForm(f=>({...f,start_datetime:v,end_datetime:computeEndFromDuration(v,f.duration)}))} />
            <Field label="Duration">
              <Select value={form.duration} onChange={e=>{ const d=Number(e.target.value); setForm(f=>({...f,duration:d,end_datetime:computeEndFromDuration(f.start_datetime,d)})); }}>
                {DURATION_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </Field>
            <Field label="Location / Room" style={{gridColumn:"1/-1"}}><Input value={form.location} onChange={e=>setForm({...form,location:e.target.value})} placeholder="e.g. Studio A" /></Field>
            <Field label="Repeat">
              <Select value={form.recurrence} onChange={e=>setForm({...form,recurrence:e.target.value})} disabled={!!modal.id}>
                <option value="none">No repeat</option>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Every 2 weeks</option>
              </Select>
            </Field>
            {form.recurrence!=="none" && !modal.id && (
              <DateTimePicker label="Repeat Until" value={form.recurrence_end?form.recurrence_end+"T00:00":""} onChange={v=>setForm({...form,recurrence_end:v.slice(0,10)})} />
            )}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:12,margin:"10px 0",padding:12,background:"var(--surface)",borderRadius:10}}>
            <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:13}}>
              <input type="checkbox" checked={form.requires_studio} onChange={e=>setForm({...form,requires_studio:e.target.checked})} style={{width:16,height:16,accentColor:"var(--accent)"}} />
              <span style={{display:"inline-flex",alignItems:"center",gap:6}}><SvgIcon name="home" size={14} style={{marginRight:6}} /> Studio required</span>
            </label>
            {form.requires_studio && (
              <span style={{fontSize:12,color:"var(--muted)"}}>Studio booking status can be updated after saving.</span>
            )}
          </div>
          <Field label="Notes"><Textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} /></Field>
          <div style={{display:"flex",gap:9,marginTop:8}}>
            <Button onClick={()=>saveMutation.mutate(form)} disabled={!form.title||!form.start_datetime||saveMutation.isPending}>
              {saveMutation.isPending?"Saving…":modal.id?"Save Changes":form.recurrence!=="none"?"Create Recurring Events":"Create Event"}
            </Button>
            <Button variant="outline" onClick={()=>setModal(null)}>Cancel</Button>
          </div>
        </Modal>
      )}

    </div>
  );
}

// ── Super Admin Dashboard ─────────────────────────────────────────────────────
function SuperAdminDash() {
  const navigate = useNavigate();
  const { data: schoolList } = useQuery({ queryKey:["schools"], queryFn:()=>import("../api").then(m=>m.schools.list()) });
  return (
    <div>
      <h1 style={{fontFamily:"var(--font-d)",fontSize:26,marginBottom:4}}>Super Admin Dashboard</h1>
      <p style={{color:"var(--muted)",marginBottom:24,fontSize:13}}>Manage all schools on the platform</p>
      <h2 style={{fontFamily:"var(--font-d)",fontSize:17,marginBottom:12}}>All Schools</h2>
      <div style={{display:"grid",gap:9}}>
        {(schoolList||[]).map(s => (
          <div key={s.id} onClick={()=>navigate("/schools")} style={{
            display:"flex",alignItems:"center",gap:14,padding:14,background:"var(--card)",
            borderRadius:12,border:"1.5px solid var(--border)",cursor:"pointer",transition:"all .15s",
          }}
            onMouseEnter={e=>{e.currentTarget.style.borderColor="#c4527a44";e.currentTarget.style.boxShadow="0 4px 12px #c4527a10";}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border)";e.currentTarget.style.boxShadow="none";}}
          >
            <div style={{width:40,height:40,borderRadius:"50%",background:`hsl(${s.name.charCodeAt(0)*7%360},55%,68%)`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,color:"#fff",fontSize:16,flexShrink:0}}>{s.name[0]}</div>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:14}}>{s.name}</div>
              <div style={{color:"var(--muted)",fontSize:12}}>{s.owner_name} · {s.city} · {s.dance_style}</div>
            </div>
            <div style={{fontSize:12,color:"var(--muted)"}}>{s.student_count} students · {s.batch_count} batches</div>
          </div>
        ))}
      </div>
    </div>
  );
}
