// @ts-nocheck
'use client';

import { useRouter, useParams, usePathname, useSearchParams } from "next/navigation";
import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/context/AuthContext";
import { useTheme } from "@/lib/context/ThemeContext";
import { events as api, batches as batchesApi, recitals as recitalApi, studios as studiosApi, schedules as schedulesApi, scheduleExceptions as exceptionsApi, attendance as attendanceApi } from "@/lib/api";
import toast from "react-hot-toast";
import Card from "@/components/shared/Card";
import Button from "@/components/shared/Button";
import Badge from "@/components/shared/Badge";
import { Field, Input, Select, Textarea } from "@/components/shared/Field";
import SmartButton from "@/components/smart/SmartButton";
import SmartAddModal from "@/components/smart/SmartAddModal";
import SmartAnnounceModal from "@/components/smart/SmartAnnounceModal";
import AttendanceModal from "@/components/attendance/AttendanceModal";
import { RecitalDetail } from "../recitals/page";
import SvgIcon from "@/components/shared/SvgIcon";

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

const DAYS  = ["Su","Mo","Tu","We","Th","Fr","Sa"];
const MONTHS = ["January","February","March","April","May","June",
                "July","August","September","October","November","December"];

const EMPTY_FORM = {
  title:"", type:"Class", batch_ids:[], start_datetime:"", end_datetime:"", duration:60,
  location:"", requires_studio:false, studio_booked:false,
  recurrence:"none", recurrence_end:"", color:"", notes:"",
};

// ── Time options for recital forms: 15-min increments, 12h display ──────────
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

function fmtRecitalTime(t) {
  if (!t) return null;
  if (/[ap]m/i.test(t)) return t;
  const [h, m] = t.split(':').map(Number);
  if (isNaN(h)) return t;
  return new Date(2000, 0, 1, h, m || 0).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
}

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
function computeEndFromDuration(startStr, durationMins) {
  if (!startStr || !durationMins) return "";
  const s = new Date(startStr);
  if (isNaN(s)) return "";
  return toLocalInput(new Date(s.getTime() + Number(durationMins) * 60000));
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
  const [hour, setHour]     = useState(() => parsed ? parsed.getHours() : 18);
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

  // Build calendar grid (week starts Sunday: Sun=0 … Sat=6)
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
        background:"var(--surface)",border:`1.5px solid ${open?"var(--accent)":"var(--border)"}`,
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
        <SvgIcon name="calendar" size={14} color="var(--muted)" style={{flexShrink:0}} />
      </button>

      {/* Popover */}
      {open && (
        <div style={{
          position:"absolute",top:"calc(100% + 8px)",left:0,zIndex:300,
          background:"var(--card)",borderRadius:16,
          boxShadow:"0 12px 40px rgba(0,0,0,0.16)",border:"1px solid var(--border)",
          width:300,overflow:"hidden",
        }}>
          {/* Tabs */}
          <div style={{display:"flex",borderBottom:`1px solid var(--border)`}}>
            {["date","time"].map(t => (
              <button key={t} type="button" onClick={()=>setTab(t)} style={{
                flex:1,padding:"11px 0",fontSize:12,fontWeight:700,border:"none",cursor:"pointer",
                background:tab===t?"var(--card)":"var(--surface)",
                color:tab===t?"var(--accent)":"var(--muted)",
                borderBottom:tab===t?"2px solid var(--accent)":"2px solid transparent",
              }}>{t==="date"?"Date":"Time"}</button>
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
            <Button type="button" size="sm" onClick={confirm}>Done</Button>
          </div>
        </div>
      )}
    </div>
  );
}


function startOfMonth(year, month) { return new Date(year, month, 1); }
function daysInMonth(year, month)  { return new Date(year, month+1, 0).getDate(); }

const PANEL_W = 440;

// ── useWindowWidth ────────────────────────────────────────────────────────────
function useWindowWidth() {
  const [w, setW] = useState(() => typeof window !== 'undefined' ? window.innerWidth : 1024);
  useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return w;
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function SchedulePage() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const sid = user?.school_id;
  const qc  = useQueryClient();
  const router = useRouter();
  const location = usePathname();
  const searchParams = useSearchParams();
  const windowWidth = useWindowWidth();
  const isMobile = windowWidth < 768; // matches AppShell mobile breakpoint
  const isAdmin = ["superadmin","school_admin","teacher"].includes(user?.role);

  // Inline recital detail state
  const [recitalDetailId, setRecitalDetailId] = useState(null);
  const [recitalFrom, setRecitalFrom] = useState(null);

  // If navigated here with ?recitalId=… (e.g. from dashboard), open it directly.
  // Next.js doesn't support React-Router-style {state} on push, so the dashboard
  // passes these as query params instead.
  useEffect(() => {
    const recitalIdQ = searchParams.get('recitalId');
    if (recitalIdQ) {
      setRecitalDetailId(Number(recitalIdQ) || recitalIdQ);
      setRecitalFrom(searchParams.get('from') || null);
      // Strip the param so the URL stays clean and back-nav doesn't re-trigger
      router.replace('/schedule');
      return;
    }
    const goToDate = searchParams.get('goToDate');
    if (goToDate) {
      // Parse as local date (not UTC) to avoid off-by-one day across timezones
      const [yr, mo, dy] = goToDate.split('-').map(Number);
      const d = new Date(yr, mo - 1, dy);
      if (!isNaN(d as any)) { setCursor(d); setSelectedDay(d); }
      router.replace('/schedule');
    }
  }, [searchParams]); // eslint-disable-line


  // Recitals are the single source of truth for Recital-type events.
  // They are fetched separately and merged into the calendar display.
  const { data: recitalsList = [] } = useQuery({
    queryKey: ["recitals", sid],
    queryFn:  () => recitalApi.list(sid),
    enabled:  !!sid,
  });

  // Event click handler:
  // _isRecital (from recitals table) → full-page detail via direct ID
  // Legacy Recital event (events table, no recital record yet) → auto-create then show detail
  // All others → side panel
  const handleEventClick = async (ev) => {
    if (ev?._isRecital) {
      setRecitalDetailId(ev._recitalId);
      return;
    }
    if (ev?.type === "Recital") {
      // Legacy event — auto-promote to a recital record
      try {
        const created = await recitalApi.create(sid, {
          title:       ev.title,
          event_date:  ev.start_datetime ? ev.start_datetime.slice(0, 10) : new Date().toISOString().slice(0, 10),
          venue:       ev.location || "",
          status:      "Planning",
          description: ev.notes   || "",
        });
        qc.invalidateQueries({ queryKey: ["recitals", sid] });
        if (created?.id) { setRecitalDetailId(created.id); return; }
      } catch (err) {
        toast.error("Could not open recital: " + (err?.error || err?.message || "unknown error"));
      }
    }
    setDetailEvent(ev);
    setPanelMode('view');
    setInlineSection(null); // collapse any prior inline expansion
  };

  // Calendar state
  const [view, setView]       = useState("month"); // month | week | list
  const [today]               = useState(new Date());
  const [cursor, setCursor]   = useState(new Date());

  // Panel state
  const [panelMode, setPanelMode] = useState('view'); // 'view' | 'edit' | 'add' | 'add-recital'
  const [form, setForm]           = useState(EMPTY_FORM);
  const [detailEvent, setDetailEvent] = useState(null);

  // Recital quick-create form (used in 'add-recital' panel mode)
  const EMPTY_RECITAL_FORM = { title:'', event_date:'', event_time:'18:00', venue:'', description:'' };
  const [recitalForm, setRecitalForm] = useState(EMPTY_RECITAL_FORM);

  // Filters
  const [filterType, setFilterType] = useState("All");
  const [filterBatch, setFilterBatch] = useState(null); // batch id or null
  const [studioOnly, setStudioOnly] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [selectedDay, setSelectedDay] = useState(today);
  const [showSmartAdd, setShowSmartAdd] = useState(false);
  const [smartReplyEvent, setSmartReplyEvent] = useState(null);   // event obj or null (overlay modal)
  const [attendanceEvent, setAttendanceEvent] = useState(null);   // event obj or null (overlay modal)
  // Inline dialog inside the panel — only one open at a time.
  // 'attendance' → renders <AttendanceModal inline /> below the action stack
  // 'message'    → renders <SmartAnnounceModal inline /> below the action stack
  const [inlineSection, setInlineSection] = useState(null);
  const [markingAllId, setMarkingAllId] = useState(null);          // event id currently being processed

  // ── Quick "Mark All Present" — fetches the roster and saves everyone as
  // present in a single click. Confirms first since it overwrites any
  // existing marks for that class instance.
  const handleMarkAllPresent = async (event) => {
    if (!sid || !event) return;
    const isSchedule = !!event._isSchedule;
    const eventId = !isSchedule ? event.id : null;
    const scheduleId = isSchedule ? event._scheduleId : null;
    const classDate = String(event.start_datetime || '').slice(0, 10);
    if (!classDate) { toast.error('Class date missing'); return; }

    setMarkingAllId(event.id);
    try {
      // Fetch roster
      const data = isSchedule
        ? await attendanceApi.getForSchedule(String(sid), scheduleId, classDate)
        : await attendanceApi.getForEvent(String(sid), eventId, classDate);

      const students = (data && data.students) || [];
      if (students.length === 0) {
        toast.error('No students in linked batch to mark');
        return;
      }
      const existingMarks = Object.keys((data && data.attendance) || {}).length;
      const ok = window.confirm(
        existingMarks > 0
          ? `Mark all ${students.length} students present? This will overwrite ${existingMarks} existing mark${existingMarks !== 1 ? 's' : ''}.`
          : `Mark all ${students.length} students present in "${event.title}"?`
      );
      if (!ok) return;

      const entries = students.map(s => ({ student_id: s.id, status: 'present' }));
      const body = { class_date: classDate, entries };
      if (isSchedule) {
        await attendanceApi.saveForSchedule(String(sid), scheduleId, body);
      } else {
        await attendanceApi.saveForEvent(String(sid), eventId, body);
      }
      toast.success(`Marked ${students.length} present`);
    } catch (e) {
      toast.error(e?.error || e?.message || 'Failed to mark attendance');
    } finally {
      setMarkingAllId(null);
    }
  };

  // Date range to fetch
  const { from, to } = useMemo(() => {
    const y = cursor.getFullYear(), m = cursor.getMonth();
    if (view === "month") {
      return { from: new Date(y, m-1, 20).toISOString(), to: new Date(y, m+2, 10).toISOString() };
    }
    // week view: Sunday 00:00 – Saturday 23:59:59
    const dow = cursor.getDay();
    const sun = new Date(cursor); sun.setDate(cursor.getDate() - dow);         sun.setHours(0,0,0,0);
    const sat = new Date(sun);    sat.setDate(sun.getDate() + 6);              sat.setHours(23,59,59,999);
    return { from: sun.toISOString(), to: sat.toISOString() };
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

  const { data: studioRooms=[] } = useQuery({
    queryKey: ["studio-rooms", sid],
    queryFn:  () => studiosApi.list(sid).then(r => (r && r.studios) ? r.studios : (Array.isArray(r) ? r : [])),
    enabled:  !!sid,
  });

  const { data: allSchedules=[] } = useQuery({
    queryKey: ["schedules", sid],
    queryFn:  () => schedulesApi.list(sid),
    enabled:  !!sid,
  });

  const { data: allExceptions=[] } = useQuery({
    queryKey: ["schedule-exceptions", sid],
    queryFn:  () => exceptionsApi.list(sid),
    enabled:  !!sid,
  });

  // Convert recitals → calendar event objects (recitals table is single source of truth)
  const recitalEvents = useMemo(() => recitalsList.map(r => ({
    id:             `recital_${r.id}`,
    title:          r.title,
    type:           "Recital",
    start_datetime: r.event_time ? r.event_date.slice(0,10) + 'T' + r.event_time : r.event_date,
    end_datetime:   r.event_time ? r.event_date.slice(0,10) + 'T' + r.event_time : r.event_date,
    location:       r.venue || "",
    notes:          r.description || "",
    _isRecital:     true,
    _recitalId:     r.id,
  })), [recitalsList]);

  // Convert batch schedules (recurring weekly slots) → calendar event instances
  const SCHED_DOW = { Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6, Sun:0 };
  const scheduleEvents = useMemo(() => {
    if (!allSchedules.length || !batches.length) return [];
    const rangeFrom = new Date(view === "list" ? listFrom : from);
    const rangeTo   = new Date(view === "list" ? listTo   : to);
    // Build a set of skipped dates: "scheduleId_YYYY-MM-DD"
    // Normalise exception_date — mysql2 may return DATE as a JS Date object or
    // as a full ISO string; slice to "YYYY-MM-DD" so it matches the ds key.
    const fmtExcDate = (d) => {
      if (!d) return '';
      if (d instanceof Date) return d.toISOString().slice(0, 10);
      return String(d).slice(0, 10);
    };
    const exceptionKeys = new Set(allExceptions.map(ex => `${ex.schedule_id}_${fmtExcDate(ex.exception_date)}`));
    const result = [];
    for (const sch of allSchedules) {
      const batch = batches.find(b => String(b.id) === String(sch.batch_id));
      if (!batch) continue;
      const dow = SCHED_DOW[sch.day_of_week];
      if (dow === undefined) continue;
      // Advance to first matching weekday at or after rangeFrom
      const cur = new Date(rangeFrom);
      const diff = ((dow - cur.getDay()) + 7) % 7;
      cur.setDate(cur.getDate() + diff);
      while (cur <= rangeTo) {
        const ds = `${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,'0')}-${String(cur.getDate()).padStart(2,'0')}`;
        // Skip cancelled instances
        if (!exceptionKeys.has(`${sch.id}_${ds}`)) {
          result.push({
            id:             `sched_${sch.id}_${ds}`,
            title:          batch.name,
            type:           "Class",
            start_datetime: `${ds}T${sch.start_time || "00:00"}`,
            end_datetime:   `${ds}T${sch.end_time   || "01:00"}`,
            location:       sch.room || "",
            batches:        [{ id: batch.id, name: batch.name, student_count: batch.student_count }],
            _isSchedule:    true,
            _scheduleId:    sch.id,
            _batchId:       batch.id,
          });
        }
        cur.setDate(cur.getDate() + 7);
      }
    }
    return result;
  }, [allSchedules, allExceptions, batches, view, from, to, listFrom, listTo]); // eslint-disable-line

  // Merge: explicit events + recitals + batch schedule instances
  const events = useMemo(() => {
    const recitalTitles = new Set(
      recitalsList.map(r => r.title?.toLowerCase().trim()).filter(Boolean)
    );
    // Keep non-Recital events + legacy Recital events that have no recital record yet
    const fromEventsTable = rawEvents.filter(e =>
      e.type !== "Recital" || !recitalTitles.has(e.title?.toLowerCase().trim())
    );
    // Suppress schedule events where a real event already covers the same batch+day
    const realBatchDayKeys = new Set(
      fromEventsTable.flatMap(e =>
        (e.batches || []).map(b => `${b.id}_${(e.start_datetime||'').slice(0,10)}`)
      )
    );
    const filteredScheduleEvents = scheduleEvents.filter(se =>
      !realBatchDayKeys.has(`${se._batchId}_${se.start_datetime.slice(0,10)}`)
    );
    const combined = [...fromEventsTable, ...recitalEvents, ...filteredScheduleEvents];
    return combined.filter(e => {
      if (filterType !== "All" && e.type !== filterType) return false;
      if (studioOnly && !e.requires_studio) return false;
      if (filterBatch !== null) {
        const bids = (e.batches || []).map(b => b.id);
        if (!bids.includes(filterBatch) && !bids.includes(String(filterBatch))) return false;
      }
      return true;
    });
  }, [rawEvents, recitalEvents, recitalsList, scheduleEvents, filterType, studioOnly, filterBatch]);

  // If navigated with ?openEventId=… (e.g. from dashboard THIS WEEK row), jump to date + open panel
  const pendingEventIdRef = useRef(null);
  // Remember the entry origin so Close can route back to /home if the user
  // arrived from the dashboard. We have to stash this in a ref because
  // router.replace below strips the query params from the URL.
  const cameFromDashboardRef = useRef(false);
  useEffect(() => {
    const openEventId = searchParams.get('openEventId');
    if (openEventId) {
      pendingEventIdRef.current = Number(openEventId) || openEventId;
      cameFromDashboardRef.current = searchParams.get('from') === 'dashboard';
      const eventDate = searchParams.get('eventDate');
      if (eventDate) {
        const d = new Date(eventDate);
        if (!isNaN(d as any)) { setCursor(d); setSelectedDay(d); }
      }
      router.replace('/schedule');
    }
  }, []); // eslint-disable-line
  // Match against BOTH real DB events (rawEvents) AND synthetic schedule
  // instances (scheduleEvents). The dashboard sends ids like `sched_42_2026-05-21`
  // for recurring class instances, which previously had no match here and
  // silently failed to open the panel.
  useEffect(() => {
    if (!pendingEventIdRef.current) return;
    const target = String(pendingEventIdRef.current);
    let ev = rawEvents.find(e => String(e.id) === target);
    if (!ev) ev = scheduleEvents.find(e => String(e.id) === target);
    if (ev) {
      pendingEventIdRef.current = null;
      handleEventClick(ev);
      return;
    }
    // Debug: if we've polled both arrays and still don't find it, log so we
    // can diagnose. Only logs when both lists have actually loaded.
    if (rawEvents.length > 0 || scheduleEvents.length > 0) {
      console.warn('[schedule] could not match openEventId', target,
        '— raw events:', rawEvents.length, 'schedule events:', scheduleEvents.length);
    }
  }, [rawEvents, scheduleEvents]); // eslint-disable-line

  // ── Mutations ────────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: data => (panelMode === 'edit' && detailEvent?.id) ? api.update(sid, detailEvent.id, data) : api.create(sid, data),
    onSuccess: async (savedEvent, submittedData) => {
      qc.invalidateQueries({ queryKey: ["events"], exact: false });
      const wasEdit = panelMode === 'edit' && !!detailEvent?.id;
      toast.success(wasEdit ? "Event updated" : "Event(s) created");
      setPanelMode('view');
      if (!wasEdit) {
        setDetailEvent(null);
      } else {
        // Immediately update the detail panel so the user sees the new time/fields
        // without waiting for the background refetch to complete.
        //   prev          → keeps relational fields the API may not echo (batches array, etc.)
        //   submittedData → applies form values as an immediate fallback
        //   savedEvent    → server response is authoritative (overrides both above)
        setDetailEvent(prev => ({
          ...prev,
          ...submittedData,
          ...(savedEvent && !Array.isArray(savedEvent) ? savedEvent : {}),
        }));
      }
      // When a NEW Recital event is created, also create the recital record immediately
      // so the calendar always opens the full-page detail on first click
      if (!wasEdit && submittedData?.type === "Recital") {
        try {
          const date = submittedData.start_datetime || submittedData.event_date;
          await recitalApi.create(sid, {
            title:       submittedData.title,
            event_date:  date ? date.slice(0, 10) : new Date().toISOString().slice(0, 10),
            venue:       submittedData.location || "",
            status:      "Planning",
            description: submittedData.notes   || "",
          });
          qc.invalidateQueries({ queryKey: ["recitals", sid] });
        } catch { /* non-fatal — user can still click to create later */ }
      }
      // Auto-persist free-text location as a quick-add studio if it's new
      if (submittedData?.location) {
        const loc = submittedData.location.trim();
        const alreadyExists = studioRooms.some(s => s.name.toLowerCase() === loc.toLowerCase());
        if (!alreadyExists) {
          studiosApi.create(sid, { name: loc, is_quick_add: 1 }).then(() => {
            qc.invalidateQueries({ queryKey: ["studio-rooms", sid] });
            qc.invalidateQueries({ queryKey: ["studios", sid] });
          }).catch(() => {});
        }
      }
    },
    onError: err => toast.error(err.error || "Failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: id => api.remove(sid, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events"], exact: false });
      toast.success("Event deleted");
      setDetailEvent(null);
      setPanelMode('view');
    },
    onError: err => toast.error(err.error || "Failed"),
  });

  const skipMutation = useMutation({
    mutationFn: ({ scheduleId, date }) => exceptionsApi.create(sid, { schedule_id: scheduleId, exception_date: date }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedule-exceptions", sid] });
      setDetailEvent(null);
      setPanelMode('view');
      toast.success("Class skipped for this date");
    },
    onError: err => toast.error(err?.error || "Failed to skip class"),
  });

  const openOverride = (e) => {
    const base = new Date(e.start_datetime);
    const end  = new Date(e.end_datetime);
    setForm({
      ...EMPTY_FORM,
      title:          e.title,
      type:           "Class",
      batch_ids:      [e._batchId],
      start_datetime: toLocalInput(base),
      end_datetime:   toLocalInput(end),
      duration:       Math.max(15, Math.round((end - base) / 60000)),
      location:       e.location || "",
    });
    setDetailEvent(null);
    setPanelMode('add');
  };

  // ── Recital quick-create mutation ─────────────────────────────────────────
  const recitalSaveMutation = useMutation({
    mutationFn: data => recitalApi.create(sid, data),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ["recitals"], exact: false });
      toast.success("Recital created! Opening details…");
      setPanelMode('view');
      setDetailEvent(null);
      setRecitalForm({ title:'', event_date:'', event_time:'18:00', venue:'', description:'' });
      if (created?.id) setRecitalDetailId(created.id);
    },
    onError: err => toast.error(err?.error || "Failed to create recital"),
  });

  // ── Open panel modes ──────────────────────────────────────────────────────
  const openAddRecital = () => {
    setRecitalForm({ title:'', event_date:'', event_time:'18:00', venue:'', description:'' });
    setDetailEvent(null);
    setPanelMode('add-recital');
  };

  const openAdd = (prefillDate) => {
    const base = prefillDate ? new Date(prefillDate) : new Date();
    base.setHours(18, 0, 0, 0);
    const end = new Date(base); end.setHours(19, 0, 0, 0);
    const favStudio = studioRooms.find(s => s.is_favorite);
    setForm({ ...EMPTY_FORM, start_datetime: toLocalInput(base), end_datetime: toLocalInput(end), duration: 60, location: favStudio?.name || "" });
    setDetailEvent(null);
    setPanelMode('add');
  };

  const openEdit = e => {
    setForm({
      title: e.title||"", type: e.type||"Class", batch_ids: (e.batches||[]).map(b=>b.id),
      start_datetime: toLocalInput(e.start_datetime), end_datetime: toLocalInput(e.end_datetime),
      duration: (e.start_datetime && e.end_datetime)
        ? Math.max(15, Math.round((new Date(e.end_datetime) - new Date(e.start_datetime)) / 60000))
        : 60,
      location: e.location||"", requires_studio: !!e.requires_studio,
      studio_booked: !!e.studio_booked, recurrence:"none", recurrence_end:"",
      color: e.color||"", notes: e.notes||"",
    });
    setDetailEvent(e);
    setPanelMode('edit');
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
        const sun = new Date(cursor); sun.setDate(cursor.getDate() - dow);
        const sat = new Date(sun);    sat.setDate(sun.getDate() + 6);
        return `${sun.toLocaleDateString([],{month:"short",day:"numeric"})} – ${sat.toLocaleDateString([],{month:"short",day:"numeric",year:"numeric"})}`;
      })();

  // ── Event card ───────────────────────────────────────────────────────────
  const EventPill = ({ event, compact }) => {
    const color = TYPE_COLORS[event.type] || "#8a7a9a";
    return (
      <div
        onClick={e => { e.stopPropagation(); handleEventClick(event); }}
        title={event.title}
        style={{
          background: compact ? color : color+"22",
          borderRadius: compact ? 6 : 8,
          padding: compact ? "3px 5px" : "5px 8px",
          fontSize: compact ? 10 : 11, fontWeight: 700,
          color: compact ? "#fff" : (theme === "dark" ? "#ffffff" : "#1e1228"),
          cursor: "pointer",
          marginBottom: 2, lineHeight: 1.4,
          display: "flex", alignItems: "center", gap: 3,
          width: "100%", boxSizing: "border-box", minWidth: 0,
          boxShadow: compact ? `0 1px 4px ${color}55` : `0 1px 3px ${color}30`,
          border: compact ? "none" : `1.5px solid ${color}55`,
          transition: "opacity .15s",
          overflow: "hidden",
        }}
        onMouseEnter={e => { e.currentTarget.style.opacity = "0.82"; }}
        onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}
      >
        {!!event.requires_studio && !compact && <span style={{flexShrink:0}} title="Studio required"><SvgIcon name="home" size={11} /></span>}
        {!event.studio_booked && !!event.requires_studio && <span style={{flexShrink:0, color: compact ? "#fff" : "#e05c6a", fontWeight:800}} title="Not yet booked">!</span>}
        <span style={{overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1, minWidth:0}}>
          {compact ? "" : fmtTime(event.start_datetime)+" "}{event.title}
        </span>
      </div>
    );
  };

  // ── Month grid ───────────────────────────────────────────────────────────
  const MonthView = () => {
    const y = cursor.getFullYear(), m = cursor.getMonth();
    const firstDay = startOfMonth(y, m).getDay(); // Sun=0 … Sat=6
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
      <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
        <div style={{minWidth:"min(560px,calc(100vw - 32px))"}}>
        {/* Unified grid: headers + cells share the same 7-column template */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,minmax(0,1fr))",gap:1,background:"var(--border)",borderRadius:12,overflow:"hidden"}}>
          {DAYS.map(d => (
            <div key={d} style={{background:"var(--surface)",textAlign:"center",fontSize:"clamp(9px,2vw,11px)",fontWeight:700,color:"var(--muted)",padding:"4px 0",letterSpacing:"0.05em",minWidth:0,overflow:"hidden"}}>{d}</div>
          ))}
          {cells.map((day, i) => {
            const dayEvents = eventsOnDay(day);
            const visible = dayEvents.slice(0,2);
            const overflow = dayEvents.length - 2;
            return (
              <div
                key={i}
                onClick={() => day && isAdmin && openAdd(new Date(y, m, day))}
                style={{
                  background: day ? "var(--card)" : "var(--surface)",
                  minHeight: "clamp(60px,15vw,100px)", padding: "4px 3px",
                  cursor: day && isAdmin ? "pointer" : "default",
                  minWidth: 0, overflow: "hidden", width: "100%", boxSizing: "border-box",
                }}
              >
                {day && (
                  <>
                    <div style={{
                      fontSize: 12, fontWeight: isToday(day) ? 800 : 500,
                      color: isToday(day) ? "#fff" : "var(--text)",
                      background: isToday(day) ? "linear-gradient(135deg, var(--accent) 0%, #b47fe8 100%)" : "transparent",
                      width: 26, height: 26, borderRadius: "50%",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      marginBottom: 4,
                      boxShadow: isToday(day) && theme === "dark" ? "0 2px 10px rgba(196,82,122,0.55), 0 0 0 3px rgba(196,82,122,0.15)" : "none",
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
        </div>{/* end minWidth wrapper */}
      </div>
    );
  };

  // ── Week view ────────────────────────────────────────────────────────────
  const WeekView = () => {
    const dow = cursor.getDay();
    const sun = new Date(cursor); sun.setDate(cursor.getDate() - dow);
    const weekDays = Array.from({length:7}, (_,i) => { const d=new Date(sun); d.setDate(sun.getDate()+i); return d; });
    const eventsOnDay = (date) => {
      const str = date.toISOString().slice(0,10);
      return events.filter(e => e.start_datetime?.slice(0,10) === str)
                   .sort((a,b) => a.start_datetime.localeCompare(b.start_datetime));
    };
    return (
      <div style={{overflowX:"auto"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,minmax(110px,1fr))",gap:12,height:"calc(100vh - 350px)",minHeight:600,minWidth:770}}>
        {weekDays.map((date,i) => {
          const isToday = date.toDateString() === today.toDateString();
          const dayEvs = eventsOnDay(date);
          return (
            <div key={i} style={{display:"flex",flexDirection:"column",minWidth:0,overflow:"hidden"}}>
              <div style={{textAlign:"center",marginBottom:12}}>
                <div style={{fontSize:11,color:"var(--muted)",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.05em"}}>{DAYS[i]}</div>
                <div style={{
                  width:40,height:40,borderRadius:"50%",margin:"6px auto 0",
                  background:isToday?"linear-gradient(135deg, var(--accent) 0%, #b47fe8 100%)":"transparent",
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:14,fontWeight:isToday?800:600,color:isToday?"#fff":"var(--text)",
                  border:isToday?"none":"1px solid var(--border)",
                  boxShadow:isToday && theme==="dark"?"0 4px 16px rgba(196,82,122,0.5), 0 0 0 4px rgba(196,82,122,0.12)":"none",
                  transition:"all .2s",
                }}>{date.getDate()}</div>
              </div>
              <div
                onClick={() => isAdmin && openAdd(date)}
                style={{
                  flex:1,background:"var(--card)",borderRadius:12,padding:10,border:"1.5px solid var(--border)",
                  cursor:isAdmin?"pointer":"default",
                  overflowX:"hidden",overflowY:"auto",display:"flex",flexDirection:"column",gap:8,
                  transition:"all .15s",minWidth:0,
                }}
              >
                {dayEvs.map(e => {
                  const color = TYPE_COLORS[e.type] || "#8a7a9a";
                  const noStudio = e.requires_studio && !e.studio_booked;
                  return (
                    <div key={e.id}
                      onClick={ev => { ev.stopPropagation(); handleEventClick(e); }}
                      style={{
                        background: `linear-gradient(135deg, ${color}20 0%, ${color}0d 100%)`,
                        border: `1.5px solid ${color}60`,
                        borderTop: `3px solid ${color}`,
                        borderRadius: 10, padding: "10px 10px",
                        fontSize: 12, fontWeight: 700, color: "var(--text)",
                        cursor: "pointer", transition: "all .15s",
                        display:"flex",alignItems:"flex-start",gap:6,
                        boxShadow: `0 2px 8px ${color}20`,
                        width:"100%", boxSizing:"border-box", minWidth:0, overflow:"hidden",
                      }}
                      onMouseEnter={ev => { ev.currentTarget.style.background = `linear-gradient(135deg, ${color}35 0%, ${color}18 100%)`; ev.currentTarget.style.boxShadow = `0 6px 18px ${color}40`; ev.currentTarget.style.transform = "translateY(-1px)"; }}
                      onMouseLeave={ev => { ev.currentTarget.style.background = `linear-gradient(135deg, ${color}20 0%, ${color}0d 100%)`; ev.currentTarget.style.boxShadow = `0 2px 8px ${color}20`; ev.currentTarget.style.transform = "none"; }}
                    >
                      <div style={{flexShrink:0,lineHeight:1,marginTop:2,display:"flex",alignItems:"flex-start"}}>
                        <SvgIcon name={e.requires_studio ? "home" : e.type === "Class" ? "book-open" : e.type === "Recital" ? "theater" : e.type === "Rehearsal" ? "music" : "calendar"} size={16} color={color} />
                        {noStudio && <div style={{fontSize:11,color:"#e05c6a",position:"relative",top:-6,left:-5}}>!</div>}
                      </div>
                      <div style={{flex:1,minWidth:0,overflow:"hidden"}}>
                        <div style={{fontWeight:700,fontSize:12,marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.title}</div>
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
                const color = TYPE_COLORS[e.type] || "#8a7a9a";
                return (
                  <Card key={e.id} onClick={()=>handleEventClick(e)} style={{display:"flex",alignItems:"center",gap:13,padding:13,cursor:"pointer",borderLeft:`4px solid ${color}`}}>
                    <div style={{minWidth:60,textAlign:"center"}}>
                      <div style={{fontWeight:700,fontSize:13}}>{fmtTime(e.start_datetime)}</div>
                      <div style={{fontSize:10,color:"var(--muted)"}}>{fmtTime(e.end_datetime)}</div>
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:700,fontSize:13}}>{e.title}</div>
                      <div style={{fontSize:11,color:"var(--muted)",display:"flex",gap:8,flexWrap:"wrap",marginTop:2}}>
                        {(e.batches?.length ? e.batches.map(b=>b.name).join(', ') : e.batch_name) && <span style={{display:"inline-flex",alignItems:"center",gap:4}}><SvgIcon name="book-open" size={11} color="var(--muted)" />{e.batches?.length ? e.batches.map(b=>b.name).join(', ') : e.batch_name}</span>}
                        {e.location   && <span style={{display:"inline-flex",alignItems:"center",gap:4}}><SvgIcon name="map-pin" size={11} color="var(--muted)" />{e.location}</span>}
                      </div>
                    </div>
                    <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0}}>
                      <Badge color={color}>{e.type}</Badge>
                      {!!e.requires_studio && (
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

  // ── Mobile Month View ────────────────────────────────────────────────────
  const MobileMonthView = () => {
    const y = cursor.getFullYear(), m = cursor.getMonth();
    const firstDay = startOfMonth(y, m).getDay(); // Sun=0 … Sat=6
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

    const isTodayCell = d => d && y === today.getFullYear() && m === today.getMonth() && d === today.getDate();
    const isSelectedCell = d => d && selectedDay && y === selectedDay.getFullYear() && m === selectedDay.getMonth() && d === selectedDay.getDate();

    return (
      <div>
        {/* Day-of-week headers */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",marginBottom:6}}>
          {DAYS.map(d => (
            <div key={d} style={{textAlign:"center",fontSize:12,fontWeight:600,color:"var(--muted)",padding:"4px 0"}}>{d}</div>
          ))}
        </div>
        {/* Day cells */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)"}}>
          {cells.map((day, i) => {
            const dayEvs = eventsOnDay(day);
            const sel = isSelectedCell(day);
            const tod = isTodayCell(day);
            return (
              <div key={i}
                onClick={() => { if (day) setSelectedDay(new Date(y, m, day)); }}
                style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"3px 0 6px",cursor:day?"pointer":"default"}}
              >
                <div style={{
                  width:34,height:34,borderRadius:"50%",
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:14,fontWeight:sel||tod?700:400,
                  background:sel?"var(--accent)":tod?"transparent":"transparent",
                  color:sel?"#fff":tod?"var(--accent)":day?"var(--text)":"transparent",
                  border:tod&&!sel?"1.5px solid var(--accent)":"1.5px solid transparent",
                  marginBottom:3,transition:"all .15s",
                }}>{day||""}</div>
                <div style={{display:"flex",gap:3,height:6,alignItems:"center",justifyContent:"center"}}>
                  {dayEvs.slice(0,3).map((e,j) => (
                    <div key={j} style={{
                      width:5,height:5,borderRadius:"50%",
                      background:TYPE_COLORS[e.type]||"#8a7a9a",
                      flexShrink:0,
                    }} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ── Mobile Events List ───────────────────────────────────────────────────
  const MobileEventsList = () => {
    const dateStr = selectedDay ? selectedDay.toISOString().slice(0,10) : today.toISOString().slice(0,10);
    const dayEvents = events
      .filter(e => e.start_datetime?.slice(0,10) === dateStr)
      .sort((a,b) => a.start_datetime.localeCompare(b.start_datetime));
    const dateLabel = (selectedDay||today).toLocaleDateString([], {weekday:"long",month:"long",day:"numeric"});
    return (
      <div>
        <div style={{fontSize:12,fontWeight:700,color:"var(--muted)",marginBottom:0,textTransform:"uppercase",letterSpacing:"0.06em",padding:"0 4px 12px"}}>{dateLabel}</div>
        {dayEvents.length === 0 ? (
          <div style={{textAlign:"center",padding:"32px 0",color:"var(--muted)",fontSize:13}}>No events scheduled</div>
        ) : (
          <div style={{display:"flex",flexDirection:"column"}}>
            {dayEvents.map((e,idx) => {
              const color = TYPE_COLORS[e.type] || "#8a7a9a";
              const hasTime = e.start_datetime && e.start_datetime.length > 10;
              return (
                <div key={e.id} onClick={() => handleEventClick(e)} style={{
                  display:"flex",background:"var(--card)",cursor:"pointer",
                  borderBottom:"1px solid var(--border)",
                  borderRadius: idx===0 ? "12px 12px 0 0" : idx===dayEvents.length-1 ? "0 0 12px 12px" : 0,
                  overflow:"hidden",transition:"opacity .15s",
                }}
                  onMouseEnter={ev=>{ev.currentTarget.style.opacity="0.82";}}
                  onMouseLeave={ev=>{ev.currentTarget.style.opacity="1";}}
                >
                  {/* Time column */}
                  <div style={{minWidth:68,maxWidth:68,padding:"14px 10px",textAlign:"center",display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center",gap:1,borderRight:"1px solid var(--border)"}}>
                    {hasTime ? (
                      <>
                        <span style={{fontSize:11,fontWeight:700,color:"var(--text)"}}>{fmtTime(e.start_datetime)}</span>
                        <span style={{fontSize:10,color:"var(--muted)"}}>{fmtTime(e.end_datetime)}</span>
                      </>
                    ) : (
                      <span style={{fontSize:10,color:"var(--muted)",fontWeight:600}}>All day</span>
                    )}
                  </div>
                  {/* Color bar */}
                  <div style={{width:4,background:color,flexShrink:0}} />
                  {/* Content */}
                  <div style={{flex:1,padding:"14px 14px",minWidth:0}}>
                    <div style={{fontSize:14,fontWeight:700,color:"var(--text)",marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.title}</div>
                    {e.location && <div style={{fontSize:12,color:"var(--muted)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.location}</div>}
                    {!e.location && (e.batches?.length > 0 || e.batch_name) && (
                      <div style={{fontSize:12,color:"var(--muted)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                        {e.batches?.length ? e.batches.map(b=>b.name).join(", ") : e.batch_name}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // ── Render ───────────────────────────────────────────────────────────────
  // ── Inline recital detail view ────────────────────────────────────────────
  if (recitalDetailId) {
    return (
      <RecitalDetail
        id={recitalDetailId}
        sid={sid}
        onBack={() => { if (recitalFrom === 'dashboard') { router.push('/home'); } else { setRecitalDetailId(null); } }}
        onEdit={() => {}}
        onDeleted={(eventDate) => {
          if (eventDate) {
            const d = new Date(eventDate.slice(0, 10) + 'T12:00:00');
            if (!isNaN(d)) setCursor(d);
          }
          setRecitalDetailId(null);
        }}
      />
    );
  }

  return (
    <div style={{ paddingRight: (detailEvent || panelMode === 'add') && !isMobile ? PANEL_W + 20 : 0, transition:"padding .25s ease" }}>

      {isMobile ? (
        /* ── MOBILE LAYOUT ──────────────────────────────────────────────── */
        <div>
          {/* Mobile header: prev / MONTH YEAR / next */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18}}>
            <button onClick={()=>navCalendar(-1)} style={{background:"none",border:"none",cursor:"pointer",padding:"6px 10px",color:"var(--accent)",fontSize:24,lineHeight:1,fontWeight:300}}>‹</button>
            <span style={{fontFamily:"var(--font-d)",fontSize:17,fontWeight:700,color:"var(--accent)",textTransform:"uppercase",letterSpacing:"0.06em"}}>
              {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
            </span>
            <button onClick={()=>navCalendar(1)} style={{background:"none",border:"none",cursor:"pointer",padding:"6px 10px",color:"var(--accent)",fontSize:24,lineHeight:1,fontWeight:300}}>›</button>
          </div>

          {/* Compact month calendar with dot indicators */}
          {isLoading ? <p style={{color:"var(--muted)",textAlign:"center",padding:"24px 0"}}>Loading…</p> : <MobileMonthView />}

          {/* Divider */}
          <div style={{height:1,background:"var(--border)",margin:"20px -4px"}} />

          {/* Events for selected day */}
          <MobileEventsList />


          {/* FAB — add event */}
          {isAdmin && (
            <button onClick={() => openAdd(selectedDay || new Date())} style={{
              position:"fixed",right:20,bottom:80,zIndex:50,
              width:56,height:56,borderRadius:"50%",
              background:"linear-gradient(135deg, var(--accent) 0%, #b47fe8 100%)",
              border:"none",cursor:"pointer",
              display:"flex",alignItems:"center",justifyContent:"center",
              boxShadow:"0 4px 20px rgba(196,82,122,0.5)",
              transition:"transform .15s, box-shadow .15s",
            }}
              onMouseEnter={ev=>{ev.currentTarget.style.transform="scale(1.08)";ev.currentTarget.style.boxShadow="0 6px 28px rgba(196,82,122,0.65)";}}
              onMouseLeave={ev=>{ev.currentTarget.style.transform="scale(1)";ev.currentTarget.style.boxShadow="0 4px 20px rgba(196,82,122,0.5)";}}
            >
              <SvgIcon name="plus" size={24} color="#fff" />
            </button>
          )}

          {/* Smart Add FAB — sits above the regular FAB */}
          {isAdmin && (
            <button onClick={() => setShowSmartAdd(true)} title="Smart Add" style={{
              position:"fixed",right:20,bottom:148,zIndex:50,
              width:56,height:56,borderRadius:"50%",
              background:"linear-gradient(135deg, #7C3AED 0%, #DC4EFF 100%)",
              border:"none",cursor:"pointer",
              display:"flex",alignItems:"center",justifyContent:"center",
              boxShadow:"0 4px 20px rgba(124,58,237,0.55)",
              transition:"transform .15s, box-shadow .15s",
              color:"#fff",
            }}
              onMouseEnter={ev=>{ev.currentTarget.style.transform="scale(1.08)";ev.currentTarget.style.boxShadow="0 6px 28px rgba(124,58,237,0.7)";}}
              onMouseLeave={ev=>{ev.currentTarget.style.transform="scale(1)";ev.currentTarget.style.boxShadow="0 4px 20px rgba(124,58,237,0.55)";}}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l1.8 5.4L19 9.2l-5.2 1.8L12 16l-1.8-5L5 9.2l5.2-1.8L12 2zM19 14l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3zM5 14l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z"/>
              </svg>
            </button>
          )}
        </div>
      ) : (
        /* ── DESKTOP LAYOUT (unchanged) ─────────────────────────────────── */
        <div>
          {/* Header */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18,flexWrap:"wrap",gap:10}}>
            <div>
              <h1 style={{fontFamily:"var(--font-d)",fontSize:24,marginBottom:2}}>My Events</h1>
              <p style={{color:"var(--muted)",fontSize:12}}>Click any day to add an event</p>
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginLeft:"auto"}}>
              {isAdmin && <SmartButton onClick={()=>setShowSmartAdd(true)} size="sm">Smart Add</SmartButton>}
              {isAdmin && <Button onClick={()=>openAdd()} size="sm">Add Event</Button>}
              {isAdmin && <Button variant="secondary" onClick={openAddRecital} size="sm">Add Recital</Button>}
            </div>
          </div>

          {/* ── Calendar card ── */}
          <Card style={{padding:"20px 20px 24px"}}>

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
            }}><SvgIcon name="home" size={11} style={{marginRight:5}} /> Studio needed</button>
            {batches.length > 0 && <>
              <div style={{width:1,height:16,background:"var(--border)",margin:"0 2px"}} />
              {batches.map(b => {
                const active = filterBatch === b.id || filterBatch === String(b.id);
                return (
                  <button key={b.id} onClick={()=>setFilterBatch(active ? null : b.id)} style={{
                    padding:"4px 12px",borderRadius:20,border:`1.5px solid ${active?"#6a7fdb":"var(--border)"}`,
                    fontSize:11,fontWeight:700,cursor:"pointer",
                    background:active?"#6a7fdb22":"transparent",color:active?"#6a7fdb":"var(--muted)",
                  }}>{b.name}</button>
                );
              })}
            </>}

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
                    background:"var(--card)",borderRadius:12,padding:14,width:200,
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
                      <div style={{fontSize:11,color:"var(--muted)",marginBottom:3,display:"flex",alignItems:"center",gap:4}}><SvgIcon name="home" size={11} color="var(--muted)" /> = Studio required</div>
                      <div style={{fontSize:11,color:"#e05c6a",display:"flex",alignItems:"center",gap:4}}><SvgIcon name="home" size={11} color="#e05c6a" />! = Not yet booked</div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Navigation */}
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16,flexWrap:"wrap"}}>
            {view !== "list" && <>
              <button onClick={()=>navCalendar(-1)} style={{background:"var(--surface)",border:"none",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:16,color:"var(--text)"}}>‹</button>
              <span style={{fontFamily:"var(--font-d)",fontSize:16,fontWeight:700,minWidth:180,textAlign:"center"}}>{label}</span>
              <button onClick={()=>navCalendar(1)} style={{background:"var(--surface)",border:"none",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:16,color:"var(--text)"}}>›</button>
            </>}
            <button onClick={()=>setCursor(new Date())} style={{background:"var(--surface)",border:"1.5px solid var(--border)",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:12,fontWeight:600,color:"var(--muted)"}}>Today</button>
            <div style={{width:1,height:20,background:"var(--border)",margin:"0 2px"}} />
            {["month","week","list"].map(v => (
              <button key={v} onClick={()=>setView(v)} style={{
                padding:"6px 14px",borderRadius:8,border:"1.5px solid var(--border)",fontSize:12,fontWeight:600,cursor:"pointer",
                background:view===v?"var(--accent)":"var(--surface)",color:view===v?"#fff":"var(--muted)",
              }}>{v.charAt(0).toUpperCase()+v.slice(1)}</button>
            ))}
          </div>

          {isLoading ? <p style={{color:"var(--muted)"}}>Loading…</p> : (
            view==="month" ? <MonthView /> : view==="week" ? <WeekView /> : <ListView />
          )}


          </Card>
        </div>
      )}

      {/* ── Event Panel (view / edit / add) ── */}
      {(detailEvent || panelMode === 'add') && isMobile && (
        <div onClick={() => { setDetailEvent(null); setPanelMode('view'); }}
          style={{position:"fixed",inset:0,top:56,background:"rgba(0,0,0,0.4)",zIndex:399}} />
      )}
      {(detailEvent || panelMode === 'add' || panelMode === 'add-recital') && (
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
          {/* Panel header — hidden on mobile view (replaced by Netflix hero) */}
          {!(isMobile && panelMode === 'view' && detailEvent) && (
          <div style={{ padding:"16px 20px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
            <span style={{ fontSize:11, fontWeight:700, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".08em" }}>
              {panelMode === 'add' ? "New Event" : panelMode === 'edit' ? "Edit Event" : panelMode === 'add-recital' ? "New Recital" : "Event Details"}
            </span>
            <button onClick={() => { setDetailEvent(null); setPanelMode('view'); }}
              style={{ background:"none", border:"none", cursor:"pointer", color:"var(--muted)", lineHeight:1, padding:4, borderRadius:6, display:"flex", alignItems:"center" }}><SvgIcon name="x" size={18} /></button>
          </div>
          )}

          {/* ── VIEW mode: event hero + details ── */}
          {panelMode === 'view' && detailEvent && (() => {
            const e = detailEvent;
            const color = TYPE_COLORS[e.type] || "#8a7a9a";

            // Resolve the primary batch — used for hero cover photo + secondary line.
            const evBatches = e.batches?.length ? e.batches : (e.batch_name ? [{ id: e.batch_id, name: e.batch_name }] : []);
            const primaryBatch = evBatches[0]
              ? batches.find(x => x.id === evBatches[0].id || String(x.id) === String(evBatches[0].id))
              : null;
            const heroImg = primaryBatch?.cover_url || null;

            // Close — if the user got here from the dashboard, route them
            // back to /home; otherwise just clear the panel in place.
            const handleClose = () => {
              const goHome = cameFromDashboardRef.current;
              cameFromDashboardRef.current = false;
              setDetailEvent(null);
              setPanelMode('view');
              setInlineSection(null);
              if (goHome) router.push('/home');
            };

            // Delete handles both one-off events (DELETE /events/:id) and
            // recurring class instances (skip-this-date — formerly the
            // 'Skip this class' button).
            const handleDelete = () => {
              if (e._isSchedule) {
                if (window.confirm("Skip this class on " + fmtDate(e.start_datetime) + "? (recurring class — only this date is cancelled, the schedule continues)")) {
                  skipMutation.mutate({ scheduleId: e._scheduleId, date: e.start_datetime.slice(0,10) });
                }
              } else {
                if (window.confirm("Delete this event?")) deleteMutation.mutate(e.id);
              }
            };

            return (
              <>
                {/* Single overflow container — wraps the hero + body so the
                    cover image scrolls with the page (mirrors /recitals
                    detail and the fixed /batches behavior). */}
                <div style={{ flex:1, overflowY:"auto", minHeight:0 }}>
                {/* ── Hero (inside the scroll container) ──────────────── */}
                <div style={{
                  position:"relative", overflow:"hidden",
                  background: heroImg ? "#000" : `linear-gradient(160deg,#1a1035 0%, ${color}66 50%, #2a1a55 100%)`,
                }}>
                  {heroImg && (
                    <div style={{ width:"100%", paddingTop:"56.25%", position:"relative" }}>
                      <img src={heroImg} alt={primaryBatch?.name || e.title}
                        style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
                    </div>
                  )}
                  {!heroImg && <div style={{ minHeight: isMobile ? 200 : 180 }} />}
                  <div style={{ position:"absolute", inset:0, background:"linear-gradient(to top, rgba(0,0,0,.82) 0%, rgba(0,0,0,.18) 55%, transparent 100%)" }} />

                  {/* Top row: Close (left) + Edit + Delete (right, admin) —
                      mirrors the /recitals detail toolbar exactly. */}
                  <div style={{ position:"absolute", top:0, left:0, right:0, padding:"14px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", zIndex:10 }}>
                    <button onClick={handleClose} style={{
                      display:"flex", alignItems:"center", gap:6, padding:"7px 14px", borderRadius:20,
                      background:"rgba(0,0,0,.45)", backdropFilter:"blur(8px)",
                      border:"1px solid rgba(255,255,255,.22)",
                      color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer",
                    }}>← Close</button>
                    {isAdmin && (
                      <div style={{ display:"flex", gap:8 }}>
                        <button
                          onClick={() => e._isSchedule ? openOverride(e) : openEdit(e)}
                          title="Edit"
                          style={{ width:34, height:34, borderRadius:"50%", background:"rgba(0,0,0,.45)", backdropFilter:"blur(8px)", border:"1px solid rgba(255,255,255,.22)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}
                        >
                          <SvgIcon name="pencil" size={15} color="rgba(255,255,255,.85)" />
                        </button>
                        <button
                          onClick={handleDelete}
                          title={e._isSchedule ? "Cancel this class instance" : "Delete event"}
                          style={{ width:34, height:34, borderRadius:"50%", background:"rgba(0,0,0,.45)", backdropFilter:"blur(8px)", border:"1px solid rgba(255,255,255,.22)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}
                        >
                          <SvgIcon name="trash" size={15} color="rgba(255,255,255,.85)" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Title block — TYPE big, batch name as subhead. */}
                  <div style={{ position:"absolute", bottom:0, left:0, right:0, padding: isMobile ? "16px 18px 20px" : "20px 24px 22px", zIndex:5 }}>
                    <div style={{ fontSize:10, fontWeight:700, color:"rgba(255,255,255,.6)", textTransform:"uppercase", letterSpacing:".14em", marginBottom:6 }}>
                      {e._isSchedule ? "↻ Recurring" : "Event"}
                    </div>
                    <div style={{ fontFamily:"var(--font-d)", fontSize: isMobile ? 28 : 34, fontWeight:800, color:"#fff", lineHeight:1.1, letterSpacing:"-0.6px", marginBottom: 6 }}>
                      {e.type}
                    </div>
                    <div style={{ fontSize: isMobile ? 15 : 17, fontWeight:600, color:"rgba(255,255,255,.85)", lineHeight:1.3, marginBottom: primaryBatch ? 10 : 0 }}>
                      {primaryBatch?.name || e.title}
                    </div>
                    {primaryBatch && (
                      <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                        {/* Batch chip — click opens THIS batch in the Classes
                            panel (not the batches list). Uses openBatchId. */}
                        <button type="button"
                          onClick={()=>{ setDetailEvent(null); setPanelMode('view'); router.push(`/batches?openBatchId=${primaryBatch.id}`); }}
                          style={{ display:"inline-flex",alignItems:"center",gap:5, background:"rgba(255,255,255,.14)",border:"1px solid rgba(255,255,255,.28)", borderRadius:20,padding:"4px 10px",cursor:"pointer", fontSize:11,fontWeight:600,color:"rgba(255,255,255,.9)",backdropFilter:"blur(8px)" }}
                          onMouseEnter={ev=>{ev.currentTarget.style.background="rgba(255,255,255,.22)";}}
                          onMouseLeave={ev=>{ev.currentTarget.style.background="rgba(255,255,255,.14)";}}
                        >
                          {primaryBatch.student_count != null ? `${primaryBatch.student_count} students` : 'View batch'}
                          <span style={{fontSize:9,opacity:0.6}}>→</span>
                        </button>
                        {evBatches.length > 1 && (
                          <span style={{ fontSize:11, color:"rgba(255,255,255,.55)", fontWeight:600 }}>
                            + {evBatches.length - 1} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Body content (still inside the shared scroll container) ── */}
                <div style={{ padding: isMobile ? "18px 16px 24px" : "22px 22px 28px" }}>
                  <div style={{ display:"grid", gap:14, marginBottom:20 }}>
                    <PDetailRow icon="calendar" label="Date">{fmtDate(e.start_datetime)}</PDetailRow>
                    <PDetailRow icon="clock" label="Time">{fmtTime(e.start_datetime)} – {fmtTime(e.end_datetime)}</PDetailRow>
                    {e.location && <PDetailRow icon="map-pin" label="Location">{e.location}</PDetailRow>}
                    {e.notes && <PDetailRow icon="file-text" label="Notes">{e.notes}</PDetailRow>}
                  </div>

                  {!!e.requires_studio && (
                    <div style={{ padding:"12px 14px", borderRadius:10, background:e.studio_booked?"#52c4a008":"#e05c6a08", border:`1.5px solid ${e.studio_booked?"#52c4a033":"#e05c6a33"}`, marginBottom:16 }}>
                      <div style={{ fontSize:12, fontWeight:700, color:e.studio_booked?"#52c4a0":"#e05c6a" }}>
                        {e.studio_booked ? "✓ Studio booking confirmed" : "⚠ Studio booking needed"}
                      </div>
                      {!e.studio_booked && (
                        <button onClick={()=>{ api.update(sid,e.id,{...e,studio_booked:true,batch_ids:(e.batches||[]).map(b=>b.id)}).then(()=>{ qc.invalidateQueries({queryKey:["events"],exact:false}); setDetailEvent({...e,studio_booked:true}); toast.success("Studio marked as booked!"); }); }} style={{ marginTop:8, padding:"6px 12px", borderRadius:7, border:"1.5px solid #52c4a0", background:"transparent", color:"#52c4a0", cursor:"pointer", fontSize:12, fontWeight:600 }}>Mark Studio Booked</button>
                      )}
                    </div>
                  )}

                  {/* ── Main action stack ──────────────────────────────────
                      Order:
                        1. Message Parents — primary (purple gradient)
                        2. Take Attendance — inline expansion
                        3. Mark All Present — bulk shortcut
                      Edit and Delete have been moved to the top-right toolbar.
                      'Skip this class' is now folded into Delete (recurring).
                      'Manage in Batches' link removed — batch chip in hero
                      opens the batch directly. */}
                  {isAdmin && (
                    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                      <button
                        onClick={() => setSmartReplyEvent(e)}
                        style={{ width:"100%", padding:"12px 16px", borderRadius:10, border:"none", background:"linear-gradient(135deg, #7C3AED 0%, #DC4EFF 100%)", color:"#fff", cursor:"pointer", fontSize:14, fontWeight:700, display:"inline-flex", alignItems:"center", justifyContent:"center", gap:8, boxShadow:"0 2px 12px rgba(124,58,237,0.32)" }}
                      >
                        <SvgIcon name="mail" size={15} color="#fff" /> Message Parents
                      </button>
                      <button
                        onClick={() => handleMarkAllPresent(e)}
                        disabled={markingAllId === e.id}
                        title="Mark every student in this class as present"
                        style={{ width:"100%", padding:"12px 16px", borderRadius:10, border:"none", background:"linear-gradient(135deg,#059669,#10B981)", color:"#fff", cursor: markingAllId === e.id ? "wait" : "pointer", fontSize:14, fontWeight:700, display:"inline-flex", alignItems:"center", justifyContent:"center", gap:8, boxShadow:"0 2px 12px rgba(16,185,129,0.3)", opacity: markingAllId === e.id ? 0.7 : 1 }}
                      >
                        ⚡ {markingAllId === e.id ? "Marking…" : "Mark All Present"}
                      </button>

                      {/* Always-visible Take Attendance section — no toggle.
                          AttendanceModal in inline mode renders its own
                          'Take Attendance' heading + student list + Save. */}
                      <div style={{ marginTop:4 }}>
                        <AttendanceModal
                          open
                          inline
                          onClose={() => {}}
                          schoolId={String(sid)}
                          eventId={!e._isSchedule ? e.id : undefined}
                          scheduleId={e._isSchedule ? e._scheduleId : undefined}
                          classDate={e.start_datetime ? String(e.start_datetime).slice(0, 10) : new Date().toISOString().slice(0, 10)}
                          eventTitle={e.title}
                        />
                      </div>
                    </div>
                  )}
                </div>
                </div>
              </>
            );
          })()}

          {/* ── EDIT / ADD mode: event form ── */}
          {(panelMode === 'edit' || panelMode === 'add') && (
            <div style={{ flex:1, overflowY:"auto", padding:"20px 22px" }}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:"0 16px"}}>
                <Field label="Title *" style={{gridColumn:"1/-1"}}>
                  <Input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="e.g. Junior Ballet Class" />
                </Field>
                <Field label="Event Type">
                  <Select value={form.type} onChange={e=>setForm({...form,type:e.target.value})}>
                    {EVENT_TYPES.map(t=><option key={t}>{t}</option>)}
                  </Select>
                </Field>
                <div style={{gridColumn:"1/-1", marginBottom:12}}>
                  <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.07em",textTransform:"uppercase",color:"var(--muted)",marginBottom:6}}>Batches (optional)</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
                    {batches.map(b => {
                      const checked = form.batch_ids.includes(b.id) || form.batch_ids.includes(String(b.id));
                      return (
                        <button key={b.id} type="button" onClick={()=>{
                          const id = b.id;
                          setForm(f => ({ ...f, batch_ids: checked ? f.batch_ids.filter(x => x !== id && x !== String(id)) : [...f.batch_ids, id] }));
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
                <DateTimePicker label="Start *" value={form.start_datetime} onChange={v=>setForm(f=>({...f,start_datetime:v,end_datetime:computeEndFromDuration(v,f.duration)}))} />
                <Field label="Duration">
                  <Select value={form.duration} onChange={e=>{ const d=Number(e.target.value); setForm(f=>({...f,duration:d,end_datetime:computeEndFromDuration(f.start_datetime,d)})); }}>
                    {DURATION_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
                  </Select>
                </Field>
                <div style={{gridColumn:"1/-1", marginBottom:12}}>
                  <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.07em",textTransform:"uppercase",color:"var(--muted)",marginBottom:6}}>Location / Room</div>
                  <Input value={form.location} onChange={e=>setForm({...form,location:e.target.value})} placeholder={studioRooms.length > 0 ? "Or type a custom location…" : "e.g. Studio A"} />
                  {studioRooms.length > 0 && (
                    <div style={{display:"flex",flexWrap:"wrap",gap:7,marginTop:8}}>
                      {[...studioRooms].sort((a,b) => (b.is_favorite?1:0)-(a.is_favorite?1:0)).map(s => {
                        const active = form.location === s.name;
                        return (
                          <button key={s.id} type="button" onClick={() => setForm(f => ({ ...f, location: active ? "" : s.name }))} style={{
                            display:"inline-flex",alignItems:"center",gap:5,
                            padding:"5px 13px",borderRadius:20,cursor:"pointer",fontSize:12,fontWeight:700,
                            border:`1.5px solid ${active?"var(--accent)":s.is_favorite?"#F59E0B":"var(--border)"}`,
                            background:active?"var(--accent)":s.is_favorite?"#FFFBEB":"transparent",
                            color:active?"#fff":s.is_favorite?"#B45309":"var(--muted)",transition:"all .12s",
                          }}>
                            {!!s.is_favorite && !active && <span style={{fontSize:11}}>★</span>}
                            {active && <span>✓</span>}
                            {s.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                <Field label="Repeat">
                  <Select value={form.recurrence} onChange={e=>setForm({...form,recurrence:e.target.value})} disabled={panelMode === 'edit'}>
                    <option value="none">No repeat</option>
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Every 2 weeks</option>
                  </Select>
                </Field>
                {form.recurrence !== "none" && panelMode === 'add' && (
                  <DateTimePicker label="Repeat Until" value={form.recurrence_end ? form.recurrence_end+"T00:00" : ""} onChange={v=>setForm({...form,recurrence_end:v.slice(0,10)})} />
                )}
              </div>
              {/* Studio booking */}
              <div style={{display:"flex",alignItems:"center",gap:12,margin:"10px 0",padding:12,background:"var(--surface)",borderRadius:10}}>
                <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:13}}>
                  <input type="checkbox" checked={form.requires_studio} onChange={e=>setForm({...form,requires_studio:e.target.checked})}
                    style={{width:16,height:16,accentColor:"var(--accent)"}} />
                  <span style={{display:"inline-flex",alignItems:"center",gap:6}}><SvgIcon name="home" size={14} /> Studio required</span>
                </label>
                {form.requires_studio && (
                  <span style={{fontSize:12,color:"var(--muted)"}}>Studio booking status can be updated after saving.</span>
                )}
              </div>
              <Field label="Notes">
                <Textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} />
              </Field>
              <div style={{display:"flex",gap:9,marginTop:16}}>
                <Button onClick={()=>saveMutation.mutate(form)} disabled={!form.title||!form.start_datetime||saveMutation.isPending}>
                  {saveMutation.isPending ? "Saving…" : panelMode === 'edit' ? "Save Changes" : form.recurrence!=="none" ? "Create Recurring Events" : "Create Event"}
                </Button>
                <Button variant="secondary" onClick={() => { if (panelMode === 'add') setDetailEvent(null); setPanelMode('view'); }}>Cancel</Button>
              </div>
            </div>
          )}

          {/* ── ADD-RECITAL mode: recital quick-create form ── */}
          {panelMode === 'add-recital' && (
            <div style={{ flex:1, overflowY:"auto", padding:"20px 22px" }}>
              {/* Accent bar at top */}
              <div style={{ height:4, background:"#c4527a", borderRadius:2, marginBottom:20, margin:"-0px -22px 20px -22px" }} />
              <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                <Field label="Recital Title *">
                  <Input
                    value={recitalForm.title}
                    onChange={e => setRecitalForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. Spring Showcase 2026"
                    autoFocus
                  />
                </Field>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))", gap:"0 12px" }}>
                  <Field label="Date *">
                    <Input
                      type="date"
                      value={recitalForm.event_date}
                      onChange={e => setRecitalForm(f => ({ ...f, event_date: e.target.value }))}
                    />
                  </Field>
                  <Field label="Time">
                    <Select value={recitalForm.event_time} onChange={e => setRecitalForm(f => ({ ...f, event_time: e.target.value }))}>
                      <option value="">— No time —</option>
                      {TIME_OPTIONS.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
                    </Select>
                  </Field>
                </div>
                <Field label="Venue / Location">
                  <Input
                    value={recitalForm.venue}
                    onChange={e => setRecitalForm(f => ({ ...f, venue: e.target.value }))}
                    placeholder="e.g. Grand Theater"
                  />
                </Field>
                <Field label="Description">
                  <Textarea
                    value={recitalForm.description}
                    onChange={e => setRecitalForm(f => ({ ...f, description: e.target.value }))}
                    rows={3}
                    placeholder="Brief description…"
                  />
                </Field>
              </div>
              <div style={{ marginTop:8, padding:"10px 14px", borderRadius:10, background:"#c4527a10", border:"1.5px solid #c4527a22" }}>
                <div style={{ fontSize:11, color:"#c4527a", fontWeight:600 }}>
                  After creating, you'll be taken to the Recital detail page to add program, venue, volunteers, vendors and to-dos.
                </div>
              </div>
              <div style={{ display:"flex", gap:9, marginTop:18 }}>
                <Button
                  onClick={() => recitalSaveMutation.mutate(recitalForm)}
                  disabled={!recitalForm.title.trim() || !recitalForm.event_date || recitalSaveMutation.isPending}
                >
                  {recitalSaveMutation.isPending ? "Creating…" : "Create Recital"}
                </Button>
                <Button variant="secondary" onClick={() => { setPanelMode('view'); setDetailEvent(null); }}>Cancel</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Smart Add modal — bulk create events from natural language */}
      <SmartAddModal
        open={showSmartAdd}
        onClose={() => setShowSmartAdd(false)}
        schoolId={String(sid)}
        onCreated={() => qc.invalidateQueries({ queryKey: ['events'] })}
      />

      {/* Attendance modal — mark presence for an event or recurring class */}
      <AttendanceModal
        open={!!attendanceEvent}
        onClose={() => setAttendanceEvent(null)}
        schoolId={String(sid)}
        eventId={attendanceEvent && !attendanceEvent._isSchedule ? attendanceEvent.id : undefined}
        scheduleId={attendanceEvent?._isSchedule ? attendanceEvent._scheduleId : undefined}
        classDate={attendanceEvent?.start_datetime ? String(attendanceEvent.start_datetime).slice(0, 10) : new Date().toISOString().slice(0, 10)}
        eventTitle={attendanceEvent?.title}
      />

      {/* Smart Announce modal — draft a parent-facing announcement */}
      <SmartAnnounceModal
        open={!!smartReplyEvent}
        onClose={() => setSmartReplyEvent(null)}
        ctx={smartReplyEvent ? (() => {
          const e = smartReplyEvent;
          const s = e.start_datetime ? new Date(e.start_datetime) : null;
          const en = e.end_datetime ? new Date(e.end_datetime) : null;
          const fmtTime = (d) => d ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : null;
          return {
            contextType: e._isRecital ? 'recital' : 'event',
            contextId: e._isRecital ? e._recitalId : e.id,
            title: e.title,
            subtitle: e.type,
            dateLabel: s ? s.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : undefined,
            timeLabel: s && en ? `${fmtTime(s)} – ${fmtTime(en)}` : (s ? fmtTime(s) : undefined),
            location: e.location || undefined,
            color: TYPE_COLORS[e.type] || '#8a7a9a',
          };
        })() : null}
      />
    </div>
  );
}

function PDetailRow({ icon, label, children }) {
  return (
    <div style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
      <span style={{ flexShrink:0, width:22, display:"flex", alignItems:"center", justifyContent:"center", marginTop:2 }}><SvgIcon name={icon} size={15} color="var(--muted)" /></span>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:10, color:"var(--muted)", fontWeight:700, textTransform:"uppercase", letterSpacing:".05em", marginBottom:3 }}>{label}</div>
        <div style={{ fontSize:13, fontWeight:500, color:"var(--text)" }}>{children}</div>
      </div>
    </div>
  );
}
