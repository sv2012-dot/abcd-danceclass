import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { schools as schoolsApi } from "../api";
import toast from "react-hot-toast";

const EMPTY_FORM = { name:'', owner_name:'', email:'', phone:'', city:'', dance_style:'', admin_email:'', admin_password:'' };
const RED = '#ef5350';

function schoolGradient(name = '') {
  const h1 = (name.charCodeAt(0) * 37 + (name.charCodeAt(1) || 0) * 13) % 360;
  const h2 = (h1 + 38) % 360;
  return `linear-gradient(135deg, hsl(${h1},62%,42%) 0%, hsl(${h2},55%,35%) 100%)`;
}
function initials(name = '') {
  return name.trim().split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase() || '?';
}
function fmt(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

function daysUntilPurge(deletedAt) {
  const days = 30 - Math.floor((Date.now() - new Date(deletedAt).getTime()) / (1000*60*60*24));
  return Math.max(0, days);
}

function CopyButton({ value }) {
  const [copied, setCopied] = useState(false);
  const copy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  };
  return (
    <button onClick={copy} title="Copy" style={{ background:'none', border:'none', cursor:'pointer', padding:'2px 4px', color: copied ? '#4caf50' : 'var(--muted)', display:'flex', alignItems:'center' }}>
      {copied
        ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
      }
    </button>
  );
}

// ── 3-step delete modal ────────────────────────────────────────────────────────
function DeleteModal({ school, stats, onClose, onDeleted }) {
  const [step, setStep]         = useState(1);
  const [nameInput, setNameInput] = useState('');
  const [password, setPassword]   = useState('');
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);

  const nameMatch = nameInput.trim() === school.name.trim();

  const handleDelete = async () => {
    setError(''); setLoading(true);
    try {
      await schoolsApi.softDelete(school.id, password);
      toast.success(`"${school.name}" deleted. You have 30 days to restore it.`);
      onDeleted();
      onClose();
    } catch (err) {
      setError(err?.error || err?.message || 'Delete failed');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ background:'var(--card)', border:`1px solid ${RED}40`, borderRadius:18, padding:28, width:'100%', maxWidth:460 }}>

        {/* Step indicator */}
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:24 }}>
          {[1,2,3].map(n => (
            <React.Fragment key={n}>
              <div style={{ width:28, height:28, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700,
                background: step >= n ? RED : 'var(--surface)', color: step >= n ? '#fff' : 'var(--muted)', border:`1px solid ${step >= n ? RED : 'var(--border)'}` }}>{n}</div>
              {n < 3 && <div style={{ flex:1, height:1, background: step > n ? RED : 'var(--border)' }} />}
            </React.Fragment>
          ))}
        </div>

        {/* ── Step 1: Warning ── */}
        {step === 1 && (
          <>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
              <div style={{ width:44, height:44, borderRadius:12, background:`${RED}20`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={RED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </div>
              <div>
                <div style={{ fontWeight:700, fontSize:16, color:'var(--text)' }}>Delete "{school.name}"?</div>
                <div style={{ fontSize:13, color:'var(--muted)', marginTop:2 }}>This is a soft delete — data is recoverable for 30 days</div>
              </div>
            </div>

            <div style={{ background:'var(--surface)', borderRadius:10, padding:'14px 16px', marginBottom:20 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>What will be affected</div>
              {[
                ['Students', stats?.students ?? '—'],
                ['Batches', stats?.batches ?? '—'],
                ['Upcoming events', stats?.upcoming_recitals ?? '—'],
                ['All users / logins for this school', '✓'],
              ].map(([label, val]) => (
                <div key={label} style={{ display:'flex', justifyContent:'space-between', fontSize:13, padding:'4px 0', borderBottom:'1px solid var(--border)', color:'var(--text)' }}>
                  <span style={{ color:'var(--muted)' }}>{label}</span>
                  <span style={{ fontWeight:600 }}>{val}</span>
                </div>
              ))}
            </div>

            <div style={{ background:`${RED}10`, border:`1px solid ${RED}30`, borderRadius:8, padding:'10px 14px', marginBottom:20, fontSize:13, color:RED }}>
              After 30 days, all data is <strong>permanently and irreversibly purged</strong>. There is no recovery after that window.
            </div>

            <div style={{ display:'flex', gap:10 }}>
              <button onClick={onClose} style={{ flex:1, padding:'10px', background:'var(--surface)', border:'none', borderRadius:9, fontSize:14, fontWeight:600, cursor:'pointer', color:'var(--muted)' }}>Cancel</button>
              <button onClick={() => setStep(2)} style={{ flex:2, padding:'10px', background:RED, color:'#fff', border:'none', borderRadius:9, fontSize:14, fontWeight:700, cursor:'pointer' }}>Continue →</button>
            </div>
          </>
        )}

        {/* ── Step 2: Type school name ── */}
        {step === 2 && (
          <>
            <div style={{ fontWeight:700, fontSize:16, marginBottom:6 }}>Confirm school name</div>
            <div style={{ fontSize:13, color:'var(--muted)', marginBottom:20 }}>Type the school name exactly as shown to continue.</div>

            <div style={{ background:'var(--surface)', borderRadius:8, padding:'10px 14px', marginBottom:16, fontSize:13, fontWeight:700, letterSpacing:'0.02em', color:'var(--text)', userSelect:'none' }}>
              {school.name}
            </div>

            <input
              autoFocus
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              placeholder="Type school name here…"
              style={{ width:'100%', background:'var(--surface)', border:`1.5px solid ${nameInput && !nameMatch ? RED : 'var(--border)'}`, borderRadius:8, padding:'10px 12px', fontSize:14, color:'var(--text)', boxSizing:'border-box', outline:'none', marginBottom:20 }}
            />

            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setStep(1)} style={{ flex:1, padding:'10px', background:'var(--surface)', border:'none', borderRadius:9, fontSize:14, fontWeight:600, cursor:'pointer', color:'var(--muted)' }}>← Back</button>
              <button onClick={() => setStep(3)} disabled={!nameMatch} style={{ flex:2, padding:'10px', background: nameMatch ? RED : 'var(--surface)', color: nameMatch ? '#fff' : 'var(--muted)', border:'none', borderRadius:9, fontSize:14, fontWeight:700, cursor: nameMatch ? 'pointer' : 'not-allowed', transition:'background .2s' }}>Continue →</button>
            </div>
          </>
        )}

        {/* ── Step 3: Enter password ── */}
        {step === 3 && (
          <>
            <div style={{ fontWeight:700, fontSize:16, marginBottom:6 }}>Authorize deletion</div>
            <div style={{ fontSize:13, color:'var(--muted)', marginBottom:20 }}>Enter your superadmin password to permanently authorize this action.</div>

            <input
              autoFocus
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              placeholder="Superadmin password"
              style={{ width:'100%', background:'var(--surface)', border:`1.5px solid ${error ? RED : 'var(--border)'}`, borderRadius:8, padding:'10px 12px', fontSize:14, color:'var(--text)', boxSizing:'border-box', outline:'none', marginBottom: error ? 8 : 20 }}
            />
            {error && <div style={{ fontSize:13, color:RED, marginBottom:16 }}>{error}</div>}

            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setStep(2)} style={{ flex:1, padding:'10px', background:'var(--surface)', border:'none', borderRadius:9, fontSize:14, fontWeight:600, cursor:'pointer', color:'var(--muted)' }}>← Back</button>
              <button onClick={handleDelete} disabled={!password || loading} style={{ flex:2, padding:'10px', background: password && !loading ? RED : 'var(--surface)', color: password && !loading ? '#fff' : 'var(--muted)', border:'none', borderRadius:9, fontSize:14, fontWeight:700, cursor: password && !loading ? 'pointer' : 'not-allowed' }}>
                {loading ? 'Deleting…' : 'Delete School'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SchoolsPage() {
  const qc = useQueryClient();
  const [modal, setModal]         = useState(false);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [detail, setDetail]       = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null); // { school, stats }
  const [resetTarget, setResetTarget]   = useState(null); // school id
  const [resetPw, setResetPw]     = useState('');

  const { data: allSchools = [], isLoading } = useQuery({
    queryKey: ['schools'],
    queryFn: () => schoolsApi.list(),
  });

  const activeSchools  = allSchools.filter(s => !s.deleted_at);
  const deletedSchools = allSchools.filter(s =>  s.deleted_at);

  const { data: stats } = useQuery({
    queryKey: ['school-stats', detail],
    queryFn: () => schoolsApi.stats(detail),
    enabled: !!detail,
  });

  const detailSchool = activeSchools.find(s => s.id === detail);

  const createMutation = useMutation({
    mutationFn: data => schoolsApi.create(data),
    onSuccess: () => { qc.invalidateQueries(['schools']); setModal(false); setForm(EMPTY_FORM); toast.success('School created'); },
    onError: err => toast.error(err?.error || 'Error creating school'),
  });

  const resetMutation = useMutation({
    mutationFn: ({ id, pw }) => schoolsApi.resetAdminPassword(id, pw),
    onSuccess: () => { setResetTarget(null); setResetPw(''); toast.success('Password reset'); },
    onError: err => toast.error(err?.error || 'Reset failed'),
  });

  const restoreMutation = useMutation({
    mutationFn: id => schoolsApi.restore(id),
    onSuccess: () => { qc.invalidateQueries(['schools']); toast.success('School restored'); },
    onError: err => toast.error(err?.error || 'Restore failed'),
  });

  const field = (key, label, type='text', placeholder='') => (
    <div style={{ marginBottom:14 }}>
      <label style={{ display:'block', fontSize:11, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:'var(--muted)', marginBottom:5 }}>{label}</label>
      <input type={type} value={form[key]} onChange={e => setForm(f => ({...f, [key]: e.target.value}))} placeholder={placeholder}
        style={{ width:'100%', border:'1.5px solid var(--border)', borderRadius:8, padding:'9px 12px', fontSize:14, color:'var(--text)', background:'var(--surface)', boxSizing:'border-box', outline:'none' }} />
    </div>
  );

  // ── Detail view ──────────────────────────────────────────────────────────────
  if (detail && detailSchool) {
    return (
      <div>
        <button onClick={() => setDetail(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--muted)', fontSize:13, display:'flex', alignItems:'center', gap:6, marginBottom:24, padding:0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          Back to all schools
        </button>
        <div style={{ display:'flex', alignItems:'center', gap:18, marginBottom:32 }}>
          <div style={{ width:56, height:56, borderRadius:14, background: schoolGradient(detailSchool.name), display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, fontWeight:800, color:'#fff', flexShrink:0 }}>
            {initials(detailSchool.name)}
          </div>
          <div>
            <h1 style={{ fontFamily:'var(--font-d)', fontSize:24, marginBottom:2 }}>{detailSchool.name}</h1>
            <div style={{ fontSize:13, color:'var(--muted)' }}>{[detailSchool.dance_style, detailSchool.city].filter(Boolean).join(' · ')}</div>
          </div>
        </div>
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
        <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:14, padding:24, marginBottom:20 }}>
          <h2 style={{ fontSize:15, fontWeight:700, marginBottom:18 }}>School Details</h2>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px 32px' }}>
            {[
              ['Owner / Director', detailSchool.owner_name],
              ['Email',            detailSchool.email],
              ['Phone',            detailSchool.phone],
              ['City',             detailSchool.city],
              ['Dance Style',      detailSchool.dance_style],
              ['Status',           detailSchool.is_active ? 'Active' : 'Inactive'],
              ['Created on',       fmt(detailSchool.created_at)],
              ['Admin last login',  fmt(detailSchool.admin_last_login)],
            ].map(([k, v]) => (
              <div key={k} style={{ paddingBottom:10, borderBottom:'1px solid var(--border)' }}>
                <div style={{ fontSize:11, color:'var(--muted)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:2 }}>{k}</div>
                <div style={{ fontSize:14, color:'var(--text)', fontWeight:500 }}>{v || '—'}</div>
              </div>
            ))}
          </div>
        </div>
        <button
          onClick={() => setDeleteTarget({ school: detailSchool, stats })}
          style={{ background:`${RED}15`, border:`1px solid ${RED}40`, color:RED, borderRadius:9, padding:'10px 20px', fontSize:14, fontWeight:700, cursor:'pointer' }}
        >
          Delete this school…
        </button>

        {deleteTarget && (
          <DeleteModal school={deleteTarget.school} stats={deleteTarget.stats}
            onClose={() => setDeleteTarget(null)}
            onDeleted={() => { setDetail(null); qc.invalidateQueries(['schools']); }} />
        )}
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
          <p style={{ color:'var(--muted)', fontSize:13 }}>{activeSchools.length} school{activeSchools.length !== 1 ? 's' : ''} on the platform</p>
        </div>
        <button onClick={() => setModal(true)}
          style={{ background:'var(--accent)', color:'#fff', border:'none', borderRadius:10, padding:'10px 20px', fontSize:14, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:8 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add School
        </button>
      </div>

      {/* Active schools grid */}
      {isLoading ? (
        <div style={{ color:'var(--muted)', fontSize:14, padding:40, textAlign:'center' }}>Loading schools…</div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))', gap:20, marginBottom:40 }}>
          {activeSchools.map(school => (
            <div key={school.id} style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:16, overflow:'hidden', cursor:'pointer', transition:'box-shadow .15s, transform .15s' }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow='0 6px 24px rgba(0,0,0,0.15)'; e.currentTarget.style.transform='translateY(-2px)'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow='none'; e.currentTarget.style.transform='none'; }}
              onClick={() => setDetail(school.id)}
            >
              {/* Card top */}
              <div style={{ padding:'18px 18px 14px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:14 }}>
                  <div style={{ width:46, height:46, borderRadius:12, background: schoolGradient(school.name), display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:800, color:'#fff', flexShrink:0 }}>
                    {initials(school.name)}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:14, fontWeight:700, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{school.name}</div>
                    <div style={{ fontSize:12, color:'var(--muted)', marginTop:2 }}>{[school.dance_style, school.city].filter(Boolean).join(' · ') || '—'}</div>
                  </div>
                  <span style={{ fontSize:11, fontWeight:600, padding:'3px 9px', borderRadius:20, flexShrink:0,
                    background: school.is_active ? 'rgba(76,175,80,0.15)' : 'rgba(239,83,80,0.15)',
                    color:      school.is_active ? '#4caf50'              : '#ef5350' }}>
                    {school.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  {[['Students', school.student_count ?? 0], ['Batches', school.batch_count ?? 0]].map(([k,v]) => (
                    <div key={k} style={{ background:'var(--surface)', borderRadius:8, padding:'10px 12px' }}>
                      <div style={{ fontSize:20, fontWeight:800, color:'var(--text)' }}>{v}</div>
                      <div style={{ fontSize:11, color:'var(--muted)', fontWeight:500 }}>{k}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Created on / Last login */}
              <div style={{ padding:'8px 18px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, borderTop:'1px solid var(--border)' }}>
                {[['Created', school.created_at], ['Last login', school.admin_last_login]].map(([label, val]) => (
                  <div key={label}>
                    <div style={{ fontSize:10, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:2 }}>{label}</div>
                    <div style={{ fontSize:11, color:'var(--text)' }}>{fmt(val)}</div>
                  </div>
                ))}
              </div>

              {/* Admin login section */}
              <div onClick={e => e.stopPropagation()} style={{ borderTop:'1px solid var(--border)', background:'var(--surface)', padding:'10px 18px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:3 }}>Admin Login</div>
                  <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                    <span style={{ fontSize:12, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:180 }}>{school.admin_email || '—'}</span>
                    {school.admin_email && <CopyButton value={school.admin_email} />}
                  </div>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); setResetTarget(school.id); setResetPw(''); }}
                  style={{ background:'rgba(255,193,7,0.15)', border:'1px solid rgba(255,193,7,0.3)', color:'#ffc107', borderRadius:7, padding:'6px 12px', fontSize:12, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:5, flexShrink:0 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  Reset Password
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recently deleted section */}
      {deletedSchools.length > 0 && (
        <div style={{ marginTop:16 }}>
          <div style={{ fontSize:12, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:14, display:'flex', alignItems:'center', gap:8 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
            Recently deleted ({deletedSchools.length})
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {deletedSchools.map(school => {
              const daysLeft = daysUntilPurge(school.deleted_at);
              return (
                <div key={school.id} style={{ background:'var(--card)', border:`1px solid ${RED}25`, borderRadius:12, padding:'14px 18px', display:'flex', alignItems:'center', gap:14 }}>
                  <div style={{ width:38, height:38, borderRadius:10, background: schoolGradient(school.name), display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800, color:'#fff', opacity:0.5, flexShrink:0 }}>
                    {initials(school.name)}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:14, fontWeight:700, color:'var(--muted)' }}>{school.name}</div>
                    <div style={{ fontSize:12, color: daysLeft <= 5 ? RED : 'var(--muted)', marginTop:2 }}>
                      {daysLeft > 0 ? `Permanently deleted in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}` : 'Scheduled for purge today'}
                    </div>
                  </div>
                  <button
                    onClick={() => restoreMutation.mutate(school.id)}
                    disabled={restoreMutation.isPending}
                    style={{ background:'rgba(76,175,80,0.15)', border:'1px solid rgba(76,175,80,0.3)', color:'#4caf50', borderRadius:7, padding:'7px 14px', fontSize:12, fontWeight:700, cursor:'pointer', flexShrink:0 }}>
                    Restore
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Reset password modal */}
      {resetTarget && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:'var(--card)', borderRadius:16, padding:24, width:'100%', maxWidth:360 }}>
            <div style={{ fontWeight:700, fontSize:16, marginBottom:4 }}>Reset Admin Password</div>
            <div style={{ fontSize:13, color:'var(--muted)', marginBottom:18 }}>Set a new login password for this school's admin account.</div>
            <input type="password" value={resetPw} onChange={e => setResetPw(e.target.value)} placeholder="New password (min 6 chars)"
              style={{ width:'100%', background:'var(--surface)', border:'1.5px solid var(--border)', borderRadius:8, padding:'10px 12px', fontSize:14, color:'var(--text)', boxSizing:'border-box', outline:'none', marginBottom:16 }} />
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => { setResetTarget(null); setResetPw(''); }} style={{ flex:1, padding:'10px', background:'var(--surface)', border:'none', borderRadius:9, fontSize:14, fontWeight:600, cursor:'pointer', color:'var(--muted)' }}>Cancel</button>
              <button onClick={() => resetMutation.mutate({ id: resetTarget, pw: resetPw })} disabled={resetPw.length < 6 || resetMutation.isPending}
                style={{ flex:2, padding:'10px', background:'var(--accent)', color:'#fff', border:'none', borderRadius:9, fontSize:14, fontWeight:700, cursor: resetPw.length >= 6 ? 'pointer' : 'not-allowed', opacity: resetPw.length >= 6 ? 1 : 0.5 }}>
                {resetMutation.isPending ? 'Resetting…' : 'Reset Password'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add school modal */}
      {modal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:'var(--card)', borderRadius:18, padding:28, width:'100%', maxWidth:520, maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:22 }}>
              <h2 style={{ fontSize:18, fontWeight:700 }}>Add New School</h2>
              <button onClick={() => { setModal(false); setForm(EMPTY_FORM); }} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color:'var(--muted)' }}>✕</button>
            </div>
            <div style={{ fontSize:12, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:14, paddingBottom:6, borderBottom:'1px solid var(--border)' }}>School Info</div>
            {field('name',       'School Name',      'text',     'e.g. Sankalpa Dance Academy')}
            {field('owner_name', 'Owner / Director', 'text',     'Full name')}
            {field('dance_style','Dance Style',      'text',     'e.g. Bharatanatyam, Ballet')}
            {field('city',       'City',             'text',     'e.g. Seattle')}
            {field('email',      'School Email',     'email',    'school@example.com')}
            {field('phone',      'Phone',            'tel',      '')}
            <div style={{ fontSize:12, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', margin:'18px 0 14px', paddingBottom:6, borderBottom:'1px solid var(--border)' }}>Admin Account (optional)</div>
            {field('admin_email',    'Admin Login Email',    'email',    'admin@school.com')}
            {field('admin_password', 'Admin Login Password', 'password', 'Min 8 chars')}
            <div style={{ display:'flex', gap:10, marginTop:20 }}>
              <button onClick={() => { setModal(false); setForm(EMPTY_FORM); }} style={{ flex:1, padding:'11px', background:'var(--surface)', border:'none', borderRadius:9, fontSize:14, fontWeight:600, cursor:'pointer', color:'var(--muted)' }}>Cancel</button>
              <button onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending || !form.name || !form.owner_name}
                style={{ flex:2, padding:'11px', background:'var(--accent)', color:'#fff', border:'none', borderRadius:9, fontSize:14, fontWeight:700, cursor:'pointer', opacity: createMutation.isPending ? 0.6 : 1 }}>
                {createMutation.isPending ? 'Creating…' : 'Create School'}
              </button>
            </div>
            {createMutation.isError && <div style={{ marginTop:10, color:RED, fontSize:13 }}>{createMutation.error?.error || 'Error creating school'}</div>}
          </div>
        </div>
      )}

      {/* Delete modal from list (triggered by detail view, handled above) */}
      {deleteTarget && (
        <DeleteModal school={deleteTarget.school} stats={deleteTarget.stats}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => { qc.invalidateQueries(['schools']); }} />
      )}
    </div>
  );
}
