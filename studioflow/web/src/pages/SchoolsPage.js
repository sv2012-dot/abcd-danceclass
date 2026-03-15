import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { schools as schoolsApi } from "../api";

const EMPTY_FORM = { name:'', owner_name:'', email:'', phone:'', city:'', dance_style:'', admin_email:'', admin_password:'' };

function schoolGradient(name = '') {
  const h1 = (name.charCodeAt(0) * 37 + (name.charCodeAt(1) || 0) * 13) % 360;
  const h2 = (h1 + 38) % 360;
  return `linear-gradient(135deg, hsl(${h1},62%,42%) 0%, hsl(${h2},55%,35%) 100%)`;
}
function initials(name = '') {
  return name.trim().split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase() || '?';
}

export default function SchoolsPage() {
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [form, setForm]   = useState(EMPTY_FORM);
  const [detail, setDetail] = useState(null); // school id for detail view

  const { data: schools = [], isLoading } = useQuery({
    queryKey: ['schools'],
    queryFn: () => schoolsApi.list(),
  });

  const { data: stats } = useQuery({
    queryKey: ['school-stats', detail],
    queryFn: () => schoolsApi.stats(detail),
    enabled: !!detail,
  });

  const detailSchool = schools.find(s => s.id === detail);

  const createMutation = useMutation({
    mutationFn: data => schoolsApi.create(data),
    onSuccess: () => { qc.invalidateQueries(['schools']); setModal(false); setForm(EMPTY_FORM); },
  });

  const field = (key, label, type='text', placeholder='') => (
    <div style={{ marginBottom:14 }}>
      <label style={{ display:'block', fontSize:11, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:'var(--muted)', marginBottom:5 }}>{label}</label>
      <input
        type={type}
        value={form[key]}
        onChange={e => setForm(f => ({...f, [key]: e.target.value}))}
        placeholder={placeholder}
        style={{ width:'100%', border:'1.5px solid var(--border)', borderRadius:8, padding:'9px 12px', fontSize:14, color:'var(--text)', background:'var(--surface)', boxSizing:'border-box' }}
      />
    </div>
  );

  // ── Detail view ─────────────────────────────────────────────────────────────
  if (detail && detailSchool) {
    return (
      <div>
        <button onClick={() => setDetail(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--muted)', fontSize:13, display:'flex', alignItems:'center', gap:6, marginBottom:24, padding:0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          Back to all schools
        </button>

        <div style={{ display:'flex', alignItems:'center', gap:18, marginBottom:32 }}>
          <div style={{ width:56, height:56, borderRadius:14, background: schoolGradient(detailSchool.name), display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, fontWeight:800, color:'#fff', letterSpacing:'-1px', flexShrink:0 }}>
            {initials(detailSchool.name)}
          </div>
          <div>
            <h1 style={{ fontFamily:'var(--font-d)', fontSize:24, marginBottom:2 }}>{detailSchool.name}</h1>
            <div style={{ fontSize:13, color:'var(--muted)' }}>{[detailSchool.dance_style, detailSchool.city].filter(Boolean).join(' · ')}</div>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px, 1fr))', gap:16, marginBottom:32 }}>
          {[
            { label:'Students', value: stats?.students ?? '—' },
            { label:'Batches',  value: stats?.batches  ?? '—' },
            { label:'Upcoming Events', value: stats?.upcoming_recitals ?? '—' },
            { label:'Fees Collected', value: stats?.fees_collected != null ? `$${stats.fees_collected.toLocaleString()}` : '—' },
          ].map(st => (
            <div key={st.label} style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:12, padding:'18px 20px' }}>
              <div style={{ fontSize:26, fontWeight:800, color:'var(--text)', marginBottom:4 }}>{st.value}</div>
              <div style={{ fontSize:12, color:'var(--muted)', fontWeight:500 }}>{st.label}</div>
            </div>
          ))}
        </div>

        {/* Info card */}
        <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:14, padding:24 }}>
          <h2 style={{ fontSize:15, fontWeight:700, marginBottom:18 }}>School Details</h2>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px 32px' }}>
            {[
              ['Owner / Director', detailSchool.owner_name],
              ['Email',            detailSchool.email],
              ['Phone',            detailSchool.phone],
              ['City',             detailSchool.city],
              ['Dance Style',      detailSchool.dance_style],
              ['Status',           detailSchool.is_active ? 'Active' : 'Inactive'],
            ].map(([k, v]) => (
              <div key={k} style={{ paddingBottom:10, borderBottom:'1px solid var(--border)' }}>
                <div style={{ fontSize:11, color:'var(--muted)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:2 }}>{k}</div>
                <div style={{ fontSize:14, color:'var(--text)', fontWeight:500 }}>{v || '—'}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── List view ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:28, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontFamily:'var(--font-d)', fontSize:24, marginBottom:2 }}>Schools</h1>
          <p style={{ color:'var(--muted)', fontSize:13 }}>{schools.length} school{schools.length !== 1 ? 's' : ''} on the platform</p>
        </div>
        <button
          onClick={() => setModal(true)}
          style={{ background:'var(--accent)', color:'#fff', border:'none', borderRadius:10, padding:'10px 20px', fontSize:14, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:8 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add School
        </button>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div style={{ color:'var(--muted)', fontSize:14, padding:40, textAlign:'center' }}>Loading schools…</div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:20 }}>
          {schools.map(school => (
            <div
              key={school.id}
              onClick={() => setDetail(school.id)}
              style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:16, padding:22, cursor:'pointer', transition:'box-shadow .15s, transform .15s' }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow='0 6px 24px rgba(0,0,0,0.09)'; e.currentTarget.style.transform='translateY(-2px)'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow='none'; e.currentTarget.style.transform='none'; }}
            >
              <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:16 }}>
                <div style={{ width:46, height:46, borderRadius:12, background: schoolGradient(school.name), display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:800, color:'#fff', letterSpacing:'-0.5px', flexShrink:0 }}>
                  {initials(school.name)}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14, fontWeight:700, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{school.name}</div>
                  <div style={{ fontSize:12, color:'var(--muted)', marginTop:2 }}>{[school.dance_style, school.city].filter(Boolean).join(' · ')}</div>
                </div>
                <span style={{ fontSize:11, fontWeight:600, padding:'3px 9px', borderRadius:20, background: school.is_active ? '#e8f5e9' : '#fce4ec', color: school.is_active ? '#2e7d32' : '#c62828' }}>
                  {school.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
                {[
                  ['Students', school.student_count ?? 0],
                  ['Batches',  school.batch_count  ?? 0],
                ].map(([k,v]) => (
                  <div key={k} style={{ background:'var(--surface)', borderRadius:8, padding:'10px 12px' }}>
                    <div style={{ fontSize:20, fontWeight:800, color:'var(--text)' }}>{v}</div>
                    <div style={{ fontSize:11, color:'var(--muted)', fontWeight:500 }}>{k}</div>
                  </div>
                ))}
              </div>

              <div style={{ fontSize:12, color:'var(--muted)' }}>
                <span style={{ fontWeight:600, color:'var(--text)' }}>{school.owner_name}</span>
                {school.email && <span> · {school.email}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add school modal */}
      {modal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:'var(--card)', borderRadius:18, padding:28, width:'100%', maxWidth:520, maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:22 }}>
              <h2 style={{ fontSize:18, fontWeight:700 }}>Add New School</h2>
              <button onClick={() => { setModal(false); setForm(EMPTY_FORM); }} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color:'var(--muted)' }}>✕</button>
            </div>

            <div style={{ fontSize:12, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:14, paddingBottom:6, borderBottom:'1px solid var(--border)' }}>School Info</div>
            {field('name',       'School Name',  'text', 'e.g. Sankalpa Dance Academy')}
            {field('owner_name', 'Owner / Director', 'text', 'Full name')}
            {field('dance_style','Dance Style',  'text', 'e.g. Bharatanatyam, Ballet')}
            {field('city',       'City',         'text', 'e.g. Seattle')}
            {field('email',      'School Email', 'email','school@example.com')}
            {field('phone',      'Phone',        'tel',  '')}

            <div style={{ fontSize:12, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', margin:'18px 0 14px', paddingBottom:6, borderBottom:'1px solid var(--border)' }}>Admin Account (optional)</div>
            {field('admin_email',    'Admin Login Email',    'email', 'admin@school.com')}
            {field('admin_password', 'Admin Login Password', 'password', 'Min 8 chars')}

            <div style={{ display:'flex', gap:10, marginTop:20 }}>
              <button onClick={() => { setModal(false); setForm(EMPTY_FORM); }} style={{ flex:1, padding:'11px', background:'var(--surface)', border:'none', borderRadius:9, fontSize:14, fontWeight:600, cursor:'pointer', color:'var(--muted)' }}>Cancel</button>
              <button
                onClick={() => createMutation.mutate(form)}
                disabled={createMutation.isPending || !form.name || !form.owner_name}
                style={{ flex:2, padding:'11px', background:'var(--accent)', color:'#fff', border:'none', borderRadius:9, fontSize:14, fontWeight:700, cursor:'pointer', opacity: createMutation.isPending ? 0.6 : 1 }}
              >
                {createMutation.isPending ? 'Creating…' : 'Create School'}
              </button>
            </div>
            {createMutation.isError && <div style={{ marginTop:10, color:'#c62828', fontSize:13 }}>{createMutation.error?.error || 'Error creating school'}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
