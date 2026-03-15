import React, { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { schools as schoolsApi } from '../api';
import toast from 'react-hot-toast';

/* ── Helpers ───────────────────────────────────────────────── */
function Divider() {
  return <div style={{ borderTop: '1px solid var(--border)', margin: '0' }} />;
}
function Eyebrow({ children, center }) {
  return (
    <div style={{
      fontSize: 12, fontWeight: 700, letterSpacing: '0.1em',
      textTransform: 'uppercase', color: 'var(--muted)',
      marginBottom: 14, textAlign: center ? 'center' : 'left',
    }}>
      {children}
    </div>
  );
}
function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
}

/* ── Default extended content ──────────────────────────────── */
function buildDefaults(name, owner, city, style) {
  return {
    tagline: `Dedicated to the art of ${style} — where rhythm, expression, and tradition meet.`,
    stats: [
      { stat: '15+',       label: 'Years of teaching\nexperience' },
      { stat: 'All ages',  label: 'Children, teens\nand adults' },
      { stat: city || 'PNW', label: 'Pacific Northwest\ncommunity' },
      { stat: (style || 'Classical').split(' ')[0], label: 'Lineage rooted in\nclassical tradition' },
    ],
    art_form_tagline: 'One of the oldest classical dance traditions in the world.',
    art_form_body: `Rooted in ancient temple traditions of South India, ${style} combines rhythmic footwork, expressive storytelling, sculptural poses, and devotional spirit into a single, breathtaking art form.`,
    art_form_bullets: [
      'Foundational movements & technique',
      'Abhinaya — expression & storytelling',
      'Classical compositions & repertoire',
      'Cultural context, rhythm, and aesthetics',
    ],
    philosophy_quote: 'Dance is more than performance — it is a journey of discipline, cultural connection, and inner expression.',
    philosophy_body: `At ${name}, ${style} blends body, mind, and emotion into a living art form passed down through generations. We cultivate respect for tradition, confidence, grace, and a deep connection to musical storytelling.`,
    owner_title: 'Founder & Artistic Director',
    owner_bio: `${(owner || '').split(' ')[0]} founded ${name} in ${city} with the vision of creating a vibrant community space for learning ${style}. With years of teaching experience, their approach blends traditional rigor with encouragement and creativity — helping students build strong technique while genuinely loving the art form.`,
    team_members: [
      {
        id: 'member_1',
        name: owner,
        title: 'Founder & Artistic Director',
        bio: `${(owner || '').split(' ')[0]} founded ${name} in ${city} with the vision of creating a vibrant community space for learning ${style}. With years of teaching experience, their approach blends traditional rigor with encouragement and creativity — helping students build strong technique while genuinely loving the art form.`,
        photo: null,
      }
    ],
    welcome_title: 'Your journey begins here.',
    welcome_body: `We warmly welcome students of all backgrounds. Whether you are discovering ${style} for the first time or continuing your journey, ${name} offers a supportive and inspiring space to learn.`,
    welcome_badges: [
      'Beginner-friendly classes',
      'Small group instruction',
      'Performance opportunities',
      `Cultural community in ${city}`,
    ],
  };
}

/* ── Inline edit components ────────────────────────────────── */
const E_BASE = {
  fontFamily: 'inherit', background: '#ebf3ff',
  border: 'none', borderBottom: '2px solid #0071e3',
  borderRadius: '4px 4px 0 0', outline: 'none',
  width: '100%', boxSizing: 'border-box', display: 'block',
};
function EText({ value, onChange, style }) {
  return (
    <input
      type="text" value={value || ''}
      onChange={e => onChange(e.target.value)}
      style={{ ...E_BASE, ...style, padding: style?.padding || '2px 6px' }}
    />
  );
}
function EArea({ value, onChange, style, rows = 3 }) {
  return (
    <textarea
      value={value || ''} rows={rows}
      onChange={e => onChange(e.target.value)}
      style={{ ...E_BASE, ...style, padding: style?.padding || '4px 6px', resize: 'vertical', lineHeight: style?.lineHeight || 1.6 }}
    />
  );
}

/* ── Section metadata ──────────────────────────────────────── */
const SECTION_META = {
  hero:        { label: 'Hero / Banner' },
  stats:       { label: 'Stats Strip' },
  art_form:    { label: 'Art Form' },
  philosophy:  { label: 'Our Philosophy' },
  people:      { label: 'Our Team' },
  contact:     { label: 'Contact' },
  welcome:     { label: 'New Students' },
};
const DEFAULT_SECTION_ORDER = ['hero', 'stats', 'art_form', 'philosophy', 'people', 'contact', 'welcome'];

/* ── SectionWrapper ────────────────────────────────────────── */
function SectionWrapper({ sectionKey, editMode, dragOverKey, onDragStart, onDragOver, onDrop, onDelete, onDuplicate, children }) {
  const baseKey = sectionKey.includes('__') ? sectionKey.split('__')[0] : sectionKey;
  const meta = SECTION_META[baseKey];
  return (
    <div
      draggable={editMode}
      onDragStart={editMode ? onDragStart : undefined}
      onDragOver={editMode ? onDragOver : undefined}
      onDrop={editMode ? onDrop : undefined}
      style={{
        position: 'relative',
        borderTop: dragOverKey === sectionKey ? '3px solid #0071e3' : '3px solid transparent',
      }}
    >
      {editMode && (
        <div style={{
          background: '#f0f7ff',
          borderBottom: '1px solid #cce0ff',
          padding: '6px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <span style={{ cursor: 'grab', opacity: 0.5, fontSize: 16, letterSpacing: 1 }}>⠿⠿</span>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#0071e3' }}>
            {meta?.label}
          </span>
          <div style={{ flex: 1 }} />
          {/* Duplicate button */}
          <button onClick={onDuplicate} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '2px 6px' }}>
            Duplicate
          </button>
          {baseKey !== 'hero' && (
            <button
              onClick={onDelete}
              style={{
                background: 'none',
                border: 'none',
                color: '#ff3b30',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                padding: '2px 6px',
              }}
            >
              Remove
            </button>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

/* ── AddSectionButton ──────────────────────────────────────── */
function AddSectionButton({ position, addingAt, setAddingAt, available, onAdd }) {
  const isOpen = addingAt === position;
  if (!available.length) return null;
  return (
    <div style={{ textAlign: 'center', padding: '4px 0', position: 'relative' }}>
      <button
        onClick={() => setAddingAt(isOpen ? null : position)}
        style={{
          fontSize: 11,
          color: '#0071e3',
          background: 'none',
          border: '1px dashed #0071e3',
          borderRadius: 6,
          padding: '3px 14px',
          cursor: 'pointer',
        }}
      >
        + Add Section
      </button>
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 12,
          zIndex: 100,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          minWidth: 300,
        }}>
          {available.map(key => (
            <button
              key={key}
              onClick={() => onAdd(key, position)}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '6px 14px',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              + {SECTION_META[key].label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────── */
export default function SchoolAboutPage() {
  const { user, school: authSchool, setSchool } = useAuth();
  const queryClient = useQueryClient();
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState(null);
  const [dragKey, setDragKey] = useState(null);
  const [dragOverKey, setDragOverKey] = useState(null);
  const [addingAt, setAddingAt] = useState(null);
  const [editingMemberId, setEditingMemberId] = useState(null);
  const logoInputRef = useRef(null);
  const photoInputRef = useRef(null);
  const memberPhotoInputRef = useRef(null);
  const isAdmin = user?.role === 'school_admin' || user?.role === 'superadmin';
  const schoolId = user?.school_id;

  const { data: schoolData } = useQuery({
    queryKey: ['school', schoolId],
    queryFn: () => schoolsApi.get(schoolId),
    enabled: !!schoolId,
  });

  /* unwrap { school: {...} } envelope or bare object */
  const school = useMemo(
    () => schoolData?.school || schoolData || authSchool || {},
    [schoolData, authSchool]
  );

  const name    = school.name        || 'Your Dance Studio';
  const owner   = school.owner_name  || 'Studio Director';
  const city    = school.city        || 'Your City';
  const style   = school.dance_style || 'Classical Dance';
  const email   = school.email       || '';
  const phone   = school.phone       || '';
  const address = school.address     || '';

  /* merge saved profile_json over computed defaults */
  const content = useMemo(() => {
    const defaults = buildDefaults(name, owner, city, style);
    const pj = school.profile_json
      ? (typeof school.profile_json === 'string' ? JSON.parse(school.profile_json) : school.profile_json)
      : {};
    const merged = { ...defaults, ...pj };
    if (!merged.section_order || !Array.isArray(merged.section_order) || merged.section_order.length === 0) {
      merged.section_order = [...DEFAULT_SECTION_ORDER];
    }
    return merged;
  }, [school, name, owner, city, style]);

  /* ── Edit helpers ─────────────────────────────────────── */
  const enterEdit = () => {
    const draft = { name, owner_name: owner, dance_style: style, city, email, phone, address, ...content };
    // Migrate legacy owner fields if team_members not yet present
    if (!draft.team_members || draft.team_members.length === 0) {
      draft.team_members = [{
        id: 'member_1',
        name: draft.owner_name || owner,
        title: draft.owner_title || 'Founder & Artistic Director',
        bio: draft.owner_bio || '',
        photo: draft.owner_photo || null,
      }];
    }
    setDraft(draft);
    setEditMode(true);
  };
  const discardEdit = () => { setDraft(null); setEditMode(false); setDragKey(null); setDragOverKey(null); setAddingAt(null); };

  const set = key => val => setDraft(d => ({ ...d, [key]: val }));
  const setStat = (i, key) => val => {
    const arr = [...(draft.stats || [])];
    arr[i] = { ...arr[i], [key]: val };
    setDraft(d => ({ ...d, stats: arr }));
  };
  const setBullet = i => val => {
    const arr = [...(draft.art_form_bullets || [])];
    arr[i] = val;
    setDraft(d => ({ ...d, art_form_bullets: arr }));
  };
  const setBadge = i => val => {
    const arr = [...(draft.welcome_badges || [])];
    arr[i] = val;
    setDraft(d => ({ ...d, welcome_badges: arr }));
  };

  /* ── Team member helpers ──────────────────────────────── */
  const updateMember = (id, key, val) => setDraft(d => ({
    ...d,
    team_members: (d.team_members || []).map(m => m.id === id ? { ...m, [key]: val } : m),
  }));
  const addMember = () => setDraft(d => ({
    ...d,
    team_members: [...(d.team_members || []), { id: `member_${Date.now()}`, name: '', title: 'Teacher', bio: '', photo: null }],
  }));
  const removeMember = (id) => setDraft(d => ({
    ...d,
    team_members: (d.team_members || []).filter(m => m.id !== id),
  }));
  const handleMemberPhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file || !editingMemberId) return;
    if (file.size > 1024 * 1024) { toast.error('Image must be under 1 MB'); e.target.value = ''; return; }
    const reader = new FileReader();
    reader.onload = ev => { updateMember(editingMemberId, 'photo', ev.target.result); setEditingMemberId(null); };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  /* display source: draft in edit mode, content otherwise */
  const D = editMode
    ? draft
    : { name, owner_name: owner, dance_style: style, city, email, phone, address, ...content };

  const sectionOrder = (D && D.section_order && D.section_order.length > 0)
    ? D.section_order
    : DEFAULT_SECTION_ORDER;

  /* ── Drag handlers ────────────────────────────────────── */
  const handleDragStart = (key) => (e) => {
    setDragKey(key);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (key) => (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (key !== dragOverKey) setDragOverKey(key);
  };
  const handleDrop = (targetKey) => (e) => {
    e.preventDefault();
    if (!dragKey || dragKey === targetKey) { setDragKey(null); setDragOverKey(null); return; }
    setDraft(d => {
      const order = [...(d.section_order || DEFAULT_SECTION_ORDER)];
      const fromIdx = order.indexOf(dragKey);
      const toIdx = order.indexOf(targetKey);
      if (fromIdx === -1 || toIdx === -1) return d;
      const newOrder = [...order];
      newOrder.splice(fromIdx, 1);
      newOrder.splice(toIdx, 0, dragKey);
      return { ...d, section_order: newOrder };
    });
    setDragKey(null);
    setDragOverKey(null);
  };

  /* ── Section add/remove ───────────────────────────────── */
  const handleAddSection = (key, position) => {
    setDraft(d => {
      const order = [...(d.section_order || DEFAULT_SECTION_ORDER)];
      const newOrder = [...order];
      newOrder.splice(position + 1, 0, key);
      return { ...d, section_order: newOrder };
    });
    setAddingAt(null);
  };
  const handleRemoveSection = (key) => {
    setDraft(d => {
      const order = (d.section_order || DEFAULT_SECTION_ORDER).filter(k => k !== key);
      return { ...d, section_order: order };
    });
  };

  /* ── Section duplicate ────────────────────────────────── */
  const handleDuplicateSection = (key) => {
    // For 'people', duplicate just adds a team member
    if (key === 'people' || key.startsWith('people')) {
      addMember();
      return;
    }
    // For other sections, create a new instance with a unique suffix key
    const newKey = `${key}__${Date.now()}`;
    setDraft(d => ({
      ...d,
      [`__copy_${newKey}`]: true,
      section_order: (() => {
        const order = [...(d.section_order || DEFAULT_SECTION_ORDER)];
        const idx = order.indexOf(key);
        const insertAt = idx === -1 ? order.length : idx + 1;
        order.splice(insertAt, 0, newKey);
        return order;
      })(),
    }));
  };

  /* ── Image upload helpers ─────────────────────────────── */
  const handleImageUpload = (field) => (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024) {
      toast.error('Image must be under 1 MB');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setDraft(d => ({ ...d, [field]: ev.target.result }));
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const updateMutation = useMutation({
    mutationFn: data => schoolsApi.update(schoolId, data),
    onSuccess: updated => {
      const s = updated?.school || updated;
      queryClient.invalidateQueries(['school', schoolId]);
      if (setSchool) setSchool(s);
      toast.success('Profile saved');
      setEditMode(false);
      setDraft(null);
    },
    onError: () => toast.error('Failed to save changes'),
  });

  const saveEdit = () => {
    const { name: n, owner_name, dance_style, city: c, email: e, phone: p, address: a, ...ext } = draft;
    updateMutation.mutate({ name: n, owner_name, dance_style, city: c, email: e, phone: p, address: a, profile_json: ext });
  };

  /* ── Available sections (not in current order) ─────────── */
  const availableSections = Object.keys(SECTION_META).filter(k => !sectionOrder.includes(k));

  /* ── Section renderers ────────────────────────────────── */
  const renderSection = (sectionKey) => {
    const baseKey = sectionKey.includes('__') ? sectionKey.split('__')[0] : sectionKey;
    switch (baseKey) {
      case 'hero':
        return (
          <section key={sectionKey} style={{ padding: '72px 64px 68px', textAlign: 'center', background: 'var(--card)', position: 'relative' }}>
            {isAdmin && !editMode && (
              <button onClick={enterEdit} style={{ position: 'absolute', top: 24, right: 28, display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', border: '1.5px solid var(--border)', borderRadius: 10, background: 'var(--card)', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text)', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Edit Page
              </button>
            )}
            {editMode && (
              <div style={{ position: 'absolute', top: 24, right: 28, background: '#ebf3ff', borderRadius: 10, padding: '7px 14px', fontSize: 12, fontWeight: 700, color: '#0071e3', letterSpacing: '0.04em' }}>
                ✏️ Editing
              </div>
            )}

            {/* School logo */}
            {D.school_logo && (
              <div style={{ marginBottom: 16 }}>
                <img src={D.school_logo} alt="School logo" style={{ height: 72, objectFit: 'contain', display: 'block', margin: '0 auto' }} />
              </div>
            )}

            <Eyebrow center>
              {editMode
                ? <EText value={D.city} onChange={set('city')} style={{ fontSize: 12, fontWeight: 700, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)'}} />
                : <>{D.city}{D.city && D.city !== 'Your City' ? ', Washington' : ''}</>
              }
            </Eyebrow>

            {editMode
              ? <EText value={D.name} onChange={set('name')} style={{ fontSize: 40, fontWeight: 900, letterSpacing: '-1.5px', lineHeight: 1.08, color: 'var(--text)', textAlign: 'center', maxWidth: 640, margin: '0 auto 16px' }} />
              : <h1 style={{ fontSize: 48, fontWeight: 900, letterSpacing: '-1.5px', lineHeight: 1.08, color: 'var(--text)', margin: '0 auto 24px', maxWidth: 640 }}>{D.name}</h1>
            }

            {/* Logo upload controls (edit mode only) */}
            {editMode && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 12, marginTop: 8 }}>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleImageUpload('school_logo')}
                />
                <button
                  onClick={() => logoInputRef.current?.click()}
                  style={{ fontSize: 12, color: '#0071e3', background: 'none', border: '1px solid #0071e3', borderRadius: 6, padding: '4px 12px', cursor: 'pointer' }}
                >
                  {D.school_logo ? 'Change logo' : 'Upload logo'}
                </button>
                {D.school_logo && (
                  <button
                    onClick={() => setDraft(d => ({ ...d, school_logo: null }))}
                    style={{ fontSize: 12, color: '#ff3b30', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Remove logo
                  </button>
                )}
              </div>
            )}

            {editMode
              ? <EArea value={D.tagline} onChange={set('tagline')} rows={2} style={{ fontSize: 17, color: 'var(--muted)', lineHeight: 1.6, maxWidth: 520, margin: '12px auto 0', fontWeight: 400, textAlign: 'center' }} />
              : <p style={{ fontSize: 19, color: 'var(--muted)', lineHeight: 1.6, maxWidth: 520, margin: '0 auto', fontWeight: 400 }}>{D.tagline}</p>
            }
          </section>
        );

      case 'stats':
        return (
          <section key={sectionKey} style={{ display: 'flex', padding: '44px 64px', background: 'var(--surface)', gap: 0 }}>
            {(D.stats || []).map(({ stat, label }, i, arr) => (
              <div key={i} style={{ flex: 1, textAlign: 'center', padding: '0 20px', borderRight: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                {editMode
                  ? <>
                      <EText value={stat} onChange={setStat(i, 'stat')} style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.5px', marginBottom: 4, textAlign: 'center' }} />
                      <EArea value={label} onChange={setStat(i, 'label')} rows={2} style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5, textAlign: 'center', marginTop: 6 }} />
                    </>
                  : <>
                      <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.5px', marginBottom: 6 }}>{stat}</div>
                      <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5, whiteSpace: 'pre-line' }}>{label}</div>
                    </>
                }
              </div>
            ))}
          </section>
        );

      case 'art_form':
        return (
          <section key={sectionKey} style={{ padding: '72px 64px', background: 'var(--card)' }}>
            <div style={{ display: 'flex', gap: 80, alignItems: 'flex-start' }}>
              <div style={{ flex: '0 0 280px' }}>
                <Eyebrow>The Art Form</Eyebrow>
                {editMode
                  ? <EText value={D.dance_style} onChange={set('dance_style')} style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-0.8px', color: 'var(--text)' }} />
                  : <h2 style={{ fontSize: 36, fontWeight: 900, letterSpacing: '-0.8px', lineHeight: 1.1, color: 'var(--text)', margin: 0 }}>{D.dance_style}.</h2>
                }
                <div style={{ marginTop: 14 }}>
                  {editMode
                    ? <EArea value={D.art_form_tagline} onChange={set('art_form_tagline')} rows={2} style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.6 }} />
                    : <p style={{ fontSize: 14, color: 'var(--muted)', margin: 0, lineHeight: 1.6 }}>{D.art_form_tagline}</p>
                  }
                </div>
              </div>
              <div style={{ flex: 1 }}>
                {editMode
                  ? <EArea value={D.art_form_body} onChange={set('art_form_body')} rows={5} style={{ fontSize: 15, color: 'var(--text)', lineHeight: 1.75, marginBottom: 16 }} />
                  : <p style={{ fontSize: 16, color: 'var(--text)', lineHeight: 1.75, marginBottom: 32 }}>{D.art_form_body}</p>
                }
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 14 }}>
                  At our {D.city} studio, students learn
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 32px' }}>
                  {(D.art_form_bullets || []).map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--text)', flexShrink: 0, marginTop: editMode ? 12 : 8 }} />
                      {editMode
                        ? <EText value={item} onChange={setBullet(i)} style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.55 }} />
                        : <span style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.55 }}>{item}</span>
                      }
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        );

      case 'philosophy':
        return (
          <section key={sectionKey} style={{ padding: '80px 64px', background: 'var(--surface)', textAlign: 'center' }}>
            <Eyebrow center>Our Philosophy</Eyebrow>
            {editMode
              ? <EArea value={D.philosophy_quote} onChange={set('philosophy_quote')} rows={3} style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.4px', lineHeight: 1.3, color: 'var(--text)', maxWidth: 580, margin: '0 auto 16px', textAlign: 'center' }} />
              : <blockquote style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.6px', lineHeight: 1.25, color: 'var(--text)', maxWidth: 580, margin: '0 auto 28px', fontStyle: 'normal' }}>
                  "{D.philosophy_quote}"
                </blockquote>
            }
            {editMode
              ? <EArea value={D.philosophy_body} onChange={set('philosophy_body')} rows={4} style={{ fontSize: 14, color: 'var(--muted)', maxWidth: 520, margin: '12px auto 0', lineHeight: 1.7, textAlign: 'center' }} />
              : <p style={{ fontSize: 15, color: 'var(--muted)', maxWidth: 520, margin: '0 auto', lineHeight: 1.7 }}>{D.philosophy_body}</p>
            }
          </section>
        );

      case 'people':
        return (
          <section key={sectionKey} style={{ padding: '72px 64px', background: 'var(--card)' }}>
            <Eyebrow>The People</Eyebrow>
            <h2 style={{ fontSize: 36, fontWeight: 900, letterSpacing: '-0.8px', lineHeight: 1.1, color: 'var(--text)', marginBottom: 52 }}>
              Guided by masters.
            </h2>

            {/* Hidden file input shared across all members */}
            <input ref={memberPhotoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleMemberPhotoUpload} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {(D.team_members && D.team_members.length > 0 ? D.team_members : [{ id: 'fallback', name: D.owner_name, title: D.owner_title, bio: D.owner_bio, photo: D.owner_photo }]).map((member, idx) => (
                <div key={member.id} style={{
                  display: 'flex', gap: 48, alignItems: 'flex-start',
                  paddingTop: idx > 0 ? 40 : 0,
                  marginTop: idx > 0 ? 40 : 0,
                  borderTop: idx > 0 ? '1px solid #e5e5e7' : 'none',
                }}>
                  {/* Avatar / photo */}
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    {member.photo
                      ? <img src={member.photo} alt={member.name} style={{ width: 72, height: 72, borderRadius: 20, objectFit: 'cover', display: 'block' }} />
                      : <div style={{ width: 72, height: 72, borderRadius: 20, background: 'linear-gradient(135deg, #1d1d1f 0%, #424245 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, color: '#fff' }}>
                          {initials(member.name)}
                        </div>
                    }
                    {editMode && (
                      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <button onClick={() => { setEditingMemberId(member.id); memberPhotoInputRef.current?.click(); }}
                          style={{ fontSize: 11, color: '#0071e3', background: 'none', border: '1px solid #0071e3', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          {member.photo ? 'Change' : 'Photo'}
                        </button>
                        {member.photo && (
                          <button onClick={() => updateMember(member.id, 'photo', null)}
                            style={{ fontSize: 11, color: '#ff3b30', background: 'none', border: 'none', cursor: 'pointer' }}>
                            Remove
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1 }}>
                    {editMode
                      ? <EText value={member.name} onChange={v => updateMember(member.id, 'name', v)} style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.3px', marginBottom: 6 }} />
                      : <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.3px', marginBottom: 4 }}>{member.name}</div>
                    }
                    {editMode
                      ? <EText value={member.title} onChange={v => updateMember(member.id, 'title', v)} style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 12 }} />
                      : <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 16 }}>{member.title}</div>
                    }
                    {editMode
                      ? <EArea value={member.bio} onChange={v => updateMember(member.id, 'bio', v)} rows={4} style={{ fontSize: 15, color: 'var(--text)', lineHeight: 1.75 }} />
                      : <p style={{ fontSize: 15, color: 'var(--text)', lineHeight: 1.75, margin: 0 }}>{member.bio}</p>
                    }
                    {/* Remove member button — only when >1 member and in edit mode */}
                    {editMode && (D.team_members || []).length > 1 && (
                      <button onClick={() => removeMember(member.id)}
                        style={{ marginTop: 12, fontSize: 12, color: '#ff3b30', background: 'none', border: '1px solid #ffcdd0', borderRadius: 6, padding: '4px 12px', cursor: 'pointer' }}>
                        − Remove this person
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Add team member button — only in edit mode */}
            {editMode && (
              <button onClick={addMember} style={{ marginTop: 40, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', border: '1.5px dashed #0071e3', borderRadius: 10, background: '#f0f7ff', color: '#0071e3', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                + Add Team Member
              </button>
            )}
          </section>
        );

      case 'contact':
        return (
          <section key={sectionKey} style={{ padding: '64px 64px', background: 'var(--surface)' }}>
            <Eyebrow>Contact</Eyebrow>
            <h2 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.6px', color: 'var(--text)', marginBottom: 32 }}>Get in touch.</h2>
            <div style={{ display: 'flex', gap: 48, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>Email</div>
                {editMode
                  ? <EText value={D.email} onChange={set('email')} style={{ fontSize: 15, color: 'var(--text)', fontWeight: 500 }} />
                  : D.email ? <a href={`mailto:${D.email}`} style={{ fontSize: 15, color: 'var(--text)', textDecoration: 'none', fontWeight: 500 }}>{D.email}</a> : <span style={{ color: '#aaa', fontSize: 14 }}>—</span>
                }
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>Phone</div>
                {editMode
                  ? <EText value={D.phone} onChange={set('phone')} style={{ fontSize: 15, color: 'var(--text)', fontWeight: 500 }} />
                  : D.phone ? <a href={`tel:${D.phone}`} style={{ fontSize: 15, color: 'var(--text)', textDecoration: 'none', fontWeight: 500 }}>{D.phone}</a> : <span style={{ color: '#aaa', fontSize: 14 }}>—</span>
                }
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>Studio Address</div>
                {editMode
                  ? <EArea value={D.address} onChange={set('address')} rows={2} style={{ fontSize: 15, color: 'var(--text)', fontWeight: 500 }} />
                  : D.address ? <div style={{ fontSize: 15, color: 'var(--text)', fontWeight: 500, whiteSpace: 'pre-line' }}>{D.address}</div> : <span style={{ color: '#aaa', fontSize: 14 }}>—</span>
                }
              </div>
            </div>
          </section>
        );

      case 'welcome':
        return (
          <section key={sectionKey} style={{ padding: '80px 64px', background: 'var(--card)', textAlign: 'center' }}>
            <Eyebrow center>New Students</Eyebrow>
            {editMode
              ? <EText value={D.welcome_title} onChange={set('welcome_title')} style={{ fontSize: 34, fontWeight: 900, letterSpacing: '-1px', lineHeight: 1.1, color: 'var(--text)', textAlign: 'center', maxWidth: 560, margin: '0 auto 16px' }} />
              : <h2 style={{ fontSize: 40, fontWeight: 900, letterSpacing: '-1px', lineHeight: 1.1, color: 'var(--text)', margin: '0 auto 20px', maxWidth: 560 }}>{D.welcome_title}</h2>
            }
            {editMode
              ? <EArea value={D.welcome_body} onChange={set('welcome_body')} rows={3} style={{ fontSize: 15, color: 'var(--muted)', lineHeight: 1.7, maxWidth: 480, margin: '12px auto', textAlign: 'center' }} />
              : <p style={{ fontSize: 17, color: 'var(--muted)', lineHeight: 1.7, maxWidth: 480, margin: '0 auto 44px' }}>{D.welcome_body}</p>
            }
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap', marginTop: editMode ? 16 : 0 }}>
              {(D.welcome_badges || []).map((label, i) => (
                editMode
                  ? <div key={i} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 999, padding: '4px 8px' }}>
                      <EText value={label} onChange={setBadge(i)} style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', minWidth: 140, textAlign: 'center', background: 'transparent', borderBottom: 'none' }} />
                    </div>
                  : <div key={label} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 999, padding: '9px 20px', fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{label}</div>
              ))}
            </div>
          </section>
        );

      default:
        return null;
    }
  };

  /* ── Render ───────────────────────────────────────────── */
  return (
    <div style={{ fontFamily: 'var(--font-sans)', color: 'var(--text)', background: 'var(--card)', borderRadius: 20, overflow: 'hidden', paddingBottom: editMode ? 80 : 0 }}>

      {editMode ? (
        /* Edit mode: sections with wrappers, drag-to-reorder, add section buttons */
        <>
          {sectionOrder.map((sectionKey, idx) => (
            <React.Fragment key={sectionKey}>
              {/* Add Section button BEFORE each section (except the first) */}
              {idx > 0 && (
                <AddSectionButton
                  position={idx - 1}
                  addingAt={addingAt}
                  setAddingAt={setAddingAt}
                  available={availableSections}
                  onAdd={handleAddSection}
                />
              )}
              <SectionWrapper
                sectionKey={sectionKey}
                editMode={editMode}
                dragOverKey={dragOverKey}
                onDragStart={handleDragStart(sectionKey)}
                onDragOver={handleDragOver(sectionKey)}
                onDrop={handleDrop(sectionKey)}
                onDelete={() => handleRemoveSection(sectionKey)}
                onDuplicate={() => handleDuplicateSection(sectionKey)}
              >
                {renderSection(sectionKey)}
              </SectionWrapper>
              {idx < sectionOrder.length - 1 && <Divider />}
            </React.Fragment>
          ))}
          {/* Add Section button at the very bottom */}
          <AddSectionButton
            position={sectionOrder.length - 1}
            addingAt={addingAt}
            setAddingAt={setAddingAt}
            available={availableSections}
            onAdd={handleAddSection}
          />
        </>
      ) : (
        /* View mode: plain sections with dividers, no wrappers */
        <>
          {sectionOrder.map((sectionKey, idx) => (
            <React.Fragment key={sectionKey}>
              {renderSection(sectionKey)}
              {idx < sectionOrder.length - 1 && <Divider />}
            </React.Fragment>
          ))}
        </>
      )}

      {/* ── FLOATING SAVE BAR ───────────────────────────────── */}
      {editMode && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#1d1d1f', padding: '14px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 500, boxShadow: '0 -4px 20px rgba(0,0,0,0.2)' }}>
          <div style={{ fontSize: 13, color: '#a1a1a6' }}>✏️ Editing profile — unsaved changes</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={discardEdit}
              style={{ padding: '9px 20px', borderRadius: 9, border: '1.5px solid #424245', background: 'transparent', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              Discard
            </button>
            <button
              onClick={saveEdit}
              disabled={updateMutation.isLoading}
              style={{ padding: '9px 24px', borderRadius: 9, border: 'none', background: updateMutation.isLoading ? '#555' : '#0071e3', color: '#fff', fontSize: 13, fontWeight: 700, cursor: updateMutation.isLoading ? 'not-allowed' : 'pointer' }}
            >
              {updateMutation.isLoading ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
