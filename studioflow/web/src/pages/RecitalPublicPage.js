import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

// ── Public API client (no auth) ───────────────────────────────────────────────
const PROD_API = 'https://abcd-danceclass-production.up.railway.app/api';
const API_BASE = process.env.REACT_APP_API_URL
  || (process.env.NODE_ENV === 'production' ? PROD_API : 'http://localhost:5000/api');

const publicApi = axios.create({ baseURL: API_BASE, timeout: 20000 });

// ── Constants ─────────────────────────────────────────────────────────────────
const PURPLE  = '#7C3AED';
const MAGENTA = '#DC4EFF';
const GRAD    = `linear-gradient(135deg, ${PURPLE} 0%, ${MAGENTA} 100%)`;
const BG      = '#080613';
const OUTER   = '#050410'; // slightly darker frame on desktop

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return 'Date TBC';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
}
function formatTime(t) {
  if (!t) return null;
  const [h, m] = t.split(':');
  const hr = parseInt(h, 10);
  return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`;
}

// ── Icons ─────────────────────────────────────────────────────────────────────
const IconCalendar = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);
const IconClock = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);
const IconPin = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
  </svg>
);
const IconUsers = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);
const IconShare = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
  </svg>
);

// ── Share Button ──────────────────────────────────────────────────────────────
function ShareButton() {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button onClick={copy} style={{
      display:'inline-flex', alignItems:'center', gap:6,
      padding:'8px 14px', borderRadius:20, cursor:'pointer', fontSize:12, fontWeight:700,
      border:'1px solid rgba(255,255,255,0.18)',
      background: copied ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.07)',
      color: copied ? '#10B981' : '#9CA3AF',
      backdropFilter:'blur(12px)',
      transition:'all .2s',
    }}>
      <IconShare />
      {copied ? 'Copied!' : 'Share'}
    </button>
  );
}

// ── RSVP Section ──────────────────────────────────────────────────────────────
const rsvpKey = (school, recital) => `manchq_rsvp_${school}_${recital}`;

function RSVPSection({ schoolSlug, recitalSlug, confirmedCount, setConfirmedCount }) {
  const stored = (() => {
    try { return JSON.parse(localStorage.getItem(rsvpKey(schoolSlug, recitalSlug))); } catch { return null; }
  })();

  const [state,     setState]     = useState(stored ? 'submitted' : 'idle');
  const [name,      setName]      = useState('');
  const [email,     setEmail]     = useState('');
  const [plusOnes,  setPlusOnes]  = useState(0);
  const [err,       setErr]       = useState('');
  const [submitted, setSubmitted] = useState(stored?.response ?? null);

  const isForm  = state === 'yes-form' || state === 'no-form';
  const isGoing = state === 'yes-form';
  const isBusy  = state === 'submitting';

  const inputStyle = {
    width:'100%', boxSizing:'border-box', padding:'13px 16px', borderRadius:12,
    border:'1.5px solid rgba(255,255,255,0.12)', background:'rgba(255,255,255,0.06)',
    color:'#fff', fontSize:15, fontFamily:'inherit', outline:'none',
    transition:'border-color .15s',
  };

  const handleSubmit = useCallback(async () => {
    if (!name.trim()) { setErr('Please enter your name'); return; }
    const attempted = state;
    setState('submitting');
    setErr('');
    try {
      const response = attempted === 'yes-form' ? 'Confirmed' : 'Declined';
      const res = await publicApi.post(`/public/${schoolSlug}/${recitalSlug}/rsvp`, {
        name: name.trim(),
        email: email.trim() || undefined,
        response,
        plus_ones: plusOnes,
      });
      const confirmed = res.data.confirmed ?? confirmedCount;
      setConfirmedCount(confirmed);
      setSubmitted(response);
      setState('submitted');
      try { localStorage.setItem(rsvpKey(schoolSlug, recitalSlug), JSON.stringify({ response, confirmedCount: confirmed })); } catch {}
    } catch (e) {
      setErr(e.response?.data?.error || 'Something went wrong. Try again.');
      setState(attempted);
    }
  }, [name, email, plusOnes, state, schoolSlug, recitalSlug, confirmedCount, setConfirmedCount]);

  // ── Submitted ────────────────────────────────────────────────────────────────
  if (state === 'submitted') {
    const isConfirmed = submitted === 'Confirmed';
    // use live count if available, fall back to what was stored at submit time
    const displayCount = confirmedCount || stored?.confirmedCount || 0;
    return (
      <div style={{
        background: isConfirmed
          ? 'linear-gradient(135deg,rgba(16,185,129,0.14) 0%,rgba(16,185,129,0.06) 100%)'
          : 'rgba(255,255,255,0.04)',
        border: `1.5px solid ${isConfirmed ? 'rgba(16,185,129,0.35)' : 'rgba(255,255,255,0.1)'}`,
        borderRadius:20, padding:'28px 20px', textAlign:'center',
      }}>
        <div style={{ fontSize:48, marginBottom:12 }}>{isConfirmed ? '🎉' : '💙'}</div>
        <h3 style={{ fontSize:20, fontWeight:900, margin:'0 0 8px', letterSpacing:'-.02em' }}>
          {isConfirmed ? 'See you there!' : 'Thanks for letting us know'}
        </h3>
        <p style={{ fontSize:14, color:'#9CA3AF', margin:'0 0 20px', lineHeight:1.65 }}>
          {isConfirmed
            ? `You're in!${displayCount > 0 ? ` ${displayCount} ${displayCount === 1 ? 'person is' : 'people are'} going.` : ''}`
            : "Sorry you can't make it. Hope to see you next time!"}
        </p>
        <button
          onClick={() => {
            try { localStorage.removeItem(rsvpKey(schoolSlug, recitalSlug)); } catch {}
            setState('idle'); setSubmitted(null); setName(''); setEmail(''); setPlusOnes(0);
          }}
          style={{ fontSize:13, color:MAGENTA, background:'none', border:'none', cursor:'pointer', fontWeight:700, textDecoration:'underline' }}
        >Change my RSVP</button>
      </div>
    );
  }

  return (
    <div style={{
      background:'linear-gradient(160deg,rgba(124,58,237,0.14) 0%,rgba(220,78,255,0.08) 100%)',
      border:'1.5px solid rgba(124,58,237,0.4)',
      borderRadius:20, padding:'24px 20px',
      boxShadow:'0 0 50px rgba(124,58,237,0.12)',
    }}>
      <h3 style={{ fontSize:20, fontWeight:900, margin:'0 0 8px', letterSpacing:'-.02em' }}>
        Will you be there?
      </h3>

      {confirmedCount > 0 && (
        <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, color:'#9CA3AF', marginBottom:16 }}>
          <IconUsers />
          <span><strong style={{ color:'#10B981' }}>{confirmedCount}</strong> {confirmedCount === 1 ? 'person is' : 'people are'} going</span>
        </div>
      )}
      {confirmedCount === 0 && <div style={{ marginBottom:16 }} />}

      {/* Toggle when in form state */}
      {isForm && (
        <div style={{ display:'flex', gap:8, marginBottom:16 }}>
          {[
            { key:'yes-form', label:"🎉 I'm in" },
            { key:'no-form',  label:"😔 Can't make it" },
          ].map(({ key, label }) => (
            <button key={key} onClick={() => setState(key)} style={{
              flex:1, padding:'10px 8px', borderRadius:10, border:'none', cursor:'pointer',
              fontSize:13, fontWeight:700, transition:'all .15s',
              background: state === key ? GRAD : 'rgba(255,255,255,0.07)',
              color: state === key ? '#fff' : '#6B7280',
            }}>{label}</button>
          ))}
        </div>
      )}

      {/* Idle: primary buttons */}
      {state === 'idle' && (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <button
            onClick={() => setState('yes-form')}
            style={{
              width:'100%', padding:'15px', borderRadius:14, border:'none', cursor:'pointer',
              background:GRAD, color:'#fff', fontWeight:800, fontSize:15,
              boxShadow:'0 4px 20px rgba(124,58,237,0.4)', transition:'opacity .15s',
            }}
          >🎉 Yes, I'll be there!</button>
          <button
            onClick={() => setState('no-form')}
            style={{
              width:'100%', padding:'14px', borderRadius:14, cursor:'pointer', fontWeight:700, fontSize:14,
              border:'1.5px solid rgba(255,255,255,0.14)', background:'transparent', color:'#9CA3AF',
            }}
          >😔 Can't make it</button>
        </div>
      )}

      {/* Form fields */}
      {isForm && (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div>
            <label style={{ fontSize:11, fontWeight:700, color:'#6B7280', letterSpacing:'.08em', textTransform:'uppercase', display:'block', marginBottom:7 }}>
              Your name <span style={{ color:MAGENTA }}>*</span>
            </label>
            <input
              autoFocus
              value={name}
              onChange={e => { setName(e.target.value); setErr(''); }}
              placeholder="Enter your name"
              style={inputStyle}
              onFocus={e => (e.target.style.borderColor = PURPLE)}
              onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.12)')}
            />
          </div>

          <div>
            <label style={{ fontSize:11, fontWeight:700, color:'#6B7280', letterSpacing:'.08em', textTransform:'uppercase', display:'block', marginBottom:7 }}>
              Email <span style={{ fontWeight:400, color:'#4B5563', fontSize:10 }}>optional</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              style={inputStyle}
              onFocus={e => (e.target.style.borderColor = PURPLE)}
              onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.12)')}
            />
          </div>

          {isGoing && (
            <div>
              <label style={{ fontSize:11, fontWeight:700, color:'#6B7280', letterSpacing:'.08em', textTransform:'uppercase', display:'block', marginBottom:9 }}>
                Bringing anyone?
              </label>
              <div style={{ display:'flex', gap:8 }}>
                {[{ val:0, label:'Just me' },{ val:1, label:'+1' },{ val:2, label:'+2' },{ val:3, label:'3+' }].map(({ val, label }) => (
                  <button key={val} onClick={() => setPlusOnes(val)} style={{
                    flex:1, padding:'11px 4px', borderRadius:10, cursor:'pointer',
                    fontSize:13, fontWeight:700, transition:'all .15s',
                    border: plusOnes === val ? `1.5px solid ${PURPLE}` : '1.5px solid rgba(255,255,255,0.1)',
                    background: plusOnes === val ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.04)',
                    color: plusOnes === val ? '#C4B5FD' : '#6B7280',
                  }}>{label}</button>
                ))}
              </div>
            </div>
          )}

          {err && <p style={{ fontSize:13, color:'#F87171', margin:0, fontWeight:600 }}>{err}</p>}

          <button
            onClick={handleSubmit}
            disabled={isBusy}
            style={{
              width:'100%', padding:'15px', borderRadius:14, border:'none',
              cursor: isBusy ? 'not-allowed' : 'pointer',
              background: isBusy ? 'rgba(124,58,237,0.4)' : GRAD,
              color:'#fff', fontWeight:800, fontSize:15, marginTop:2,
              opacity: isBusy ? 0.7 : 1,
              boxShadow: isBusy ? 'none' : '0 4px 20px rgba(124,58,237,0.4)',
              transition:'opacity .15s',
            }}
          >{isBusy ? 'Saving…' : isGoing ? 'Confirm RSVP ✓' : 'Send response'}</button>

          <button
            onClick={() => { setState('idle'); setErr(''); }}
            style={{ fontSize:12, color:'#4B5563', background:'none', border:'none', cursor:'pointer', fontWeight:600, paddingTop:2 }}
          >← Back</button>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function RecitalPublicPage() {
  const { schoolSlug, recitalSlug } = useParams();

  const [data,           setData]           = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState(null);
  const [confirmedCount, setConfirmedCount] = useState(0);

  useEffect(() => {
    setLoading(true);
    publicApi.get(`/public/${schoolSlug}/${recitalSlug}`)
      .then(res => {
        setData(res.data);
        setConfirmedCount(res.data.recital?.rsvp_stats?.confirmed || 0);
        setLoading(false);
      })
      .catch(err => {
        setError(err.response?.data?.error || 'Could not load this event page');
        setLoading(false);
      });
  }, [schoolSlug, recitalSlug]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight:'100vh', background:OUTER, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <style>{`@keyframes spin { to { transform:rotate(360deg); } }`}</style>
      <div style={{ textAlign:'center' }}>
        <div style={{
          width:44, height:44,
          border:`3px solid rgba(124,58,237,0.25)`,
          borderTopColor:PURPLE, borderRadius:'50%',
          margin:'0 auto 16px', animation:'spin .8s linear infinite',
        }} />
        <p style={{ color:'#6B7280', fontSize:14, margin:0 }}>Loading event…</p>
      </div>
    </div>
  );

  // ── Not found ──────────────────────────────────────────────────────────────
  if (error || !data) return (
    <div style={{ minHeight:'100vh', background:OUTER, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div style={{ textAlign:'center', maxWidth:380 }}>
        <div style={{ fontSize:56, marginBottom:16 }}>🎭</div>
        <h2 style={{ color:'#fff', marginBottom:8, fontSize:22, fontWeight:800 }}>Event not found</h2>
        <p style={{ color:'#6B7280', fontSize:14, lineHeight:1.65, marginBottom:28 }}>
          {error || "This event page doesn't exist or may have been removed."}
        </p>
        <a href="/" style={{ color:MAGENTA, fontWeight:700, fontSize:14, textDecoration:'none' }}>← Back to ManchQ</a>
      </div>
    </div>
  );

  const { school, recital } = data;
  const hasPoster = recital.poster_url && recital.poster_url.length > 20;
  const timeStr   = formatTime(recital.event_time);

  const detailRows = [
    { icon:<IconCalendar />, label:'Date',  value: formatDate(recital.event_date) },
    ...(timeStr ? [{ icon:<IconClock />, label:'Time', value: timeStr }] : []),
    { icon:<IconPin />,      label:'Venue', value: recital.venue || 'Venue TBC' },
  ];

  return (
    // Outer wrapper: dark background visible on desktop around the narrow card
    <div style={{
      minHeight:'100vh',
      background: OUTER,
      display:'flex',
      justifyContent:'center',
      fontFamily:'system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    }}>
      {/* ── The receipt card ─────────────────────────────────────────────────── */}
      <div style={{
        width:'100%',
        maxWidth:430,
        background:BG,
        color:'#fff',
        minHeight:'100vh',
        display:'flex',
        flexDirection:'column',
        // Subtle edge glow so the card reads as elevated on desktop
        boxShadow:'0 0 60px rgba(124,58,237,0.12), 0 0 0 1px rgba(255,255,255,0.04)',
      }}>

        {/* ── Hero: image starts at the very top, top-bar floats over it ───── */}
        <div style={{ position:'relative', flexShrink:0 }}>
          {hasPoster ? (
            <div style={{ width:'100%', height:320, overflow:'hidden' }}>
              <img
                src={recital.poster_url}
                alt={recital.title}
                style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'top', display:'block' }}
              />
            </div>
          ) : (
            <div style={{
              width:'100%', height:260,
              background:`linear-gradient(160deg, rgba(124,58,237,0.6) 0%, rgba(220,78,255,0.35) 60%, ${BG} 100%)`,
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              <div style={{ fontSize:90, opacity:0.18, userSelect:'none' }}>🎭</div>
            </div>
          )}

          {/* Gradient fade at bottom of hero into page background */}
          <div style={{
            position:'absolute', left:0, right:0, bottom:0, height:'60%',
            background:`linear-gradient(to bottom, transparent, ${BG})`,
            pointerEvents:'none',
          }} />

          {/* Top bar — floats over hero */}
          <div style={{
            position:'absolute', top:0, left:0, right:0,
            padding:'14px 18px',
            display:'flex', alignItems:'center', justifyContent:'space-between',
            background:'linear-gradient(to bottom, rgba(5,4,16,0.72) 0%, transparent 100%)',
          }}>
            <a href="/" style={{ display:'flex', alignItems:'center', gap:7, textDecoration:'none' }}>
              <img src="/ManchQ-Logo.png" alt="ManchQ" style={{ height:20, width:20 }}
                onError={e => (e.currentTarget.style.display = 'none')} />
              <span style={{ fontWeight:900, fontSize:15, color:'#fff', letterSpacing:'-.02em' }}>
                Manch<span style={{ background:GRAD, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>Q</span>
              </span>
            </a>
            <ShareButton />
          </div>

          {/* Event identity at bottom of hero */}
          <div style={{ position:'absolute', bottom:0, left:0, right:0, padding:'0 20px 22px', zIndex:2 }}>
            {/* School pill */}
            <div style={{
              display:'inline-flex', alignItems:'center', gap:5,
              fontSize:10, fontWeight:800, letterSpacing:'.1em', textTransform:'uppercase',
              color:MAGENTA, background:'rgba(220,78,255,0.12)',
              border:'1px solid rgba(220,78,255,0.25)', borderRadius:20,
              padding:'4px 11px', marginBottom:10,
            }}>
              {school.name}{school.city ? ` · ${school.city}` : ''}
            </div>

            <h1 style={{
              fontSize:28, fontWeight:900, lineHeight:1.1, letterSpacing:'-.03em',
              margin:'0 0 6px',
            }}>{recital.title}</h1>

            {recital.status && recital.status !== 'Planning' && (
              <span style={{
                display:'inline-block', fontSize:10, fontWeight:700, padding:'3px 10px',
                borderRadius:20,
                background: recital.status === 'Completed' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                color:       recital.status === 'Completed' ? '#10B981'               : '#F59E0B',
                border:      `1px solid ${recital.status === 'Completed' ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`,
              }}>{recital.status}</span>
            )}
          </div>
        </div>

        {/* ── Page content ─────────────────────────────────────────────────── */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', gap:16, padding:'20px 20px 32px' }}>

          {/* Event detail rows */}
          <div style={{
            background:'rgba(255,255,255,0.04)',
            border:'1px solid rgba(255,255,255,0.08)',
            borderRadius:16, overflow:'hidden',
          }}>
            {detailRows.map((row, i) => (
              <div key={row.label} style={{
                display:'flex', alignItems:'center', gap:14,
                padding:'15px 18px',
                borderBottom: i < detailRows.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
              }}>
                <div style={{ color:MAGENTA, flexShrink:0, display:'flex', opacity:.85 }}>{row.icon}</div>
                <div>
                  <div style={{ fontSize:10, fontWeight:700, color:'#6B7280', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:2 }}>
                    {row.label}
                  </div>
                  <div style={{ fontSize:14, fontWeight:600, color:'#F3F4F6', lineHeight:1.4 }}>
                    {row.value}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Description */}
          {recital.description && (
            <div style={{
              background:'rgba(255,255,255,0.03)',
              border:'1px solid rgba(255,255,255,0.07)',
              borderRadius:16, padding:'16px 18px',
            }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#6B7280', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:10 }}>
                About this event
              </div>
              <p style={{ fontSize:14, color:'#D1D5DB', lineHeight:1.8, margin:0 }}>
                {recital.description}
              </p>
            </div>
          )}

          {/* RSVP */}
          <RSVPSection
            schoolSlug={schoolSlug}
            recitalSlug={recitalSlug}
            confirmedCount={confirmedCount}
            setConfirmedCount={setConfirmedCount}
          />

        </div>

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <footer style={{
          borderTop:'1px solid rgba(255,255,255,0.06)',
          padding:'16px 20px',
          display:'flex', alignItems:'center', justifyContent:'space-between',
          flexWrap:'wrap', gap:8,
        }}>
          <a href="/" style={{ display:'inline-flex', alignItems:'center', gap:6, textDecoration:'none' }}>
            <img src="/ManchQ-Logo.png" alt="" style={{ height:16, width:16, opacity:0.4 }}
              onError={e => (e.currentTarget.style.display = 'none')} />
            <span style={{ fontSize:11, color:'#4B5563', fontWeight:600 }}>
              Organised with <span style={{ color:MAGENTA }}>ManchQ</span>
            </span>
          </a>
          <a href="/pricing" style={{ fontSize:11, color:'#374151', textDecoration:'none', fontWeight:600 }}>
            Create your own →
          </a>
        </footer>

      </div>
    </div>
  );
}
