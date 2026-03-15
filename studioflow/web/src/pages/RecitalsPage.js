import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { recitals as api } from "../api";
import toast from "react-hot-toast";
import Card from "../components/shared/Card";
import Button from "../components/shared/Button";
import Modal from "../components/shared/Modal";
import { Field, Input, Select, Textarea } from "../components/shared/Field";

const STATUS_OPTIONS = ["Planning","Confirmed","Rehearsals","Completed","Cancelled"];
const STATUS_COLORS  = { Planning:"#6a7fdb", Confirmed:"#52c4a0", Rehearsals:"#f4a041", Completed:"#8ab4c0", Cancelled:"#e05c6a" };
const STATUS_ICONS   = { Planning:"📋", Confirmed:"✅", Rehearsals:"🎵", Completed:"🏆", Cancelled:"❌" };
const EMPTY = { title:"", event_date:"", venue:"", status:"Planning", description:"" };

// ── Demo data for tabs that don't yet have a backend ─────────────────────────

function initials(name="") { return name.trim().split(/\s+/).slice(0,2).map(w=>w[0]).join("").toUpperCase()||"?"; }
function avatarHue(name="") { return (name.charCodeAt(0)||0)*37 % 360; }

// ── Small icon components ─────────────────────────────────────────────────────
const Icon = ({ d, size=14, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...rest}>
    {d}
  </svg>
);
const CalIcon   = () => <Icon d={<><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>} />;
const ClockIcon = () => <Icon d={<><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>} />;
const PinIcon   = () => <Icon d={<><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></>} />;
const UsersIcon = () => <Icon d={<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>} />;
const ArrowLeft = () => <Icon size={16} d={<><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></>} />;
const CheckIcon = () => <Icon size={11} d={<polyline points="20 6 9 17 4 12"/>} style={{stroke:"#fff", strokeWidth:3}} />;

function SectionHead({ title, sub }) {
  return (
    <div style={{ marginBottom:18 }}>
      <h2 style={{ fontSize:16, fontWeight:800, margin:0, marginBottom:4 }}>{title}</h2>
      {sub && <p style={{ fontSize:12, color:"var(--muted)", margin:0 }}>{sub}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Full-page Detail View
// ─────────────────────────────────────────────────────────────────────────────
export function RecitalDetail({ id, onBack, sid, onEdit }) {
  const [tab,         setTab]         = useState("overview");
  const [tasks,       setTasks]       = useState([]);
  const [newTask,     setNewTask]     = useState("");
  const [sugUrl,      setSugUrl]      = useState("");
  const [sugInput,    setSugInput]    = useState("");
  const [editingUrl,  setEditingUrl]  = useState(false);
  // Vendors state
  const [vendors,        setVendors]        = useState([]);
  const [vendorModal,    setVendorModal]    = useState(null);
  const EMPTY_VENDOR = { name:"", service:"", contact:"", phone:"", status:"Pending" };
  const [vendorForm,     setVendorForm]     = useState(EMPTY_VENDOR);

  // Volunteers state
  const [volunteers,     setVolunteers]     = useState([]);
  const [volunteerModal, setVolunteerModal] = useState(null);
  const EMPTY_VOL = { name:"", role:"", email:"", phone:"", status:"Pending" };
  const [volunteerForm,  setVolunteerForm]  = useState(EMPTY_VOL);

  // Program schedule state
  const EMPTY_PROG = { time:"", duration:"", title:"", performers:"", music_url:"", music_name:"", music_data:"", mc_notes:"", lighting_notes:"" };
  const [programItems,   setProgramItems]   = useState([]);
  const [progModal,      setProgModal]      = useState(null); // null=closed, {}=new, {id,...}=edit
  const [progForm,       setProgForm]       = useState(EMPTY_PROG);
  const [expandedNotes,  setExpandedNotes]  = useState(new Set()); // MC notes expanded row ids
  const [expandedLight,  setExpandedLight]  = useState(new Set()); // Lighting notes expanded
  const dragItem     = useRef(null); // index being dragged
  const dragOverItem = useRef(null); // index being hovered over

  // Inline edit modal (meta + overview)
  const [editOpen,   setEditOpen]   = useState(false);
  const [editForm,   setEditForm]   = useState({});
  const [infoItems,  setInfoItems]  = useState([]); // Important Information bullet list
  const [newInfo,    setNewInfo]    = useState("");  // new bullet input

  // Event poster
  const [poster,        setPoster]        = useState(null);  // base64 data URL
  const [posterHover,   setPosterHover]   = useState(false);
  // Instagram post as poster
  const [instaUrl,      setInstaUrl]      = useState("");    // saved IG post URL
  const [instaInput,    setInstaInput]    = useState("");    // live input
  const [showInstaForm, setShowInstaForm] = useState(false); // show URL form

  const qc = useQueryClient();

  // Persist Sign Up Genius URL in localStorage per recital
  const SUG_KEY        = `sug_url_${id}`;
  const VENDORS_KEY    = `vendors_${id}`;
  const VOLUNTEERS_KEY = `volunteers_${id}`;
  const PROGRAM_KEY    = `program_${id}`;
  const INFO_KEY       = `info_items_${id}`;
  const POSTER_KEY     = `poster_${id}`;
  const INSTA_KEY      = `insta_${id}`;

  useEffect(() => {
    const saved = localStorage.getItem(SUG_KEY);
    if (saved) { setSugUrl(saved); setSugInput(saved); }

    const savedVendors = localStorage.getItem(VENDORS_KEY);
    if (savedVendors) { try { setVendors(JSON.parse(savedVendors)); } catch {} }

    const savedVols = localStorage.getItem(VOLUNTEERS_KEY);
    if (savedVols) { try { setVolunteers(JSON.parse(savedVols)); } catch {} }

    const savedProg = localStorage.getItem(PROGRAM_KEY);
    if (savedProg) { try { setProgramItems(JSON.parse(savedProg)); } catch {} }

    const savedInfo = localStorage.getItem(INFO_KEY);
    if (savedInfo) {
      try { setInfoItems(JSON.parse(savedInfo)); } catch {}
    } else {
      const defaults = [
        "Doors open 30 minutes before showtime",
        "Students must arrive 1 hour early for costume and makeup",
        "Photography and videography by approved vendors only during performance",
        "Reserved seating for family members (2 tickets per student)",
        "Reception to follow in the lobby",
      ];
      setInfoItems(defaults);
      localStorage.setItem(INFO_KEY, JSON.stringify(defaults));
    }

    const savedPoster = localStorage.getItem(POSTER_KEY);
    if (savedPoster) setPoster(savedPoster);

    const savedInsta = localStorage.getItem(INSTA_KEY);
    if (savedInsta) { setInstaUrl(savedInsta); setInstaInput(savedInsta); }
  }, [SUG_KEY, VENDORS_KEY, PROGRAM_KEY, INFO_KEY, POSTER_KEY, INSTA_KEY]);

  const persistVendors = (list) => {
    setVendors(list);
    localStorage.setItem(VENDORS_KEY, JSON.stringify(list));
  };

  const openAddVendor  = () => { setVendorForm(EMPTY_VENDOR); setVendorModal({}); };
  const openEditVendor = (v) => { setVendorForm({ name:v.name, service:v.service, contact:v.contact, phone:v.phone, status:v.status }); setVendorModal(v); };

  const saveVendor = () => {
    if (!vendorForm.name.trim()) { toast.error("Vendor name is required"); return; }
    if (vendorModal?.id) {
      // Edit
      persistVendors(vendors.map(v => v.id === vendorModal.id ? { ...v, ...vendorForm } : v));
      toast.success("Vendor updated");
    } else {
      // Add
      const newV = { ...vendorForm, id: Date.now() };
      persistVendors([...vendors, newV]);
      toast.success("Vendor added");
    }
    setVendorModal(null);
  };

  const deleteVendor = (vid) => {
    persistVendors(vendors.filter(v => v.id !== vid));
    toast.success("Vendor removed");
  };

  // ── Volunteers CRUD ──────────────────────────────────────────────────────
  const persistVolunteers = (list) => {
    setVolunteers(list);
    localStorage.setItem(VOLUNTEERS_KEY, JSON.stringify(list));
  };
  const openAddVolunteer  = () => { setVolunteerForm(EMPTY_VOL); setVolunteerModal({}); };
  const openEditVolunteer = (v) => { setVolunteerForm({ name:v.name, role:v.role, email:v.email, phone:v.phone, status:v.status }); setVolunteerModal(v); };
  const saveVolunteer = () => {
    if (!volunteerForm.name.trim()) { toast.error("Name is required"); return; }
    if (volunteerModal?.id) {
      persistVolunteers(volunteers.map(v => v.id === volunteerModal.id ? { ...v, ...volunteerForm } : v));
      toast.success("Volunteer updated");
    } else {
      persistVolunteers([...volunteers, { ...volunteerForm, id: Date.now() }]);
      toast.success("Volunteer added");
    }
    setVolunteerModal(null);
  };
  const deleteVolunteer = (vid) => {
    persistVolunteers(volunteers.filter(v => v.id !== vid));
    toast.success("Volunteer removed");
  };

  // ── Inline Edit Event helpers ────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: (data) => api.update(sid, id, data),
    onSuccess: (updated) => {
      qc.setQueryData(["recital-detail", sid, id], (old) => ({ ...old, ...updated }));
      qc.invalidateQueries(["recitals", sid]);
      toast.success("Event updated");
      setEditOpen(false);
    },
    onError: () => toast.error("Failed to save changes"),
  });

  const openInlineEdit = () => {
    setEditForm({
      title:       recital?.title      || "",
      event_date:  recital?.event_date?.split("T")[0] || "",
      event_time:  recital?.event_time || "",
      venue:       recital?.venue      || "",
      status:      recital?.status     || "Planning",
      description: recital?.description|| "",
    });
    setNewInfo("");
    setEditOpen(true);
  };

  const saveInlineEdit = () => {
    if (!editForm.title?.trim()) { toast.error("Title is required"); return; }
    // Save important info to localStorage
    localStorage.setItem(INFO_KEY, JSON.stringify(infoItems));
    // Save meta + description to backend
    updateMutation.mutate(editForm);
  };

  const addInfoItem = () => {
    const v = newInfo.trim();
    if (!v) return;
    setInfoItems(p => [...p, v]);
    setNewInfo("");
  };

  const removeInfoItem = (i) => setInfoItems(p => p.filter((_, idx) => idx !== i));

  const editInfoItem = (i, val) => setInfoItems(p => p.map((x, idx) => idx === i ? val : x));

  // ── Poster helpers ────────────────────────────────────────────────────────
  const handlePosterUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Image too large (max 5 MB)"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const data = reader.result;
      setPoster(data);
      // Clear Instagram if switching to image
      setInstaUrl(""); setInstaInput(""); setShowInstaForm(false);
      localStorage.removeItem(INSTA_KEY);
      try { localStorage.setItem(POSTER_KEY, data); toast.success("Poster saved"); }
      catch { toast("Poster loaded but too large to persist.", { icon:"⚠️" }); }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const removePoster = () => {
    setPoster(null);
    localStorage.removeItem(POSTER_KEY);
    toast.success("Poster removed");
  };

  // ── Instagram helpers ─────────────────────────────────────────────────────
  const getInstaShortcode = (url) => {
    const m = url.match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
    return m ? m[1] : null;
  };

  const saveInstaUrl = () => {
    const sc = getInstaShortcode(instaInput.trim());
    if (!sc) { toast.error("Paste a valid Instagram post, reel, or video URL"); return; }
    const normalised = `https://www.instagram.com/p/${sc}/`;
    setInstaUrl(normalised);
    setShowInstaForm(false);
    // Clear image if switching to Instagram
    setPoster(null);
    localStorage.removeItem(POSTER_KEY);
    localStorage.setItem(INSTA_KEY, normalised);
    toast.success("Instagram post linked");
  };

  const removeInsta = () => {
    setInstaUrl(""); setInstaInput(""); setShowInstaForm(false);
    localStorage.removeItem(INSTA_KEY);
    toast.success("Instagram link removed");
  };

  // ── Program schedule helpers ─────────────────────────────────────────────
  const persistProgram = (list) => {
    // Strip music_data before storing if too large (>4 MB)
    const safe = list.map(p => {
      if (p.music_data && p.music_data.length > 4_000_000) {
        toast("Music file too large to persist — it will be available until you leave the page.", { icon:"⚠️" });
        return { ...p, music_data:"" };
      }
      return p;
    });
    setProgramItems(list);
    try { localStorage.setItem(PROGRAM_KEY, JSON.stringify(safe)); } catch { /* quota exceeded */ }
  };

  const openAddProg  = () => { setProgForm(EMPTY_PROG); setProgModal({}); };
  const openEditProg = (p) => {
    setProgForm({ time:p.time||"", duration:p.duration||"", title:p.title||"", performers:p.performers||p.group||"",
      music_url:p.music_url||"", music_name:p.music_name||"", music_data:p.music_data||"",
      mc_notes:p.mc_notes||"", lighting_notes:p.lighting_notes||"" });
    setProgModal(p);
  };

  const handleMusicUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("File exceeds 10 MB. Use an external URL instead."); return; }
    const reader = new FileReader();
    reader.onload = () => setProgForm(p => ({ ...p, music_data:reader.result, music_name:file.name, music_url:"" }));
    reader.readAsDataURL(file);
  };

  const saveProg = () => {
    if (!progForm.title.trim()) { toast.error("Title is required"); return; }
    if (progModal?.id) {
      persistProgram(programItems.map(p => p.id === progModal.id ? { ...p, ...progForm } : p));
      toast.success("Number updated");
    } else {
      persistProgram([...programItems, { ...progForm, id:Date.now() }]);
      toast.success("Number added");
    }
    setProgModal(null);
  };

  const deleteProg = (pid) => {
    persistProgram(programItems.filter(p => p.id !== pid));
    toast.success("Number removed");
  };

  const toggleNote  = (id) => setExpandedNotes(prev => { const s=new Set(prev); s.has(id)?s.delete(id):s.add(id); return s; });
  const toggleLight = (id) => setExpandedLight(prev => { const s=new Set(prev); s.has(id)?s.delete(id):s.add(id); return s; });

  const handleDragSort = () => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    if (dragItem.current === dragOverItem.current) return;
    const next = [...programItems];
    const [moved] = next.splice(dragItem.current, 1);
    next.splice(dragOverItem.current, 0, moved);
    dragItem.current = null; dragOverItem.current = null;
    persistProgram(next);
  };

  const saveSugUrl = () => {
    const trimmed = sugInput.trim();
    localStorage.setItem(SUG_KEY, trimmed);
    setSugUrl(trimmed);
    setEditingUrl(false);
    if (trimmed) toast.success("Sign Up Genius link saved");
  };

  const clearSugUrl = () => {
    localStorage.removeItem(SUG_KEY);
    setSugUrl(""); setSugInput(""); setEditingUrl(false);
  };

  const { data: recital, isLoading } = useQuery({
    queryKey: ["recital-detail", sid, id],
    queryFn: async () => {
      const res = await api.get(sid, id);
      const { tasks: t, ...r } = res;
      setTasks(t || []);
      return r;
    },
    enabled: !!sid && !!id,
  });

  const toggleTask = async (taskId, done) => {
    try {
      await api.toggleTask(sid, id, taskId);
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, is_done: !done } : t));
      qc.invalidateQueries(["recitals", sid]);
    } catch { toast.error("Failed to update task"); }
  };

  const addTask = async () => {
    if (!newTask.trim()) return;
    try {
      const task = await api.addTask(sid, id, newTask);
      setTasks(prev => [...prev, task]);
      setNewTask("");
      qc.invalidateQueries(["recitals", sid]);
    } catch { toast.error("Failed to add task"); }
  };

  if (isLoading || !recital) {
    return (
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:300, color:"var(--muted)" }}>
        Loading event…
      </div>
    );
  }

  const color   = STATUS_COLORS[recital.status] || "#888";
  // Use local-date constructor to avoid UTC midnight shift (mysql2 returns DATE as ISO string)
  const [_yr, _mo, _dy] = (recital.event_date||'').slice(0,10).split('-').map(Number);
  const d       = (_yr && _mo && _dy) ? new Date(_yr, _mo - 1, _dy) : new Date(NaN);
  const fmtDate = isNaN(d) ? "—" : d.toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric", year:"numeric" });
  const done    = tasks.filter(t => t.is_done).length;
  const pct     = tasks.length ? Math.round(done / tasks.length * 100) : 0;

  const TABS = [
    { id:"overview",   label:"Overview" },
    { id:"program",    label:"Program Schedule" },
    { id:"volunteers", label:"Parent Volunteers" },
    { id:"vendors",    label:"Vendors" },
    { id:"tasks",      label:`Tasks${tasks.length ? ` (${done}/${tasks.length})` : ""}` },
  ];

  const META = [
    { icon:<CalIcon/>,   label:"Date",         value: fmtDate },
    { icon:<ClockIcon/>, label:"Time",         value: recital.event_time || "7:00 PM" },
    { icon:<PinIcon/>,   label:"Location",     value: recital.venue || "Main Theater" },
    { icon:<UsersIcon/>, label:"Participants", value: "45 students" },
  ];

  return (
    <div style={{ minHeight:"100%" }}>

      {/* ── Back navigation ───────────────────────────────────────────── */}
      <div style={{ marginBottom:22 }}>
        <button onClick={onBack} style={{
          display:"inline-flex", alignItems:"center", gap:7,
          background:"none", border:"none", cursor:"pointer",
          color:"var(--muted)", fontSize:13, fontWeight:600, padding:0,
          transition:"color .15s", lineHeight:1,
        }}
          onMouseEnter={e => e.currentTarget.style.color = "var(--text)"}
          onMouseLeave={e => e.currentTarget.style.color = "var(--muted)"}
        >
          <ArrowLeft /> Back to Events
        </button>
      </div>

      {/* ── Event header (full-width) ──────────────────────────────────── */}
      <div style={{ marginBottom:26 }}>
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:16, flexWrap:"wrap", marginBottom:22 }}>
          <div>
            <h1 style={{ fontFamily:"var(--font-d)", fontSize:30, fontWeight:900, margin:0, marginBottom:10, lineHeight:1.2 }}>
              {recital.title}
            </h1>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
              <span style={{ fontSize:12, background:"#6a7fdb22", color:"#6a7fdb", borderRadius:20, padding:"4px 12px", fontWeight:700 }}>
                Performance
              </span>
              <span style={{ fontSize:12, background:color+"22", color, borderRadius:20, padding:"4px 12px", fontWeight:700 }}>
                {STATUS_ICONS[recital.status]} {recital.status}
              </span>
            </div>
          </div>
          <button onClick={openInlineEdit} style={{
            display:"inline-flex", alignItems:"center", gap:6,
            padding:"9px 18px", borderRadius:10, border:"1.5px solid var(--border)",
            background:"var(--card)", cursor:"pointer", fontSize:13, fontWeight:600,
            color:"var(--text)", transition:"all .15s", flexShrink:0,
          }}
            onMouseEnter={e => e.currentTarget.style.background = "var(--surface)"}
            onMouseLeave={e => e.currentTarget.style.background = "var(--card)"}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Edit Event
          </button>
        </div>

        {/* Metadata strip — full width */}
        <div style={{
          display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:0,
          background:"var(--border)", borderRadius:14, overflow:"hidden",
          border:"1px solid var(--border)",
        }}>
          {META.map((m, i) => (
            <div key={m.label} style={{
              background:"var(--card)", padding:"16px 22px",
              borderRight: i < META.length-1 ? "1px solid var(--border)" : "none",
            }}>
              <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:7, color:"var(--muted)" }}>
                {m.icon}
                <span style={{ fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:".07em" }}>{m.label}</span>
              </div>
              <div style={{ fontSize:14, fontWeight:700, color:"var(--text)" }}>{m.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tab bar ───────────────────────────────────────────────────── */}
      <div style={{
        display:"flex", gap:2,
        background:"var(--surface)", borderRadius:12,
        padding:4, marginBottom:22,
        border:"1px solid var(--border)",
        width:"fit-content",
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding:"8px 18px", border:"none", cursor:"pointer",
            background: tab === t.id ? "var(--card)" : "transparent",
            color: tab === t.id ? "var(--text)" : "var(--muted)",
            fontWeight: tab === t.id ? 700 : 500,
            fontSize:13, borderRadius:9, transition:"all .15s",
            boxShadow: tab === t.id ? "0 1px 6px rgba(0,0,0,.1)" : "none",
            whiteSpace:"nowrap",
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── Tab content ───────────────────────────────────────────────── */}
      <div style={{ background:"var(--card)", borderRadius:16, border:"1px solid var(--border)", padding:"28px 32px" }}>

        {/* ── OVERVIEW ── */}
        {tab === "overview" && (
          /* Bleed the wrapper to the container's padding edges so poster
             can sit flush on top / right / bottom. overflow:hidden + matching
             borderRadius clips everything to the card's rounded corners.      */
          <div style={{
            display:"flex", alignItems:"stretch",
            margin:"-28px -32px -28px -32px",
            overflow:"hidden", borderRadius:16,
          }}>

            {/* Left: description + important info — re-apply the original padding */}
            <div style={{ flex:1, minWidth:0, padding:"28px 32px" }}>
              <SectionHead title="Event Overview" sub="General information and description" />

              {recital.description && (
                <>
                  <h3 style={{ fontSize:15, fontWeight:700, margin:"0 0 8px" }}>Description</h3>
                  <p style={{ color:"var(--muted)", fontSize:14, lineHeight:1.75, margin:"0 0 28px" }}>{recital.description}</p>
                </>
              )}

              {infoItems.length > 0 && (
                <>
                  <h3 style={{ fontSize:15, fontWeight:700, margin:"0 0 12px" }}>Important Information</h3>
                  <ul style={{ margin:0, padding:"0 0 0 18px", display:"flex", flexDirection:"column", gap:9 }}>
                    {infoItems.map((item, i) => (
                      <li key={i} style={{ fontSize:13, color:"var(--muted)", lineHeight:1.5 }}>{item}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>

            {/* Right: Event Poster — edge-to-edge on top / right / bottom */}
            <div
              onMouseEnter={() => setPosterHover(true)}
              onMouseLeave={() => setPosterHover(false)}
              style={{
                flexShrink:0, width:260, position:"relative", overflow:"hidden",
                borderLeft:"1px solid var(--border)",
                background: (poster || instaUrl) ? "#000" : "var(--surface)",
                minHeight:320,
              }}
            >
              {/* ── Uploaded image ── */}
              {poster && (
                <>
                  <img src={poster} alt="Event poster"
                    style={{ width:"100%", height:"100%", objectFit:"cover", display:"block", position:"absolute", inset:0 }} />
                  {posterHover && (
                    <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,.52)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:10, zIndex:2 }}>
                      <label style={{ padding:"8px 18px", borderRadius:8, background:"rgba(255,255,255,.92)", fontSize:12, fontWeight:700, cursor:"pointer", color:"#333", display:"flex", alignItems:"center", gap:6 }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        Change
                        <input type="file" accept="image/*" style={{ display:"none" }} onChange={handlePosterUpload} />
                      </label>
                      <button onClick={removePoster} style={{ padding:"8px 18px", borderRadius:8, background:"rgba(224,92,106,.88)", fontSize:12, fontWeight:700, cursor:"pointer", color:"#fff", border:"none", display:"flex", alignItems:"center", gap:6 }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                        Remove
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* ── Instagram embed ── */}
              {!poster && instaUrl && !showInstaForm && (() => {
                const sc    = getInstaShortcode(instaUrl);
                const SCALE = 260 / 326;                   // scale iframe to fit 260px width
                const SKIP  = 52;                          // unscaled px to skip the IG header
                // Shift the iframe up by (SKIP * SCALE) so the header is clipped above the container
                return (
                  <>
                    <div style={{
                      position:"absolute", top: -(SKIP * SCALE), left:0,
                      width:326, height:700,
                      transform:`scale(${SCALE})`, transformOrigin:"top left",
                      pointerEvents:"none",
                    }}>
                      <iframe src={`https://www.instagram.com/p/${sc}/embed/`}
                        width="326" height="700" frameBorder="0" scrolling="no"
                        style={{ border:"none", display:"block" }} title="Instagram post" />
                    </div>
                    {/* Hover overlay – no badge, just controls */}
                    {posterHover && (
                      <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,.52)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:10, zIndex:2 }}>
                        <a href={instaUrl} target="_blank" rel="noopener noreferrer"
                          style={{ padding:"8px 18px", borderRadius:8, background:"rgba(255,255,255,.92)", fontSize:12, fontWeight:700, cursor:"pointer", color:"#333", textDecoration:"none", display:"flex", alignItems:"center", gap:6 }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                          Open on Instagram
                        </a>
                        <button onClick={() => { setInstaInput(instaUrl); setShowInstaForm(true); }}
                          style={{ padding:"8px 18px", borderRadius:8, background:"rgba(255,255,255,.85)", fontSize:12, fontWeight:700, cursor:"pointer", color:"#333", border:"none", display:"flex", alignItems:"center", gap:6 }}>
                          Change URL
                        </button>
                        <button onClick={removeInsta}
                          style={{ padding:"8px 18px", borderRadius:8, background:"rgba(224,92,106,.88)", fontSize:12, fontWeight:700, cursor:"pointer", color:"#fff", border:"none", display:"flex", alignItems:"center", gap:6 }}>
                          Remove
                        </button>
                      </div>
                    )}
                  </>
                );
              })()}

              {/* ── Instagram URL input form ── */}
              {!poster && showInstaForm && (
                <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:12, padding:20, boxSizing:"border-box" }}>
                  <div style={{ width:44, height:44, borderRadius:12, background:"linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
                  </div>
                  <div style={{ fontSize:12, fontWeight:700, color:"var(--text)", textAlign:"center", lineHeight:1.4 }}>Paste Instagram<br/>post URL</div>
                  <input value={instaInput} onChange={e => setInstaInput(e.target.value)} onKeyDown={e => e.key === "Enter" && saveInstaUrl()}
                    placeholder="instagram.com/p/…" autoFocus
                    style={{ width:"100%", padding:"8px 10px", borderRadius:8, fontSize:12, border:"1px solid var(--border)", background:"var(--card)", color:"var(--text)", outline:"none", boxSizing:"border-box" }} />
                  <div style={{ display:"flex", gap:8, width:"100%" }}>
                    <button onClick={saveInstaUrl} style={{ flex:1, padding:"8px 0", borderRadius:8, background:"linear-gradient(45deg,#f09433,#bc1888)", border:"none", color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer" }}>Link</button>
                    <button onClick={() => setShowInstaForm(false)} style={{ flex:1, padding:"8px 0", borderRadius:8, background:"var(--border)", border:"none", color:"var(--muted)", fontSize:12, fontWeight:700, cursor:"pointer" }}>Cancel</button>
                  </div>
                </div>
              )}

              {/* ── Empty state ── */}
              {!poster && !instaUrl && !showInstaForm && (
                <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:12, padding:20, boxSizing:"border-box" }}>
                  <div style={{ fontSize:11, fontWeight:700, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".06em" }}>Event Poster</div>
                  <label style={{ width:"100%", padding:"11px 0", borderRadius:9, border:"1.5px dashed var(--border)", background:"var(--card)", display:"flex", alignItems:"center", justifyContent:"center", gap:7, cursor:"pointer", fontSize:12, fontWeight:600, color:"var(--text)" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                    Upload Image
                    <input type="file" accept="image/*" style={{ display:"none" }} onChange={handlePosterUpload} />
                  </label>
                  <div style={{ display:"flex", alignItems:"center", gap:6, width:"100%" }}>
                    <div style={{ flex:1, height:1, background:"var(--border)" }}/><span style={{ fontSize:10, color:"var(--muted)" }}>or</span><div style={{ flex:1, height:1, background:"var(--border)" }}/>
                  </div>
                  <button onClick={() => setShowInstaForm(true)} style={{ width:"100%", padding:"11px 0", borderRadius:9, border:"1.5px dashed var(--border)", background:"var(--card)", display:"flex", alignItems:"center", justifyContent:"center", gap:7, cursor:"pointer", fontSize:12, fontWeight:600, color:"var(--text)" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" stroke="url(#ig2)">
                      <defs><linearGradient id="ig2" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#f09433"/><stop offset="100%" stopColor="#bc1888"/></linearGradient></defs>
                      <rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                    </svg>
                    Instagram Post
                  </button>
                </div>
              )}
            </div>

          </div>
        )}

        {/* ── Inline Edit Event modal ── */}
        {editOpen && (
          <Modal title="Edit Event" onClose={() => setEditOpen(false)}>
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

              {/* ── Meta fields ── */}
              <p style={{ margin:0, fontSize:12, fontWeight:700, textTransform:"uppercase", letterSpacing:".06em", color:"var(--muted)" }}>Event Details</p>
              <Field label="Event Title">
                <Input value={editForm.title} onChange={e => setEditForm(p=>({...p,title:e.target.value}))} required />
              </Field>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <Field label="Date">
                  <Input type="date" value={editForm.event_date} onChange={e => setEditForm(p=>({...p,event_date:e.target.value}))} />
                </Field>
                <Field label="Time">
                  <Input value={editForm.event_time} onChange={e => setEditForm(p=>({...p,event_time:e.target.value}))} placeholder="e.g. 7:00 PM" />
                </Field>
              </div>
              <Field label="Venue / Location">
                <Input value={editForm.venue} onChange={e => setEditForm(p=>({...p,venue:e.target.value}))} placeholder="e.g. Main Theater" />
              </Field>
              <Field label="Status">
                <Select value={editForm.status} onChange={e => setEditForm(p=>({...p,status:e.target.value}))}>
                  {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
                </Select>
              </Field>

              {/* ── Description ── */}
              <div style={{ borderTop:"1px solid var(--border)", paddingTop:14 }}>
                <p style={{ margin:"0 0 10px", fontSize:12, fontWeight:700, textTransform:"uppercase", letterSpacing:".06em", color:"var(--muted)" }}>Overview</p>
                <Field label="Description">
                  <Textarea rows={3} value={editForm.description} onChange={e => setEditForm(p=>({...p,description:e.target.value}))}
                    placeholder="Brief description of the event…" />
                </Field>
              </div>

              {/* ── Important Information bullets ── */}
              <div>
                <p style={{ margin:"0 0 10px", fontSize:13, fontWeight:700, color:"var(--text)" }}>Important Information</p>
                <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:10 }}>
                  {infoItems.map((item, i) => (
                    <div key={i} style={{ display:"flex", gap:8, alignItems:"center" }}>
                      <input
                        value={item}
                        onChange={e => editInfoItem(i, e.target.value)}
                        style={{
                          flex:1, padding:"7px 11px", borderRadius:8, fontSize:13,
                          border:"1px solid var(--border)", background:"var(--surface)",
                          color:"var(--text)", outline:"none",
                        }}
                      />
                      <button onClick={() => removeInfoItem(i)} title="Remove" style={{
                        width:28, height:28, borderRadius:6, border:"1px solid #fecaca",
                        background:"none", cursor:"pointer", color:"#e05c6a", flexShrink:0,
                        display:"flex", alignItems:"center", justifyContent:"center",
                      }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                  ))}
                </div>
                {/* Add new bullet */}
                <div style={{ display:"flex", gap:8 }}>
                  <input
                    value={newInfo}
                    onChange={e => setNewInfo(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addInfoItem(); } }}
                    placeholder="Add a bullet point…"
                    style={{
                      flex:1, padding:"7px 11px", borderRadius:8, fontSize:13,
                      border:"1.5px dashed var(--border)", background:"var(--surface)",
                      color:"var(--text)", outline:"none",
                    }}
                  />
                  <button onClick={addInfoItem} style={{
                    padding:"7px 14px", borderRadius:8, fontSize:12, fontWeight:700,
                    border:"1px solid var(--border)", background:"none", cursor:"pointer", color:"var(--muted)",
                  }}>+ Add</button>
                </div>
              </div>
            </div>

            <div style={{ display:"flex", justifyContent:"flex-end", gap:8, marginTop:20 }}>
              <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button onClick={saveInlineEdit} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </Modal>
        )}

        {/* ── PROGRAM SCHEDULE ── */}
        {tab === "program" && (
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
              <SectionHead title="Program Schedule" sub="Performance timeline and running order" />
              <Button icon="➕" size="sm" onClick={openAddProg}>Add Number</Button>
            </div>

            {/* Scrollable table */}
            <div style={{ overflowX:"auto", borderRadius:12, border:"1px solid var(--border)", position:"relative" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", minWidth:1020, tableLayout:"fixed", fontSize:13 }}>
                <colgroup>
                  <col style={{width:36}}/>  {/* drag handle */}
                  <col style={{width:42}}/>  {/* # */}
                  <col style={{width:84}}/>  {/* time */}
                  <col style={{width:66}}/>  {/* duration */}
                  <col style={{width:172}}/> {/* title */}
                  <col style={{width:135}}/> {/* performers */}
                  <col style={{width:152}}/> {/* music */}
                  <col style={{width:178}}/> {/* mc notes */}
                  <col style={{width:162}}/> {/* lighting */}
                  <col style={{width:68}}/>  {/* actions – sticky */}
                </colgroup>
                <thead>
                  <tr style={{ background:"var(--surface)", borderBottom:"1.5px solid var(--border)" }}>
                    {/* drag handle header */}
                    <th style={{ padding:"10px 0 10px 10px", borderRight:"1px solid var(--border)" }}/>
                    {["#","Time","Duration","Title","Performers","Music","MC Notes","Lighting Notes"].map((h,i) => (
                      <th key={h} style={{
                        padding:"10px 12px", textAlign:"left", fontSize:11, fontWeight:700,
                        color:"var(--muted)", textTransform:"uppercase", letterSpacing:.5,
                        borderRight:"1px solid var(--border)",
                      }}>{h}</th>
                    ))}
                    {/* sticky actions header */}
                    <th style={{
                      padding:"10px 12px", fontSize:11, fontWeight:700, color:"var(--muted)",
                      textTransform:"uppercase", letterSpacing:.5,
                      position:"sticky", right:0, background:"var(--surface)",
                      boxShadow:"-2px 0 6px rgba(0,0,0,.06)", zIndex:3,
                    }}/>
                  </tr>
                </thead>
                <tbody>
                  {programItems.length === 0 && (
                    <tr><td colSpan={10} style={{ padding:"32px 20px", textAlign:"center", color:"var(--muted)", fontSize:13 }}>
                      No numbers yet — click <strong>Add Number</strong> to get started.
                    </td></tr>
                  )}
                  {programItems.map((p, i) => {
                    const hasMusic   = p.music_data || p.music_url;
                    const mcExpanded = expandedNotes.has(p.id);
                    const ltExpanded = expandedLight.has(p.id);
                    const rowBg = i % 2 === 0 ? "var(--card)" : "var(--surface)";
                    return (
                      <tr key={p.id}
                        draggable
                        onDragStart={() => { dragItem.current = i; }}
                        onDragEnter={() => { dragOverItem.current = i; }}
                        onDragOver={e => e.preventDefault()}
                        onDragEnd={handleDragSort}
                        style={{
                          background: rowBg,
                          borderBottom: i < programItems.length - 1 ? "1px solid var(--border)" : "none",
                          verticalAlign:"top", cursor:"grab",
                        }}>
                        {/* Drag handle */}
                        <td style={{ padding:"14px 0 14px 10px", borderRight:"1px solid var(--border)", color:"var(--muted)", userSelect:"none" }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <line x1="4" y1="7"  x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/>
                          </svg>
                        </td>
                        {/* # */}
                        <td style={{ padding:"14px 12px", borderRight:"1px solid var(--border)", color:"var(--muted)", fontWeight:700, fontSize:12, textAlign:"center" }}>
                          {i + 1}
                        </td>
                        {/* Time */}
                        <td style={{ padding:"14px 12px", borderRight:"1px solid var(--border)" }}>
                          <div style={{ fontWeight:800, color:"#6a7fdb", fontSize:13 }}>{p.time||"—"}</div>
                        </td>
                        {/* Duration */}
                        <td style={{ padding:"14px 12px", borderRight:"1px solid var(--border)", color:"var(--muted)" }}>
                          {p.duration||"—"}
                        </td>
                        {/* Title */}
                        <td style={{ padding:"14px 12px", borderRight:"1px solid var(--border)" }}>
                          <div style={{ fontWeight:700 }}>{p.title}</div>
                        </td>
                        {/* Performers */}
                        <td style={{ padding:"14px 12px", borderRight:"1px solid var(--border)", color:"var(--muted)" }}>
                          {p.performers || p.group || "—"}
                        </td>
                        {/* Music */}
                        <td style={{ padding:"12px 12px", borderRight:"1px solid var(--border)" }}>
                          {hasMusic ? (
                            <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                              <div style={{ fontSize:11, fontWeight:700, color:"#333", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:128 }}>
                                🎵 {p.music_name || "Track"}
                              </div>
                              {p.music_data && (
                                <audio controls src={p.music_data} style={{ width:"100%", maxWidth:128, height:26 }} />
                              )}
                              {p.music_url && !p.music_data && (
                                <a href={p.music_url} target="_blank" rel="noopener noreferrer"
                                  style={{ fontSize:11, color:"#6a7fdb", textDecoration:"none", fontWeight:600 }}>▶ Open / Play</a>
                              )}
                              {p.music_data && (
                                <a href={p.music_data} download={p.music_name||"music"}
                                  style={{ fontSize:11, color:"var(--muted)", textDecoration:"none" }}>⬇ Download</a>
                              )}
                            </div>
                          ) : <span style={{ fontSize:11, color:"var(--border)" }}>—</span>}
                        </td>
                        {/* MC Notes */}
                        <td style={{ padding:"14px 12px", borderRight:"1px solid var(--border)" }}>
                          {p.mc_notes ? (
                            <div>
                              <div style={{
                                fontSize:12, lineHeight:1.5,
                                overflow: mcExpanded ? "visible" : "hidden",
                                display: mcExpanded ? "block" : "-webkit-box",
                                WebkitLineClamp: mcExpanded ? "unset" : 2,
                                WebkitBoxOrient:"vertical",
                              }}>{p.mc_notes}</div>
                              {p.mc_notes.length > 80 && (
                                <button onClick={() => toggleNote(p.id)} style={{ fontSize:11, color:"#6a7fdb", background:"none", border:"none", cursor:"pointer", padding:"2px 0", fontWeight:600 }}>
                                  {mcExpanded ? "Show less ▲" : "View more ▼"}
                                </button>
                              )}
                            </div>
                          ) : <span style={{ fontSize:11, color:"var(--border)" }}>—</span>}
                        </td>
                        {/* Lighting Notes */}
                        <td style={{ padding:"14px 12px", borderRight:"1px solid var(--border)" }}>
                          {p.lighting_notes ? (
                            <div>
                              <div style={{
                                fontSize:12, lineHeight:1.5,
                                overflow: ltExpanded ? "visible" : "hidden",
                                display: ltExpanded ? "block" : "-webkit-box",
                                WebkitLineClamp: ltExpanded ? "unset" : 2,
                                WebkitBoxOrient:"vertical",
                              }}>{p.lighting_notes}</div>
                              {p.lighting_notes.length > 80 && (
                                <button onClick={() => toggleLight(p.id)} style={{ fontSize:11, color:"#6a7fdb", background:"none", border:"none", cursor:"pointer", padding:"2px 0", fontWeight:600 }}>
                                  {ltExpanded ? "Show less ▲" : "View more ▼"}
                                </button>
                              )}
                            </div>
                          ) : <span style={{ fontSize:11, color:"var(--border)" }}>—</span>}
                        </td>
                        {/* Sticky actions */}
                        <td style={{
                          padding:"10px 8px", position:"sticky", right:0, background: rowBg,
                          boxShadow:"-2px 0 6px rgba(0,0,0,.06)", zIndex:2,
                        }}>
                          <div style={{ display:"flex", gap:4, alignItems:"center", justifyContent:"center" }}>
                            {/* Edit icon */}
                            <button onClick={() => openEditProg(p)} title="Edit" style={{
                              width:30, height:30, borderRadius:7, display:"flex", alignItems:"center", justifyContent:"center",
                              border:"1px solid var(--border)", background:"none", cursor:"pointer", color:"var(--muted)",
                            }}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                              </svg>
                            </button>
                            {/* Delete icon */}
                            <button onClick={() => { if(window.confirm("Remove this number?")) deleteProg(p.id); }} title="Remove" style={{
                              width:30, height:30, borderRadius:7, display:"flex", alignItems:"center", justifyContent:"center",
                              border:"1px solid #fecaca", background:"none", cursor:"pointer", color:"#e05c6a",
                            }}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                                <path d="M10 11v6"/><path d="M14 11v6"/>
                                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Add / Edit program number modal */}
            {progModal !== null && (
              <Modal title={progModal?.id ? "Edit Number" : "Add Number"} onClose={() => setProgModal(null)}>
                <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                    <Field label="Time"><Input value={progForm.time} onChange={e => setProgForm(p=>({...p,time:e.target.value}))} placeholder="e.g. 6:30 PM" /></Field>
                    <Field label="Duration"><Input value={progForm.duration} onChange={e => setProgForm(p=>({...p,duration:e.target.value}))} placeholder="e.g. 8 min" /></Field>
                  </div>
                  <Field label="Title *"><Input value={progForm.title} onChange={e => setProgForm(p=>({...p,title:e.target.value}))} placeholder="e.g. Ballet Fundamentals – Swan Lake" required /></Field>
                  <Field label="Performers"><Input value={progForm.performers} onChange={e => setProgForm(p=>({...p,performers:e.target.value}))} placeholder="e.g. Beginner Ballet Class" /></Field>

                  {/* Music section */}
                  <Field label="Music">
                    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                      {progForm.music_data ? (
                        <div style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px", borderRadius:8, background:"var(--surface)", border:"1px solid var(--border)" }}>
                          <span style={{ fontSize:12, flex:1, fontWeight:600, color:"#333" }}>🎵 {progForm.music_name}</span>
                          <button onClick={() => setProgForm(p=>({...p,music_data:"",music_name:""}))} style={{
                            fontSize:11, color:"#e05c6a", background:"none", border:"1px solid #fecaca",
                            borderRadius:6, padding:"3px 8px", cursor:"pointer",
                          }}>Remove</button>
                        </div>
                      ) : (
                        <label style={{
                          display:"flex", alignItems:"center", gap:8, padding:"10px 14px",
                          borderRadius:8, border:"1.5px dashed var(--border)", cursor:"pointer",
                          fontSize:12, color:"var(--muted)", background:"var(--surface)",
                        }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                          Upload audio file (MP3, WAV — max 10 MB)
                          <input type="file" accept="audio/*" style={{ display:"none" }} onChange={handleMusicUpload} />
                        </label>
                      )}
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <div style={{ flex:1, height:1, background:"var(--border)" }}/>
                        <span style={{ fontSize:11, color:"var(--muted)" }}>or paste a URL</span>
                        <div style={{ flex:1, height:1, background:"var(--border)" }}/>
                      </div>
                      <Input value={progForm.music_url} onChange={e => setProgForm(p=>({...p,music_url:e.target.value,music_data:"",music_name:""}))}
                        placeholder="https://drive.google.com/... or SoundCloud link" disabled={!!progForm.music_data} />
                    </div>
                  </Field>

                  <Field label="MC Notes">
                    <Textarea rows={3} value={progForm.mc_notes} onChange={e => setProgForm(p=>({...p,mc_notes:e.target.value}))}
                      placeholder="Script lines, introduction text, or cues for the MC…" />
                  </Field>
                  <Field label="Lighting Notes / Cues">
                    <Textarea rows={3} value={progForm.lighting_notes} onChange={e => setProgForm(p=>({...p,lighting_notes:e.target.value}))}
                      placeholder="e.g. Spotlight center stage, fade to blue at 0:45, follow spot on lead…" />
                  </Field>
                </div>
                <div style={{ display:"flex", justifyContent:"flex-end", gap:8, marginTop:20 }}>
                  <Button variant="outline" onClick={() => setProgModal(null)}>Cancel</Button>
                  <Button onClick={saveProg}>{progModal?.id ? "Save Changes" : "Add Number"}</Button>
                </div>
              </Modal>
            )}
          </div>
        )}

        {/* ── PARENT VOLUNTEERS ── */}
        {tab === "volunteers" && (
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
              <SectionHead title="Parent Volunteers" sub="Volunteer coordinators and helpers for the event" />
              <Button icon="➕" size="sm" onClick={openAddVolunteer}>Add Volunteer</Button>
            </div>

            {/* ── Sign Up Genius integration banner ── */}
            <div style={{
              borderRadius:12, border:"1.5px solid #e8e2ff",
              background:"linear-gradient(135deg, #f5f2ff 0%, #fff 100%)",
              padding:"18px 20px", marginBottom:22,
            }}>
              <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom: sugUrl && !editingUrl ? 14 : 10 }}>
                {/* Sign Up Genius logo mark */}
                <div style={{
                  width:38, height:38, borderRadius:10, flexShrink:0,
                  background:"linear-gradient(135deg, #00a651, #007a3d)",
                  display:"flex", alignItems:"center", justifyContent:"center",
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <line x1="19" y1="8" x2="19" y2="14"/>
                    <line x1="22" y1="11" x2="16" y2="11"/>
                  </svg>
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:800, marginBottom:1 }}>Sign Up Genius</div>
                  <div style={{ fontSize:12, color:"var(--muted)" }}>
                    {sugUrl ? "Linked — volunteers can sign up directly" : "Paste your sign-up sheet URL to link it here"}
                  </div>
                </div>
                {sugUrl && !editingUrl && (
                  <button onClick={() => setEditingUrl(true)} style={{
                    fontSize:11, color:"var(--muted)", background:"none", border:"1px solid var(--border)",
                    borderRadius:7, padding:"4px 10px", cursor:"pointer", fontWeight:600,
                  }}>Edit link</button>
                )}
              </div>

              {/* URL saved — show open button */}
              {sugUrl && !editingUrl && (
                <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                  <a href={sugUrl} target="_blank" rel="noopener noreferrer" style={{
                    display:"inline-flex", alignItems:"center", gap:8,
                    padding:"10px 20px", borderRadius:10, textDecoration:"none",
                    background:"linear-gradient(135deg, #00a651, #007a3d)",
                    color:"#fff", fontSize:13, fontWeight:700,
                    boxShadow:"0 2px 8px rgba(0,166,81,.3)",
                    transition:"opacity .15s",
                  }}
                    onMouseEnter={e => e.currentTarget.style.opacity = ".88"}
                    onMouseLeave={e => e.currentTarget.style.opacity = "1"}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                      <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                    </svg>
                    Open Sign Up Sheet
                  </a>
                  <button onClick={clearSugUrl} style={{
                    fontSize:11, color:"#e05c6a", background:"none", border:"none",
                    cursor:"pointer", padding:"4px 6px", fontWeight:600,
                  }}>Remove</button>
                </div>
              )}

              {/* URL input — initial state or editing */}
              {(!sugUrl || editingUrl) && (
                <div style={{ display:"flex", gap:8 }}>
                  <input
                    value={sugInput}
                    onChange={e => setSugInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && saveSugUrl()}
                    placeholder="https://www.signupgenius.com/go/your-signup-link"
                    style={{
                      flex:1, padding:"9px 14px",
                      border:"1.5px solid #c9b8ff", borderRadius:9,
                      fontSize:13, background:"var(--card)",
                      color:"var(--text)", outline:"none", fontFamily:"inherit",
                    }}
                  />
                  <button onClick={saveSugUrl} style={{
                    padding:"9px 18px", borderRadius:9, border:"none", cursor:"pointer",
                    background:"#6a7fdb", color:"#fff", fontSize:13, fontWeight:700,
                    transition:"opacity .15s",
                  }}>Save</button>
                  {editingUrl && (
                    <button onClick={() => { setEditingUrl(false); setSugInput(sugUrl); }} style={{
                      padding:"9px 14px", borderRadius:9, border:"1px solid var(--border)",
                      background:"none", cursor:"pointer", fontSize:13, color:"var(--muted)",
                    }}>Cancel</button>
                  )}
                </div>
              )}
            </div>

            {/* Volunteer list */}
            {volunteers.length === 0 ? (
              <div style={{ textAlign:"center", padding:"40px 20px", background:"var(--surface)", borderRadius:12, border:"1.5px dashed var(--border)" }}>
                <div style={{ fontSize:28, marginBottom:10 }}>🙋</div>
                <p style={{ fontWeight:700, marginBottom:4, fontSize:14 }}>No volunteers yet</p>
                <p style={{ color:"var(--muted)", fontSize:12, marginBottom:16 }}>Add parent volunteers who will help coordinate and assist at the event.</p>
                <Button icon="➕" size="sm" onClick={openAddVolunteer}>Add First Volunteer</Button>
              </div>
            ) : (
              <div style={{ borderRadius:12, overflow:"hidden", border:"1px solid var(--border)" }}>
                {volunteers.map((v, i) => (
                  <div key={v.id} style={{
                    display:"flex", alignItems:"center", padding:"16px 20px", gap:14,
                    background: i % 2 === 0 ? "var(--card)" : "var(--surface)",
                    borderBottom: i < volunteers.length - 1 ? "1px solid var(--border)" : "none",
                  }}>
                    <div style={{
                      width:42, height:42, borderRadius:"50%", flexShrink:0,
                      background:`linear-gradient(135deg, hsl(${avatarHue(v.name)},55%,50%), hsl(${(avatarHue(v.name)+30)%360},55%,42%))`,
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontSize:14, fontWeight:800, color:"#fff", letterSpacing:".04em",
                    }}>{initials(v.name)}</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:700, fontSize:14, marginBottom:2 }}>{v.name}</div>
                      <div style={{ fontSize:12, color:"var(--muted)", marginBottom:1 }}>{v.role}</div>
                      <div style={{ fontSize:11, color:"var(--muted)", display:"flex", gap:10 }}>
                        <span>{v.email}</span>
                        <span>{v.phone}</span>
                      </div>
                    </div>
                    <span style={{
                      fontSize:11, padding:"5px 13px", borderRadius:20, fontWeight:700, flexShrink:0,
                      background: v.status === "Confirmed" ? "#52c4a020" : "#f4a04120",
                      color:      v.status === "Confirmed" ? "#52c4a0"   : "#f4a041",
                    }}>
                      {v.status === "Confirmed" ? "✓ " : "⏱ "}{v.status}
                    </span>
                    {/* Row actions */}
                    <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                      <button onClick={() => openEditVolunteer(v)} style={{
                        padding:"5px 10px", fontSize:11, border:"1px solid var(--border)",
                        borderRadius:7, background:"none", cursor:"pointer", color:"var(--muted)", fontWeight:600,
                      }}>Edit</button>
                      <button onClick={() => { if (window.confirm(`Remove ${v.name}?`)) deleteVolunteer(v.id); }} style={{
                        padding:"5px 10px", fontSize:11, border:"1px solid #fecaca",
                        borderRadius:7, background:"none", cursor:"pointer", color:"#e05c6a", fontWeight:600,
                      }}>Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add / Edit volunteer modal */}
            {volunteerModal !== null && (
              <Modal title={volunteerModal?.id ? "Edit Volunteer" : "Add Volunteer"} onClose={() => setVolunteerModal(null)}>
                <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                  {[
                    { label:"Name", field:"name", placeholder:"Parent name" },
                    { label:"Role / Task", field:"role", placeholder:"e.g. Ticket table, Backstage helper" },
                    { label:"Email", field:"email", placeholder:"email@example.com" },
                    { label:"Phone", field:"phone", placeholder:"(555) 000-0000" },
                  ].map(({ label, field, placeholder }) => (
                    <div key={field}>
                      <label style={{ fontSize:12, fontWeight:700, display:"block", marginBottom:5, color:"var(--muted)" }}>{label}</label>
                      <input
                        value={volunteerForm[field] || ""}
                        onChange={e => setVolunteerForm(f => ({ ...f, [field]: e.target.value }))}
                        placeholder={placeholder}
                        style={{
                          width:"100%", boxSizing:"border-box", padding:"9px 13px",
                          border:"1.5px solid var(--border)", borderRadius:9,
                          fontSize:13, background:"var(--surface)", color:"var(--text)",
                          outline:"none", fontFamily:"inherit",
                        }}
                      />
                    </div>
                  ))}
                  <div>
                    <label style={{ fontSize:12, fontWeight:700, display:"block", marginBottom:5, color:"var(--muted)" }}>Status</label>
                    <select
                      value={volunteerForm.status || "Pending"}
                      onChange={e => setVolunteerForm(f => ({ ...f, status: e.target.value }))}
                      style={{
                        width:"100%", padding:"9px 13px", border:"1.5px solid var(--border)",
                        borderRadius:9, fontSize:13, background:"var(--surface)",
                        color:"var(--text)", outline:"none", fontFamily:"inherit",
                      }}
                    >
                      <option value="Pending">Pending</option>
                      <option value="Confirmed">Confirmed</option>
                    </select>
                  </div>
                  <div style={{ display:"flex", justifyContent:"flex-end", gap:8, marginTop:4 }}>
                    <Button variant="outline" onClick={() => setVolunteerModal(null)}>Cancel</Button>
                    <Button onClick={saveVolunteer}>{volunteerModal?.id ? "Save Changes" : "Add Volunteer"}</Button>
                  </div>
                </div>
              </Modal>
            )}
          </div>
        )}

        {/* ── VENDORS ── */}
        {tab === "vendors" && (
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
              <SectionHead title="Vendors" sub="Service providers and contractors for the event" />
              <Button icon="➕" size="sm" onClick={openAddVendor}>Add Vendor</Button>
            </div>

            {vendors.length === 0 ? (
              <div style={{ textAlign:"center", padding:"40px 20px", background:"var(--surface)", borderRadius:12, border:"1.5px dashed var(--border)" }}>
                <div style={{ fontSize:28, marginBottom:10 }}>🏢</div>
                <p style={{ fontWeight:700, marginBottom:4, fontSize:14 }}>No vendors yet</p>
                <p style={{ color:"var(--muted)", fontSize:12, marginBottom:16 }}>Add photographers, costume rental, lighting & sound vendors.</p>
                <Button icon="➕" size="sm" onClick={openAddVendor}>Add First Vendor</Button>
              </div>
            ) : (
              <div style={{ borderRadius:12, overflow:"hidden", border:"1px solid var(--border)" }}>
                {vendors.map((v, i) => (
                  <div key={v.id} style={{
                    display:"flex", alignItems:"center", padding:"14px 18px", gap:14,
                    background: i % 2 === 0 ? "var(--card)" : "var(--surface)",
                    borderBottom: i < vendors.length - 1 ? "1px solid var(--border)" : "none",
                  }}>
                    <div style={{
                      width:42, height:42, borderRadius:11, flexShrink:0,
                      background:"linear-gradient(135deg, #f4a041, #e05c6a)",
                      display:"flex", alignItems:"center", justifyContent:"center",
                    }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="7" width="20" height="14" rx="2"/>
                        <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
                      </svg>
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:700, fontSize:14, marginBottom:2 }}>{v.name}</div>
                      <div style={{ fontSize:12, color:"var(--muted)", marginBottom:1 }}>{v.service}</div>
                      {(v.contact || v.phone) && (
                        <div style={{ fontSize:11, color:"var(--muted)" }}>
                          {v.contact && `Contact: ${v.contact}`}{v.contact && v.phone && " · "}{v.phone}
                        </div>
                      )}
                    </div>
                    <span style={{
                      fontSize:11, padding:"5px 13px", borderRadius:20, fontWeight:700, flexShrink:0,
                      background: v.status === "Confirmed" ? "#52c4a020" : "#f4a04120",
                      color:      v.status === "Confirmed" ? "#52c4a0"   : "#f4a041",
                    }}>
                      {v.status === "Confirmed" ? "✓ " : "⏱ "}{v.status}
                    </span>
                    {/* Row actions */}
                    <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                      <button onClick={() => openEditVendor(v)} style={{
                        padding:"5px 10px", fontSize:11, border:"1px solid var(--border)",
                        borderRadius:7, background:"none", cursor:"pointer", color:"var(--muted)", fontWeight:600,
                      }}>Edit</button>
                      <button onClick={() => { if (window.confirm(`Remove ${v.name}?`)) deleteVendor(v.id); }} style={{
                        padding:"5px 10px", fontSize:11, border:"1px solid #fecaca",
                        borderRadius:7, background:"none", cursor:"pointer", color:"#e05c6a", fontWeight:600,
                      }}>Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add / Edit vendor modal */}
            {vendorModal !== null && (
              <Modal title={vendorModal?.id ? "Edit Vendor" : "Add Vendor"} onClose={() => setVendorModal(null)}>
                <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                  <Field label="Vendor / Company Name">
                    <Input value={vendorForm.name} onChange={e => setVendorForm(p => ({ ...p, name:e.target.value }))} placeholder="e.g. Spotlight Productions" required />
                  </Field>
                  <Field label="Service Type">
                    <Input value={vendorForm.service} onChange={e => setVendorForm(p => ({ ...p, service:e.target.value }))} placeholder="e.g. Lighting & Sound" />
                  </Field>
                  <Field label="Contact Person">
                    <Input value={vendorForm.contact} onChange={e => setVendorForm(p => ({ ...p, contact:e.target.value }))} placeholder="e.g. John Davis" />
                  </Field>
                  <Field label="Phone">
                    <Input value={vendorForm.phone} onChange={e => setVendorForm(p => ({ ...p, phone:e.target.value }))} placeholder="(555) 000-0000" />
                  </Field>
                  <Field label="Status">
                    <Select value={vendorForm.status} onChange={e => setVendorForm(p => ({ ...p, status:e.target.value }))}>
                      <option>Pending</option>
                      <option>Confirmed</option>
                    </Select>
                  </Field>
                </div>
                <div style={{ display:"flex", justifyContent:"flex-end", gap:8, marginTop:20 }}>
                  <Button variant="outline" onClick={() => setVendorModal(null)}>Cancel</Button>
                  <Button onClick={saveVendor}>{vendorModal?.id ? "Save Changes" : "Add Vendor"}</Button>
                </div>
              </Modal>
            )}
          </div>
        )}

        {/* ── TASKS ── */}
        {tab === "tasks" && (
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
              <SectionHead title="Tasks & Checklist" sub="Event preparation tasks and deadlines" />
              {tasks.length > 0 && (
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ width:80, height:6, borderRadius:3, background:"var(--border)", overflow:"hidden" }}>
                    <div style={{ height:"100%", width:pct+"%", background:color, borderRadius:3, transition:"width .3s" }} />
                  </div>
                  <span style={{ fontSize:12, color:"var(--muted)", fontWeight:600 }}>{done}/{tasks.length} done</span>
                </div>
              )}
            </div>

            {tasks.length === 0 ? (
              <p style={{ fontSize:13, color:"var(--muted)", marginBottom:20 }}>No tasks yet. Add the first one below.</p>
            ) : (
              <div style={{ borderRadius:12, overflow:"hidden", border:"1px solid var(--border)", marginBottom:16 }}>
                {tasks.map((t, i) => (
                  <div key={t.id}
                    onClick={() => toggleTask(t.id, t.is_done)}
                    style={{
                      display:"flex", alignItems:"center", padding:"14px 20px", gap:14,
                      background: t.is_done ? "var(--surface)" : "var(--card)",
                      borderBottom: i < tasks.length - 1 ? "1px solid var(--border)" : "none",
                      cursor:"pointer", transition:"background .1s",
                    }}>
                    {/* Checkbox */}
                    <div style={{
                      width:22, height:22, borderRadius:"50%", flexShrink:0,
                      border: t.is_done ? "none" : "2px solid var(--border)",
                      background: t.is_done ? color : "transparent",
                      display:"flex", alignItems:"center", justifyContent:"center",
                      transition:"all .15s",
                    }}>
                      {t.is_done && <CheckIcon />}
                    </div>
                    <span style={{
                      fontSize:14, flex:1,
                      textDecoration: t.is_done ? "line-through" : "none",
                      color: t.is_done ? "var(--muted)" : "var(--text)",
                    }}>{t.task_text || t.task || t.title || ""}</span>
                    <span style={{
                      fontSize:11, padding:"4px 12px", borderRadius:20, fontWeight:700, flexShrink:0,
                      background: t.is_done ? "#52c4a020" : "var(--border)",
                      color:      t.is_done ? "#52c4a0"   : "var(--muted)",
                    }}>{t.is_done ? "Completed" : "Pending"}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Add task input */}
            <div style={{ display:"flex", gap:8 }}>
              <input
                value={newTask}
                onChange={e => setNewTask(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addTask()}
                placeholder="Add a new task… (press Enter)"
                style={{
                  flex:1, padding:"10px 16px",
                  border:"1.5px solid var(--border)", borderRadius:10,
                  fontSize:13, background:"var(--surface)",
                  color:"var(--text)", outline:"none",
                  fontFamily:"inherit",
                }}
              />
              <Button onClick={addTask} icon="➕">Add Task</Button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Recitals List Page
// ─────────────────────────────────────────────────────────────────────────────
export default function RecitalsPage() {
  const { user } = useAuth();
  const sid = user?.school_id;
  const qc  = useQueryClient();

  const [view,    setView]    = useState("grid");
  const [modal,   setModal]   = useState(null);
  const [form,    setForm]    = useState(EMPTY);
  const [detailId, setDetailId] = useState(null);   // ← full-page detail

  const location = useLocation();

  const { data: recitals=[], isLoading } = useQuery({
    queryKey: ["recitals", sid],
    queryFn: () => api.list(sid),
    enabled: !!sid,
  });

  const saveMutation = useMutation({
    mutationFn: data => modal?.id ? api.update(sid, modal.id, data) : api.create(sid, data),
    onSuccess: () => {
      qc.invalidateQueries(["recitals", sid]);
      toast.success(modal?.id ? "Event updated" : "Event created");
      setModal(null);
    },
    onError: err => toast.error(err.error || "Failed to save"),
  });

  const deleteMutation = useMutation({
    mutationFn: id => api.remove(sid, id),
    onSuccess: (_, id) => {
      qc.invalidateQueries(["recitals", sid]);
      toast.success("Event deleted");
      if (detailId === id) setDetailId(null);
    },
    onError: err => toast.error(err.error || "Failed to delete"),
  });

  const openAdd  = () => { setForm({ ...EMPTY }); setModal({}); };
  const openEdit = (r) => {
    setForm({ title:r.title||"", event_date:r.event_date?.split("T")[0]||"", venue:r.venue||"", status:r.status||"Planning", description:r.description||"" });
    setModal(r);
  };

  // Sort by date string (slice to YYYY-MM-DD to handle ISO suffix from mysql2)
  const sorted = [...recitals].sort((a, b) => (b.event_date||'').slice(0,10).localeCompare((a.event_date||'').slice(0,10)));

  // ── Auto-open a specific recital when navigated here from another page ──────
  // e.g. clicking a "Recital" event on HomePage or SchedulePage navigates with
  // { state: { openTitle: "Pranathi Annual Recital" } }
  useEffect(() => {
    const openTitle = location.state?.openTitle;
    if (!openTitle || recitals.length === 0 || detailId) return;
    const match = recitals.find(
      r => r.title?.toLowerCase().trim() === openTitle.toLowerCase().trim()
    );
    if (match) setDetailId(match.id);
  }, [recitals, location.state?.openTitle]); // eslint-disable-line

  // ── Show full-page detail when detailId is set ─────────────────────────────
  if (detailId) {
    return (
      <RecitalDetail
        id={detailId}
        sid={sid}
        onBack={() => setDetailId(null)}
        onEdit={(r) => { openEdit(r); }}
      />
    );
  }

  // ── List / Grid view ───────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20, flexWrap:"wrap", gap:10 }}>
        <div>
          <h1 style={{ fontFamily:"var(--font-d)", fontSize:24, marginBottom:2 }}>Recitals & Events</h1>
          <p style={{ color:"var(--muted)", fontSize:12 }}>{recitals.length} events</p>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <div style={{ display:"flex", border:"1.5px solid var(--border)", borderRadius:9, overflow:"hidden" }}>
            <button onClick={() => setView("grid")} style={{
              padding:"7px 13px", border:"none", cursor:"pointer", fontSize:16, lineHeight:1, transition:"all .15s",
              background:view==="grid" ? "var(--accent)" : "transparent",
              color:view==="grid" ? "#fff" : "var(--muted)",
            }}>⊞</button>
            <button onClick={() => setView("table")} style={{
              padding:"7px 13px", border:"none", borderLeft:"1.5px solid var(--border)", cursor:"pointer", fontSize:16, lineHeight:1, transition:"all .15s",
              background:view==="table" ? "var(--accent)" : "transparent",
              color:view==="table" ? "#fff" : "var(--muted)",
            }}>☰</button>
          </div>
          <Button onClick={openAdd} icon="➕">New Event</Button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <p style={{ color:"var(--muted)" }}>Loading…</p>

      ) : sorted.length === 0 ? (
        <div style={{ textAlign:"center", padding:48, background:"var(--card)", borderRadius:16, border:"1.5px dashed var(--border)" }}>
          <div style={{ fontSize:34, marginBottom:12 }}>🌟</div>
          <p style={{ fontWeight:700, marginBottom:4 }}>No events yet</p>
          <p style={{ color:"var(--muted)", fontSize:13, marginBottom:16 }}>Plan your first recital or performance!</p>
          <Button onClick={openAdd}>New Event</Button>
        </div>

      ) : view === "grid" ? (
        /* Grid cards */
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(280px, 1fr))", gap:12 }}>
          {sorted.map(r => {
            const color = STATUS_COLORS[r.status] || "#888";
            const [ryr, rmo, rdy] = (r.event_date||'').slice(0,10).split('-').map(Number);
            const d     = (ryr && rmo && rdy) ? new Date(ryr, rmo - 1, rdy) : new Date(NaN);
            const pct   = r.task_count ? Math.round(((r.tasks_done || 0) / r.task_count) * 100) : 0;
            return (
              <div key={r.id} onClick={() => setDetailId(r.id)} style={{
                background:"var(--card)", borderRadius:14, cursor:"pointer", overflow:"hidden",
                border:"1.5px solid var(--border)",
                boxShadow:"0 1px 4px rgba(0,0,0,.05)",
                transition:"all .15s",
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.boxShadow = `0 4px 16px ${color}22`; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,.05)"; }}
              >
                <div style={{ height:4, background:color }} />
                <div style={{ padding:"14px 16px 16px" }}>
                  <div style={{ display:"flex", alignItems:"flex-start", gap:12, marginBottom:10 }}>
                    <div style={{ textAlign:"center", minWidth:46, background:color+"20", borderRadius:10, padding:"7px 6px", flexShrink:0 }}>
                      <div style={{ fontSize:18, fontWeight:800, color, fontFamily:"var(--font-d)", lineHeight:1 }}>{d.getDate()}</div>
                      <div style={{ fontSize:9, color:"var(--muted)", textTransform:"uppercase", marginTop:2 }}>{d.toLocaleString("default", { month:"short", year:"2-digit" })}</div>
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontFamily:"var(--font-d)", fontWeight:800, fontSize:14, marginBottom:4, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.title}</div>
                      <span style={{ fontSize:10, background:color+"22", color, borderRadius:20, padding:"2px 8px", fontWeight:700 }}>{r.status}</span>
                    </div>
                  </div>
                  {r.venue && (
                    <div style={{ fontSize:11, color:"var(--muted)", marginBottom:8, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>📍 {r.venue}</div>
                  )}
                  {r.task_count > 0 && (
                    <div>
                      <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:"var(--muted)", marginBottom:4 }}>
                        <span>Checklist</span><span>{r.tasks_done || 0}/{r.task_count} done</span>
                      </div>
                      <div style={{ height:5, borderRadius:3, background:"var(--border)", overflow:"hidden" }}>
                        <div style={{ height:"100%", width:pct+"%", background:color, borderRadius:3, transition:"width .3s" }} />
                      </div>
                    </div>
                  )}
                  {/* Open detail hint */}
                  <div style={{ marginTop:12, fontSize:11, color:"var(--muted)", display:"flex", alignItems:"center", gap:4 }}>
                    <span>View details</span>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                    </svg>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

      ) : (
        /* Table view */
        <div style={{ background:"var(--card)", borderRadius:14, border:"1px solid var(--border)", overflow:"hidden" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ background:"var(--surface)" }}>
                {["Date","Event","Venue","Status","Tasks",""].map(h => (
                  <th key={h} style={{ padding:"11px 14px", textAlign:"left", fontSize:11, fontWeight:700, letterSpacing:".06em", textTransform:"uppercase", color:"var(--muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(r => {
                const color = STATUS_COLORS[r.status] || "#888";
                const [tyr, tmo, tdy] = (r.event_date||'').slice(0,10).split('-').map(Number);
                const d     = (tyr && tmo && tdy) ? new Date(tyr, tmo - 1, tdy) : new Date(NaN);
                const pct   = r.task_count ? Math.round(((r.tasks_done || 0) / r.task_count) * 100) : null;
                return (
                  <tr key={r.id} onClick={() => setDetailId(r.id)} style={{
                    borderTop:"1px solid var(--border)", cursor:"pointer",
                    transition:"background .1s",
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = color+"08"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <td style={{ padding:"10px 14px" }}>
                      <div style={{ textAlign:"center", width:36, background:color+"20", borderRadius:8, padding:"4px 3px" }}>
                        <div style={{ fontSize:13, fontWeight:800, color, lineHeight:1 }}>{d.getDate()}</div>
                        <div style={{ fontSize:8, color:"var(--muted)", textTransform:"uppercase" }}>{d.toLocaleString("default", { month:"short" })}</div>
                      </div>
                    </td>
                    <td style={{ padding:"10px 14px", fontWeight:700, fontSize:13, maxWidth:200, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.title}</td>
                    <td style={{ padding:"10px 14px", fontSize:12, color:"var(--muted)", maxWidth:160, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.venue || "—"}</td>
                    <td style={{ padding:"10px 14px" }}>
                      <span style={{ fontSize:11, background:color+"22", color, borderRadius:20, padding:"2px 9px", fontWeight:700 }}>{r.status}</span>
                    </td>
                    <td style={{ padding:"10px 14px", minWidth:120 }}>
                      {pct !== null ? (
                        <div>
                          <div style={{ fontSize:10, color:"var(--muted)", marginBottom:3 }}>{r.tasks_done || 0}/{r.task_count}</div>
                          <div style={{ height:5, borderRadius:3, background:"var(--border)", overflow:"hidden", width:80 }}>
                            <div style={{ height:"100%", width:pct+"%", background:color, borderRadius:3 }} />
                          </div>
                        </div>
                      ) : <span style={{ color:"var(--muted)", fontSize:12 }}>—</span>}
                    </td>
                    <td style={{ padding:"10px 14px" }}>
                      <div style={{ display:"flex", gap:5 }} onClick={e => e.stopPropagation()}>
                        <Button size="sm" variant="outline" onClick={() => openEdit(r)}>Edit</Button>
                        <Button size="sm" variant="danger" onClick={() => { if (window.confirm("Delete event?")) deleteMutation.mutate(r.id); }}>Del</Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Add/Edit Modal ── */}
      {modal !== null && (
        <Modal title={modal?.id ? "Edit Event" : "New Event"} onClose={() => setModal(null)}>
          <form onSubmit={e => { e.preventDefault(); saveMutation.mutate(form); }}>
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              <Field label="Event Title">
                <Input value={form.title} onChange={e => setForm(p => ({ ...p, title:e.target.value }))} required />
              </Field>
              <Field label="Date">
                <Input type="date" value={form.event_date} onChange={e => setForm(p => ({ ...p, event_date:e.target.value }))} required />
              </Field>
              <Field label="Venue / Location">
                <Input value={form.venue} onChange={e => setForm(p => ({ ...p, venue:e.target.value }))} placeholder="e.g. Main Theater" />
              </Field>
              <Field label="Status">
                <Select value={form.status} onChange={e => setForm(p => ({ ...p, status:e.target.value }))}>
                  {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
                </Select>
              </Field>
              <Field label="Description">
                <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description:e.target.value }))} rows={3} />
              </Field>
            </div>
            <div style={{ display:"flex", justifyContent:"flex-end", gap:8, marginTop:20 }}>
              <Button variant="outline" type="button" onClick={() => setModal(null)}>Cancel</Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Saving…" : modal?.id ? "Save Changes" : "Create Event"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
