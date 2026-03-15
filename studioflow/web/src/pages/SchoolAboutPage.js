import React, { useState } from 'react';
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

/* ── Field ─────────────────────────────────────────────────── */
function Field({ label, value, onChange, placeholder, type = 'text', multiline }) {
  const base = {
    width: '100%', boxSizing: 'border-box',
    border: '1.5px solid #d2d2d7', borderRadius: 10,
    padding: '10px 13px', fontSize: 14, color: '#1d1d1f',
    background: '#fff', outline: 'none', fontFamily: 'inherit',
  };
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#6e6e73', marginBottom: 6 }}>
        {label}
      </label>
      {multiline
        ? <textarea rows={3} value={value} onChange={onChange} placeholder={placeholder} style={{ ...base, resize: 'vertical' }} />
        : <input type={type} value={value} onChange={onChange} placeholder={placeholder} style={base} />
      }
    </div>
  );
}

/* ── Edit Modal ─────────────────────────────────────────────── */
function EditModal({ school, onClose, onSave, saving }) {
  const [form, setForm] = useState({
    name:        school.name        || '',
    owner_name:  school.owner_name  || '',
    dance_style: school.dance_style || '',
    city:        school.city        || '',
    address:     school.address     || '',
    email:       school.email       || '',
    phone:       school.phone       || '',
  });
  const set = key => e => setForm(f => ({ ...f, [key]: e.target.value }));

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto', padding: 36, boxShadow: '0 24px 60px rgba(0,0,0,0.18)' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1d1d1f', margin: 0 }}>Edit School Profile</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#6e6e73', lineHeight: 1 }}>×</button>
        </div>

        <Field label="School Name"       value={form.name}        onChange={set('name')}        placeholder="e.g. Nritya Vahini Academy" />
        <Field label="Director / Owner"  value={form.owner_name}  onChange={set('owner_name')}  placeholder="e.g. Swapna Varma" />
        <Field label="Dance Style"       value={form.dance_style} onChange={set('dance_style')} placeholder="e.g. Bharatanatyam" />
        <Field label="City"              value={form.city}        onChange={set('city')}         placeholder="e.g. Seattle" />
        <Field label="Address"           value={form.address}     onChange={set('address')}      placeholder="Full studio address" multiline />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="Email"  value={form.email} onChange={set('email')} placeholder="studio@example.com" type="email" />
          <Field label="Phone"  value={form.phone} onChange={set('phone')} placeholder="(425) 555-0100" />
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
          <button onClick={onClose} style={{ padding: '10px 22px', border: '1.5px solid #d2d2d7', borderRadius: 10, background: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#1d1d1f' }}>
            Cancel
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={saving}
            style={{ padding: '10px 28px', border: 'none', borderRadius: 10, background: saving ? '#888' : '#1d1d1f', color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────── */
export default function SchoolAboutPage() {
  const { user, school: authSchool, setSchool } = useAuth();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const isAdmin = user?.role === 'school_admin' || user?.role === 'superadmin';
  const schoolId = user?.school_id;

  const { data: schoolData } = useQuery({
    queryKey: ['school', schoolId],
    queryFn: () => schoolsApi.get(schoolId),
    enabled: !!schoolId,
  });

  const school  = schoolData || authSchool || {};
  const name    = school.name        || 'Your Dance Studio';
  const owner   = school.owner_name  || 'Studio Director';
  const city    = school.city        || 'Your City';
  const style   = school.dance_style || 'Classical Dance';
  const email   = school.email       || '';
  const phone   = school.phone       || '';
  const address = school.address     || '';

  const updateMutation = useMutation({
    mutationFn: (data) => schoolsApi.update(schoolId, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries(['school', schoolId]);
      setSchool(updated);
      toast.success('Profile updated');
      setEditOpen(false);
    },
    onError: () => toast.error('Failed to save changes'),
  });

  return (
    <div style={{ fontFamily: 'var(--font-sans)', color: '#1d1d1f', background: '#fff', borderRadius: 20, overflow: 'hidden' }}>

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section style={{ padding: '72px 64px 68px', textAlign: 'center', background: '#fff', position: 'relative' }}>
        {isAdmin && (
          <button
            onClick={() => setEditOpen(true)}
            style={{
              position: 'absolute', top: 24, right: 28,
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '9px 18px', border: '1.5px solid #d2d2d7',
              borderRadius: 10, background: '#fff', cursor: 'pointer',
              fontSize: 13, fontWeight: 600, color: '#1d1d1f',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Edit Profile
          </button>
        )}
        <Eyebrow center>{city}{city && ', Washington'}</Eyebrow>
        <h1 style={{ fontSize: 48, fontWeight: 900, letterSpacing: '-1.5px', lineHeight: 1.08, color: '#1d1d1f', margin: '0 auto 24px', maxWidth: 640 }}>
          {name}
        </h1>
        <p style={{ fontSize: 19, color: '#6e6e73', lineHeight: 1.6, maxWidth: 520, margin: '0 auto', fontWeight: 400 }}>
          Dedicated to the art of {style} —
          where rhythm, expression, and tradition meet.
        </p>
      </section>

      <Divider />

      {/* ── STAT STRIP ───────────────────────────────────────── */}
      <section style={{ display: 'flex', padding: '44px 64px', background: '#f5f5f7', gap: 0 }}>
        {[
          { stat: '15+',     label: 'Years of teaching\nexperience' },
          { stat: 'All ages', label: 'Children, teens\nand adults' },
          { stat: city || 'PNW', label: 'Pacific Northwest\ncommunity' },
          { stat: style.split(' ')[0] || 'Classical', label: 'Lineage rooted in\nclassical tradition' },
        ].map(({ stat, label }, i, arr) => (
          <div key={i} style={{ flex: 1, textAlign: 'center', padding: '0 20px', borderRight: i < arr.length - 1 ? '1px solid #d2d2d7' : 'none' }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: '#1d1d1f', letterSpacing: '-0.5px', marginBottom: 6 }}>{stat}</div>
            <div style={{ fontSize: 13, color: '#6e6e73', lineHeight: 1.5, whiteSpace: 'pre-line' }}>{label}</div>
          </div>
        ))}
      </section>

      <Divider />

      {/* ── ART FORM ─────────────────────────────────────────── */}
      <section style={{ padding: '72px 64px', background: '#fff' }}>
        <div style={{ display: 'flex', gap: 80, alignItems: 'flex-start' }}>
          <div style={{ flex: '0 0 280px' }}>
            <Eyebrow>The Art Form</Eyebrow>
            <h2 style={{ fontSize: 36, fontWeight: 900, letterSpacing: '-0.8px', lineHeight: 1.1, color: '#1d1d1f', margin: 0 }}>
              {style}.
            </h2>
            <p style={{ fontSize: 14, color: '#6e6e73', marginTop: 16, lineHeight: 1.6 }}>
              One of the oldest classical dance traditions in the world.
            </p>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 16, color: '#1d1d1f', lineHeight: 1.75, marginBottom: 32 }}>
              Rooted in ancient temple traditions of South India, {style} combines rhythmic footwork,
              expressive storytelling, sculptural poses, and devotional spirit into a single,
              breathtaking art form.
            </p>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6e6e73', marginBottom: 16 }}>
              At our {city} studio, students learn
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 32px' }}>
              {['Foundational movements & technique', 'Abhinaya — expression & storytelling', 'Classical compositions & repertoire', 'Cultural context, rhythm, and aesthetics'].map(item => (
                <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#1d1d1f', flexShrink: 0, marginTop: 8 }} />
                  <span style={{ fontSize: 14, color: '#1d1d1f', lineHeight: 1.55 }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Divider />

      {/* ── PHILOSOPHY ───────────────────────────────────────── */}
      <section style={{ padding: '80px 64px', background: '#f5f5f7', textAlign: 'center' }}>
        <Eyebrow center>Our Philosophy</Eyebrow>
        <blockquote style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.6px', lineHeight: 1.25, color: '#1d1d1f', maxWidth: 580, margin: '0 auto 28px', fontStyle: 'normal' }}>
          "Dance is more than performance — it is a journey of discipline, cultural connection, and inner expression."
        </blockquote>
        <p style={{ fontSize: 15, color: '#6e6e73', maxWidth: 520, margin: '0 auto', lineHeight: 1.7 }}>
          At {name}, {style} blends body, mind, and emotion into a living art form passed down through generations.
          We cultivate respect for tradition, confidence, grace, and a deep connection to musical storytelling.
        </p>
      </section>

      <Divider />

      {/* ── PEOPLE ───────────────────────────────────────────── */}
      <section style={{ padding: '72px 64px', background: '#fff' }}>
        <Eyebrow>The People</Eyebrow>
        <h2 style={{ fontSize: 36, fontWeight: 900, letterSpacing: '-0.8px', lineHeight: 1.1, color: '#1d1d1f', marginBottom: 52 }}>
          Guided by masters.
        </h2>
        <div style={{ display: 'flex', gap: 48, alignItems: 'flex-start' }}>
          <div style={{ width: 72, height: 72, borderRadius: 20, background: 'linear-gradient(135deg, #1d1d1f 0%, #424245 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, color: '#fff', flexShrink: 0, letterSpacing: '-0.5px' }}>
            {initials(owner)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#1d1d1f', letterSpacing: '-0.3px', marginBottom: 4 }}>{owner}</div>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6e6e73', marginBottom: 16 }}>Founder &amp; Artistic Director</div>
            <p style={{ fontSize: 15, color: '#1d1d1f', lineHeight: 1.75, margin: 0 }}>
              {owner.split(' ')[0]} founded {name} in {city} with the vision of creating a vibrant community space
              for learning {style}. With years of teaching experience, their approach blends traditional rigor with
              encouragement and creativity — helping students build strong technique while genuinely loving the art form.
            </p>
          </div>
        </div>
      </section>

      <Divider />

      {/* ── CONTACT ──────────────────────────────────────────── */}
      {(email || phone || address) && (
        <>
          <section style={{ padding: '64px 64px', background: '#f5f5f7' }}>
            <Eyebrow>Contact</Eyebrow>
            <h2 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.6px', color: '#1d1d1f', marginBottom: 32 }}>Get in touch.</h2>
            <div style={{ display: 'flex', gap: 48, flexWrap: 'wrap' }}>
              {email && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#6e6e73', marginBottom: 6 }}>Email</div>
                  <a href={`mailto:${email}`} style={{ fontSize: 15, color: '#1d1d1f', textDecoration: 'none', fontWeight: 500 }}>{email}</a>
                </div>
              )}
              {phone && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#6e6e73', marginBottom: 6 }}>Phone</div>
                  <a href={`tel:${phone}`} style={{ fontSize: 15, color: '#1d1d1f', textDecoration: 'none', fontWeight: 500 }}>{phone}</a>
                </div>
              )}
              {address && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#6e6e73', marginBottom: 6 }}>Studio Address</div>
                  <div style={{ fontSize: 15, color: '#1d1d1f', fontWeight: 500, whiteSpace: 'pre-line' }}>{address}</div>
                </div>
              )}
            </div>
          </section>
          <Divider />
        </>
      )}

      {/* ── WELCOME ──────────────────────────────────────────── */}
      <section style={{ padding: '80px 64px', background: email || phone || address ? '#fff' : '#f5f5f7', textAlign: 'center' }}>
        <Eyebrow center>New Students</Eyebrow>
        <h2 style={{ fontSize: 40, fontWeight: 900, letterSpacing: '-1px', lineHeight: 1.1, color: '#1d1d1f', margin: '0 auto 20px', maxWidth: 560 }}>
          Your journey begins here.
        </h2>
        <p style={{ fontSize: 17, color: '#6e6e73', lineHeight: 1.7, maxWidth: 480, margin: '0 auto 44px' }}>
          We warmly welcome students of all backgrounds. Whether you are discovering {style} for the first
          time or continuing your journey, {name} offers a supportive and inspiring space to learn.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
          {['Beginner-friendly classes', 'Small group instruction', 'Performance opportunities', `Cultural community in ${city}`].map(label => (
            <div key={label} style={{ background: '#fff', border: '1px solid #d2d2d7', borderRadius: 999, padding: '9px 20px', fontSize: 14, fontWeight: 500, color: '#1d1d1f' }}>
              {label}
            </div>
          ))}
        </div>
      </section>

      {/* ── EDIT MODAL ───────────────────────────────────────── */}
      {editOpen && (
        <EditModal
          school={school}
          onClose={() => setEditOpen(false)}
          onSave={(data) => updateMutation.mutate(data)}
          saving={updateMutation.isLoading}
        />
      )}
    </div>
  );
}
