// @ts-nocheck
'use client';

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/context/AuthContext";
import { students as api, batches as batchApi, schools as schoolApi } from "@/lib/api";
import toast from "react-hot-toast";
import Card from "@/components/shared/Card";
import Button from "@/components/shared/Button";
import { Field, Input, Textarea } from "@/components/shared/Field";
import ProfileCropModal from "@/components/shared/ProfileCropModal";
import SmartAnnounceModal from "@/components/smart/SmartAnnounceModal";
import SvgIcon from "@/components/shared/SvgIcon";
import { upload as uploadApi } from "@/lib/api";
import StudentAttendancePanel from "@/components/attendance/StudentAttendancePanel";
import PageTabs from "@/components/shared/PageTabs";

const ROSTER_TABS = [
  { label: "Batches",  path: "/batches"  },
  { label: "Students", path: "/students" },
];

// ─── Dance avatar stickers — individual PNGs ──────────────────────────────
// 72 files: sticker_RR_CC.png (rows 01-06, cols 01-12).
// Index = (row-1)*12 + (col-1), zero-based, 0–71.
const TOTAL_STICKERS = 72;
const STICKER_SRCS = Array.from({ length: TOTAL_STICKERS }, (_, i) => {
  const row = Math.floor(i / 12) + 1;
  const col = (i % 12) + 1;
  return `/stickers/sticker_${String(row).padStart(2,'0')}_${String(col).padStart(2,'0')}.png`;
});

const AVATAR_COLORS = ["#FFB347","#FF6B9D","#7E57C2","#42A5F5","#26C99E","#FFCA28","#EF5350","#29B6F6","#AB47BC","#66BB6A"];
function getBgColor(s) { return AVATAR_COLORS[((s.id||0)*13+(s.name?.charCodeAt(1)||0))%AVATAR_COLORS.length]; }

// Parse avatar value:
//   photo:<URL>  → uploaded profile picture (Cloudinary URL)
//   sprite:<N>   → legacy dance-sticker PNG (kept for backward compat)
//   <anything else, including '🎵' / dicebear strings / empty> → 'none'
function parseAvatar(val) {
  if (!val) return { type:'none' };
  if (val.startsWith('photo:')) return { type:'photo', url: val.slice(6) };
  if (val.startsWith('sprite:')) return { type:'sprite', index: parseInt(val.slice(7), 10) };
  return { type:'none' };
}

// Random sprite 0–(TOTAL_STICKERS-1) — kept for any callers that still use it.
function randomSpriteVal() {
  return `sprite:${Math.floor(Math.random() * TOTAL_STICKERS)}`;
}

// ─── DancerSilhouette — gender-neutral line-art placeholder ───────────────
// Replaces the old 🎵 emoji. Inline SVG so it scales crisply at any size
// and stays consistent across OSes (the emoji rendered differently on
// macOS / Windows / Android).
function DancerSilhouette({ size }) {
  return (
    <svg
      width={size * 0.55}
      height={size * 0.55}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{ flexShrink:0 }}
    >
      {/* Head */}
      <circle cx="12" cy="7" r="3.2" />
      {/* Shoulders + torso */}
      <path d="M5 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2" />
    </svg>
  );
}

// ─── SpriteAvatar: renders one individual sticker PNG ─────────────────────
function SpriteAvatar({ index, size }) {
  return (
    <div style={{ width:size, height:size, borderRadius:'50%', overflow:'hidden', flexShrink:0 }}>
      <img
        src={STICKER_SRCS[index] || STICKER_SRCS[0]}
        alt=""
        draggable={false}
        style={{ width:'100%', height:'100%', objectFit:'cover', pointerEvents:'none', userSelect:'none' }}
      />
    </div>
  );
}

// ─── PhotoAvatar: renders an uploaded profile picture URL ─────────────────
function PhotoAvatar({ url, size }) {
  return (
    <div style={{ width:size, height:size, borderRadius:'50%', overflow:'hidden', flexShrink:0 }}>
      <img
        src={url}
        alt=""
        draggable={false}
        loading="lazy"
        style={{ width:'100%', height:'100%', objectFit:'cover', pointerEvents:'none', userSelect:'none', display:'block' }}
      />
    </div>
  );
}

// ─── StudentAvatar ─────────────────────────────────────────────────────────
function StudentAvatar({ student, size = 44, border, active, onClick }) {
  const av = parseAvatar(student.avatar);
  const isCustom = av.type === 'photo' || av.type === 'sprite';
  return (
    <div
      onClick={onClick}
      style={{
        width: size, height: size, borderRadius: "50%", flexShrink: 0,
        overflow: "hidden",
        background: isCustom ? 'transparent' : getBgColor(student),
        border: border || `2px solid ${active ? "var(--accent)" : "var(--border)"}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: '#fff',
        lineHeight: 1,
        transition: "border-color .15s, box-shadow .15s",
        userSelect: "none",
        cursor: onClick ? "pointer" : "default",
        boxShadow: onClick ? "0 0 0 0 transparent" : undefined,
      }}
      onMouseEnter={onClick ? e => { e.currentTarget.style.boxShadow = "0 0 0 3px rgba(196,82,122,.25)"; } : undefined}
      onMouseLeave={onClick ? e => { e.currentTarget.style.boxShadow = "0 0 0 0 transparent"; } : undefined}
    >
      {av.type === 'photo'  && <PhotoAvatar  url={av.url}    size={size} />}
      {av.type === 'sprite' && <SpriteAvatar index={av.index} size={size} />}
      {av.type === 'none'   && <DancerSilhouette size={size} />}
    </div>
  );
}

// ─── AvatarPicker — sprite sheet grid ─────────────────────────────────────
function AvatarPicker({ current, onPick, onClose }) {
  const initIdx = current?.startsWith('sprite:') ? parseInt(current.slice(7), 10) : null;
  const [picked, setPicked] = useState(initIdx);

  const doRandom = () => {
    const idx = Math.floor(Math.random() * TOTAL_STICKERS);
    setPicked(idx);
  };

  const indices = Array.from({ length: TOTAL_STICKERS }, (_, i) => i);

  return (
    <div
      style={{ position:"fixed", inset:0, zIndex:700, background:"rgba(0,0,0,0.65)",
        display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background:"var(--card)", borderRadius:20, width:"100%", maxWidth:500,
        display:"flex", flexDirection:"column", maxHeight:"90vh",
        boxShadow:"0 24px 64px rgba(0,0,0,.40)", overflow:"hidden" }}>

        {/* Header */}
        <div style={{ padding:"18px 20px 0", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
          <div>
            <div style={{ fontWeight:800, fontSize:16 }}>Choose Avatar</div>
            <div style={{ fontSize:12, color:"var(--muted)", marginTop:2 }}>Pick a dancer that represents this student</div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:18, cursor:"pointer", color:"var(--muted)", padding:4, borderRadius:6, lineHeight:1 }}>✕</button>
        </div>

        {/* Random button */}
        <div style={{ padding:"12px 20px 8px", flexShrink:0, display:"flex", gap:8 }}>
          <button onClick={doRandom} style={{
            padding:"6px 16px", borderRadius:20, border:"1.5px solid var(--border)",
            background:"var(--surface)", color:"var(--text)", cursor:"pointer",
            fontSize:12, fontWeight:700, display:"flex", alignItems:"center", gap:6,
          }}>
            🎲 Random
          </button>
          {picked !== null && (
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <SpriteAvatar index={picked} size={28} />
              <span style={{ fontSize:12, color:"var(--muted)" }}>Selected #{picked + 1}</span>
            </div>
          )}
        </div>

        {/* Sprite grid */}
        <div style={{ flex:1, overflowY:"auto", padding:"4px 16px 8px" }}>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:8 }}>
            {indices.map(idx => {
              const sel = picked === idx;
              return (
                <div key={idx} onClick={() => setPicked(idx)} style={{
                  borderRadius:"50%", aspectRatio:"1/1", cursor:"pointer", position:"relative",
                  outline: sel ? "3px solid var(--accent)" : "2px solid transparent",
                  outlineOffset:2,
                  boxShadow: sel ? "0 0 0 5px rgba(196,82,122,.18)" : "none",
                  transition:"outline .12s, box-shadow .12s, transform .12s",
                  transform: sel ? "scale(1.08)" : "scale(1)",
                }}>
                  <SpriteAvatar index={idx} size={60} />
                  {sel && (
                    <div style={{ position:"absolute", bottom:0, right:0,
                      width:18, height:18, borderRadius:"50%",
                      background:"var(--accent)", border:"2px solid var(--card)",
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontSize:9, color:"#fff", fontWeight:900,
                    }}>✓</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer actions */}
        <div style={{ padding:"14px 20px 18px", borderTop:"1px solid var(--border)", flexShrink:0, display:"flex", gap:10 }}>
          <button
            disabled={picked === null}
            onClick={() => { onPick(`sprite:${picked}`); onClose(); }}
            style={{
              flex:1, padding:"10px", borderRadius:10, border:"none",
              background: picked !== null ? "var(--accent)" : "var(--surface)",
              color: picked !== null ? "#fff" : "var(--muted)",
              cursor: picked !== null ? "pointer" : "default",
              fontWeight:700, fontSize:13, transition:"all .15s",
            }}
          >Use This Avatar</button>
          <button onClick={() => { onPick(randomSpriteVal()); onClose(); }} style={{
            padding:"10px 18px", borderRadius:10,
            border:"1.5px solid var(--border)", background:"transparent",
            color:"var(--muted)", cursor:"pointer", fontWeight:600, fontSize:12,
          }}>Random →</button>
        </div>
      </div>
    </div>
  );
}

// ─── Small helpers ────────────────────────────────────────────────────────
function InfoRow({ icon, label, value }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "flex-start" }}>
      <span style={{ fontSize: 14, flexShrink: 0, width: 20, textAlign: "center", marginTop: 1 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 13, fontWeight: 500, wordBreak: "break-word" }}>{value}</div>
      </div>
    </div>
  );
}

function PanelSection({ title, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid var(--border)" }}>{title}</div>
      {children}
    </div>
  );
}

const EMPTY = { name: "", age: "", phone: "", email: "", guardian_name: "", guardian_phone: "", guardian_email: "", join_date: "", notes: "", avatar: "" };

// Modern placeholder-as-label input style (matches /register and /login).
// No external <label> — the placeholder text *is* the field name, vanishing
// only as the user starts typing.
const MODERN_INPUT = {
  width: "100%",
  background: "var(--surface)",
  border: "1.5px solid var(--border)",
  borderRadius: 10,
  padding: "13px 15px",
  fontSize: 14,
  fontWeight: 500,
  color: "var(--text)",
  boxSizing: "border-box",
  outline: "none",
  fontFamily: "var(--font-sans)",
  transition: "border-color .15s",
};

export default function StudentsPage() {
  const { user } = useAuth();
  const sid = user?.school_id;
  const qc  = useQueryClient();

  // ── Fee tracking settings (persisted per school in localStorage) ──────────
  const FEE_KEY = `fee_settings_${sid}`;
  const loadFeeSettings = useCallback(() => {
    try { return JSON.parse(localStorage.getItem(FEE_KEY) || '{}'); } catch { return {}; }
  }, [FEE_KEY]);
  const [feeSettings, setFeeSettingsState] = useState(() => {
    const s = (() => { try { return JSON.parse(localStorage.getItem(`fee_settings_${sid}`) || '{}'); } catch { return {}; } })();
    return { enabled: !!s.enabled, dueDay: s.dueDay || 1 };
  });
  const [feeSettingsOpen, setFeeSettingsOpen] = useState(false);
  const saveFeeSettings = (next) => {
    setFeeSettingsState(next);
    localStorage.setItem(FEE_KEY, JSON.stringify(next));
  };

  const [search, setSearch]       = useState("");
  const [view, setView]           = useState("grid");
  const [selected, setSelected]   = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm]   = useState({});
  const [showAdd, setShowAdd]     = useState(false);
  const [addForm, setAddForm]     = useState(EMPTY);
  const [showPicker, setShowPicker] = useState(false);  // avatar picker overlay
  const [pickerTarget, setPickerTarget] = useState("add"); // "add" | "edit"
  // Profile photo upload — file pending crop, target form, upload progress
  const [cropFile, setCropFile] = useState(null);
  const [cropTarget, setCropTarget] = useState("add"); // "add" | "edit"
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef(null);
  // Fee reminder via Smart Announce — null = closed, student = open
  const [feeReminderStudent, setFeeReminderStudent] = useState(null);

  const PANEL_W = 400;

  const [windowWidth, setWindowWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    const h = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  const isMobile = windowWidth < 768;

  // ── Data ─────────────────────────────────────────────────────────────────
  const { data: list = [], isLoading } = useQuery({
    queryKey: ["students", sid],
    queryFn: () => api.list(sid),
    enabled: !!sid,
  });

  const { data: batchList = [] } = useQuery({
    queryKey: ["batches", sid],
    queryFn: async () => { const d = await batchApi.list(sid); return d?.batches || d || []; },
    enabled: !!sid,
  });

  // Parse comma-separated batch ID string from list query into number array
  const parseBatchIds = (str) => str ? String(str).split(",").map(Number).filter(Boolean) : [];

  const invalidate = () => { qc.invalidateQueries(["students", sid]); qc.invalidateQueries(["stats", sid]); };

  const addMutation = useMutation({
    mutationFn: data => {
      // Auto-assign a random dancer sticker if none was chosen
      const payload = { ...data, avatar: data.avatar || randomSpriteVal() };
      return api.create(sid, payload);
    },
    onSuccess: () => { invalidate(); toast.success("Student added"); setShowAdd(false); setAddForm(EMPTY); },
    onError: err => toast.error(err?.error || "Failed to add student"),
  });

  const editMutation = useMutation({
    mutationFn: async ({ batch_ids, ...data }) => {
      await api.update(sid, selected.id, data);
      await api.setBatches(sid, selected.id, batch_ids || []);
      return { batch_ids, ...data };
    },
    onSuccess: (vars) => {
      invalidate();
      toast.success("Student updated");
      const batchNames = (vars.batch_ids || [])
        .map(id => batchList.find(b => b.id === Number(id))?.name)
        .filter(Boolean).join(", ");
      setSelected(s => ({ ...s, ...vars, batches: batchNames, batch_ids: (vars.batch_ids || []).join(",") }));
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

  // ── Fee toggle mutation ───────────────────────────────────────────────────
  const feeToggleMutation = useMutation({
    mutationFn: ({ studentId }) => api.toggleFee(sid, studentId, feeSettings.dueDay),
    onSuccess: ({ fee }, { studentId }) => {
      // Optimistically update the list cache
      qc.setQueryData(["students", sid], old =>
        (old || []).map(s => s.id === studentId
          ? { ...s, current_fee_status: fee?.status || null, current_fee_id: fee?.id || null }
          : s
        )
      );
      // Also update selected if it's the same student
      setSelected(sel => sel?.id === studentId
        ? { ...sel, current_fee_status: fee?.status || null }
        : sel
      );
    },
    onError: () => toast.error("Could not update fee status"),
  });

  // ── Helpers ──────────────────────────────────────────────────────────────
  const filtered  = list.filter(s => s.name?.toLowerCase().includes(search.toLowerCase()));
  const fmtLong   = d => { if (!d) return null; const [y,m,dy] = (d||"").slice(0,10).split("-").map(Number); return (y&&m&&dy) ? new Date(y,m-1,dy).toLocaleDateString("en",{year:"numeric",month:"long",day:"numeric"}) : null; };
  const fmtShort  = d => { if (!d) return null; const [y,m,dy] = (d||"").slice(0,10).split("-").map(Number); return (y&&m&&dy) ? new Date(y,m-1,dy).toLocaleDateString("en",{month:"short",year:"numeric"}) : null; };

  // Fee status helpers
  const feeBadgeProps = (status, dueDay) => {
    const today = new Date().getDate();
    if (status === 'Paid')    return { label: "✓ Paid",    bg: "#52c4a014", border: "#52c4a0", color: "#52c4a0" };
    if (status === 'Overdue') return { label: "⚠ Overdue", bg: "#e05c6a14", border: "#e05c6a", color: "#e05c6a" };
    if (status === 'Pending') return today > dueDay
      ? { label: "⚠ Overdue", bg: "#e05c6a14", border: "#e05c6a", color: "#e05c6a" }
      : { label: "Due",        bg: "#f4a04114", border: "#f4a041", color: "#b45309" };
    // No record — show based on whether due day has passed
    return today > dueDay
      ? { label: "⚠ Overdue", bg: "#e05c6a14", border: "#e05c6a", color: "#e05c6a" }
      : { label: "Fee due",   bg: "var(--surface)", border: "var(--border)", color: "var(--muted)" };
  };

  const openAdd    = () => { setAddForm({ ...EMPTY, join_date: new Date().toISOString().split("T")[0] }); setSelected(null); setIsEditing(false); setShowAdd(true); };
  const pick       = s  => { setSelected(s); setIsEditing(false); };
  const startEdit  = ()  => { setEditForm({ ...selected, batch_ids: parseBatchIds(selected.batch_ids) }); setIsEditing(true); };

  const openPickerFor = (target) => { setPickerTarget(target); setShowPicker(true); };

  // ── Profile photo upload (new) ──────────────────────────────────────────
  // Click the upload button → file picker → ProfileCropModal → upload to
  // Cloudinary → save as `photo:<URL>` on the student.avatar field.
  const openPhotoUploadFor = (target) => {
    setCropTarget(target);
    photoInputRef.current?.click();
  };
  const handlePhotoFilePick = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image too large (max 10 MB)");
      return;
    }
    setCropFile(file);
  };
  const handlePhotoCropConfirm = async (dataUrl) => {
    setCropFile(null);
    setUploadingPhoto(true);
    try {
      const { url } = await uploadApi.image(dataUrl);
      const val = `photo:${url}`;
      if (cropTarget === "add")  setAddForm(f  => ({ ...f,  avatar: val }));
      if (cropTarget === "edit") setEditForm(f => ({ ...f, avatar: val }));
      toast.success("Profile picture set");
    } catch (err) {
      toast.error(err?.error || "Failed to upload photo");
    } finally {
      setUploadingPhoto(false);
    }
  };
  const clearPhoto = (target) => {
    if (target === "add")  setAddForm(f  => ({ ...f,  avatar: "" }));
    if (target === "edit") setEditForm(f => ({ ...f, avatar: "" }));
  };
  const handleAvatarPick = (val) => {
    if (pickerTarget === "add")  setAddForm(f  => ({ ...f,  avatar: val }));
    if (pickerTarget === "edit") setEditForm(f => ({ ...f, avatar: val }));
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ paddingRight: (selected || showAdd) && !isMobile ? PANEL_W + 20 : 0, transition: "padding .25s ease" }}>

      {/* ── Tab switcher — Batches | Students ── */}
      <PageTabs tabs={ROSTER_TABS} />

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-d)", fontSize: 24, marginBottom: 2 }}>Students</h1>
          <p style={{ color: "var(--muted)", fontSize: 12 }}>{list.length} enrolled</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginLeft: "auto" }}>
          <div style={{ display: "flex", border: "1.5px solid var(--border)", borderRadius: 9, overflow: "hidden" }}>
            <button onClick={() => setView("grid")} title="Grid view"
              style={{ padding: "7px 13px", border: "none", cursor: "pointer", fontSize: 16, lineHeight: 1, transition: "all .15s",
                background: view === "grid" ? "var(--accent)" : "transparent",
                color: view === "grid" ? "#fff" : "var(--muted)" }}>⊞</button>
            <button onClick={() => setView("table")} title="Table view"
              style={{ padding: "7px 13px", border: "none", borderLeft: "1.5px solid var(--border)", cursor: "pointer", fontSize: 16, lineHeight: 1, transition: "all .15s",
                background: view === "table" ? "var(--accent)" : "transparent",
                color: view === "table" ? "#fff" : "var(--muted)" }}>☰</button>
          </div>
          <Button onClick={openAdd} icon="➕">Add Student</Button>
        </div>
      </div>

      {/* ── Search + Fee Settings row ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: feeSettingsOpen ? 0 : 18, flexWrap: "wrap" }}>
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search students…" style={{ maxWidth: 280 }} />
        <button
          onClick={() => setFeeSettingsOpen(o => !o)}
          title="Fee tracking settings"
          style={{
            display: "flex", alignItems: "center", gap: 6, padding: "7px 13px",
            borderRadius: 9, border: `1.5px solid ${feeSettings.enabled ? "var(--accent)" : "var(--border)"}`,
            background: feeSettings.enabled ? "var(--accent)18" : "transparent",
            color: feeSettings.enabled ? "var(--accent)" : "var(--muted)",
            cursor: "pointer", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap",
          }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
            <path d="M12 2v2m0 16v2M2 12h2m16 0h2"/>
          </svg>
          Fee Tracking {feeSettings.enabled ? "On" : "Off"}
        </button>
      </div>

      {/* ── Fee Settings Banner ── */}
      {feeSettingsOpen && (
        <div style={{
          margin: "10px 0 18px", padding: "14px 18px", borderRadius: 11,
          background: "var(--card)", border: "1.5px solid var(--border)",
          display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
        }}>
          {/* Toggle */}
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>Track monthly fees</span>
            <button
              type="button"
              onClick={() => saveFeeSettings({ ...feeSettings, enabled: !feeSettings.enabled })}
              style={{
                width: 44, height: 24, borderRadius: 999, border: "none",
                background: feeSettings.enabled ? "var(--accent)" : "var(--border)",
                position: "relative", cursor: "pointer", transition: "background .2s", flexShrink: 0,
              }}>
              <span style={{
                display: "block", width: 18, height: 18, borderRadius: "50%", background: "#fff",
                boxShadow: "0 1px 4px rgba(0,0,0,.25)", position: "absolute", top: 3,
                left: feeSettings.enabled ? "calc(100% - 21px)" : "3px",
                transition: "left .2s cubic-bezier(0.4,0,0.2,1)",
              }} />
            </button>
          </label>

          {feeSettings.enabled && (
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text)" }}>
              <span>Due on</span>
              <select
                value={feeSettings.dueDay}
                onChange={e => saveFeeSettings({ ...feeSettings, dueDay: Number(e.target.value) })}
                style={{ padding: "4px 8px", borderRadius: 7, border: "1.5px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 13, fontWeight: 600 }}
              >
                {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                  <option key={d} value={d}>{d === 1 ? "1st" : d === 2 ? "2nd" : d === 3 ? "3rd" : `${d}th`} of month</option>
                ))}
              </select>
            </label>
          )}

          {feeSettings.enabled && (
            <span style={{ fontSize: 11, color: "var(--muted)", flex: 1 }}>
              Fee badges appear on all student cards. Click a badge to mark Paid or Unpaid.
            </span>
          )}

          <button onClick={() => setFeeSettingsOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 18, lineHeight: 1, marginLeft: "auto" }}>×</button>
        </div>
      )}

      {/* ── Content ── */}
      {isLoading ? (
        <p style={{ color: "var(--muted)" }}>Loading…</p>

      ) : filtered.length === 0 ? (
        <Card style={{ textAlign: "center", padding: 48, border: "1.5px dashed var(--border)" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🌟</div>
          <p style={{ fontWeight: 700, marginBottom: 4 }}>No students yet</p>
          <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 16 }}>Add your first student to get started.</p>
          <Button onClick={openAdd}>Add Student</Button>
        </Card>

      ) : view === "grid" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))", gap: 16 }}>
          {filtered.map(s => {
            const active   = selected?.id === s.id;
            const batches  = s.batches ? String(s.batches).split(",").map(b => b.trim()).filter(Boolean) : [];
            const noEnroll = batches.length === 0;
            const joinStr  = fmtShort(s.join_date);
            return (
              <div key={s.id} onClick={() => pick(s)} style={{
                background: "var(--card)", borderRadius: 14, cursor: "pointer",
                border: `1.5px solid ${active ? "var(--accent)" : "var(--border)"}`,
                boxShadow: active ? "0 0 0 3px rgba(196,82,122,.13)" : "0 2px 8px rgba(0,0,0,.05)",
                transition: "all .15s", overflow: "hidden",
              }}>
                <div style={{ padding: "18px 18px 14px", display: "flex", alignItems: "center", gap: 14 }}>
                  <StudentAvatar student={s} size={52} active={active} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text)" }}>{s.name}</div>
                  </div>
                </div>
                <div style={{ height: 1, background: "var(--border)", margin: "0 18px" }} />
                <div style={{ padding: "10px 18px", display: "flex", alignItems: "center", gap: 8 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                  <span style={{ fontSize: 12, color: joinStr ? "var(--muted)" : "var(--border)", fontStyle: joinStr ? "normal" : "italic" }}>
                    {joinStr ? `Joined ${joinStr}` : "No join date recorded"}
                  </span>
                </div>
                <div style={{ height: 1, background: "var(--border)", margin: "0 18px" }} />
                <div style={{ padding: "10px 18px 14px" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 7 }}>Enrolled Classes</div>
                  {noEnroll ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#fff8e6", border: "1.5px dashed #f4a041", borderRadius: 20, padding: "3px 10px", fontSize: 11, color: "#b45309", fontWeight: 600 }}>⚠ Not enrolled in any batch</span>
                  ) : (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                      {batches.map((b, i) => (
                        <span key={i} style={{ fontSize: 11, background: "var(--surface)", color: "var(--text)", borderRadius: 20, padding: "3px 10px", border: "1px solid var(--border)", fontWeight: 500 }}>{b}</span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Fee badge — only when tracking is on */}
                {feeSettings.enabled && (() => {
                  const bp = feeBadgeProps(s.current_fee_status, feeSettings.dueDay);
                  return (
                    <div style={{ padding: "0 18px 14px" }}>
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); feeToggleMutation.mutate({ studentId: s.id }); }}
                        title="Click to toggle Paid / Unpaid"
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          padding: "4px 12px", borderRadius: 20, cursor: "pointer",
                          fontSize: 11, fontWeight: 700, border: `1.5px solid ${bp.border}`,
                          background: bp.bg, color: bp.color, transition: "all .15s",
                        }}>
                        {bp.label}
                      </button>
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>

      ) : (
        <div style={{ background: "var(--card)", borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--surface)" }}>
                {["Student","Contact","Batch","Joined",""].map(h => (
                  <th key={h} style={{ padding: "11px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => {
                const active = selected?.id === s.id;
                return (
                  <tr key={s.id} onClick={() => pick(s)} style={{ borderTop: "1px solid var(--border)", cursor: "pointer", background: active ? "rgba(196,82,122,.04)" : "transparent", transition: "background .1s" }}>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <StudentAvatar student={s} size={34} />
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{s.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--muted)", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.email || s.phone || "—"}</td>
                    <td style={{ padding: "10px 14px" }}>
                      {s.batches
                        ? <span style={{ fontSize: 11, background: "var(--accent)18", color: "var(--accent)", borderRadius: 20, padding: "2px 9px", fontWeight: 600 }}>{String(s.batches).split(",")[0].trim()}</span>
                        : <span style={{ color: "var(--muted)", fontSize: 12 }}>—</span>}
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--muted)" }}>{fmtShort(s.join_date) || "—"}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <button onClick={e => { e.stopPropagation(); if (window.confirm("Remove student?")) deleteMutation.mutate(s.id); }}
                        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "var(--muted)", padding: "3px 7px", borderRadius: 6, opacity: .6 }}>🗑</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Right side panel ── */}
      {(selected || showAdd) && isMobile && (
        <div onClick={() => { setSelected(null); setIsEditing(false); setShowAdd(false); }}
          style={{ position: "fixed", inset: 0, top: 56, background: "rgba(0,0,0,0.4)", zIndex: 399 }} />
      )}
      {(selected || showAdd) && (
        <div style={{
          position: "fixed", right: 0, bottom: 0, zIndex: 400,
          top: isMobile ? 56 : 0,
          width: isMobile ? "100vw" : PANEL_W,
          left: isMobile ? 0 : "auto",
          background: "var(--card)",
          borderLeft: isMobile ? "none" : "1.5px solid var(--border)",
          display: "flex", flexDirection: "column",
          boxShadow: isMobile ? "0 -4px 32px rgba(0,0,0,.14)" : "-6px 0 32px rgba(0,0,0,.09)",
        }}>
          {/* Panel header */}
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".08em" }}>
              {showAdd ? "New Student" : isEditing ? "Edit Student" : "Student Profile"}
            </span>
            <button onClick={() => { setSelected(null); setIsEditing(false); setShowAdd(false); }}
              style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "var(--muted)", lineHeight: 1, padding: 4, borderRadius: 6 }}>✕</button>
          </div>

          {/* ── ADD mode ── */}
          {showAdd && (() => {
            return (
              <div style={{ flex: 1, overflowY: "auto", padding: "22px 24px" }}>
                {/* Avatar row: avatar preview + Upload Photo (primary) +
                    Pick Sticker (secondary). Same pattern repeated below
                    for edit mode. */}
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18, padding: "14px 16px", background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border)" }}>
                  <StudentAvatar student={{ ...addForm, id: 0 }} size={56} onClick={() => openPhotoUploadFor("add")} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Profile picture</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button type="button" onClick={() => openPhotoUploadFor("add")} disabled={uploadingPhoto}
                        style={{ padding: "5px 12px", borderRadius: 16, border: "1.5px solid var(--accent)", background: "var(--accent)", color: "#fff", cursor: uploadingPhoto ? "wait" : "pointer", fontSize: 12, fontWeight: 700 }}>
                        {uploadingPhoto ? "Uploading…" : "Upload photo"}
                      </button>
                      <button type="button" onClick={() => openPickerFor("add")}
                        style={{ padding: "5px 12px", borderRadius: 16, border: "1.5px solid var(--border)", background: "transparent", color: "var(--muted)", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                        Pick sticker
                      </button>
                      {addForm.avatar && (
                        <button type="button" onClick={() => clearPhoto("add")}
                          style={{ padding: "5px 10px", borderRadius: 16, border: "1.5px solid var(--border)", background: "transparent", color: "var(--muted)", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Modern inputs — placeholder-as-label, no separate label.
                    Mirrors the /register form pattern for consistency. */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
                  <input value={addForm.name} onChange={e => setAddForm({ ...addForm, name: e.target.value })} placeholder="Full name *" aria-label="Full name" style={MODERN_INPUT} />
                  <input value={addForm.phone} onChange={e => setAddForm({ ...addForm, phone: e.target.value })} placeholder="Phone / WhatsApp" aria-label="Phone" style={MODERN_INPUT} />
                  <input type="email" value={addForm.email} onChange={e => setAddForm({ ...addForm, email: e.target.value })} placeholder="Email" aria-label="Email" style={MODERN_INPUT} />
                  <input value={addForm.guardian_name} onChange={e => setAddForm({ ...addForm, guardian_name: e.target.value })} placeholder="Guardian name" aria-label="Guardian name" style={MODERN_INPUT} />
                  <input value={addForm.guardian_phone} onChange={e => setAddForm({ ...addForm, guardian_phone: e.target.value })} placeholder="Guardian phone" aria-label="Guardian phone" style={MODERN_INPUT} />
                  <input type="email" value={addForm.guardian_email} onChange={e => setAddForm({ ...addForm, guardian_email: e.target.value })} placeholder="Guardian email" aria-label="Guardian email" style={MODERN_INPUT} />
                  <input type="date" value={addForm.join_date} onChange={e => setAddForm({ ...addForm, join_date: e.target.value })} aria-label="Join date" style={MODERN_INPUT} />
                  <textarea value={addForm.notes} onChange={e => setAddForm({ ...addForm, notes: e.target.value })} placeholder="Notes" aria-label="Notes" rows={3} style={{ ...MODERN_INPUT, resize: "vertical", minHeight: 70, lineHeight: 1.5 }} />
                </div>
                <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
                  <Button onClick={() => addMutation.mutate(addForm)} disabled={!addForm.name || addMutation.isPending}>
                    {addMutation.isPending ? "Adding…" : "Add Student"}
                  </Button>
                  <Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
                </div>
              </div>
            );
          })()}

          {/* ── VIEW / EDIT mode — unified scrollable layout ──
              The hero (large avatar + name) flows with the content instead
              of being pinned at the top. Edit toggles fields inline rather
              than swapping the whole layout. Save/Cancel commits or reverts. */}
          {!showAdd && selected && (
            <div style={{ flex: 1, overflowY: "auto" }}>
              {/* Top toolbar — Edit + Delete (admin) on the right, matches
                  the recital/event panels. In edit mode, swap Edit/Delete
                  for Save/Cancel. */}
              <div style={{ display: "flex", justifyContent: "flex-end", padding: "10px 16px 0", gap: 8 }}>
                {!isEditing ? (
                  <>
                    <button onClick={startEdit} title="Edit profile"
                      style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--surface)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text)" }}>
                      <SvgIcon name="pencil" size={14} color="currentColor" />
                    </button>
                    <button onClick={() => { if (window.confirm("Remove this student?")) deleteMutation.mutate(selected.id); }} title="Delete student"
                      style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--surface)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text)" }}>
                      <SvgIcon name="trash" size={14} color="currentColor" />
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => editMutation.mutate(editForm)} disabled={!editForm.name || editMutation.isPending}
                      style={{ padding: "6px 16px", borderRadius: 18, background: "var(--accent)", border: "none", color: "#fff", fontWeight: 700, fontSize: 12, cursor: editMutation.isPending ? "wait" : "pointer" }}>
                      {editMutation.isPending ? "Saving…" : "Save"}
                    </button>
                    <button onClick={() => setIsEditing(false)} disabled={editMutation.isPending}
                      style={{ padding: "6px 16px", borderRadius: 18, background: "transparent", border: "1.5px solid var(--border)", color: "var(--muted)", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                      Cancel
                    </button>
                  </>
                )}
              </div>

              {/* Profile hero — large circular avatar (3× the prior size).
                  Click anywhere on the avatar in edit mode to upload a photo;
                  a small ✕ overlay clears it. Compact 'pick sticker' link
                  sits below the avatar in edit mode. */}
              <div style={{ padding: "10px 24px 18px", textAlign: "center" }}>
                <div style={{ position: "relative", width: 240, height: 240, margin: "0 auto 14px" }}>
                  <StudentAvatar
                    student={isEditing ? editForm : selected}
                    size={240}
                    border="4px solid var(--accent)"
                    onClick={isEditing ? () => openPhotoUploadFor("edit") : undefined}
                  />
                  {isEditing && (
                    <>
                      <button onClick={() => openPhotoUploadFor("edit")} disabled={uploadingPhoto} title="Upload photo"
                        style={{ position: "absolute", bottom: 4, right: 4, width: 44, height: 44, borderRadius: "50%", background: "var(--accent)", border: "3px solid var(--card)", color: "#fff", fontSize: 18, cursor: uploadingPhoto ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <SvgIcon name="camera" size={18} color="#fff" />
                      </button>
                      {editForm.avatar && (
                        <button onClick={() => clearPhoto("edit")} title="Remove photo"
                          style={{ position: "absolute", top: 6, right: 6, width: 32, height: 32, borderRadius: "50%", background: "rgba(0,0,0,0.55)", border: "2px solid var(--card)", color: "#fff", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1, backdropFilter: "blur(4px)" }}>
                          ✕
                        </button>
                      )}
                    </>
                  )}
                </div>
                {!isEditing ? (
                  <div style={{ fontFamily: "var(--font-d)", fontSize: 22, fontWeight: 800, marginBottom: 6 }}>{selected.name}</div>
                ) : (
                  <input value={editForm.name || ""} onChange={e => setEditForm({ ...editForm, name: e.target.value })} placeholder="Full name *" aria-label="Full name"
                    style={{ ...MODERN_INPUT, textAlign: "center", fontFamily: "var(--font-d)", fontSize: 20, fontWeight: 800, marginBottom: 8, maxWidth: 320, marginLeft: "auto", marginRight: "auto" }} />
                )}
                {isEditing && (
                  <div style={{ display: "flex", justifyContent: "center", gap: 8, fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>
                    <button type="button" onClick={() => openPickerFor("edit")}
                      style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", textDecoration: "underline", fontSize: 11 }}>
                      Pick a sticker instead
                    </button>
                  </div>
                )}
                {(selected.batches || (isEditing && (editForm.batches || editForm.batch_ids))) && (
                  <div style={{ display: "flex", gap: 5, justifyContent: "center", flexWrap: "wrap" }}>
                    {String(selected.batches || "").split(",").filter(Boolean).map((b, i) => (
                      <span key={i} style={{ fontSize: 11, background: "var(--accent)22", color: "var(--accent)", borderRadius: 20, padding: "3px 10px", fontWeight: 600 }}>{b.trim()}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* Body sections — inline-editable fields. View mode shows
                  read-only InfoRows, Edit mode shows inputs with the same
                  visual rhythm so the page doesn't reflow on toggle. */}
              <div style={{ padding: "8px 24px 22px" }}>
                <PanelSection title="Contact">
                  {isEditing ? (
                    <div style={{ display: "grid", gap: 10 }}>
                      <input value={editForm.phone || ""} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} placeholder="Student / Guardian phone" aria-label="Student / Guardian phone" style={MODERN_INPUT} />
                      <input type="email" value={editForm.email || ""} onChange={e => setEditForm({ ...editForm, email: e.target.value })} placeholder="Student / Guardian email" aria-label="Student / Guardian email" style={MODERN_INPUT} />
                    </div>
                  ) : (
                    <>
                      <InfoRow icon="📞" label="Phone" value={selected.phone || selected.guardian_phone} />
                      <InfoRow icon="✉️" label="Email" value={selected.email || selected.guardian_email} />
                      {!selected.email && !selected.phone && !selected.guardian_phone && !selected.guardian_email &&
                        <p style={{ fontSize: 12, color: "var(--muted)" }}>No contact info on record</p>}
                    </>
                  )}
                </PanelSection>

                <PanelSection title="Enrollment">
                  {isEditing ? (
                    <input type="date" value={(editForm.join_date || "").split("T")[0]} onChange={e => setEditForm({ ...editForm, join_date: e.target.value })} aria-label="Join date" style={MODERN_INPUT} />
                  ) : (
                    <InfoRow icon="📅" label="Joined" value={fmtLong(selected.join_date)} />
                  )}
                  {!isEditing && feeSettings.enabled && (() => {
                    const bp = feeBadgeProps(selected.current_fee_status, feeSettings.dueDay);
                    return (
                      <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>Monthly Fee</span>
                        <button type="button" onClick={() => feeToggleMutation.mutate({ studentId: selected.id })}
                          title="Click to toggle Paid / Unpaid"
                          style={{ padding: "4px 14px", borderRadius: 20, cursor: "pointer", fontSize: 12, fontWeight: 700, border: `1.5px solid ${bp.border}`, background: bp.bg, color: bp.color }}>
                          {bp.label}
                        </button>
                      </div>
                    );
                  })()}
                </PanelSection>

                {isEditing && (
                  <div style={{ marginTop: 4, marginBottom: 14 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 8 }}>
                      Enrolled Batches
                    </div>
                    {batchList.length === 0 && (
                      <span style={{ fontSize: 12, color: "var(--muted)" }}>No batches yet — create one in Batches.</span>
                    )}
                    {batchList.length > 0 && batchList.length < 5 ? (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                        {batchList.map(b => {
                          const on = (editForm.batch_ids || []).includes(b.id);
                          return (
                            <button key={b.id} type="button"
                              onClick={() => setEditForm(f => ({ ...f, batch_ids: on ? (f.batch_ids || []).filter(x => x !== b.id) : [...(f.batch_ids || []), b.id] }))}
                              style={{ padding: "6px 15px", borderRadius: 20, cursor: "pointer", fontSize: 12, fontWeight: 700, border: `1.5px solid ${on ? "var(--accent)" : "var(--border)"}`, background: on ? "var(--accent)" : "transparent", color: on ? "#fff" : "var(--muted)" }}>
                              {on && "✓ "}{b.name}
                            </button>
                          );
                        })}
                      </div>
                    ) : batchList.length >= 5 ? (
                      <div style={{ maxHeight: 168, overflowY: "auto", borderRadius: 9, border: "1.5px solid var(--border)", background: "var(--surface)" }}>
                        {batchList.map(b => {
                          const on = (editForm.batch_ids || []).includes(b.id);
                          return (
                            <label key={b.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 13px", cursor: "pointer", background: on ? "var(--accent)14" : "transparent", borderBottom: "1px solid var(--border)" }}>
                              <input type="checkbox" checked={on}
                                onChange={() => setEditForm(f => ({ ...f, batch_ids: on ? (f.batch_ids || []).filter(x => x !== b.id) : [...(f.batch_ids || []), b.id] }))}
                                style={{ accentColor: "var(--accent)", width: 15, height: 15, flexShrink: 0 }} />
                              <span style={{ fontSize: 13, fontWeight: on ? 600 : 400, color: on ? "var(--accent)" : "var(--text)" }}>{b.name}</span>
                              {b.dance_style && <span style={{ fontSize: 10, color: "var(--muted)", marginLeft: "auto" }}>{b.dance_style}</span>}
                            </label>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                )}

                <PanelSection title="Notes">
                  {isEditing ? (
                    <textarea value={editForm.notes || ""} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} placeholder="Any notes…" rows={3} style={{ ...MODERN_INPUT, resize: "vertical", minHeight: 70, lineHeight: 1.5 }} />
                  ) : (
                    selected.notes
                      ? <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6, background: "var(--surface)", borderRadius: 9, padding: "10px 12px", margin: 0 }}>{selected.notes}</p>
                      : <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>No notes</p>
                  )}
                </PanelSection>

                {!isEditing && (
                  <>
                    <PanelSection title="Attendance">
                      <StudentAttendancePanel schoolId={String(sid)} studentId={selected.id} />
                    </PanelSection>

                    {/* Primary action — Smart Announce fee reminder.
                        Opens SmartAnnounceModal with student context so the
                        teacher can draft a friendly, parent-facing fee
                        reminder in one click. */}
                    <button onClick={() => setFeeReminderStudent(selected)}
                      style={{ width: "100%", marginTop: 16, padding: "12px 16px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #7C3AED 0%, #DC4EFF 100%)", color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 2px 12px rgba(124,58,237,0.32)" }}>
                      <SvgIcon name="mail" size={15} color="#fff" /> Send fee reminder
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Avatar Picker Overlay (legacy sticker grid) ── */}
      {showPicker && (
        <AvatarPicker
          current={pickerTarget === "add" ? addForm.avatar : editForm.avatar}
          onPick={handleAvatarPick}
          onClose={() => setShowPicker(false)}
        />
      )}

      {/* Hidden file input — triggered by the Upload Photo button.
          When a file is picked, ProfileCropModal opens to let the user
          frame the circular crop before upload. */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        onChange={handlePhotoFilePick}
        style={{ display: "none" }}
      />
      {cropFile && (
        <ProfileCropModal
          file={cropFile}
          onConfirm={handlePhotoCropConfirm}
          onCancel={() => setCropFile(null)}
        />
      )}

      {/* ── Smart Announce — Fee reminder ──────────────────────────────
          Triggered from the "Send fee reminder" button on the student
          profile panel. Pre-loads the modal with this student's context
          so the AI drafts a friendly, parent-facing payment reminder. */}
      <SmartAnnounceModal
        open={!!feeReminderStudent}
        onClose={() => setFeeReminderStudent(null)}
        ctx={feeReminderStudent ? {
          contextType: 'student',
          contextId: feeReminderStudent.id,
          title: feeReminderStudent.name || 'Student',
          subtitle: 'Fee reminder',
          color: '#7C3AED',
        } : null}
      />
    </div>
  );
}
