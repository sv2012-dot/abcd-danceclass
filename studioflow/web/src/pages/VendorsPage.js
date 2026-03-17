import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { vendors as api } from "../api";
import toast from "react-hot-toast";
import Card from "../components/shared/Card";
import Button from "../components/shared/Button";
import { Field, Input, Textarea } from "../components/shared/Field";

/* ─── Category config ───────────────────────────────────────────────── */
const CATEGORIES = [
  { key: "Photographer",     color: "#c4527a", icon: "📷" },
  { key: "Videographer",     color: "#8b5cf6", icon: "🎬" },
  { key: "Costume Provider", color: "#f4a041", icon: "👗" },
  { key: "Makeup Artist",    color: "#e0607e", icon: "💄" },
  { key: "Florist",          color: "#52c4a0", icon: "💐" },
  { key: "Sound & Music",    color: "#6a7fdb", icon: "🎵" },
  { key: "Catering",         color: "#10b981", icon: "🍽️" },
  { key: "Set Design",       color: "#f59e0b", icon: "🎨" },
  { key: "Lighting",         color: "#3b82f6", icon: "💡" },
  { key: "Other",            color: "#94a3b8", icon: "📦" },
];
const catMap = Object.fromEntries(CATEGORIES.map(c => [c.key, c]));
const catInfo = (key) => catMap[key] || { color: "#94a3b8", icon: "📦" };

const EMPTY = {
  name: "", category: "Photographer", contact_name: "", phone: "",
  email: "", website: "", instagram: "", price_range: "", notes: "", is_favorite: false,
};

/* ─── Vendor card ───────────────────────────────────────────────────── */
function VendorCard({ vendor: v, active, onSelect, onEdit, onRemove, onToggleFav }) {
  const cat = catInfo(v.category);
  const websiteDisplay = v.website?.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "") || null;
  return (
    <div onClick={() => onSelect(v)} style={{
      background: "var(--card)", borderRadius: 14, cursor: "pointer",
      border: active ? "1.5px solid var(--accent)" : v.is_favorite ? `1.5px solid ${cat.color}66` : "1.5px solid var(--border)",
      boxShadow: active ? "0 0 0 3px rgba(196,82,122,.13)" : v.is_favorite ? `0 2px 12px ${cat.color}22` : "0 2px 8px rgba(0,0,0,.06)",
      display: "flex", flexDirection: "column", overflow: "hidden", transition: "all .15s",
    }}>
      <div style={{ padding: "16px 18px 14px", flex: 1 }}>
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
            {/* Category icon circle */}
            <div style={{ width: 38, height: 38, borderRadius: 11, background: cat.color + "18", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
              {cat.icon}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text)", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.name}</div>
              <span style={{ fontSize: 10, fontWeight: 700, color: cat.color, background: cat.color + "18", borderRadius: 20, padding: "1px 8px", display: "inline-block", marginTop: 3 }}>{v.category}</span>
            </div>
          </div>
          {/* Favourite star */}
          <button onClick={e => { e.stopPropagation(); onToggleFav(v); }}
            title={v.is_favorite ? "Remove favourite" : "Mark favourite"}
            style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 4px", color: v.is_favorite ? "#f59e0b" : "#d1d5db", transition: "transform .15s, color .15s", flexShrink: 0 }}
            onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.2)"; e.currentTarget.style.color = "#f59e0b"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.color = v.is_favorite ? "#f59e0b" : "#d1d5db"; }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill={v.is_favorite ? "#f59e0b" : "none"} stroke={v.is_favorite ? "#f59e0b" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          </button>
        </div>

        {/* Details */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {v.contact_name && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>{v.contact_name}</span>
            </div>
          )}
          {v.phone && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.5 19.79 19.79 0 0 1 1.61 4.86 2 2 0 0 1 3.6 2.69h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 10a16 16 0 0 0 6 6l.92-.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.88 17z"/></svg>
              <a href={`tel:${v.phone}`} onClick={e => e.stopPropagation()} style={{ fontSize: 12, color: "var(--accent)", textDecoration: "none" }}>{v.phone}</a>
            </div>
          )}
          {v.email && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
              <a href={`mailto:${v.email}`} onClick={e => e.stopPropagation()} style={{ fontSize: 12, color: "var(--accent)", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.email}</a>
            </div>
          )}
          {(websiteDisplay || v.instagram) && (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {websiteDisplay && (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                  <a href={v.website} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 11, color: "var(--accent)", textDecoration: "none" }}>{websiteDisplay}</a>
                </div>
              )}
              {v.instagram && (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="0.5" fill="var(--muted)"/></svg>
                  <a href={`https://instagram.com/${v.instagram.replace('@','')}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 11, color: "var(--accent)", textDecoration: "none" }}>{v.instagram}</a>
                </div>
              )}
            </div>
          )}
          {v.price_range && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 2 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 500 }}>{v.price_range}</span>
            </div>
          )}
          {v.notes && (
            <p style={{ fontSize: 11, color: "var(--muted)", fontStyle: "italic", margin: "4px 0 0", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              {v.notes}
            </p>
          )}
        </div>
      </div>
      <div onClick={e => e.stopPropagation()} style={{ display: "flex", gap: 8, padding: "10px 18px", borderTop: "1px solid var(--border)", background: "var(--surface)" }}>
        <Button size="sm" variant="outline" onClick={() => onEdit(v)}>Edit</Button>
        <Button size="sm" variant="ghost" onClick={() => { if (window.confirm(`Remove "${v.name}"?`)) onRemove(v.id); }} style={{ color: "#dc2626", marginLeft: "auto" }}>Remove</Button>
      </div>
    </div>
  );
}

/* ─── Vendor form fields (shared by add & edit) ─────────────────────── */
function VendorFormFields({ form, set }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
      <Field label="Category *" style={{ gridColumn: "1 / -1" }}>
        <select value={form.category} onChange={e => set("category", e.target.value)}
          style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1.5px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 13, fontFamily: "var(--font-sans)" }}>
          {CATEGORIES.map(c => (
            <option key={c.key} value={c.key}>{c.icon} {c.key}</option>
          ))}
        </select>
      </Field>
      <Field label="Vendor / Business Name *" style={{ gridColumn: "1 / -1" }}>
        <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Priya Lens Studio" autoFocus />
      </Field>
      <Field label="Contact Person" style={{ gridColumn: "1 / -1" }}>
        <Input value={form.contact_name} onChange={e => set("contact_name", e.target.value)} placeholder="Full name" />
      </Field>
      <Field label="Phone">
        <Input value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="+1 555 000 0000" />
      </Field>
      <Field label="Email">
        <Input type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="vendor@email.com" />
      </Field>
      <Field label="Website" style={{ gridColumn: "1 / -1" }}>
        <Input value={form.website} onChange={e => set("website", e.target.value)} placeholder="https://example.com" />
      </Field>
      <Field label="Instagram Handle">
        <Input value={form.instagram} onChange={e => set("instagram", e.target.value)} placeholder="@handle" />
      </Field>
      <Field label="Price Range">
        <Input value={form.price_range} onChange={e => set("price_range", e.target.value)} placeholder="e.g. $400–$800" />
      </Field>
      <Field label="Notes" style={{ gridColumn: "1 / -1" }}>
        <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Availability, special requirements, past experience…" rows={3} />
      </Field>
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────────────────── */
const PANEL_W = 420;

export default function VendorsPage() {
  const { user }  = useAuth();
  const sid       = user?.school_id;
  const qc        = useQueryClient();
  const [saving,    setSaving]    = useState(false);
  const [selected,  setSelected]  = useState(null);
  const [panelMode, setPanelMode] = useState(null); // null | 'view' | 'edit' | 'add'
  const [addForm,   setAddForm]   = useState({ ...EMPTY });
  const [editForm,  setEditForm]  = useState({ ...EMPTY });
  const [filterCat, setFilterCat] = useState("All");

  const [windowWidth, setWindowWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    const h = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  const isMobile = windowWidth < 768;

  const { data, isLoading } = useQuery({
    queryKey: ["vendors", sid],
    queryFn:  () => api.list(sid).then(r => r.vendors),
    enabled:  !!sid,
  });
  const allVendors = data || [];
  const list = filterCat === "All" ? allVendors : allVendors.filter(v => v.category === filterCat);

  // Categories that actually have vendors
  const activeCats = ["All", ...CATEGORIES.map(c => c.key).filter(k => allVendors.some(v => v.category === k))];

  const invalidate = () => qc.invalidateQueries(["vendors", sid]);

  const removeMutation = useMutation({
    mutationFn: id => api.remove(sid, id),
    onSuccess: (_, id) => {
      invalidate();
      toast.success("Vendor removed");
      if (selected?.id === id) { setSelected(null); setPanelMode(null); }
    },
    onError: () => toast.error("Failed to remove"),
  });

  const handleSave = async () => {
    const form = panelMode === "edit" ? editForm : addForm;
    if (!form?.name) return;
    setSaving(true);
    try {
      const payload = { ...form, is_favorite: form.is_favorite ? 1 : 0 };
      if (panelMode === "edit" && selected?.id) {
        const res = await api.update(sid, selected.id, payload);
        toast.success("Vendor updated");
        setSelected(res.vendor || { ...selected, ...payload });
        setPanelMode("view");
      } else {
        await api.create(sid, payload);
        toast.success("Vendor added");
        setPanelMode(null);
        setSelected(null);
      }
      invalidate();
    } catch { toast.error("Failed to save"); }
    finally { setSaving(false); }
  };

  const handleToggleFav = async (v) => {
    try {
      await api.update(sid, v.id, { ...v, is_favorite: v.is_favorite ? 0 : 1 });
      invalidate();
      if (selected?.id === v.id) setSelected(s => ({ ...s, is_favorite: v.is_favorite ? 0 : 1 }));
    } catch { toast.error("Failed to update favourite"); }
  };

  const openAdd = () => {
    setSelected(null);
    setAddForm({ ...EMPTY });
    setPanelMode("add");
  };

  const panelOpen = !!selected || panelMode === "add";

  return (
    <div style={{ paddingRight: panelOpen && !isMobile ? PANEL_W + 20 : 0, transition: "padding .25s ease" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-d)", fontSize: 26, marginBottom: 4 }}>Vendors</h1>
          <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>
            {allVendors.length} vendor{allVendors.length !== 1 ? "s" : ""} · photographers, videographers, costumes & more
          </p>
        </div>
        <Button onClick={openAdd} icon="➕">Add Vendor</Button>
      </div>

      {/* ── Category filter tabs ── */}
      {allVendors.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
          {activeCats.map(cat => {
            const info = cat === "All" ? { color: "var(--accent)", icon: "🗂️" } : catInfo(cat);
            const active = filterCat === cat;
            const count = cat === "All" ? allVendors.length : allVendors.filter(v => v.category === cat).length;
            return (
              <button key={cat} onClick={() => setFilterCat(cat)} style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "6px 14px", borderRadius: 20, cursor: "pointer",
                fontSize: 12, fontWeight: active ? 700 : 500, transition: "all .12s",
                border: `1.5px solid ${active ? info.color : "var(--border)"}`,
                background: active ? info.color + "18" : "transparent",
                color: active ? info.color : "var(--muted)",
              }}>
                {cat !== "All" && <span>{info.icon}</span>}
                {cat} <span style={{ opacity: 0.7, fontSize: 11 }}>({count})</span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Content ── */}
      {isLoading ? (
        <p style={{ color: "var(--muted)" }}>Loading…</p>
      ) : allVendors.length === 0 ? (
        <Card style={{ textAlign: "center", padding: 56, border: "1.5px dashed var(--border)" }}>
          <div style={{ fontSize: 48, marginBottom: 14 }}>🤝</div>
          <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>No vendors yet</p>
          <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 20 }}>Add photographers, videographers, costume providers and more.</p>
          <Button onClick={openAdd}>Add Vendor</Button>
        </Card>
      ) : list.length === 0 ? (
        <Card style={{ textAlign: "center", padding: 40, border: "1.5px dashed var(--border)" }}>
          <p style={{ color: "var(--muted)", fontSize: 13 }}>No vendors in this category yet.</p>
          <button onClick={() => setFilterCat("All")} style={{ marginTop: 10, fontSize: 13, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>Show all vendors</button>
        </Card>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
          {list.map(v => (
            <VendorCard
              key={v.id} vendor={v}
              active={selected?.id === v.id}
              onSelect={vn => { setSelected(vn); setPanelMode("view"); }}
              onEdit={vn => { setSelected(vn); setEditForm({ ...vn, is_favorite: !!vn.is_favorite }); setPanelMode("edit"); }}
              onRemove={id => removeMutation.mutate(id)}
              onToggleFav={handleToggleFav}
            />
          ))}
        </div>
      )}

      {/* ── Mobile backdrop ── */}
      {panelOpen && isMobile && (
        <div onClick={() => { setSelected(null); setPanelMode(null); }}
          style={{ position: "fixed", inset: 0, top: 56, background: "rgba(0,0,0,0.4)", zIndex: 399 }} />
      )}

      {/* ── Side Panel ── */}
      {panelOpen && (
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
              {panelMode === "add" ? "Add Vendor" : panelMode === "edit" ? "Edit Vendor" : "Vendor Details"}
            </span>
            <button onClick={() => { setSelected(null); setPanelMode(null); }}
              style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "var(--muted)", lineHeight: 1, padding: 4, borderRadius: 6 }}>✕</button>
          </div>

          {/* ── VIEW mode ── */}
          {panelMode === "view" && selected && (() => {
            const v = allVendors.find(x => x.id === selected.id) || selected;
            const cat = catInfo(v.category);
            const websiteDisplay = v.website?.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "") || null;
            return (
              <>
                {/* Hero */}
                <div style={{ padding: "20px 22px 16px", borderBottom: "1px solid var(--border)", flexShrink: 0, background: "var(--surface)" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 13, background: cat.color + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>
                      {cat.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: "var(--font-d)", fontSize: 18, fontWeight: 800, marginBottom: 4, color: "var(--text)" }}>{v.name}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: cat.color, background: cat.color + "18", borderRadius: 20, padding: "2px 10px" }}>{v.category}</span>
                        {v.is_favorite && (
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", background: "#fef3c7", borderRadius: 20, padding: "2px 8px" }}>⭐ Favourite</span>
                        )}
                      </div>
                    </div>
                    <button onClick={() => handleToggleFav(v)}
                      title={v.is_favorite ? "Remove favourite" : "Mark favourite"}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 4px", color: v.is_favorite ? "#f59e0b" : "#d1d5db", flexShrink: 0 }}
                      onMouseEnter={e => { e.currentTarget.style.color = "#f59e0b"; }}
                      onMouseLeave={e => { e.currentTarget.style.color = v.is_favorite ? "#f59e0b" : "#d1d5db"; }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill={v.is_favorite ? "#f59e0b" : "none"} stroke={v.is_favorite ? "#f59e0b" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Scrollable body */}
                <div style={{ flex: 1, overflowY: "auto", padding: "20px 22px" }}>
                  {/* Contact */}
                  {(v.contact_name || v.phone || v.email || v.website || v.instagram) && (
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 10 }}>Contact</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {v.contact_name && (
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                            <span style={{ fontSize: 13, color: "var(--text)", fontWeight: 500 }}>{v.contact_name}</span>
                          </div>
                        )}
                        {v.phone && (
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.5 19.79 19.79 0 0 1 1.61 4.86 2 2 0 0 1 3.6 2.69h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 10a16 16 0 0 0 6 6l.92-.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.88 17z"/></svg>
                            <a href={`tel:${v.phone}`} style={{ fontSize: 13, color: "var(--accent)", textDecoration: "none" }}>{v.phone}</a>
                          </div>
                        )}
                        {v.email && (
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                            <a href={`mailto:${v.email}`} style={{ fontSize: 13, color: "var(--accent)", textDecoration: "none" }}>{v.email}</a>
                          </div>
                        )}
                        {websiteDisplay && (
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                            <a href={v.website} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: "var(--accent)", textDecoration: "none" }}>{websiteDisplay}</a>
                          </div>
                        )}
                        {v.instagram && (
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="0.5" fill="var(--muted)"/></svg>
                            <a href={`https://instagram.com/${v.instagram.replace('@','')}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: "var(--accent)", textDecoration: "none" }}>{v.instagram}</a>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Pricing */}
                  {v.price_range && (
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 8 }}>Pricing</div>
                      <div style={{ background: "var(--surface)", borderRadius: 10, padding: "12px 16px", border: "1px solid var(--border)", fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
                        {v.price_range}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {v.notes && (
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 8 }}>Notes</div>
                      <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6, background: "var(--surface)", borderRadius: 9, padding: "10px 12px", margin: 0, border: "1px solid var(--border)" }}>
                        {v.notes}
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  <div style={{ display: "flex", gap: 9, marginTop: 8 }}>
                    <button onClick={() => { setEditForm({ ...v, is_favorite: !!v.is_favorite }); setPanelMode("edit"); }} style={{
                      flex: 1, padding: "9px 16px", borderRadius: 9,
                      border: "1.5px solid var(--accent)", background: "var(--accent)",
                      color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600,
                    }}>✏️ Edit Vendor</button>
                    <button onClick={() => { if (window.confirm(`Remove "${v.name}"?`)) removeMutation.mutate(v.id); }}
                      style={{ padding: "9px 14px", borderRadius: 9, border: "1.5px solid #e05c6a", background: "transparent", color: "#e05c6a", cursor: "pointer", fontSize: 13 }}>🗑</button>
                  </div>
                </div>
              </>
            );
          })()}

          {/* ── EDIT mode ── */}
          {panelMode === "edit" && (
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 22px" }}>
              <VendorFormFields form={editForm} set={(k, v) => setEditForm(f => ({ ...f, [k]: v }))} />
              <label style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, cursor: "pointer", userSelect: "none" }}>
                <input type="checkbox" checked={editForm.is_favorite} onChange={e => setEditForm(f => ({ ...f, is_favorite: e.target.checked }))} style={{ width: 16, height: 16, cursor: "pointer" }} />
                <span style={{ fontSize: 14, fontWeight: 500 }}>Mark as favourite ⭐</span>
              </label>
              <div style={{ display: "flex", gap: 9, marginTop: 20 }}>
                <Button onClick={handleSave} disabled={!editForm.name || saving}>{saving ? "Saving…" : "Save Changes"}</Button>
                <Button variant="outline" onClick={() => setPanelMode("view")}>Cancel</Button>
              </div>
            </div>
          )}

          {/* ── ADD mode ── */}
          {panelMode === "add" && (
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 22px" }}>
              <VendorFormFields form={addForm} set={(k, v) => setAddForm(f => ({ ...f, [k]: v }))} />
              <label style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, cursor: "pointer", userSelect: "none" }}>
                <input type="checkbox" checked={addForm.is_favorite} onChange={e => setAddForm(f => ({ ...f, is_favorite: e.target.checked }))} style={{ width: 16, height: 16, cursor: "pointer" }} />
                <span style={{ fontSize: 14, fontWeight: 500 }}>Mark as favourite ⭐</span>
              </label>
              <div style={{ display: "flex", gap: 9, marginTop: 20 }}>
                <Button onClick={handleSave} disabled={!addForm.name || saving}>{saving ? "Saving…" : "Add Vendor"}</Button>
                <Button variant="outline" onClick={() => { setSelected(null); setPanelMode(null); }}>Cancel</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
