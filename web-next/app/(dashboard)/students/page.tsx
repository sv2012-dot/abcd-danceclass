// @ts-nocheck
'use client';

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/context/AuthContext";
import { students as api, batches as batchApi, schools as schoolApi, attendance as attendanceApi } from "@/lib/api";
import { formatDate } from "@/lib/date";
import toast from "react-hot-toast";
import Card from "@/components/shared/Card";
import Button from "@/components/shared/Button";
import { Field, Input, Textarea } from "@/components/shared/Field";
import ProfileCropModal from "@/components/shared/ProfileCropModal";
import SmartAnnounceModal from "@/components/smart/SmartAnnounceModal";
import SvgIcon from "@/components/shared/SvgIcon";
import { DateField } from "@/components/shared/date/Picker";
import { todayISO } from "@/lib/date";
import { upload as uploadApi } from "@/lib/api";
import StudentAttendancePanel from "@/components/attendance/StudentAttendancePanel";
import StudentAvatar from "@/components/shared/StudentAvatar";
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

// StudentAvatar is now a shared component (imported at the top). Every
// place a student is shown uses the same parsing rules + default sticker.

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

// ─── Variant-B profile-panel helpers ──────────────────────────────────────
// All scoped to the new dark-gradient student detail panel. Kept inside this
// file to avoid creating another shared component until the pattern is
// proven on /students; promote upstream if /batches or /recitals adopt it.

const BATCH_COVERS = [
  "linear-gradient(135deg, #c4527a, #e8607a)",
  "linear-gradient(135deg, #6a7fdb, #b47fe8)",
  "linear-gradient(135deg, #52c4a0, #4FD1C5)",
  "linear-gradient(135deg, #f4a041, #FFB347)",
  "linear-gradient(135deg, #7C3AED, #DC4EFF)",
];

const ATT_META = {
  present: { label: "Present", color: "#34c759" },
  late:    { label: "Late",    color: "#F59E0B" },
  excused: { label: "Excused", color: "#6366F1" },
  absent:  { label: "Absent",  color: "#EF5350" },
};

const secondaryActionStyle = {
  flex: 1,
  background: "var(--surface)",
  border: "1px solid var(--border)",
  color: "var(--text)",
  padding: "9px 10px",
  borderRadius: 20,
  fontSize: 11,
  fontWeight: 700,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  textDecoration: "none",
};

const editInputStyle = {
  width: "100%",
  background: "var(--card)",
  border: "1.5px solid var(--border)",
  borderRadius: 10,
  padding: "10px 14px",
  color: "var(--text)",
  fontSize: 13,
  fontWeight: 500,
  fontFamily: "var(--font-sans)",
  outline: "none",
};

// Stat tile — line-art icon (no circular background), big number, label.
function StatTile({ icon, n, label, accent = null, onClick = undefined }) {
  const iconNode = icon === 'clock' ? (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
  ) : icon === 'check' ? (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
  ) : icon === 'calendar' ? (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
  ) : icon === 'dollar' ? (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
  ) : null;
  return (
    <div onClick={onClick} style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 16,
      padding: "16px 12px 14px",
      textAlign: "center",
      cursor: onClick ? "pointer" : "default",
      transition: "border-color .12s",
    }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.borderColor = "var(--accent)"; }}
      onMouseLeave={e => { if (onClick) e.currentTarget.style.borderColor = "var(--border)"; }}
    >
      <div style={{ color: accent || "var(--accent)", marginBottom: 8, display: "inline-flex" }}>
        {iconNode}
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em", color: accent || "var(--text)", margin: "0 0 2px" }}>{n}</div>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: "var(--muted)", textTransform: "uppercase" }}>{label}</div>
    </div>
  );
}

// Section block — line-art icon inline with the title (no circle around it).
function SectionB({ title, icon, link = null, children }) {
  const iconNode = icon === 'clock' ? (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
  ) : icon === 'check' ? (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
  ) : icon === 'calendar' ? (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
  ) : icon === 'phone' ? (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
  ) : icon === 'users' ? (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
  ) : icon === 'file' ? (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
  ) : null;
  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 16,
      padding: "14px 14px 12px",
      marginBottom: 12,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h3 style={{ fontSize: 12, fontWeight: 800, margin: 0, color: "var(--text)", display: "inline-flex", alignItems: "center", gap: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          <span style={{ color: "var(--accent)", display: "inline-flex" }}>{iconNode}</span>
          {title}
        </h3>
        {link && <span style={{ fontSize: 10, fontWeight: 700, color: "var(--accent)", cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.08em" }}>{link}</span>}
      </div>
      {children}
    </div>
  );
}

// Bio card — inline-editable section that lives ABOVE the drill-downs.
// Independent of the page-wide Edit toggle: clicking the pencil enters
// edit-just-this-field mode; Save commits via the dedicated saveBio
// handler; Cancel reverts. View mode shows a soft accent-bordered quote.
function BioCard({ bio, editing, draft, saving, onStart, onChange, onSave, onCancel }) {
  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 16,
      padding: "14px 14px 12px",
      marginBottom: 12,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h3 style={{ fontSize: 12, fontWeight: 800, margin: 0, color: "var(--text)", display: "inline-flex", alignItems: "center", gap: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          <span style={{ color: "var(--accent)", display: "inline-flex" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          </span>
          Bio
        </h3>
        {!editing && (
          <button onClick={onStart} title="Edit bio"
            style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", display: "inline-flex", alignItems: "center", gap: 4 }}>
            <SvgIcon name="pencil" size={11} color="currentColor" />
            {bio ? "Edit" : "Add"}
          </button>
        )}
      </div>
      {editing ? (
        <>
          <textarea
            value={draft}
            onChange={e => onChange(e.target.value)}
            placeholder="A short bio — what they love, what they're working on, anything parent-facing…"
            rows={3}
            autoFocus
            style={{
              width: "100%",
              background: "var(--card)",
              border: "1.5px solid var(--accent)",
              borderRadius: 10,
              padding: "10px 12px",
              color: "var(--text)",
              fontSize: 13,
              fontFamily: "var(--font-sans)",
              lineHeight: 1.5,
              outline: "none",
              resize: "vertical",
              minHeight: 70,
            }}
          />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
            <button onClick={onCancel} disabled={saving}
              style={{ padding: "6px 14px", borderRadius: 16, border: "1.5px solid var(--border)", background: "transparent", color: "var(--muted)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
              Cancel
            </button>
            <button onClick={onSave} disabled={saving}
              style={{ padding: "6px 16px", borderRadius: 16, border: "none", background: "var(--accent)", color: "#fff", fontSize: 11, fontWeight: 700, cursor: saving ? "wait" : "pointer" }}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </>
      ) : bio ? (
        <div style={{ background: "var(--card)", borderLeft: "3px solid var(--accent)", borderRadius: 10, padding: "10px 12px" }}>
          <p style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.5, margin: 0, fontStyle: "italic" }}>{bio}</p>
        </div>
      ) : (
        <p style={{ fontSize: 12, color: "var(--muted)", margin: 0, fontStyle: "italic" }}>No bio yet — tap Add to write a short intro.</p>
      )}
    </div>
  );
}

// EnrollmentsCard — inline-editable batch enrollment, mirrors BioCard.
// View mode: shows enrolled batches as cards with the cover-gradient
// swatch. Edit mode: multi-select pills (same picker as the event form).
function EnrollmentsCard({ selected, batchList, editing, draft, saving, onStart, onToggle, onSave, onCancel }) {
  const batchNames = String(selected?.batches || "").split(",").map((x) => x.trim()).filter(Boolean);
  const enrolled = batchNames.length > 0 || editing;
  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 16,
      padding: "14px 14px 12px",
      marginBottom: 12,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h3 style={{ fontSize: 12, fontWeight: 800, margin: 0, color: "var(--text)", display: "inline-flex", alignItems: "center", gap: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          <span style={{ color: "var(--accent)", display: "inline-flex" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </span>
          Enrolled in
        </h3>
        {!editing && (
          <button onClick={onStart} title="Edit enrolments"
            style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", display: "inline-flex", alignItems: "center", gap: 4 }}>
            <SvgIcon name="pencil" size={11} color="currentColor" />
            {enrolled ? "Edit" : "Add"}
          </button>
        )}
      </div>
      {editing ? (
        <>
          {batchList.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>No batches yet — create one in Batches.</p>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {batchList.map((b) => {
                const on = (draft || []).includes(b.id);
                return (
                  <button key={b.id} type="button" onClick={() => onToggle(b.id)}
                    style={{ padding: "6px 14px", borderRadius: 18, cursor: "pointer", fontSize: 12, fontWeight: 700, border: `1.5px solid ${on ? "var(--accent)" : "var(--border)"}`, background: on ? "var(--accent)" : "transparent", color: on ? "#fff" : "var(--muted)", transition: "all .12s" }}>
                    {on && "✓ "}{b.name}
                  </button>
                );
              })}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
            <button onClick={onCancel} disabled={saving}
              style={{ padding: "6px 14px", borderRadius: 16, border: "1.5px solid var(--border)", background: "transparent", color: "var(--muted)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
              Cancel
            </button>
            <button onClick={onSave} disabled={saving}
              style={{ padding: "6px 16px", borderRadius: 16, border: "none", background: "var(--accent)", color: "#fff", fontSize: 11, fontWeight: 700, cursor: saving ? "wait" : "pointer" }}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </>
      ) : batchNames.length > 0 ? (
        <div style={{ display: "grid", gap: 8 }}>
          {batchNames.map((bn, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", padding: 10, background: "var(--card)", borderRadius: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, background: BATCH_COVERS[i % BATCH_COVERS.length] }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>{bn}</div>
              </div>
              <span style={{ color: "var(--muted)", fontSize: 14 }}>›</span>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ fontSize: 12, color: "var(--muted)", margin: 0, fontStyle: "italic" }}>Not enrolled in any batch yet — tap Add to enroll.</p>
      )}
    </div>
  );
}

// Mini stat (used inside the Attendance section)
function AttMini({ n, label, color }) {
  return (
    <div style={{ background: "var(--card)", borderRadius: 10, padding: "10px 6px", textAlign: "center", border: "1px solid var(--border)" }}>
      <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: "-0.02em", color }}>{n}</div>
      <div style={{ fontSize: 9, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 2 }}>{label}</div>
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
  // Bio inline editor — independent of the global edit toggle. Click to
  // edit just the bio field without entering the page-wide edit mode.
  const [bioEditing, setBioEditing] = useState(false);
  const [bioDraft, setBioDraft] = useState("");
  const [bioSaving, setBioSaving] = useState(false);

  // Enrollments inline editor — same pattern as bio. Lets the teacher
  // toggle batches on/off without entering the page-wide edit mode.
  const [enrollEditing, setEnrollEditing] = useState(false);
  const [enrollDraft, setEnrollDraft] = useState([]);
  const [enrollSaving, setEnrollSaving] = useState(false);

  // ── Variant-B hero data: 90-day attendance summary for the profile tiles
  //    and the Recent Classes / Attendance breakdown sections. Refetches
  //    whenever the user opens a different student. Mirrors the request
  //    StudentAttendancePanel makes internally so totals match exactly.
  const [profileAtt, setProfileAtt] = useState({ loading: false, stats: null, records: [] });
  useEffect(() => {
    if (!selected?.id || !sid) { setProfileAtt({ loading: false, stats: null, records: [] }); return; }
    let cancelled = false;
    setProfileAtt(p => ({ ...p, loading: true }));
    const today = new Date();
    const from = new Date(); from.setDate(today.getDate() - 90);
    attendanceApi
      .forStudent(String(sid), selected.id, {
        from: from.toISOString().slice(0, 10),
        to:   today.toISOString().slice(0, 10),
      })
      .then((d: any) => { if (!cancelled) setProfileAtt({ loading: false, stats: d.stats || null, records: d.records || [] }); })
      .catch(() => { if (!cancelled) setProfileAtt({ loading: false, stats: null, records: [] }); });
    return () => { cancelled = true; };
  }, [selected?.id, sid]);

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

  const invalidate = () => { qc.invalidateQueries({ queryKey: ["students", sid] }); qc.invalidateQueries({ queryKey: ["stats", sid] }); };

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

  // Bio save — independent of the page-wide edit mode. Fires only when the
  // user clicks Save on the bio card; everything else stays read-only.
  const saveBio = async () => {
    if (!selected) return;
    setBioSaving(true);
    try {
      await api.update(sid, selected.id, { bio: bioDraft });
      setSelected(s => ({ ...s, bio: bioDraft }));
      qc.invalidateQueries({ queryKey: ["students", sid] });
      setBioEditing(false);
    } catch (e) {
      toast.error(e?.error || "Failed to save bio");
    } finally {
      setBioSaving(false);
    }
  };

  // Enrollments save — also independent of global edit. Writes to the
  // batch_students join table via the same setBatches endpoint the main
  // edit flow uses, then updates the cached student row in place.
  const saveEnrollments = async () => {
    if (!selected) return;
    setEnrollSaving(true);
    try {
      await api.setBatches(sid, selected.id, enrollDraft);
      const newBatches = (enrollDraft || [])
        .map((id) => batchList.find((b) => b.id === Number(id))?.name)
        .filter(Boolean)
        .join(", ");
      setSelected((s) => ({ ...s, batches: newBatches, batch_ids: (enrollDraft || []).join(",") }));
      qc.invalidateQueries({ queryKey: ["students", sid] });
      qc.invalidateQueries({ queryKey: ["batches", sid] });
      setEnrollEditing(false);
      toast.success("Enrolment updated");
    } catch (e) {
      toast.error(e?.error || "Failed to save enrolments");
    } finally {
      setEnrollSaving(false);
    }
  };

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

  const openAdd    = () => { setAddForm({ ...EMPTY, join_date: todayISO() }); setSelected(null); setIsEditing(false); setShowAdd(true); };
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
          {/* View toggle — desktop only. On mobile we always show the
              responsive table-list and don't expose a grid option. */}
          {!isMobile && (
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
          )}
          <Button onClick={openAdd}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <SvgIcon name="plus" size={14} color="currentColor" />
              Add Student
            </span>
          </Button>
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

      ) : view === "grid" && !isMobile ? (
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

      ) : isMobile ? (
        // ── Mobile list view — table collapses to a stack of compact rows.
        //    Each row shows avatar + name + (batch chip on its own line) and
        //    contact / joined as one secondary line. Tap = open profile.
        <div style={{ background: "var(--card)", borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
          {filtered.map((s, i) => {
            const active = selected?.id === s.id;
            const firstBatch = s.batches ? String(s.batches).split(",")[0].trim() : null;
            const contact = s.email || s.phone || s.guardian_phone || null;
            return (
              <div key={s.id} onClick={() => pick(s)} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 14px",
                cursor: "pointer",
                background: active ? "var(--accent)0d" : "transparent",
                borderTop: i === 0 ? "none" : "1px solid var(--border)",
                transition: "background .1s",
              }}>
                <StudentAvatar student={s} size={40} active={active} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flex: 1 }}>{s.name}</span>
                    {firstBatch && (
                      <span style={{ fontSize: 10, background: "var(--accent)18", color: "var(--accent)", borderRadius: 20, padding: "2px 8px", fontWeight: 700, flexShrink: 0, maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{firstBatch}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {[contact, fmtShort(s.join_date) && `Joined ${fmtShort(s.join_date)}`].filter(Boolean).join(" · ") || "No contact"}
                  </div>
                </div>
                <span style={{ color: "var(--muted)", fontSize: 16, flexShrink: 0 }}>›</span>
              </div>
            );
          })}
        </div>
      ) : (
        // ── Desktop table view ──
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
          {/* Panel header — hidden in profile view on mobile (the back-arrow
              in the hero bar takes over). Add mode keeps the header so users
              still have a way to close the new-student form. */}
          {!(isMobile && selected && !showAdd) && (
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".08em" }}>
                {showAdd ? "New Student" : isEditing ? "Edit Student" : "Student Profile"}
              </span>
              <button onClick={() => { setSelected(null); setIsEditing(false); setShowAdd(false); }}
                style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "var(--muted)", lineHeight: 1, padding: 4, borderRadius: 6 }}>✕</button>
            </div>
          )}

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
                  <DateField label="Join date" value={addForm.join_date} onChange={v => setAddForm({ ...addForm, join_date: v })} />
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

          {/* ── VIEW / EDIT mode — Variant B layout ──
              Dark gradient hero with a glow-ring avatar, 2×2 stat tiles,
              primary CTA + secondary actions. Below the fold: drill-down
              sections for Recent Classes, Attendance breakdown, Batches,
              Fees, and Notes. Edit mode keeps inline fields inside the
              same dark frame so the page doesn't reflow on toggle. */}
          {!showAdd && selected && (() => {
            const stats   = profileAtt.stats || { total: 0, present: 0, late: 0, absent: 0, excused: 0, rate: null };
            const records = profileAtt.records || [];
            const batchNames = String(selected.batches || "").split(",").map(x => x.trim()).filter(Boolean);
            const batchCount = batchNames.length;
            const fee = feeSettings.enabled ? feeBadgeProps(selected.current_fee_status, feeSettings.dueDay) : null;
            const feeShort = fee ? fee.label.replace(/^[^A-Za-z]+/, '') : '—';
            return (
            <div style={{ flex: 1, overflowY: "auto", background: "var(--card)" }}>
              {/* Hero bar — back-arrow (left) + Edit/Delete or Save/Cancel
                  toolbar (right). The back button replaces the panel-header
                  "Profile" label on mobile; on desktop it's an additional
                  way to close the side panel. */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px 0" }}>
                <button onClick={() => { setSelected(null); setIsEditing(false); }} title="Back"
                  style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <SvgIcon name="arrow-left" size={14} color="currentColor" />
                </button>
                {!isEditing ? (
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={startEdit} title="Edit profile"
                      style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <SvgIcon name="pencil" size={13} color="currentColor" />
                    </button>
                    <button onClick={() => { if (window.confirm("Remove this student?")) deleteMutation.mutate(selected.id); }} title="Delete student"
                      style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <SvgIcon name="trash" size={13} color="currentColor" />
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => editMutation.mutate(editForm)} disabled={!editForm.name || editMutation.isPending} title="Save"
                      style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--accent)", border: "none", color: "#fff", cursor: editMutation.isPending ? "wait" : "pointer", fontSize: 14, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      ✓
                    </button>
                    <button onClick={() => setIsEditing(false)} disabled={editMutation.isPending} title="Cancel"
                      style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)", cursor: "pointer", fontSize: 14, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      ✕
                    </button>
                  </div>
                )}
              </div>

              {/* Avatar — brand-purple glow ring; in edit mode camera + remove
                  overlays. Ring stays vivid in both themes; the inner border
                  uses var(--card) so the ring frames properly on light too. */}
              <div style={{ display: "flex", justifyContent: "center", padding: "16px 0 14px", position: "relative" }}>
                <div style={{ width: 144, height: 144, borderRadius: "50%", padding: 6, background: "conic-gradient(from 220deg, #DC4EFF, #7C3AED, #DC4EFF)", boxShadow: "0 0 28px rgba(124,58,237,0.32), 0 0 60px rgba(220,78,255,0.12)", position: "relative" }}>
                  <div style={{ width: "100%", height: "100%", borderRadius: "50%", border: "4px solid var(--card)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <StudentAvatar student={isEditing ? editForm : selected} size={132}
                      onClick={isEditing ? () => openPhotoUploadFor("edit") : undefined} />
                  </div>
                  {isEditing && (
                    <>
                      <button onClick={() => openPhotoUploadFor("edit")} disabled={uploadingPhoto} title="Upload photo"
                        style={{ position: "absolute", bottom: -2, right: -2, width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg, #7C3AED 0%, #DC4EFF 100%)", border: "3px solid var(--card)", color: "#fff", cursor: uploadingPhoto ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(0,0,0,0.32)" }}>
                        <SvgIcon name="camera" size={16} color="#fff" />
                      </button>
                      {editForm.avatar && (
                        <button onClick={() => clearPhoto("edit")} title="Remove photo"
                          style={{ position: "absolute", top: 0, right: 0, width: 30, height: 30, borderRadius: "50%", background: "rgba(0,0,0,0.6)", border: "2px solid var(--card)", color: "#fff", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1, backdropFilter: "blur(4px)" }}>
                          ✕
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Name + role */}
              {!isEditing ? (
                <>
                  <h2 style={{ textAlign: "center", fontSize: 22, fontWeight: 800, margin: "0 0 4px", letterSpacing: "-0.02em", color: "var(--text)" }}>{selected.name}</h2>
                  <p style={{ textAlign: "center", fontSize: 12, color: "var(--accent)", fontWeight: 700, letterSpacing: "0.06em", margin: "0 0 18px", padding: "0 22px" }}>
                    {batchNames.length > 0 ? batchNames.join(" · ") : "Not enrolled in any batch"}
                  </p>
                </>
              ) : (
                <div style={{ padding: "0 22px 14px" }}>
                  <input value={editForm.name || ""} onChange={e => setEditForm({ ...editForm, name: e.target.value })} placeholder="Full name *" aria-label="Full name"
                    style={{ width: "100%", background: "var(--surface)", border: "1.5px solid var(--accent)", borderRadius: 10, padding: "10px 14px", color: "var(--text)", fontSize: 18, fontWeight: 800, textAlign: "center", fontFamily: "var(--font-d)", marginBottom: 8 }} />
                  <div style={{ textAlign: "center" }}>
                    <button type="button" onClick={() => openPickerFor("edit")}
                      style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: 11, fontWeight: 700, letterSpacing: "0.04em" }}>
                      Pick a sticker instead
                    </button>
                  </div>
                </div>
              )}

              {/* ── 2 stat tiles in 1 row: Attendance + Batches ── */}
              {!isEditing && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, padding: "0 18px 14px" }}>
                  <StatTile icon="check" n={stats.rate != null ? `${stats.rate}%` : "—"} label="Attendance"
                    accent={stats.rate != null && stats.rate >= 80 ? "#34c759" : stats.rate != null && stats.rate >= 60 ? "#F59E0B" : stats.rate != null ? "#EF5350" : null} />
                  <StatTile icon="calendar" n={String(batchCount)} label="Batches" />
                </div>
              )}

              {/* ── Primary CTA (Smart Announce w/ megaphone) + Call / Message ── */}
              {!isEditing && (
                <div style={{ padding: "0 18px 12px" }}>
                  <button onClick={() => setFeeReminderStudent(selected)}
                    style={{ width: "100%", padding: "13px 16px", borderRadius: 24, border: "none", background: "linear-gradient(135deg, #7C3AED 0%, #DC4EFF 100%)", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 8px 22px rgba(124,58,237,0.32)" }}>
                    <SvgIcon name="megaphone" size={15} color="#fff" /> Smart Announce
                  </button>
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    {selected.phone || selected.guardian_phone ? (
                      <a href={`tel:${selected.phone || selected.guardian_phone}`} style={secondaryActionStyle}>
                        <SvgIcon name="phone" size={12} color="currentColor" /> Call
                      </a>
                    ) : (
                      <span style={{ ...secondaryActionStyle, opacity: 0.4, cursor: "not-allowed" }}>
                        <SvgIcon name="phone" size={12} color="currentColor" /> Call
                      </span>
                    )}
                    {selected.phone || selected.guardian_phone ? (
                      <a href={`https://wa.me/${(selected.phone || selected.guardian_phone || '').replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer" style={secondaryActionStyle}>
                        <SvgIcon name="mail" size={12} color="currentColor" /> Message
                      </a>
                    ) : (
                      <span style={{ ...secondaryActionStyle, opacity: 0.4, cursor: "not-allowed" }}>
                        <SvgIcon name="mail" size={12} color="currentColor" /> Message
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* ── Drill-down sections ── */}
              <div style={{ padding: "10px 18px 22px" }}>
                {/* Bio — inline-editable, independent of the global edit mode.
                    Pencil = open editor; Save persists immediately. */}
                {!isEditing && (
                  <BioCard
                    bio={selected.bio}
                    editing={bioEditing}
                    draft={bioDraft}
                    saving={bioSaving}
                    onStart={() => { setBioDraft(selected.bio || ""); setBioEditing(true); }}
                    onChange={setBioDraft}
                    onSave={saveBio}
                    onCancel={() => { setBioEditing(false); setBioDraft(""); }}
                  />
                )}

                {/* Recent Classes */}
                {!isEditing && (
                  <SectionB title="Recent Classes" icon="clock" link={records.length > 0 ? "View all" : null}>
                    {profileAtt.loading ? (
                      <p style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", padding: "12px 0", margin: 0 }}>Loading…</p>
                    ) : records.length === 0 ? (
                      <p style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.6, margin: 0 }}>
                        No attendance yet. Mark some classes from the schedule page.
                      </p>
                    ) : (
                      <div>
                        {records.slice(0, 5).map(r => {
                          const meta = ATT_META[r.status] || ATT_META.absent;
                          const d = (r.class_date || '').slice(0, 10);
                          const [y, m, day] = d.split('-').map(Number);
                          const dt = (y && m && day) ? new Date(y, m - 1, day) : null;
                          return (
                            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                              <div style={{ flex: "0 0 44px", textAlign: "center" }}>
                                <div style={{ fontSize: 16, fontWeight: 800, lineHeight: 1, color: "var(--text)" }}>{dt ? dt.getDate() : "—"}</div>
                                <div style={{ fontSize: 9, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{dt ? dt.toLocaleDateString('en', { month: 'short' }) : ""}</div>
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {r.event_title || r.batch_name || "Class"}
                                </div>
                                <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 600 }}>
                                  {dt ? dt.toLocaleDateString('en', { weekday: 'short' }) : ""}
                                </div>
                              </div>
                              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", padding: "4px 9px", borderRadius: 12, background: meta.color + "26", color: meta.color }}>
                                {meta.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </SectionB>
                )}

                {/* Attendance breakdown */}
                {!isEditing && stats.total > 0 && (
                  <SectionB title="Attendance" icon="check" link="Last 90 days">
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
                      <AttMini n={stats.present} label="Present" color="#34c759" />
                      <AttMini n={stats.late}    label="Late"    color="#F59E0B" />
                      <AttMini n={stats.absent}  label="Absent"  color="#EF5350" />
                    </div>
                    <div style={{ height: 8, background: "var(--surface)", borderRadius: 4, overflow: "hidden", display: "flex" }}>
                      {stats.present > 0 && <div style={{ flex: stats.present, background: "#34c759" }} />}
                      {stats.late    > 0 && <div style={{ flex: stats.late,    background: "#F59E0B" }} />}
                      {stats.absent  > 0 && <div style={{ flex: stats.absent,  background: "#EF5350" }} />}
                    </div>
                  </SectionB>
                )}

                {/* Enrolled in — inline-editable, independent of the
                    page-wide Edit toggle. View shows enrolled batches
                    as cards; Edit shows multi-select pills (same picker
                    style as the event-form batch picker). */}
                {!isEditing && (
                  <EnrollmentsCard
                    selected={selected}
                    batchList={batchList}
                    editing={enrollEditing}
                    draft={enrollDraft}
                    saving={enrollSaving}
                    onStart={() => { setEnrollDraft(parseBatchIds(selected.batch_ids)); setEnrollEditing(true); }}
                    onToggle={(id) => setEnrollDraft((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id])}
                    onSave={saveEnrollments}
                    onCancel={() => { setEnrollEditing(false); setEnrollDraft([]); }}
                  />
                )}

                {/* Joined card (view mode) — single dedicated section */}
                {!isEditing && selected.join_date && (
                  <SectionB title="Joined" icon="calendar">
                    <p style={{ fontSize: 13, color: "var(--text)", fontWeight: 600, margin: 0 }}>
                      {fmtLong(selected.join_date)}
                    </p>
                  </SectionB>
                )}

                {/* ── Contact + Enrollment + Batches (edit mode only) ── */}
                {isEditing && (
                  <>
                    <SectionB title="Contact" icon="phone">
                      <div style={{ display: "grid", gap: 10 }}>
                        <input value={editForm.phone || ""} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} placeholder="Student / Guardian phone"
                          style={editInputStyle} />
                        <input type="email" value={editForm.email || ""} onChange={e => setEditForm({ ...editForm, email: e.target.value })} placeholder="Student / Guardian email"
                          style={editInputStyle} />
                      </div>
                    </SectionB>

                    <SectionB title="Joined" icon="calendar">
                      <DateField value={(editForm.join_date || "").split("T")[0]} onChange={v => setEditForm({ ...editForm, join_date: v })} />
                    </SectionB>

                    <SectionB title="Batches" icon="users">
                      {batchList.length === 0 && (
                        <span style={{ fontSize: 12, color: "var(--muted)" }}>No batches yet — create one in Batches.</span>
                      )}
                      {batchList.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                          {batchList.map(b => {
                            const on = (editForm.batch_ids || []).includes(b.id);
                            return (
                              <button key={b.id} type="button"
                                onClick={() => setEditForm(f => ({ ...f, batch_ids: on ? (f.batch_ids || []).filter(x => x !== b.id) : [...(f.batch_ids || []), b.id] }))}
                                style={{ padding: "6px 14px", borderRadius: 18, cursor: "pointer", fontSize: 12, fontWeight: 700, border: `1.5px solid ${on ? "var(--accent)" : "var(--border)"}`, background: on ? "var(--accent)" : "transparent", color: on ? "#fff" : "var(--muted)" }}>
                                {on && "✓ "}{b.name}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </SectionB>
                  </>
                )}

                {/* Notes — view shows entries, edit shows textarea */}
                <SectionB title="Notes" icon="file">
                  {isEditing ? (
                    <textarea value={editForm.notes || ""} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} placeholder="Any notes…" rows={3}
                      style={{ ...editInputStyle, resize: "vertical", minHeight: 70, lineHeight: 1.5 }} />
                  ) : selected.notes ? (
                    <div style={{ background: "var(--surface)", borderLeft: "3px solid var(--accent)", borderRadius: 10, padding: "12px 14px" }}>
                      <p style={{ fontSize: 12, color: "var(--text)", lineHeight: 1.5, margin: 0 }}>{selected.notes}</p>
                    </div>
                  ) : (
                    <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>No notes</p>
                  )}
                </SectionB>
              </div>
            </div>
            );
          })()}
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
