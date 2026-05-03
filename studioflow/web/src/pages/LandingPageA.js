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
  // navigation / feature icons
  calendar: ['M8 2v4','M16 2v4','M3 10h18','M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z'],
  student:  ['M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10z','M2 20c0-4 4.5-7 10-7s10 3 10 7'],
  recital:  ['M9 18V5l12-2v13','M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z','M18 19a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'],
  todo:     ['M9 11l3 3L22 4','M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11'],
  studio:   ['M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z','M9 22V12h6v10'],
  // fix: circle path starts at top (y=3) so it stays within the 24x24 viewBox
  parent:   ['M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2','M23 21v-2a4 4 0 0 0-3-3.87','M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z'],
  dance:    ['M12 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4z','M9 8l-3 6h4l1 8','M15 8l3 6h-4l-1 8','M9 14l6-2'],
  heart:    ['M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z'],
  arrow:    ['M5 12h14','M12 5l7 7-7 7'],
  check:    ['M20 6L9 17l-5-5'],
  lock:     ['M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z','M7 11V7a5 5 0 0 1 10 0v4'],
  shield:   ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'],
  // community provider icons
  camera:   ['M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z','M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'],
  video:    ['M23 7l-7 5 7 5V7z','M3 7h11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z'],
  scissors: ['M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z','M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z','M20 4L8.12 15.88','M14.47 14.48L20 20','M8.12 8.12L12 12'],
  star:     'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  speaker:  ['M11 5L6 9H2v6h4l5 4V5z','M19.07 4.93a10 10 0 0 1 0 14.14','M15.54 8.46a5 5 0 0 1 0 7.07'],
  sun:      ['M12 2v2','M12 20v2','M4.93 4.93l1.41 1.41','M17.66 17.66l1.41 1.41','M2 12h2','M20 12h2','M6.34 17.66l-1.41 1.41','M19.07 4.93l-1.41 1.41','M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z'],
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
  { ic:'camera',   title:'Photographers',     desc:'Freeze every leap, every expression, every curtain call — forever.' },
  { ic:'video',    title:'Videographers',     desc:'Every performance preserved so families can relive it for years to come.' },
  { ic:'scissors', title:'Costume Designers', desc:'Bringing characters and cultural traditions to life, one stitch at a time.' },
  { ic:'star',     title:'Makeup Artists',    desc:'Stage-ready from the very first note all the way to the final bow.' },
  { ic:'speaker',  title:'Sound & AV',        desc:'Crystal-clear sound so nothing ever distracts from the dance itself.' },
  { ic:'sun',      title:'Florists & Décor',  desc:'Spaces and stages that set exactly the right scene for every show.' },
];

const PRIVACY_PILLARS = [
  { ic:'lock',   title:'We never read your data',  body:"Your student records, class notes and financial data are yours. We run the platform — we don't look inside it. Ever." },
  { ic:'shield', title:'We never sell your data',  body:"No advertising. No data brokers. No profiling. Your studio's information stays with you — not with us, not with anyone else." },
  { ic:'heart',  title:'Trust is our foundation',  body:"Every product decision starts with one question: does this serve our users? We built ManchQ on that principle and we intend to keep it that way." },
];

const MOBILE_BULLETS = [
  'Full calendar and scheduling on any phone',
  'Add and edit events with a single tap',
  'Parent portal works in any browser — no app to install',
  'Same great experience on desktop, tablet and mobile',
];

// ── Smooth scroll helper ───────────────────────────────────────────────────────
function scrollToSection(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY - 68; // 60px nav + 8px gap
  window.scrollTo({ top, behavior: 'smooth' });
}

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
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <img src="/ManchQ-Logo.png" alt="ManchQ" style={{ height:26, width:26, display:'block', flexShrink:0 }} />
        <span style={{ fontWeight:900, fontSize:19, letterSpacing:'-.02em', color:'#fff' }}>
          Manch<span style={{ background:BTN_GRAD, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>Q</span>
        </span>
      </div>
      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
        {!isMobile && <>
          <a href="#features"  onClick={e => { e.preventDefault(); scrollToSection('features');  }} style={{ fontSize:13, fontWeight:600, color:'#9CA3AF', textDecoration:'none', padding:'8px 14px', cursor:'pointer' }}>Features</a>
          <a href="#why"       onClick={e => { e.preventDefault(); scrollToSection('why');       }} style={{ fontSize:13, fontWeight:600, color:'#9CA3AF', textDecoration:'none', padding:'8px 14px', cursor:'pointer' }}>Why us</a>
          <a href="#community" onClick={e => { e.preventDefault(); scrollToSection('community'); }} style={{ fontSize:13, fontWeight:600, color:'#9CA3AF', textDecoration:'none', padding:'8px 14px', cursor:'pointer' }}>Community</a>
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
        {/* Full-bleed video background */}
        <video
          autoPlay muted loop playsInline
          style={{
            position:'absolute', inset:0,
            width:'100%', height:'100%',
            objectFit:'cover',
            filter:'blur(3px)',
            transform:'scale(1.04)',   /* prevents white blur edges */
            zIndex:0,
          }}
        >
          <source src="/manchq-hero-bg-long.mp4" type="video/mp4" />
        </video>

        {/* Dark gradient overlay — protects text at top, centre and bottom */}
        <div style={{
          position:'absolute', inset:0, zIndex:1,
          background:`linear-gradient(to bottom,
            rgba(8,6,15,0.92) 0%,
            rgba(8,6,15,0.62) 22%,
            rgba(8,6,15,0.58) 50%,
            rgba(8,6,15,0.68) 78%,
            rgba(8,6,15,0.94) 100%)`,
          pointerEvents:'none',
        }} />

        <div style={{ position:'relative', zIndex:2, width:'100%', maxWidth:820 }}>
          {/* Headline — paddingBottom on the gradient span prevents WebkitBackgroundClip
              from cropping the bottom of the last wrapped line */}
          <h1 style={{
            fontSize: isMobile ? 'clamp(28px, 9vw, 48px)' : 'clamp(38px, 6.5vw, 76px)',
            fontWeight:900, lineHeight:1.12,
            margin:'0 auto 20px', letterSpacing:'-.03em',
            wordBreak:'break-word', overflowWrap:'break-word',
          }}>
            Every step,{' '}
            <span style={{
              background:BTN_GRAD, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
              display: isMobile ? 'block' : 'inline',
              wordBreak:'break-word',
              paddingBottom:'0.15em',   // prevents gradient clip on last wrapped line
            }}>
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

        {/* Trust row — desktop/tablet only; mobile hero ends at the CTA buttons */}
        {!isMobile && <div style={{
          position:'relative', zIndex:2, display:'flex',
          gap: 64,
          marginTop: 88,
          flexWrap:'wrap', justifyContent:'center',
        }}>
          {TRUST.map(({ ic, label, sub }) => (
            <div key={label} style={{ textAlign:'center' }}>
              <div style={{ display:'flex', justifyContent:'center', marginBottom:8, color:MAGENTA }}>
                <Icon paths={IC[ic]} size={26} stroke={MAGENTA} sw={1.5} />
              </div>
              <div style={{ fontWeight:800, fontSize:14, color:'#fff' }}>{label}</div>
              <div style={{ fontSize:11, color:'#4B5563', marginTop:2 }}>{sub}</div>
            </div>
          ))}
        </div>}
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
      <section id="mobile" style={{ padding: isMobile ? '64px 20px 48px' : '96px 24px 80px', borderTop:'1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ maxWidth:1060, margin:'0 auto' }}>

          {/* Headline */}
          <div style={{ textAlign:'center', marginBottom: isMobile ? 40 : 56 }}>
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
            /* ── Mobile view: single dashboard screenshot centred ── */
            <div style={{ display:'flex', justifyContent:'center', marginBottom:36 }}>
              <img
                src="/screenshots/screen-mobile-dashboard.png"
                alt="ManchQ mobile dashboard"
                loading="lazy"
                style={{ width:'72%', maxWidth:260, height:'auto', display:'block' }}
              />
            </div>
          ) : (
            /* ── Desktop view: phone | laptop mockup | phone ── */
            <div style={{ display:'flex', alignItems:'center', gap:20 }}>

              {/* Left phone screenshot */}
              <img
                src="/screenshots/screen-mobile-dashboard.png"
                alt="ManchQ mobile dashboard"
                loading="lazy"
                style={{ width:195, height:'auto', display:'block', flexShrink:0 }}
              />

              {/* Desktop — laptop frame is built into the image */}
              <div style={{ flex:1, minWidth:0 }}>
                <img
                  src="/screenshots/manchq-desktop-dashboard-1.png"
                  alt="ManchQ on desktop"
                  loading="lazy"
                  style={{ width:'100%', height:'auto', display:'block' }}
                />
              </div>

              {/* Right phone screenshot */}
              <img
                src="/screenshots/screen-mobile-recital-cover.png"
                alt="ManchQ recital view"
                loading="lazy"
                style={{ width:195, height:'auto', display:'block', flexShrink:0 }}
              />

            </div>
          )}

          {/* Feature bullets */}
          <div style={{
            display:'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(2,1fr)',
            gap: isMobile ? 12 : 14,
            maxWidth: isMobile ? '100%' : 680,
            margin: isMobile ? '0 auto' : '44px auto 0',
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
            {PROVIDERS.map(({ ic, title, desc }) => (
              <div key={title} style={{
                background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)',
                borderRadius:16, padding: isMobile ? '20px 16px' : '28px 24px',
                transition:'background .2s, border-color .2s, transform .2s',
              }}
                onMouseEnter={e=>{ e.currentTarget.style.background='rgba(124,58,237,0.10)'; e.currentTarget.style.borderColor='rgba(124,58,237,0.28)'; e.currentTarget.style.transform='translateY(-2px)'; }}
                onMouseLeave={e=>{ e.currentTarget.style.background='rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.07)'; e.currentTarget.style.transform='none'; }}
              >
                <div style={{
                  width: isMobile ? 38 : 46, height: isMobile ? 38 : 46,
                  borderRadius:12,
                  background:'rgba(124,58,237,0.14)', border:'1px solid rgba(124,58,237,0.28)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  marginBottom: isMobile ? 12 : 16, flexShrink:0,
                }}>
                  <Icon paths={IC[ic]} size={isMobile ? 18 : 22} stroke={MAGENTA} sw={1.5} />
                </div>
                <div style={{ fontWeight:800, fontSize: isMobile ? 14 : 16, color:'#fff', marginBottom: isMobile ? 5 : 7 }}>{title}</div>
                <div style={{ fontSize: isMobile ? 12 : 13, color:'#6B7280', lineHeight:1.65 }}>{desc}</div>
              </div>
            ))}
          </div>

          {/* Parent volunteer highlight strip */}
          <div style={{
            padding: isMobile ? '20px' : '26px 36px',
            borderRadius:18,
            background:'rgba(124,58,237,0.08)',
            border:'1.5px solid rgba(124,58,237,0.22)',
            display:'flex', alignItems: isMobile ? 'flex-start' : 'center',
            gap: isMobile ? 16 : 24,
            flexDirection: isMobile ? 'column' : 'row',
          }}>
            <div style={{
              width: isMobile ? 44 : 54, height: isMobile ? 44 : 54,
              borderRadius:14,
              background:'rgba(124,58,237,0.18)', border:'1px solid rgba(124,58,237,0.32)',
              display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
            }}>
              <Icon paths={IC.parent} size={isMobile ? 22 : 27} stroke={MAGENTA} sw={1.5} />
            </div>
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
        {/* shield watermark removed */}

        <div style={{ maxWidth:1000, margin:'0 auto', position:'relative' }}>

          {/* Headline */}
          <div style={{ textAlign:'center', marginBottom: isMobile ? 40 : 64 }}>
            <div style={{ fontSize:11, fontWeight:700, color:MAGENTA, textTransform:'uppercase', letterSpacing:'.1em', marginBottom:12 }}>Privacy & trust</div>
            <h2 style={{ fontSize: isMobile ? 'clamp(24px,7vw,34px)' : 'clamp(28px,4vw,46px)', fontWeight:900, margin:'0 0 14px', letterSpacing:'-.02em' }}>
              Your data is{' '}
              <span style={{ background:BTN_GRAD, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>secured.</span>
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
            <div style={{ display:'flex', justifyContent:'center', marginBottom:16, color:MAGENTA }}>
              <Icon paths={IC.heart} size={isMobile ? 32 : 40} stroke={MAGENTA} sw={1.4} />
            </div>
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
            Less admin.{' '}
            <span style={{ background:BTN_GRAD, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
              More dance.
            </span>
          </h2>
          <p style={{ fontSize: isMobile ? 15 : 17, color:'#6B7280', margin:'0 0 36px', lineHeight:1.75 }}>
            Everything your studio needs. None of what it doesn't.
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
        <div style={{ display:'flex', alignItems:'center', gap:9 }}>
          <img src="/ManchQ-Logo.png" alt="ManchQ" style={{ height:30, width:30, display:'block', flexShrink:0 }} />
          <span style={{ fontWeight:900, fontSize:17 }}>
            Manch<span style={{ background:BTN_GRAD, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>Q</span>
          </span>
        </div>
        <div style={{ fontSize:12, color:'#374151' }}>
          © {new Date().getFullYear()} ManchQ · Made with care for dance studios. ·{' '}
          <a href="mailto:support@manchq.com" style={{ color:'#6a7fdb', textDecoration:'none' }}>support@manchq.com</a>
        </div>
        <div style={{ fontSize:12, display:'flex', gap:16 }}>
          <a href="/privacy" style={{ color:'#6a7fdb', textDecoration:'none' }}>Privacy Policy</a>
          <a href="/terms" style={{ color:'#6a7fdb', textDecoration:'none' }}>Terms of Service</a>
        </div>
      </footer>
    </div>
  );
}
