import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { events as api, batches as batchesApi, students as studentsApi, schools, recitals as recitalApi, todos as todosApi } from "../api";
import toast from "react-hot-toast";
import Button, { BTN_GRAD } from "../components/shared/Button";
import Card from "../components/shared/Card";
import Modal from "../components/shared/Modal";
import Badge from "../components/shared/Badge";
import { Field, Input, Select, Textarea } from "../components/shared/Field";
import SvgIcon from "../components/shared/SvgIcon";
import { TodoKeyframeStyles, TodoRow } from "../components/shared/TodoItem";

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  ebony:        'var(--text)',
  boulder:      'var(--muted)',
  grayChate:    'var(--muted)',
  accentPurple: '#7C3AED',
  accentMagenta:'#DC4EFF',
  accentGrad:   BTN_GRAD,
  white:        'var(--card)',
  bg:           'var(--background)',
  surface:      'var(--surface)',
  border:       'var(--border)',
  createBtn:    'rgba(124,58,237,0.10)',
  createBtnHov: 'rgba(124,58,237,0.18)',
};

// ── Time options: 15-min increments for recital forms ─────────────────────────
const TIME_OPTIONS = (() => {
  const opts = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 15, 30, 45]) {
      const val = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
      const period = h < 12 ? 'AM' : 'PM';
      const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      opts.push({ val, label: `${h12}:${String(m).padStart(2,'0')} ${period}` });
    }
  }
  return opts;
})();

// ── Constants ─────────────────────────────────────────────────────────────────
const EVENT_TYPES = ["Class", "Recital", "Rehearsal", "Workshop", "Other"];
const TYPE_COLORS = {
  Class: "#6a7fdb", Recital: "#c4527a", Rehearsal: "#f4a041",
  Workshop: "#52c4a0", Other: "#8a7a9a",
};
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAYS_SHORT   = ["Mo","Tu","We","Th","Fr","Sa","Su"];
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
const supportsHover = () => window.matchMedia('(hover: hover)').matches;
const conditionalHover = (onEnter, onLeave) => supportsHover()
  ? { onMouseEnter: onEnter, onMouseLeave: onLeave }
  : {};
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
  const [hour, setHour] = useState(() => parsed ? parsed.getHours() : 18);
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

  const dow = new Date(cal.year,cal.month,1).getDay();
  const firstDow = dow === 0 ? 6 : dow - 1;
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
        <div style={{position:"absolute",top:"calc(100% + 8px)",left:0,zIndex:400,background:"var(--card)",borderRadius:16,boxShadow:"0 12px 40px rgba(0,0,0,0.16)",border:"1px solid var(--border)",width:"min(300px,calc(100vw - 20px))",maxWidth:300,overflow:"hidden"}}>
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
            <div style={{padding:"10px 10px"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8,gap:4}}>
                <button type="button" onClick={()=>setCal(c=>c.month===0?{year:c.year-1,month:11}:{...c,month:c.month-1})} style={{background:"var(--surface)",border:"none",borderRadius:6,padding:"4px 8px",cursor:"pointer",fontSize:13,flex:0.5}}>‹</button>
                <span style={{fontWeight:700,fontSize:12}}>{MONTHS_SHORT[cal.month]} {cal.year}</span>
                <button type="button" onClick={()=>setCal(c=>c.month===11?{year:c.year+1,month:0}:{...c,month:c.month+1})} style={{background:"var(--surface)",border:"none",borderRadius:6,padding:"4px 8px",cursor:"pointer",fontSize:13,flex:0.5}}>›</button>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",marginBottom:3,gap:1}}>
                {DAYS_SHORT.map(d=><div key={d} style={{textAlign:"center",fontSize:9,fontWeight:700,color:"var(--muted)",padding:"1px 0"}}>{d}</div>)}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:1}}>
                {cells.map((day,i) => (
                  <button key={i} type="button" disabled={!day} onClick={()=>day&&selectDay(day)} style={{
                    padding:"5px 0",textAlign:"center",fontSize:11,fontWeight:500,border:"none",cursor:day?"pointer":"default",borderRadius:6,
                    background:isSelected(day)?"var(--accent)":isToday(day)?"var(--surface)":"transparent",
                    color:isSelected(day)?"#fff":isToday(day)?"var(--accent)":day?"var(--text)":"transparent",
                    fontWeight:isToday(day)||isSelected(day)?700:500,
                  }}>{day||""}</button>
                ))}
              </div>
            </div>
          )}
          {tab==="time" && (
            <div style={{padding:"10px 10px"}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,maxHeight:200,overflow:"hidden"}}>
                <div>
                  <div style={{fontSize:9,fontWeight:700,color:"var(--muted)",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:4}}>Hour</div>
                  <div style={{maxHeight:170,overflowY:"auto",display:"grid",gap:1}}>
                    {HOURS.map(h => {
                      const lbl = h===0?"12 AM":h<12?`${h} AM`:h===12?"12 PM":`${h-12} PM`;
                      return <button key={h} type="button" onClick={()=>selectTime(h,minute)} style={{padding:"4px 6px",borderRadius:5,border:"none",cursor:"pointer",fontSize:11,fontWeight:500,textAlign:"left",background:hour===h?"var(--accent)":"transparent",color:hour===h?"#fff":"var(--text)"}}>{lbl}</button>;
                    })}
                  </div>
                </div>
                <div>
                  <div style={{fontSize:9,fontWeight:700,color:"var(--muted)",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:4}}>Minute</div>
                  <div style={{display:"grid",gap:1}}>
                    {MINS.map(m => <button key={m} type="button" onClick={()=>selectTime(hour,m)} style={{padding:"4px 6px",borderRadius:5,border:"none",cursor:"pointer",fontSize:11,fontWeight:500,textAlign:"left",background:minute===m?"var(--accent)":"transparent",color:minute===m?"#fff":"var(--text)"}}>:{String(m).padStart(2,"0")}</button>)}
                  </div>
                </div>
              </div>
            </div>
          )}
          <div style={{borderTop:`1px solid var(--border)`,padding:"8px 10px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:6,flexWrap:"wrap"}}>
            <span style={{fontSize:11,color:"var(--muted)",fontWeight:500}}>{displayVal?`${displayVal.date} ${displayVal.time}`:"No date selected"}</span>
            <button type="button" onClick={()=>setOpen(false)} style={{background:"var(--accent)",color:"#fff",border:"none",borderRadius:6,padding:"5px 14px",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>Done</button>
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

// ── Dashboard helpers ─────────────────────────────────────────────────────────
const GRAD_TEXT_STYLE = {
  background: C.accentGrad,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
};
function SectionTitle({ first, accent, onViewAll }) {
  return (
    <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:16 }}>
      <h2 style={{ fontSize:22, fontWeight:800, color:C.ebony, margin:0, letterSpacing:'-0.02em', textTransform:'uppercase' }}>
        {first}{' '}<span style={GRAD_TEXT_STYLE}>{accent}</span>
      </h2>
      {onViewAll && <button onClick={onViewAll} style={{ fontSize:12, fontWeight:600, color:C.accentPurple, background:'none', border:'none', cursor:'pointer', padding:0 }}>View All →</button>}
    </div>
  );
}
function ThisWeekRow({ e, onNavigate }) {
  const d = new Date(e.start_datetime);
  const today = new Date(); today.setHours(0,0,0,0);
  const ed = new Date(d); ed.setHours(0,0,0,0);
  const diff = Math.round((ed - today) / 86400000);
  const daysLabel = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : `${diff} days`;
  const col = TYPE_COLORS[e.type] || C.accentPurple;
  return (
    <div onClick={onNavigate} style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 20px', borderBottom:`1px solid ${C.border}`, cursor:'pointer', transition:'background .1s' }}
      {...conditionalHover(
        ev=>ev.currentTarget.style.background=C.surface,
        ev=>ev.currentTarget.style.background='transparent'
      )}
    >
      <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
        <div style={{ width:3, height:44, borderRadius:99, background:col, flexShrink:0 }} />
        <div style={{ textAlign:'center', minWidth:28 }}>
          <div style={{ fontSize:20, fontWeight:800, color:C.ebony, lineHeight:1, fontFamily:'var(--font-d)' }}>{d.getDate()}</div>
          <div style={{ fontSize:9, fontWeight:700, color:C.grayChate, textTransform:'uppercase', letterSpacing:'.05em', marginTop:2 }}>{d.toLocaleString('default',{month:'short'})}</div>
        </div>
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontWeight:700, fontSize:14, color:C.ebony, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{e.title}</div>
        <div style={{ fontSize:12, color:C.boulder, marginTop:2 }}>{e.location||e.venue||'—'}</div>
      </div>
      <div style={{ fontSize:11, fontWeight:700, color:C.boulder, background:C.surface, borderRadius:20, padding:'4px 12px', whiteSpace:'nowrap', flexShrink:0 }}>{daysLabel}</div>
    </div>
  );
}
const RECITAL_CARD_GRADS = [
  'linear-gradient(135deg,#1a1035 0%,#2d1b69 100%)',
  'linear-gradient(135deg,#0d1b2a 0%,#1b4332 100%)',
  'linear-gradient(135deg,#1a0533 0%,#7c1d6f 100%)',
  'linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%)',
];
function fmtCardDate(dateStr) {
  if (!dateStr) return null;
  const [y,m,d] = dateStr.slice(0,10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m-1, d).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
}
function fmtCardTime(t) {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  if (isNaN(h)) return null;
  return new Date(2000, 0, 1, h, m||0).toLocaleTimeString([], { hour:'numeric', minute:'2-digit', hour12:true });
}
// Compress an image File to a base64 data URL at max 900px wide
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const maxW = 900;
      const scale = img.width > maxW ? maxW / img.width : 1;
      const canvas = document.createElement('canvas');
      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = reject;
    img.src = url;
  });
}

function RecitalImageCard({ r, index, onClick, schoolId, onPosterUpdate, canEdit }) {
  const poster  = r.poster_url || null;
  const gradBg  = RECITAL_CARD_GRADS[index % RECITAL_CARD_GRADS.length];
  const inputRef = React.useRef();
  const [uploading, setUploading] = React.useState(false);

  const handleUpload = async (e) => {
    e.stopPropagation();
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const dataUrl = await compressImage(file);
      await recitalApi.uploadPoster(schoolId, r.id, dataUrl);
      onPosterUpdate && onPosterUpdate(r.id, dataUrl);
    } catch { /* silent */ }
    setUploading(false);
  };

  const cardMeta = [fmtCardDate(r.event_date), r.event_time && fmtCardTime(r.event_time), r.venue].filter(Boolean);

  return (
    <div onClick={onClick} style={{ position:'relative', width:'100%', height:190, borderRadius:16, overflow:'hidden', cursor:'pointer', background:poster ? `url(${poster}) top/cover no-repeat` : gradBg, transition:'transform .15s,box-shadow .15s', boxSizing:'border-box' }}
      {...conditionalHover(
        e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 8px 28px rgba(0,0,0,.22)';},
        e=>{e.currentTarget.style.transform='none';e.currentTarget.style.boxShadow='none';}
      )}
    >
      <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top,rgba(0,0,0,.55) 0%,rgba(0,0,0,.10) 55%,transparent 100%)' }} />
      <div style={{ position:'absolute', bottom:0, left:0, right:0, padding:'14px' }}>
        <div style={{ fontSize:13, fontWeight:800, color:'#fff', textTransform:'uppercase', letterSpacing:'.03em', lineHeight:1.25 }}>{r.title}</div>
        {cardMeta.length > 0 && <div style={{ fontSize:10, color:'rgba(255,255,255,.6)', marginTop:4, lineHeight:1.4 }}>{cardMeta.join(' · ')}</div>}
      </div>
      {canEdit && (
        <div onClick={e=>e.stopPropagation()} style={{ position:'absolute', top:10, right:10 }}>
          <input ref={inputRef} type="file" accept="image/*" style={{display:'none'}} onChange={handleUpload} />
          <button onClick={e=>{e.stopPropagation();inputRef.current?.click();}} disabled={uploading}
            style={{ background:'rgba(0,0,0,.45)', border:'none', borderRadius:8, color:'#fff', fontSize:11, fontWeight:700, padding:'5px 10px', cursor:'pointer', backdropFilter:'blur(4px)' }}>
            {uploading ? '…' : poster ? '+' : '+ Photo'}
          </button>
        </div>
      )}
    </div>
  );
}

function FeaturedRecitalCard({ r, onClick, schoolId, onPosterUpdate, canEdit }) {
  const poster   = r.poster_url || null;
  const inputRef = React.useRef();
  const [uploading, setUploading] = React.useState(false);

  const handleUpload = async (e) => {
    e.stopPropagation();
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const dataUrl = await compressImage(file);
      await recitalApi.uploadPoster(schoolId, r.id, dataUrl);
      onPosterUpdate && onPosterUpdate(r.id, dataUrl);
    } catch { /* silent */ }
    setUploading(false);
  };

  return (
    <div onClick={onClick} style={{ position:'relative', width:'100%', height:280, borderRadius:16, overflow:'hidden', cursor:'pointer', background:poster ? `url(${poster}) top/cover no-repeat` : RECITAL_CARD_GRADS[0], transition:'transform .15s,box-shadow .15s', boxSizing:'border-box' }}
      {...conditionalHover(
        e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 8px 28px rgba(0,0,0,.22)';},
        e=>{e.currentTarget.style.transform='none';e.currentTarget.style.boxShadow='none';}
      )}
    >
      <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top,rgba(0,0,0,.60) 0%,rgba(0,0,0,.15) 55%,transparent 100%)' }} />
      <div style={{ position:'absolute', bottom:0, left:0, right:0, padding:'20px 18px' }}>
        <div style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,.55)', textTransform:'uppercase', letterSpacing:'.14em', marginBottom:7 }}>Featured Recital</div>
        <div style={{ fontSize:16, fontWeight:800, color:'#fff', textTransform:'uppercase', lineHeight:1.2, letterSpacing:'.02em' }}>{r.title}</div>
        {(() => { const parts = [fmtCardDate(r.event_date), r.event_time && fmtCardTime(r.event_time), r.venue].filter(Boolean); return parts.length > 0 ? <div style={{ fontSize:12, color:'rgba(255,255,255,.65)', marginTop:6 }}>{parts.join(' · ')}</div> : null; })()}
      </div>
      {canEdit && (
        <div onClick={e=>e.stopPropagation()} style={{ position:'absolute', top:10, right:10 }}>
          <input ref={inputRef} type="file" accept="image/*" style={{display:'none'}} onChange={handleUpload} />
          <button onClick={e=>{e.stopPropagation();inputRef.current?.click();}} disabled={uploading}
            style={{ background:'rgba(0,0,0,.45)', border:'none', borderRadius:8, color:'#fff', fontSize:11, fontWeight:700, padding:'5px 10px', cursor:'pointer', backdropFilter:'blur(4px)' }}>
            {uploading ? '…' : poster ? '+' : '+ Photo'}
          </button>
        </div>
      )}
    </div>
  );
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
  const isMobile  = windowWidth < 768;
  const isTablet  = windowWidth >= 768 && windowWidth < 1100;
  const isDesktop = windowWidth >= 1100;

  // ── modal state ───────────────────────────────────────────────────────────
  const [modal, setModal]           = useState(null);
  const [form, setForm]             = useState(EMPTY_EVENT);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showAddBatch,   setShowAddBatch]   = useState(false);
  const [showAddRecital, setShowAddRecital] = useState(false);
  const [studentForm, setStudentForm]       = useState(EMPTY_STUDENT);
  const [batchForm,   setBatchForm]         = useState(EMPTY_BATCH);
  const [recitalForm, setRecitalForm]       = useState({ title:'', event_date:'', event_time:'18:00', venue:'', description:'' });
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
      .sort((a,b) => (a.event_date||"").slice(0,10).localeCompare((b.event_date||"").slice(0,10)));
  }, [recitalList]);

  // Featured: starred recitals → latest among them; none starred → earliest upcoming
  const featuredRecital = useMemo(() => {
    const starred = upcoming.filter(r => r.is_featured);
    if (starred.length > 0) return starred.sort((a,b) => (b.event_date||"").localeCompare(a.event_date||""))[0];
    return upcoming[0] || null;
  }, [upcoming]);

  // Grid: 3 recitals excluding featured — future first, pad with recent past if needed
  const upcomingGrid = useMemo(() => {
    const t = new Date();
    const todayStr = `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,"0")}-${String(t.getDate()).padStart(2,"0")}`;
    const future = upcoming.filter(r => r.id !== featuredRecital?.id);
    if (future.length >= 3) return future.slice(0, 3);
    const past = (recitalList||[])
      .filter(r => (r.event_date||'').slice(0,10) < todayStr && r.id !== featuredRecital?.id)
      .sort((a,b) => (b.event_date||'').localeCompare(a.event_date||''))
      .slice(0, 3 - future.length);
    return [...future, ...past];
  }, [upcoming, featuredRecital, recitalList]);

  const upcomingClasses = useMemo(() => {
    const now = new Date();
    return (rawEvents||[])
      .filter(e => new Date(e.start_datetime) >= now && e.type !== "Recital")
      .sort((a,b) => a.start_datetime.localeCompare(b.start_datetime))
      .slice(0,3);
  }, [rawEvents]);

  const thisWeekEvents = useMemo(() => {
    const now = new Date();
    const weekOut = new Date(now.getTime() + 7 * 86400000);
    return (rawEvents||[])
      .filter(e => { const d = new Date(e.start_datetime); return d >= now && d <= weekOut; })
      .sort((a,b) => a.start_datetime.localeCompare(b.start_datetime));
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
      setRecitalForm({ title:'', event_date:'', event_time:'18:00', venue:'', description:'' });
    },
    onError: err => toast.error(err.error||"Failed to create recital"),
  });
  const toggleTodoMutation = useMutation({
    mutationFn: id => todosApi.toggle(sid, id),
    onMutate: async id => {
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
  const deleteTodoMutation = useMutation({
    mutationFn: id => todosApi.remove(sid, id),
    onSuccess: () => qc.invalidateQueries(['todos', sid]),
  });

  // Update poster_url in the recitals query cache immediately after upload
  const handlePosterUpdate = (recitalId, dataUrl) => {
    qc.setQueryData(['recitals', sid], old =>
      Array.isArray(old) ? old.map(r => r.id === recitalId ? { ...r, poster_url: dataUrl } : r) : old
    );
  };

  const openAdd = () => {
    const base = new Date(); base.setHours(18,0,0,0);
    const end  = new Date(base); end.setHours(19,0,0,0);
    setForm({...EMPTY_EVENT, start_datetime:toLocalInput(base), end_datetime:toLocalInput(end), duration:60});
    setModal({});
  };

  // ── greeting ──────────────────────────────────────────────────────────────
  const hr       = new Date().getHours();
  const greeting = hr<12 ? "Good morning" : hr<17 ? "Good afternoon" : "Good evening";
  const todayStr = new Date().toLocaleDateString([],{weekday:"long",month:"long",day:"numeric",year:"numeric"});

  // ── render ────────────────────────────────────────────────────────────────
  const allTodos    = todosData?.todos || [];
  const latestTodos = [...allTodos].sort((a,b) => new Date(b.created_at)-new Date(a.created_at)).slice(0,5);
  const openTodos   = latestTodos; // kept for mobile section below
  const fmtDue    = str => { if (!str) return null; const d = parseLocalDate(str); return isNaN(d) ? null : d.toLocaleDateString([],{month:"short",day:"numeric"}); };
  const isOverdue = str => { if (!str) return false; const due = parseLocalDate(str); const now = new Date(); now.setHours(0,0,0,0); return !isNaN(due) && due < now; };

  // ── reusable rendered sections ───────────────────────────────────────────
  const renderTodoSection = (
    <div>
      <TodoKeyframeStyles />
      <SectionTitle first="TO" accent="DOs" onViewAll={()=>navigate('/todos')} />
      <Card padding={0} style={{ display:'flex', flexDirection:'column', overflow:'hidden' }}>
        {latestTodos.length === 0
          ? <div style={{ padding:'20px 16px', color:C.grayChate, fontSize:13, textAlign:'center' }}>No to-dos yet</div>
          : latestTodos.map(t => (
              <TodoRow key={t.id} todo={t} compact
                onToggle={() => toggleTodoMutation.mutate(t.id)}
                onDelete={() => deleteTodoMutation.mutate(t.id)}
              />
            ))
        }
      </Card>
    </div>
  );

  // ── stats block (reused on desktop-top and mobile-bottom) ────────────────
  const STAT_ITEMS = stats ? [
    { label:"Students", value:stats.students??stats.student_count, path:"/students",
      icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>, accent: C.accentPurple },
    { label:"Batches",  value:stats.batches??stats.batch_count,    path:"/batches",
      icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>, accent: '#0EA5E9' },
    { label:"Recitals", value:stats.upcoming_recitals,             path:"/schedule",
      icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>, accent: C.accentMagenta },
  ] : [];

  const renderStatsSection = stats ? (
    <div>
      <SectionTitle first="STUDIO" accent="OVERVIEW" />
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
        {STAT_ITEMS.map(({label,value,path,icon,accent}) => (
          <div key={label} onClick={()=>navigate(path)} style={{
            background:C.white, borderRadius:16, border:`1.5px solid ${C.border}`,
            padding:'20px 24px', cursor:'pointer', transition:'all .15s',
            display:'flex', alignItems:'center', gap:16,
          }}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=accent;e.currentTarget.style.boxShadow=`0 4px 16px ${accent}22`;}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.boxShadow='none';}}
          >
            <div style={{ width:48, height:48, borderRadius:14, background:accent+'15', color:accent, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              {icon}
            </div>
            <div>
              <div style={{ fontSize:28, fontWeight:800, color:C.ebony, lineHeight:1, fontFamily:'var(--font-d)' }}>{value||0}</div>
              <div style={{ fontSize:11, fontWeight:700, color:C.grayChate, textTransform:'uppercase', letterSpacing:'.08em', marginTop:4 }}>{label}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  ) : null;

  // Mobile stat block (unchanged compact style)
  const statsBlock = stats ? (
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:10}}>
      {STAT_ITEMS.map(({label,value,path,icon}) => (
        <Card key={label} clickable onClick={()=>navigate(path)} padding={12}
          style={{ display:"flex", flexDirection:"column", alignItems:"flex-start", gap:8, minWidth:0 }}
        >
          <div style={{fontSize:24,fontWeight:800,color:'var(--text)',lineHeight:1}}>{value||0}</div>
          <div style={{display:"flex",alignItems:"center",gap:6,color:C.grayChate}}>
            {icon}
            <span style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em"}}>{label}</span>
          </div>
        </Card>
      ))}
    </div>
  ) : null;

  return (
    <div style={{ width:'100%', minWidth:0, boxSizing:'border-box', ...(isMobile && { paddingTop:12, paddingBottom:24 }) }}>

      {/* Stats row moved below upcoming recitals on desktop */}

      {/* ── Mobile: consolidated Create button ── */}
      {isMobile && isAdmin && (
        <div ref={createMenuRef} style={{position:"relative",marginBottom:24,display:"flex",justifyContent:"flex-end"}}>
          <button onClick={()=>setCreateMenuOpen(o=>!o)} style={{
            width:"50%",padding:"13px 20px",borderRadius:14,border:"none",
            background:C.accentGrad,color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer",
            display:"flex",alignItems:"center",justifyContent:"center",gap:8,
            boxShadow:"0 4px 20px rgba(124,58,237,.3)",
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Create New
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{marginLeft:2,transition:"transform .2s",transform:createMenuOpen?"rotate(180deg)":"none"}}><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          {createMenuOpen && (
            <div style={{position:"absolute",top:"calc(100% + 8px)",right:0,minWidth:220,background:C.white,border:`1.5px solid ${C.border}`,borderRadius:14,boxShadow:"0 8px 32px rgba(0,0,0,.14)",zIndex:200,overflow:"hidden"}}>
              {[
                { label:"Create Event",   color:"#0EA5E9",      action:()=>{ openAdd(); setCreateMenuOpen(false); } },
                { label:"Create Recital", color:"#C026D3",      action:()=>{ setShowAddRecital(true); setCreateMenuOpen(false); } },
                { label:"Create Batch",   color:"#F59E0B",      action:()=>{ setShowAddBatch(true); setCreateMenuOpen(false); } },
                { label:"Add Student",    color:C.accentPurple, action:()=>{ setShowAddStudent(true); setCreateMenuOpen(false); } },
              ].map(({label,color,action},i,arr) => (
                <button key={label} onClick={action} style={{
                  width:"100%",padding:"15px 20px",background:"transparent",border:"none",
                  borderBottom: i < arr.length-1 ? `1px solid ${C.border}` : "none",
                  color:C.ebony,fontSize:14,fontWeight:600,
                  cursor:"pointer",display:"flex",alignItems:"center",gap:14,textAlign:"left",
                }}
                  onMouseEnter={e=>{e.currentTarget.style.background=C.surface;}}
                  onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}
                >
                  <span style={{width:36,height:36,borderRadius:10,background:color+"14",color,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    {label==="Create Event" ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    ) : label==="Create Recital" ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    ) : label==="Create Batch" ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    )}
                  </span>
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Desktop: Action buttons (Figma: right-aligned + Create / View Schedule) ── */}
      {!isMobile && isAdmin && (
        <div ref={createMenuRef} style={{display:"flex",gap:10,marginBottom:28,justifyContent:"flex-end",alignItems:"center",position:"relative"}}>
          {/* + Create dropdown */}
          <div style={{position:"relative"}}>
            <button onClick={()=>setCreateMenuOpen(o=>!o)} style={{
              padding:"10px 18px", borderRadius:12, border:"none",
              background:C.createBtn, color:'var(--accent)', fontWeight:700, fontSize:13, cursor:"pointer",
              transition:"background .15s", display:"flex",alignItems:"center",gap:6,
            }}
              onMouseEnter={e=>{e.currentTarget.style.background=C.createBtnHov;}}
              onMouseLeave={e=>{e.currentTarget.style.background=C.createBtn;}}
            >
              + Create
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{transition:"transform .2s",transform:createMenuOpen?"rotate(180deg)":"none"}}><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            {createMenuOpen && (
              <div style={{position:"absolute",top:"calc(100% + 6px)",right:0,minWidth:190,background:C.white,border:`1px solid ${C.border}`,borderRadius:12,boxShadow:"0 8px 24px rgba(0,0,0,.12)",zIndex:200,overflow:"hidden"}}>
                {[
                  { label:"Create Event",   action:()=>{ openAdd(); setCreateMenuOpen(false); } },
                  { label:"Create Recital", action:()=>{ setShowAddRecital(true); setCreateMenuOpen(false); } },
                  { label:"Add Student",    action:()=>{ setShowAddStudent(true); setCreateMenuOpen(false); } },
                  { label:"Create Batch",   action:()=>{ setShowAddBatch(true); setCreateMenuOpen(false); } },
                ].map(({label,action},i,arr) => (
                  <button key={label} onClick={action} style={{
                    width:"100%",padding:"11px 16px",background:"transparent",border:"none",
                    borderBottom: i < arr.length-1 ? `1px solid ${C.border}` : "none",
                    color:C.ebony,fontSize:13,fontWeight:600,
                    cursor:"pointer",display:"flex",alignItems:"center",gap:10,textAlign:"left",
                  }}
                    onMouseEnter={e=>{e.currentTarget.style.background=C.surface;}}
                    onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}
                  >{label}</button>
                ))}
              </div>
            )}
          </div>
          {/* View Schedule */}
          <button onClick={()=>navigate("/schedule")} style={{
            padding:"10px 18px", borderRadius:12, border:"none",
            background:C.accentMagenta, color:"#fff", fontWeight:700, fontSize:13, cursor:"pointer",
            transition:"opacity .15s,transform .15s",
          }}
            onMouseEnter={e=>{e.currentTarget.style.opacity=".88";e.currentTarget.style.transform="translateY(-1px)";}}
            onMouseLeave={e=>{e.currentTarget.style.opacity="1";e.currentTarget.style.transform="none";}}
          >View Schedule →</button>
        </div>
      )}

      {/* ── Greeting ── */}
      <div style={{marginBottom:isMobile?16:20}}>
        <p style={{fontFamily:"var(--font-b)",fontSize:13,fontWeight:400,color:C.boulder}}>
          <span style={{fontWeight:600,color:C.ebony}}>{greeting}, {user?.name?.split(" ")[0]}!</span>{' · '}{todayStr}
        </p>
      </div>

      {/* ── Tablet + Desktop: full-feature layout ── */}
      {!isMobile && (
        <div>
          {/* Tablet: stats strip at top */}
          {isTablet && renderStatsSection && (
            <div style={{ marginBottom:28 }}>{renderStatsSection}</div>
          )}

          {/* Main grid: 2-col on desktop, single col on tablet */}
          <div style={{ display:'grid', gridTemplateColumns: isDesktop ? '1fr 360px' : '1fr', gap: isDesktop ? 36 : 0, alignItems:'start' }}>
            {/* Left / main column */}
            <div>
              <SectionTitle first="THIS" accent="WEEK" onViewAll={()=>navigate('/schedule')} />
              <div style={{ background:C.white, borderRadius:16, border:`1.5px solid ${C.border}`, overflow:'hidden', marginBottom:36 }}>
                {thisWeekEvents.length === 0
                  ? <div style={{ padding:'28px 20px', color:C.grayChate, fontSize:13, textAlign:'center' }}>No events this week</div>
                  : thisWeekEvents.slice(0,5).map(e => <ThisWeekRow key={e.id} e={e} onNavigate={()=>navigate('/schedule',{state:{openEventId:e.id,eventDate:e.start_datetime}})} />)
                }
              </div>
              <SectionTitle first="UPCOMING" accent="RECITALS" onViewAll={()=>navigate('/schedule')} />
              {upcoming.length === 0
                ? <div style={{ padding:'28px 20px', color:C.grayChate, fontSize:13, textAlign:'center', background:C.white, borderRadius:16, border:`1.5px solid ${C.border}` }}>No upcoming recitals</div>
                : <div style={{ display:'grid', gridTemplateColumns: isDesktop ? 'repeat(3,minmax(0,1fr))' : 'repeat(2,minmax(0,1fr))', gap:12 }}>
                    {upcomingGrid.map((r,i) => <RecitalImageCard key={r.id} r={r} index={i} schoolId={sid} canEdit={isAdmin} onPosterUpdate={handlePosterUpdate} onClick={()=>navigate('/schedule',{state:{recitalId:r.id,from:'dashboard'}})} />)}
                  </div>
              }
              {/* Desktop: stats below recitals */}
              {isDesktop && renderStatsSection && (
                <div style={{ marginTop:36 }}>{renderStatsSection}</div>
              )}
            </div>

            {/* Right column — desktop only */}
            {isDesktop && (
              <div style={{ display:'flex', flexDirection:'column', gap:28 }}>
                {featuredRecital && (
                  <div>
                    <SectionTitle first="FEATURED" accent="RECITAL" />
                    <FeaturedRecitalCard r={featuredRecital} schoolId={sid} canEdit={isAdmin} onPosterUpdate={handlePosterUpdate} onClick={()=>navigate('/schedule',{state:{recitalId:featuredRecital.id}})} />
                  </div>
                )}
                {renderTodoSection}
              </div>
            )}
          </div>

          {/* Tablet: featured recital + todos stacked below main */}
          {isTablet && (
            <div style={{ display:'grid', gap:28, marginTop:28 }}>
              {featuredRecital && (
                <div>
                  <SectionTitle first="FEATURED" accent="RECITAL" />
                  <FeaturedRecitalCard r={featuredRecital} schoolId={sid} canEdit={isAdmin} onPosterUpdate={handlePosterUpdate} onClick={()=>navigate('/schedule',{state:{recitalId:featuredRecital.id}})} />
                </div>
              )}
              {renderTodoSection}
            </div>
          )}
        </div>
      )}

      {/* ── Mobile: stacked cards ── */}
      {isMobile && (
        <div style={{ display:'grid', gap:24, width:'100%', maxWidth:'100%', boxSizing:'border-box', minWidth:0, overflow:'hidden' }}>

        {/* Upcoming Recitals — row 1: 2-col grid tiles, row 2: featured full-width */}
        <div style={{ minWidth:0, overflow:'hidden' }}>
          <SectionTitle first="UPCOMING" accent="RECITALS" onViewAll={()=>navigate('/schedule')} />
          {upcoming.length === 0
            ? <div style={{padding:"28px 20px",color:C.grayChate,fontSize:13,textAlign:"center",background:C.white,borderRadius:16,border:`1.5px solid ${C.border}`}}>No upcoming recitals</div>
            : <div style={{ minWidth:0 }}>
                {upcomingGrid.slice(0, 2).length > 0 && (
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gridAutoRows:190, gap:16, marginBottom: featuredRecital ? 16 : 0, minWidth:0 }}>
                    {upcomingGrid.slice(0, 2).map((r, i) => (
                      <RecitalImageCard key={r.id} r={r} index={i} schoolId={sid} canEdit={isAdmin} onPosterUpdate={handlePosterUpdate} onClick={()=>navigate('/schedule',{state:{recitalId:r.id,from:'dashboard'}})} />
                    ))}
                  </div>
                )}
                {featuredRecital && (
                  <FeaturedRecitalCard r={featuredRecital} schoolId={sid} canEdit={isAdmin} onPosterUpdate={handlePosterUpdate} onClick={()=>navigate('/schedule',{state:{recitalId:featuredRecital.id}})} />
                )}
              </div>
          }
        </div>

        {/* Upcoming Classes */}
        <Card padding={0} style={{display:"flex",flexDirection:"column",minWidth:0,overflow:'hidden'}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 16px"}}>
            <div style={{fontSize:11,fontWeight:700,color:C.grayChate,textTransform:"uppercase",letterSpacing:".1em"}}>Upcoming Classes</div>
            <button onClick={()=>navigate("/schedule")} style={{background:"none",border:"none",cursor:"pointer",fontSize:12,color:C.accentPurple,fontWeight:600,padding:0}}>View All</button>
          </div>
          {upcomingClasses.length === 0
            ? <div style={{padding:"28px 16px",color:C.grayChate,fontSize:13,textAlign:"center"}}>No upcoming events</div>
            : upcomingClasses.map(e => {
                const color = e.color || TYPE_COLORS[e.type] || "#8a7a9a";
                const d     = parseLocalDate((e.start_datetime||"").slice(0,10));
                return (
                  <div key={e.id} onClick={()=>navigate("/schedule",{state:{openEventId:e.id,eventDate:e.start_datetime}})}
                    style={{display:"flex",alignItems:"center",gap:12,padding:"10px 16px",borderTop:`1px solid ${C.border}`,cursor:"pointer",transition:"background .1s"}}
                    {...conditionalHover(
                      ev=>{ev.currentTarget.style.background=C.surface;},
                      ev=>{ev.currentTarget.style.background="transparent";}
                    )}
                  >
                    {/* Left-bar date block */}
                    <div style={{display:"flex",alignItems:"stretch",gap:8,flexShrink:0}}>
                      <div style={{width:3,borderRadius:99,background:C.accentPurple,minHeight:36}} />
                      <div style={{textAlign:"center",minWidth:28}}>
                        <div style={{fontSize:17,fontWeight:800,color:C.ebony,lineHeight:1}}>{isNaN(d)?"—":d.getDate()}</div>
                        <div style={{fontSize:9,color:C.grayChate,textTransform:"uppercase",fontWeight:700,marginTop:2,letterSpacing:".04em"}}>{isNaN(d)?"":d.toLocaleString("default",{month:"short"})}</div>
                      </div>
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:700,fontSize:13,color:C.ebony,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.title}</div>
                      <div style={{color:C.boulder,fontSize:11,marginTop:2}}>
                        {[!isNaN(d) && d.toLocaleString("default",{weekday:"short"}), fmtTime(e.start_datetime), e.location||""].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                    <Badge color={color}>{e.type}</Badge>
                  </div>
                );
              })
          }
        </Card>

        {/* To-Dos */}
        <Card padding={0} style={{display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 16px"}}>
            <div style={{fontSize:11,fontWeight:700,color:C.grayChate,textTransform:"uppercase",letterSpacing:".1em"}}>To-Do</div>
            <button onClick={()=>navigate("/todos")} style={{background:"none",border:"none",cursor:"pointer",fontSize:12,color:C.accentPurple,fontWeight:600,padding:0}}>Add To-do</button>
          </div>
          {latestTodos.length === 0
            ? <div style={{padding:"20px 16px",color:C.grayChate,fontSize:13,textAlign:"center"}}>All caught up!</div>
            : latestTodos.map(t => (
                <TodoRow key={t.id} todo={t} compact flat
                  onToggle={() => toggleTodoMutation.mutate(t.id)}
                  onDelete={() => deleteTodoMutation.mutate(t.id)}
                />
              ))
          }
        </Card>

        </div>
      )}

      {/* ── Mobile: stats at bottom ── */}
      {isMobile && stats && (
        <div style={{marginTop:24}}>
          <div style={{fontSize:10,fontWeight:700,color:C.grayChate,textTransform:"uppercase",letterSpacing:".1em",marginBottom:10}}>Studio Overview</div>
          {statsBlock}
        </div>
      )}

      {/* ── Add Student Modal ────────────────────────────────────────────── */}
      {showAddStudent && (
        <Modal title="Add Student" onClose={()=>{setShowAddStudent(false);setStudentForm(EMPTY_STUDENT);}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:"0 16px"}}>
            <Field label="Full Name *" style={{gridColumn:"1/-1"}}><Input value={studentForm.name} onChange={e=>setStudentForm({...studentForm,name:e.target.value})} placeholder="e.g. Aanya Patel" /></Field>
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
            <Button variant="secondary" onClick={()=>{setShowAddStudent(false);setStudentForm(EMPTY_STUDENT);}}>Cancel</Button>
            <Button variant="ghost" style={{marginLeft:"auto"}} onClick={()=>{setShowAddStudent(false);navigate("/students");}}>Go to Students →</Button>
          </div>
        </Modal>
      )}

      {/* ── Add Batch Modal ──────────────────────────────────────────────── */}
      {showAddBatch && (
        <Modal title="Create Batch" onClose={()=>{setShowAddBatch(false);setBatchForm(EMPTY_BATCH);}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:"0 16px"}}>
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
            <Button variant="secondary" onClick={()=>{setShowAddBatch(false);setBatchForm(EMPTY_BATCH);}}>Cancel</Button>
            <Button variant="ghost" style={{marginLeft:"auto"}} onClick={()=>{setShowAddBatch(false);navigate("/batches");}}>Go to Batches →</Button>
          </div>
        </Modal>
      )}

      {/* ── Add Recital Modal ───────────────────────────────────────────── */}
      {showAddRecital && (
        <Modal title="New Recital" onClose={()=>{setShowAddRecital(false);setRecitalForm({title:'',event_date:'',event_time:'18:00',venue:'',description:''});}}>
          <div style={{height:4,background:"linear-gradient(90deg,#c4527a,#e8607a)",borderRadius:4,marginBottom:16}} />
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:"0 16px"}}>
            <Field label="Recital Title *" style={{gridColumn:"1/-1"}}><Input value={recitalForm.title} onChange={e=>setRecitalForm({...recitalForm,title:e.target.value})} placeholder="e.g. Spring Showcase 2026" /></Field>
            <Field label="Date *"><Input type="date" value={recitalForm.event_date} onChange={e=>setRecitalForm({...recitalForm,event_date:e.target.value})} /></Field>
            <Field label="Time">
              <Select value={recitalForm.event_time} onChange={e=>setRecitalForm({...recitalForm,event_time:e.target.value})}>
                <option value="">— No time —</option>
                {TIME_OPTIONS.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
              </Select>
            </Field>
            <Field label="Venue" style={{gridColumn:"1/-1"}}><Input value={recitalForm.venue} onChange={e=>setRecitalForm({...recitalForm,venue:e.target.value})} placeholder="e.g. Riverside Auditorium" /></Field>
            <Field label="Notes" style={{gridColumn:"1/-1"}}><Textarea value={recitalForm.description} onChange={e=>setRecitalForm({...recitalForm,description:e.target.value})} placeholder="Any notes about the recital…" /></Field>
          </div>
          <div style={{display:"flex",gap:9,marginTop:8}}>
            <Button onClick={()=>recitalSaveMutation.mutate(recitalForm)} disabled={!recitalForm.title||!recitalForm.event_date||recitalSaveMutation.isPending} style={{background:"#c4527a",borderColor:"#c4527a"}}>
              {recitalSaveMutation.isPending?"Creating…":"Create Recital"}
            </Button>
            <Button variant="secondary" onClick={()=>{setShowAddRecital(false);setRecitalForm({title:'',event_date:'',event_time:'18:00',venue:'',description:''});}}>Cancel</Button>
          </div>
        </Modal>
      )}

      {/* ── Add Event Modal ──────────────────────────────────────────────── */}
      {modal !== null && (
        <Modal title={modal.id ? "Edit Event" : "New Event"} onClose={()=>setModal(null)} wide>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:"0 16px"}}>
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
            <Button variant="secondary" onClick={()=>setModal(null)}>Cancel</Button>
          </div>
        </Modal>
      )}

    </div>
  );
}

// ── Super Admin Dashboard ─────────────────────────────────────────────────────
const EMPTY_SCHOOL = { name:'', owner_name:'', email:'', phone:'', city:'', dance_style:'', admin_email:'', admin_password:'' };

function SuperAdminDash() {
  const qc = useQueryClient();
  const { data: schoolList = [], isLoading } = useQuery({
    queryKey: ['schools'],
    queryFn: () => schools.list(),
  });

  const [resetId,   setResetId]   = useState(null);
  const [resetPw,   setResetPw]   = useState('');
  const [showPw,    setShowPw]    = useState(false);
  const [resetDone, setResetDone] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form,      setForm]      = useState(EMPTY_SCHOOL);
  const [created,   setCreated]   = useState(null);

  const resetMut = useMutation({
    mutationFn: ({ id, password }) => schools.resetAdminPassword(id, password),
    onSuccess: (_, { id }) => {
      setResetDone(id);
      setResetId(null);
      setResetPw('');
      setTimeout(() => setResetDone(null), 4000);
    },
  });

  const createMut = useMutation({
    mutationFn: (data) => schools.create(data),
    onSuccess: () => {
      qc.invalidateQueries(['schools']);
      setCreated({ name: form.name, admin_email: form.admin_email, admin_password: form.admin_password });
      setShowCreate(false);
      setForm(EMPTY_SCHOOL);
    },
  });

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div style={{ maxWidth: 760 }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:28, gap:16, flexWrap:'wrap' }}>
        <div>
          <h1 style={{ fontFamily:'var(--font-d)', fontSize:26, color:C.ebony, marginBottom:4 }}>Super Admin</h1>
          <p style={{ color:C.boulder, fontSize:13 }}>Manage all schools and their login credentials</p>
        </div>
        <Button onClick={() => { setShowCreate(true); setCreated(null); }}>+ Add School</Button>
      </div>

      {/* New school credentials banner */}
      {created && (
        <div style={{ background:'#F0FDF4', border:'1.5px solid #86EFAC', borderRadius:12, padding:'16px 20px', marginBottom:20 }}>
          <div style={{ fontWeight:700, fontSize:13, color:'#15803D', marginBottom:10 }}>
            ✅ "{created.name}" created — save these login details now:
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:'6px 24px' }}>
            <SACredRow label="Admin Email" value={created.admin_email} />
            <SACredRow label="Password" value={created.admin_password} secret />
          </div>
          <button onClick={() => setCreated(null)} style={{ marginTop:10, fontSize:12, color:'#15803D', background:'none', border:'none', cursor:'pointer', padding:0, fontWeight:600 }}>Dismiss</button>
        </div>
      )}

      {/* School list */}
      {isLoading ? (
        <div style={{ color:C.boulder, fontSize:13, padding:24 }}>Loading…</div>
      ) : (
        <div style={{ display:'grid', gap:10 }}>
          {schoolList.map(s => {
            const hue = s.name.charCodeAt(0) * 7 % 360;
            const isResetting = resetId === s.id;
            const justReset   = resetDone === s.id;
            return (
              <div key={s.id} style={{ background:C.white, border:`1.5px solid ${justReset ? '#86EFAC' : C.border}`, borderRadius:14, overflow:'hidden', transition:'border-color .3s' }}>
                {/* Main row */}
                <div style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 18px' }}>
                  <div style={{ width:44, height:44, borderRadius:12, background:`hsl(${hue},55%,64%)`, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, color:'#fff', fontSize:18, flexShrink:0 }}>
                    {s.name[0]}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:700, fontSize:14, color:C.ebony }}>{s.name}</div>
                    <div style={{ color:C.boulder, fontSize:12, marginTop:2 }}>{s.city}{s.dance_style ? ` · ${s.dance_style}` : ''}</div>
                  </div>
                  <div style={{ fontSize:12, color:C.grayChate, textAlign:'right', flexShrink:0 }}>
                    <div>{s.student_count} students</div>
                    <div>{s.batch_count} batches</div>
                  </div>
                </div>

                {/* Credentials bar */}
                <div style={{ borderTop:`1px solid ${C.border}`, padding:'10px 18px', background:'#FAFAFA', display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:10, fontWeight:700, color:C.grayChate, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:3 }}>Admin Login</div>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontSize:13, fontWeight:600, color:C.ebony, fontFamily:'monospace' }}>
                        {s.admin_email || <span style={{ color:C.grayChate, fontFamily:'inherit', fontWeight:400 }}>No admin set</span>}
                      </span>
                      {s.admin_email && (
                        <button onClick={() => navigator.clipboard?.writeText(s.admin_email)} title="Copy email"
                          style={{ background:'none', border:'none', cursor:'pointer', color:C.grayChate, padding:'1px 4px', borderRadius:4, fontSize:12 }}>⎘</button>
                      )}
                    </div>
                  </div>

                  {justReset ? (
                    <span style={{ fontSize:12, fontWeight:700, color:'#15803D' }}>✓ Password updated</span>
                  ) : isResetting ? (
                    <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                      <input
                        autoFocus
                        type={showPw ? 'text' : 'password'}
                        value={resetPw}
                        onChange={e => setResetPw(e.target.value)}
                        placeholder="New password (min 6)"
                        onKeyDown={e => {
                          if (e.key === 'Enter' && resetPw.length >= 6) resetMut.mutate({ id: s.id, password: resetPw });
                          if (e.key === 'Escape') { setResetId(null); setResetPw(''); }
                        }}
                        style={{ padding:'6px 10px', borderRadius:8, border:`1.5px solid ${C.accentPurple}`, fontSize:12, outline:'none', width:180, fontFamily:'monospace' }}
                      />
                      <button onClick={() => setShowPw(v => !v)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:14, color:C.boulder, padding:0 }}>
                        {showPw ? '🙈' : '👁'}
                      </button>
                      <Button size="sm" onClick={() => resetMut.mutate({ id: s.id, password: resetPw })} disabled={resetPw.length < 6 || resetMut.isPending}>
                        {resetMut.isPending ? '…' : 'Save'}
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => { setResetId(null); setResetPw(''); }}>Cancel</Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="secondary" onClick={() => { setResetId(s.id); setResetPw(''); setShowPw(false); }}>
                      🔑 Reset Password
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create School modal */}
      {showCreate && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
          onClick={e => { if (e.target === e.currentTarget) setShowCreate(false); }}>
          <div style={{ background:C.white, borderRadius:18, width:'100%', maxWidth:500, maxHeight:'90vh', overflowY:'auto', boxShadow:'0 24px 64px rgba(0,0,0,.22)' }}>
            <div style={{ padding:'20px 24px', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontWeight:700, fontSize:16, color:C.ebony }}>Add New School</span>
              <button onClick={() => setShowCreate(false)} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:C.boulder, lineHeight:1 }}>×</button>
            </div>
            <div style={{ padding:'20px 24px' }}>
              <div style={{ fontSize:11, fontWeight:700, color:C.grayChate, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:14 }}>School Details</div>
              {[
                { label:'School Name *', key:'name', placeholder:'e.g. Rhythm & Grace Academy' },
                { label:'Owner Name *',  key:'owner_name', placeholder:'Full name' },
              ].map(({ label, key, placeholder }) => (
                <div key={key} style={{ marginBottom:14 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:C.boulder, textTransform:'uppercase', letterSpacing:'.07em', marginBottom:5 }}>{label}</div>
                  <input value={form[key]} onChange={e => setF(key, e.target.value)} placeholder={placeholder}
                    style={{ width:'100%', padding:'9px 12px', borderRadius:9, border:`1.5px solid ${C.border}`, fontSize:13, color:C.ebony, background:C.white, outline:'none', boxSizing:'border-box', fontFamily:'inherit' }}
                    onFocus={e => e.target.style.borderColor = C.accentPurple}
                    onBlur={e => e.target.style.borderColor = C.border} />
                </div>
              ))}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:'0 14px' }}>
                {[
                  { label:'City', key:'city', placeholder:'City' },
                  { label:'Dance Style', key:'dance_style', placeholder:'e.g. Ballet' },
                ].map(({ label, key, placeholder }) => (
                  <div key={key} style={{ marginBottom:14 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:C.boulder, textTransform:'uppercase', letterSpacing:'.07em', marginBottom:5 }}>{label}</div>
                    <input value={form[key]} onChange={e => setF(key, e.target.value)} placeholder={placeholder}
                      style={{ width:'100%', padding:'9px 12px', borderRadius:9, border:`1.5px solid ${C.border}`, fontSize:13, color:C.ebony, background:C.white, outline:'none', boxSizing:'border-box', fontFamily:'inherit' }}
                      onFocus={e => e.target.style.borderColor = C.accentPurple}
                      onBlur={e => e.target.style.borderColor = C.border} />
                  </div>
                ))}
              </div>
              <div style={{ borderTop:`1px solid ${C.border}`, margin:'4px 0 16px' }} />
              <div style={{ fontSize:11, fontWeight:700, color:C.grayChate, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:14 }}>Admin Login Credentials</div>
              {[
                { label:'Admin Email *', key:'admin_email', placeholder:'admin@school.com', type:'email' },
                { label:'Password *',    key:'admin_password', placeholder:'Min 6 characters', type:'text' },
              ].map(({ label, key, placeholder, type }) => (
                <div key={key} style={{ marginBottom:14 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:C.boulder, textTransform:'uppercase', letterSpacing:'.07em', marginBottom:5 }}>{label}</div>
                  <input type={type} value={form[key]} onChange={e => setF(key, e.target.value)} placeholder={placeholder}
                    style={{ width:'100%', padding:'9px 12px', borderRadius:9, border:`1.5px solid ${C.border}`, fontSize:13, color:C.ebony, background:C.white, outline:'none', boxSizing:'border-box', fontFamily:'inherit' }}
                    onFocus={e => e.target.style.borderColor = C.accentPurple}
                    onBlur={e => e.target.style.borderColor = C.border} />
                </div>
              ))}
              <div style={{ fontSize:11, color:C.boulder, marginTop:-8, marginBottom:16 }}>
                ⚠ Save these credentials — the password cannot be recovered after creation (only reset).
              </div>
              <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
                <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
                <Button
                  onClick={() => createMut.mutate(form)}
                  disabled={!form.name || !form.owner_name || !form.admin_email || !form.admin_password || createMut.isPending}
                >
                  {createMut.isPending ? 'Creating…' : 'Create School'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SACredRow({ label, value, secret }) {
  const [vis, setVis] = useState(!secret);
  return (
    <div>
      <div style={{ fontSize:10, fontWeight:700, color:'#15803D', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:2 }}>{label}</div>
      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
        <span style={{ fontSize:13, fontWeight:600, fontFamily:'monospace', color:'#065F46' }}>{vis ? value : '••••••••'}</span>
        {secret && <button onClick={() => setVis(v => !v)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:11, color:'#15803D', padding:0 }}>{vis ? 'hide' : 'show'}</button>}
        <button onClick={() => navigator.clipboard?.writeText(value)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:11, color:'#15803D', padding:0 }}>⎘ copy</button>
      </div>
    </div>
  );
}
