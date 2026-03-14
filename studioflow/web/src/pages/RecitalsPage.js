import React, { useState, useEffect } from "react";
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
const DEMO_PROGRAM = [
  { id:1, time:"6:30 PM", duration:"5 min",  title:"Opening Number",                   group:"All Students" },
  { id:2, time:"6:35 PM", duration:"8 min",  title:"Beginner Ballet – 'Swan Lake'",    group:"Beginner Ballet Class" },
  { id:3, time:"6:43 PM", duration:"6 min",  title:"Jazz Basics – 'Uptown Funk'",      group:"Jazz Beginner Class" },
  { id:4, time:"6:49 PM", duration:"7 min",  title:"Hip Hop Groove – 'Street Beat'",   group:"Hip Hop Class" },
  { id:5, time:"6:56 PM", duration:"15 min", title:"Intermission",                     group:"—" },
  { id:6, time:"7:11 PM", duration:"9 min",  title:"Contemporary Flow – 'River'",      group:"Advanced Contemporary" },
  { id:7, time:"7:20 PM", duration:"6 min",  title:"Finale – Curtain Call",            group:"All Students" },
];
const DEMO_VOLUNTEERS = [
  { id:1, name:"Jennifer Smith", role:"Stage Manager",       email:"jennifer.s@email.com", phone:"(555) 234-5678", status:"Confirmed" },
  { id:2, name:"Michael Brown",  role:"Ticket Coordinator",  email:"michael.b@email.com",  phone:"(555) 345-6789", status:"Confirmed" },
  { id:3, name:"Sarah Johnson",  role:"Costume Assistant",   email:"sarah.j@email.com",    phone:"(555) 456-7890", status:"Pending" },
  { id:4, name:"David Lee",      role:"Usher Lead",          email:"david.l@email.com",    phone:"(555) 567-8901", status:"Confirmed" },
];
const DEMO_VENDORS = [
  { id:1, name:"Spotlight Productions",  service:"Lighting & Sound",  contact:"John Davis",    phone:"(555) 111-2222", status:"Confirmed" },
  { id:2, name:"Dance Elegance Costumes",service:"Costume Rentals",   contact:"Maria Garcia",  phone:"(555) 222-3333", status:"Confirmed" },
  { id:3, name:"Studio Photography",     service:"Event Photography", contact:"Alex Kim",      phone:"(555) 333-4444", status:"Pending" },
  { id:4, name:"Main Theater Venue",     service:"Venue Rental",      contact:"Robert Wilson", phone:"(555) 444-5555", status:"Confirmed" },
];

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
function RecitalDetail({ id, onBack, sid, onEdit }) {
  const [tab,         setTab]         = useState("overview");
  const [tasks,       setTasks]       = useState([]);
  const [newTask,     setNewTask]     = useState("");
  const [sugUrl,      setSugUrl]      = useState("");
  const [sugInput,    setSugInput]    = useState("");
  const [editingUrl,  setEditingUrl]  = useState(false);
  // Vendors state
  const [vendors,     setVendors]     = useState([]);
  const [vendorModal, setVendorModal] = useState(null); // null=closed, {}=new, {id,...}=edit
  const EMPTY_VENDOR = { name:"", service:"", contact:"", phone:"", status:"Pending" };
  const [vendorForm,  setVendorForm]  = useState(EMPTY_VENDOR);
  const qc = useQueryClient();

  // Persist Sign Up Genius URL in localStorage per recital
  const SUG_KEY     = `sug_url_${id}`;
  const VENDORS_KEY = `vendors_${id}`;

  useEffect(() => {
    const saved = localStorage.getItem(SUG_KEY);
    if (saved) { setSugUrl(saved); setSugInput(saved); }
    const savedVendors = localStorage.getItem(VENDORS_KEY);
    if (savedVendors) {
      try { setVendors(JSON.parse(savedVendors)); } catch {}
    } else {
      // Seed demo vendors on first open
      setVendors(DEMO_VENDORS);
      localStorage.setItem(VENDORS_KEY, JSON.stringify(DEMO_VENDORS));
    }
  }, [SUG_KEY, VENDORS_KEY]);

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
  const d       = new Date(recital.event_date);
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

      {/* ── Event header ──────────────────────────────────────────────── */}
      <div style={{ marginBottom:26 }}>
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:16, flexWrap:"wrap" }}>
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
          <button onClick={() => onEdit(recital)} style={{
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

        {/* Metadata strip */}
        <div style={{
          display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:0,
          background:"var(--border)", borderRadius:14, overflow:"hidden",
          border:"1px solid var(--border)", marginTop:22,
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
          <div>
            <SectionHead title="Event Overview" sub="General information and description" />

            {recital.description && (
              <>
                <h3 style={{ fontSize:15, fontWeight:700, margin:"0 0 8px" }}>Description</h3>
                <p style={{ color:"var(--muted)", fontSize:14, lineHeight:1.75, margin:"0 0 28px" }}>{recital.description}</p>
              </>
            )}

            <h3 style={{ fontSize:15, fontWeight:700, margin:"0 0 12px" }}>Important Information</h3>
            <ul style={{ margin:"0 0 32px", padding:"0 0 0 18px", display:"flex", flexDirection:"column", gap:9 }}>
              {[
                "Doors open 30 minutes before showtime",
                "Students must arrive 1 hour early for costume and makeup",
                "Photography and videography by approved vendors only during performance",
                "Reserved seating for family members (2 tickets per student)",
                "Reception to follow in the lobby",
              ].map(item => (
                <li key={item} style={{ fontSize:13, color:"var(--muted)", lineHeight:1.5 }}>{item}</li>
              ))}
            </ul>

            <h3 style={{ fontSize:15, fontWeight:700, margin:"0 0 16px" }}>Event Stats</h3>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:12 }}>
              {[
                { value:"45",  label:"Performers",   color:"#6a7fdb" },
                { value: String(DEMO_PROGRAM.filter(p=>p.title!=="Intermission" && p.title!=="Finale – Curtain Call").length), label:"Performances", color:"#5b8fff" },
                { value: String(DEMO_VOLUNTEERS.length), label:"Volunteers",   color:"#52c4a0" },
                { value: String(DEMO_VENDORS.length),    label:"Vendors",      color:"#f4a041" },
              ].map(s => (
                <div key={s.label} style={{
                  background:s.color+"14", borderRadius:14, padding:"22px 18px", textAlign:"center",
                }}>
                  <div style={{ fontSize:34, fontWeight:900, color:s.color, fontFamily:"var(--font-d)", lineHeight:1, marginBottom:8 }}>{s.value}</div>
                  <div style={{ fontSize:12, color:"var(--muted)", fontWeight:600, letterSpacing:".04em" }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── PROGRAM SCHEDULE ── */}
        {tab === "program" && (
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
              <SectionHead title="Program Schedule" sub="Performance timeline and running order" />
              <Button icon="➕" size="sm">Add Number</Button>
            </div>
            <div style={{ borderRadius:12, overflow:"hidden", border:"1px solid var(--border)" }}>
              {DEMO_PROGRAM.map((p, i) => (
                <div key={p.id} style={{
                  display:"flex", alignItems:"stretch",
                  background: i % 2 === 0 ? "var(--card)" : "var(--surface)",
                  borderBottom: i < DEMO_PROGRAM.length - 1 ? "1px solid var(--border)" : "none",
                }}>
                  <div style={{ width:110, padding:"16px 18px", flexShrink:0, borderRight:"1px solid var(--border)" }}>
                    <div style={{ fontSize:13, fontWeight:800, color:"#6a7fdb" }}>{p.time}</div>
                    <div style={{ fontSize:11, color:"var(--muted)", marginTop:3 }}>{p.duration}</div>
                  </div>
                  <div style={{ flex:1, padding:"16px 20px", display:"flex", alignItems:"center" }}>
                    <div>
                      <div style={{ fontSize:14, fontWeight:700, marginBottom:2 }}>{p.title}</div>
                      <div style={{ fontSize:12, color:"var(--muted)" }}>{p.group}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── PARENT VOLUNTEERS ── */}
        {tab === "volunteers" && (
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
              <SectionHead title="Parent Volunteers" sub="Volunteer coordinators and helpers for the event" />
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
                      fontSize:13, background:"#fff",
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
            <div style={{ borderRadius:12, overflow:"hidden", border:"1px solid var(--border)" }}>
              {DEMO_VOLUNTEERS.map((v, i) => (
                <div key={v.id} style={{
                  display:"flex", alignItems:"center", padding:"16px 20px", gap:14,
                  background: i % 2 === 0 ? "var(--card)" : "var(--surface)",
                  borderBottom: i < DEMO_VOLUNTEERS.length - 1 ? "1px solid var(--border)" : "none",
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
                </div>
              ))}
            </div>
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

  const sorted = [...recitals].sort((a, b) => new Date(b.event_date) - new Date(a.event_date));

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
            const d     = new Date(r.event_date);
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
                const d     = new Date(r.event_date);
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
