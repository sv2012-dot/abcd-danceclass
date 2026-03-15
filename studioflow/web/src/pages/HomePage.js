import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { events as api, batches as batchesApi, students as studentsApi, schools, recitals as recitalApi, todos as todosApi } from "../api";
import toast from "react-hot-toast";
import Card from "../components/shared/Card";
import Button from "../components/shared/Button";
import Modal from "../components/shared/Modal";
import Badge from "../components/shared/Badge";
import { Field, Input, Select, Textarea } from "../components/shared/Field";

// ── Constants ─────────────────────────────────────────────────────────────────
const EVENT_TYPES = ["Class", "Recital", "Rehearsal", "Workshop", "Other"];
const TYPE_COLORS = {
  Class: "#6a7fdb", Recital: "#c4527a", Rehearsal: "#f4a041",
  Workshop: "#52c4a0", Other: "#8a7a9a",
};
const DAYS   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTHS = ["January","February","March","April","May","June",
                "July","August","September","October","November","December"];
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAYS_SHORT   = ["Su","Mo","Tu","We","Th","Fr","Sa"];
const LEVELS = ["Beginner","Intermediate","Advanced","Professional"];

const EMPTY_EVENT = {
  title:"", type:"Class", batch_ids:[], start_datetime:"", end_datetime:"",
  location:"", requires_studio:false, studio_booked:false,
  recurrence:"none", recurrence_end:"", color:"", notes:"",
};
const EMPTY_STUDENT = { name:"", age:"", phone:"", guardian_name:"", guardian_phone:"", enrollment_date:"", notes:"" };
const EMPTY_BATCH   = { name:"", dance_style:"", level:"Beginner", teacher_name:"", max_size:"", notes:"" };

// ── Helpers ───────────────────────────────────────────────────────────────────
const pad = n => String(n).padStart(2,"0");
function fmtTime(dt) {
  if (!dt) return "";
  return new Date(dt).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit", hour12:true });
}
function fmtDate(dt) {
  if (!dt) return "";
  return new Date(dt).toLocaleDateString([], { weekday:"short", month:"short", day:"numeric" });
}
function toLocalInput(dt) {
  if (!dt) return "";
  const d = new Date(dt);
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function startOfMonth(year, month) { return new Date(year, month, 1); }
function daysInMonth(year, month)  { return new Date(year, month+1, 0).getDate(); }

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
  const [cal, setCal]     = useState(() => { const d = parsed||new Date(); return { year:d.getFullYear(), month:d.getMonth() }; });
  const [hour, setHour]   = useState(() => parsed ? parsed.getHours() : 9);
  const [minute, setMin]  = useState(() => parsed ? Math.floor(parsed.getMinutes()/15)*15 : 0);

  useEffect(() => {
    if (!open) return;
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const emit = useCallback((y,mo,d,h,min) => onChange(`${y}-${pad(mo+1)}-${pad(d)}T${pad(h)}:${pad(min)}`), [onChange]);
  const selectDay = day => { emit(cal.year,cal.month,day,hour,minute); setTab("time"); };
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

  const today = new Date();
  const isToday    = d => d && cal.year===today.getFullYear() && cal.month===today.getMonth() && d===today.getDate();
  const isSelected = d => d && parsed && cal.year===parsed.getFullYear() && cal.month===parsed.getMonth() && d===parsed.getDate();
  const HOURS = Array.from({length:24},(_,i)=>i);
  const MINS  = [0,15,30,45];

  return (
    <div ref={ref} style={{position:"relative"}}>
      <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.07em",textTransform:"uppercase",color:"var(--muted)",marginBottom:5}}>{label}</div>
      <button type="button" onClick={()=>setOpen(p=>!p)} style={{
        width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",
        background:"#faf8fc",border:`1.5px solid ${open?"var(--accent)":"var(--border)"}`,
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
        <span style={{fontSize:14,color:"var(--muted)",flexShrink:0}}>📅</span>
      </button>
      {open && (
        <div style={{position:"absolute",top:"calc(100% + 8px)",left:0,zIndex:400,background:"#fff",borderRadius:16,boxShadow:"0 12px 40px rgba(0,0,0,0.16)",border:"1px solid var(--border)",width:300,overflow:"hidden"}}>
          <div style={{display:"flex",borderBottom:`1px solid var(--border)`}}>
            {["date","time"].map(t => (
              <button key={t} type="button" onClick={()=>setTab(t)} style={{
                flex:1,padding:"11px 0",fontSize:12,fontWeight:700,border:"none",cursor:"pointer",
                background:tab===t?"#fff":"var(--surface)",color:tab===t?"var(--accent)":"var(--muted)",
                borderBottom:tab===t?"2px solid var(--accent)":"2px solid transparent",
              }}>{t==="date"?"📅 Date":"⏰ Time"}</button>
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

// ── School Home (admin / teacher / parent) ────────────────────────────────────
function SchoolHomePage() {
  const { user, school } = useAuth();
  const sid      = user?.school_id;
  const qc       = useQueryClient();
  const navigate = useNavigate();
  const isAdmin  = ["superadmin","school_admin","teacher"].includes(user?.role);

  // Recital-type events open the full detail view directly; all others show local panel/modal
  const handleEventClick = (ev) => {
    if (ev?.type === "Recital" || ev?._isRecital) {
      // Find the matching recital record by id or title
      const match = (recitalList || []).find(r =>
        r.id === ev._recitalId || r.title === ev.title
      );
      if (match) {
        navigate('/schedule', { state: { recitalId: match.id } });
      } else {
        navigate('/schedule');
      }
      return;
    }
    setDetailEvent(ev);
  };

  // ── data ──────────────────────────────────────────────────────────────────
  const { data: stats }      = useQuery({ queryKey:["stats",sid],    queryFn:()=>schools.stats(sid),    enabled:!!sid });
  const { data: recitalList} = useQuery({ queryKey:["recitals",sid], queryFn:()=>recitalApi.list(sid),  enabled:!!sid });
  const { data: batches=[]}  = useQuery({ queryKey:["batches",sid],  queryFn:()=>batchesApi.list(sid),  enabled:!!sid });
  const { data: todosData }  = useQuery({ queryKey:["todos",sid],    queryFn:()=>todosApi.list(sid),    enabled:!!sid });

  // ── schedule state ────────────────────────────────────────────────────────
  const [view, setView]             = useState("list");
  const [today]                     = useState(new Date());
  const [cursor, setCursor]         = useState(new Date());
  const [modal, setModal]           = useState(null);
  const [form, setForm]             = useState(EMPTY_EVENT);
  const [detailEvent, setDetailEvent] = useState(null);
  const [filterType, setFilterType] = useState("All");
  const [studioOnly, setStudioOnly] = useState(false);
  const [showLegend, setShowLegend] = useState(false);

  // ── quick-add state ───────────────────────────────────────────────────────
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showAddBatch,   setShowAddBatch]   = useState(false);
  const [studentForm, setStudentForm]       = useState(EMPTY_STUDENT);
  const [batchForm,   setBatchForm]         = useState(EMPTY_BATCH);

  // ── date range for schedule fetch ─────────────────────────────────────────
  const { from, to } = useMemo(() => {
    const y=cursor.getFullYear(), m=cursor.getMonth();
    if (view==="month") return { from:new Date(y,m-1,20).toISOString(), to:new Date(y,m+2,10).toISOString() };
    const dow=cursor.getDay();
    const mon=new Date(cursor); mon.setDate(cursor.getDate()-((dow+6)%7));
    const sun=new Date(mon);    sun.setDate(mon.getDate()+6);
    return { from:mon.toISOString(), to:sun.toISOString() };
  }, [cursor, view]);

  const listFrom = useMemo(() => new Date(today.getFullYear(), today.getMonth()-1, 20).toISOString(), [today]);
  const listTo   = useMemo(() => new Date(today.getFullYear(), today.getMonth()+3, 10).toISOString(), [today]);

  const { data: rawEvents=[], isLoading } = useQuery({
    queryKey: ["events", sid, view==="list"?listFrom:from, view==="list"?listTo:to],
    queryFn:  () => api.list(sid, { from: view==="list"?listFrom:from, to: view==="list"?listTo:to }),
    enabled:  !!sid,
  });

  const events = useMemo(() => rawEvents.filter(e => {
    if (filterType!=="All" && e.type!==filterType) return false;
    if (studioOnly && !e.requires_studio) return false;
    return true;
  }), [rawEvents, filterType, studioOnly]);

  const upcoming = useMemo(() => {
    // Use local date string (YYYY-MM-DD) to avoid UTC timezone shifts
    const t = new Date();
    const todayStr = `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
    return (recitalList||[])
      .filter(r => (r.event_date||'') >= todayStr)
      .sort((a,b) => (a.event_date||'').localeCompare(b.event_date||''))
      .slice(0,3);
  }, [recitalList]);

  // ── mutations ─────────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: data => modal?.id ? api.update(sid,modal.id,data) : api.create(sid,data),
    onSuccess: () => { qc.invalidateQueries({queryKey:["events"],exact:false}); qc.invalidateQueries({queryKey:["stats",sid]}); toast.success(modal?.id?"Event updated":"Event(s) created"); setModal(null); },
    onError: err => toast.error(err.error||"Failed"),
  });
  const deleteMutation = useMutation({
    mutationFn: id => api.remove(sid,id),
    onSuccess: () => { qc.invalidateQueries({queryKey:["events"],exact:false}); qc.invalidateQueries({queryKey:["stats",sid]}); toast.success("Event deleted"); setDetailEvent(null); },
    onError: err => toast.error(err.error||"Failed"),
  });
  const addStudentMutation = useMutation({
    mutationFn: data => studentsApi.create(sid,data),
    onSuccess: () => { qc.invalidateQueries({queryKey:["students",sid]}); qc.invalidateQueries({queryKey:["stats",sid]}); toast.success("Student added!"); setShowAddStudent(false); setStudentForm(EMPTY_STUDENT); },
    onError: err => toast.error(err.error||"Failed to add student"),
  });
  const addBatchMutation = useMutation({
    mutationFn: data => batchesApi.create(sid,data),
    onSuccess: () => { qc.invalidateQueries({queryKey:["batches",sid]}); qc.invalidateQueries({queryKey:["stats",sid]}); toast.success("Batch created!"); setShowAddBatch(false); setBatchForm(EMPTY_BATCH); },
    onError: err => toast.error(err.error||"Failed to create batch"),
  });

  // ── calendar helpers ──────────────────────────────────────────────────────
  const openAdd = (prefillDate) => {
    const base = prefillDate ? new Date(prefillDate) : new Date();
    base.setMinutes(0,0,0);
    const end = new Date(base); end.setHours(base.getHours()+1);
    setForm({...EMPTY_EVENT, start_datetime:toLocalInput(base), end_datetime:toLocalInput(end)});
    setModal({});
  };
  const openEdit = e => {
    setForm({ title:e.title||"", type:e.type||"Class", batch_ids:(e.batches||[]).map(b=>b.id),
      start_datetime:toLocalInput(e.start_datetime), end_datetime:toLocalInput(e.end_datetime),
      location:e.location||"", requires_studio:!!e.requires_studio, studio_booked:!!e.studio_booked,
      recurrence:"none", recurrence_end:"", color:e.color||"", notes:e.notes||"" });
    setModal(e); setDetailEvent(null);
  };
  const navCalendar = dir => {
    const d = new Date(cursor);
    if (view==="month") d.setMonth(d.getMonth()+dir); else d.setDate(d.getDate()+dir*7);
    setCursor(d);
  };
  const calLabel = view==="month"
    ? `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`
    : (() => {
        const dow=cursor.getDay();
        const mon=new Date(cursor); mon.setDate(cursor.getDate()-((dow+6)%7));
        const sun=new Date(mon);    sun.setDate(mon.getDate()+6);
        return `${mon.toLocaleDateString([],{month:"short",day:"numeric"})} – ${sun.toLocaleDateString([],{month:"short",day:"numeric",year:"numeric"})}`;
      })();

  // ── greeting ──────────────────────────────────────────────────────────────
  const hr = new Date().getHours();
  const greeting = hr<12 ? "Good morning" : hr<17 ? "Good afternoon" : "Good evening";
  const todayStr = new Date().toLocaleDateString([],{weekday:"long",month:"long",day:"numeric",year:"numeric"});

  // ── event pill ────────────────────────────────────────────────────────────
  const EventPill = ({ event, compact }) => {
    const color = event.color || TYPE_COLORS[event.type] || "#8a7a9a";
    return (
      <div onClick={e=>{e.stopPropagation();handleEventClick(event);}} title={event.title} style={{
        background:color+"22", borderLeft:`3px solid ${color}`, borderRadius:5,
        padding:compact?"2px 5px":"4px 7px", fontSize:compact?10:11, fontWeight:600,
        color:"#1e1228", cursor:"pointer", overflow:"hidden", textOverflow:"ellipsis",
        whiteSpace:"nowrap", marginBottom:2, lineHeight:1.4, display:"flex", alignItems:"center", gap:4,
      }}>
        {event.requires_studio && <span title="Studio required">🏠</span>}
        {!event.studio_booked && event.requires_studio && <span style={{color:"#e05c6a"}}>!</span>}
        <span style={{overflow:"hidden",textOverflow:"ellipsis"}}>{compact?"":fmtTime(event.start_datetime)+" "}{event.title}</span>
      </div>
    );
  };

  // ── Month view ────────────────────────────────────────────────────────────
  const MonthView = () => {
    const y=cursor.getFullYear(), m=cursor.getMonth();
    const firstDay=startOfMonth(y,m).getDay(), totalDays=daysInMonth(y,m);
    const cells=[]; for(let i=0;i<firstDay;i++) cells.push(null); for(let d=1;d<=totalDays;d++) cells.push(d); while(cells.length%7!==0) cells.push(null);
    const eventsOnDay = day => { if(!day) return []; const ds=`${y}-${String(m+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`; return events.filter(e=>e.start_datetime?.slice(0,10)===ds); };
    const isTdy = d => d && y===today.getFullYear() && m===today.getMonth() && d===today.getDate();
    return (
      <div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:1,marginBottom:1}}>
          {DAYS.map(d=><div key={d} style={{textAlign:"center",fontSize:11,fontWeight:700,color:"var(--muted)",padding:"6px 0",letterSpacing:"0.05em"}}>{d}</div>)}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:1,background:"var(--border)",borderRadius:12,overflow:"hidden"}}>
          {cells.map((day,i)=>{
            const de=eventsOnDay(day), vis=de.slice(0,3), ov=de.length-3;
            return (
              <div key={i} onClick={()=>day&&isAdmin&&openAdd(new Date(y,m,day))} style={{background:day?"#fff":"#f8f4f9",minHeight:100,padding:"6px 5px",cursor:day&&isAdmin?"pointer":"default"}}>
                {day && <>
                  <div style={{fontSize:12,fontWeight:isTdy(day)?800:500,color:isTdy(day)?"#fff":"var(--text)",background:isTdy(day)?"var(--accent)":"transparent",width:22,height:22,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:4}}>{day}</div>
                  {vis.map(e=><EventPill key={e.id} event={e} compact />)}
                  {ov>0 && <div style={{fontSize:10,color:"var(--muted)",padding:"1px 4px"}}>+{ov} more</div>}
                </>}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ── Week view ─────────────────────────────────────────────────────────────
  const WeekView = () => {
    const dow=cursor.getDay(); const mon=new Date(cursor); mon.setDate(cursor.getDate()-((dow+6)%7));
    const weekDays=Array.from({length:7},(_,i)=>{const d=new Date(mon);d.setDate(mon.getDate()+i);return d;});
    const eventsOnDay=date=>events.filter(e=>e.start_datetime?.slice(0,10)===date.toISOString().slice(0,10)).sort((a,b)=>a.start_datetime.localeCompare(b.start_datetime));
    return (
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:12,minHeight:500}}>
        {weekDays.map((date,i)=>{
          const isTdy=date.toDateString()===today.toDateString();
          const de=eventsOnDay(date);
          return (
            <div key={i} style={{display:"flex",flexDirection:"column"}}>
              <div style={{textAlign:"center",marginBottom:12}}>
                <div style={{fontSize:11,color:"var(--muted)",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.05em"}}>{DAYS[i]}</div>
                <div style={{width:40,height:40,borderRadius:"50%",margin:"6px auto 0",background:isTdy?"var(--accent)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:isTdy?800:600,color:isTdy?"#fff":"var(--text)",border:isTdy?"none":"1px solid var(--border)"}}>{date.getDate()}</div>
              </div>
              <div onClick={()=>isAdmin&&openAdd(date)} style={{flex:1,background:"#fff",borderRadius:12,padding:10,border:"1.5px solid var(--border)",cursor:isAdmin?"pointer":"default",overflow:"auto",display:"flex",flexDirection:"column",gap:8}}>
                {de.map(e=>{
                  const color=e.color||TYPE_COLORS[e.type]||"#8a7a9a";
                  return (
                    <div key={e.id} onClick={ev=>{ev.stopPropagation();handleEventClick(e);}} style={{background:color+"15",border:`2px solid ${color}`,borderRadius:10,padding:"10px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}
                      onMouseEnter={ev=>{ev.currentTarget.style.background=color+"28";}} onMouseLeave={ev=>{ev.currentTarget.style.background=color+"15";}}>
                      <div style={{fontWeight:700,fontSize:12,marginBottom:2}}>{e.title}</div>
                      <div style={{fontSize:10,color:"var(--muted)"}}>{fmtTime(e.start_datetime)}</div>
                    </div>
                  );
                })}
                {de.length===0 && <div style={{color:"var(--muted)",fontSize:11,textAlign:"center",flex:1,display:"flex",alignItems:"center",justifyContent:"center"}}>No events</div>}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ── List view ─────────────────────────────────────────────────────────────
  const ListView = () => {
    const now = new Date();
    const future = events.filter(e => new Date(e.start_datetime) >= now).sort((a,b)=>a.start_datetime.localeCompare(b.start_datetime));
    const grouped = {};
    future.forEach(e => { const d=e.start_datetime?.slice(0,10); if(!grouped[d]) grouped[d]=[]; grouped[d].push(e); });
    const sortedDates = Object.keys(grouped).sort();
    if (!sortedDates.length) return <p style={{color:"var(--muted)",textAlign:"center",marginTop:40}}>No upcoming events. Click <strong>+ Create Event</strong> to get started.</p>;
    return (
      <div>
        {sortedDates.map(date=>(
          <div key={date} style={{marginBottom:20}}>
            <div style={{fontSize:11,fontWeight:700,color:"var(--muted)",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8,padding:"0 2px"}}>
              {new Date(date+"T12:00").toLocaleDateString([],{weekday:"long",month:"long",day:"numeric"})}
            </div>
            <div style={{display:"grid",gap:7}}>
              {grouped[date].map(e=>{
                const color=e.color||TYPE_COLORS[e.type]||"#8a7a9a";
                return (
                  <Card key={e.id} onClick={()=>handleEventClick(e)} style={{display:"flex",alignItems:"center",gap:13,padding:13,cursor:"pointer",borderLeft:`4px solid ${color}`}}>
                    <div style={{minWidth:60,textAlign:"center"}}>
                      <div style={{fontWeight:700,fontSize:13}}>{fmtTime(e.start_datetime)}</div>
                      <div style={{fontSize:10,color:"var(--muted)"}}>{fmtTime(e.end_datetime)}</div>
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:700,fontSize:13}}>{e.title}</div>
                      <div style={{fontSize:11,color:"var(--muted)",display:"flex",gap:8,flexWrap:"wrap",marginTop:2}}>
                        {(e.batches?.length?e.batches.map(b=>b.name).join(", "):e.batch_name) && <span>📚 {e.batches?.length?e.batches.map(b=>b.name).join(", "):e.batch_name}</span>}
                        {e.location && <span>📍 {e.location}</span>}
                      </div>
                    </div>
                    <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0}}>
                      <Badge color={color}>{e.type}</Badge>
                      {e.requires_studio && <Badge color={e.studio_booked?"#52c4a0":"#e05c6a"}>{e.studio_booked?"Studio ✓":"Studio ⚠"}</Badge>}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const unbookedStudio = events.filter(e=>e.requires_studio&&!e.studio_booked);

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* ── Hero greeting ──────────────────────────────────────────────── */}
      <div style={{marginBottom:22}}>
        <h1 style={{fontFamily:"var(--font-d)",fontSize:26,marginBottom:3}}>{greeting}, {user?.name?.split(" ")[0]}! 👋</h1>
        <p style={{color:"var(--muted)",fontSize:13}}>{school?.name} · {todayStr}</p>
      </div>

      {/* ── Quick actions ───────────────────────────────────────────────── */}
      {isAdmin && (
        <div style={{display:"flex",gap:10,marginBottom:28,flexWrap:"wrap",justifyContent:"flex-end"}}>
          {[
            { label:"+ Add Student",   icon:"👤", color:"#c4527a", bg:"#c4527a12", border:"#c4527a33", action:()=>setShowAddStudent(true) },
            { label:"+ Create Batch",  icon:"📚", color:"#6a7fdb", bg:"#6a7fdb12", border:"#6a7fdb33", action:()=>setShowAddBatch(true)   },
            { label:"+ Create Event",  icon:"📅", color:"#52c4a0", bg:"#52c4a012", border:"#52c4a033", action:()=>openAdd()                },
          ].map(({label,color,bg,border,action})=>(
            <button key={label} onClick={action} style={{
              display:"flex",alignItems:"center",gap:8,
              padding:"11px 20px",borderRadius:12,border:`1.5px solid ${border}`,
              background:bg,color,fontWeight:700,fontSize:13,cursor:"pointer",
              transition:"all .15s",
            }}
              onMouseEnter={e=>{e.currentTarget.style.background=color+"22";e.currentTarget.style.transform="translateY(-1px)";e.currentTarget.style.boxShadow=`0 4px 12px ${color}33`;}}
              onMouseLeave={e=>{e.currentTarget.style.background=bg;e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="none";}}
            >{label}</button>
          ))}
        </div>
      )}

      {/* ── Upcoming recitals strip ─────────────────────────────────────── */}
      {upcoming.length > 0 && (
        <div style={{marginBottom:28}}>
          <div style={{fontSize:12,fontWeight:700,color:"var(--muted)",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:10}}>🌟 Upcoming Recitals</div>
          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
            {upcoming.map(r => {
              // Parse YYYY-MM-DD as local date (avoid UTC midnight shift)
              const [yr, mo, dy] = (r.event_date||'').split('-').map(Number);
              const d = new Date(yr, mo - 1, dy);
              return (
                <div key={r.id} onClick={()=>navigate("/schedule", { state: { recitalId: r.id } })} style={{
                  display:"flex",alignItems:"center",gap:12,padding:"10px 16px",
                  background:"#fff",borderRadius:12,border:"1.5px solid var(--border)",
                  cursor:"pointer",minWidth:200,flex:"1 1 200px",maxWidth:320,
                  transition:"all .15s",
                }}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor="#c4527a55";e.currentTarget.style.boxShadow="0 4px 12px #c4527a15";}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border)";e.currentTarget.style.boxShadow="none";}}
                >
                  <div style={{textAlign:"center",minWidth:44,background:"#c4527a15",borderRadius:10,padding:"6px 8px"}}>
                    <div style={{fontSize:18,fontWeight:800,color:"#c4527a",fontFamily:"var(--font-d)",lineHeight:1}}>{d.getDate()}</div>
                    <div style={{fontSize:9,color:"var(--muted)",textTransform:"uppercase",fontWeight:700}}>{d.toLocaleString("default",{month:"short"})}</div>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.title}</div>
                    <div style={{color:"var(--muted)",fontSize:11,marginTop:2}}>{r.venue}</div>
                  </div>
                  <Badge>{r.status}</Badge>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Recent To-Dos widget ────────────────────────────────────────── */}
      {(() => {
        const allTodos = todosData?.data?.todos || [];
        const openTodos = allTodos
          .filter(t => !t.is_complete)
          .sort((a,b) => new Date(b.created_at) - new Date(a.created_at))
          .slice(0,5);
        if (!openTodos.length) return null;
        const fmtDue = (d) => {
          if (!d) return null;
          const [y,m,dy] = d.split('-').map(Number);
          return new Date(y,m-1,dy).toLocaleDateString([],{month:'short',day:'numeric'});
        };
        const overdue = (d) => {
          if (!d) return false;
          const [y,m,dy] = d.split('-').map(Number);
          const due = new Date(y,m-1,dy);
          const now = new Date(); now.setHours(0,0,0,0);
          return due < now;
        };
        return (
          <div style={{marginBottom:28}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
              <div style={{fontSize:12,fontWeight:700,color:"var(--muted)",textTransform:"uppercase",letterSpacing:"0.07em"}}>
                ✅ Recent To-Dos
              </div>
              <button onClick={()=>navigate('/todos')} style={{background:'none',border:'none',cursor:'pointer',fontSize:12,color:'var(--accent)',fontWeight:600}}>
                View all →
              </button>
            </div>
            <div>
              {openTodos.map(todo => {
                const od = overdue(todo.due_date);
                return (
                  <div key={todo.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',background:'#fff',borderRadius:10,border:'1px solid var(--border)',marginBottom:6}}>
                    <div
                      onClick={()=>{ qc.setQueryData(["todos",sid], old => { if (!old?.data?.todos) return old; return {...old, data:{todos:old.data.todos.map(t=>t.id===todo.id?{...t,is_complete:1}:t)}}; }); todosApi.toggle(sid,todo.id).then(()=>qc.invalidateQueries(["todos",sid])); }}
                      style={{width:20,height:20,borderRadius:'50%',border:'2px solid #d2d2d7',background:'#fff',cursor:'pointer',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}
                    />
                    <div style={{flex:1,fontSize:14,color:'#1d1d1f',fontWeight:500}}>{todo.title}</div>
                    {todo.due_date && (
                      <span style={{fontSize:11,color:od?'#ff3b30':'#6e6e73',background:od?'#fff0ee':'#f5f5f7',padding:'2px 8px',borderRadius:999,fontWeight:600}}>
                        {fmtDue(todo.due_date)}
                      </span>
                    )}
                    <button
                      onClick={()=>{ todosApi.remove(sid,todo.id).then(()=>qc.invalidateQueries(["todos",sid])); }}
                      style={{background:'none',border:'none',cursor:'pointer',color:'#c7c7cc',padding:4,display:'flex',alignItems:'center'}}
                      onMouseEnter={e=>{e.currentTarget.style.color='#ff3b30';}}
                      onMouseLeave={e=>{e.currentTarget.style.color='#c7c7cc';}}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3,6 5,6 21,6"/><path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a1,1,0,0,1,1-1h4a1,1,0,0,1,1,1v2"/></svg>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── Schedule section ────────────────────────────────────────────── */}
      <div style={{borderTop:"2px solid var(--border)",paddingTop:24}}>
        {/* Header */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:10}}>
          <div>
            <h2 style={{fontFamily:"var(--font-d)",fontSize:20,marginBottom:2}}>📅 Upcoming Events</h2>
            {isAdmin && <p style={{color:"var(--muted)",fontSize:12}}>Click any day to add an event</p>}
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginLeft:"auto"}}>
            {["month","week","list"].map(v=>(
              <button key={v} onClick={()=>setView(v)} style={{
                padding:"6px 14px",borderRadius:8,border:"1.5px solid var(--border)",fontSize:12,fontWeight:600,cursor:"pointer",
                background:v===view?"var(--accent)":"#fff",color:v===view?"#fff":"var(--text)",
              }}>{v.charAt(0).toUpperCase()+v.slice(1)}</button>
            ))}
            {isAdmin && <Button onClick={()=>openAdd()} icon="➕" size="sm">Add Event</Button>}
          </div>
        </div>

        {/* Filters */}
        <div style={{display:"flex",gap:8,marginBottom:14,alignItems:"center",flexWrap:"wrap"}}>
          {["All",...EVENT_TYPES].map(t=>{
            const color=TYPE_COLORS[t]||"var(--muted)"; const active=filterType===t;
            return <button key={t} onClick={()=>setFilterType(t)} style={{padding:"4px 12px",borderRadius:20,border:`1.5px solid ${active?color:"var(--border)"}`,fontSize:11,fontWeight:700,cursor:"pointer",background:active?color+"22":"transparent",color:active?color:"var(--muted)"}}>{t}</button>;
          })}
          <button onClick={()=>setStudioOnly(!studioOnly)} style={{padding:"4px 12px",borderRadius:20,fontSize:11,fontWeight:700,cursor:"pointer",border:`1.5px solid ${studioOnly?"#e05c6a":"var(--border)"}`,background:studioOnly?"#e05c6a22":"transparent",color:studioOnly?"#e05c6a":"var(--muted)"}}>🏠 Studio needed</button>
          <div style={{position:"relative",marginLeft:4}}>
            <button onClick={()=>setShowLegend(p=>!p)} style={{background:"none",border:"none",fontSize:11,fontWeight:600,color:"var(--muted)",cursor:"pointer",textDecoration:"underline",textDecorationStyle:"dotted",padding:"4px 2px"}}>colour guide</button>
            {showLegend && (
              <>
                <div onClick={()=>setShowLegend(false)} style={{position:"fixed",inset:0,zIndex:99}} />
                <div style={{position:"absolute",top:"calc(100% + 8px)",left:0,zIndex:100,background:"#fff",borderRadius:12,padding:14,width:200,boxShadow:"0 8px 32px rgba(0,0,0,0.14)",border:"1px solid var(--border)"}}>
                  <div style={{fontWeight:700,fontSize:11,marginBottom:9,color:"var(--text)"}}>Event Types</div>
                  {EVENT_TYPES.map(t=>(
                    <div key={t} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                      <div style={{width:10,height:10,borderRadius:3,background:TYPE_COLORS[t],flexShrink:0}} />
                      <span style={{fontSize:12,color:"var(--text)"}}>{t}</span>
                    </div>
                  ))}
                  <div style={{borderTop:"1px solid var(--border)",marginTop:9,paddingTop:9}}>
                    <div style={{fontSize:11,color:"var(--muted)",marginBottom:3}}>🏠 = Studio required</div>
                    <div style={{fontSize:11,color:"#e05c6a"}}>🏠! = Not yet booked</div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Navigation (month/week only) */}
        {view !== "list" && (
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
            <button onClick={()=>navCalendar(-1)} style={{background:"var(--surface)",border:"none",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:16}}>‹</button>
            <span style={{fontFamily:"var(--font-d)",fontSize:16,fontWeight:700,minWidth:200,textAlign:"center"}}>{calLabel}</span>
            <button onClick={()=>navCalendar(1)} style={{background:"var(--surface)",border:"none",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:16}}>›</button>
            <button onClick={()=>setCursor(new Date())} style={{background:"var(--surface)",border:"none",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:12,fontWeight:600,color:"var(--muted)"}}>Today</button>
          </div>
        )}

        {isLoading ? <p style={{color:"var(--muted)"}}>Loading…</p>
          : view==="month" ? <MonthView />
          : view==="week"  ? <WeekView />
          : <ListView />
        }

        {/* Studio alerts */}
        {unbookedStudio.length > 0 && (
          <div style={{marginTop:18,padding:"12px 16px",borderRadius:12,background:"#e05c6a08",border:"1.5px solid #e05c6a33",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
            <span style={{fontWeight:700,fontSize:12,color:"#e05c6a",flexShrink:0}}>⚠ Studio not booked:</span>
            <div style={{display:"flex",gap:7,flexWrap:"wrap",flex:1}}>
              {unbookedStudio.map(e=>(
                <div key={e.id} onClick={()=>handleEventClick(e)} style={{fontSize:11,cursor:"pointer",padding:"4px 10px",borderRadius:20,background:"#fff",border:"1px solid #e05c6a44",fontWeight:600,color:"#e05c6a"}}>
                  {e.title} · <span style={{fontWeight:400,color:"var(--muted)"}}>{fmtDate(e.start_datetime)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Quick Add Student Modal ─────────────────────────────────────── */}
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

      {/* ── Quick Add Batch Modal ───────────────────────────────────────── */}
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

      {/* ── Add/Edit Event Modal ────────────────────────────────────────── */}
      {modal !== null && (
        <Modal title={modal.id?"Edit Event":"New Event"} onClose={()=>setModal(null)} wide>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
            <Field label="Title *" style={{gridColumn:"1/-1"}}><Input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="e.g. Junior Ballet Class" style={{width:"100%"}} /></Field>
            <Field label="Event Type"><Select value={form.type} onChange={e=>setForm({...form,type:e.target.value})}>{EVENT_TYPES.map(t=><option key={t}>{t}</option>)}</Select></Field>
            <div style={{gridColumn:"1/-1"}}>
              <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.07em",textTransform:"uppercase",color:"var(--muted)",marginBottom:6}}>Batches (optional)</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
                {batches.map(b=>{
                  const checked=form.batch_ids.includes(b.id)||form.batch_ids.includes(String(b.id));
                  return (
                    <button key={b.id} type="button" onClick={()=>setForm(f=>({...f,batch_ids:checked?f.batch_ids.filter(x=>x!==b.id&&x!==String(b.id)):[...f.batch_ids,b.id]}))} style={{display:"inline-flex",alignItems:"center",gap:6,padding:"5px 13px",borderRadius:20,cursor:"pointer",fontSize:12,fontWeight:700,border:`1.5px solid ${checked?"#6a7fdb":"var(--border)"}`,background:checked?"#6a7fdb22":"transparent",color:checked?"#6a7fdb":"var(--muted)"}}>
                      {checked&&<span>✓</span>}{b.name}
                    </button>
                  );
                })}
                {batches.length===0 && <span style={{fontSize:12,color:"var(--muted)"}}>No batches yet</span>}
              </div>
            </div>
            <DateTimePicker label="Start *" value={form.start_datetime} onChange={v=>setForm({...form,start_datetime:v})} />
            <DateTimePicker label="End *"   value={form.end_datetime}   onChange={v=>setForm({...form,end_datetime:v})} />
            <Field label="Location / Room"><Input value={form.location} onChange={e=>setForm({...form,location:e.target.value})} placeholder="e.g. Studio A" /></Field>
            <Field label="Repeat"><Select value={form.recurrence} onChange={e=>setForm({...form,recurrence:e.target.value})} disabled={!!modal.id}><option value="none">No repeat</option><option value="weekly">Weekly</option><option value="biweekly">Every 2 weeks</option></Select></Field>
            {form.recurrence!=="none" && !modal.id && <DateTimePicker label="Repeat Until" value={form.recurrence_end?form.recurrence_end+"T00:00":""} onChange={v=>setForm({...form,recurrence_end:v.slice(0,10)})} />}
          </div>
          <div style={{display:"flex",gap:16,margin:"10px 0",padding:12,background:"var(--surface)",borderRadius:10}}>
            <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:13}}>
              <input type="checkbox" checked={form.requires_studio} onChange={e=>setForm({...form,requires_studio:e.target.checked})} style={{width:16,height:16,accentColor:"var(--accent)"}} />
              <span>🏠 Requires studio booking</span>
            </label>
            {form.requires_studio && (
              <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:13}}>
                <input type="checkbox" checked={form.studio_booked} onChange={e=>setForm({...form,studio_booked:e.target.checked})} style={{width:16,height:16,accentColor:"#52c4a0"}} />
                <span style={{color:"#52c4a0",fontWeight:600}}>✓ Studio confirmed</span>
              </label>
            )}
          </div>
          <Field label="Notes"><Textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} /></Field>
          <div style={{display:"flex",gap:9,marginTop:8}}>
            <Button onClick={()=>saveMutation.mutate(form)} disabled={!form.title||!form.start_datetime||!form.end_datetime||saveMutation.isPending}>
              {saveMutation.isPending?"Saving…":modal.id?"Save Changes":form.recurrence!=="none"?"Create Recurring Events":"Create Event"}
            </Button>
            <Button variant="outline" onClick={()=>setModal(null)}>Cancel</Button>
          </div>
        </Modal>
      )}

      {/* ── Event Detail Modal ──────────────────────────────────────────── */}
      {detailEvent && (
        <Modal title={detailEvent.title} onClose={()=>setDetailEvent(null)}>
          {(()=>{
            const e=detailEvent; const color=e.color||TYPE_COLORS[e.type]||"#8a7a9a";
            return (
              <div>
                <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
                  <Badge color={color}>{e.type}</Badge>
                  {e.requires_studio && <Badge color={e.studio_booked?"#52c4a0":"#e05c6a"}>{e.studio_booked?"Studio ✓ Booked":"Studio ⚠ Not Booked"}</Badge>}
                </div>
                <div style={{display:"grid",gap:8,marginBottom:16}}>
                  <DetailRow icon="📅" label="Date">{fmtDate(e.start_datetime)}</DetailRow>
                  <DetailRow icon="⏰" label="Time">{fmtTime(e.start_datetime)} – {fmtTime(e.end_datetime)}</DetailRow>
                  {(e.batches?.length>0||e.batch_name) && (
                    <DetailRow icon="📚" label={`Batch${(e.batches?.length||0)>1?"es":""}`}>
                      <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                        {(e.batches?.length?e.batches:[{id:e.batch_id,name:e.batch_name}]).map(b=>(
                          <button key={b.id} type="button" onClick={()=>{setDetailEvent(null);navigate("/batches");}} style={{display:"inline-flex",alignItems:"center",gap:5,background:"#6a7fdb15",border:"1.5px solid #6a7fdb44",borderRadius:20,padding:"4px 13px",cursor:"pointer",fontSize:12,fontWeight:700,color:"#6a7fdb"}}>
                            {b.name}<span style={{fontSize:10,opacity:0.5}}>→</span>
                          </button>
                        ))}
                      </div>
                    </DetailRow>
                  )}
                  {e.location && <DetailRow icon="📍" label="Location">{e.location}</DetailRow>}
                  {e.notes    && <DetailRow icon="📝" label="Notes">{e.notes}</DetailRow>}
                </div>
                {isAdmin && (
                  <div style={{display:"flex",gap:8,paddingTop:12,borderTop:"1px solid var(--border)"}}>
                    <Button size="sm" variant="outline" onClick={()=>openEdit(e)}>✏ Edit</Button>
                    <Button size="sm" variant="danger" onClick={()=>{if(window.confirm("Delete this event?")) deleteMutation.mutate(e.id);}}>🗑 Delete</Button>
                    {e.requires_studio&&!e.studio_booked && (
                      <Button size="sm" variant="ghost" style={{marginLeft:"auto",color:"#52c4a0"}}
                        onClick={()=>{ api.update(sid,e.id,{...e,studio_booked:true}).then(()=>{ qc.invalidateQueries({queryKey:["events"],exact:false}); setDetailEvent({...e,studio_booked:true}); toast.success("Studio marked as booked!"); }); }}>
                        Mark Studio Booked ✓
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
        </Modal>
      )}
    </div>
  );
}

// ── Super Admin Dashboard ─────────────────────────────────────────────────────
function SuperAdminDash() {
  const { data: schoolList } = useQuery({ queryKey:["schools"], queryFn:()=>import("../api").then(m=>m.schools.list()) });
  return (
    <div>
      <h1 style={{fontFamily:"var(--font-d)",fontSize:26,marginBottom:4}}>Super Admin Dashboard</h1>
      <p style={{color:"var(--muted)",marginBottom:24,fontSize:13}}>Manage all schools on the platform</p>
      <h2 style={{fontFamily:"var(--font-d)",fontSize:17,marginBottom:12}}>All Schools</h2>
      <div style={{display:"grid",gap:9}}>
        {(schoolList||[]).map(s=>(
          <Card key={s.id} style={{display:"flex",alignItems:"center",gap:14,padding:14}}>
            <div style={{width:40,height:40,borderRadius:"50%",background:`hsl(${s.name.charCodeAt(0)*7%360},55%,68%)`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,color:"#fff",fontSize:16,flexShrink:0}}>{s.name[0]}</div>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:14}}>{s.name}</div>
              <div style={{color:"var(--muted)",fontSize:12}}>{s.owner_name} · {s.city} · {s.dance_style}</div>
            </div>
            <div style={{fontSize:12,color:"var(--muted)"}}>{s.student_count} students · {s.batch_count} batches</div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function DetailRow({ icon, label, children }) {
  return (
    <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
      <span style={{fontSize:14,flexShrink:0,width:20}}>{icon}</span>
      <span style={{fontSize:11,fontWeight:700,color:"var(--muted)",minWidth:60,paddingTop:1}}>{label}</span>
      <span style={{fontSize:13,color:"var(--text)"}}>{children}</span>
    </div>
  );
}
