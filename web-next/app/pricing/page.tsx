'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const PURPLE   = '#7C3AED';
const MAGENTA  = '#DC4EFF';
const BTN_GRAD = `linear-gradient(135deg, ${PURPLE} 0%, ${MAGENTA} 100%)`;

function useIsMobile(bp = 768) {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < bp);
    fn();
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, [bp]);
  return mobile;
}

function NavBar({ isMobile }: { isMobile: boolean }) {
  const router = useRouter();
  return (
    <nav style={{
      position:'fixed', top:0, left:0, right:0, zIndex:100,
      background:'rgba(10,8,20,0.96)',
      backdropFilter:'blur(14px)',
      borderBottom:'1px solid rgba(124,58,237,0.18)',
      padding: isMobile ? '0 16px' : '0 48px',
      height:60,
      display:'flex', alignItems:'center', justifyContent:'space-between',
    }}>
      <div
        onClick={() => router.push('/')}
        style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer' }}
      >
        <img src="/ManchQ-Logo.png" alt="ManchQ" style={{ height:26, width:26, display:'block', flexShrink:0 }} />
        <span style={{ fontWeight:900, fontSize:19, letterSpacing:'-.02em', color:'#fff' }}>
          Manch<span style={{ background:BTN_GRAD, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>Q</span>
        </span>
      </div>
      <div style={{ display:'flex', gap:isMobile ? 4 : 8, alignItems:'center' }}>
        {!isMobile && (
          <button
            onClick={() => router.push('/')}
            style={{ fontSize:13, fontWeight:600, color:'#9CA3AF', background:'none', border:'none', cursor:'pointer', padding:'8px 14px' }}
          >← Home</button>
        )}
        <button
          onClick={() => router.push('/login')}
          style={{
            padding: isMobile ? '8px 14px' : '9px 22px',
            borderRadius:10, border:'none',
            background:BTN_GRAD, color:'#fff',
            fontWeight:700, fontSize:13, cursor:'pointer',
            boxShadow:'0 2px 14px rgba(124,58,237,0.42)',
            whiteSpace:'nowrap',
          }}
        >Log in →</button>
      </div>
    </nav>
  );
}

function Check({ color = PURPLE }: { color?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink:0, marginTop:1 }}
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function Dash() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="#374151" strokeWidth="2.5" strokeLinecap="round"
      style={{ flexShrink:0, marginTop:1 }}
    >
      <path d="M5 12h14" />
    </svg>
  );
}

const DEBUT_FEATURES = [
  { label:'Up to 30 students',           included:true  },
  { label:'Up to 2 active batches',      included:true  },
  { label:'Up to 4 recitals',            included:true  },
  { label:'All Smart ManchQ features',   included:true  },
  { label:'20 AI actions per day',       included:true  },
  { label:'Class & event scheduling',    included:true  },
  { label:'Attendance tracking',         included:true  },
  { label:'Public RSVP pages',           included:true  },
  { label:'To-do lists',                 included:true  },
  { label:'Higher AI limit (60/day)',    included:false },
  { label:'Custom branding on RSVP',     included:false },
  { label:'Priority support',            included:false },
];

const SPOTLIGHT_FEATURES = [
  { label:'Everything in Debut, plus:',         included:true },
  { label:'Unlimited students',                 included:true },
  { label:'Unlimited batches',                  included:true },
  { label:'Unlimited recitals',                 included:true },
  { label:'60 AI actions per day',              included:true },
  { label:'Custom branding on RSVP pages',      included:true },
  { label:'Priority email support',             included:true },
  { label:'Daily database backups',             included:true },
  { label:'Early access to new features',       included:true },
];

const TABLE_ROWS = [
  { feature:'Students',                  hustler:'Up to 30',       director:'Unlimited'     },
  { feature:'Batches',                   hustler:'Up to 2',        director:'Unlimited'     },
  { feature:'Recitals',                  hustler:'Up to 4',        director:'Unlimited'     },
  { feature:'Smart ManchQ AI',           hustler:'20 / day',       director:'60 / day'      },
  { feature:'Public RSVP pages',         hustler:'✓',              director:'✓'             },
  { feature:'Attendance tracking',       hustler:'✓',              director:'✓'             },
  { feature:'Custom RSVP branding',      hustler:'—',              director:'✓'             },
  { feature:'Support',                   hustler:'Community',      director:'Priority email'},
];

const FAQ = [
  { q:'Why $5.99?',
    a:'It\'s the same as a Starbucks coffee — a price small enough not to think about. We\'d rather have hundreds of happy studios than ten begrudging ones.' },
  { q:'Can I start on Debut and upgrade later?',
    a:'Absolutely. Start free, grow into it. Your data, schedules, students and recitals all carry over instantly when you upgrade.' },
  { q:'Is there a free trial for Spotlight?',
    a:'30 days, no credit card required. You get the full Spotlight experience so you can decide with confidence, not guesswork.' },
  { q:"What happens if I go over Debut's limits?",
    a:"We'll show a friendly nudge when you hit a limit. Your existing data stays put — you just can't add more until you upgrade or remove old records." },
  { q:'Can I cancel anytime?',
    a:'Yes, anytime. No lock-in, no fees. If you cancel, you stay on Spotlight until the end of your billing period, then drop to Debut.' },
  { q:'Do you offer discounts for smaller studios?',
    a:"Honestly at $5.99 we're already priced for the smallest studios. If genuine hardship — reach out, we'll work something out." },
];

export default function PricingPage() {
  const router          = useRouter();
  const isMobile        = useIsMobile();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const price         = '5.99';
  const cadence       = '/month';

  const px = isMobile ? 16 : 24;

  return (
    <div style={{ minHeight:'100vh', background:'#080613', color:'#fff', fontFamily:'system-ui,-apple-system,sans-serif' }}>
      <NavBar isMobile={isMobile} />

      <section style={{ paddingTop:100, paddingBottom:60, textAlign:'center', padding:`100px ${px}px 60px` }}>
        <div style={{
          display:'inline-block', fontSize:11, fontWeight:700, letterSpacing:'.12em',
          textTransform:'uppercase', color:MAGENTA,
          background:'rgba(220,78,255,0.1)', border:'1px solid rgba(220,78,255,0.25)',
          borderRadius:20, padding:'5px 14px', marginBottom:20,
        }}>Simple, honest pricing</div>

        <h1 style={{
          fontSize: isMobile ? 34 : 'clamp(36px,6vw,64px)',
          fontWeight:900, lineHeight:1.08, letterSpacing:'-.03em',
          margin:'0 auto 16px', maxWidth:680,
        }}>
          Pick the plan that{' '}
          <span style={{ background:BTN_GRAD, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>
            fits your hustle
          </span>
        </h1>

        <p style={{ fontSize: isMobile ? 15 : 18, color:'#9CA3AF', maxWidth:480, margin:'0 auto 28px', lineHeight:1.65 }}>
          Start free, upgrade when you're ready. No lock-ins, no gotchas.
        </p>

        {/* The coffee hook — a friendly anchor for the price point */}
        <div style={{
          display:'inline-flex', alignItems:'center', gap:10,
          background:'rgba(255,255,255,0.04)',
          border:'1px solid rgba(220,78,255,0.25)',
          borderRadius:40, padding:'10px 18px',
        }}>
          <span style={{ fontSize: isMobile ? 18 : 22 }} aria-hidden>☕</span>
          <span style={{ fontSize: isMobile ? 13 : 14, color:'#E5E7EB', fontWeight:600, letterSpacing:'-.005em' }}>
            <span style={{ color:'#9CA3AF' }}>Less than a Starbucks coffee —</span>{' '}
            <span style={{ color:'#fff' }}>buy your digital companion a latte</span>
          </span>
        </div>
      </section>

      <section style={{ padding:`0 ${px}px 80px`, maxWidth:960, margin:'0 auto' }}>
        <div style={{
          display:'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(2,1fr)',
          gap:20, alignItems:'start',
        }}>
          <div style={{
            background:'rgba(255,255,255,0.03)',
            border:'1.5px solid rgba(255,255,255,0.1)',
            borderRadius:24, padding: isMobile ? 24 : 36,
            display:'flex', flexDirection:'column',
          }}>
            <div style={{ marginBottom:24 }}>
              <div style={{ fontSize:10, fontWeight:800, letterSpacing:'.14em', textTransform:'uppercase', color:'#6B7280', marginBottom:10 }}>Free forever</div>
              <h2 style={{ fontSize:28, fontWeight:900, color:'#fff', margin:'0 0 8px', letterSpacing:'-.02em' }}>Debut</h2>
              <p style={{ fontSize:13, color:'#9CA3AF', margin:'0 0 20px', lineHeight:1.55 }}>
                For the driven instructor getting their studio off the ground. Zero cost, zero excuses.
              </p>
              <div style={{ display:'flex', alignItems:'flex-end', gap:4, marginBottom:4 }}>
                <span style={{ fontSize:48, fontWeight:900, color:'#fff', lineHeight:1, letterSpacing:'-.03em' }}>$0</span>
                <span style={{ fontSize:13, color:'#6B7280', fontWeight:600, marginBottom:9 }}>/month</span>
              </div>
              <p style={{ fontSize:12, color:'#374151', margin:0 }}>No credit card required</p>
            </div>

            <button
              onClick={() => router.push('/register')}
              style={{
                width:'100%', padding:'13px', borderRadius:12,
                border:'1.5px solid rgba(124,58,237,0.45)', background:'transparent',
                color:PURPLE, fontWeight:700, fontSize:15, cursor:'pointer',
                transition:'all .18s', marginBottom:28,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background='rgba(124,58,237,0.1)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background='transparent'; }}
            >Start free →</button>

            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {DEBUT_FEATURES.map(({ label, included }) => (
                <div key={label} style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                  {included ? <Check color={PURPLE} /> : <Dash />}
                  <span style={{ fontSize:13, color: included ? '#D1D5DB' : '#4B5563', lineHeight:1.4 }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{
            background:'linear-gradient(160deg,rgba(124,58,237,0.18) 0%,rgba(220,78,255,0.1) 100%)',
            border:'1.5px solid rgba(124,58,237,0.5)',
            borderRadius:24, padding: isMobile ? 24 : 36,
            display:'flex', flexDirection:'column',
            position:'relative', overflow:'hidden',
            boxShadow:'0 0 60px rgba(124,58,237,0.15)',
          }}>
            <div style={{ position:'absolute', top:-50, right:-50, width:180, height:180, background:'radial-gradient(circle,rgba(220,78,255,0.2) 0%,transparent 70%)', pointerEvents:'none' }} />

            <div style={{
              position:'absolute', top:16, right:16,
              fontSize:10, fontWeight:800, letterSpacing:'.1em', textTransform:'uppercase',
              color:'#fff', background:BTN_GRAD, borderRadius:20, padding:'4px 11px',
            }}>Most popular</div>

            <div style={{ marginBottom:24 }}>
              <div style={{ fontSize:10, fontWeight:800, letterSpacing:'.14em', textTransform:'uppercase', color:MAGENTA, marginBottom:10 }}>Full power</div>
              <h2 style={{ fontSize:28, fontWeight:900, color:'#fff', margin:'0 0 8px', letterSpacing:'-.02em' }}>Spotlight</h2>
              <p style={{ fontSize:13, color:'#C4B5FD', margin:'0 0 20px', lineHeight:1.55 }}>
                For the studio that means business. Unlimited everything, the full toolkit, support that shows up.
              </p>
              <div style={{ display:'flex', alignItems:'flex-end', gap:4, marginBottom:6 }}>
                <span style={{ fontSize:48, fontWeight:900, color:'#fff', lineHeight:1, letterSpacing:'-.03em' }}>${price}</span>
                <span style={{ fontSize:13, color:'#A78BFA', fontWeight:600, marginBottom:9 }}>{cadence}</span>
              </div>
              <div style={{ height:18 }}>
                <span style={{ fontSize:12, color:'#A78BFA', fontWeight:600 }}>☕ Same as your coffee. Twice the smiles.</span>
              </div>
            </div>

            <button
              onClick={() => router.push('/register')}
              style={{
                width:'100%', padding:'13px', borderRadius:12, border:'none',
                background:BTN_GRAD, color:'#fff', fontWeight:700, fontSize:15, cursor:'pointer',
                boxShadow:'0 4px 20px rgba(124,58,237,0.45)',
                transition:'transform .18s,box-shadow .18s', marginBottom:28,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform='translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow='0 8px 28px rgba(124,58,237,0.55)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform='none'; (e.currentTarget as HTMLElement).style.boxShadow='0 4px 20px rgba(124,58,237,0.45)'; }}
            >Start 30-day free trial →</button>

            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {SPOTLIGHT_FEATURES.map(({ label }) => (
                <div key={label} style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                  <Check color={MAGENTA} />
                  <span style={{ fontSize:13, color:'#E5E7EB', lineHeight:1.4 }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{
          marginTop:32, textAlign:'center', padding:'24px 20px',
          background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:14,
        }}>
          <p style={{ fontSize:14, color:'#9CA3AF', margin:'0 0 8px' }}>
            Running a large academy or franchise? <strong style={{ color:'#fff' }}>Let's talk.</strong>
          </p>
          <a href="mailto:support@manchq.com" style={{ fontSize:13, fontWeight:700, color:MAGENTA, textDecoration:'none' }}>
            Contact us for a custom plan →
          </a>
        </div>
      </section>

      {!isMobile && (
        <section style={{ padding:`0 ${px}px 90px`, maxWidth:680, margin:'0 auto' }}>
          <h2 style={{ textAlign:'center', fontSize:26, fontWeight:800, marginBottom:36, letterSpacing:'-.02em' }}>Side by side</h2>
          <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:20, overflow:'hidden' }}>
            <div style={{ display:'grid', gridTemplateColumns:'1.2fr 1fr 1fr', background:'rgba(255,255,255,0.05)', padding:'13px 22px' }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#6B7280', textTransform:'uppercase', letterSpacing:'.08em' }}>Feature</div>
              <div style={{ fontSize:11, fontWeight:700, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'.08em', textAlign:'center' }}>Debut</div>
              <div style={{ fontSize:11, fontWeight:700, color:MAGENTA,   textTransform:'uppercase', letterSpacing:'.08em', textAlign:'center' }}>Spotlight</div>
            </div>
            {TABLE_ROWS.map((row, i) => (
              <div key={row.feature} style={{
                display:'grid', gridTemplateColumns:'1.2fr 1fr 1fr',
                padding:'12px 22px', borderTop:'1px solid rgba(255,255,255,0.05)',
                background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
              }}>
                <div style={{ fontSize:13, color:'#D1D5DB' }}>{row.feature}</div>
                <div style={{ fontSize:13, color: row.hustler === '—' ? '#374151' : '#9CA3AF', textAlign:'center' }}>{row.hustler}</div>
                <div style={{ fontSize:13, color:'#C4B5FD', fontWeight:600, textAlign:'center' }}>{row.director}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {isMobile && (
        <section style={{ padding:`0 ${px}px 72px` }}>
          <h2 style={{ textAlign:'center', fontSize:22, fontWeight:800, marginBottom:24, letterSpacing:'-.02em' }}>Side by side</h2>
          <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
            {TABLE_ROWS.map((row, i) => (
              <div key={row.feature} style={{
                display:'grid', gridTemplateColumns:'1fr auto auto',
                alignItems:'center', gap:8,
                padding:'11px 16px',
                background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                borderRadius:10,
              }}>
                <span style={{ fontSize:13, color:'#D1D5DB' }}>{row.feature}</span>
                <span style={{
                  fontSize:11, color: row.hustler === '—' ? '#374151' : '#9CA3AF',
                  background:'rgba(255,255,255,0.05)', borderRadius:8, padding:'3px 9px',
                  textAlign:'center', whiteSpace:'nowrap',
                }}>{row.hustler}</span>
                <span style={{
                  fontSize:11, color:'#C4B5FD', fontWeight:700,
                  background:'rgba(124,58,237,0.12)', border:'1px solid rgba(124,58,237,0.25)',
                  borderRadius:8, padding:'3px 9px', textAlign:'center', whiteSpace:'nowrap',
                }}>{row.director}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section style={{ padding:`0 ${px}px 90px`, maxWidth:620, margin:'0 auto' }}>
        <h2 style={{ textAlign:'center', fontSize: isMobile ? 22 : 26, fontWeight:800, marginBottom:32, letterSpacing:'-.02em' }}>
          Questions? Answered.
        </h2>
        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
          {FAQ.map((item, i) => (
            <div key={i} style={{ border:'1px solid rgba(255,255,255,0.08)', borderRadius:12, overflow:'hidden' }}>
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                style={{
                  width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between',
                  padding:'16px 18px', background:'rgba(255,255,255,0.03)',
                  border:'none', color:'#F3F4F6', fontWeight:600, fontSize: isMobile ? 13 : 14,
                  cursor:'pointer', textAlign:'left', gap:12, transition:'background .15s',
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.06)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.03)'}
              >
                <span style={{ flex:1 }}>{item.q}</span>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink:0, transition:'transform .2s', transform: openFaq === i ? 'rotate(180deg)' : 'none' }}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {openFaq === i && (
                <div style={{ padding:'0 18px 16px', fontSize:13, color:'#9CA3AF', lineHeight:1.7, background:'rgba(255,255,255,0.02)' }}>
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section style={{ padding:`0 ${px}px 100px`, textAlign:'center' }}>
        <div style={{
          maxWidth:520, margin:'0 auto',
          background:'linear-gradient(135deg,rgba(124,58,237,0.18) 0%,rgba(220,78,255,0.12) 100%)',
          border:'1.5px solid rgba(124,58,237,0.35)',
          borderRadius:24, padding: isMobile ? '36px 24px' : '48px 40px',
          boxShadow:'0 0 80px rgba(124,58,237,0.1)',
        }}>
          <h2 style={{ fontSize: isMobile ? 24 : 28, fontWeight:900, margin:'0 0 12px', letterSpacing:'-.02em' }}>
            Ready to run your studio?
          </h2>
          <p style={{ fontSize: isMobile ? 14 : 15, color:'#9CA3AF', margin:'0 0 28px', lineHeight:1.65 }}>
            Start on Debut — free, forever. Upgrade to Spotlight when you're ready to unlock everything.
          </p>
          <div style={{ display:'flex', gap:10, justifyContent:'center', flexDirection: isMobile ? 'column' : 'row' }}>
            <button
              onClick={() => router.push('/register')}
              style={{
                padding:'14px 28px', borderRadius:12, border:'none',
                background:BTN_GRAD, color:'#fff', fontWeight:700, fontSize:15, cursor:'pointer',
                boxShadow:'0 4px 20px rgba(124,58,237,0.45)', transition:'transform .18s,box-shadow .18s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform='translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow='0 8px 28px rgba(124,58,237,0.55)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform='none'; (e.currentTarget as HTMLElement).style.boxShadow='0 4px 20px rgba(124,58,237,0.45)'; }}
            >Get started free →</button>
            <button
              onClick={() => router.push('/')}
              style={{
                padding:'14px 28px', borderRadius:12,
                border:'1.5px solid rgba(255,255,255,0.15)', background:'transparent',
                color:'#9CA3AF', fontWeight:600, fontSize:15, cursor:'pointer',
                transition:'border-color .15s,color .15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor='rgba(255,255,255,0.35)'; (e.currentTarget as HTMLElement).style.color='#fff'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor='rgba(255,255,255,0.15)'; (e.currentTarget as HTMLElement).style.color='#9CA3AF'; }}
            >See features</button>
          </div>
        </div>
      </section>

      <footer style={{
        borderTop:'1px solid rgba(255,255,255,0.06)',
        padding: isMobile ? '20px 16px' : '24px 48px',
        display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12,
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <img src="/ManchQ-Logo.png" alt="ManchQ" style={{ height:20, width:20 }} />
          <span style={{ fontWeight:800, fontSize:14, color:'#fff' }}>ManchQ</span>
        </div>
        <div style={{ display:'flex', gap:20 }}>
          <a href="/privacy" style={{ fontSize:12, color:'#4B5563', textDecoration:'none' }}>Privacy</a>
          <a href="/terms"   style={{ fontSize:12, color:'#4B5563', textDecoration:'none' }}>Terms</a>
          <a href="mailto:support@manchq.com" style={{ fontSize:12, color:'#4B5563', textDecoration:'none' }}>Contact</a>
        </div>
      </footer>
    </div>
  );
}
