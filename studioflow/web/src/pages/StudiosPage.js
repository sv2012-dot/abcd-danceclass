import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { studios as api } from "../api";
import toast from "react-hot-toast";
import Card from "../components/shared/Card";
import Button from "../components/shared/Button";
import { Field, Input, Textarea } from "../components/shared/Field";

const EMPTY = {
  name: "", address: "", city: "", state: "", zip: "",
  phone: "", email: "", website: "", capacity: "", hourly_rate: "",
  notes: "", is_favorite: false,
};

/* ─── Nominatim search (OpenStreetMap — no key, no billing) ─────────── */
async function searchPlaces(query) {
  if (!query.trim()) return [];
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("extratags", "1");
  url.searchParams.set("limit", "7");
  url.searchParams.set("dedupe", "1");
  const res = await fetch(url.toString(), {
    headers: { "Accept-Language": "en" },
  });
  if (!res.ok) throw new Error("Search failed");
  return res.json();
}

/* ─── Parse Nominatim result into form fields ───────────────────────── */
function parseNominatim(place) {
  const a = place.address || {};
  const road = [a.house_number, a.road].filter(Boolean).join(" ");
  return {
    name:        place.name || place.display_name?.split(",")[0]?.trim() || "",
    address:     road,
    city:        a.city || a.town || a.village || a.suburb || a.county || "",
    state:       a.state || "",
    zip:         a.postcode || "",
    phone:       place.extratags?.phone || place.extratags?.["contact:phone"] || "",
    website:     place.extratags?.website || place.extratags?.["contact:website"] || "",
    email:       place.extratags?.email || place.extratags?.["contact:email"] || "",
    notes:       "",
    capacity:    "",
    hourly_rate: "",
    is_favorite: false,
  };
}

/* ─── Category chip from OSM type/class ─────────────────────────────── */
const OSM_TYPES = {
  dance:             { label: "Dance Studio",      color: "#c4527a" },
  dance_school:      { label: "Dance School",      color: "#c4527a" },
  music_school:      { label: "Music School",      color: "#c4527a" },
  arts_centre:       { label: "Arts Centre",       color: "#8b5cf6" },
  community_centre:  { label: "Community Centre",  color: "#52c4a0" },
  social_centre:     { label: "Social Centre",     color: "#52c4a0" },
  gym:               { label: "Gym",               color: "#6a7fdb" },
  sports_centre:     { label: "Sports Centre",     color: "#6a7fdb" },
  fitness_centre:    { label: "Fitness Centre",    color: "#6a7fdb" },
  school:            { label: "School",            color: "#6a7fdb" },
  college:           { label: "College",           color: "#6a7fdb" },
  university:        { label: "University",        color: "#6a7fdb" },
  stadium:           { label: "Stadium",           color: "#f4a041" },
  theatre:           { label: "Theatre",           color: "#f4a041" },
  cinema:            { label: "Cinema",            color: "#f4a041" },
  place_of_worship:  { label: "Hall",              color: "#aaa"    },
  hall:              { label: "Hall",              color: "#aaa"    },
};
function getChip(place) {
  const t = place.type || "";
  const c = place.class || "";
  return OSM_TYPES[t] || OSM_TYPES[c] || { label: "Venue", color: "#6a7fdb" };
}

/* ─── Single suggestion tile ─────────────────────────────────────────── */
function PlaceTile({ place, onSelect, disabled }) {
  const chip    = getChip(place);
  const name    = place.name || place.display_name?.split(",")[0]?.trim() || "Unknown";
  const address = place.display_name || "";
  // strip the leading name from the display_name for the sub-line
  const sub = address.startsWith(name + ",")
    ? address.slice(name.length + 1).trim()
    : address;

  return (
    <button
      type="button"
      onClick={() => !disabled && onSelect(place)}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        width: "100%", border: "none", background: "var(--card)",
        padding: "11px 16px", cursor: disabled ? "wait" : "pointer",
        textAlign: "left", transition: "background .1s",
        borderBottom: "1px solid var(--border)",
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = "var(--surface)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "var(--card)"; }}
    >
      {/* icon */}
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: chip.color + "18",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={chip.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
        </svg>
      </div>

      {/* text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text)", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {name}
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {sub}
        </div>
      </div>

      {/* chip */}
      <span style={{
        fontSize: 10, fontWeight: 700, color: chip.color,
        background: chip.color + "18", borderRadius: 20,
        padding: "2px 8px", flexShrink: 0, whiteSpace: "nowrap",
      }}>
        {chip.label}
      </span>
    </button>
  );
}

/* ─── Add-studio panel form (internal — rendered inside side panel) ─── */
function _unused_AddStudioModal({ onClose, onSave, saving }) {
  const [phase,       setPhase]       = useState("search");
  const [query,       setQuery]       = useState("");
  const [results,     setResults]     = useState([]);
  const [searching,   setSearching]   = useState(false);
  const [searchErr,   setSearchErr]   = useState(null);
  const [form,        setForm]        = useState({ ...EMPTY });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const debounceRef = useRef(null);

  const handleQueryChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setSearchErr(null);
    clearTimeout(debounceRef.current);
    if (!val.trim()) { setResults([]); return; }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await searchPlaces(val);
        setResults(data);
      } catch {
        setSearchErr("Search failed — check your connection.");
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 380);
  };

  const handleSelect = (place) => {
    setForm(parseNominatim(place));
    setPhase("confirm");
  };

  const handleManual = () => {
    setForm({ ...EMPTY });
    setPhase("confirm");
  };

  return (
    <Modal title={phase === "search" ? "Add Studio" : (form.name || "New Studio")} onClose={onClose} wide>
      {phase === "search" ? (
        <div>
          {/* Search bar */}
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            background: "var(--surface)", border: "1.5px solid var(--border)",
            borderRadius: 12, padding: "10px 14px", marginBottom: 4,
            transition: "border-color .15s",
          }}
            onFocusCapture={e => e.currentTarget.style.borderColor = "var(--accent)"}
            onBlurCapture={e => e.currentTarget.style.borderColor = "var(--border)"}
          >
            {/* search icon */}
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              autoFocus
              type="text"
              value={query}
              onChange={handleQueryChange}
              placeholder="Search by venue name or address…"
              style={{
                flex: 1, border: "none", outline: "none",
                background: "transparent", fontSize: 14,
                color: "var(--text)", fontFamily: "var(--font-sans)",
              }}
            />
            {searching && (
              <div style={{
                width: 14, height: 14, flexShrink: 0,
                border: "2px solid var(--border)", borderTopColor: "var(--accent)",
                borderRadius: "50%", animation: "spin .6s linear infinite",
              }} />
            )}
          </div>

          {/* OSM attribution */}
          <div style={{ textAlign: "right", fontSize: 10, color: "var(--muted)", marginBottom: 10, paddingRight: 2 }}>
            © OpenStreetMap contributors
          </div>

          {/* Results */}
          {results.length > 0 && (
            <div style={{ borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden", marginBottom: 16 }}>
              {results.map((p, i) => (
                <PlaceTile key={p.place_id || i} place={p} onSelect={handleSelect} disabled={false} />
              ))}
            </div>
          )}

          {/* No results */}
          {query.length > 2 && !searching && results.length === 0 && !searchErr && (
            <div style={{ textAlign: "center", padding: "18px 0 4px", color: "var(--muted)", fontSize: 13 }}>
              No results for "{query}" — try a different name or postcode.
            </div>
          )}

          {/* Error */}
          {searchErr && (
            <div style={{ textAlign: "center", padding: "14px 0 4px", color: "#dc2626", fontSize: 13 }}>
              {searchErr}
            </div>
          )}

          {/* Manual fallback */}
          <div style={{
            marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--border)",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap",
          }}>
            <span style={{ fontSize: 13, color: "var(--muted)" }}>Can't find it in the results?</span>
            <button type="button" onClick={handleManual} style={{
              fontSize: 13, fontWeight: 600, color: "var(--accent)",
              background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline",
            }}>
              Enter details manually →
            </button>
          </div>
        </div>
      ) : (
        /* ── Confirm / fill-in phase ── */
        <div>
          <button type="button" onClick={() => setPhase("search")} style={{
            display: "flex", alignItems: "center", gap: 6, marginBottom: 18,
            background: "none", border: "none", cursor: "pointer",
            color: "var(--muted)", fontSize: 13, padding: 0,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Back to search
          </button>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
            <Field label="Studio Name *" style={{ gridColumn: "1 / -1" }}>
              <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Venue name" autoFocus />
            </Field>
            <Field label="Address" style={{ gridColumn: "1 / -1" }}>
              <Input value={form.address} onChange={e => set("address", e.target.value)} placeholder="Street address" />
            </Field>
            <Field label="City">
              <Input value={form.city} onChange={e => set("city", e.target.value)} placeholder="City" />
            </Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 10px" }}>
              <Field label="State"><Input value={form.state} onChange={e => set("state", e.target.value)} placeholder="State" /></Field>
              <Field label="ZIP"><Input value={form.zip} onChange={e => set("zip", e.target.value)} placeholder="ZIP / Postcode" /></Field>
            </div>
            <Field label="Phone">
              <Input value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="Phone number" />
            </Field>
            <Field label="Email">
              <Input type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="venue@example.com" />
            </Field>
            <Field label="Website" style={{ gridColumn: "1 / -1" }}>
              <Input value={form.website} onChange={e => set("website", e.target.value)} placeholder="https://example.com" />
            </Field>
            <Field label="Capacity (people)">
              <Input type="number" value={form.capacity} onChange={e => set("capacity", e.target.value)} placeholder="e.g. 200" min="0" />
            </Field>
            <Field label="Hourly Rate ($)">
              <Input type="number" value={form.hourly_rate} onChange={e => set("hourly_rate", e.target.value)} placeholder="e.g. 75" min="0" step="0.01" />
            </Field>
            <Field label="Notes" style={{ gridColumn: "1 / -1" }}>
              <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Parking, equipment, access notes…" rows={3} />
            </Field>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4, cursor: "pointer", userSelect: "none" }}>
            <input type="checkbox" checked={form.is_favorite} onChange={e => set("is_favorite", e.target.checked)} style={{ width: 16, height: 16, cursor: "pointer" }} />
            <span style={{ fontSize: 14, fontWeight: 500 }}>Mark as favourite venue ♥</span>
          </label>

          <div style={{ display: "flex", gap: 9, marginTop: 20 }}>
            <Button onClick={() => onSave(form)} disabled={!form.name || saving}>
              {saving ? "Saving…" : "Add Studio"}
            </Button>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </Modal>
  );
}

/* ─── Edit studio panel form (internal — rendered inside side panel) ── */
function _unused_EditStudioModal({ studio, onClose, onSave, saving }) {
  const [form, setForm] = useState({
    ...studio, is_favorite: !!studio.is_favorite,
    capacity: studio.capacity ?? "", hourly_rate: studio.hourly_rate ?? "",
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  return (
    <Modal title="Edit Studio" onClose={onClose} wide>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
        <Field label="Studio Name *" style={{ gridColumn: "1 / -1" }}><Input value={form.name} onChange={e => set("name", e.target.value)} /></Field>
        <Field label="Address" style={{ gridColumn: "1 / -1" }}><Input value={form.address} onChange={e => set("address", e.target.value)} /></Field>
        <Field label="City"><Input value={form.city} onChange={e => set("city", e.target.value)} /></Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 10px" }}>
          <Field label="State"><Input value={form.state} onChange={e => set("state", e.target.value)} /></Field>
          <Field label="ZIP"><Input value={form.zip} onChange={e => set("zip", e.target.value)} /></Field>
        </div>
        <Field label="Phone"><Input value={form.phone} onChange={e => set("phone", e.target.value)} /></Field>
        <Field label="Email"><Input type="email" value={form.email} onChange={e => set("email", e.target.value)} /></Field>
        <Field label="Website" style={{ gridColumn: "1 / -1" }}><Input value={form.website} onChange={e => set("website", e.target.value)} /></Field>
        <Field label="Capacity (people)"><Input type="number" value={form.capacity} onChange={e => set("capacity", e.target.value)} min="0" /></Field>
        <Field label="Hourly Rate ($)"><Input type="number" value={form.hourly_rate} onChange={e => set("hourly_rate", e.target.value)} min="0" step="0.01" /></Field>
        <Field label="Notes" style={{ gridColumn: "1 / -1" }}><Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={3} /></Field>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4, cursor: "pointer", userSelect: "none" }}>
        <input type="checkbox" checked={form.is_favorite} onChange={e => set("is_favorite", e.target.checked)} style={{ width: 16, height: 16 }} />
        <span style={{ fontSize: 14, fontWeight: 500 }}>Mark as favourite venue ♥</span>
      </label>
      <div style={{ display: "flex", gap: 9, marginTop: 20 }}>
        <Button onClick={() => onSave(form)} disabled={!form.name || saving}>{saving ? "Saving…" : "Save Changes"}</Button>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
      </div>
    </Modal>
  );
}

/* ─── Studio card ───────────────────────────────────────────────────── */
function StudioCard({ studio, active, onSelect, onEdit, onRemove, onToggleFav }) {
  const fullAddress    = [studio.address, studio.city, studio.state, studio.zip].filter(Boolean).join(", ");
  const websiteDisplay = studio.website?.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "") || null;
  return (
    <div onClick={() => onSelect(studio)} style={{
      background: "var(--card)", borderRadius: 14, cursor: "pointer",
      border: active ? "1.5px solid var(--accent)" : studio.is_favorite ? "1.5px solid #e0607e" : "1.5px solid var(--border)",
      boxShadow: active ? "0 0 0 3px rgba(196,82,122,.13)" : studio.is_favorite ? "0 2px 12px rgba(196,82,122,.15)" : "0 2px 8px rgba(0,0,0,.06)",
      display: "flex", flexDirection: "column", overflow: "hidden", transition: "all .15s",
    }}>
      <div style={{ padding: "18px 18px 14px", flex: 1 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.3, color: "var(--text)", flex: 1 }}>{studio.name}</div>
          <button onClick={e => { e.stopPropagation(); onToggleFav(studio); }} title={studio.is_favorite ? "Remove favourite" : "Mark favourite"}
            style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 4px", lineHeight: 1, flexShrink: 0, transition: "transform .15s", color: studio.is_favorite ? "#e0607e" : "#d1d5db" }}
            onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.2)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}>
            {studio.is_favorite
              ? <svg width="18" height="18" viewBox="0 0 24 24" fill="#e0607e" stroke="#e0607e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            }
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {fullAddress && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>📍</span>
              <span style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.4 }}>{fullAddress}</span>
            </div>
          )}
          {studio.phone && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14, flexShrink: 0 }}>📞</span>
              <a href={`tel:${studio.phone}`} style={{ fontSize: 13, color: "var(--accent)", textDecoration: "none" }}
                onMouseEnter={e => e.currentTarget.style.textDecoration = "underline"}
                onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}>{studio.phone}</a>
            </div>
          )}
          {websiteDisplay && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14, flexShrink: 0 }}>🌐</span>
              <a href={studio.website} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 13, color: "var(--accent)", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                onMouseEnter={e => e.currentTarget.style.textDecoration = "underline"}
                onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}>{websiteDisplay}</a>
            </div>
          )}
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 2 }}>
            {studio.capacity && <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ fontSize: 13 }}>👥</span><span style={{ fontSize: 13, color: "var(--muted)" }}>{studio.capacity} people</span></div>}
            {studio.hourly_rate && <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ fontSize: 13 }}>💰</span><span style={{ fontSize: 13, color: "var(--muted)" }}>${Number(studio.hourly_rate).toFixed(0)}/hr</span></div>}
          </div>
          {studio.notes && (
            <p style={{ fontSize: 12, color: "var(--muted)", fontStyle: "italic", margin: "4px 0 0", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              {studio.notes}
            </p>
          )}
        </div>
      </div>
      <div onClick={e => e.stopPropagation()} style={{ display: "flex", gap: 8, padding: "12px 18px", borderTop: "1px solid var(--border)", background: "var(--surface)" }}>
        <Button size="sm" variant="outline" onClick={() => onEdit(studio)}>Edit</Button>
        <Button size="sm" variant="ghost" onClick={() => { if (window.confirm(`Remove "${studio.name}"?`)) onRemove(studio.id); }} style={{ color: "#dc2626", marginLeft: "auto" }}>Remove</Button>
      </div>
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────────────────── */
const PANEL_W = 420;

export default function StudiosPage() {
  const { user } = useAuth();
  const sid = user?.school_id;
  const qc  = useQueryClient();
  const [saving,     setSaving]     = useState(false);
  const [selected,   setSelected]   = useState(null);
  const [panelMode,  setPanelMode]  = useState(null); // null | 'view' | 'edit' | 'add'
  const [addPhase,   setAddPhase]   = useState('search'); // 'search' | 'confirm'
  const [addQuery,   setAddQuery]   = useState('');
  const [addResults, setAddResults] = useState([]);
  const [addSearching, setAddSearching] = useState(false);
  const [addSearchErr, setAddSearchErr] = useState(null);
  const [addForm,  setAddForm]  = useState({ ...EMPTY });
  const [editForm, setEditForm] = useState({ ...EMPTY });
  const addDebounceRef = useRef(null);

  const [windowWidth, setWindowWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    const h = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  const isMobile = windowWidth < 768;

  const { data, isLoading } = useQuery({
    queryKey: ["studios", sid],
    queryFn:  () => api.list(sid).then(r => r.studios),
    enabled:  !!sid,
  });
  const list = data || [];

  const removeMutation = useMutation({
    mutationFn: id => api.remove(sid, id),
    onSuccess:  (_, id) => {
      qc.invalidateQueries(["studios", sid]);
      toast.success("Studio removed");
      if (selected?.id === id) setSelected(null);
    },
    onError: err => toast.error(err?.error || "Failed to remove"),
  });

  const handleSave = async () => {
    const form = panelMode === 'edit' ? editForm : addForm;
    if (!form?.name) return;
    setSaving(true);
    try {
      const payload = { ...form, capacity: form.capacity ? Number(form.capacity) : null, hourly_rate: form.hourly_rate ? Number(form.hourly_rate) : null, is_favorite: form.is_favorite ? 1 : 0 };
      if (panelMode === 'edit' && selected?.id) {
        await api.update(sid, selected.id, payload);
        toast.success("Studio updated");
        setSelected(s => ({ ...s, ...payload }));
        setPanelMode('view');
      } else {
        await api.create(sid, payload);
        toast.success("Studio added");
        setPanelMode(null);
        setSelected(null);
      }
      qc.invalidateQueries(["studios", sid]);
    } catch (err) { toast.error(err?.error || "Failed to save"); }
    finally       { setSaving(false); }
  };

  const handleToggleFav = async (studio) => {
    try {
      const payload = { ...studio, is_favorite: studio.is_favorite ? 0 : 1,
        capacity: studio.capacity ? Number(studio.capacity) : null,
        hourly_rate: studio.hourly_rate ? Number(studio.hourly_rate) : null };
      await api.update(sid, studio.id, payload);
      await qc.invalidateQueries(["studios", sid]);
      // keep selected in sync
      if (selected?.id === studio.id) setSelected(s => ({ ...s, is_favorite: payload.is_favorite }));
    }
    catch { toast.error("Failed to update favourite"); }
  };

  return (
    <div style={{ paddingRight: (selected || panelMode === 'add') && !isMobile ? PANEL_W + 20 : 0, transition: "padding .25s ease" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-d)", fontSize: 26, marginBottom: 4 }}>Studio Bookings</h1>
          <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>Manage venues used for classes, rehearsals, and performances</p>
        </div>
        <Button onClick={() => { setSelected(null); setPanelMode('add'); setAddPhase('search'); setAddQuery(''); setAddResults([]); setAddSearchErr(null); }} icon="➕">Add Studio</Button>
      </div>

      {isLoading ? (
        <p style={{ color: "var(--muted)" }}>Loading…</p>
      ) : list.length === 0 ? (
        <Card style={{ textAlign: "center", padding: 56, border: "1.5px dashed var(--border)" }}>
          <div style={{ fontSize: 48, marginBottom: 14 }}>🏛️</div>
          <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>No studios yet</p>
          <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 20 }}>Search for a venue or add one manually.</p>
          <Button onClick={() => { setSelected(null); setPanelMode('add'); setAddPhase('search'); setAddQuery(''); setAddResults([]); setAddSearchErr(null); }}>Add Studio</Button>
        </Card>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 18 }}>
          {list.map(s => (
            <StudioCard
              key={s.id} studio={s}
              active={selected?.id === s.id}
              onSelect={st => { setSelected(st); setPanelMode('view'); }}
              onEdit={st => { setSelected(st); setPanelMode('edit'); setEditForm({ ...st, is_favorite: !!st.is_favorite, capacity: st.capacity ?? "", hourly_rate: st.hourly_rate ?? "" }); }}
              onRemove={id => removeMutation.mutate(id)}
              onToggleFav={handleToggleFav}
            />
          ))}
        </div>
      )}

      {/* ── Mobile backdrop ── */}
      {(selected || panelMode === 'add') && isMobile && (
        <div onClick={() => { setSelected(null); setPanelMode(null); }}
          style={{ position: "fixed", inset: 0, top: 56, background: "rgba(0,0,0,0.4)", zIndex: 399 }} />
      )}

      {/* ── Side Panel (view / edit / add) ── */}
      {(selected || panelMode === 'add') && (
        <div style={{
          position: "fixed", right: 0, bottom: 0, zIndex: 400,
          top:   isMobile ? 56 : 0,
          width: isMobile ? "100vw" : PANEL_W,
          left:  isMobile ? 0 : "auto",
          background: "var(--card)",
          borderLeft: isMobile ? "none" : "1.5px solid var(--border)",
          display: "flex", flexDirection: "column",
          boxShadow: isMobile ? "0 -4px 32px rgba(0,0,0,.14)" : "-6px 0 32px rgba(0,0,0,.09)",
        }}>
          {/* Panel header */}
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".08em" }}>
              {panelMode === 'add' ? "Add Studio" : panelMode === 'edit' ? "Edit Studio" : "Studio Details"}
            </span>
            <button onClick={() => { setSelected(null); setPanelMode(null); }}
              style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "var(--muted)", lineHeight: 1, padding: 4, borderRadius: 6 }}>✕</button>
          </div>

          {/* ── VIEW mode ── */}
          {panelMode === 'view' && selected && (() => {
            const s = list.find(x => x.id === selected.id) || selected;
            const fullAddress = [s.address, s.city, s.state, s.zip].filter(Boolean).join(", ");
            const websiteDisplay = s.website?.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "") || null;
            return (
              <>
                {/* Hero */}
                <div style={{ padding: "20px 22px 16px", borderBottom: "1px solid var(--border)", flexShrink: 0, background: "var(--surface)" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                    <div>
                      <div style={{ fontFamily: "var(--font-d)", fontSize: 18, fontWeight: 800, marginBottom: 4, color: "var(--text)" }}>{s.name}</div>
                      {s.is_favorite && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: "#e0607e", background: "#fce7f3", borderRadius: 20, padding: "2px 8px" }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="#e0607e" stroke="#e0607e" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                          Favourite venue
                        </span>
                      )}
                    </div>
                    <button onClick={() => handleToggleFav(s)} title={s.is_favorite ? "Remove favourite" : "Mark favourite"}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 4px", color: s.is_favorite ? "#e0607e" : "#d1d5db", transition: "transform .15s, color .15s", flexShrink: 0 }}
                      onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.2)"; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}>
                      {s.is_favorite
                        ? <svg width="20" height="20" viewBox="0 0 24 24" fill="#e0607e" stroke="#e0607e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                        : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                      }
                    </button>
                  </div>
                </div>
                {/* Scrollable body */}
                <div style={{ flex: 1, overflowY: "auto", padding: "20px 22px" }}>
                  {fullAddress && (
                    <div style={{ marginBottom: 18 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 8 }}>Location</div>
                      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
                          <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                        </svg>
                        <span style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.5 }}>{fullAddress}</span>
                      </div>
                    </div>
                  )}
                  {(s.phone || s.email || s.website) && (
                    <div style={{ marginBottom: 18 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 8 }}>Contact</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                        {s.phone && (
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.5 19.79 19.79 0 0 1 1.61 4.86 2 2 0 0 1 3.6 2.69h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 10a16 16 0 0 0 6 6l.92-.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.88 17z"/></svg>
                            <a href={`tel:${s.phone}`} style={{ fontSize: 13, color: "var(--accent)", textDecoration: "none" }}>{s.phone}</a>
                          </div>
                        )}
                        {s.email && (
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                            <a href={`mailto:${s.email}`} style={{ fontSize: 13, color: "var(--accent)", textDecoration: "none" }}>{s.email}</a>
                          </div>
                        )}
                        {websiteDisplay && (
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                            <a href={s.website} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: "var(--accent)", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{websiteDisplay}</a>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {(s.capacity || s.hourly_rate) && (
                    <div style={{ marginBottom: 18 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 8 }}>Venue Info</div>
                      <div style={{ display: "flex", gap: 12 }}>
                        {s.capacity && (
                          <div style={{ flex: 1, background: "var(--surface)", borderRadius: 10, padding: "10px 14px", border: "1px solid var(--border)" }}>
                            <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text)" }}>{s.capacity}</div>
                            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>Max capacity</div>
                          </div>
                        )}
                        {s.hourly_rate && (
                          <div style={{ flex: 1, background: "var(--surface)", borderRadius: 10, padding: "10px 14px", border: "1px solid var(--border)" }}>
                            <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text)" }}>${Number(s.hourly_rate).toFixed(0)}</div>
                            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>Per hour</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {s.notes && (
                    <div style={{ marginBottom: 18 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 8 }}>Notes</div>
                      <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6, background: "var(--surface)", borderRadius: 9, padding: "10px 12px", margin: 0, border: "1px solid var(--border)" }}>
                        {s.notes}
                      </p>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 9, marginTop: 8 }}>
                    <button onClick={() => { setPanelMode('edit'); setEditForm({ ...s, is_favorite: !!s.is_favorite, capacity: s.capacity ?? "", hourly_rate: s.hourly_rate ?? "" }); }} style={{
                      flex: 1, padding: "9px 16px", borderRadius: 9,
                      border: "1.5px solid var(--accent)", background: "var(--accent)",
                      color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600,
                    }}>✏️ Edit Studio</button>
                    <button onClick={() => { if (window.confirm(`Remove "${s.name}"?`)) removeMutation.mutate(s.id); }}
                      style={{ padding: "9px 14px", borderRadius: 9, border: "1.5px solid #e05c6a", background: "transparent", color: "#e05c6a", cursor: "pointer", fontSize: 13 }}>🗑</button>
                  </div>
                </div>
              </>
            );
          })()}

          {/* ── EDIT mode ── */}
          {panelMode === 'edit' && (
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 22px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
                <Field label="Studio Name *" style={{ gridColumn: "1 / -1" }}><Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} /></Field>
                <Field label="Address" style={{ gridColumn: "1 / -1" }}><Input value={editForm.address} onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))} /></Field>
                <Field label="City"><Input value={editForm.city} onChange={e => setEditForm(f => ({ ...f, city: e.target.value }))} /></Field>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 10px" }}>
                  <Field label="State"><Input value={editForm.state} onChange={e => setEditForm(f => ({ ...f, state: e.target.value }))} /></Field>
                  <Field label="ZIP"><Input value={editForm.zip} onChange={e => setEditForm(f => ({ ...f, zip: e.target.value }))} /></Field>
                </div>
                <Field label="Phone"><Input value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} /></Field>
                <Field label="Email"><Input type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} /></Field>
                <Field label="Website" style={{ gridColumn: "1 / -1" }}><Input value={editForm.website} onChange={e => setEditForm(f => ({ ...f, website: e.target.value }))} /></Field>
                <Field label="Capacity (people)"><Input type="number" value={editForm.capacity} onChange={e => setEditForm(f => ({ ...f, capacity: e.target.value }))} min="0" /></Field>
                <Field label="Hourly Rate ($)"><Input type="number" value={editForm.hourly_rate} onChange={e => setEditForm(f => ({ ...f, hourly_rate: e.target.value }))} min="0" step="0.01" /></Field>
                <Field label="Notes" style={{ gridColumn: "1 / -1" }}><Textarea value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} rows={3} /></Field>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4, cursor: "pointer", userSelect: "none" }}>
                <input type="checkbox" checked={editForm.is_favorite} onChange={e => setEditForm(f => ({ ...f, is_favorite: e.target.checked }))} style={{ width: 16, height: 16 }} />
                <span style={{ fontSize: 14, fontWeight: 500 }}>Mark as favourite venue ♥</span>
              </label>
              <div style={{ display: "flex", gap: 9, marginTop: 20 }}>
                <Button onClick={handleSave} disabled={!editForm.name || saving}>{saving ? "Saving…" : "Save Changes"}</Button>
                <Button variant="outline" onClick={() => setPanelMode('view')}>Cancel</Button>
              </div>
            </div>
          )}

          {/* ── ADD mode ── */}
          {panelMode === 'add' && (
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 22px" }}>
              {addPhase === 'search' ? (
                <>
                  {/* Nominatim search bar */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: 10,
                    background: "var(--surface)", border: "1.5px solid var(--border)",
                    borderRadius: 12, padding: "10px 14px", marginBottom: 4, transition: "border-color .15s",
                  }}
                    onFocusCapture={e => e.currentTarget.style.borderColor = "var(--accent)"}
                    onBlurCapture={e => e.currentTarget.style.borderColor = "var(--border)"}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    <input
                      autoFocus
                      type="text"
                      value={addQuery}
                      onChange={e => {
                        const val = e.target.value;
                        setAddQuery(val);
                        setAddSearchErr(null);
                        clearTimeout(addDebounceRef.current);
                        if (!val.trim()) { setAddResults([]); return; }
                        setAddSearching(true);
                        addDebounceRef.current = setTimeout(async () => {
                          try { const data = await searchPlaces(val); setAddResults(data); }
                          catch { setAddSearchErr("Search failed — check your connection."); setAddResults([]); }
                          finally { setAddSearching(false); }
                        }, 380);
                      }}
                      placeholder="Search by venue name or address…"
                      style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 14, color: "var(--text)", fontFamily: "var(--font-sans)" }}
                    />
                    {addSearching && (
                      <div style={{ width: 14, height: 14, flexShrink: 0, border: "2px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin .6s linear infinite" }} />
                    )}
                  </div>
                  <div style={{ textAlign: "right", fontSize: 10, color: "var(--muted)", marginBottom: 10 }}>© OpenStreetMap contributors</div>
                  {addResults.length > 0 && (
                    <div style={{ borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden", marginBottom: 16 }}>
                      {addResults.map((p, i) => (
                        <PlaceTile key={p.place_id || i} place={p} onSelect={place => { setAddForm(parseNominatim(place)); setAddPhase('confirm'); }} disabled={false} />
                      ))}
                    </div>
                  )}
                  {addQuery.length > 2 && !addSearching && addResults.length === 0 && !addSearchErr && (
                    <div style={{ textAlign: "center", padding: "18px 0 4px", color: "var(--muted)", fontSize: 13 }}>
                      No results for "{addQuery}" — try a different name or postcode.
                    </div>
                  )}
                  {addSearchErr && <div style={{ textAlign: "center", padding: "14px 0 4px", color: "#dc2626", fontSize: 13 }}>{addSearchErr}</div>}
                  <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <span style={{ fontSize: 13, color: "var(--muted)" }}>Can't find it in the results?</span>
                    <button type="button" onClick={() => { setAddForm({ ...EMPTY }); setAddPhase('confirm'); }} style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                      Enter details manually →
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <button type="button" onClick={() => setAddPhase('search')} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 18, background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 13, padding: 0 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                    Back to search
                  </button>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
                    <Field label="Studio Name *" style={{ gridColumn: "1 / -1" }}>
                      <Input value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} placeholder="Venue name" autoFocus />
                    </Field>
                    <Field label="Address" style={{ gridColumn: "1 / -1" }}>
                      <Input value={addForm.address} onChange={e => setAddForm(f => ({ ...f, address: e.target.value }))} placeholder="Street address" />
                    </Field>
                    <Field label="City"><Input value={addForm.city} onChange={e => setAddForm(f => ({ ...f, city: e.target.value }))} placeholder="City" /></Field>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 10px" }}>
                      <Field label="State"><Input value={addForm.state} onChange={e => setAddForm(f => ({ ...f, state: e.target.value }))} placeholder="State" /></Field>
                      <Field label="ZIP"><Input value={addForm.zip} onChange={e => setAddForm(f => ({ ...f, zip: e.target.value }))} placeholder="ZIP" /></Field>
                    </div>
                    <Field label="Phone"><Input value={addForm.phone} onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))} placeholder="Phone number" /></Field>
                    <Field label="Email"><Input type="email" value={addForm.email} onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))} placeholder="venue@example.com" /></Field>
                    <Field label="Website" style={{ gridColumn: "1 / -1" }}>
                      <Input value={addForm.website} onChange={e => setAddForm(f => ({ ...f, website: e.target.value }))} placeholder="https://example.com" />
                    </Field>
                    <Field label="Capacity (people)"><Input type="number" value={addForm.capacity} onChange={e => setAddForm(f => ({ ...f, capacity: e.target.value }))} placeholder="e.g. 200" min="0" /></Field>
                    <Field label="Hourly Rate ($)"><Input type="number" value={addForm.hourly_rate} onChange={e => setAddForm(f => ({ ...f, hourly_rate: e.target.value }))} placeholder="e.g. 75" min="0" step="0.01" /></Field>
                    <Field label="Notes" style={{ gridColumn: "1 / -1" }}>
                      <Textarea value={addForm.notes} onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))} placeholder="Parking, equipment, access notes…" rows={3} />
                    </Field>
                  </div>
                  <label style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4, cursor: "pointer", userSelect: "none" }}>
                    <input type="checkbox" checked={addForm.is_favorite} onChange={e => setAddForm(f => ({ ...f, is_favorite: e.target.checked }))} style={{ width: 16, height: 16, cursor: "pointer" }} />
                    <span style={{ fontSize: 14, fontWeight: 500 }}>Mark as favourite venue ♥</span>
                  </label>
                  <div style={{ display: "flex", gap: 9, marginTop: 20 }}>
                    <Button onClick={handleSave} disabled={!addForm.name || saving}>{saving ? "Saving…" : "Add Studio"}</Button>
                    <Button variant="outline" onClick={() => { setSelected(null); setPanelMode(null); }}>Cancel</Button>
                  </div>
                </>
              )}
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
