import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const PURPLE   = '#7C3AED';
const MAGENTA  = '#DC4EFF';
const BTN_GRAD = `linear-gradient(135deg, ${PURPLE} 0%, ${MAGENTA} 100%)`;

// ── Responsive hook ────────────────────────────────────────────────────────────
function useIsMobile(bp = 768) {
  const [mobile, setMobile] = useState(() => window.innerWidth < bp);
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < bp);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, [bp]);
  return mobile;
}

// ── Lineart SVG icons ──────────────────────────────────────────────────────────
function Icon({ paths, size = 24, stroke = 'currentColor', sw = 1.6 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      {(Array.isArray(paths) ? paths : [paths]).map((p, i) => <path key={i} d={p} />)}
    </svg>
  );
}

const IC = {
  calendar: ['M8 2v4','M16 2v4','M3 10h18','M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z'],
  student:  ['M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10z','M2 20c0-4 4.5-7 10-7s10 3 10 7'],
  recital:  ['M9 18V5l12-2v13','M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z','M18 19a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'],
  todo:     ['M9 11l3 3L22 4','M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11'],
  studio:   ['M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z','M9 22V12h6v10'],
  parent:   ['M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2','M23 21v-2a4 4 0 0 0-3-3.87','M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'],
  dance:    ['M12 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4z','M9 8l-3 6h4l1 8','M15 8l3 6h-4l-1 8','M9 14l6-2'],
  heart:    ['M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z'],
  arrow:    ['M5 12h14','M12 5l7 7-7 7'],
  check:    ['M20 6L9 17l-5-5'],
  lock:     ['M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z','M7 11V7a5 5 0 0 1 10 0v4'],
  shield:   ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'],
  phone:    ['M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z'],
};

// ── Data ───────────────────────────────────────────────────────────────────────
const FEATURES = [
  { ic:'calendar', title:'Smart Scheduling',     desc:'Plan classes, rehearsals and recitals in one elegant calendar. Recurrence, studio booking and colour-coding built right in.' },
  { ic:'student',  title:'Student Profiles',     desc:'Track every student — attendance, progress, guardian contacts — always at your fingertips, never lost in a spreadsheet.' },
  { ic:'recital',  title:'Recital Management',   desc:'From early planning to curtain call. Venue, date, status, poster — manage your entire showcase from one beautiful hub.' },
  { ic:'todo',     title:'Team To-Dos',          desc:'Keep your team aligned with shared tasks, deadlines and assignments. Nothing slips through the cracks ever again.' },
  { ic:'studio',   title:'Multi-Studio Support', desc:'Running more than one location? ManchQ keeps every studio organised under one roof, one login.' },
  { ic:'parent',   title:'Parent Portal',        desc:"Give parents a window into their child's journey — schedules, updates and announcements in one clean place." },
];

const BENEFITS = [
  { heading:'Less admin, more artistry',          body:'The average studio owner spends 12+ hours a week on scheduling and communication. ManchQ gives that time back — so you can spend it where it matters.' },
  { heading:'Everything in one place',            body:'No more juggling spreadsheets, WhatsApp groups and sticky notes. One login, your whole studio — students, schedule, recitals, to-dos, vendors and more.' },
  { heading:'Built for dance, not just business', body:'We designed every screen with dance studios in mind — not a generic business template bolted onto your workflow. It just makes sense.' },
];

const TRUST = [
  { ic:'student',  label:'Student tracking', sub:'profiles, attendance & guardians' },
  { ic:'calendar', label:'Class scheduling', sub:'smart calendar with recurrence'   },
  { ic:'recital',  label:'Recital hub',      sub:'from planning to curtain call'    },
];

const PROVIDERS = [
  { emoji:'📸', title:'Photographers',     desc:'Freeze every leap, every expression, every curtain call — forever.' },
  { emoji:'🎬', title:'Videographers',     desc:'Every performance preserved so families can relive it for years to come.' },
  { emoji:'👗', title:'Costume Designers', desc:'Bringing characters and cultural traditions to life, one stitch at a time.' },
  { emoji:'💄', title:'Makeup Artists',    desc:'Stage-ready from the very first note all the way to the final bow.' },
  { emoji:'🎵', title:'Sound & AV',        desc:'Crystal-clear sound so nothing ever distracts from the dance itself.' },
  { emoji:'🌸', title:'Florists & Décor',  desc:'Spaces and stages that set exactly the right scene for every show.' },
];

const PRIVACY_PILLARS = [
  {
    ic: 'lock',
    title: 'We never read your data',
    body: "Your student records, class notes and financial data are yours. We run the platform — we don't look inside it. Ever.",
  },
  {
    ic: 'shield',
    title: 'We never sell your data',
    body: "No advertising. No data brokers. No profiling. Your studio's information stays with you — not with us, not with anyone else.",
  },
  {
    ic: 'heart',
    title: 'Trust is our foundation',
    body: "Every product decision starts with one question: does this serve our users? We built ManchQ on that principle and we intend to keep it that way.",
  },
];

const MOBILE_BULLETS = [
  'Full calendar and scheduling on any phone',
  'Add and edit events with a single tap',
  'Parent portal works in any browser — no app to install',
  'Same great experience on desktop, tablet and mobile',
];

// ── Nav ────────────────────────────────────────────────────────────────────────
function NavBar({ onLogin, isMobile }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);

  return (
    <nav style={{
      position:'fixed', top:0, left:0, right:0, zIndex:100,
      background: scrolled ? 'rgba(10,8,20,0.94)' : 'transparent',
      backdropFilter: scrolled ? 'blur(14px)' : 'none',
      borderBottom: scrolled ? '1px solid rgba(124,58,237,0.18)' : 'none',
      transition:'all .28s',
      padding: isMobile ? '0 20px' : '0 48px', height:60,
      display:'flex', alignItems:'center', justifyContent:'space-between',
    }}>
      <div style={{ fontWeight:900, fontSize:19, letterSpacing:'-.02em', color:'#fff' }}>
        Manch<span style={{ background:BTN_GRAD, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>Q</span>
      </div>
      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
        {!isMobile && <>
          <a href="#features"   style={{ fontSize:13, fontWeight:600, color:'#9CA3AF', textDecoration:'none', padding:'8px 14px' }}>Features</a>
          <a href="#why"        style={{ fontSize:13, fontWeight:600, color:'#9CA3AF', textDecoration:'none', padding:'8px 14px' }}>Why us</a>
          <a href="#community"  style={{ fontSize:13, fontWeight:600, color:'#9CA3AF', textDecoration:'none', padding:'8px 14px' }}>Community</a>
        </>}
        <button onClick={onLogin} style={{
          padding: isMobile ? '8px 18px' : '9px 22px',
          borderRadius:10, border:'none',
          background:BTN_GRAD, color:'#fff',
          fontWeight:700, fontSize:13, cursor:'pointer',
          boxShadow:'0 2px 14px rgba(124,58,237,0.42)',
          transition:'transform .15s, box-shadow .15s',
          whiteSpace:'nowrap',
        }}
          onMouseEnter={e=>{ e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 4px 20px rgba(124,58,237,0.55)'; }}
          onMouseLeave={e=>{ e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='0 2px 14px rgba(124,58,237,0.42)'; }}
        >Log in →</button>
      </div>
    </nav>
  );
}

// ── Phone frame component ──────────────────────────────────────────────────────
function PhoneFrame({ src, alt, width = 180 }) {
  return (
    <div style={{
      width, flexShrink: 0,
      borderRadius: 28,
      border: '2px solid rgba(255,255,255,0.14)',
      background: '#0a0810',
      overflow: 'hidden',
      boxShadow: '0 24px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)',
    }}>
      {/* Notch */}
      <div style={{ height: 22, background: '#0a0810', display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ width: 52, height: 7, background: 'rgba(255,255,255,0.12)', borderRadius: 99 }} />
      </div>
      <img
        src={src} alt={alt}
        loading="lazy"
        style={{ width: '100%', display: 'block', objectFit: 'cover', objectPosition: 'top', maxHeight: 360 }}
      />
      {/* Home bar */}
      <div style={{ height: 18, background: '#0a0810', display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ width: 40, height: 4, background: 'rgba(255,255,255,0.18)', borderRadius: 99 }} />
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function LandingPageA() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const goLogin  = () => navigate('/login');

  return (
    <div style={{ fontFamily:'var(--font-sans)', background:'#08060F', minHeight:'100vh', color:'#fff', overflowX:'hidden' }}>
      <NavBar onLogin={goLogin} isMobile={isMobile} />

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section style={{
        minHeight:'100vh', display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center',
        textAlign:'center', padding: isMobile ? '100px 20px 60px' : '120px 24px 80px',
        position:'relative', overflow:'hidden',
      }}>
        {/* Glow blobs */}
        <div style={{ position:'absolute', top:'15%', left:'50%', transform:'translateX(-50%)', width: isMobile ? 400 : 700, height: isMobile ? 400 : 700, background:'radial-gradient(circle, rgba(124,58,237,0.22) 0%, transparent 68%)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', bottom:'5%', right: isMobile ? '-10%' : '8%', width:300, height:300, background:'radial-gradient(circle, rgba(220,78,255,0.12) 0%, transparent 70%)', pointerEvents:'none' }} />

        <div style={{ position:'relative', width:'100%', maxWidth:820 }}>
          {/* Pill tag */}
          <div style={{
            display:'inline-flex', alignItems:'center', gap:8,
            background:'rgba(124,58,237,0.1)', border:'1px solid rgba(124,58,237,0.28)',
            borderRadius:99, padding: isMobile ? '5px 14px' : '6px 18px',
            fontSize: isMobile ? 11 : 12, fontWeight:700, color:'#C084FC',
            marginBottom: isMobile ? 22 : 30, letterSpacing:'.06em', textTransform:'uppercase',
          }}>
            <Icon paths={IC.dance} size={13} stroke="#C084FC" sw={1.8} />
            {isMobile ? 'For dance studios' : 'Made for dance studios, by people who love dance'}
          </div>

          {/* Headline */}
          <h1 style={{
            fontSize: isMobile ? 'clamp(28px, 9vw, 48px)' : 'clamp(38px, 6.5vw, 76px)',
            fontWeight:900, lineHeight:1.08,
            margin:'0 auto 20px', letterSpacing:'-.03em',
            wordBreak:'break-word', overflowWrap:'break-word',
          }}>
            Every step,{' '}
            <span style={{ background:BTN_GRAD, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', display: isMobile ? 'block' : 'inline', wordBreak:'break-word' }}>
              beautifully organised.
            </span>
          </h1>

          <p style={{ fontSize: isMobile ? 16 : 18, color:'#9CA3AF', maxWidth:540, margin:'0 auto 40px', lineHeight:1.75, padding: isMobile ? '0 4px' : 0 }}>
            You built your studio on passion. ManchQ makes sure the admin
            never gets in the way — scheduling, students and recitals, all in one place.
          </p>

          {/* CTAs */}
          <div style={{ display:'flex', flexDirection: isMobile ? 'column' : 'row', gap:12, flexWrap:'wrap', justifyContent:'center', alignItems:'center' }}>
            <button onClick={goLogin} style={{
              padding: isMobile ? '15px 32px' : '16px 36px',
              width: isMobile ? '100%' : 'auto', maxWidth: isMobile ? 320 : 'none',
              borderRadius:14, border:'none',
              background:BTN_GRAD, color:'#fff',
              fontWeight:800, fontSize: isMobile ? 16 : 17, cursor:'pointer',
              boxShadow:'0 4px 28px rgba(124,58,237,0.50)',
              transition:'transform .15s, box-shadow .15s', display:'flex', alignItems:'center', justifyContent:'center', gap:8,
            }}
              onMouseEnter={e=>{ e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 10px 36px rgba(124,58,237,0.64)'; }}
              onMouseLeave={e=>{ e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='0 4px 28px rgba(124,58,237,0.50)'; }}
            >
              Try ManchQ free <Icon paths={IC.arrow} size={16} stroke="#fff" sw={2} />
            </button>
            <a href="#features" style={{
              padding: isMobile ? '14px 32px' : '16px 32px',
              width: isMobile ? '100%' : 'auto', maxWidth: isMobile ? 320 : 'none',
              borderRadius:14, border:'1.5px solid rgba(255,255,255,0.12)',
              background:'rgba(255,255,255,0.04)',
              color:'#D1D5DB', fontWeight:700, fontSize:15,
              textDecoration:'none', display:'flex', alignItems:'center', justifyContent:'center',
              backdropFilter:'blur(8px)', transition:'border-color .15s', boxSizing:'border-box',
            }}
              onMouseEnter={e=>{ e.currentTarget.style.borderColor='rgba(124,58,237,0.4)'; }}
              onMouseLeave={e=>{ e.currentTarget.style.borderColor='rgba(255,255,255,0.12)'; }}
            >
              See what's inside ↓
            </a>
          </div>

          <div style={{ marginTop:16, fontSize:13, color:'#374151' }}>
            No credit card required · Set up in minutes
          </div>
        </div>

        {/* Trust row */}
        <div style={{
          position:'relative', display:'flex',
          gap: isMobile ? 32 : 64,
          marginTop: isMobile ? 60 : 88,
          flexWrap:'wrap', justifyContent:'center',
        }}>
          {TRUST.map(({ ic, label, sub }) => (
            <div key={label} style={{ textAlign:'center' }}>
              <div style={{ display:'flex', justifyContent:'center', marginBottom:8, color:MAGENTA }}>
                <Icon paths={IC[ic]} size={isMobile ? 22 : 26} stroke={MAGENTA} sw={1.5} />
              </div>
              <div style={{ fontWeight:800, fontSize: isMobile ? 13 : 14, color:'#fff' }}>{label}</div>
              <div style={{ fontSize:11, color:'#4B5563', marginTop:2 }}>{sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────────── */}
      <section id="features" style={{ padding: isMobile ? '64px 20px' : '88px 24px', borderTop:'1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ maxWidth:1100, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom: isMobile ? 40 : 56 }}>
            <div style={{ fontSize:11, fontWeight:700, color:MAGENTA, textTransform:'uppercase', letterSpacing:'.1em', marginBottom:12 }}>Everything you need</div>
            <h2 style={{ fontSize: isMobile ? 'clamp(24px,7vw,34px)' : 'clamp(28px,4vw,46px)', fontWeight:900, margin:'0 0 14px', letterSpacing:'-.02em' }}>
              Built for how studios{' '}
              <span style={{ background:BTN_GRAD, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>actually work.</span>
            </h2>
            <p style={{ fontSize: isMobile ? 14 : 16, color:'#6B7280', maxWidth:500, margin:'0 auto', lineHeight:1.7 }}>
              Every feature designed around a real studio workflow — not a generic business tool.
            </p>
          </div>

          {isMobile ? (
            <div style={{ display:'grid', gap:12 }}>
              {FEATURES.map(({ ic, title, desc }) => (
                <div key={title} style={{
                  background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)',
                  borderRadius:16, padding:'24px 20px', display:'flex', gap:16, alignItems:'flex-start',
                }}>
                  <div style={{ color:MAGENTA, flexShrink:0, marginTop:2 }}>
                    <Icon paths={IC[ic]} size={22} stroke={MAGENTA} sw={1.5} />
                  </div>
                  <div>
                    <div style={{ fontWeight:800, fontSize:15, color:'#fff', marginBottom:6 }}>{title}</div>
                    <div style={{ fontSize:13, color:'#6B7280', lineHeight:1.65 }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:1, border:'1px solid rgba(255,255,255,0.06)', borderRadius:20, overflow:'hidden' }}>
              {FEATURES.map(({ ic, title, desc }) => (
                <div key={title} style={{
                  background:'rgba(255,255,255,0.025)', padding:'36px 30px',
                  borderRight:'1px solid rgba(255,255,255,0.05)', borderBottom:'1px solid rgba(255,255,255,0.05)',
                  transition:'background .2s',
                }}
                  onMouseEnter={e=>{ e.currentTarget.style.background='rgba(124,58,237,0.14)'; }}
                  onMouseLeave={e=>{ e.currentTarget.style.background='rgba(255,255,255,0.025)'; }}
                >
                  <div style={{ color:MAGENTA, marginBottom:18 }}>
                    <Icon paths={IC[ic]} size={28} stroke={MAGENTA} sw={1.5} />
                  </div>
                  <div style={{ fontWeight:800, fontSize:17, color:'#fff', marginBottom:8 }}>{title}</div>
                  <div style={{ fontSize:14, color:'#6B7280', lineHeight:1.68 }}>{desc}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Mobile Showcase ────────────────────────────────────────────── */}
      <section id="mobile" style={{ padding: isMobile ? '64px 20px 48px' : '96px 24px 80px', borderTop:'1px solid rgba(255,255,255,0.05)', overflow:'hidden' }}>
        <div style={{ maxWidth:1100, margin:'0 auto' }}>

          {/* Headline */}
          <div style={{ textAlign:'center', marginBottom: isMobile ? 40 : 60 }}>
            <div style={{ fontSize:11, fontWeight:700, color:MAGENTA, textTransform:'uppercase', letterSpacing:'.1em', marginBottom:12 }}>Works on every device</div>
            <h2 style={{ fontSize: isMobile ? 'clamp(24px,7vw,34px)' : 'clamp(28px,4vw,46px)', fontWeight:900, margin:'0 0 14px', letterSpacing:'-.02em' }}>
              Your studio,{' '}
              <span style={{ background:BTN_GRAD, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>in your pocket.</span>
            </h2>
            <p style={{ fontSize: isMobile ? 14 : 16, color:'#6B7280', maxWidth:560, margin:'0 auto', lineHeight:1.75 }}>
              Designed mobile-first from day one. Add events from the car park, check today's classes at the school gate,
              approve studio bookings mid-commute. No app to download — it runs beautifully in any browser.
            </p>
          </div>

          {isMobile ? (
            /* Mobile: single phone frame centred */
            <div style={{ display:'flex', justifyContent:'center', marginBottom:36 }}>
              <PhoneFrame src="/screenshots/screen-mobile-dashboard.PNG" alt="ManchQ mobile dashboard" width={240} />
            </div>
          ) : (
            /* Desktop: browser frame with two phones overlapping at the bottom */
            <div style={{ position:'relative', maxWidth:900, margin:'0 auto', paddingBottom:130 }}>
              {/* Browser / desktop frame */}
              <div style={{
                borderRadius:14, border:'1px solid rgba(255,255,255,0.12)',
                overflow:'hidden', boxShadow:'0 30px 90px rgba(0,0,0,0.65)',
              }}>
                {/* Chrome bar */}
                <div style={{ height:36, background:'#0f0c1a', display:'flex', alignItems:'center', padding:'0 16px', gap:6, flexShrink:0 }}>
                  <div style={{ width:11, height:11, borderRadius:'50%', background:'#FF5F57', flexShrink:0 }} />
                  <div style={{ width:11, height:11, borderRadius:'50%', background:'#FEBC2E', flexShrink:0 }} />
                  <div style={{ width:11, height:11, borderRadius:'50%', background:'#28C840', flexShrink:0 }} />
                  <div style={{ flex:1, height:20, background:'rgba(255,255,255,0.06)', borderRadius:6, marginLeft:10, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <span style={{ fontSize:10, color:'rgba(255,255,255,0.25)', letterSpacing:'.02em' }}>app.manchq.com</span>
                  </div>
                </div>
                <img
                  src="/screenshots/screen-desktop.PNG"
                  alt="ManchQ on desktop"
                  loading="lazy"
                  style={{ width:'100%', display:'block', maxHeight:480, objectFit:'cover', objectPosition:'top' }}
                />
              </div>

              {/* Phone left — dashboard */}
              <div style={{ position:'absolute', bottom:0, left:60 }}>
                <PhoneFrame src="/screenshots/screen-mobile-dashboard.PNG" alt="ManchQ mobile dashboard" width={185} />
              </div>

              {/* Phone right — recital cover */}
              <div style={{ position:'absolute', bottom:0, right:60 }}>
                <PhoneFrame src="/screenshots/screen-mobile-recital-cover.PNG" alt="ManchQ recital view" width={185} />
              </div>
            </div>
          )}

          {/* Feature bullets */}
          <div style={{
            display:'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(2,1fr)',
            gap: isMobile ? 12 : 14,
            maxWidth: isMobile ? '100%' : 700,
            margin: isMobile ? '0 auto' : '48px auto 0',
          }}>
            {MOBILE_BULLETS.map(b => (
              <div key={b} style={{ display:'flex', alignItems:'center', gap:12 }}>
                <div style={{
                  width:22, height:22, borderRadius:99,
                  background:'rgba(124,58,237,0.15)', border:'1px solid rgba(124,58,237,0.35)',
                  display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
                }}>
                  <Icon paths={IC.check} size={12} stroke={MAGENTA} sw={2.5} />
                </div>
                <span style={{ fontSize: isMobile ? 13 : 14, color:'#D1D5DB', lineHeight:1.5 }}>{b}</span>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ── Benefits ───────────────────────────────────────────────────── */}
      <section id="why" style={{ padding: isMobile ? '64px 20px' : '88px 24px', background:'rgba(255,255,255,0.018)' }}>
        <div style={{ maxWidth:860, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom: isMobile ? 36 : 56 }}>
            <div style={{ fontSize:11, fontWeight:700, color:MAGENTA, textTransform:'uppercase', letterSpacing:'.1em', marginBottom:12 }}>Why ManchQ</div>
            <h2 style={{ fontSize: isMobile ? 'clamp(24px,7vw,34px)' : 'clamp(28px,4vw,46px)', fontWeight:900, margin:0, letterSpacing:'-.02em' }}>
              More time doing what you{' '}
              <span style={{ background:BTN_GRAD, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>love.</span>
            </h2>
          </div>

          <div style={{ display:'grid', gap:12 }}>
            {BENEFITS.map(({ heading, body }, i) => (
              <div key={heading} style={{
                background:'rgba(255,255,255,0.025)', border:'1px solid rgba(255,255,255,0.07)',
                borderRadius:18, padding: isMobile ? '22px 20px' : '28px 32px',
                display:'flex', alignItems:'flex-start', gap: isMobile ? 16 : 22,
                transition:'background .2s, border-color .2s',
              }}
                onMouseEnter={e=>{ e.currentTarget.style.background='rgba(124,58,237,0.10)'; e.currentTarget.style.borderColor='rgba(124,58,237,0.3)'; }}
                onMouseLeave={e=>{ e.currentTarget.style.background='rgba(255,255,255,0.025)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.07)'; }}
              >
                <div style={{
                  width: isMobile ? 36 : 44, height: isMobile ? 36 : 44,
                  borderRadius:12, background:BTN_GRAD, flexShrink:0,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  color:'#fff', fontWeight:900, fontSize: isMobile ? 15 : 17,
                  boxShadow:'0 2px 14px rgba(124,58,237,0.4)',
                }}>{i + 1}</div>
                <div>
                  <div style={{ fontWeight:800, fontSize: isMobile ? 15 : 17, color:'#fff', marginBottom:5 }}>{heading}</div>
                  <div style={{ fontSize: isMobile ? 13 : 14, color:'#6B7280', lineHeight:1.72 }}>{body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Community ──────────────────────────────────────────────────── */}
      <section id="community" style={{ padding: isMobile ? '64px 20px' : '96px 24px', borderTop:'1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ maxWidth:1100, margin:'0 auto' }}>

          {/* Headline */}
          <div style={{ textAlign:'center', marginBottom: isMobile ? 40 : 60 }}>
            <div style={{ fontSize:11, fontWeight:700, color:MAGENTA, textTransform:'uppercase', letterSpacing:'.1em', marginBottom:12 }}>Your extended team</div>
            <h2 style={{ fontSize: isMobile ? 'clamp(24px,7vw,34px)' : 'clamp(28px,4vw,46px)', fontWeight:900, margin:'0 0 14px', letterSpacing:'-.02em' }}>
              A community built{' '}
              <span style={{ background:BTN_GRAD, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>around dance.</span>
            </h2>
            <p style={{ fontSize: isMobile ? 14 : 16, color:'#6B7280', maxWidth:580, margin:'0 auto', lineHeight:1.78 }}>
              Running a recital takes more than great choreography. ManchQ connects you with a trusted
              network of photographers, videographers, costume designers, makeup artists and more —
              all as passionate about dance as you are.
            </p>
          </div>

          {/* Provider grid */}
          <div style={{
            display:'grid',
            gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(3,1fr)',
            gap: isMobile ? 12 : 16,
            marginBottom: isMobile ? 24 : 32,
          }}>
            {PROVIDERS.map(({ emoji, title, desc }) => (
              <div key={title} style={{
                background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)',
                borderRadius:16, padding: isMobile ? '20px 16px' : '28px 24px',
                transition:'background .2s, border-color .2s, transform .2s',
              }}
                onMouseEnter={e=>{ e.currentTarget.style.background='rgba(124,58,237,0.10)'; e.currentTarget.style.borderColor='rgba(124,58,237,0.28)'; e.currentTarget.style.transform='translateY(-2px)'; }}
                onMouseLeave={e=>{ e.currentTarget.style.background='rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.07)'; e.currentTarget.style.transform='none'; }}
              >
                <div style={{ fontSize: isMobile ? 28 : 34, marginBottom: isMobile ? 10 : 14, lineHeight:1 }}>{emoji}</div>
                <div style={{ fontWeight:800, fontSize: isMobile ? 14 : 16, color:'#fff', marginBottom: isMobile ? 5 : 7 }}>{title}</div>
                <div style={{ fontSize: isMobile ? 12 : 13, color:'#6B7280', lineHeight:1.65 }}>{desc}</div>
              </div>
            ))}
          </div>

          {/* Parent volunteer highlight strip */}
          <div style={{
            padding: isMobile ? '20px 20px' : '26px 36px',
            borderRadius:18,
            background:'rgba(124,58,237,0.08)',
            border:'1.5px solid rgba(124,58,237,0.22)',
            display:'flex', alignItems: isMobile ? 'flex-start' : 'center',
            gap: isMobile ? 16 : 24,
            flexDirection: isMobile ? 'column' : 'row',
          }}>
            <div style={{ fontSize: isMobile ? 32 : 44, lineHeight:1, flexShrink:0 }}>👨‍👩‍👧</div>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:800, fontSize: isMobile ? 15 : 18, color:'#fff', marginBottom:6 }}>
                Parent volunteers — a first-class feature
              </div>
              <div style={{ fontSize: isMobile ? 13 : 14, color:'#6B7280', lineHeight:1.72 }}>
                Your biggest fans deserve their own space too. ManchQ lets you assign volunteer roles,
                coordinate availability and keep everyone in the loop — all within the same platform,
                no separate tools required.
              </div>
            </div>
            <button onClick={goLogin} style={{
              flexShrink:0, padding:'10px 22px', borderRadius:10, border:'none',
              background:BTN_GRAD, color:'#fff', fontWeight:700, fontSize:13,
              cursor:'pointer', whiteSpace:'nowrap',
              boxShadow:'0 2px 14px rgba(124,58,237,0.4)',
              transition:'transform .15s',
            }}
              onMouseEnter={e=>e.currentTarget.style.transform='translateY(-1px)'}
              onMouseLeave={e=>e.currentTarget.style.transform='none'}
            >
              See how it works →
            </button>
          </div>

        </div>
      </section>

      {/* ── Trust & Privacy ────────────────────────────────────────────── */}
      <section id="trust" style={{ padding: isMobile ? '64px 20px' : '96px 24px', background:'rgba(255,255,255,0.018)', position:'relative', overflow:'hidden' }}>
        {/* Shield watermark */}
        <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', opacity:0.028, pointerEvents:'none', userSelect:'none' }}>
          <svg width={isMobile ? 320 : 520} height={isMobile ? 320 : 520} viewBox="0 0 24 24" fill="white" stroke="none">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
        </div>

        <div style={{ maxWidth:1000, margin:'0 auto', position:'relative' }}>

          {/* Headline */}
          <div style={{ textAlign:'center', marginBottom: isMobile ? 40 : 64 }}>
            <div style={{ fontSize:11, fontWeight:700, color:MAGENTA, textTransform:'uppercase', letterSpacing:'.1em', marginBottom:12 }}>Privacy & trust</div>
            <h2 style={{ fontSize: isMobile ? 'clamp(24px,7vw,34px)' : 'clamp(28px,4vw,46px)', fontWeight:900, margin:'0 0 14px', letterSpacing:'-.02em' }}>
              Your data is{' '}
              <span style={{ background:BTN_GRAD, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>sacred.</span>
            </h2>
            <p style={{ fontSize: isMobile ? 14 : 16, color:'#6B7280', maxWidth:520, margin:'0 auto', lineHeight:1.75 }}>
              We built ManchQ on a single primary tenet — trust. Every decision we make, every line
              of code we write, starts and ends there.
            </p>
          </div>

          {/* Three pillars */}
          <div style={{
            display:'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)',
            gap: isMobile ? 16 : 20,
            marginBottom: isMobile ? 40 : 56,
          }}>
            {PRIVACY_PILLARS.map(({ ic, title, body }) => (
              <div key={title} style={{
                background:'rgba(255,255,255,0.025)', border:'1px solid rgba(255,255,255,0.07)',
                borderRadius:18, padding: isMobile ? '24px 20px' : '32px 28px',
                display:'flex', flexDirection:'column', gap:16,
              }}>
                {/* Icon circle */}
                <div style={{
                  width:48, height:48, borderRadius:14,
                  background:'rgba(124,58,237,0.15)', border:'1px solid rgba(124,58,237,0.28)',
                  display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
                }}>
                  <Icon paths={IC[ic]} size={22} stroke={MAGENTA} sw={1.6} />
                </div>
                <div>
                  <div style={{ fontWeight:800, fontSize: isMobile ? 15 : 17, color:'#fff', marginBottom:8 }}>{title}</div>
                  <div style={{ fontSize: isMobile ? 13 : 14, color:'#6B7280', lineHeight:1.72 }}>{body}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Closing quote */}
          <div style={{
            textAlign:'center', padding: isMobile ? '28px 20px' : '36px 40px',
            borderRadius:18, border:'1px solid rgba(255,255,255,0.06)',
            background:'rgba(255,255,255,0.018)',
          }}>
            <div style={{ fontSize: isMobile ? 22 : 28, marginBottom:16 }}>🤝</div>
            <p style={{
              fontSize: isMobile ? 15 : 18, color:'#9CA3AF',
              fontStyle:'italic', maxWidth:580, margin:'0 auto', lineHeight:1.82,
            }}>
              "You've trusted us with your students, your schedules, and your studio's story.
              <br />We don't take that lightly — and we never will."
            </p>
          </div>

        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────────── */}
      <section style={{ padding: isMobile ? '72px 20px' : '100px 24px', textAlign:'center', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse at center, rgba(124,58,237,0.26) 0%, transparent 68%)', pointerEvents:'none' }} />
        <div style={{ position:'relative', maxWidth:640, margin:'0 auto' }}>
          <div style={{ display:'flex', justifyContent:'center', marginBottom:20, color:MAGENTA }}>
            <Icon paths={IC.heart} size={isMobile ? 36 : 44} stroke={MAGENTA} sw={1.4} />
          </div>
          <h2 style={{ fontSize: isMobile ? 'clamp(26px,8vw,40px)' : 'clamp(30px,5vw,54px)', fontWeight:900, margin:'0 0 16px', lineHeight:1.15, letterSpacing:'-.03em' }}>
            Ready to spend more time<br />
            <span style={{ background:BTN_GRAD, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
              doing what you love?
            </span>
          </h2>
          <p style={{ fontSize: isMobile ? 15 : 17, color:'#6B7280', margin:'0 0 36px', lineHeight:1.75 }}>
            Join studio owners who've traded spreadsheet chaos for something that actually feels good to use.
          </p>
          <button onClick={goLogin} style={{
            padding: isMobile ? '16px 36px' : '18px 48px',
            width: isMobile ? '100%' : 'auto', maxWidth: isMobile ? 320 : 'none',
            borderRadius:16, border:'none',
            background:BTN_GRAD, color:'#fff',
            fontWeight:900, fontSize: isMobile ? 16 : 18, cursor:'pointer',
            boxShadow:'0 4px 32px rgba(124,58,237,0.60)', letterSpacing:'.02em',
            transition:'transform .15s, box-shadow .15s',
          }}
            onMouseEnter={e=>{ e.currentTarget.style.transform='translateY(-3px) scale(1.02)'; e.currentTarget.style.boxShadow='0 12px 42px rgba(124,58,237,0.72)'; }}
            onMouseLeave={e=>{ e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='0 4px 32px rgba(124,58,237,0.60)'; }}
          >
            Get started with ManchQ →
          </button>
          <div style={{ marginTop:18, fontSize:13, color:'#374151' }}>
            No credit card required · Set up in minutes
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer style={{
        borderTop:'1px solid rgba(255,255,255,0.05)',
        padding: isMobile ? '24px 20px' : '28px 48px',
        display:'flex', flexDirection: isMobile ? 'column' : 'row',
        alignItems:'center', justifyContent:'space-between',
        gap:10, textAlign: isMobile ? 'center' : 'left',
      }}>
        <div style={{ fontWeight:900, fontSize:17 }}>
          Manch<span style={{ background:BTN_GRAD, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>Q</span>
        </div>
        <div style={{ fontSize:12, color:'#374151' }}>
          © {new Date().getFullYear()} ManchQ · Made with ♥ for dance studios. ·{' '}
          <a href="mailto:support@manchq.com" style={{ color:'#6a7fdb', textDecoration:'none' }}>support@manchq.com</a>
        </div>
      </footer>
    </div>
  );
}
