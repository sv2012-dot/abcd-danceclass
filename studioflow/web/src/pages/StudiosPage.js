import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { studios as api } from "../api";
import toast from "react-hot-toast";
import Card from "../components/shared/Card";
import Button from "../components/shared/Button";
import Modal from "../components/shared/Modal";
import { Field, Input, Textarea } from "../components/shared/Field";

const EMPTY = {
  name: "", address: "", city: "", state: "WA", zip: "",
  phone: "", email: "", website: "", capacity: "", hourly_rate: "",
  notes: "", is_favorite: false,
};

function StudioCard({ studio, onEdit, onRemove, onToggleFav }) {
  const fullAddress = [studio.address, studio.city, studio.state, studio.zip]
    .filter(Boolean).join(", ");

  const websiteDisplay = studio.website
    ? studio.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")
    : null;

  return (
    <div style={{
      background: "var(--card)", borderRadius: 14,
      border: studio.is_favorite ? "1.5px solid #f59e0b" : "1.5px solid var(--border)",
      boxShadow: studio.is_favorite
        ? "0 2px 12px rgba(245,158,11,.13)"
        : "0 2px 8px rgba(0,0,0,.06)",
      display: "flex", flexDirection: "column", overflow: "hidden",
      transition: "box-shadow .15s, border-color .15s",
    }}>
      {/* Card header */}
      <div style={{ padding: "18px 18px 14px", flex: 1 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.3, color: "var(--foreground)", flex: 1 }}>
            {studio.name}
          </div>
          <button
            onClick={() => onToggleFav(studio)}
            title={studio.is_favorite ? "Remove from favorites" : "Mark as favorite"}
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: 20, lineHeight: 1, padding: "2px 4px",
              color: studio.is_favorite ? "#f59e0b" : "#d1d5db",
              transition: "color .15s", flexShrink: 0,
            }}
          >
            {studio.is_favorite ? "★" : "☆"}
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {fullAddress && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>📍</span>
              <span style={{ fontSize: 13, color: "var(--foreground)", lineHeight: 1.4 }}>{fullAddress}</span>
            </div>
          )}

          {studio.phone && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14, flexShrink: 0 }}>📞</span>
              <a href={`tel:${studio.phone}`} style={{ fontSize: 13, color: "var(--accent)", textDecoration: "none" }}
                onMouseEnter={e => e.currentTarget.style.textDecoration = "underline"}
                onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}>
                {studio.phone}
              </a>
            </div>
          )}

          {studio.website && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14, flexShrink: 0 }}>🌐</span>
              <a href={studio.website} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 13, color: "var(--accent)", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}
                onMouseEnter={e => e.currentTarget.style.textDecoration = "underline"}
                onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}>
                {websiteDisplay}
              </a>
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
            <p style={{
              fontSize: 12, color: "var(--muted)", fontStyle: "italic",
              margin: "4px 0 0", lineHeight: 1.5,
              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}>
              {studio.notes}
            </p>
          )}
        </div>
      </div>

      {/* Card footer */}
      <div style={{
        display: "flex", gap: 8, padding: "12px 18px",
        borderTop: "1px solid var(--border)", background: "var(--surface)",
      }}>
        <Button size="sm" variant="outline" onClick={() => onEdit(studio)}>Edit</Button>
        <Button size="sm" variant="ghost"
          onClick={() => { if (window.confirm(`Remove "${studio.name}"?`)) onRemove(studio.id); }}
          style={{ color: "#dc2626", marginLeft: "auto" }}>
          Remove
        </Button>
      </div>
    </div>
  );
}

function StudioModal({ studio, onClose, onSave, saving }) {
  const [form, setForm] = useState(
    studio
      ? { ...studio, is_favorite: !!studio.is_favorite, capacity: studio.capacity ?? "", hourly_rate: studio.hourly_rate ?? "" }
      : { ...EMPTY }
  );
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <Modal title={studio ? "Edit Studio" : "Add Studio"} onClose={onClose} wide>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
        <Field label="Studio Name *" style={{ gridColumn: "1 / -1" }}>
          <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Redmond Senior Center" />
        </Field>
        <Field label="Address" style={{ gridColumn: "1 / -1" }}>
          <Input value={form.address} onChange={e => set("address", e.target.value)} placeholder="Street address" />
        </Field>
        <Field label="City">
          <Input value={form.city} onChange={e => set("city", e.target.value)} placeholder="e.g. Redmond" />
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 10px" }}>
          <Field label="State">
            <Input value={form.state} onChange={e => set("state", e.target.value)} placeholder="WA" />
          </Field>
          <Field label="ZIP">
            <Input value={form.zip} onChange={e => set("zip", e.target.value)} placeholder="98052" />
          </Field>
        </div>
        <Field label="Phone">
          <Input value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="(425) 555-0100" />
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
        <span style={{ fontSize: 14, fontWeight: 500 }}>Mark as favorite venue ★</span>
      </label>

      <div style={{ display: "flex", gap: 9, marginTop: 20 }}>
        <Button onClick={() => onSave(form)} disabled={!form.name || saving}>
          {saving ? "Saving…" : studio ? "Save Changes" : "Add Studio"}
        </Button>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
      </div>
    </Modal>
  );
}

export default function StudiosPage() {
  const { user } = useAuth();
  const sid = user?.school_id;
  const qc = useQueryClient();

  const [modal, setModal] = useState(null); // null = closed, {} = add, {studio} = edit
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
        capacity: form.capacity ? Number(form.capacity) : null,
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
    } catch {
      toast.error("Failed to update favorite");
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-d)", fontSize: 26, marginBottom: 4 }}>Studio Bookings</h1>
          <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>
            Manage venues used for classes, rehearsals, and performances
          </p>
        </div>
        <Button onClick={() => setModal({})} icon="➕">Add Studio</Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <p style={{ color: "var(--muted)" }}>Loading…</p>

      ) : list.length === 0 ? (
        <Card style={{ textAlign: "center", padding: 56, border: "1.5px dashed var(--border)" }}>
          <div style={{ fontSize: 48, marginBottom: 14 }}>🏛️</div>
          <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>No studios yet</p>
          <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 20 }}>
            Add your first venue to start building your studio registry.
          </p>
          <Button onClick={() => setModal({})}>Add Studio</Button>
        </Card>

      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
          gap: 18,
        }}>
          {list.map(studio => (
            <StudioCard
              key={studio.id}
              studio={studio}
              onEdit={s => setModal(s)}
              onRemove={id => removeMutation.mutate(id)}
              onToggleFav={handleToggleFav}
            />
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {modal !== null && (
        <StudioModal
          studio={modal?.id ? modal : null}
          onClose={() => setModal(null)}
          onSave={handleSave}
          saving={saving}
        />
      )}
    </div>
  );
}
