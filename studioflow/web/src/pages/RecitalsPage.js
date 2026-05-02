import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { recitals as api, todos as todosApi } from "../api";
import toast from "react-hot-toast";
import Card from "../components/shared/Card";
import Button from "../components/shared/Button";
import Modal from "../components/shared/Modal";
import { Field, Input, Select, Textarea } from "../components/shared/Field";
import SvgIcon from "../components/shared/SvgIcon";

const RECITAL_COLOR = "#6a7fdb";
const EMPTY = { title:"", event_date:"", event_time:"18:00", venue:"", description:"" };

// ── Time options: 15-min increments for recital forms ────────────────────────
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
  if (/[ap]m/i.test(t)) return t; // already formatted legacy string
  const [h, m] = t.split(':').map(Number);
  if (isNaN(h)) return t;
  return new Date(2000, 0, 1, h, m || 0).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
}

// ── Image compression helper ──────────────────────────────────────────────────
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const maxW = 900;
      const scale = img.width > maxW ? maxW / img.width : 1;
      const canvas = document.createElement('canvas');
      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = reject;
    img.src = url;
  });
}

// ── Cover crop modal ─────────────────────────────────────────────────────────
// Zero-dependency canvas cropper. Enforces 4:3 → saves at 800×600, 78% JPEG.
function CoverCropModal({ file, onConfirm, onCancel }) {
  const canvasRef = useRef(null);
  const imgRef    = useRef(null);
  const stRef     = useRef({ scale:1, ox:0, oy:0, dragging:false, lastX:0, lastY:0, lastDist:0 });
  const [ready,  setReady]  = useState(false);
  const [saving, setSaving] = useState(false);
  const isMob = typeof window !== 'undefined' && window.innerWidth < 768;

  // Canvas / crop window dimensions
  const CW    = isMob ? Math.min(window.innerWidth - 0, 420) : 540;
  const CH    = Math.round(CW * 0.84);
  const PAD   = isMob ? 12 : 20;
  const CROPW = CW - PAD * 2;
  const CROPH = Math.round(CROPW * 3 / 4);     // 4:3 ratio
  const CROPX = PAD;
  const CROPY = Math.round((CH - CROPH) / 2);

  const draw = () => {
    const canvas = canvasRef.current;
    const img    = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    const { scale, ox, oy } = stRef.current;
    ctx.clearRect(0, 0, CW, CH);
    ctx.drawImage(img, ox, oy, img.naturalWidth * scale, img.naturalHeight * scale);
    // Dim everything outside the crop window using 4 strips
    ctx.fillStyle = 'rgba(0,0,0,0.58)';
    ctx.fillRect(0, 0, CW, CROPY);
    ctx.fillRect(0, CROPY + CROPH, CW, CH - CROPY - CROPH);
    ctx.fillRect(0, CROPY, CROPX, CROPH);
    ctx.fillRect(CROPX + CROPW, CROPY, CW - CROPX - CROPW, CROPH);
    // Crop border
    ctx.strokeStyle = 'rgba(255,255,255,0.88)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(CROPX + 0.75, CROPY + 0.75, CROPW - 1.5, CROPH - 1.5);
    // Rule-of-thirds grid
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    [1, 2].forEach(n => {
      ctx.moveTo(CROPX + CROPW * n / 3, CROPY);
      ctx.lineTo(CROPX + CROPW * n / 3, CROPY + CROPH);
      ctx.moveTo(CROPX, CROPY + CROPH * n / 3);
      ctx.lineTo(CROPX + CROPW, CROPY + CROPH * n / 3);
    });
    ctx.stroke();
  };

  const clampOffset = (ox, oy, scale) => {
    const img = imgRef.current;
    if (!img) return { ox, oy };
    return {
      ox: Math.min(CROPX, Math.max(CROPX + CROPW - img.naturalWidth  * scale, ox)),
      oy: Math.min(CROPY, Math.max(CROPY + CROPH - img.naturalHeight * scale, oy)),
    };
  };

  const applyTransform = (newScale, newOx, newOy) => {
    const img = imgRef.current;
    if (!img) return;
    const minS = Math.max(CROPW / img.naturalWidth, CROPH / img.naturalHeight);
    const s    = Math.min(Math.max(newScale, minS), minS * 5);
    const { ox, oy } = clampOffset(newOx, newOy, s);
    Object.assign(stRef.current, { scale: s, ox, oy });
    draw();
  };

  // Load image from File object
  useEffect(() => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      URL.revokeObjectURL(url);
      // Auto-scale to fill crop window (objectFit:cover equivalent)
      const minS = Math.max(CROPW / img.naturalWidth, CROPH / img.naturalHeight);
      const ox   = CROPX + (CROPW - img.naturalWidth  * minS) / 2;
      const oy   = CROPY + (CROPH - img.naturalHeight * minS) / 2;
      Object.assign(stRef.current, { scale: minS, ox, oy });
      setReady(true);
      requestAnimationFrame(draw);
    };
    img.onerror = () => { URL.revokeObjectURL(url); onCancel(); };
    img.src = url;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Mouse — desktop
  const onMD = e => { stRef.current.dragging = true; stRef.current.lastX = e.clientX; stRef.current.lastY = e.clientY; };
  const onMM = e => {
    if (!stRef.current.dragging) return;
    const { lastX, lastY, scale, ox, oy } = stRef.current;
    stRef.current.lastX = e.clientX; stRef.current.lastY = e.clientY;
    applyTransform(scale, ox + e.clientX - lastX, oy + e.clientY - lastY);
  };
  const onMU = () => { stRef.current.dragging = false; };
  const onWheel = e => {
    e.preventDefault();
    const f    = e.deltaY > 0 ? 0.92 : 1.09;
    const ns   = stRef.current.scale * f;
    const rect = canvasRef.current.getBoundingClientRect();
    const mx   = e.clientX - rect.left;
    const my   = e.clientY - rect.top;
    applyTransform(ns,
      mx - (mx - stRef.current.ox) * (ns / stRef.current.scale),
      my - (my - stRef.current.oy) * (ns / stRef.current.scale),
    );
  };

  // Touch — mobile
  const onTS = e => {
    if (e.touches.length === 1) {
      stRef.current.dragging = true;
      stRef.current.lastX = e.touches[0].clientX;
      stRef.current.lastY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      stRef.current.dragging = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      stRef.current.lastDist = Math.sqrt(dx * dx + dy * dy);
    }
  };
  const onTM = e => {
    e.preventDefault();
    const { scale, ox, oy, lastX, lastY } = stRef.current;
    if (e.touches.length === 1 && stRef.current.dragging) {
      stRef.current.lastX = e.touches[0].clientX;
      stRef.current.lastY = e.touches[0].clientY;
      applyTransform(scale, ox + e.touches[0].clientX - lastX, oy + e.touches[0].clientY - lastY);
    } else if (e.touches.length === 2) {
      const dx   = e.touches[0].clientX - e.touches[1].clientX;
      const dy   = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const f    = dist / stRef.current.lastDist;
      stRef.current.lastDist = dist;
      const rect = canvasRef.current.getBoundingClientRect();
      const mx   = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
      const my   = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
      const ns   = scale * f;
      applyTransform(ns,
        mx - (mx - ox) * (ns / scale),
        my - (my - oy) * (ns / scale),
      );
    }
  };
  const onTE = () => { stRef.current.dragging = false; };

  const handleConfirm = () => {
    const img = imgRef.current;
    if (!img) return;
    setSaving(true);
    const { scale, ox, oy } = stRef.current;
    const srcX = (CROPX - ox) / scale;
    const srcY = (CROPY - oy) / scale;
    const srcW = CROPW / scale;
    const srcH = CROPH / scale;
    const out  = document.createElement('canvas');
    out.width  = 800;
    out.height = 600;   // 4:3 at target resolution
    out.getContext('2d').drawImage(img, srcX, srcY, srcW, srcH, 0, 0, 800, 600);
    onConfirm(out.toDataURL('image/jpeg', 0.78));
  };

  return (
    <div style={{ position:'fixed', inset:0, zIndex:3000, background:'#0c0c0c', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
      {/* Header */}
      <div style={{ width: isMob ? '100%' : CW, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 20px', boxSizing:'border-box', flexShrink:0 }}>
        <div>
          <div style={{ color:'#fff', fontWeight:700, fontSize:15 }}>Set Cover Photo</div>
          <div style={{ color:'rgba(255,255,255,0.45)', fontSize:11, marginTop:2 }}>
            {isMob ? 'Drag to reposition · Pinch to zoom' : 'Drag to reposition · Scroll to zoom'}
          </div>
        </div>
        <button onClick={onCancel} style={{ background:'rgba(255,255,255,0.1)', border:'none', borderRadius:'50%', width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center', color:'rgba(255,255,255,0.7)', cursor:'pointer', fontSize:18, lineHeight:1, flexShrink:0 }}>✕</button>
      </div>

      {/* Canvas */}
      {!ready && <div style={{ color:'rgba(255,255,255,0.35)', fontSize:13, padding:60 }}>Loading image…</div>}
      <canvas
        ref={canvasRef}
        width={CW} height={CH}
        style={{ display: ready ? 'block' : 'none', cursor:'grab', touchAction:'none', borderRadius: isMob ? 0 : 12, flexShrink:0 }}
        onMouseDown={onMD} onMouseMove={onMM} onMouseUp={onMU} onMouseLeave={onMU}
        onWheel={onWheel}
        onTouchStart={onTS} onTouchMove={onTM} onTouchEnd={onTE}
      />

      {/* 4:3 badge */}
      {ready && (
        <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:10 }}>
          <span style={{ background:'rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.55)', fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:20, letterSpacing:'.06em' }}>4 : 3</span>
          <span style={{ color:'rgba(255,255,255,0.35)', fontSize:10 }}>800 × 600 px</span>
        </div>
      )}

      {/* Actions */}
      <div style={{ display:'flex', gap:10, marginTop:16, paddingBottom:'max(20px, env(safe-area-inset-bottom))', flexShrink:0 }}>
        <button onClick={onCancel} style={{ padding:'10px 22px', background:'rgba(255,255,255,0.1)', border:'none', borderRadius:9, color:'#fff', fontSize:14, fontWeight:600, cursor:'pointer' }}>
          Cancel
        </button>
        <button onClick={handleConfirm} disabled={!ready || saving}
          style={{ padding:'10px 28px', background:'#7C3AED', border:'none', borderRadius:9, color:'#fff', fontSize:14, fontWeight:700, cursor: ready && !saving ? 'pointer' : 'not-allowed', opacity: ready && !saving ? 1 : 0.6 }}>
          {saving ? 'Saving…' : 'Use this photo →'}
        </button>
      </div>
    </div>
  );
}

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

function useWindowWidth() {
  const [w, setW] = React.useState(() => typeof window !== 'undefined' ? window.innerWidth : 1024);
  React.useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return w;
}

// ─────────────────────────────────────────────────────────────────────────────
// Full-page Detail View
// ─────────────────────────────────────────────────────────────────────────────
export function RecitalDetail({ id, onBack, sid, onEdit, onDeleted, onDuplicated }) {
  const [tab,              setTab]          = useState("overview");
  const [newTask,          setNewTask]      = useState("");
  const [newTaskAssignedTo, setNewTaskAssignedTo] = useState("");
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
  const EMPTY_PROG = { time:"", duration:"", title:"", performers:"", music_url:"", mc_notes:"", lighting_notes:"" };
  const [programItems,   setProgramItems]   = useState([]);
  const [progModal,      setProgModal]      = useState(null); // null=closed, {}=new, {id,...}=edit
  const [progForm,       setProgForm]       = useState(EMPTY_PROG);
  const [expandedNotes,  setExpandedNotes]  = useState(new Set()); // MC notes expanded row ids
  const [expandedLight,  setExpandedLight]  = useState(new Set()); // Lighting notes expanded
  const dragItem     = useRef(null); // index being dragged
  const dragOverItem = useRef(null); // index being hovered over

  // Delete confirmation
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Capture event_date before deletion so we can navigate correctly after cache is cleared
  const eventDateRef = useRef(null);

  // Inline edit modal (meta + overview)
  const [editOpen,   setEditOpen]   = useState(false);
  const [editForm,   setEditForm]   = useState({});
  const [infoItems,  setInfoItems]  = useState([]); // Important Information bullet list
  const [newInfo,    setNewInfo]    = useState("");  // new bullet input

  // Cover photo — synced to DB via poster_url, local state for display
  const [poster,        setPoster]        = useState(null);
  const [posterHover,   setPosterHover]   = useState(false);
  const [posterSaving,  setPosterSaving]  = useState(false);
  const [cropFile,      setCropFile]      = useState(null);  // file pending crop
  // Instagram post as poster
  const [instaUrl,      setInstaUrl]      = useState("");    // saved IG post URL
  const [instaInput,    setInstaInput]    = useState("");    // live input
  const [showInstaForm, setShowInstaForm] = useState(false); // show URL form

  // Venue state
  const EMPTY_VENUE = { name:"", address:"", contact:"", phone:"", email:"", website:"", capacity:"", notes:"" };
  const [venueDetails,   setVenueDetails]   = useState(EMPTY_VENUE);
  const [venueConvo,     setVenueConvo]     = useState("");
  const [venueConfirmed, setVenueConfirmed] = useState(false);
  const [venueEditing,   setVenueEditing]   = useState(false);
  const [venueForm,      setVenueForm]      = useState(EMPTY_VENUE);

  // Inline metadata editing
  const [metaEditing,    setMetaEditing]    = useState(null); // null or field name: 'date', 'time', 'venue', 'participants'
  const [metaForm,       setMetaForm]       = useState({});
  const [metaSaving,     setMetaSaving]     = useState(false);

  // Participants state
  const [participants,   setParticipants]   = useState([]);
  const [participantModal, setParticipantModal] = useState(null); // null=closed, {}=new, {id,...}=edit
  const [participantForm, setParticipantForm] = useState({});
  const PARTICIPANTS_KEY = `participants_${id}`;

  // Overview section inline editing
  const [overviewEditing, setOverviewEditing] = useState(null); // 'description' or 'info' or null
  const [overviewForm,    setOverviewForm]    = useState({});
  const [newInfoInput,    setNewInfoInput]    = useState("");
  const [editingInfoIdx,  setEditingInfoIdx]  = useState(null); // for editing existing info item

  const windowWidth = useWindowWidth();
  const isMobile = windowWidth < 768;
  const qc = useQueryClient();

  // Persist Sign Up Genius URL in localStorage per recital
  const SUG_KEY        = `sug_url_${id}`;
  const VENDORS_KEY    = `vendors_${id}`;
  const VOLUNTEERS_KEY = `volunteers_${id}`;
  const PROGRAM_KEY    = `program_${id}`;
  const INFO_KEY       = `info_items_${id}`;
  const POSTER_KEY     = `poster_${id}`;
  const INSTA_KEY      = `insta_${id}`;
  const VENUE_KEY      = `venue_${id}`;
  const VENUE_CONVO_KEY = `venue_convo_${id}`;
  const VENUE_CONFIRMED_KEY = `venue_confirmed_${id}`;

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

    const savedInsta = localStorage.getItem(INSTA_KEY);
    if (savedInsta) { setInstaUrl(savedInsta); setInstaInput(savedInsta); }

    const savedVenue = localStorage.getItem(VENUE_KEY);
    if (savedVenue) { try { const v = JSON.parse(savedVenue); setVenueDetails(v); setVenueForm(v); } catch {} }

    const savedVenueConvo = localStorage.getItem(VENUE_CONVO_KEY);
    if (savedVenueConvo) setVenueConvo(savedVenueConvo);

    const savedVenueConfirmed = localStorage.getItem(VENUE_CONFIRMED_KEY);
    if (savedVenueConfirmed) setVenueConfirmed(savedVenueConfirmed === "true");
  }, [SUG_KEY, VENDORS_KEY, PROGRAM_KEY, INFO_KEY, INSTA_KEY, VENUE_KEY, VENUE_CONVO_KEY, VENUE_CONFIRMED_KEY]);

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
    onSuccess: (updated, variables) => {
      // Merge form values first (variables = editForm), then overlay server response.
      // This ensures fields like event_time are immediately visible even if the
      // API response doesn't echo every field back.
      qc.setQueryData(["recital-detail", sid, id], (old) => ({ ...old, ...variables, ...updated }));
      qc.invalidateQueries({ queryKey: ["recitals", sid] });
      toast.success("Event updated");
      setEditOpen(false);
    },
    onError: () => toast.error("Failed to save changes"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.remove(sid, id),
    onSuccess: () => {
      qc.setQueryData(["recitals", sid], old => Array.isArray(old) ? old.filter(r => r.id !== id) : old);
      qc.invalidateQueries({ queryKey: ["recitals", sid] });
      qc.invalidateQueries({ queryKey: ["events"], exact: false });
      toast.success("Recital deleted");
      if (onDeleted) onDeleted(eventDateRef.current);
      else onBack();
    },
    onError: () => toast.error("Failed to delete recital"),
  });

  const duplicateRecitalMutation = useMutation({
    mutationFn: () => api.create(sid, {
      title: recital.title + " (Copy)",
      event_date: (recital.event_date || '').slice(0, 10) || "",
      event_time: recital.event_time || "18:00",
      venue: recital.venue || "",
      description: recital.description || "",
      status: "Planning",
      is_featured: 0,
      participant_count: recital.participant_count ?? null,
    }),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ["recitals", sid] });
      toast.success("Recital duplicated!");
      if (onDuplicated && created?.id) onDuplicated(created.id);
    },
    onError: () => toast.error("Failed to duplicate recital"),
  });

  const openInlineEdit = () => {
    setEditForm({
      title:             recital?.title             || "",
      event_date:        recital?.event_date?.split("T")[0] || "",
      event_time:        recital?.event_time        || "18:00",
      venue:             recital?.venue             || "",
      description:       recital?.description       || "",
      status:            recital?.status            || "Planning",
      is_featured:       recital?.is_featured       ?? 0,
      participant_count: recital?.participant_count != null ? String(recital.participant_count) : "",
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

  const saveMetaField = async (field) => {
    try {
      setMetaSaving(true);
      const updates = {
        title: recital.title,
        event_date: field === 'date' ? (metaForm.date || null) : (recital.event_date||'').slice(0,10),
        event_time: field === 'time' ? (metaForm.time || null) : recital.event_time||'',
        venue: field === 'venue' ? (metaForm.venue || null) : recital.venue||'',
        status: recital.status||'Planning',
        description: recital.description||'',
        is_featured: recital.is_featured??0,
        participant_count: field === 'participants' ? (metaForm.participants ? Number(metaForm.participants) : null) : recital.participant_count??null,
      };
      await api.update(sid, id, updates);
      qc.invalidateQueries({ queryKey: ["recital-detail", sid, id] });
      setMetaEditing(null);
      setMetaForm({});
      toast.success(`${field} updated`);
    } catch {
      toast.error(`Failed to update ${field}`);
    } finally {
      setMetaSaving(false);
    }
  };

  // ── Cover photo helpers ───────────────────────────────────────────────────
  // Step 1: pick file → open crop modal
  const handlePosterUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("Image too large (max 10 MB)"); return; }
    e.target.value = "";
    setCropFile(file);
  };

  // Step 2: crop modal confirmed → save 800×600 4:3 dataUrl to DB
  const saveCoverPhoto = async (dataUrl) => {
    setInstaUrl(""); setInstaInput(""); setShowInstaForm(false);
    localStorage.removeItem(INSTA_KEY);
    try {
      setPosterSaving(true);
      await api.uploadPoster(sid, id, dataUrl);
      setPoster(dataUrl);
      qc.setQueryData(["recital-detail", sid, id], (old) => old ? { ...old, poster_url: dataUrl } : old);
      qc.setQueryData(["recitals", sid], (old) =>
        Array.isArray(old) ? old.map(r => r.id === Number(id) ? { ...r, poster_url: dataUrl } : r) : old
      );
      toast.success("Cover photo saved");
    } catch {
      toast.error("Failed to save cover photo");
    } finally {
      setPosterSaving(false);
    }
  };

  const removePoster = async () => {
    try {
      setPosterSaving(true);
      await api.uploadPoster(sid, id, '');
      setPoster(null);
      qc.setQueryData(["recital-detail", sid, id], (old) => old ? { ...old, poster_url: '' } : old);
      qc.setQueryData(["recitals", sid], (old) =>
        Array.isArray(old) ? old.map(r => r.id === Number(id) ? { ...r, poster_url: '' } : r) : old
      );
      toast.success("Cover photo removed");
    } catch {
      toast.error("Failed to remove cover photo");
    } finally {
      setPosterSaving(false);
    }
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
    setProgramItems(list);
    try { localStorage.setItem(PROGRAM_KEY, JSON.stringify(list)); } catch { /* quota exceeded */ }
  };

  const openAddProg  = () => { setProgForm(EMPTY_PROG); setProgModal({}); };
  const openEditProg = (p) => {
    setProgForm({ time:p.time||"", duration:p.duration||"", title:p.title||"", performers:p.performers||p.group||"",
      music_url:p.music_url||"", mc_notes:p.mc_notes||"", lighting_notes:p.lighting_notes||"" });
    setProgModal(p);
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
      return res;
    },
    enabled: !!sid && !!id,
  });

  // Keep eventDateRef up-to-date so it survives cache removal during delete
  useEffect(() => { if (recital?.event_date) eventDateRef.current = recital.event_date; }, [recital?.event_date]);

  // Fallback: if cache was invalidated and recital is gone (e.g. after delete finishes re-fetching),
  // navigate away instead of showing "Loading event…"
  useEffect(() => {
    if (!isLoading && !recital && !!sid && !!id) {
      if (onDeleted) onDeleted(eventDateRef.current);
      else if (onBack) onBack();
    }
  }, [isLoading, recital]); // intentionally omit onDeleted/onBack/sid/id — they don't change

  // Seed poster from DB once recital loads
  useEffect(() => {
    if (recital?.poster_url) setPoster(recital.poster_url);
    else if (recital && !recital.poster_url) setPoster(null);
  }, [recital?.poster_url]);

  // ── Unified todos for this recital ───────────────────────────────────────
  const { data: todosData } = useQuery({
    queryKey: ["todos", sid],
    queryFn: () => todosApi.list(sid),
    enabled: !!sid,
  });
  const recitalTodos = (todosData?.todos || []).filter(t => t.recital_id === Number(id));

  const createTodoMut = useMutation({
    mutationFn: ({ title, assigned_to }) => todosApi.create(sid, { title, recital_id: Number(id), assigned_to: assigned_to||null }),
    onSuccess: () => { qc.invalidateQueries(["todos", sid]); setNewTask(""); setNewTaskAssignedTo(""); toast.success("To-do added"); },
    onError: () => toast.error("Failed to add to-do"),
  });

  const toggleTodoMut = useMutation({
    mutationFn: (taskId) => todosApi.toggle(sid, taskId),
    onMutate: async (taskId) => {
      await qc.cancelQueries(["todos", sid]);
      const prev = qc.getQueryData(["todos", sid]);
      qc.setQueryData(["todos", sid], old => old?.todos
        ? { ...old, todos: old.todos.map(t => t.id === taskId ? { ...t, is_complete: t.is_complete ? 0 : 1 } : t) }
        : old);
      return { prev };
    },
    onError: (_e, _id, ctx) => qc.setQueryData(["todos", sid], ctx.prev),
    onSettled: () => qc.invalidateQueries(["todos", sid]),
  });

  const deleteTodoMut = useMutation({
    mutationFn: (taskId) => todosApi.remove(sid, taskId),
    onSuccess: () => { qc.invalidateQueries(["todos", sid]); toast.success("To-do removed"); },
    onError: () => toast.error("Failed to delete"),
  });

  const addTask = () => {
    if (!newTask.trim()) return;
    createTodoMut.mutate({ title: newTask.trim(), assigned_to: newTaskAssignedTo.trim() });
  };

  // Participants queries and mutations
  useEffect(() => {
    if (sid && id) {
      api.listParticipants(sid, id)
        .then(data => setParticipants(data))
        .catch(() => setParticipants([]));
    }
  }, [sid, id]);

  const addParticipantMut = useMutation({
    mutationFn: (data) => api.addParticipant(sid, id, data),
    onSuccess: (newPart) => {
      setParticipants(prev => [...prev, newPart]);
      setParticipantModal(null);
      setParticipantForm({});
      toast.success("Participant added");
    },
    onError: (err) => toast.error(err.error || "Failed to add participant"),
  });

  const updateParticipantMut = useMutation({
    mutationFn: ({ participantId, rsvp_status }) => api.updateParticipantRsvp(sid, id, participantId, rsvp_status),
    onSuccess: (updated) => {
      setParticipants(prev => prev.map(p => p.id === updated.id ? updated : p));
      toast.success("RSVP status updated");
    },
    onError: () => toast.error("Failed to update RSVP status"),
  });

  const deleteParticipantMut = useMutation({
    mutationFn: (participantId) => api.deleteParticipant(sid, id, participantId),
    onSuccess: (_, participantId) => {
      setParticipants(prev => prev.filter(p => p.id !== participantId));
      toast.success("Participant removed");
    },
    onError: () => toast.error("Failed to remove participant"),
  });

  // Overview inline editing handlers
  const saveDescription = () => {
    if (!overviewForm.description?.trim()) {
      toast.error("Description cannot be empty");
      return;
    }
    api.update(sid, id, {
      title: recital.title,
      event_date: (recital.event_date||'').slice(0,10),
      event_time: recital.event_time||'',
      venue: recital.venue||'',
      status: recital.status||'Planning',
      description: overviewForm.description,
      is_featured: recital.is_featured??0,
      participant_count: recital.participant_count??null,
    }).then(() => {
      qc.setQueryData(["recital-detail", sid, id], old => old ? {...old, description: overviewForm.description} : old);
      setOverviewEditing(null);
      setOverviewForm({});
      toast.success("Description updated");
    }).catch(() => toast.error("Failed to save description"));
  };

  const addInfoItem = () => {
    const v = newInfoInput.trim();
    if (!v) { toast.error("Info cannot be empty"); return; }
    const newItems = [...infoItems, v];
    setInfoItems(newItems);
    localStorage.setItem(INFO_KEY, JSON.stringify(newItems));
    setNewInfoInput("");
    toast.success("Item added");
  };

  const updateInfoItem = (idx, val) => {
    const newItems = infoItems.map((x, i) => i === idx ? val : x);
    setInfoItems(newItems);
    localStorage.setItem(INFO_KEY, JSON.stringify(newItems));
    setEditingInfoIdx(null);
    toast.success("Item updated");
  };

  const deleteInfoItem = (idx) => {
    const newItems = infoItems.filter((_, i) => i !== idx);
    setInfoItems(newItems);
    localStorage.setItem(INFO_KEY, JSON.stringify(newItems));
    toast.success("Item removed");
  };

  // Click-outside-to-cancel for inline metadata editing
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (metaEditing && !e.target.closest('[data-meta-edit]')) {
        setMetaEditing(null);
      }
    };
    if (metaEditing) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [metaEditing]);

  if (isLoading || !recital) {
    return (
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:300, color:"var(--muted)" }}>
        Loading event…
      </div>
    );
  }

  const color   = RECITAL_COLOR;
  // Use local-date constructor to avoid UTC midnight shift (mysql2 returns DATE as ISO string)
  const [_yr, _mo, _dy] = (recital.event_date||'').slice(0,10).split('-').map(Number);
  const d       = (_yr && _mo && _dy) ? new Date(_yr, _mo - 1, _dy) : new Date(NaN);
  const fmtDate = isNaN(d) ? "—" : d.toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric", year:"numeric" });
  const done    = recitalTodos.filter(t => t.is_complete).length;
  const pct     = recitalTodos.length ? Math.round(done / recitalTodos.length * 100) : 0;

  const TABS = [
    { id:"overview",   label:"Overview",          shortLabel:"Overview",  icon:"home"        },
    { id:"program",    label:"Program Schedule",  shortLabel:"Program",   icon:"list"        },
    { id:"venue",      label:"Venue",             shortLabel:"Venue",     icon:"map-pin"     },
    { id:"invitees",   label:"Invitees",          shortLabel:"Invitees",  icon:"users"       },
    { id:"vendors",    label:"Vendors",           shortLabel:"Vendors",   icon:"package"     },
    { id:"tasks",      label:`To-Dos${recitalTodos.length ? ` (${done}/${recitalTodos.length})` : ""}`, shortLabel:"To-Dos", icon:"check-circle" },
  ];

  const getMetaValue = (field) => {
    if (field === 'date') return recital.event_date ? (recital.event_date||'').slice(0,10) : null;
    if (field === 'time') return recital.event_time || null;
    if (field === 'venue') return recital.venue || null;
    if (field === 'participants') return recital.participant_count;
    return null;
  };

  const META = [
    { id: 'date', icon:<CalIcon/>,   label:"Date",         value: fmtDate === "—" ? "TBD" : fmtDate, raw: getMetaValue('date') },
    { id: 'time', icon:<ClockIcon/>, label:"Time",         value: fmtRecitalTime(recital.event_time) || "TBD", raw: getMetaValue('time') },
    { id: 'venue', icon:<PinIcon/>,   label:"Location",     value: recital.venue || "TBD", raw: getMetaValue('venue') },
    { id: 'participants', icon:<UsersIcon/>, label:"Participants", value: recital.participant_count != null ? `${recital.participant_count} students` : "TBD", raw: getMetaValue('participants') },
  ];

  return (
    <div style={{ minHeight:"100%" }}>

      {/* ══════════════════════════════════════════════════════════════════
           MOBILE: Netflix-style hero — poster + title overlay + actions
           Desktop: classic back-nav + header strip
         ══════════════════════════════════════════════════════════════════ */}

      {isMobile ? (
        <>
          {/* ── Full-bleed hero banner ── */}
          <div style={{
            position:"relative",
            margin:"-20px -16px 0",
            overflow:"hidden",
            background: poster ? "#000" : "linear-gradient(135deg,#1a1035 0%,#2d1b69 100%)",
          }}>
            {/* Cover photo — locked 4:3 so hero height is always consistent */}
            {poster
              ? <div style={{ width:"100%", paddingTop:"75%", position:"relative" }}>
                  <img src={poster} alt={recital.title}
                    style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
                </div>
              : <div style={{ minHeight:260 }} />
            }
            {/* Gradient overlay bottom → top */}
            <div style={{ position:"absolute", inset:0, background:"linear-gradient(to top, rgba(0,0,0,.82) 0%, rgba(0,0,0,.18) 55%, transparent 100%)" }} />

            {/* Top row: back pill + action buttons */}
            <div style={{ position:"absolute", top:0, left:0, right:0, padding:"16px", display:"flex", alignItems:"center", justifyContent:"space-between", zIndex:10 }}>
              {/* Back */}
              <button onClick={onBack} style={{
                display:"flex", alignItems:"center", gap:6,
                padding:"7px 14px", borderRadius:20,
                background:"rgba(0,0,0,.45)", backdropFilter:"blur(8px)",
                border:"1px solid rgba(255,255,255,.22)",
                color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer",
              }}>
                <ArrowLeft /> Back
              </button>

              {/* Right: photo · star · delete */}
              <div style={{ display:"flex", gap:8 }}>
                {/* Photo upload / change */}
                <label style={{
                  width:34, height:34, borderRadius:"50%", cursor:"pointer",
                  background:"rgba(0,0,0,.45)", backdropFilter:"blur(8px)",
                  border:"1px solid rgba(255,255,255,.22)",
                  display:"flex", alignItems:"center", justifyContent:"center",
                }}>
                  {posterSaving
                    ? <span style={{ fontSize:11, color:"rgba(255,255,255,.7)" }}>…</span>
                    : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.85)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                  }
                  <input type="file" accept="image/*" style={{ display:"none" }} onChange={handlePosterUpload} />
                </label>
                {/* Star / Featured */}
                <button
                  onClick={() => {
                    const next = recital.is_featured ? 0 : 1;
                    api.update(sid, recital.id, {
                      title: recital.title, event_date: (recital.event_date||'').slice(0,10),
                      event_time: recital.event_time||'', venue: recital.venue||'',
                      status: recital.status||'Planning', description: recital.description||'',
                      is_featured: next, participant_count: recital.participant_count ?? null,
                    }).then(() => {
                      qc.setQueryData(["recital-detail", sid, id], old => old ? {...old, is_featured: next} : old);
                      qc.invalidateQueries({ queryKey: ["recitals", sid] });
                    });
                  }}
                  style={{
                    width:34, height:34, borderRadius:"50%", cursor:"pointer",
                    background:"rgba(0,0,0,.45)", backdropFilter:"blur(8px)",
                    border:"1px solid rgba(255,255,255,.22)",
                    display:"flex", alignItems:"center", justifyContent:"center",
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24"
                    fill={recital.is_featured ? "#F59E0B" : "none"}
                    stroke={recital.is_featured ? "#F59E0B" : "rgba(255,255,255,.85)"}
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                </button>
                {/* Duplicate */}
                <button onClick={() => duplicateRecitalMutation.mutate()} title="Duplicate recital" style={{
                  width:34, height:34, borderRadius:"50%", cursor:"pointer",
                  background:"rgba(0,0,0,.45)", backdropFilter:"blur(8px)",
                  border:"1px solid rgba(255,255,255,.22)",
                  display:"flex", alignItems:"center", justifyContent:"center",
                }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.85)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                </button>
                {/* Delete */}
                <button onClick={() => setConfirmDelete(true)} style={{
                  width:34, height:34, borderRadius:"50%", cursor:"pointer",
                  background:"rgba(0,0,0,.45)", backdropFilter:"blur(8px)",
                  border:"1px solid rgba(255,255,255,.22)",
                  display:"flex", alignItems:"center", justifyContent:"center",
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.75)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Bottom: title + meta chips */}
            <div style={{ position:"absolute", bottom:0, left:0, right:0, padding:"0 18px 20px", zIndex:10 }}>
              <div style={{ fontSize:10, fontWeight:700, color:"rgba(255,255,255,.5)", textTransform:"uppercase", letterSpacing:".14em", marginBottom:6 }}>Performance</div>
              <h1 style={{ fontFamily:"var(--font-d)", fontSize:22, fontWeight:900, color:"#fff", margin:"0 0 10px", lineHeight:1.2 }}>
                {recital.title}
              </h1>
              <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
                {fmtDate !== "—" && (
                  <span style={{ display:"inline-flex", alignItems:"center", gap:5, fontSize:11, color:"rgba(255,255,255,.72)", fontWeight:500 }}>
                    <CalIcon />{fmtDate}
                  </span>
                )}
                {fmtRecitalTime(recital.event_time) && (
                  <span style={{ display:"inline-flex", alignItems:"center", gap:5, fontSize:11, color:"rgba(255,255,255,.72)", fontWeight:500 }}>
                    <ClockIcon />{fmtRecitalTime(recital.event_time)}
                  </span>
                )}
                {recital.venue && (
                  <span style={{ display:"inline-flex", alignItems:"center", gap:5, fontSize:11, color:"rgba(255,255,255,.72)", fontWeight:500 }}>
                    <PinIcon />{recital.venue}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ── Edit Event CTA ── */}
          <button onClick={openInlineEdit} style={{
            display:"flex", alignItems:"center", justifyContent:"center", gap:8,
            width:"100%", padding:"13px", borderRadius:12, border:"none",
            background:"linear-gradient(135deg,#7C3AED,#D946EF)",
            boxShadow:"0 2px 12px rgba(124,58,237,.28)",
            color:"#fff", fontWeight:700, fontSize:14, cursor:"pointer",
            margin:"16px 0 20px",
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Edit Event Details
          </button>

          {/* ── Metadata strip ── */}
          <div style={{
            display:"grid", gridTemplateColumns:"repeat(2, 1fr)", gap:0,
            background:"var(--border)", borderRadius:14, overflow:"hidden",
            border:"1px solid var(--border)", marginBottom:22,
          }}>
            {META.map((m, i) => (
              <div key={m.id} data-meta-edit style={{
                background:"var(--card)", padding:"14px 16px",
                borderRight: i % 2 === 0 ? "1px solid var(--border)" : "none",
                borderBottom: i < 2 ? "1px solid var(--border)" : "none",
                position:"relative",
                cursor:"pointer",
              }}
              onMouseEnter={e => e.currentTarget.style.background="var(--surface)"}
              onMouseLeave={e => e.currentTarget.style.background="var(--card)"}
              onClick={() => {
                setMetaForm({ [m.id]: m.raw });
                setMetaEditing(m.id);
              }}
              >
                <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:7, color:"var(--muted)" }}>
                  {m.icon}
                  <span style={{ fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:".07em" }}>{m.label}</span>
                </div>
                {metaEditing === m.id ? (
                  <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                    {m.id === 'date' && (
                      <>
                        <input type="date" value={metaForm.date || ''} onChange={e => setMetaForm(f => ({...f, date: e.target.value}))} style={{ flex:1, padding:"4px 6px", borderRadius:4, border:"1px solid var(--border)", fontSize:13 }} />
                        <button onClick={e => { e.stopPropagation(); setMetaForm(f => ({...f, date: null})); }} style={{ padding:"2px 8px", fontSize:11, background:"var(--surface)", border:"1px solid var(--border)", borderRadius:4, cursor:"pointer", color:"var(--text)" }}>TBD</button>
                      </>
                    )}
                    {m.id === 'time' && (
                      <>
                        <select value={metaForm.time || ''} onChange={e => setMetaForm(f => ({...f, time: e.target.value}))} style={{ flex:1, padding:"4px 6px", borderRadius:4, border:"1px solid var(--border)", fontSize:13 }}>
                          <option value="">TBD</option>
                          {TIME_OPTIONS.map(t => <option key={t.val} value={t.val}>{t.label}</option>)}
                        </select>
                      </>
                    )}
                    {m.id === 'venue' && (
                      <input type="text" placeholder="e.g. Lincoln Center" value={metaForm.venue || ''} onChange={e => setMetaForm(f => ({...f, venue: e.target.value}))} style={{ flex:1, padding:"4px 6px", borderRadius:4, border:"1px solid var(--border)", fontSize:13 }} />
                    )}
                    {m.id === 'participants' && (
                      <>
                        <input type="number" min="0" placeholder="Count" value={metaForm.participants || ''} onChange={e => setMetaForm(f => ({...f, participants: e.target.value}))} style={{ flex:1, padding:"4px 6px", borderRadius:4, border:"1px solid var(--border)", fontSize:13 }} />
                        <button onClick={e => { e.stopPropagation(); setMetaForm(f => ({...f, participants: null})); }} style={{ padding:"2px 8px", fontSize:11, background:"var(--surface)", border:"1px solid var(--border)", borderRadius:4, cursor:"pointer", color:"var(--text)" }}>TBD</button>
                      </>
                    )}
                    <button onClick={e => { e.stopPropagation(); saveMetaField(m.id); }} disabled={metaSaving} style={{ padding:"2px 8px", fontSize:11, background:"var(--accent)", color:"#fff", border:"none", borderRadius:4, cursor:"pointer", opacity: metaSaving ? 0.6 : 1 }}>Save</button>
                    <button onClick={e => { e.stopPropagation(); setMetaEditing(null); }} style={{ padding:"2px 8px", fontSize:11, background:"var(--surface)", color:"var(--text)", border:"1px solid var(--border)", borderRadius:4, cursor:"pointer" }}>Cancel</button>
                  </div>
                ) : (
                  <div style={{ fontSize:14, fontWeight:700, color:"var(--text)" }}>{m.value}</div>
                )}
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          {/* ── Back navigation ── */}
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

          {/* ── Event header (full-width) ── */}
          <div style={{ marginBottom:26 }}>
            <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12, flexWrap:"wrap", marginBottom:22 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <h1 style={{ fontFamily:"var(--font-d)", fontSize:30, fontWeight:900, margin:0, marginBottom:10, lineHeight:1.2 }}>
                  {recital.title}
                </h1>
                <span style={{ fontSize:12, background:"#6a7fdb22", color:"#6a7fdb", borderRadius:20, padding:"4px 12px", fontWeight:700 }}>
                  Performance
                </span>
              </div>
              <div style={{ display:"flex", gap:8, flexShrink:0 }}>
                {/* Star */}
                <button
                  title={recital.is_featured ? "Remove from featured" : "Mark as featured on dashboard"}
                  onClick={() => {
                    const next = recital.is_featured ? 0 : 1;
                    api.update(sid, recital.id, {
                      title: recital.title, event_date: (recital.event_date||'').slice(0,10),
                      event_time: recital.event_time||'', venue: recital.venue||'',
                      status: recital.status||'Planning', description: recital.description||'',
                      is_featured: next, participant_count: recital.participant_count ?? null,
                    }).then(() => {
                      qc.setQueryData(["recital-detail", sid, id], old => old ? {...old, is_featured: next} : old);
                      qc.invalidateQueries({ queryKey: ["recitals", sid] });
                    });
                  }}
                  style={{
                    display:"inline-flex", alignItems:"center", justifyContent:"center",
                    width:40, height:40, borderRadius:10, border:"1.5px solid var(--border)",
                    background:"var(--card)", cursor:"pointer",
                    color: recital.is_featured ? "#F59E0B" : "var(--muted)", transition:"all .15s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background="#FFFBEB"; e.currentTarget.style.borderColor="#F59E0B"; e.currentTarget.style.color="#F59E0B"; }}
                  onMouseLeave={e => { e.currentTarget.style.background="var(--card)"; e.currentTarget.style.borderColor="var(--border)"; e.currentTarget.style.color=recital.is_featured?"#F59E0B":"var(--muted)"; }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill={recital.is_featured?"#F59E0B":"none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                </button>
                {/* Edit */}
                <button onClick={openInlineEdit} style={{
                  display:"inline-flex", alignItems:"center", gap:6,
                  padding:"9px 18px", borderRadius:10, border:"1.5px solid var(--border)",
                  background:"var(--card)", cursor:"pointer", fontSize:13, fontWeight:600,
                  color:"var(--text)", transition:"all .15s",
                }}
                  onMouseEnter={e => e.currentTarget.style.background="var(--surface)"}
                  onMouseLeave={e => e.currentTarget.style.background="var(--card)"}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  Edit Event
                </button>
                {/* Duplicate */}
                <button onClick={() => duplicateRecitalMutation.mutate()} title="Duplicate recital" style={{
                  display:"inline-flex", alignItems:"center", gap:6,
                  padding:"9px 18px", borderRadius:10, border:"1.5px solid var(--border)",
                  background:"var(--card)", cursor:"pointer", fontSize:13, fontWeight:600,
                  color:"var(--text)", transition:"all .15s",
                }}
                  onMouseEnter={e => e.currentTarget.style.background="var(--surface)"}
                  onMouseLeave={e => e.currentTarget.style.background="var(--card)"}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                  Duplicate
                </button>
                {/* Delete */}
                <button onClick={() => setConfirmDelete(true)} style={{
                  display:"inline-flex", alignItems:"center", justifyContent:"center",
                  width:40, height:40, borderRadius:10, border:"1.5px solid var(--border)",
                  background:"var(--card)", cursor:"pointer",
                  color:"var(--muted)", transition:"all .15s",
                }}
                  onMouseEnter={e => { e.currentTarget.style.background="#fff0ee"; e.currentTarget.style.borderColor="#ff3b30"; e.currentTarget.style.color="#ff3b30"; }}
                  onMouseLeave={e => { e.currentTarget.style.background="var(--card)"; e.currentTarget.style.borderColor="var(--border)"; e.currentTarget.style.color="var(--muted)"; }}
                  title="Delete recital"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Metadata strip */}
            <div style={{
              display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:0,
              background:"var(--border)", borderRadius:14, overflow:"hidden",
              border:"1px solid var(--border)",
            }}>
              {META.map((m, i) => (
                <div key={m.id} data-meta-edit style={{
                  background:"var(--card)", padding:"16px 22px",
                  borderRight: i < META.length-1 ? "1px solid var(--border)" : "none",
                  position:"relative",
                  cursor:"pointer",
                }}
                onMouseEnter={e => !metaEditing && (e.currentTarget.style.background="var(--surface)")}
                onMouseLeave={e => !metaEditing && (e.currentTarget.style.background="var(--card)")}
                onClick={() => {
                  setMetaForm({ [m.id]: m.raw });
                  setMetaEditing(m.id);
                }}
                >
                  <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:7, color:"var(--muted)" }}>
                    {m.icon}
                    <span style={{ fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:".07em" }}>{m.label}</span>
                  </div>
                  {metaEditing === m.id ? (
                    <div style={{ display:"flex", gap:6, alignItems:"center", flexWrap:"wrap" }}>
                      {m.id === 'date' && (
                        <>
                          <input type="date" value={metaForm.date || ''} onChange={e => setMetaForm(f => ({...f, date: e.target.value}))} onKeyDown={e => e.key === 'Escape' && setMetaEditing(null)} style={{ flex:1, minWidth:100, padding:"4px 6px", borderRadius:4, border:"1px solid var(--border)", fontSize:12 }} />
                          <button onClick={e => { e.stopPropagation(); setMetaForm(f => ({...f, date: null})); }} style={{ padding:"2px 6px", fontSize:10, background:"var(--surface)", border:"1px solid var(--border)", borderRadius:4, cursor:"pointer", whiteSpace:"nowrap", color:"var(--text)" }}>TBD</button>
                        </>
                      )}
                      {m.id === 'time' && (
                        <select value={metaForm.time || ''} onChange={e => setMetaForm(f => ({...f, time: e.target.value}))} style={{ flex:1, minWidth:100, padding:"4px 6px", borderRadius:4, border:"1px solid var(--border)", fontSize:12 }}>
                          <option value="">TBD</option>
                          {TIME_OPTIONS.map(t => <option key={t.val} value={t.val}>{t.label}</option>)}
                        </select>
                      )}
                      {m.id === 'venue' && (
                        <input type="text" placeholder="Venue" value={metaForm.venue || ''} onChange={e => setMetaForm(f => ({...f, venue: e.target.value}))} style={{ flex:1, minWidth:100, padding:"4px 6px", borderRadius:4, border:"1px solid var(--border)", fontSize:12 }} />
                      )}
                      {m.id === 'participants' && (
                        <>
                          <input type="number" min="0" placeholder="Count" value={metaForm.participants || ''} onChange={e => setMetaForm(f => ({...f, participants: e.target.value}))} onKeyDown={e => e.key === 'Escape' && setMetaEditing(null)} style={{ flex:1, minWidth:60, padding:"4px 6px", borderRadius:4, border:"1px solid var(--border)", fontSize:12 }} />
                          <button onClick={e => { e.stopPropagation(); setMetaForm(f => ({...f, participants: null})); }} style={{ padding:"2px 6px", fontSize:10, background:"var(--surface)", border:"1px solid var(--border)", borderRadius:4, cursor:"pointer", whiteSpace:"nowrap", color:"var(--text)" }}>TBD</button>
                        </>
                      )}
                      <button onClick={e => { e.stopPropagation(); saveMetaField(m.id); }} disabled={metaSaving} style={{ padding:"2px 6px", fontSize:10, background:"var(--accent)", color:"#fff", border:"none", borderRadius:4, cursor:"pointer", opacity: metaSaving ? 0.6 : 1, whiteSpace:"nowrap" }}>Save</button>
                      <button onClick={e => { e.stopPropagation(); setMetaEditing(null); }} style={{ padding:"2px 6px", fontSize:10, background:"var(--surface)", color:"var(--text)", border:"1px solid var(--border)", borderRadius:4, cursor:"pointer", whiteSpace:"nowrap" }}>✕</button>
                    </div>
                  ) : (
                    <div style={{ fontSize:14, fontWeight:700, color:"var(--text)" }}>{m.value}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── Tab bar ───────────────────────────────────────────────────── */}
      <div style={{
        background:"var(--surface)", borderRadius:12,
        padding:4, marginBottom:22,
        border:"1px solid var(--border)",
        width: isMobile ? "100%" : "fit-content",
        boxSizing:"border-box",
      }}>
      <div style={{
        display:"flex", gap:2,
        overflowX: isMobile ? "auto" : "visible",
        WebkitOverflowScrolling: "touch",
        scrollbarWidth: "none",
        msOverflowStyle: "none",
        paddingBottom: 1, /* prevents scrollbar from showing on some browsers */
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: isMobile ? "8px 6px" : "8px 18px",
            flex: isMobile ? "0 0 auto" : "none",
            minWidth: isMobile ? 54 : "auto",
            border:"none", cursor:"pointer",
            background: tab === t.id ? "var(--card)" : "transparent",
            color: tab === t.id ? "var(--accent)" : "var(--muted)",
            fontWeight: tab === t.id ? 700 : 500,
            fontSize: isMobile ? 9 : 13,
            borderRadius:9, transition:"all .15s",
            boxShadow: tab === t.id ? "0 1px 6px rgba(0,0,0,.1)" : "none",
            whiteSpace:"nowrap",
            display:"flex", flexDirection: isMobile ? "column" : "row",
            alignItems:"center", justifyContent:"center",
            gap: isMobile ? 4 : 6,
            lineHeight: 1.2,
          }}>
            <SvgIcon name={t.icon} size={15} color={tab === t.id ? "var(--accent)" : "var(--muted)"} />
            <span style={{ color: tab === t.id ? "var(--accent)" : "var(--muted)" }}>{isMobile ? t.shortLabel : t.label}</span>
          </button>
        ))}
      </div>
      </div>

      {/* ── Tab content ───────────────────────────────────────────────── */}
      <div style={{ background:"var(--card)", borderRadius:16, border:"1px solid var(--border)", padding: isMobile ? "18px 16px" : "28px 32px" }}>

        {/* ── OVERVIEW ── */}
        {tab === "overview" && (
          <div style={{
            display:"flex", alignItems:"stretch",
            flexDirection:"row",
            margin: isMobile ? 0 : "-28px -32px -28px -32px",
            overflow:"hidden", borderRadius: isMobile ? 0 : 16,
          }}>

            {/* Left: description + important info */}
            <div style={{ flex:1, minWidth:0, padding: isMobile ? 0 : "28px 32px" }}>
              <SectionHead title="Event Overview" sub="General information and description" />

              {/* Description - Editable */}
              <div style={{ marginBottom: 28 }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                  <h3 style={{ fontSize:15, fontWeight:700, margin:0 }}>Description</h3>
                  {overviewEditing !== 'description' && (
                    <button onClick={() => { setOverviewForm({description: recital.description || ''}); setOverviewEditing('description'); }} style={{ fontSize:11, background:"none", border:"none", color:"var(--accent)", cursor:"pointer", fontWeight:600 }}>Edit</button>
                  )}
                </div>
                {overviewEditing === 'description' ? (
                  <div>
                    <textarea value={overviewForm.description || ''} onChange={e => setOverviewForm(f => ({...f, description: e.target.value}))} style={{ width:"100%", minHeight:120, padding:10, borderRadius:6, border:"1px solid var(--border)", fontSize:14, color:"var(--text)", background:"var(--surface)", fontFamily:"inherit" }} />
                    <div style={{ display:"flex", gap:8, marginTop:12 }}>
                      <button onClick={saveDescription} style={{ padding:"6px 16px", background:"var(--accent)", color:"#fff", border:"none", borderRadius:6, fontSize:12, fontWeight:600, cursor:"pointer" }}>Save</button>
                      <button onClick={() => { setOverviewEditing(null); setOverviewForm({}); }} style={{ padding:"6px 16px", background:"var(--surface)", border:"1px solid var(--border)", borderRadius:6, fontSize:12, fontWeight:600, cursor:"pointer" }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <p style={{ color:"var(--muted)", fontSize:14, lineHeight:1.75, margin:0 }}>{recital.description || "No description added yet. Click Edit to add one."}</p>
                )}
              </div>

              {/* Important Information - Unified edit mode like Description */}
              <div>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
                  <h3 style={{ fontSize:15, fontWeight:700, margin:0 }}>Important Information</h3>
                  {overviewEditing !== 'info' && <button onClick={() => { setOverviewEditing('info'); setOverviewForm({...overviewForm, info: infoItems.join('\n')}); }} style={{ fontSize:12, color:"var(--accent)", background:"none", border:"none", cursor:"pointer", fontWeight:600 }}>Edit</button>}
                </div>
                {overviewEditing === 'info' ? (
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    <textarea value={overviewForm.info || ''} onChange={e => setOverviewForm({...overviewForm, info: e.target.value})} placeholder="Add items (one per line)..." style={{ padding:"10px", borderRadius:6, border:"1px solid var(--border)", fontSize:13, color:"var(--text)", background:"var(--surface)", minHeight:120, fontFamily:"inherit" }} />
                    <div style={{ display:"flex", gap:8 }}>
                      <button onClick={async () => {
                        try {
                          const newItems = overviewForm.info?.trim().split('\n').filter(line => line.trim()) || [];
                          setInfoItems(newItems);
                          localStorage.setItem(INFO_KEY, JSON.stringify(newItems));
                          setOverviewEditing(null);
                          toast.success("Important information updated");
                        } catch (e) {
                          toast.error("Failed to save");
                        }
                      }} style={{ padding:"6px 14px", background:"var(--accent)", color:"#fff", border:"none", borderRadius:6, fontSize:12, fontWeight:600, cursor:"pointer" }}>Save</button>
                      <button onClick={() => setOverviewEditing(null)} style={{ padding:"6px 14px", background:"var(--surface)", border:"1px solid var(--border)", color:"var(--text)", borderRadius:6, fontSize:12, fontWeight:600, cursor:"pointer" }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <ul style={{ margin:0, padding:"0 0 0 18px", display:"flex", flexDirection:"column", gap:9, marginBottom:0 }}>
                    {infoItems.length === 0 ? (
                      <p style={{ color:"var(--muted)", fontSize:14, margin:0 }}>No important information added yet. Click Edit to add items.</p>
                    ) : (
                      infoItems.map((item, i) => (
                        <li key={i} style={{ fontSize:13, color:"var(--text)", lineHeight:1.5 }}>{item}</li>
                      ))
                    )}
                  </ul>
                )}
              </div>
            </div>

            {/* Right: Event Poster — desktop only (mobile has hero at top) */}
            {!isMobile && <div
              onMouseEnter={() => setPosterHover(true)}
              onMouseLeave={() => setPosterHover(false)}
              style={{
                flexShrink:0,
                width: isMobile ? "100%" : 260,
                position:"relative", overflow:"hidden",
                borderLeft: isMobile ? "none" : "1px solid var(--border)",
                borderTop: isMobile ? "1px solid var(--border)" : "none",
                background: (poster || instaUrl) ? "#000" : "var(--surface)",
                minHeight: poster ? 0 : 240,
              }}
            >
              {/* ── Uploaded cover photo — natural 4:3 sizing (800×600 guaranteed) ── */}
              {poster && (
                <>
                  <img src={poster} alt="Cover photo"
                    style={{ width:"100%", height:"auto", display:"block" }} />
                  {posterHover && (
                    <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,.52)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:10, zIndex:2 }}>
                      <label style={{ padding:"8px 18px", borderRadius:8, background:"rgba(255,255,255,.92)", fontSize:12, fontWeight:700, cursor:"pointer", color:"#333", display:"flex", alignItems:"center", gap:6 }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        Change
                        <input type="file" accept="image/*" style={{ display:"none" }} onChange={handlePosterUpload} />
                      </label>
                      <Button variant="danger" size="sm" onClick={removePoster}
                        icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>}>
                        Remove
                      </Button>
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
                    <Button size="sm" onClick={saveInstaUrl} style={{ flex:1, background:"linear-gradient(45deg,#f09433,#bc1888)", boxShadow:"none" }}>Link</Button>
                    <Button size="sm" variant="secondary" onClick={() => setShowInstaForm(false)} style={{ flex:1 }}>Cancel</Button>
                  </div>
                </div>
              )}

              {/* ── Empty state ── */}
              {!poster && !instaUrl && !showInstaForm && (
                <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:12, padding:20, boxSizing:"border-box" }}>
                  <div style={{ fontSize:11, fontWeight:700, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".06em" }}>Cover Photo</div>
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
            </div>}

          </div>
        )}

        {/* ── Delete confirmation modal ── */}
        {confirmDelete && (
          <Modal title="Delete Recital" onClose={() => setConfirmDelete(false)}>
            <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
              <p style={{ margin:0, fontSize:14, color:"var(--text)", lineHeight:1.6 }}>
                Are you sure you want to delete <strong>{recital?.title}</strong>? This action cannot be undone.
              </p>
              <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
                <button onClick={() => setConfirmDelete(false)} style={{
                  padding:"9px 20px", borderRadius:10, border:"1.5px solid var(--border)",
                  background:"var(--card)", color:"var(--text)", fontWeight:600, fontSize:13, cursor:"pointer",
                }}>
                  Cancel
                </button>
                <button onClick={() => { setConfirmDelete(false); deleteMutation.mutate(); }} disabled={deleteMutation.isPending} style={{
                  padding:"9px 20px", borderRadius:10, border:"none",
                  background:"#ff3b30", color:"#fff", fontWeight:700, fontSize:13, cursor:"pointer",
                  opacity: deleteMutation.isPending ? 0.7 : 1,
                }}>
                  {deleteMutation.isPending ? "Deleting…" : "Yes, Delete"}
                </button>
              </div>
            </div>
          </Modal>
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
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))", gap:12 }}>
                <Field label="Date">
                  <Input type="date" value={editForm.event_date} onChange={e => setEditForm(p=>({...p,event_date:e.target.value}))} />
                </Field>
                <Field label="Time">
                  <div style={{ display:"flex", gap:10 }}>
                    <Select value={editForm.event_time ? editForm.event_time.split(':')[0] : ''} onChange={e => {
                      const h = e.target.value;
                      if (!h) {
                        setEditForm(p=>({...p,event_time:''}));
                      } else {
                        const m = editForm.event_time?.split(':')[1] || '00';
                        setEditForm(p=>({...p,event_time:`${String(h).padStart(2,'0')}:${m}`}));
                      }
                    }} style={{ flex:1 }}>
                      <option value="">— No time —</option>
                      {Array.from({length:24}, (_, i) => <option key={i} value={String(i).padStart(2,'0')}>{i < 12 ? (i === 0 ? 12 : i) : (i === 12 ? 12 : i - 12)} {i < 12 ? 'AM' : 'PM'}</option>)}
                    </Select>
                    <Select value={editForm.event_time ? editForm.event_time.split(':')[1] : ''} onChange={e => {
                      const m = e.target.value;
                      const h = editForm.event_time?.split(':')[0] || '00';
                      setEditForm(p=>({...p,event_time:`${h}:${m}`}));
                    }} style={{ flex:0.8 }}>
                      <option value="">—</option>
                      <option value="00">:00</option>
                      <option value="15">:15</option>
                      <option value="30">:30</option>
                      <option value="45">:45</option>
                    </Select>
                  </div>
                </Field>
              </div>
              <Field label="Venue / Location">
                <Input value={editForm.venue} onChange={e => setEditForm(p=>({...p,venue:e.target.value}))} placeholder="e.g. Main Theater" />
              </Field>
              {/* ── Description ── */}
              <div style={{ borderTop:"1px solid var(--border)", paddingTop:14 }}>
                <p style={{ margin:"0 0 10px", fontSize:12, fontWeight:700, textTransform:"uppercase", letterSpacing:".06em", color:"var(--muted)" }}>Overview</p>
                <Field label="Description">
                  <Textarea rows={3} value={editForm.description} onChange={e => setEditForm(p=>({...p,description:e.target.value}))}
                    placeholder="Brief description of the event…" />
                </Field>
              </div>
            </div>

            <div style={{ display:"flex", justifyContent:"flex-end", gap:8, marginTop:20 }}>
              <Button variant="secondary" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button onClick={saveInlineEdit} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </Modal>
        )}

        {/* ── PROGRAM SCHEDULE ── */}
        {tab === "program" && (
          <div>
            <div style={{ display:"flex", flexDirection: isMobile ? "column" : "row", justifyContent:"space-between", alignItems: isMobile ? "stretch" : "flex-start", gap: isMobile ? 12 : 0, marginBottom:20 }}>
              <SectionHead title="Program Schedule" sub="Performance timeline and running order" />
              <Button size="sm" onClick={openAddProg} style={{ width: isMobile ? "100%" : "auto" }}>Add Number</Button>
            </div>

            {/* ── MOBILE: card-per-row ── */}
            {isMobile ? (
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {programItems.length === 0 && (
                  <div style={{ textAlign:"center", padding:"32px 16px", color:"var(--muted)", fontSize:13, border:"1.5px dashed var(--border)", borderRadius:12 }}>
                    No numbers yet — tap <strong>Add Number</strong> to get started.
                  </div>
                )}
                {programItems.map((p, i) => {
                  const hasMusic   = !!p.music_url;
                  const mcExpanded = expandedNotes.has(p.id);
                  const ltExpanded = expandedLight.has(p.id);
                  return (
                    <div key={p.id} style={{ background:"var(--card)", borderRadius:12, border:"1px solid var(--border)", overflow:"hidden" }}>
                      {/* Card header */}
                      <div style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 14px", background:"var(--surface)", borderBottom:"1px solid var(--border)" }}>
                        <div style={{ width:28, height:28, borderRadius:"50%", background:"var(--accent)", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:800, color:"#fff" }}>{i+1}</div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontWeight:700, fontSize:14, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.title}</div>
                          {(p.performers || p.group) && <div style={{ fontSize:12, color:"var(--muted)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.performers || p.group}</div>}
                        </div>
                        <div style={{ display:"flex", gap:5, flexShrink:0 }}>
                          <button onClick={() => openEditProg(p)} title="Edit" style={{ width:30, height:30, borderRadius:7, display:"flex", alignItems:"center", justifyContent:"center", border:"1px solid var(--border)", background:"none", cursor:"pointer", color:"var(--muted)" }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>
                          <button onClick={() => { if(window.confirm("Remove this number?")) deleteProg(p.id); }} title="Remove" style={{ width:30, height:30, borderRadius:7, display:"flex", alignItems:"center", justifyContent:"center", border:"1px solid #fecaca", background:"none", cursor:"pointer", color:"#e05c6a" }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                          </button>
                        </div>
                      </div>
                      {/* Card body */}
                      <div style={{ padding:"12px 14px", display:"flex", flexDirection:"column", gap:10 }}>
                        {(p.time || p.duration) && (
                          <div style={{ display:"flex", gap:14, alignItems:"center" }}>
                            {p.time && <span style={{ fontSize:13, fontWeight:800, color:"#6a7fdb", display:"inline-flex", alignItems:"center", gap:5 }}><SvgIcon name="clock" size={12} color="#6a7fdb" />{p.time}</span>}
                            {p.duration && <span style={{ fontSize:12, color:"var(--muted)", display:"inline-flex", alignItems:"center", gap:5 }}><SvgIcon name="timer" size={12} color="var(--muted)" />{p.duration}</span>}
                          </div>
                        )}
                        {hasMusic && (
                          <div style={{ padding:"10px 12px", borderRadius:8, background:"var(--surface)", border:"1px solid var(--border)" }}>
                            <div style={{ fontSize:11, fontWeight:700, color:"var(--muted)", marginBottom:4, display:"flex", alignItems:"center", gap:5 }}>
                              <SvgIcon name="music" size={11} color="#6a7fdb" />Music
                            </div>
                            <a href={p.music_url} target="_blank" rel="noopener noreferrer" style={{ fontSize:12, color:"#6a7fdb", textDecoration:"none", fontWeight:600, wordBreak:"break-all" }}>▶ Open / Play</a>
                          </div>
                        )}
                        {p.mc_notes && (
                          <div>
                            <div style={{ fontSize:10, fontWeight:700, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".06em", marginBottom:4 }}>MC Notes</div>
                            <div style={{ fontSize:13, lineHeight:1.55, overflow: mcExpanded ? "visible" : "hidden", display: mcExpanded ? "block" : "-webkit-box", WebkitLineClamp: mcExpanded ? "unset" : 3, WebkitBoxOrient:"vertical" }}>{p.mc_notes}</div>
                            {p.mc_notes.length > 100 && (
                              <button onClick={() => toggleNote(p.id)} style={{ fontSize:11, color:"#6a7fdb", background:"none", border:"none", cursor:"pointer", padding:"3px 0", fontWeight:600 }}>{mcExpanded ? "Show less ▲" : "View more ▼"}</button>
                            )}
                          </div>
                        )}
                        {p.lighting_notes && (
                          <div>
                            <div style={{ fontSize:10, fontWeight:700, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".06em", marginBottom:4 }}>Lighting Notes</div>
                            <div style={{ fontSize:13, lineHeight:1.55, overflow: ltExpanded ? "visible" : "hidden", display: ltExpanded ? "block" : "-webkit-box", WebkitLineClamp: ltExpanded ? "unset" : 3, WebkitBoxOrient:"vertical" }}>{p.lighting_notes}</div>
                            {p.lighting_notes.length > 100 && (
                              <button onClick={() => toggleLight(p.id)} style={{ fontSize:11, color:"#6a7fdb", background:"none", border:"none", cursor:"pointer", padding:"3px 0", fontWeight:600 }}>{ltExpanded ? "Show less ▲" : "View more ▼"}</button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* ── DESKTOP: scrollable table ── */
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
                      const hasMusic   = !!p.music_url;
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
                              <a href={p.music_url} target="_blank" rel="noopener noreferrer"
                                style={{ fontSize:11, color:"#6a7fdb", textDecoration:"none", fontWeight:600, display:"inline-flex", alignItems:"center", gap:4 }}>
                                <SvgIcon name="music" size={11} color="#6a7fdb" />Open / Play
                              </a>
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
            )}

            {/* Add / Edit program number modal */}
            {progModal !== null && (
              <Modal title={progModal?.id ? "Edit Number" : "Add Number"} onClose={() => setProgModal(null)}>
                <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))", gap:12 }}>
                    <Field label="Time"><Input value={progForm.time} onChange={e => setProgForm(p=>({...p,time:e.target.value}))} placeholder="e.g. 6:30 PM" /></Field>
                    <Field label="Duration"><Input value={progForm.duration} onChange={e => setProgForm(p=>({...p,duration:e.target.value}))} placeholder="e.g. 8 min" /></Field>
                  </div>
                  <Field label="Title *"><Input value={progForm.title} onChange={e => setProgForm(p=>({...p,title:e.target.value}))} placeholder="e.g. Ballet Fundamentals – Swan Lake" required /></Field>
                  <Field label="Performers"><Input value={progForm.performers} onChange={e => setProgForm(p=>({...p,performers:e.target.value}))} placeholder="e.g. Beginner Ballet Class" /></Field>

                  {/* Music section */}
                  <Field label="Music">
                    <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                      <Input value={progForm.music_url} onChange={e => setProgForm(p=>({...p,music_url:e.target.value}))}
                        placeholder="YouTube, Spotify, Google Drive, or SoundCloud link" />
                      <div style={{ fontSize:11, color:"var(--muted)" }}>Paste a shareable URL — YouTube, Spotify, Google Drive, SoundCloud, or any public audio link.</div>
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
                  <Button variant="secondary" onClick={() => setProgModal(null)}>Cancel</Button>
                  <Button onClick={saveProg}>{progModal?.id ? "Save Changes" : "Add Number"}</Button>
                </div>
              </Modal>
            )}
          </div>
        )}

        {/* ── INVITEES ── */}
        {tab === "invitees" && (
          <div>
            {/* Participants Section */}
            <div style={{ marginBottom: 32 }}>
              <div style={{ display:"flex", flexDirection: isMobile ? "column" : "row", justifyContent:"space-between", alignItems: isMobile ? "stretch" : "flex-start", gap: isMobile ? 12 : 0, marginBottom:20 }}>
                <SectionHead title="Participants" sub="Attendees and RSVP status" />
                <Button size="sm" onClick={() => { setParticipantForm({}); setParticipantModal({}); }} style={{ width: isMobile ? "100%" : "auto" }}>Add Participant</Button>
              </div>

              {participants.length === 0 ? (
                <div style={{ color:"var(--muted)", fontSize:13, padding:"20px", textAlign:"center", background:"var(--surface)", borderRadius:12 }}>No participants yet</div>
              ) : (
                <div style={{ overflowX:"auto" }}>
                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                    <thead>
                      <tr style={{ borderBottom:"1px solid var(--border)" }}>
                        <th style={{ padding:"12px", textAlign:"left", fontWeight:700, color:"var(--muted)" }}>Email</th>
                        <th style={{ padding:"12px", textAlign:"left", fontWeight:700, color:"var(--muted)" }}>Guest</th>
                        <th style={{ padding:"12px", textAlign:"left", fontWeight:700, color:"var(--muted)" }}>RSVP Status</th>
                        <th style={{ padding:"12px", textAlign:"center", fontWeight:700, color:"var(--muted)" }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {participants.map(p => (
                        <tr key={p.id} style={{ borderBottom:"1px solid var(--border)" }}>
                          <td style={{ padding:"12px", color:"var(--text)" }}>{p.email}</td>
                          <td style={{ padding:"12px", color:"var(--muted)" }}>{p.is_guest ? "Yes" : "No"}</td>
                          <td style={{ padding:"12px" }}>
                            <select value={p.rsvp_status} onChange={e => updateParticipantMut.mutate({ participantId: p.id, rsvp_status: e.target.value })} style={{ padding:"4px 6px", borderRadius:4, border:"1px solid var(--border)", fontSize:12, cursor:"pointer", background:"var(--card)", color:"var(--text)" }}>
                              <option value="Pending">Pending</option>
                              <option value="Confirmed">Confirmed</option>
                              <option value="Declined">Declined</option>
                              <option value="No Response">No Response</option>
                            </select>
                          </td>
                          <td style={{ padding:"12px", textAlign:"center" }}>
                            <button onClick={() => deleteParticipantMut.mutate(p.id)} style={{ padding:"4px 8px", fontSize:11, background:"#ff3b30", color:"#fff", border:"none", borderRadius:4, cursor:"pointer" }}>Remove</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {participantModal !== null && (
                <Modal title={participantModal?.id ? "Edit Participant" : "Add Participant"} onClose={() => { setParticipantModal(null); setParticipantForm({}); }}>
                  <Field label="Email">
                    <Input type="email" value={participantForm.email || ''} onChange={e => setParticipantForm(f => ({...f, email: e.target.value}))} placeholder="participant@example.com" />
                  </Field>
                  <Field label="Guest">
                    <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", marginBottom:20 }}>
                      <input type="checkbox" checked={participantForm.is_guest || false} onChange={e => setParticipantForm(f => ({...f, is_guest: e.target.checked}))} style={{ cursor:"pointer" }} />
                      <span>External guest (not a school contact)</span>
                    </label>
                  </Field>
                  <div style={{ display:"flex", gap:10, marginTop:20 }}>
                    <Button variant="secondary" onClick={() => { setParticipantModal(null); setParticipantForm({}); }} style={{ flex:1 }}>Cancel</Button>
                    <Button onClick={() => addParticipantMut.mutate(participantForm)} disabled={!participantForm.email || addParticipantMut.isPending} style={{ flex:1 }}>Add Participant</Button>
                  </div>
                </Modal>
              )}
            </div>

            <div style={{ display:"flex", flexDirection: isMobile ? "column" : "row", justifyContent:"space-between", alignItems: isMobile ? "stretch" : "flex-start", gap: isMobile ? 12 : 0, marginBottom:20 }}>
              <SectionHead title="Helpers" sub="Volunteer coordinators and helpers for the event" />
              <Button size="sm" onClick={openAddVolunteer} style={{ width: isMobile ? "100%" : "auto" }}>Add Helper</Button>
            </div>

            {/* ── Sign Up Genius integration banner ── */}
            <div style={{
              borderRadius:12, border:"1.5px solid var(--border)",
              background:"var(--surface)",
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
                      border:"1.5px solid var(--border)", borderRadius:9,
                      fontSize:13, background:"var(--card)",
                      color:"var(--text)", outline:"none", fontFamily:"inherit",
                    }}
                  />
                  <Button onClick={saveSugUrl}>Save</Button>
                  {editingUrl && (
                    <Button variant="secondary" onClick={() => { setEditingUrl(false); setSugInput(sugUrl); }}>Cancel</Button>
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
                <Button size="sm" onClick={openAddVolunteer}>Add First Volunteer</Button>
              </div>
            ) : isMobile ? (
              /* ── MOBILE: card-per-volunteer ── */
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {volunteers.map((v) => (
                  <div key={v.id} style={{ background:"var(--card)", borderRadius:12, border:"1px solid var(--border)", overflow:"hidden" }}>
                    {/* Card header */}
                    <div style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 14px", background:"var(--surface)", borderBottom:"1px solid var(--border)" }}>
                      <div style={{
                        width:36, height:36, borderRadius:"50%", flexShrink:0,
                        background:`linear-gradient(135deg, hsl(${avatarHue(v.name)},55%,50%), hsl(${(avatarHue(v.name)+30)%360},55%,42%))`,
                        display:"flex", alignItems:"center", justifyContent:"center",
                        fontSize:13, fontWeight:800, color:"#fff", letterSpacing:".04em",
                      }}>{initials(v.name)}</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight:700, fontSize:14, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{v.name}</div>
                        {v.role && <div style={{ fontSize:12, color:"var(--muted)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{v.role}</div>}
                      </div>
                      <div style={{ display:"flex", gap:5, flexShrink:0 }}>
                        <button onClick={() => openEditVolunteer(v)} title="Edit" style={{ width:30, height:30, borderRadius:7, display:"flex", alignItems:"center", justifyContent:"center", border:"1px solid var(--border)", background:"none", cursor:"pointer", color:"var(--muted)" }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button onClick={() => { if (window.confirm(`Remove ${v.name}?`)) deleteVolunteer(v.id); }} title="Remove" style={{ width:30, height:30, borderRadius:7, display:"flex", alignItems:"center", justifyContent:"center", border:"1px solid #fecaca", background:"none", cursor:"pointer", color:"#e05c6a" }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                        </button>
                      </div>
                    </div>
                    {/* Card body */}
                    <div style={{ padding:"12px 14px", display:"flex", flexDirection:"column", gap:8 }}>
                      <span style={{
                        alignSelf:"flex-start", fontSize:11, padding:"4px 12px", borderRadius:20, fontWeight:700,
                        background: v.status === "Confirmed" ? "#52c4a020" : "#f4a04120",
                        color:      v.status === "Confirmed" ? "#52c4a0"   : "#f4a041",
                      }}>{v.status === "Confirmed" ? "✓ " : "⏱ "}{v.status}</span>
                      {v.email && <div style={{ fontSize:12, color:"var(--muted)", display:"flex", alignItems:"center", gap:6 }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                        {v.email}
                      </div>}
                      {v.phone && <div style={{ fontSize:12, color:"var(--muted)", display:"flex", alignItems:"center", gap:6 }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.56 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                        {v.phone}
                      </div>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* ── DESKTOP: table-style list ── */
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
                    <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                      <button onClick={() => openEditVolunteer(v)} title="Edit" style={{
                        padding:"5px 10px", fontSize:11, border:"1px solid var(--border)",
                        borderRadius:7, background:"none", cursor:"pointer", color:"var(--muted)", fontWeight:600,
                      }}>Edit</button>
                      <button onClick={() => { if (window.confirm(`Remove ${v.name}?`)) deleteVolunteer(v.id); }} title="Remove" style={{
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
                    <Button variant="secondary" onClick={() => setVolunteerModal(null)}>Cancel</Button>
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
            <div style={{ display:"flex", flexDirection: isMobile ? "column" : "row", justifyContent:"space-between", alignItems: isMobile ? "stretch" : "flex-start", gap: isMobile ? 12 : 0, marginBottom:20 }}>
              <SectionHead title="Vendors" sub="Service providers and contractors for the event" />
              <Button size="sm" onClick={openAddVendor} style={{ width: isMobile ? "100%" : "auto" }}>Add Vendor</Button>
            </div>

            {vendors.length === 0 ? (
              <div style={{ textAlign:"center", padding:"40px 20px", background:"var(--surface)", borderRadius:12, border:"1.5px dashed var(--border)" }}>
                <div style={{ fontSize:28, marginBottom:10 }}>🏢</div>
                <p style={{ fontWeight:700, marginBottom:4, fontSize:14 }}>No vendors yet</p>
                <p style={{ color:"var(--muted)", fontSize:12, marginBottom:16 }}>Add photographers, costume rental, lighting & sound vendors.</p>
                <Button size="sm" onClick={openAddVendor}>Add First Vendor</Button>
              </div>
            ) : isMobile ? (
              /* ── MOBILE: card-per-vendor ── */
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {vendors.map((v) => (
                  <div key={v.id} style={{ background:"var(--card)", borderRadius:12, border:"1px solid var(--border)", overflow:"hidden" }}>
                    {/* Card header */}
                    <div style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 14px", background:"var(--surface)", borderBottom:"1px solid var(--border)" }}>
                      <div style={{
                        width:36, height:36, borderRadius:9, flexShrink:0,
                        background:"linear-gradient(135deg, #f4a041, #e05c6a)",
                        display:"flex", alignItems:"center", justifyContent:"center",
                      }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2" y="7" width="20" height="14" rx="2"/>
                          <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
                        </svg>
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight:700, fontSize:14, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{v.name}</div>
                        {v.service && <div style={{ fontSize:12, color:"var(--muted)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{v.service}</div>}
                      </div>
                      <div style={{ display:"flex", gap:5, flexShrink:0 }}>
                        <button onClick={() => openEditVendor(v)} title="Edit" style={{ width:30, height:30, borderRadius:7, display:"flex", alignItems:"center", justifyContent:"center", border:"1px solid var(--border)", background:"none", cursor:"pointer", color:"var(--muted)" }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button onClick={() => { if (window.confirm(`Remove ${v.name}?`)) deleteVendor(v.id); }} title="Remove" style={{ width:30, height:30, borderRadius:7, display:"flex", alignItems:"center", justifyContent:"center", border:"1px solid #fecaca", background:"none", cursor:"pointer", color:"#e05c6a" }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                        </button>
                      </div>
                    </div>
                    {/* Card body */}
                    <div style={{ padding:"12px 14px", display:"flex", flexDirection:"column", gap:8 }}>
                      <span style={{
                        alignSelf:"flex-start", fontSize:11, padding:"4px 12px", borderRadius:20, fontWeight:700,
                        background: v.status === "Confirmed" ? "#52c4a020" : "#f4a04120",
                        color:      v.status === "Confirmed" ? "#52c4a0"   : "#f4a041",
                      }}>{v.status === "Confirmed" ? "✓ " : "⏱ "}{v.status}</span>
                      {v.contact && <div style={{ fontSize:12, color:"var(--muted)", display:"flex", alignItems:"center", gap:6 }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        {v.contact}
                      </div>}
                      {v.phone && <div style={{ fontSize:12, color:"var(--muted)", display:"flex", alignItems:"center", gap:6 }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.56 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                        {v.phone}
                      </div>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* ── DESKTOP: table-style list ── */
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
                    <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                      <button onClick={() => openEditVendor(v)} title="Edit" style={{
                        padding:"5px 10px", fontSize:11, border:"1px solid var(--border)",
                        borderRadius:7, background:"none", cursor:"pointer", color:"var(--muted)", fontWeight:600,
                      }}>Edit</button>
                      <button onClick={() => { if (window.confirm(`Remove ${v.name}?`)) deleteVendor(v.id); }} title="Remove" style={{
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
                  <Button variant="secondary" onClick={() => setVendorModal(null)}>Cancel</Button>
                  <Button onClick={saveVendor}>{vendorModal?.id ? "Save Changes" : "Add Vendor"}</Button>
                </div>
              </Modal>
            )}
          </div>
        )}

        {/* ── TO-DOS ── */}
        {tab === "tasks" && (
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
              <SectionHead title="To-Dos" sub="Tasks linked to this recital — they also appear on the main To-Dos page" />
              {recitalTodos.length > 0 && (
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ width:80, height:6, borderRadius:3, background:"var(--border)", overflow:"hidden" }}>
                    <div style={{ height:"100%", width:pct+"%", background:color, borderRadius:3, transition:"width .3s" }} />
                  </div>
                  <span style={{ fontSize:12, color:"var(--muted)", fontWeight:600 }}>{done}/{recitalTodos.length} done</span>
                </div>
              )}
            </div>

            {recitalTodos.length === 0 ? (
              <p style={{ fontSize:13, color:"var(--muted)", marginBottom:20 }}>No to-dos yet. Add the first one below.</p>
            ) : isMobile ? (
              /* ── MOBILE: card-per-todo ── */
              <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:16 }}>
                {recitalTodos.map((t) => (
                  <div key={t.id} style={{ background: t.is_complete ? "var(--surface)" : "var(--card)", borderRadius:12, border:"1px solid var(--border)", overflow:"hidden", transition:"background .1s" }}>
                    {/* Card header */}
                    <div style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 14px", background:"var(--surface)", borderBottom:"1px solid var(--border)" }}>
                      <div
                        onClick={() => toggleTodoMut.mutate(t.id)}
                        style={{
                          width:28, height:28, borderRadius:"50%", flexShrink:0, cursor:"pointer",
                          border: t.is_complete ? "none" : "2px solid var(--border)",
                          background: t.is_complete ? color : "transparent",
                          display:"flex", alignItems:"center", justifyContent:"center",
                          transition:"all .15s",
                        }}>
                        {t.is_complete && <CheckIcon />}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{
                          fontWeight:700, fontSize:14,
                          overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                          textDecoration: t.is_complete ? "line-through" : "none",
                          color: t.is_complete ? "var(--muted)" : "var(--text)",
                        }}>{t.title}</div>
                      </div>
                      <button
                        onClick={() => deleteTodoMut.mutate(t.id)}
                        title="Delete"
                        style={{ width:30, height:30, borderRadius:7, display:"flex", alignItems:"center", justifyContent:"center", border:"none", background:"none", cursor:"pointer", color:"#c7c7cc", flexShrink:0 }}
                        onMouseEnter={e => { e.currentTarget.style.color = "#ff3b30"; }}
                        onMouseLeave={e => { e.currentTarget.style.color = "#c7c7cc"; }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3,6 5,6 21,6"/><path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a1,1,0,0,1,1-1h4a1,1,0,0,1,1,1v2"/>
                        </svg>
                      </button>
                    </div>
                    {/* Card body */}
                    <div style={{ padding:"12px 14px", display:"flex", flexDirection:"column", gap:8 }}>
                      <div style={{ display:"flex", gap:7, flexWrap:"wrap", alignItems:"center" }}>
                        <span style={{
                          alignSelf:"flex-start", fontSize:11, padding:"4px 12px", borderRadius:20, fontWeight:700,
                          background: t.is_complete ? "#52c4a020" : "var(--border)",
                          color:      t.is_complete ? "#52c4a0"   : "var(--muted)",
                        }}>{t.is_complete ? "Done" : "Open"}</span>
                        <span style={{ display:"flex", alignItems:"center", gap:4, fontSize:11, fontWeight:600, color: t.assigned_to ? "var(--text)" : "var(--muted)", background:"var(--surface)", padding:"2px 8px", borderRadius:999 }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                          {t.assigned_to || "Not assigned"}
                        </span>
                        {t.due_date && (
                          <span style={{ display:"flex", alignItems:"center", gap:4, fontSize:11, color:"var(--muted)", background:"var(--surface)", padding:"2px 8px", borderRadius:999, fontWeight:600 }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                            End by {t.due_date.slice(0,10)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* ── DESKTOP: table-style list ── */
              <div style={{ borderRadius:12, overflow:"hidden", border:"1px solid var(--border)", marginBottom:16 }}>
                {recitalTodos.map((t, i) => (
                  <div key={t.id}
                    style={{
                      display:"flex", alignItems:"center", padding:"14px 20px", gap:14,
                      background: t.is_complete ? "var(--surface)" : "var(--card)",
                      borderBottom: i < recitalTodos.length - 1 ? "1px solid var(--border)" : "none",
                      transition:"background .1s",
                    }}>
                    <div
                      onClick={() => toggleTodoMut.mutate(t.id)}
                      style={{
                        width:22, height:22, borderRadius:"50%", flexShrink:0, cursor:"pointer",
                        border: t.is_complete ? "none" : "2px solid var(--border)",
                        background: t.is_complete ? color : "transparent",
                        display:"flex", alignItems:"center", justifyContent:"center",
                        transition:"all .15s",
                      }}>
                      {t.is_complete && <CheckIcon />}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <span style={{
                        fontSize:14, display:"block",
                        textDecoration: t.is_complete ? "line-through" : "none",
                        color: t.is_complete ? "var(--muted)" : "var(--text)",
                      }}>{t.title}</span>
                      <div style={{ display:"flex", gap:7, marginTop:5, flexWrap:"wrap", alignItems:"center" }}>
                        <span style={{ display:"flex", alignItems:"center", gap:4, fontSize:11, fontWeight:600, color: t.assigned_to ? "var(--text)" : "var(--muted)", background:"var(--surface)", padding:"2px 8px", borderRadius:999 }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                          {t.assigned_to || "Not assigned"}
                        </span>
                        {t.due_date && (
                          <span style={{ display:"flex", alignItems:"center", gap:4, fontSize:11, color:"var(--muted)", background:"var(--surface)", padding:"2px 8px", borderRadius:999, fontWeight:600 }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                            End by {t.due_date.slice(0,10)}
                          </span>
                        )}
                      </div>
                    </div>
                    <span style={{
                      fontSize:11, padding:"4px 12px", borderRadius:20, fontWeight:700, flexShrink:0,
                      background: t.is_complete ? "#52c4a020" : "var(--border)",
                      color:      t.is_complete ? "#52c4a0"   : "var(--muted)",
                    }}>{t.is_complete ? "Done" : "Open"}</span>
                    <button
                      onClick={() => deleteTodoMut.mutate(t.id)}
                      title="Delete"
                      style={{ background:"none", border:"none", cursor:"pointer", color:"#c7c7cc", padding:"2px 4px", display:"flex", alignItems:"center", flexShrink:0 }}
                      onMouseEnter={e => { e.currentTarget.style.color = "#ff3b30"; }}
                      onMouseLeave={e => { e.currentTarget.style.color = "#c7c7cc"; }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3,6 5,6 21,6"/><path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a1,1,0,0,1,1-1h4a1,1,0,0,1,1,1v2"/>
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add to-do inputs */}
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              <div style={{ display:"flex", gap:8, flexWrap: isMobile ? "wrap" : "nowrap" }}>
                <input
                  value={newTask}
                  onChange={e => setNewTask(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addTask()}
                  placeholder="Add a new to-do… (press Enter)"
                  style={{
                    flex:1, padding:"10px 16px",
                    border:"1.5px solid var(--border)", borderRadius:10,
                    fontSize:13, background:"var(--surface)",
                    color:"var(--text)", outline:"none",
                    fontFamily:"inherit",
                  }}
                />
                <Button onClick={addTask} disabled={createTodoMut.isPending}>
                  {createTodoMut.isPending ? "Adding…" : "Add To-Do"}
                </Button>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:8, paddingLeft:4 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                <input
                  value={newTaskAssignedTo}
                  onChange={e => setNewTaskAssignedTo(e.target.value)}
                  placeholder="Assign to (optional)"
                  style={{
                    flex:1, padding:"7px 12px",
                    border:"1.5px solid var(--border)", borderRadius:8,
                    fontSize:12, background:"var(--surface)",
                    color:"var(--text)", outline:"none",
                    fontFamily:"inherit",
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── VENUE ── */}
        {tab === "venue" && (
          <div>
            {/* ── Uber-style confirmation status banner ── */}
            <div style={{
              display:"flex", flexDirection: isMobile ? "column" : "row",
              alignItems: isMobile ? "stretch" : "center", justifyContent:"space-between",
              padding: isMobile ? "16px 18px" : "18px 24px",
              borderRadius:14, marginBottom:24,
              background: venueConfirmed ? "linear-gradient(135deg,#52c4a015,#52c4a008)" : "linear-gradient(135deg,#f4a04115,#f4a04108)",
              border: `1.5px solid ${venueConfirmed ? "#52c4a040" : "#f4a04140"}`,
              transition:"all .3s",
            }}>
              <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                <div style={{
                  width: isMobile ? 44 : 52, height: isMobile ? 44 : 52, borderRadius:"50%",
                  background: venueConfirmed ? "#52c4a0" : "#f4a041",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  transition:"background .3s", flexShrink:0,
                  boxShadow: `0 4px 16px ${venueConfirmed ? "#52c4a040" : "#f4a04140"}`,
                }}>
                  <SvgIcon name={venueConfirmed ? "check-circle" : "clock"} size={isMobile ? 22 : 26} color="#fff" />
                </div>
                <div>
                  <div style={{ fontSize: isMobile ? 15 : 17, fontWeight:800, color:"var(--text)", marginBottom:3 }}>
                    {venueConfirmed ? "Venue Confirmed" : "Venue Not Confirmed"}
                  </div>
                  <div style={{ fontSize:12, color:"var(--muted)", fontWeight:500 }}>
                    {venueConfirmed
                      ? "The venue has been confirmed and booked for this event."
                      : "Tap to mark the venue as confirmed once booking is finalized."}
                  </div>
                </div>
              </div>
              {/* Toggle button */}
              <button
                onClick={() => {
                  const next = !venueConfirmed;
                  setVenueConfirmed(next);
                  localStorage.setItem(VENUE_CONFIRMED_KEY, String(next));
                  toast.success(next ? "Venue marked as confirmed!" : "Venue marked as unconfirmed");
                }}
                style={{
                  padding: isMobile ? "10px 14px" : "10px 20px",
                  borderRadius:10, border:"none", cursor:"pointer",
                  background: venueConfirmed ? "#52c4a0" : "#f4a041",
                  color:"#fff", fontWeight:700,
                  fontSize: isMobile ? 13 : 13,
                  transition:"all .2s", flexShrink:0,
                  marginLeft: isMobile ? 0 : 12, marginTop: isMobile ? 14 : 0,
                  width: isMobile ? "100%" : "auto",
                  boxShadow: `0 2px 10px ${venueConfirmed ? "#52c4a050" : "#f4a04150"}`,
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = ".88"}
                onMouseLeave={e => e.currentTarget.style.opacity = "1"}
              >
                {venueConfirmed ? "Mark Unconfirmed" : "Mark Confirmed"}
              </button>
            </div>

            {/* ── Venue Details Card ── */}
            <div style={{ marginBottom:24 }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
                <SectionHead title="Venue Details" sub="Address, contact, and booking information" />
                {!venueEditing ? (
                  <button
                    onClick={() => { setVenueForm({ ...venueDetails }); setVenueEditing(true); }}
                    style={{
                      display:"flex", alignItems:"center", gap:6,
                      padding:"8px 14px", borderRadius:9,
                      border:"1.5px solid var(--border)",
                      background:"var(--surface)", cursor:"pointer",
                      fontSize:12, fontWeight:600, color:"var(--text)",
                    }}
                  >
                    <SvgIcon name="pencil" size={13} color="var(--muted)" />
                    Edit
                  </button>
                ) : (
                  <div style={{ display:"flex", gap:8 }}>
                    <button
                      onClick={() => setVenueEditing(false)}
                      style={{ padding:"8px 14px", borderRadius:9, border:"1.5px solid var(--border)", background:"var(--surface)", cursor:"pointer", fontSize:12, fontWeight:600, color:"var(--muted)" }}
                    >Cancel</button>
                    <button
                      onClick={() => {
                        setVenueDetails({ ...venueForm });
                        localStorage.setItem(VENUE_KEY, JSON.stringify(venueForm));
                        setVenueEditing(false);
                        toast.success("Venue details saved");
                      }}
                      style={{ padding:"8px 16px", borderRadius:9, border:"none", background:"var(--accent)", cursor:"pointer", fontSize:12, fontWeight:700, color:"#fff" }}
                    >Save</button>
                  </div>
                )}
              </div>

              <div style={{
                display:"grid",
                gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                gap: 14,
                background:"var(--surface)", borderRadius:14,
                border:"1px solid var(--border)", padding: isMobile ? "18px 16px" : "22px 24px",
              }}>
                {[
                  { label:"Venue Name",  key:"name",     placeholder:"e.g. Grand Theater", icon:"map-pin" },
                  { label:"Address",     key:"address",  placeholder:"123 Main St, City, ST 00000", icon:"map-pin" },
                  { label:"Contact Person", key:"contact", placeholder:"e.g. Sarah Williams", icon:"users" },
                  { label:"Phone",       key:"phone",    placeholder:"(555) 000-0000", icon:"phone" },
                  { label:"Email",       key:"email",    placeholder:"venue@example.com", icon:"mail" },
                  { label:"Website",     key:"website",  placeholder:"https://venue.com", icon:"globe" },
                  { label:"Capacity",    key:"capacity", placeholder:"e.g. 500 seats", icon:"users" },
                ].map(({ label, key, placeholder, icon }) => (
                  <div key={key} style={{ display:"flex", flexDirection:"column", gap:6 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6, color:"var(--muted)" }}>
                      <SvgIcon name={icon} size={12} color="var(--muted)" />
                      <span style={{ fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:".06em" }}>{label}</span>
                    </div>
                    {venueEditing ? (
                      <input
                        value={venueForm[key] || ""}
                        onChange={e => setVenueForm(p => ({ ...p, [key]: e.target.value }))}
                        placeholder={placeholder}
                        style={{
                          padding:"9px 12px", border:"1.5px solid var(--border)",
                          borderRadius:8, fontSize:13, background:"var(--card)",
                          color:"var(--text)", outline:"none", fontFamily:"inherit",
                          width:"100%", boxSizing:"border-box",
                        }}
                        onFocus={e => e.target.style.borderColor = "var(--accent)"}
                        onBlur={e => e.target.style.borderColor = "var(--border)"}
                      />
                    ) : (
                      <div style={{ fontSize:13, fontWeight:600, color: venueDetails[key] ? "var(--text)" : "var(--muted)", padding:"9px 0", borderBottom:"1px solid var(--border)" }}>
                        {venueDetails[key] || <span style={{ fontStyle:"italic", fontWeight:400 }}>Not set</span>}
                      </div>
                    )}
                  </div>
                ))}

                {/* Notes — full width */}
                <div style={{ gridColumn: isMobile ? "1" : "1 / -1", display:"flex", flexDirection:"column", gap:6 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6, color:"var(--muted)" }}>
                    <SvgIcon name="file-text" size={12} color="var(--muted)" />
                    <span style={{ fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:".06em" }}>Notes</span>
                  </div>
                  {venueEditing ? (
                    <textarea
                      value={venueForm.notes || ""}
                      onChange={e => setVenueForm(p => ({ ...p, notes: e.target.value }))}
                      placeholder="Parking info, loading dock access, setup requirements, etc."
                      rows={3}
                      style={{
                        padding:"9px 12px", border:"1.5px solid var(--border)",
                        borderRadius:8, fontSize:13, background:"var(--card)",
                        color:"var(--text)", outline:"none", fontFamily:"inherit",
                        width:"100%", boxSizing:"border-box", resize:"vertical",
                      }}
                      onFocus={e => e.target.style.borderColor = "var(--accent)"}
                      onBlur={e => e.target.style.borderColor = "var(--border)"}
                    />
                  ) : (
                    <div style={{ fontSize:13, fontWeight:600, color: venueDetails.notes ? "var(--text)" : "var(--muted)", padding:"9px 0", borderBottom:"1px solid var(--border)", lineHeight:1.6, whiteSpace:"pre-wrap" }}>
                      {venueDetails.notes || <span style={{ fontStyle:"italic", fontWeight:400 }}>No notes</span>}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Confirmation Log ── */}
            <div>
              <div style={{ marginBottom:14 }}>
                <h2 style={{ fontSize:16, fontWeight:800, margin:"0 0 4px" }}>Confirmation Log</h2>
                <p style={{ fontSize:12, color:"var(--muted)", margin:0 }}>Paste emails, messages, or any communication confirming the venue booking here.</p>
              </div>
              <textarea
                value={venueConvo}
                onChange={e => {
                  setVenueConvo(e.target.value);
                  localStorage.setItem(VENUE_CONVO_KEY, e.target.value);
                }}
                placeholder={"Paste your confirmation email, text messages, or any communication here…\n\nExample:\nFrom: bookings@grandtheater.com\nDate: March 10, 2026\n\nDear Studio Owner,\nWe are pleased to confirm your booking for June 15th, 2026…"}
                style={{
                  width:"100%", boxSizing:"border-box",
                  minHeight: isMobile ? 200 : 280,
                  padding: isMobile ? "14px 14px" : "16px 18px",
                  border:"1.5px solid var(--border)", borderRadius:12,
                  fontSize:13, lineHeight:1.7,
                  background:"var(--surface)", color:"var(--text)",
                  outline:"none", fontFamily:"ui-monospace, 'Cascadia Code', monospace",
                  resize:"vertical",
                  transition:"border-color .15s",
                }}
                onFocus={e => e.target.style.borderColor = "var(--accent)"}
                onBlur={e => e.target.style.borderColor = "var(--border)"}
              />
              {venueConvo && (
                <div style={{ display:"flex", justifyContent:"flex-end", marginTop:8 }}>
                  <span style={{ fontSize:11, color:"var(--muted)", display:"flex", alignItems:"center", gap:5 }}>
                    <SvgIcon name="check-circle" size={12} color="#52c4a0" />
                    Auto-saved
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* ── Cover crop modal ── */}
      {cropFile && (
        <CoverCropModal
          file={cropFile}
          onConfirm={(dataUrl) => { setCropFile(null); saveCoverPhoto(dataUrl); }}
          onCancel={() => setCropFile(null)}
        />
      )}
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
  const navigate = useNavigate();

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
      qc.invalidateQueries({ queryKey: ["recitals", sid] });
      qc.invalidateQueries({ queryKey: ["events"], exact: false });
      toast.success("Event deleted");
      if (detailId === id) setDetailId(null);
    },
    onError: err => toast.error(err.error || "Failed to delete"),
  });

  const openAdd  = () => { setForm({ ...EMPTY }); setModal({}); };
  const openEdit = (r) => {
    setForm({ title:r.title||"", event_date:r.event_date?.split("T")[0]||"", venue:r.venue||"", description:r.description||"" });
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

  // Auto-open the create modal when navigated with ?new=1 query param
  useEffect(() => {
    if (new URLSearchParams(location.search).get('new') === '1') {
      openAdd();
      // Strip the param from the URL without triggering a navigation
      window.history.replaceState({}, '', '/schedule');
    }
  }, [location.search]); // eslint-disable-line

  // ── Show full-page detail when detailId is set ─────────────────────────────
  if (detailId) {
    const detailRecital = recitals.find(r => r.id === detailId);
    const recitalDate   = (detailRecital?.event_date || '').slice(0, 10);
    return (
      <RecitalDetail
        id={detailId}
        sid={sid}
        onBack={() => navigate('/schedule', recitalDate ? { state: { goToDate: recitalDate } } : {})}
        onEdit={(r) => { openEdit(r); }}
        onDuplicated={(newId) => setDetailId(newId)}
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
              padding:"7px 13px", border:"none", cursor:"pointer", transition:"all .15s", display:"flex", alignItems:"center", justifyContent:"center",
              background:view==="grid" ? "var(--accent)" : "transparent",
              color:view==="grid" ? "#fff" : "var(--muted)",
            }}><SvgIcon name="grid" size={16} /></button>
            <button onClick={() => setView("table")} style={{
              padding:"7px 13px", border:"none", borderLeft:"1.5px solid var(--border)", cursor:"pointer", transition:"all .15s", display:"flex", alignItems:"center", justifyContent:"center",
              background:view==="table" ? "var(--accent)" : "transparent",
              color:view==="table" ? "#fff" : "var(--muted)",
            }}><SvgIcon name="list" size={16} /></button>
          </div>
          <Button onClick={openAdd}>New Event</Button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <p style={{ color:"var(--muted)" }}>Loading…</p>

      ) : sorted.length === 0 ? (
        <div style={{ textAlign:"center", padding:48, background:"var(--card)", borderRadius:16, border:"1.5px dashed var(--border)" }}>
          <div style={{ marginBottom:12 }}><SvgIcon name="star" size={34} color="var(--muted)" /></div>
          <p style={{ fontWeight:700, marginBottom:4 }}>No events yet</p>
          <p style={{ color:"var(--muted)", fontSize:13, marginBottom:16 }}>Plan your first recital or performance!</p>
          <Button onClick={openAdd}>New Event</Button>
        </div>

      ) : view === "grid" ? (
        /* Grid cards */
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(280px, 1fr))", gap:12 }}>
          {sorted.map(r => {
            const color = RECITAL_COLOR;
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
                    </div>
                  </div>
                  {r.venue && (
                    <div style={{ fontSize:11, color:"var(--muted)", marginBottom:8, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", display:"flex", alignItems:"center" }}><SvgIcon name="map-pin" size={10} color="var(--muted)" style={{marginRight:4,flexShrink:0}} />{r.venue}</div>
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
                {["Date","Event","Venue","Tasks",""].map(h => (
                  <th key={h} style={{ padding:"11px 14px", textAlign:"left", fontSize:11, fontWeight:700, letterSpacing:".06em", textTransform:"uppercase", color:"var(--muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(r => {
                const color = RECITAL_COLOR;
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
                        <Button size="sm" variant="secondary" onClick={() => openEdit(r)}>Edit</Button>
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
              <Field label="Description">
                <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description:e.target.value }))} rows={3} />
              </Field>
            </div>
            <div style={{ display:"flex", justifyContent:"flex-end", gap:8, marginTop:20 }}>
              <Button variant="secondary" type="button" onClick={() => setModal(null)}>Cancel</Button>
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
