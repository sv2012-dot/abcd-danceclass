import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { events as api, batches as batchesApi } from "../api";
import toast from "react-hot-toast";
import Card from "../components/shared/Card";
import Button from "../components/shared/Button";
import Modal from "../components/shared/Modal"; // still used for add/edit form
import Badge from "../components/shared/Badge";
import { Field, Input, Select, Textarea } from "../components/shared/Field";

// ── Constants ────────────────────────────────────────────────────────────────
const EVENT_TYPES = ["Class", "Recital", "Rehearsal", "Workshop", "Other"];
const RECURRENCE  = ["none", "weekly", "biweekly"];

const TYPE_COLORS = {
  Class:     "#6a7fdb",
  Recital:   "#c4527a",
  Rehearsal: "#f4a041",
  Workshop:  "#52c4a0",
  Other:     "#8a7a9a",
};

const DAYS  = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTHS = ["January","February","March","April","May","June",
                "July","August","September","October","November","December"];

const EMPTY_FORM = {
  title:"", type:"Class", batch_ids:[], start_datetime:"", end_datetime:"",
  location:"", requires_studio:false, studio_booked:false,
  recurrence:"none", recurrence_end:"", color:"", notes:"",
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtTime(dt) {
  if (!dt) return "";
  const d = new Date(dt);
  return d.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit", hour12:true });
}
function fmtDate(dt) {
  if (!dt) return "";
  return new Date(dt).toLocaleDateString([], { weekday:"short", month:"short", day:"numeric" });
}
function toLocalInput(dt) {
  if (!dt) return "";
  const d = new Date(dt);
  const pad = n => String(n).padStart(2,"0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ── DateTimePicker component ─────────────────────────────────────────────────
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAYS_SHORT   = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function DateTimePicker({ label, value, onChange, minDate }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab]   = useState("date"); // "date" | "time"
  const ref = useRef(null);

  // Parse current value
  const parsed = useMemo(() => {
    if (!value) return null;
    const d = new Date(value);
    return isNaN(d) ? null : d;
  }, [value]);

  const displayVal = useMemo(() => {
    if (!parsed) return null;
    return {
      date: parsed.toLocaleDateString([], { weekday:"short", month:"short", day:"numeric", year:"numeric" }),
      time: parsed.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit", hour12:true }),
    };
  }, [parsed]);

  // Calendar state
  const [cal, setCal] = useState(() => {
    const d = parsed || new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  // Time state
  const [hour, setHour]     = useState(() => parsed ? parsed.getHours() : 9);
  const [minute, setMinute] = useState(() => parsed ? Math.floor(parsed.getMinutes()/15)*15 : 0);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const emit = useCallback((y, mo, d, h, min) => {
    const pad = n => String(n).padStart(2,"0");
    onChange(`${y}-${pad(mo+1)}-${pad(d)}T${pad(h)}:${pad(min)}`);
  }, [onChange]);

  const selectDay = day => {
    emit(cal.year, cal.month, day, hour, minute);
    setTab("time");
  };

  const selectTime = (h, m) => {
    setHour(h); setMinute(m);
    if (parsed) emit(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), h, m);
    else {
      const t = new Date();
      emit(cal.year, cal.month, t.getDate(), h, m);
    }
  };

  const confirm = () => setOpen(false);

  // Build calendar grid
  const firstDow = new Date(cal.year, cal.month, 1).getDay();
  const daysInMo = new Date(cal.year, cal.month+1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMo; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const today = new Date();
  const isToday   = d => d && cal.year===today.getFullYear() && cal.month===today.getMonth() && d===today.getDate();
  const isSelected = d => d && parsed && cal.year===parsed.getFullYear() && cal.month===parsed.getMonth() && d===parsed.getDate();

  const HOURS   = Array.from({length:24},(_,i)=>i);
  const MINUTES = [0,15,30,45];

  return (
    <div ref={ref} style={{position:"relative"}}>
      <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.07em",textTransform:"uppercase",color:"var(--muted)",marginBottom:5}}>{label}</div>

      {/* Trigger */}
      <button type="button" onClick={()=>setOpen(p=>!p)} style={{
        width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",
        background:"#faf8fc",border:`1.5px solid ${open?"var(--accent)":"var(--border)"}`,
        borderRadius:9,padding:"9px 13px",cursor:"pointer",
        boxShadow:open?"0 0 0 3px rgba(196,82,122,0.1)":"none",
        transition:"all .15s",textAlign:"left",
      }}>
        {displayVal ? (
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:13,fontWeight:600,color:"var(--text)"}}>{displayVal.date}</span>
            <span style={{fontSize:12,color:"var(--muted)",background:"var(--surface)",padding:"2px 8px",borderRadius:6,fontWeight:600}}>{displayVal.time}</span>
          </div>
        ) : (
          <span style={{fontSize:13,color:"var(--muted)"}}>Pick date & time…</span>
        )}
        <span style={{fontSize:14,color:"var(--muted)",flexShrink:0}}>📅</span>
      </button>

      {/* Popover */}
      {open && (
        <div style={{
          position:"absolute",top:"calc(100% + 8px)",left:0,zIndex:300,
          background:"#fff",borderRadius:16,
          boxShadow:"0 12px 40px rgba(0,0,0,0.16)",border:"1px solid var(--border)",
          width:300,overflow:"hidden",
        }}>
          {/* Tabs */}
          <div style={{display:"flex",borderBottom:`1px solid var(--border)`}}>
            {["date","time"].map(t => (
              <button key={t} type="button" onClick={()=>setTab(t)} style={{
                flex:1,padding:"11px 0",fontSize:12,fontWeight:700,border:"none",cursor:"pointer",
                background:tab===t?"#fff":"var(--surface)",
                color:tab===t?"var(--accent)":"var(--muted)",
                borderBottom:tab===t?"2px solid var(--accent)":"2px solid transparent",
              }}>{t==="date"?"📅 Date":"⏰ Time"}</button>
            ))}
          </div>

          {tab==="date" && (
            <div style={{padding:14}}>
              {/* Month nav */}
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                <button type="button" onClick={()=>setCal(c=>c.month===0?{year:c.year-1,month:11}:{...c,month:c.month-1})}
                  style={{background:"var(--surface)",border:"none",borderRadius:7,padding:"5px 10px",cursor:"pointer",fontSize:14}}>‹</button>
                <span style={{fontWeight:700,fontSize:13}}>{MONTHS_SHORT[cal.month]} {cal.year}</span>
                <button type="button" onClick={()=>setCal(c=>c.month===11?{year:c.year+1,month:0}:{...c,month:c.month+1})}
                  style={{background:"var(--surface)",border:"none",borderRadius:7,padding:"5px 10px",cursor:"pointer",fontSize:14}}>›</button>
              </div>
              {/* Day headers */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",marginBottom:4}}>
                {DAYS_SHORT.map(d=><div key={d} style={{textAlign:"center",fontSize:10,fontWeight:700,color:"var(--muted)",padding:"2px 0"}}>{d}</div>)}
              </div>
              {/* Day cells */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
                {cells.map((day,i) => (
                  <button key={i} type="button" disabled={!day} onClick={()=>day&&selectDay(day)} style={{
                    padding:"6px 0",textAlign:"center",fontSize:12,fontWeight:500,border:"none",cursor:day?"pointer":"default",
                    borderRadius:8,
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
                {/* Hours */}
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:"var(--muted)",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>Hour</div>
                  <div style={{maxHeight:190,overflowY:"auto",display:"grid",gap:2}}>
                    {HOURS.map(h => {
                      const label = h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h-12} PM`;
                      return (
                        <button key={h} type="button" onClick={()=>selectTime(h, minute)} style={{
                          padding:"5px 8px",borderRadius:6,border:"none",cursor:"pointer",fontSize:12,fontWeight:600,textAlign:"left",
                          background:hour===h?"var(--accent)":"transparent",
                          color:hour===h?"#fff":"var(--text)",
                        }}>{label}</button>
                      );
                    })}
                  </div>
                </div>
                {/* Minutes */}
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:"var(--muted)",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>Minute</div>
                  <div style={{display:"grid",gap:2}}>
                    {MINUTES.map(m => (
                      <button key={m} type="button" onClick={()=>selectTime(hour, m)} style={{
                        padding:"5px 8px",borderRadius:6,border:"none",cursor:"pointer",fontSize:12,fontWeight:600,textAlign:"left",
                        background:minute===m?"var(--accent)":"transparent",
                        color:minute===m?"#fff":"var(--text)",
                      }}>:{String(m).padStart(2,"0")}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div style={{borderTop:`1px solid var(--border)`,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontSize:12,color:"var(--muted)",fontWeight:500}}>
              {displayVal ? `${displayVal.date} ${displayVal.time}` : "No date selected"}
            </span>
            <button type="button" onClick={confirm} style={{
              background:"var(--accent)",color:"#fff",border:"none",borderRadius:8,
              padding:"6px 16px",fontSize:12,fontWeight:700,cursor:"pointer",
            }}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}


function startOfMonth(year, month) { return new Date(year, month, 1); }
function daysInMonth(year, month)  { return new Date(year, month+1, 0).getDate(); }

const PANEL_W = 440;

// ── Main Component ───────────────────────────────────────────────────────────
export default function SchedulePage() {
  const { user } = useAuth();
  const sid = user?.school_id;
  const qc  = useQueryClient();
  const navigate = useNavigate();
  const isAdmin = ["superadmin","school_admin","teacher"].includes(user?.role);

  // Recital-type events open the full RecitalsPage detail view; all others show local side panel
  const handleEventClick = (ev) => {
    if (ev?.type === "Recital") {
      navigate('/recitals', { state: { openTitle: ev.title } });
      return;
    }
    setDetailEvent(ev);
  };

  // Calendar state
  const [view, setView]       = useState("month"); // month | week | list
  const [today]               = useState(new Date());
  const [cursor, setCursor]   = useState(new Date());

  // Modal state
  const [modal, setModal]     = useState(null);  // null | {} | event obj
  const [form, setForm]       = useState(EMPTY_FORM);
  const [detailEvent, setDetailEvent] = useState(null);

  // Filters
  const [filterType, setFilterType] = useState("All");
  const [studioOnly, setStudioOnly] = useState(false);
  const [showLegend, setShowLegend] = useState(false);

  // Date range to fetch
  const { from, to } = useMemo(() => {
    const y = cursor.getFullYear(), m = cursor.getMonth();
    if (view === "month") {
      return { from: new Date(y, m-1, 20).toISOString(), to: new Date(y, m+2, 10).toISOString() };
    }
    // week view: Monday 00:00 – Sunday 23:59:59
    const dow = cursor.getDay();
    const mon = new Date(cursor); mon.setDate(cursor.getDate() - ((dow+6)%7)); mon.setHours(0,0,0,0);
    const sun = new Date(mon);    sun.setDate(mon.getDate() + 6);              sun.setHours(23,59,59,999);
    return { from: mon.toISOString(), to: sun.toISOString() };
  }, [cursor, view]);

  // Wide range for list view (~4 months window)
  const listFrom = useMemo(() => new Date(today.getFullYear(), today.getMonth()-1, 20).toISOString(), [today]);
  const listTo   = useMemo(() => new Date(today.getFullYear(), today.getMonth()+3, 10).toISOString(), [today]);

  const { data: rawEvents=[], isLoading } = useQuery({
    queryKey: ["events", sid, view==="list"?listFrom:from, view==="list"?listTo:to],
    queryFn:  () => api.list(sid, { from: view==="list"?listFrom:from, to: view==="list"?listTo:to }),
    enabled:  !!sid,
  });

  const { data: batches=[] } = useQuery({
    queryKey: ["batches", sid],
    queryFn:  () => batchesApi.list(sid),
    enabled:  !!sid,
  });

  // Apply filters
  const events = useMemo(() => rawEvents.filter(e => {
    if (filterType !== "All" && e.type !== filterType) return false;
    if (studioOnly && !e.requires_studio) return false;
    return true;
  }), [rawEvents, filterType, studioOnly]);

  // ── Mutations ────────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: data => modal?.id ? api.update(sid, modal.id, data) : api.create(sid, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events"], exact: false });
      toast.success(modal?.id ? "Event updated" : "Event(s) created");
      setModal(null);
    },
    onError: err => toast.error(err.error || "Failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: id => api.remove(sid, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events"], exact: false });
      toast.success("Event deleted");
      setDetailEvent(null);
    },
    onError: err => toast.error(err.error || "Failed"),
  });

  // ── Open modals ──────────────────────────────────────────────────────────
  const openAdd = (prefillDate) => {
    const base = prefillDate ? new Date(prefillDate) : new Date();
    base.setMinutes(0, 0, 0);
    const end = new Date(base); end.setHours(base.getHours() + 1);
    setForm({ ...EMPTY_FORM, start_datetime: toLocalInput(base), end_datetime: toLocalInput(end) });
    setModal({});
  };

  const openEdit = e => {
    setForm({
      title: e.title||"", type: e.type||"Class", batch_ids: (e.batches||[]).map(b=>b.id),
      start_datetime: toLocalInput(e.start_datetime), end_datetime: toLocalInput(e.end_datetime),
      location: e.location||"", requires_studio: !!e.requires_studio,
      studio_booked: !!e.studio_booked, recurrence:"none", recurrence_end:"",
      color: e.color||"", notes: e.notes||"",
    });
    setModal(e);
    setDetailEvent(null);
  };

  // ── Navigation ───────────────────────────────────────────────────────────
  const navCalendar = dir => {
    const d = new Date(cursor);
    if (view === "month") d.setMonth(d.getMonth() + dir);
    else                  d.setDate(d.getDate() + dir * 7);
    setCursor(d);
  };

  const label = view === "month"
    ? `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`
    : (() => {
        const dow = cursor.getDay();
        const mon = new Date(cursor); mon.setDate(cursor.getDate() - ((dow+6)%7));
        const sun = new Date(mon);    sun.setDate(mon.getDate() + 6);
        return `${mon.toLocaleDateString([],{month:"short",day:"numeric"})} – ${sun.toLocaleDateString([],{month:"short",day:"numeric",year:"numeric"})}`;
      })();

  // ── Event card ───────────────────────────────────────────────────────────
  const EventPill = ({ event, compact }) => {
    const color = event.color || TYPE_COLORS[event.type] || "#8a7a9a";
    return (
      <div
        onClick={e => { e.stopPropagation(); handleEventClick(event); }}
        title={event.title}
        style={{
          background: color+"22", borderLeft: `3px solid ${color}`,
          borderRadius: 5, padding: compact ? "10px 5px" : "4px 7px",
          fontSize: compact ? 10 : 11, fontWeight: 600, color: "#1e1228",
          cursor: "pointer", overflow: "hidden", textOverflow: "ellipsis",
          whiteSpace: "nowrap", marginBottom: 2, lineHeight: 1.4,
          display: "flex", alignItems: "center", gap: 4,
        }}
      >
        {event.requires_studio && <span title="Studio required">🏠</span>}
        {!event.studio_booked && event.requires_studio && <span title="Not yet booked" style={{color:"#e05c6a"}}>!</span>}
        <span style={{overflow:"hidden",textOverflow:"ellipsis"}}>{compact ? "" : fmtTime(event.start_datetime)+" "}{event.title}</span>
      </div>
    );
  };

  // ── Month grid ───────────────────────────────────────────────────────────
  const MonthView = () => {
    const y = cursor.getFullYear(), m = cursor.getMonth();
    const firstDay = startOfMonth(y, m).getDay();
    const totalDays = daysInMonth(y, m);
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= totalDays; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);

    const eventsOnDay = (day) => {
      if (!day) return [];
      const dateStr = `${y}-${String(m+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
      return events.filter(e => e.start_datetime?.slice(0,10) === dateStr);
    };

    const isToday = d => d && y === today.getFullYear() && m === today.getMonth() && d === today.getDate();

    return (
      <div>
        {/* Day headers */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:1,marginBottom:1}}>
          {DAYS.map(d => (
            <div key={d} style={{textAlign:"center",fontSize:11,fontWeight:700,color:"var(--muted)",padding:"6px 0",letterSpacing:"0.05em"}}>{d}</div>
          ))}
        </div>
        {/* Day cells */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:1,background:"var(--border)",borderRadius:12,overflow:"hidden"}}>
          {cells.map((day, i) => {
            const dayEvents = eventsOnDay(day);
            const visible = dayEvents.slice(0,2);
            const overflow = dayEvents.length - 2;
            return (
              <div
                key={i}
                onClick={() => day && isAdmin && openAdd(new Date(y, m, day))}
                style={{
                  background: day ? "#fff" : "#f8f4f9",
                  minHeight: 100, padding: "6px 5px",
                  cursor: day && isAdmin ? "pointer" : "default",
                }}
              >
                {day && (
                  <>
                    <div style={{
                      fontSize: 12, fontWeight: isToday(day) ? 800 : 500,
                      color: isToday(day) ? "#fff" : "var(--text)",
                      background: isToday(day) ? "var(--accent)" : "transparent",
                      width: 22, height: 22, borderRadius: "50%",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      marginBottom: 4,
                    }}>{day}</div>
                    {visible.map(e => <EventPill key={e.id} event={e} compact />)}
                    {overflow > 0 && (
                      <div style={{fontSize:10,color:"var(--muted)",padding:"1px 4px"}}>+{overflow} more</div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ── Week view ────────────────────────────────────────────────────────────
  const WeekView = () => {
    const dow = cursor.getDay();
    const mon = new Date(cursor); mon.setDate(cursor.getDate() - ((dow+6)%7));
    const weekDays = Array.from({length:7}, (_,i) => { const d=new Date(mon); d.setDate(mon.getDate()+i); return d; });
    const eventsOnDay = (date) => {
      const str = date.toISOString().slice(0,10);
      return events.filter(e => e.start_datetime?.slice(0,10) === str)
                   .sort((a,b) => a.start_datetime.localeCompare(b.start_datetime));
    };
    return (
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:12,height:"calc(100vh - 350px)",minHeight:600}}>
        {weekDays.map((date,i) => {
          const isToday = date.toDateString() === today.toDateString();
          const dayEvs = eventsOnDay(date);
          return (
            <div key={i} style={{display:"flex",flexDirection:"column"}}>
              <div style={{textAlign:"center",marginBottom:12}}>
                <div style={{fontSize:11,color:"var(--muted)",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.05em"}}>{DAYS[i]}</div>
                <div style={{
                  width:40,height:40,borderRadius:"50%",margin:"6px auto 0",
                  background:isToday?"var(--accent)":"transparent",
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:14,fontWeight:isToday?800:600,color:isToday?"#fff":"var(--text)",
                  border:isToday?"none":"1px solid var(--border)",
                }}>{date.getDate()}</div>
              </div>
              <div
                onClick={() => isAdmin && openAdd(date)}
                style={{
                  flex:1,background:"#fff",borderRadius:12,padding:10,border:"1.5px solid var(--border)",
                  cursor:isAdmin?"pointer":"default",
                  overflow:"auto",display:"flex",flexDirection:"column",gap:8,
                  transition:"all .15s"
                }}
              >
                {dayEvs.map(e => {
                  const color = e.color || TYPE_COLORS[e.type] || "#8a7a9a";
                  const noStudio = e.requires_studio && !e.studio_booked;
                  return (
                    <div key={e.id}
                      onClick={ev => { ev.stopPropagation(); handleEventClick(e); }}
                      style={{
                        background: color+"15", border: `2px solid ${color}`,
                        borderRadius: 10, padding: "10px 12px",
                        fontSize: 12, fontWeight: 700, color: "#1e1228",
                        cursor: "pointer", transition: "all .15s",
                        display:"flex",alignItems:"flex-start",gap:8,
                      }}
                      onMouseEnter={ev => { ev.currentTarget.style.background = color+"28"; ev.currentTarget.style.boxShadow = `0 4px 12px ${color}33`; }}
                      onMouseLeave={ev => { ev.currentTarget.style.background = color+"15"; ev.currentTarget.style.boxShadow = "none"; }}
                    >
                      <div style={{flexShrink:0,fontSize:20,lineHeight:1,marginTop:2}}>
                        {e.requires_studio ? "🏠" : e.type === "Class" ? "📚" : e.type === "Recital" ? "🎭" : e.type === "Rehearsal" ? "🎵" : "📅"}
                        {noStudio && <div style={{fontSize:12,color:"#e05c6a",position:"relative",top:-8,left:-6}}>!</div>}
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontWeight:700,fontSize:12,marginBottom:2}}>{e.title}</div>
                        <div style={{fontSize:10,color:"var(--muted)",fontWeight:500}}>{fmtTime(e.start_datetime)}</div>
                      </div>
                    </div>
                  );
                })}
                {dayEvs.length === 0 && <div style={{color:"var(--muted)",fontSize:11,textAlign:"center",flex:1,display:"flex",alignItems:"center",justifyContent:"center"}}>No events</div>}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ── List view ────────────────────────────────────────────────────────────
  const ListView = () => {
    const grouped = {};
    events.forEach(e => {
      const d = e.start_datetime?.slice(0,10);
      if (!grouped[d]) grouped[d] = [];
      grouped[d].push(e);
    });
    const sortedDates = Object.keys(grouped).sort();
    if (!sortedDates.length) return <p style={{color:"var(--muted)",textAlign:"center",marginTop:40}}>No events in this period.</p>;
    return (
      <div>
        {sortedDates.map(date => (
          <div key={date} style={{marginBottom:20}}>
            <div style={{fontSize:11,fontWeight:700,color:"var(--muted)",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8,padding:"0 2px"}}>
              {new Date(date).toLocaleDateString([],{weekday:"long",month:"long",day:"numeric"})}
            </div>
            <div style={{display:"grid",gap:7}}>
              {grouped[date].sort((a,b)=>a.start_datetime.localeCompare(b.start_datetime)).map(e => {
                const color = e.color || TYPE_COLORS[e.type] || "#8a7a9a";
                return (
                  <Card key={e.id} onClick={()=>handleEventClick(e)} style={{display:"flex",alignItems:"center",gap:13,padding:13,cursor:"pointer",borderLeft:`4px solid ${color}`}}>
                    <div style={{minWidth:60,textAlign:"center"}}>
                      <div style={{fontWeight:700,fontSize:13}}>{fmtTime(e.start_datetime)}</div>
                      <div style={{fontSize:10,color:"var(--muted)"}}>{fmtTime(e.end_datetime)}</div>
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:700,fontSize:13}}>{e.title}</div>
                      <div style={{fontSize:11,color:"var(--muted)",display:"flex",gap:8,flexWrap:"wrap",marginTop:2}}>
                        {(e.batches?.length ? e.batches.map(b=>b.name).join(', ') : e.batch_name) && <span>📚 {e.batches?.length ? e.batches.map(b=>b.name).join(', ') : e.batch_name}</span>}
                        {e.location   && <span>📍 {e.location}</span>}
                      </div>
                    </div>
                    <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0}}>
                      <Badge color={color}>{e.type}</Badge>
                      {e.requires_studio && (
                        <Badge color={e.studio_booked?"#52c4a0":"#e05c6a"}>
                          {e.studio_booked ? "Studio ✓" : "Studio ⚠"}
                        </Badge>
                      )}
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

  // ── Studio sidebar ───────────────────────────────────────────────────────
  const unbookedStudio = events.filter(e => e.requires_studio && !e.studio_booked);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ paddingRight: detailEvent ? PANEL_W + 20 : 0, transition:"padding .25s ease" }}>
      {/* Main calendar */}
        {/* Header */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18,flexWrap:"wrap",gap:10}}>
          <div>
            <h1 style={{fontFamily:"var(--font-d)",fontSize:24,marginBottom:2}}>My Events</h1>
            <p style={{color:"var(--muted)",fontSize:12}}>Click any day to add an event</p>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginLeft:"auto"}}>
            {/* View toggle */}
            {["month","week","list"].map(v => (
              <button key={v} onClick={()=>setView(v)} style={{
                padding:"6px 14px",borderRadius:8,border:"1.5px solid var(--border)",fontSize:12,fontWeight:600,cursor:"pointer",
                background:view===v?"var(--accent)":"#fff",color:view===v?"#fff":"var(--text)",
              }}>{v.charAt(0).toUpperCase()+v.slice(1)}</button>
            ))}
            {isAdmin && <Button onClick={()=>openAdd()} icon="➕" size="sm">Add Event</Button>}
          </div>
        </div>

        {/* Filters */}
        <div style={{display:"flex",gap:8,marginBottom:14,alignItems:"center",flexWrap:"wrap"}}>
          {["All",...EVENT_TYPES].map(t => {
            const color = TYPE_COLORS[t] || "var(--muted)";
            const active = filterType===t;
            return (
              <button key={t} onClick={()=>setFilterType(t)} style={{
                padding:"4px 12px",borderRadius:20,border:`1.5px solid ${active?color:"var(--border)"}`,
                fontSize:11,fontWeight:700,cursor:"pointer",
                background:active?color+"22":"transparent",color:active?color:"var(--muted)",
              }}>{t}</button>
            );
          })}
          <button onClick={()=>setStudioOnly(!studioOnly)} style={{
            padding:"4px 12px",borderRadius:20,fontSize:11,fontWeight:700,cursor:"pointer",
            border:`1.5px solid ${studioOnly?"#e05c6a":"var(--border)"}`,
            background:studioOnly?"#e05c6a22":"transparent",color:studioOnly?"#e05c6a":"var(--muted)",
          }}>🏠 Studio needed</button>

          {/* Legend link */}
          <div style={{position:"relative",marginLeft:4}}>
            <button onClick={()=>setShowLegend(p=>!p)} style={{
              background:"none",border:"none",fontSize:11,fontWeight:600,
              color:"var(--muted)",cursor:"pointer",textDecoration:"underline",
              textDecorationStyle:"dotted",padding:"4px 2px",
            }}>colour guide</button>
            {showLegend && (
              <>
                <div onClick={()=>setShowLegend(false)} style={{position:"fixed",inset:0,zIndex:99}} />
                <div style={{
                  position:"absolute",top:"calc(100% + 8px)",left:0,zIndex:100,
                  background:"#fff",borderRadius:12,padding:14,width:200,
                  boxShadow:"0 8px 32px rgba(0,0,0,0.14)",border:"1px solid var(--border)",
                }}>
                  <div style={{fontWeight:700,fontSize:11,marginBottom:9,color:"var(--text)"}}>Event Types</div>
                  {EVENT_TYPES.map(t => (
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

        {/* Navigation */}
        {view !== "list" && (
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
          <button onClick={()=>navCalendar(-1)} style={{background:"var(--surface)",border:"none",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:16}}>‹</button>
          <span style={{fontFamily:"var(--font-d)",fontSize:16,fontWeight:700,minWidth:200,textAlign:"center"}}>{label}</span>
          <button onClick={()=>navCalendar(1)} style={{background:"var(--surface)",border:"none",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:16}}>›</button>
          <button onClick={()=>setCursor(new Date())} style={{background:"var(--surface)",border:"none",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:12,fontWeight:600,color:"var(--muted)"}}>Today</button>
        </div>
        )}

        {isLoading ? <p style={{color:"var(--muted)"}}>Loading…</p> : (
          view==="month" ? <MonthView /> : view==="week" ? <WeekView /> : <ListView />
        )}


      {/* Studio booking alerts — inline banner */}
      {unbookedStudio.length > 0 && (
        <div style={{marginTop:18,padding:"12px 16px",borderRadius:12,background:"#e05c6a08",border:"1.5px solid #e05c6a33",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
          <span style={{fontWeight:700,fontSize:12,color:"#e05c6a",flexShrink:0}}>⚠ Studio not booked:</span>
          <div style={{display:"flex",gap:7,flexWrap:"wrap",flex:1}}>
            {unbookedStudio.map(e => (
              <div key={e.id} onClick={()=>handleEventClick(e)} style={{fontSize:11,cursor:"pointer",padding:"4px 10px",borderRadius:20,background:"#fff",border:"1px solid #e05c6a44",fontWeight:600,color:"#e05c6a"}}>
                {e.title} · <span style={{fontWeight:400,color:"var(--muted)"}}>{fmtDate(e.start_datetime)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Add/Edit Modal ── */}
      {modal !== null && (
        <Modal title={modal.id ? "Edit Event" : "New Event"} onClose={()=>setModal(null)} wide>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
            <Field label="Title *" style={{gridColumn:"1/-1"}}>
              <Input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="e.g. Junior Ballet Class" style={{width:"100%"}} />
            </Field>
            <Field label="Event Type">
              <Select value={form.type} onChange={e=>setForm({...form,type:e.target.value})}>
                {EVENT_TYPES.map(t=><option key={t}>{t}</option>)}
              </Select>
            </Field>
            <div style={{gridColumn:"1/-1"}}>
              <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.07em",textTransform:"uppercase",color:"var(--muted)",marginBottom:6}}>Batches (optional)</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
                {batches.map(b => {
                  const checked = form.batch_ids.includes(b.id) || form.batch_ids.includes(String(b.id));
                  return (
                    <button key={b.id} type="button" onClick={()=>{
                      const id = b.id;
                      setForm(f => ({
                        ...f,
                        batch_ids: checked
                          ? f.batch_ids.filter(x => x !== id && x !== String(id))
                          : [...f.batch_ids, id]
                      }));
                    }} style={{
                      display:"inline-flex",alignItems:"center",gap:6,
                      padding:"5px 13px",borderRadius:20,cursor:"pointer",fontSize:12,fontWeight:700,
                      border:`1.5px solid ${checked?"#6a7fdb":"var(--border)"}`,
                      background:checked?"#6a7fdb22":"transparent",
                      color:checked?"#6a7fdb":"var(--muted)",transition:"all .12s",
                    }}>
                      {checked && <span>✓</span>}
                      {b.name}
                    </button>
                  );
                })}
                {batches.length === 0 && <span style={{fontSize:12,color:"var(--muted)"}}>No batches yet</span>}
              </div>
            </div>
            <DateTimePicker label="Start *" value={form.start_datetime} onChange={v=>setForm({...form,start_datetime:v})} />
            <DateTimePicker label="End *"   value={form.end_datetime}   onChange={v=>setForm({...form,end_datetime:v})} />
            <Field label="Location / Room">
              <Input value={form.location} onChange={e=>setForm({...form,location:e.target.value})} placeholder="e.g. Studio A" />
            </Field>
            <Field label="Repeat">
              <Select value={form.recurrence} onChange={e=>setForm({...form,recurrence:e.target.value})} disabled={!!modal.id}>
                <option value="none">No repeat</option>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Every 2 weeks</option>
              </Select>
            </Field>
            {form.recurrence !== "none" && !modal.id && (
              <DateTimePicker label="Repeat Until" value={form.recurrence_end ? form.recurrence_end+"T00:00" : ""} onChange={v=>setForm({...form,recurrence_end:v.slice(0,10)})} />
            )}
          </div>

          {/* Studio booking */}
          <div style={{display:"flex",gap:16,margin:"10px 0",padding:12,background:"var(--surface)",borderRadius:10}}>
            <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:13}}>
              <input type="checkbox" checked={form.requires_studio} onChange={e=>setForm({...form,requires_studio:e.target.checked})}
                style={{width:16,height:16,accentColor:"var(--accent)"}} />
              <span>🏠 Requires studio booking</span>
            </label>
            {form.requires_studio && (
              <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:13}}>
                <input type="checkbox" checked={form.studio_booked} onChange={e=>setForm({...form,studio_booked:e.target.checked})}
                  style={{width:16,height:16,accentColor:"#52c4a0"}} />
                <span style={{color:"#52c4a0",fontWeight:600}}>✓ Studio confirmed</span>
              </label>
            )}
          </div>

          <Field label="Notes">
            <Textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} />
          </Field>

          <div style={{display:"flex",gap:9,marginTop:8}}>
            <Button onClick={()=>saveMutation.mutate(form)} disabled={!form.title||!form.start_datetime||!form.end_datetime||saveMutation.isPending}>
              {saveMutation.isPending ? "Saving…" : modal.id ? "Save Changes" : form.recurrence!=="none" ? "Create Recurring Events" : "Create Event"}
            </Button>
            <Button variant="outline" onClick={()=>setModal(null)}>Cancel</Button>
          </div>
        </Modal>
      )}

      {/* ── Event Detail Panel ── */}
      {detailEvent && (() => {
        const e = detailEvent;
        const color = e.color || TYPE_COLORS[e.type] || "#8a7a9a";
        return (
          <div style={{
            position:"fixed", right:0, top:0, bottom:0, width:PANEL_W,
            background:"var(--card)", borderLeft:"1.5px solid var(--border)",
            display:"flex", flexDirection:"column", zIndex:300,
            boxShadow:"-6px 0 32px rgba(0,0,0,.09)",
          }}>
            {/* Panel header */}
            <div style={{ padding:"16px 20px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
              <span style={{ fontSize:11, fontWeight:700, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".08em" }}>Event Details</span>
              <button onClick={()=>setDetailEvent(null)}
                style={{ background:"none", border:"none", fontSize:18, cursor:"pointer", color:"var(--muted)", lineHeight:1, padding:4, borderRadius:6 }}>✕</button>
            </div>

            {/* Event hero */}
            <div style={{ padding:"22px 22px 18px", borderBottom:"1px solid var(--border)", flexShrink:0, background:"var(--surface)" }}>
              <div style={{ display:"flex", alignItems:"flex-start", gap:12, marginBottom:12 }}>
                <div style={{ width:6, height:48, borderRadius:3, background:color, flexShrink:0, marginTop:2 }} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontFamily:"var(--font-d)", fontSize:18, fontWeight:800, marginBottom:8, lineHeight:1.2 }}>{e.title}</div>
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                    <Badge color={color}>{e.type}</Badge>
                    {e.requires_studio && <Badge color={e.studio_booked?"#52c4a0":"#e05c6a"}>{e.studio_booked?"Studio ✓":"Studio ⚠"}</Badge>}
                  </div>
                </div>
              </div>
            </div>

            {/* Scrollable body */}
            <div style={{ flex:1, overflowY:"auto", padding:"20px 22px" }}>

              <div style={{ display:"grid", gap:14, marginBottom:20 }}>
                <PDetailRow icon="📅" label="Date">{fmtDate(e.start_datetime)}</PDetailRow>
                <PDetailRow icon="⏰" label="Time">{fmtTime(e.start_datetime)} – {fmtTime(e.end_datetime)}</PDetailRow>
                {e.location && <PDetailRow icon="📍" label="Location">{e.location}</PDetailRow>}
                {(e.batches?.length > 0 || e.batch_name) && (
                  <PDetailRow icon="📚" label={`Batch${(e.batches?.length||0) > 1 ? "es" : ""}`}>
                    <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:4}}>
                      {(e.batches?.length ? e.batches : [{id:e.batch_id, name:e.batch_name}]).map(b => {
                        const full = batches.find(x => x.id===b.id || String(x.id)===String(b.id));
                        return (
                          <button key={b.id} type="button"
                            onClick={()=>{ setDetailEvent(null); navigate("/batches"); }}
                            style={{
                              display:"inline-flex",alignItems:"center",gap:5,
                              background:"#6a7fdb15",border:"1.5px solid #6a7fdb44",
                              borderRadius:20,padding:"4px 13px",cursor:"pointer",
                              fontSize:12,fontWeight:700,color:"#6a7fdb",transition:"all .15s",
                            }}
                            onMouseEnter={ev=>{ev.currentTarget.style.background="#6a7fdb28";ev.currentTarget.style.borderColor="#6a7fdb99";}}
                            onMouseLeave={ev=>{ev.currentTarget.style.background="#6a7fdb15";ev.currentTarget.style.borderColor="#6a7fdb44";}}
                          >
                            {b.name}
                            {full && <span style={{fontSize:10,fontWeight:400,color:"#6a7fdb99"}}>· {full.student_count} students</span>}
                            <span style={{fontSize:10,opacity:0.5}}>→</span>
                          </button>
                        );
                      })}
                    </div>
                  </PDetailRow>
                )}
                {e.notes && <PDetailRow icon="📝" label="Notes">{e.notes}</PDetailRow>}
              </div>

              {e.requires_studio && (
                <div style={{ padding:"12px 14px", borderRadius:10, background:e.studio_booked?"#52c4a008":"#e05c6a08", border:`1.5px solid ${e.studio_booked?"#52c4a033":"#e05c6a33"}`, marginBottom:20 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:e.studio_booked?"#52c4a0":"#e05c6a" }}>
                    {e.studio_booked ? "✓ Studio booking confirmed" : "⚠ Studio booking needed"}
                  </div>
                </div>
              )}

              {isAdmin && (
                <div style={{ display:"flex", flexDirection:"column", gap:9, borderTop:"1px solid var(--border)", paddingTop:20 }}>
                  <button onClick={()=>openEdit(e)} style={{
                    padding:"9px 16px", borderRadius:9, border:"1.5px solid var(--accent)",
                    background:"var(--accent)", color:"#fff", cursor:"pointer", fontSize:13, fontWeight:600,
                  }}>✏️ Edit Event</button>
                  {e.requires_studio && !e.studio_booked && (
                    <button onClick={()=>{ api.update(sid,e.id,{...e,studio_booked:true}).then(()=>{ qc.invalidateQueries({queryKey:["events"],exact:false}); setDetailEvent({...e,studio_booked:true}); toast.success("Studio marked as booked!"); }); }} style={{
                      padding:"9px 16px", borderRadius:9, border:"1.5px solid #52c4a0",
                      background:"transparent", color:"#52c4a0", cursor:"pointer", fontSize:13, fontWeight:600,
                    }}>✓ Mark Studio Booked</button>
                  )}
                  <button onClick={()=>{ if(window.confirm("Delete this event?")) deleteMutation.mutate(e.id); }} style={{
                    padding:"9px 16px", borderRadius:9, border:"1.5px solid #e05c6a",
                    background:"transparent", color:"#e05c6a", cursor:"pointer", fontSize:13, fontWeight:600,
                  }}>🗑 Delete Event</button>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function PDetailRow({ icon, label, children }) {
  return (
    <div style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
      <span style={{ fontSize:16, flexShrink:0, width:22, textAlign:"center", marginTop:1 }}>{icon}</span>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:10, color:"var(--muted)", fontWeight:700, textTransform:"uppercase", letterSpacing:".05em", marginBottom:3 }}>{label}</div>
        <div style={{ fontSize:13, fontWeight:500, color:"var(--text)" }}>{children}</div>
      </div>
    </div>
  );
}
