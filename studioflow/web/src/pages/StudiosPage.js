import React, { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { studios as api } from "../api";
import toast from "react-hot-toast";
import Card from "../components/shared/Card";
import Button from "../components/shared/Button";
import Modal from "../components/shared/Modal";
import { Field, Input, Textarea } from "../components/shared/Field";

const GKEY = process.env.REACT_APP_GOOGLE_MAPS_KEY || "";

const EMPTY = {
  name: "", address: "", city: "", state: "", zip: "",
  phone: "", email: "", website: "", capacity: "", hourly_rate: "",
  notes: "", is_favorite: false,
};

/* ─── Load Google Maps script once ─────────────────────────────────── */
function useGooglePlaces() {
  const [ready, setReady] = useState(() => !!window.google?.maps?.places);
  useEffect(() => {
    if (!GKEY || window.google?.maps?.places) { setReady(!!window.google?.maps?.places); return; }
    const existing = document.getElementById("_gm_places");
    if (existing) {
      // already injected, wait for it
      existing.addEventListener("load", () => setReady(true));
      return;
    }
    const s = document.createElement("script");
    s.id  = "_gm_places";
    s.src = `https://maps.googleapis.com/maps/api/js?key=${GKEY}&libraries=places`;
    s.async = true;
    s.onload = () => setReady(true);
    document.head.appendChild(s);
  }, []);
  return ready;
}

/* ─── Parse address components from Places detail response ──────────── */
function parsePlace(place) {
  const ac = place.address_components || [];
  const get  = (t) => ac.find(c => c.types.includes(t))?.long_name  || "";
  const getS = (t) => ac.find(c => c.types.includes(t))?.short_name || "";
  const street = [get("street_number"), get("route")].filter(Boolean).join(" ");
  return {
    name:    place.name || "",
    address: street,
    city:    get("locality") || get("sublocality_level_1") || get("postal_town") || "",
    state:   getS("administrative_area_level_1"),
    zip:     get("postal_code"),
    phone:   place.formatted_phone_number || place.international_phone_number || "",
    website: place.website || "",
    notes:   "",
    capacity: "",
    hourly_rate: "",
    is_favorite: false,
    place_id: place.place_id,
  };
}

/* ─── Category label + icon for place type ─────────────────────────── */
const TYPE_MAP = {
  gym: { label: "Gym", color: "#6a7fdb" },
  dance_school: { label: "Dance School", color: "#c4527a" },
  school: { label: "School", color: "#6a7fdb" },
  university: { label: "University", color: "#6a7fdb" },
  community_center: { label: "Community Centre", color: "#52c4a0" },
  stadium: { label: "Stadium", color: "#f4a041" },
  park: { label: "Park", color: "#52c4a0" },
  point_of_interest: { label: "Venue", color: "#8b5cf6" },
  establishment: { label: "Venue", color: "#8b5cf6" },
};
function typeChip(types = []) {
  for (const t of types) {
    const m = TYPE_MAP[t];
    if (m) return m;
  }
  return { label: "Place", color: "#aaa" };
}

/* ─── Place tile ────────────────────────────────────────────────────── */
function PlaceTile({ prediction, onSelect, loading }) {
  const chip = typeChip(prediction.types || []);
  const main = prediction.structured_formatting?.main_text    || prediction.description;
  const sub  = prediction.structured_formatting?.secondary_text || "";
  return (
    <button
      type="button"
      onClick={() => !loading && onSelect(prediction)}
      style={{
        display: "flex", alignItems: "flex-start", gap: 12,
        width: "100%", border: "none", background: "var(--card)",
        padding: "12px 16px", cursor: loading ? "wait" : "pointer",
        textAlign: "left", transition: "background .1s",
        borderBottom: "1px solid var(--border)",
      }}
      onMouseEnter={e => { e.currentTarget.style.background = "var(--surface)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "var(--card)"; }}
    >
      {/* pin icon */}
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: chip.color + "18",
        display: "flex", alignItems: "center", justifyContent: "center",
        marginTop: 1,
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={chip.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
        </svg>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text)", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {main}
        </div>
        {sub && (
          <div style={{ fontSize: 12, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {sub}
          </div>
        )}
      </div>

      <span style={{
        fontSize: 10, fontWeight: 700, color: chip.color,
        background: chip.color + "18", borderRadius: 20,
        padding: "2px 8px", flexShrink: 0, marginTop: 3,
        whiteSpace: "nowrap",
      }}>
        {chip.label}
      </span>
    </button>
  );
}

/* ─── Add-studio modal (search-first) ──────────────────────────────── */
function AddStudioModal({ onClose, onSave, saving }) {
  const mapsReady = useGooglePlaces();
  const [phase, setPhase]           = useState("search"); // "search" | "confirm"
  const [query, setQuery]           = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching]   = useState(false);
  const [fetching, setFetching]     = useState(false);
  const [form, setForm]             = useState({ ...EMPTY });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const svcRef  = useRef(null);
  const svcElRef = useRef(null);
  const debounceRef = useRef(null);

  // Init AutocompleteService once maps loaded
  useEffect(() => {
    if (!mapsReady) return;
    svcRef.current = new window.google.maps.places.AutocompleteService();
  }, [mapsReady]);

  const search = useCallback((q) => {
    if (!svcRef.current || !q.trim()) { setSuggestions([]); setSearching(false); return; }
    setSearching(true);
    svcRef.current.getPlacePredictions(
      { input: q, types: ["establishment"] },
      (results, status) => {
        setSearching(false);
        if (status === window.google.maps.places.PlacesServiceStatus.OK) {
          setSuggestions(results || []);
        } else {
          setSuggestions([]);
        }
      }
    );
  }, []);

  const handleQueryChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounceRef.current);
    if (!val.trim()) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(() => search(val), 320);
  };

  const handleSelect = (prediction) => {
    if (!mapsReady) return;
    setFetching(true);
    // PlacesService needs a DOM element
    if (!svcElRef.current) {
      svcElRef.current = document.createElement("div");
    }
    const svc = new window.google.maps.places.PlacesService(svcElRef.current);
    svc.getDetails(
      {
        placeId: prediction.place_id,
        fields: ["name", "address_components", "formatted_phone_number",
                 "international_phone_number", "website", "place_id"],
      },
      (place, status) => {
        setFetching(false);
        if (status === window.google.maps.places.PlacesServiceStatus.OK) {
          setForm({ ...EMPTY, ...parsePlace(place) });
          setPhase("confirm");
        } else {
          toast.error("Couldn't load place details");
        }
      }
    );
  };

  const handleManual = () => {
    setForm({ ...EMPTY });
    setPhase("confirm");
  };

  return (
    <Modal title={phase === "search" ? "Add Studio" : `${form.name || "New Studio"}`} onClose={onClose} wide>
      {phase === "search" ? (
        /* ── Search phase ── */
        <div>
          {/* Search bar */}
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            background: "var(--surface)", border: "1.5px solid var(--border)",
            borderRadius: 12, padding: "10px 14px", marginBottom: 4,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              autoFocus
              type="text"
              value={query}
              onChange={handleQueryChange}
              placeholder={mapsReady ? "Search for a venue, studio or community centre…" : "Enter venue name…"}
              style={{
                flex: 1, border: "none", outline: "none",
                background: "transparent", fontSize: 14,
                color: "var(--text)", fontFamily: "var(--font-sans)",
              }}
            />
            {searching && (
              <div style={{ width: 14, height: 14, border: "2px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.6s linear infinite", flexShrink: 0 }} />
            )}
          </div>

          {/* Powered by Google badge */}
          {mapsReady && (
            <div style={{ textAlign: "right", fontSize: 10, color: "var(--muted)", marginBottom: 10, paddingRight: 4 }}>
              Powered by Google
            </div>
          )}

          {/* Suggestion tiles */}
          {suggestions.length > 0 && (
            <div style={{
              borderRadius: 12, border: "1px solid var(--border)",
              overflow: "hidden", marginBottom: 16,
            }}>
              {suggestions.map((p) => (
                <PlaceTile key={p.place_id} prediction={p} onSelect={handleSelect} loading={fetching} />
              ))}
            </div>
          )}

          {/* No results hint */}
          {query.length > 2 && !searching && suggestions.length === 0 && mapsReady && (
            <div style={{ textAlign: "center", padding: "20px 0 8px", color: "var(--muted)", fontSize: 13 }}>
              No results found for "{query}"
            </div>
          )}

          {/* Add manually CTA */}
          <div style={{
            marginTop: suggestions.length > 0 ? 8 : 20,
            paddingTop: 16, borderTop: "1px solid var(--border)",
            display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10,
          }}>
            <span style={{ fontSize: 13, color: "var(--muted)" }}>
              {mapsReady ? "Can't find the place?" : "Google Maps not configured."}
            </span>
            <button
              type="button"
              onClick={handleManual}
              style={{
                fontSize: 13, fontWeight: 600, color: "var(--accent)",
                background: "none", border: "none", cursor: "pointer", padding: 0,
                textDecoration: "underline",
              }}
            >
              Add manually instead →
            </button>
          </div>
        </div>
      ) : (
        /* ── Confirm / detail phase ── */
        <div>
          {/* Back to search */}
          <button
            type="button"
            onClick={() => setPhase("search")}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "none", border: "none", cursor: "pointer",
              color: "var(--muted)", fontSize: 13, padding: 0, marginBottom: 18,
            }}
          >
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
              <Field label="State">
                <Input value={form.state} onChange={e => set("state", e.target.value)} placeholder="State" />
              </Field>
              <Field label="ZIP">
                <Input value={form.zip} onChange={e => set("zip", e.target.value)} placeholder="ZIP" />
              </Field>
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
            <input
              type="checkbox"
              checked={form.is_favorite}
              onChange={e => set("is_favorite", e.target.checked)}
              style={{ width: 16, height: 16, cursor: "pointer" }}
            />
            <span style={{ fontSize: 14, fontWeight: 500 }}>Mark as favourite venue ★</span>
          </label>

          <div style={{ display: "flex", gap: 9, marginTop: 20 }}>
            <Button onClick={() => onSave(form)} disabled={!form.name || saving}>
              {saving ? "Saving…" : "Add Studio"}
            </Button>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      )}

      {/* spin keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </Modal>
  );
}

/* ─── Edit modal (form-only, data already exists) ───────────────────── */
function EditStudioModal({ studio, onClose, onSave, saving }) {
  const [form, setForm] = useState({
    ...studio, is_favorite: !!studio.is_favorite,
    capacity: studio.capacity ?? "", hourly_rate: studio.hourly_rate ?? "",
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <Modal title="Edit Studio" onClose={onClose} wide>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
        <Field label="Studio Name *" style={{ gridColumn: "1 / -1" }}>
          <Input value={form.name} onChange={e => set("name", e.target.value)} />
        </Field>
        <Field label="Address" style={{ gridColumn: "1 / -1" }}>
          <Input value={form.address} onChange={e => set("address", e.target.value)} />
        </Field>
        <Field label="City">
          <Input value={form.city} onChange={e => set("city", e.target.value)} />
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 10px" }}>
          <Field label="State"><Input value={form.state} onChange={e => set("state", e.target.value)} /></Field>
          <Field label="ZIP"><Input value={form.zip} onChange={e => set("zip", e.target.value)} /></Field>
        </div>
        <Field label="Phone"><Input value={form.phone} onChange={e => set("phone", e.target.value)} /></Field>
        <Field label="Email"><Input type="email" value={form.email} onChange={e => set("email", e.target.value)} /></Field>
        <Field label="Website" style={{ gridColumn: "1 / -1" }}>
          <Input value={form.website} onChange={e => set("website", e.target.value)} />
        </Field>
        <Field label="Capacity (people)">
          <Input type="number" value={form.capacity} onChange={e => set("capacity", e.target.value)} min="0" />
        </Field>
        <Field label="Hourly Rate ($)">
          <Input type="number" value={form.hourly_rate} onChange={e => set("hourly_rate", e.target.value)} min="0" step="0.01" />
        </Field>
        <Field label="Notes" style={{ gridColumn: "1 / -1" }}>
          <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={3} />
        </Field>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4, cursor: "pointer", userSelect: "none" }}>
        <input type="checkbox" checked={form.is_favorite} onChange={e => set("is_favorite", e.target.checked)} style={{ width: 16, height: 16 }} />
        <span style={{ fontSize: 14, fontWeight: 500 }}>Mark as favourite venue ★</span>
      </label>
      <div style={{ display: "flex", gap: 9, marginTop: 20 }}>
        <Button onClick={() => onSave(form)} disabled={!form.name || saving}>{saving ? "Saving…" : "Save Changes"}</Button>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
      </div>
    </Modal>
  );
}

/* ─── Studio card ───────────────────────────────────────────────────── */
function StudioCard({ studio, onEdit, onRemove, onToggleFav }) {
  const fullAddress = [studio.address, studio.city, studio.state, studio.zip].filter(Boolean).join(", ");
  const websiteDisplay = studio.website?.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "") || null;

  return (
    <div style={{
      background: "var(--card)", borderRadius: 14,
      border: studio.is_favorite ? "1.5px solid #f59e0b" : "1.5px solid var(--border)",
      boxShadow: studio.is_favorite ? "0 2px 12px rgba(245,158,11,.13)" : "0 2px 8px rgba(0,0,0,.06)",
      display: "flex", flexDirection: "column", overflow: "hidden",
      transition: "box-shadow .15s, border-color .15s",
    }}>
      <div style={{ padding: "18px 18px 14px", flex: 1 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.3, color: "var(--text)", flex: 1 }}>{studio.name}</div>
          <button onClick={() => onToggleFav(studio)} title={studio.is_favorite ? "Remove favourite" : "Mark favourite"}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, lineHeight: 1, padding: "2px 4px", color: studio.is_favorite ? "#f59e0b" : "#d1d5db", transition: "color .15s", flexShrink: 0 }}>
            {studio.is_favorite ? "★" : "☆"}
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
            {studio.capacity && (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 13 }}>👥</span>
                <span style={{ fontSize: 13, color: "var(--muted)" }}>{studio.capacity} people</span>
              </div>
            )}
            {studio.hourly_rate && (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 13 }}>💰</span>
                <span style={{ fontSize: 13, color: "var(--muted)" }}>${Number(studio.hourly_rate).toFixed(0)}/hr</span>
              </div>
            )}
          </div>
          {studio.notes && (
            <p style={{ fontSize: 12, color: "var(--muted)", fontStyle: "italic", margin: "4px 0 0", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              {studio.notes}
            </p>
          )}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, padding: "12px 18px", borderTop: "1px solid var(--border)", background: "var(--surface)" }}>
        <Button size="sm" variant="outline" onClick={() => onEdit(studio)}>Edit</Button>
        <Button size="sm" variant="ghost" onClick={() => { if (window.confirm(`Remove "${studio.name}"?`)) onRemove(studio.id); }}
          style={{ color: "#dc2626", marginLeft: "auto" }}>Remove</Button>
      </div>
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────────────────── */
export default function StudiosPage() {
  const { user } = useAuth();
  const sid = user?.school_id;
  const qc  = useQueryClient();

  const [modal, setModal]   = useState(null); // null | "add" | {studio obj}
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["studios", sid],
    queryFn: () => api.list(sid).then(r => r.studios),
    enabled: !!sid,
  });
  const list = data || [];

  const removeMutation = useMutation({
    mutationFn: id => api.remove(sid, id),
    onSuccess: () => { qc.invalidateQueries(["studios", sid]); toast.success("Studio removed"); },
    onError: err => toast.error(err?.error || "Failed to remove"),
  });

  const handleSave = async (form) => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        capacity:    form.capacity    ? Number(form.capacity)    : null,
        hourly_rate: form.hourly_rate ? Number(form.hourly_rate) : null,
        is_favorite: form.is_favorite ? 1 : 0,
      };
      if (modal?.id) {
        await api.update(sid, modal.id, payload);
        toast.success("Studio updated");
      } else {
        await api.create(sid, payload);
        toast.success("Studio added");
      }
      qc.invalidateQueries(["studios", sid]);
      setModal(null);
    } catch (err) {
      toast.error(err?.error || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleFav = async (studio) => {
    try {
      await api.update(sid, studio.id, { is_favorite: studio.is_favorite ? 0 : 1 });
      qc.invalidateQueries(["studios", sid]);
    } catch { toast.error("Failed to update favourite"); }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-d)", fontSize: 26, marginBottom: 4 }}>Studio Bookings</h1>
          <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>Manage venues used for classes, rehearsals, and performances</p>
        </div>
        <Button onClick={() => setModal("add")} icon="➕">Add Studio</Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <p style={{ color: "var(--muted)" }}>Loading…</p>
      ) : list.length === 0 ? (
        <Card style={{ textAlign: "center", padding: 56, border: "1.5px dashed var(--border)" }}>
          <div style={{ fontSize: 48, marginBottom: 14 }}>🏛️</div>
          <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>No studios yet</p>
          <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 20 }}>Search Google or add manually to build your venue list.</p>
          <Button onClick={() => setModal("add")}>Add Studio</Button>
        </Card>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 18 }}>
          {list.map(studio => (
            <StudioCard key={studio.id} studio={studio}
              onEdit={s => setModal(s)}
              onRemove={id => removeMutation.mutate(id)}
              onToggleFav={handleToggleFav}
            />
          ))}
        </div>
      )}

      {/* Add modal */}
      {modal === "add" && (
        <AddStudioModal onClose={() => setModal(null)} onSave={handleSave} saving={saving} />
      )}

      {/* Edit modal */}
      {modal && modal !== "add" && (
        <EditStudioModal studio={modal} onClose={() => setModal(null)} onSave={handleSave} saving={saving} />
      )}
    </div>
  );
}
