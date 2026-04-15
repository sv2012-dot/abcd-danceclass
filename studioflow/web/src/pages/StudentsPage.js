import React, { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { students as api, batches as batchApi, schools as schoolApi } from "../api";
import toast from "react-hot-toast";
import Card from "../components/shared/Card";
import Button from "../components/shared/Button";
import { Field, Input, Textarea } from "../components/shared/Field";

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

// Parse avatar value → returns { type:'sprite'|'legacy'|'none', index }
function parseAvatar(val) {
  if (!val) return { type:'none' };
  if (val.startsWith('sprite:')) return { type:'sprite', index: parseInt(val.slice(7), 10) };
  return { type:'legacy' }; // old dicebear format, show color fallback
}

// Random sprite 0–(TOTAL_STICKERS-1)
function randomSpriteVal() {
  return `sprite:${Math.floor(Math.random() * TOTAL_STICKERS)}`;
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

// ─── StudentAvatar ─────────────────────────────────────────────────────────
function StudentAvatar({ student, size = 44, border, active, onClick }) {
  const av = parseAvatar(student.avatar);
  return (
    <div
      onClick={onClick}
      style={{
        width: size, height: size, borderRadius: "50%", flexShrink: 0,
        overflow: "hidden",
        background: av.type === 'sprite' ? 'transparent' : getBgColor(student),
        border: border || `2px solid ${active ? "var(--accent)" : "var(--border)"}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.46, lineHeight: 1,
        transition: "border-color .15s, box-shadow .15s",
        userSelect: "none",
        cursor: onClick ? "pointer" : "default",
        boxShadow: onClick ? "0 0 0 0 transparent" : undefined,
      }}
      onMouseEnter={onClick ? e => { e.currentTarget.style.boxShadow = "0 0 0 3px rgba(196,82,122,.25)"; } : undefined}
      onMouseLeave={onClick ? e => { e.currentTarget.style.boxShadow = "0 0 0 0 transparent"; } : undefined}
    >
      {av.type === 'sprite'
        ? <SpriteAvatar index={av.index} size={size} />
        : <span style={{ fontSize: size * 0.46 }}>🎵</span>
      }
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
  const ageLabel  = age => { const n = Number(age); if (!age && age !== 0) return null; return n > 18 ? "Adult" : `${n} yrs`; };
  const ageDot    = age => { const n = Number(age); if (!age && age !== 0) return "#aaa"; if (n <= 8) return "#6a7fdb"; if (n <= 12) return "#f4a041"; if (n <= 18) return "#52c4a0"; return "#52c4a0"; };

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
  const handleAvatarPick = (val) => {
    if (pickerTarget === "add")  setAddForm(f  => ({ ...f,  avatar: val }));
    if (pickerTarget === "edit") setEditForm(f => ({ ...f, avatar: val }));
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ paddingRight: (selected || showAdd) && !isMobile ? PANEL_W + 20 : 0, transition: "padding .25s ease" }}>

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
            const label    = ageLabel(s.age);
            const dotColor = ageDot(s.age);
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
                    {label && (
                      <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 4 }}>
                        <div style={{ width: 7, height: 7, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 500 }}>{label}</span>
                      </div>
                    )}
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
                {["Student","Age","Contact","Batch","Joined",""].map(h => (
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
                    <td style={{ padding: "10px 14px", fontSize: 13, color: "var(--muted)" }}>{ageLabel(s.age) || "—"}</td>
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
            const addAge   = Number(addForm.age);
            const ageKnown = String(addForm.age ?? "").trim() !== "" && !isNaN(addAge) && addAge > 0;
            const isMinor  = ageKnown && addAge <= 18;
            const isAdult  = ageKnown && addAge > 18;
            return (
              <div style={{ flex: 1, overflowY: "auto", padding: "22px 24px" }}>
                {/* Avatar picker row */}
                <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20, padding: "14px 16px", background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border)" }}>
                  <StudentAvatar student={{ ...addForm, id: 0 }} size={56} onClick={() => openPickerFor("add")} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 3 }}>Profile Picture</div>
                    <button onClick={() => openPickerFor("add")} style={{ padding: "5px 14px", borderRadius: 20, border: "1.5px solid var(--accent)", background: "transparent", color: "var(--accent)", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                      {addForm.avatar ? "Change Avatar" : "Choose Avatar"}
                    </button>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
                  <Field label="Full Name *"><Input value={addForm.name} onChange={e => setAddForm({ ...addForm, name: e.target.value })} placeholder="Student name" /></Field>
                  <Field label="Age"><Input type="number" value={addForm.age} onChange={e => setAddForm({ ...addForm, age: e.target.value })} placeholder="e.g. 12" min="0" max="99" /></Field>
                  {(!ageKnown || isAdult) && (<>
                    <Field label="Phone / WhatsApp"><Input value={addForm.phone} onChange={e => setAddForm({ ...addForm, phone: e.target.value })} placeholder="+1 555 000 0000" /></Field>
                    <Field label="Email"><Input value={addForm.email} onChange={e => setAddForm({ ...addForm, email: e.target.value })} placeholder="email@example.com" /></Field>
                  </>)}
                  {isMinor && (<>
                    <Field label="Guardian Name *"><Input value={addForm.guardian_name} onChange={e => setAddForm({ ...addForm, guardian_name: e.target.value })} placeholder="Parent or guardian" /></Field>
                    <Field label="Guardian Phone"><Input value={addForm.guardian_phone} onChange={e => setAddForm({ ...addForm, guardian_phone: e.target.value })} placeholder="+1 555 000 0000" /></Field>
                    <Field label="Guardian Email"><Input value={addForm.guardian_email} onChange={e => setAddForm({ ...addForm, guardian_email: e.target.value })} placeholder="parent@email.com" /></Field>
                  </>)}
                  <Field label="Join Date"><Input type="date" value={addForm.join_date} onChange={e => setAddForm({ ...addForm, join_date: e.target.value })} /></Field>
                </div>
                <Field label="Notes"><Textarea value={addForm.notes} onChange={e => setAddForm({ ...addForm, notes: e.target.value })} placeholder="Any notes…" /></Field>
                <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
                  <Button onClick={() => addMutation.mutate(addForm)} disabled={!addForm.name || addMutation.isPending}>
                    {addMutation.isPending ? "Adding…" : "Add Student"}
                  </Button>
                  <Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
                </div>
              </div>
            );
          })()}

          {/* ── VIEW / EDIT mode ── */}
          {!showAdd && selected && (<>
            {/* Profile hero */}
            <div style={{ padding: "28px 24px 20px", textAlign: "center", borderBottom: "1px solid var(--border)", flexShrink: 0, background: "var(--surface)" }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 14, position: "relative", width: "fit-content", margin: "0 auto 14px" }}>
                <StudentAvatar
                  student={isEditing ? editForm : selected}
                  size={80}
                  border="3px solid var(--accent)"
                  onClick={isEditing ? () => openPickerFor("edit") : undefined}
                />
                {isEditing && (
                  <button onClick={() => openPickerFor("edit")} style={{
                    position: "absolute", bottom: -2, right: -2,
                    width: 24, height: 24, borderRadius: "50%",
                    background: "var(--accent)", border: "2px solid var(--card)",
                    color: "#fff", fontSize: 11, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    lineHeight: 1,
                  }}>✏</button>
                )}
              </div>
              <div style={{ fontFamily: "var(--font-d)", fontSize: 18, fontWeight: 800, marginBottom: 3 }}>{selected.name}</div>
              {selected.age && <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 10 }}>Age {selected.age}</div>}
              {selected.batches && (
                <div style={{ display: "flex", gap: 5, justifyContent: "center", flexWrap: "wrap" }}>
                  {String(selected.batches).split(",").map((b, i) => (
                    <span key={i} style={{ fontSize: 11, background: "var(--accent)22", color: "var(--accent)", borderRadius: 20, padding: "3px 10px", fontWeight: 600 }}>{b.trim()}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Scrollable body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "22px 24px" }}>
              {!isEditing ? (
                <>
                  <PanelSection title="Contact">
                    <InfoRow icon="✉️" label="Email" value={selected.email} />
                    <InfoRow icon="📞" label="Phone" value={selected.phone} />
                    {!selected.email && !selected.phone && <p style={{ fontSize: 12, color: "var(--muted)" }}>No contact info on record</p>}
                  </PanelSection>
                  {(selected.guardian_name || selected.guardian_phone || selected.guardian_email) && (
                    <PanelSection title="Guardian">
                      <InfoRow icon="🌸" label="Name"  value={selected.guardian_name} />
                      <InfoRow icon="📞" label="Phone" value={selected.guardian_phone} />
                      <InfoRow icon="✉️" label="Email" value={selected.guardian_email} />
                    </PanelSection>
                  )}
                  <PanelSection title="Enrollment">
                    <InfoRow icon="📅" label="Joined" value={fmtLong(selected.join_date)} />
                    {feeSettings.enabled && (() => {
                      const bp = feeBadgeProps(selected.current_fee_status, feeSettings.dueDay);
                      return (
                        <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>Monthly Fee</span>
                          <button
                            type="button"
                            onClick={() => feeToggleMutation.mutate({ studentId: selected.id })}
                            title="Click to toggle Paid / Unpaid"
                            style={{
                              padding: "4px 14px", borderRadius: 20, cursor: "pointer",
                              fontSize: 12, fontWeight: 700, border: `1.5px solid ${bp.border}`,
                              background: bp.bg, color: bp.color, transition: "all .15s",
                            }}>
                            {bp.label}
                          </button>
                        </div>
                      );
                    })()}
                  </PanelSection>
                  {selected.notes && (
                    <PanelSection title="Notes">
                      <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6, background: "var(--surface)", borderRadius: 9, padding: "10px 12px", margin: 0 }}>{selected.notes}</p>
                    </PanelSection>
                  )}
                  <div style={{ display: "flex", gap: 9, marginTop: 24 }}>
                    <Button onClick={startEdit} style={{ flex: 1 }}>✏️ Edit Profile</Button>
                    <Button variant="danger" onClick={() => { if (window.confirm("Remove this student?")) deleteMutation.mutate(selected.id); }}
                      style={{ padding: "9px 14px" }}>🗑</Button>
                  </div>
                </>
              ) : (
                <>
                  {(() => {
                    const ea = Number(editForm.age);
                    const eKnown = String(editForm.age ?? "").trim() !== "" && !isNaN(ea) && ea > 0;
                    const eMinor = eKnown && ea <= 18;
                    const eAdult = eKnown && ea > 18;
                    return (<>
                      <Field label="Full Name"><Input value={editForm.name || ""} onChange={e => setEditForm({ ...editForm, name: e.target.value })} /></Field>
                      <Field label="Age"><Input type="number" value={editForm.age || ""} onChange={e => setEditForm({ ...editForm, age: e.target.value })} placeholder="e.g. 12" min="0" max="99" /></Field>
                      {(!eKnown || eAdult) && (<>
                        <Field label="Phone / WhatsApp"><Input value={editForm.phone || ""} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} /></Field>
                        <Field label="Email"><Input value={editForm.email || ""} onChange={e => setEditForm({ ...editForm, email: e.target.value })} /></Field>
                      </>)}
                      {eMinor && (<>
                        <Field label="Guardian Name"><Input value={editForm.guardian_name || ""} onChange={e => setEditForm({ ...editForm, guardian_name: e.target.value })} /></Field>
                        <Field label="Guardian Phone"><Input value={editForm.guardian_phone || ""} onChange={e => setEditForm({ ...editForm, guardian_phone: e.target.value })} /></Field>
                        <Field label="Guardian Email"><Input value={editForm.guardian_email || ""} onChange={e => setEditForm({ ...editForm, guardian_email: e.target.value })} /></Field>
                      </>)}
                      <Field label="Join Date"><Input type="date" value={(editForm.join_date || "").split("T")[0]} onChange={e => setEditForm({ ...editForm, join_date: e.target.value })} /></Field>
                      <Field label="Notes"><Textarea value={editForm.notes || ""} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} placeholder="Any notes…" /></Field>
                    </>);
                  })()}

                  {/* ── Batch Enrollment Picker ── */}
                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 8 }}>
                      Enrolled Batches
                    </div>
                    {batchList.length === 0 && (
                      <span style={{ fontSize: 12, color: "var(--muted)" }}>No batches yet — create one in Batches.</span>
                    )}
                    {batchList.length > 0 && batchList.length < 5 ? (
                      /* Badge pill selector */
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                        {batchList.map(b => {
                          const on = (editForm.batch_ids || []).includes(b.id);
                          return (
                            <button key={b.id} type="button"
                              onClick={() => setEditForm(f => ({
                                ...f,
                                batch_ids: on
                                  ? (f.batch_ids || []).filter(x => x !== b.id)
                                  : [...(f.batch_ids || []), b.id],
                              }))}
                              style={{
                                padding: "6px 15px", borderRadius: 20, cursor: "pointer",
                                fontSize: 12, fontWeight: 700, transition: "all .12s",
                                border: `1.5px solid ${on ? "var(--accent)" : "var(--border)"}`,
                                background: on ? "var(--accent)" : "transparent",
                                color: on ? "#fff" : "var(--muted)",
                              }}
                            >
                              {on && "✓ "}{b.name}
                            </button>
                          );
                        })}
                      </div>
                    ) : batchList.length >= 5 ? (
                      /* Checkbox list in scrollable container */
                      <div style={{ maxHeight: 168, overflowY: "auto", borderRadius: 9, border: "1.5px solid var(--border)", background: "var(--surface)" }}>
                        {batchList.map(b => {
                          const on = (editForm.batch_ids || []).includes(b.id);
                          return (
                            <label key={b.id} style={{
                              display: "flex", alignItems: "center", gap: 10,
                              padding: "8px 13px", cursor: "pointer",
                              background: on ? "var(--accent)14" : "transparent",
                              borderBottom: "1px solid var(--border)",
                              transition: "background .1s",
                            }}>
                              <input type="checkbox" checked={on}
                                onChange={() => setEditForm(f => ({
                                  ...f,
                                  batch_ids: on
                                    ? (f.batch_ids || []).filter(x => x !== b.id)
                                    : [...(f.batch_ids || []), b.id],
                                }))}
                                style={{ accentColor: "var(--accent)", width: 15, height: 15, flexShrink: 0 }}
                              />
                              <span style={{ fontSize: 13, fontWeight: on ? 600 : 400, color: on ? "var(--accent)" : "var(--text)" }}>
                                {b.name}
                              </span>
                              {b.dance_style && (
                                <span style={{ fontSize: 10, color: "var(--muted)", marginLeft: "auto" }}>{b.dance_style}</span>
                              )}
                            </label>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>

                  <div style={{ display: "flex", gap: 9, marginTop: 14 }}>
                    <Button onClick={() => editMutation.mutate(editForm)} disabled={!editForm.name || editMutation.isPending}>
                      {editMutation.isPending ? "Saving…" : "Save Changes"}
                    </Button>
                    <Button variant="secondary" onClick={() => setIsEditing(false)}>Cancel</Button>
                  </div>
                </>
              )}
            </div>
          </>)}
        </div>
      )}

      {/* ── Avatar Picker Overlay ── */}
      {showPicker && (
        <AvatarPicker
          current={pickerTarget === "add" ? addForm.avatar : editForm.avatar}
          onPick={handleAvatarPick}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}
