import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { schools as schoolsApi } from '../api';
import toast from 'react-hot-toast';

/* ── Helpers ───────────────────────────────────────────────── */
function Divider() {
  return <div style={{ borderTop: '1px solid #e5e5e7', margin: '0' }} />;
}
function Eyebrow({ children, center }) {
  return (
    <div style={{
      fontSize: 12, fontWeight: 700, letterSpacing: '0.1em',
      textTransform: 'uppercase', color: '#6e6e73',
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

/* ── Page ─────────────────────────────────────────────────── */
export default function SchoolAboutPage() {
  const { user, school: authSchool, setSchool } = useAuth();
  const queryClient = useQueryClient();
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState(null);
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
    return { ...defaults, ...pj };
  }, [school, name, owner, city, style]);

  /* ── Edit helpers ─────────────────────────────────────── */
  const enterEdit = () => {
    setDraft({ name, owner_name: owner, dance_style: style, city, email, phone, address, ...content });
    setEditMode(true);
  };
  const discardEdit = () => { setDraft(null); setEditMode(false); };

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

  /* display source: draft in edit mode, content otherwise */
  const D = editMode
    ? draft
    : { name, owner_name: owner, dance_style: style, city, email, phone, address, ...content };

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

  /* ── Render ───────────────────────────────────────────── */
  return (
    <div style={{ fontFamily: 'var(--font-sans)', color: '#1d1d1f', background: '#fff', borderRadius: 20, overflow: 'hidden', paddingBottom: editMode ? 80 : 0 }}>

      {/* ── HERO ──────────────────────────────────────────── */}
      <section style={{ padding: '72px 64px 68px', textAlign: 'center', background: '#fff', position: 'relative' }}>
        {isAdmin && !editMode && (
          <button onClick={enterEdit} style={{ position: 'absolute', top: 24, right: 28, display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', border: '1.5px solid #d2d2d7', borderRadius: 10, background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#1d1d1f', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Edit Page
          </button>
        )}
        {editMode && (
          <div style={{ position: 'absolute', top: 24, right: 28, background: '#ebf3ff', borderRadius: 10, padding: '7px 14px', fontSize: 12, fontWeight: 700, color: '#0071e3', letterSpacing: '0.04em' }}>
            ✏️ Editing
          </div>
        )}

        <Eyebrow center>
          {editMode
            ? <EText value={D.city} onChange={set('city')} style={{ fontSize: 12, fontWeight: 700, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#6e6e73' }} />
            : <>{D.city}{D.city && D.city !== 'Your City' ? ', Washington' : ''}</>
          }
        </Eyebrow>

        {editMode
          ? <EText value={D.name} onChange={set('name')} style={{ fontSize: 40, fontWeight: 900, letterSpacing: '-1.5px', lineHeight: 1.08, color: '#1d1d1f', textAlign: 'center', maxWidth: 640, margin: '0 auto 16px' }} />
          : <h1 style={{ fontSize: 48, fontWeight: 900, letterSpacing: '-1.5px', lineHeight: 1.08, color: '#1d1d1f', margin: '0 auto 24px', maxWidth: 640 }}>{D.name}</h1>
        }

        {editMode
          ? <EArea value={D.tagline} onChange={set('tagline')} rows={2} style={{ fontSize: 17, color: '#6e6e73', lineHeight: 1.6, maxWidth: 520, margin: '12px auto 0', fontWeight: 400, textAlign: 'center' }} />
          : <p style={{ fontSize: 19, color: '#6e6e73', lineHeight: 1.6, maxWidth: 520, margin: '0 auto', fontWeight: 400 }}>{D.tagline}</p>
        }
      </section>

      <Divider />

      {/* ── STAT STRIP ──────────────────────────────────────── */}
      <section style={{ display: 'flex', padding: '44px 64px', background: '#f5f5f7', gap: 0 }}>
        {(D.stats || []).map(({ stat, label }, i, arr) => (
          <div key={i} style={{ flex: 1, textAlign: 'center', padding: '0 20px', borderRight: i < arr.length - 1 ? '1px solid #d2d2d7' : 'none' }}>
            {editMode
              ? <>
                  <EText value={stat} onChange={setStat(i, 'stat')} style={{ fontSize: 28, fontWeight: 800, color: '#1d1d1f', letterSpacing: '-0.5px', marginBottom: 4, textAlign: 'center' }} />
                  <EArea value={label} onChange={setStat(i, 'label')} rows={2} style={{ fontSize: 12, color: '#6e6e73', lineHeight: 1.5, textAlign: 'center', marginTop: 6 }} />
                </>
              : <>
                  <div style={{ fontSize: 32, fontWeight: 800, color: '#1d1d1f', letterSpacing: '-0.5px', marginBottom: 6 }}>{stat}</div>
                  <div style={{ fontSize: 13, color: '#6e6e73', lineHeight: 1.5, whiteSpace: 'pre-line' }}>{label}</div>
                </>
            }
          </div>
        ))}
      </section>

      <Divider />

      {/* ── ART FORM ────────────────────────────────────────── */}
      <section style={{ padding: '72px 64px', background: '#fff' }}>
        <div style={{ display: 'flex', gap: 80, alignItems: 'flex-start' }}>
          <div style={{ flex: '0 0 280px' }}>
            <Eyebrow>The Art Form</Eyebrow>
            {editMode
              ? <EText value={D.dance_style} onChange={set('dance_style')} style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-0.8px', color: '#1d1d1f' }} />
              : <h2 style={{ fontSize: 36, fontWeight: 900, letterSpacing: '-0.8px', lineHeight: 1.1, color: '#1d1d1f', margin: 0 }}>{D.dance_style}.</h2>
            }
            <div style={{ marginTop: 14 }}>
              {editMode
                ? <EArea value={D.art_form_tagline} onChange={set('art_form_tagline')} rows={2} style={{ fontSize: 14, color: '#6e6e73', lineHeight: 1.6 }} />
                : <p style={{ fontSize: 14, color: '#6e6e73', margin: 0, lineHeight: 1.6 }}>{D.art_form_tagline}</p>
              }
            </div>
          </div>
          <div style={{ flex: 1 }}>
            {editMode
              ? <EArea value={D.art_form_body} onChange={set('art_form_body')} rows={5} style={{ fontSize: 15, color: '#1d1d1f', lineHeight: 1.75, marginBottom: 16 }} />
              : <p style={{ fontSize: 16, color: '#1d1d1f', lineHeight: 1.75, marginBottom: 32 }}>{D.art_form_body}</p>
            }
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6e6e73', marginBottom: 14 }}>
              At our {D.city} studio, students learn
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 32px' }}>
              {(D.art_form_bullets || []).map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#1d1d1f', flexShrink: 0, marginTop: editMode ? 12 : 8 }} />
                  {editMode
                    ? <EText value={item} onChange={setBullet(i)} style={{ fontSize: 14, color: '#1d1d1f', lineHeight: 1.55 }} />
                    : <span style={{ fontSize: 14, color: '#1d1d1f', lineHeight: 1.55 }}>{item}</span>
                  }
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Divider />

      {/* ── PHILOSOPHY ──────────────────────────────────────── */}
      <section style={{ padding: '80px 64px', background: '#f5f5f7', textAlign: 'center' }}>
        <Eyebrow center>Our Philosophy</Eyebrow>
        {editMode
          ? <EArea value={D.philosophy_quote} onChange={set('philosophy_quote')} rows={3} style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.4px', lineHeight: 1.3, color: '#1d1d1f', maxWidth: 580, margin: '0 auto 16px', textAlign: 'center' }} />
          : <blockquote style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.6px', lineHeight: 1.25, color: '#1d1d1f', maxWidth: 580, margin: '0 auto 28px', fontStyle: 'normal' }}>
              "{D.philosophy_quote}"
            </blockquote>
        }
        {editMode
          ? <EArea value={D.philosophy_body} onChange={set('philosophy_body')} rows={4} style={{ fontSize: 14, color: '#6e6e73', maxWidth: 520, margin: '12px auto 0', lineHeight: 1.7, textAlign: 'center' }} />
          : <p style={{ fontSize: 15, color: '#6e6e73', maxWidth: 520, margin: '0 auto', lineHeight: 1.7 }}>{D.philosophy_body}</p>
        }
      </section>

      <Divider />

      {/* ── PEOPLE ──────────────────────────────────────────── */}
      <section style={{ padding: '72px 64px', background: '#fff' }}>
        <Eyebrow>The People</Eyebrow>
        <h2 style={{ fontSize: 36, fontWeight: 900, letterSpacing: '-0.8px', lineHeight: 1.1, color: '#1d1d1f', marginBottom: 52 }}>
          Guided by masters.
        </h2>
        <div style={{ display: 'flex', gap: 48, alignItems: 'flex-start' }}>
          <div style={{ width: 72, height: 72, borderRadius: 20, background: 'linear-gradient(135deg, #1d1d1f 0%, #424245 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
            {initials(D.owner_name)}
          </div>
          <div style={{ flex: 1 }}>
            {editMode
              ? <EText value={D.owner_name} onChange={set('owner_name')} style={{ fontSize: 22, fontWeight: 800, color: '#1d1d1f', letterSpacing: '-0.3px', marginBottom: 6 }} />
              : <div style={{ fontSize: 22, fontWeight: 800, color: '#1d1d1f', letterSpacing: '-0.3px', marginBottom: 4 }}>{D.owner_name}</div>
            }
            {editMode
              ? <EText value={D.owner_title} onChange={set('owner_title')} style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6e6e73', marginBottom: 12 }} />
              : <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6e6e73', marginBottom: 16 }}>{D.owner_title}</div>
            }
            {editMode
              ? <EArea value={D.owner_bio} onChange={set('owner_bio')} rows={5} style={{ fontSize: 15, color: '#1d1d1f', lineHeight: 1.75 }} />
              : <p style={{ fontSize: 15, color: '#1d1d1f', lineHeight: 1.75, margin: 0 }}>{D.owner_bio}</p>
            }
          </div>
        </div>
      </section>

      <Divider />

      {/* ── CONTACT ─────────────────────────────────────────── */}
      <section style={{ padding: '64px 64px', background: '#f5f5f7' }}>
        <Eyebrow>Contact</Eyebrow>
        <h2 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.6px', color: '#1d1d1f', marginBottom: 32 }}>Get in touch.</h2>
        <div style={{ display: 'flex', gap: 48, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#6e6e73', marginBottom: 6 }}>Email</div>
            {editMode
              ? <EText value={D.email} onChange={set('email')} style={{ fontSize: 15, color: '#1d1d1f', fontWeight: 500 }} />
              : D.email ? <a href={`mailto:${D.email}`} style={{ fontSize: 15, color: '#1d1d1f', textDecoration: 'none', fontWeight: 500 }}>{D.email}</a> : <span style={{ color: '#aaa', fontSize: 14 }}>—</span>
            }
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#6e6e73', marginBottom: 6 }}>Phone</div>
            {editMode
              ? <EText value={D.phone} onChange={set('phone')} style={{ fontSize: 15, color: '#1d1d1f', fontWeight: 500 }} />
              : D.phone ? <a href={`tel:${D.phone}`} style={{ fontSize: 15, color: '#1d1d1f', textDecoration: 'none', fontWeight: 500 }}>{D.phone}</a> : <span style={{ color: '#aaa', fontSize: 14 }}>—</span>
            }
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#6e6e73', marginBottom: 6 }}>Studio Address</div>
            {editMode
              ? <EArea value={D.address} onChange={set('address')} rows={2} style={{ fontSize: 15, color: '#1d1d1f', fontWeight: 500 }} />
              : D.address ? <div style={{ fontSize: 15, color: '#1d1d1f', fontWeight: 500, whiteSpace: 'pre-line' }}>{D.address}</div> : <span style={{ color: '#aaa', fontSize: 14 }}>—</span>
            }
          </div>
        </div>
      </section>

      <Divider />

      {/* ── WELCOME ─────────────────────────────────────────── */}
      <section style={{ padding: '80px 64px', background: '#fff', textAlign: 'center' }}>
        <Eyebrow center>New Students</Eyebrow>
        {editMode
          ? <EText value={D.welcome_title} onChange={set('welcome_title')} style={{ fontSize: 34, fontWeight: 900, letterSpacing: '-1px', lineHeight: 1.1, color: '#1d1d1f', textAlign: 'center', maxWidth: 560, margin: '0 auto 16px' }} />
          : <h2 style={{ fontSize: 40, fontWeight: 900, letterSpacing: '-1px', lineHeight: 1.1, color: '#1d1d1f', margin: '0 auto 20px', maxWidth: 560 }}>{D.welcome_title}</h2>
        }
        {editMode
          ? <EArea value={D.welcome_body} onChange={set('welcome_body')} rows={3} style={{ fontSize: 15, color: '#6e6e73', lineHeight: 1.7, maxWidth: 480, margin: '12px auto', textAlign: 'center' }} />
          : <p style={{ fontSize: 17, color: '#6e6e73', lineHeight: 1.7, maxWidth: 480, margin: '0 auto 44px' }}>{D.welcome_body}</p>
        }
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap', marginTop: editMode ? 16 : 0 }}>
          {(D.welcome_badges || []).map((label, i) => (
            editMode
              ? <div key={i} style={{ background: '#fff', border: '1px solid #d2d2d7', borderRadius: 999, padding: '4px 8px' }}>
                  <EText value={label} onChange={setBadge(i)} style={{ fontSize: 14, fontWeight: 500, color: '#1d1d1f', minWidth: 140, textAlign: 'center', background: 'transparent', borderBottom: 'none' }} />
                </div>
              : <div key={label} style={{ background: '#fff', border: '1px solid #d2d2d7', borderRadius: 999, padding: '9px 20px', fontSize: 14, fontWeight: 500, color: '#1d1d1f' }}>{label}</div>
          ))}
        </div>
      </section>

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
