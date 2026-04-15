import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const PURPLE   = '#7C3AED';
const MAGENTA  = '#DC4EFF';
const BTN_GRAD = `linear-gradient(135deg, ${PURPLE} 0%, ${MAGENTA} 100%)`;

const PAIN_POINTS = [
  { icon:'📋', label:'Class schedules in spreadsheets' },
  { icon:'💬', label:'Student updates via WhatsApp' },
  { icon:'🗒️', label:'Paper attendance sheets' },
  { icon:'📁', label:'Recital planning in your head' },
  { icon:'🔁', label:'Manually sending reminders' },
  { icon:'🗂️', label:'Vendor info in your email' },
];

const FEATURES = [
  { icon:'📅', label:'Smart Scheduling',    detail:'One calendar. Every class, rehearsal and recital. Recurrence and studio booking built in.' },
  { icon:'🎓', label:'Student Tracking',    detail:'Full profiles, attendance and guardian contacts. Know every student at a glance.' },
  { icon:'✨', label:'Recital Hub',         detail:'Plan, prep and execute your showcases without the chaos. Poster, venue, status — all in one.' },
  { icon:'✅', label:'Team To-Dos',         detail:'Assign tasks, set deadlines, stay in sync. No more "I thought you were doing that".' },
  { icon:'🏫', label:'Multi-Location',      detail:'Multiple studios, one login. Everything organised, nothing duplicated.' },
  { icon:'👨‍👩‍👧', label:'Parent Portal',      detail:'Parents stay informed. You stay focused on teaching.' },
];

const STATS = [
  { number:'6+', label:'modules', sub:'in one platform' },
  { number:'0',  label:'spreadsheets', sub:'required' },
  { number:'∞',  label:'time saved', sub:'for what matters' },
];

function NavBar({ onLogin }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);

  return (
    <nav style={{
      position:'fixed', top:0, left:0, right:0, zIndex:100,
      background: scrolled ? 'rgba(10,8,20,0.92)' : 'transparent',
      backdropFilter: scrolled ? 'blur(14px)' : 'none',
      borderBottom: scrolled ? '1px solid rgba(124,58,237,0.18)' : 'none',
      transition:'all .28s',
      padding:'0 40px', height:64,
      display:'flex', alignItems:'center', justifyContent:'space-between',
    }}>
      <div style={{ fontWeight:900, fontSize:20, letterSpacing:'-.02em' }}>
        Manch
        <span style={{ background:BTN_GRAD, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
          Q
        </span>
      </div>
      <div style={{ display:'flex', gap:12, alignItems:'center' }}>
        <a href="#pain"     style={{ fontSize:14, fontWeight:600, color:'#9CA3AF', textDecoration:'none', padding:'8px 14px' }}>The Problem</a>
        <a href="#features" style={{ fontSize:14, fontWeight:600, color:'#9CA3AF', textDecoration:'none', padding:'8px 14px' }}>Features</a>
        <button onClick={onLogin} style={{
          padding:'9px 22px', borderRadius:10, border:'none',
          background:BTN_GRAD, color:'#fff',
          fontWeight:700, fontSize:13, cursor:'pointer',
          boxShadow:'0 2px 14px rgba(124,58,237,0.42)',
          transition:'transform .15s, box-shadow .15s',
        }}
          onMouseEnter={e=>{ e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 4px 20px rgba(124,58,237,0.55)'; }}
          onMouseLeave={e=>{ e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='0 2px 14px rgba(124,58,237,0.42)'; }}
        >Log in →</button>
      </div>
    </nav>
  );
}

export default function LandingPageC() {
  const navigate = useNavigate();
  const goLogin  = () => navigate('/login');

  return (
    <div style={{ fontFamily:'var(--font-sans)', background:'#08060F', minHeight:'100vh', color:'#fff', overflowX:'hidden' }}>
      <NavBar onLogin={goLogin} />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section style={{
        minHeight:'100vh', display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center',
        textAlign:'center', padding:'120px 24px 80px',
        position:'relative', overflow:'hidden',
      }}>
        {/* Glow blobs */}
        <div style={{ position:'absolute', top:'15%', left:'50%', transform:'translateX(-50%)', width:700, height:700, background:'radial-gradient(circle, rgba(124,58,237,0.22) 0%, transparent 68%)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', bottom:'10%', right:'10%', width:400, height:400, background:'radial-gradient(circle, rgba(220,78,255,0.12) 0%, transparent 70%)', pointerEvents:'none' }} />

        <div style={{ position:'relative' }}>
          <div style={{
            display:'inline-flex', alignItems:'center', gap:8,
            background:'rgba(220,78,255,0.1)',
            border:'1px solid rgba(220,78,255,0.28)',
            borderRadius:99, padding:'6px 18px',
            fontSize:12, fontWeight:700, color:MAGENTA,
            marginBottom:30, letterSpacing:'.07em', textTransform:'uppercase',
          }}>
            ⚡ Built for studio owners who mean business
          </div>

          <h1 style={{
            fontSize:'clamp(44px, 7.5vw, 92px)',
            fontWeight:900, lineHeight:1.0,
            maxWidth:820, margin:'0 auto 10px',
            letterSpacing:'-.03em',
          }}>
            Stop managing.
          </h1>
          <h1 style={{
            fontSize:'clamp(44px, 7.5vw, 92px)',
            fontWeight:900, lineHeight:1.05,
            maxWidth:820, margin:'0 auto 28px',
            letterSpacing:'-.03em',
            background:BTN_GRAD,
            WebkitBackgroundClip:'text',
            WebkitTextFillColor:'transparent',
          }}>
            Start teaching.
          </h1>

          <p style={{ fontSize:18, color:'#9CA3AF', maxWidth:520, margin:'0 auto 48px', lineHeight:1.72 }}>
            Your studio runs on passion — not spreadsheets. ManchQ kills the admin chaos so you can get back to what actually matters.
          </p>

          <button onClick={goLogin} style={{
            padding:'17px 40px', borderRadius:14, border:'none',
            background:BTN_GRAD, color:'#fff',
            fontWeight:900, fontSize:18, cursor:'pointer',
            boxShadow:'0 4px 28px rgba(124,58,237,0.54)',
            letterSpacing:'.01em',
            transition:'transform .15s, box-shadow .15s',
          }}
            onMouseEnter={e=>{ e.currentTarget.style.transform='translateY(-3px) scale(1.02)'; e.currentTarget.style.boxShadow='0 12px 38px rgba(124,58,237,0.66)'; }}
            onMouseLeave={e=>{ e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='0 4px 28px rgba(124,58,237,0.54)'; }}
          >
            Get started free →
          </button>
          <div style={{ marginTop:18, fontSize:13, color:'#374151' }}>
            No credit card · No bloat · Just your studio, sorted
          </div>
        </div>

        {/* Stats row */}
        <div style={{ position:'relative', display:'flex', gap:64, marginTop:88, flexWrap:'wrap', justifyContent:'center' }}>
          {STATS.map(({ number, label, sub }) => (
            <div key={label} style={{ textAlign:'center' }}>
              <div style={{ fontSize:'clamp(36px, 5vw, 52px)', fontWeight:900, background:BTN_GRAD, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', lineHeight:1 }}>{number}</div>
              <div style={{ fontWeight:800, fontSize:15, color:'#fff', marginTop:6 }}>{label}</div>
              <div style={{ fontSize:12, color:'#4B5563', marginTop:3 }}>{sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pain ─────────────────────────────────────────────────────────── */}
      <section id="pain" style={{ padding:'88px 24px', borderTop:'1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ maxWidth:900, margin:'0 auto', textAlign:'center' }}>
          <h2 style={{ fontSize:'clamp(26px, 4vw, 42px)', fontWeight:900, marginBottom:14, letterSpacing:'-.02em' }}>
            Still using{' '}
            <span style={{ color:'#EF4444', textDecoration:'line-through', opacity:.85 }}>this?</span>
          </h2>
          <p style={{ fontSize:15, color:'#6B7280', marginBottom:52, lineHeight:1.7 }}>
            Most studios are held together with duct tape and sheer willpower. There's a better way.
          </p>
          <div style={{ display:'flex', flexWrap:'wrap', gap:12, justifyContent:'center' }}>
            {PAIN_POINTS.map(({ icon, label }) => (
              <div key={label} style={{
                padding:'12px 22px', borderRadius:12,
                border:'1px solid rgba(239,68,68,0.25)',
                background:'rgba(239,68,68,0.06)',
                color:'#F87171', fontWeight:600, fontSize:14,
                display:'flex', alignItems:'center', gap:8,
                textDecoration:'line-through', opacity:.85,
              }}>
                <span>{icon}</span> {label}
              </div>
            ))}
          </div>
          <div style={{ marginTop:56, fontSize:22, fontWeight:900, letterSpacing:'-.01em' }}>
            There's a better way.{' '}
            <span style={{ background:BTN_GRAD, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>↓</span>
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section id="features" style={{ padding:'88px 24px', background:'rgba(255,255,255,0.018)' }}>
        <div style={{ maxWidth:1100, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:64 }}>
            <div style={{ fontSize:12, fontWeight:700, color:MAGENTA, textTransform:'uppercase', letterSpacing:'.1em', marginBottom:14 }}>ManchQ gives you</div>
            <h2 style={{ fontSize:'clamp(28px, 4vw, 46px)', fontWeight:900, margin:0, letterSpacing:'-.02em' }}>
              Everything. One place.{' '}
              <span style={{ background:BTN_GRAD, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>Done.</span>
            </h2>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:1, border:'1px solid rgba(255,255,255,0.06)', borderRadius:20, overflow:'hidden' }}>
            {FEATURES.map(({ icon, label, detail }) => (
              <div key={label} style={{
                background:'rgba(255,255,255,0.025)',
                padding:'36px 30px',
                transition:'background .2s',
                borderRight:'1px solid rgba(255,255,255,0.05)',
                borderBottom:'1px solid rgba(255,255,255,0.05)',
              }}
                onMouseEnter={e=>{ e.currentTarget.style.background='rgba(124,58,237,0.14)'; }}
                onMouseLeave={e=>{ e.currentTarget.style.background='rgba(255,255,255,0.025)'; }}
              >
                <div style={{ fontSize:34, marginBottom:16 }}>{icon}</div>
                <div style={{ fontWeight:800, fontSize:17, marginBottom:8, color:'#fff' }}>{label}</div>
                <div style={{ fontSize:14, color:'#6B7280', lineHeight:1.66 }}>{detail}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section style={{ padding:'100px 24px', textAlign:'center', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse at center, rgba(124,58,237,0.28) 0%, transparent 68%)', pointerEvents:'none' }} />
        <div style={{ position:'relative', maxWidth:700, margin:'0 auto' }}>
          <h2 style={{ fontSize:'clamp(38px, 6.5vw, 72px)', fontWeight:900, lineHeight:1.05, margin:'0 0 22px', letterSpacing:'-.03em' }}>
            Your studio.<br />
            <span style={{ background:BTN_GRAD, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
              Sorted. Today.
            </span>
          </h2>
          <p style={{ fontSize:17, color:'#6B7280', margin:'0 0 44px', lineHeight:1.75, maxWidth:560, marginLeft:'auto', marginRight:'auto' }}>
            No bloated onboarding. No features you'll never touch. Just a fast, clean platform that gets your studio under control — immediately.
          </p>
          <button onClick={goLogin} style={{
            padding:'19px 52px', borderRadius:16, border:'none',
            background:BTN_GRAD, color:'#fff',
            fontWeight:900, fontSize:19, cursor:'pointer',
            boxShadow:'0 4px 36px rgba(124,58,237,0.62)',
            letterSpacing:'.02em',
            transition:'transform .15s, box-shadow .15s',
          }}
            onMouseEnter={e=>{ e.currentTarget.style.transform='translateY(-3px) scale(1.02)'; e.currentTarget.style.boxShadow='0 14px 44px rgba(124,58,237,0.74)'; }}
            onMouseLeave={e=>{ e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='0 4px 36px rgba(124,58,237,0.62)'; }}
          >
            Try ManchQ now →
          </button>
          <div style={{ marginTop:22, fontSize:13, color:'#374151' }}>
            Set up in minutes · No credit card needed
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer style={{
        borderTop:'1px solid rgba(255,255,255,0.05)',
        padding:'28px 40px',
        display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12,
      }}>
        <div style={{ fontWeight:900, fontSize:17 }}>
          Manch
          <span style={{ background:BTN_GRAD, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
            Q
          </span>
        </div>
        <div style={{ fontSize:13, color:'#374151' }}>
          © {new Date().getFullYear()} ManchQ · Built for the ones who never stop moving.
        </div>
      </footer>
    </div>
  );
}
