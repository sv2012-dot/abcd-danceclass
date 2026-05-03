import React, { useState } from 'react';

const PURPLE  = '#7C3AED';
const MAGENTA = '#DC4EFF';
const GRAD    = `linear-gradient(135deg, ${PURPLE} 0%, ${MAGENTA} 100%)`;

// ── Abstract step illustrations ───────────────────────────────────────────────

const IllustrationWelcome = () => (
  <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Pulsing concentric rings */}
    <circle cx="60" cy="60" r="54" stroke={PURPLE} strokeWidth="1.5" strokeDasharray="6 4" opacity="0.3"/>
    <circle cx="60" cy="60" r="40" stroke={MAGENTA} strokeWidth="1.5" strokeDasharray="4 5" opacity="0.45"/>
    <circle cx="60" cy="60" r="26" stroke={PURPLE}  strokeWidth="2"   opacity="0.6"/>
    {/* Centre star / sparkle */}
    <circle cx="60" cy="60" r="12" fill="url(#wg)"/>
    <path d="M60 48 L62 56 L70 58 L62 60 L60 68 L58 60 L50 58 L58 56Z" fill="#fff" opacity="0.9"/>
    {/* Orbiting dots */}
    <circle cx="60" cy="6"  r="4" fill={MAGENTA} opacity="0.7"/>
    <circle cx="114" cy="60" r="4" fill={PURPLE}  opacity="0.7"/>
    <circle cx="60" cy="114" r="4" fill={MAGENTA} opacity="0.7"/>
    <circle cx="6"  cy="60" r="4" fill={PURPLE}  opacity="0.7"/>
    <defs>
      <linearGradient id="wg" x1="48" y1="48" x2="72" y2="72">
        <stop offset="0%" stopColor={PURPLE}/>
        <stop offset="100%" stopColor={MAGENTA}/>
      </linearGradient>
    </defs>
  </svg>
);

const IllustrationBatches = () => (
  <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* 3 stacked cards */}
    <rect x="20" y="70" width="80" height="38" rx="8" fill={PURPLE} opacity="0.15" stroke={PURPLE} strokeWidth="1.5"/>
    <rect x="14" y="54" width="80" height="38" rx="8" fill={MAGENTA} opacity="0.15" stroke={MAGENTA} strokeWidth="1.5"/>
    <rect x="20" y="38" width="80" height="38" rx="8" fill="url(#bg)" opacity="0.9"/>
    {/* Card content lines */}
    <rect x="30" y="48" width="36" height="5" rx="2.5" fill="#fff" opacity="0.9"/>
    <rect x="30" y="58" width="24" height="3" rx="1.5" fill="#fff" opacity="0.5"/>
    {/* Avatar dots (students) */}
    {[72,82,92].map((x,i) => (
      <circle key={i} cx={x} cy="53" r="6" fill={i===0?'#fff':'rgba(255,255,255,0.55)'} opacity="0.9"/>
    ))}
    {/* Plus badge */}
    <circle cx="94" cy="38" r="10" fill={MAGENTA}/>
    <path d="M94 32 L94 44 M88 38 L100 38" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
    <defs>
      <linearGradient id="bg" x1="20" y1="38" x2="100" y2="76">
        <stop offset="0%" stopColor={PURPLE}/>
        <stop offset="100%" stopColor={MAGENTA}/>
      </linearGradient>
    </defs>
  </svg>
);

const IllustrationRecitals = () => (
  <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Calendar base */}
    <rect x="16" y="28" width="56" height="56" rx="10" fill="url(#rg)" opacity="0.85"/>
    <rect x="16" y="28" width="56" height="18" rx="10" fill={PURPLE} opacity="0.95"/>
    {/* Calendar dots */}
    {[[28,56],[44,56],[60,56],[28,70],[44,70],[60,70]].map(([x,y],i) => (
      <circle key={i} cx={x} cy={y} r="4" fill={i===1?'#fff':'rgba(255,255,255,0.4)'}/>
    ))}
    {/* Ring binders */}
    <rect x="30" y="22" width="6" height="14" rx="3" fill={MAGENTA}/>
    <rect x="52" y="22" width="6" height="14" rx="3" fill={MAGENTA}/>
    {/* Checklist card (todo) */}
    <rect x="58" y="54" width="48" height="52" rx="10" fill="var(--card,#1a1030)" stroke={MAGENTA} strokeWidth="1.5"/>
    {[66,74,82,90].map((y,i) => (
      <g key={i}>
        <circle cx="68" cy={y} r="3.5" fill={i<2 ? MAGENTA : 'rgba(220,78,255,0.25)'} opacity={i<2?1:0.8}/>
        {i<2 && <path d={`M66.5 ${y} L67.5 ${y+1} L70 ${y-1.5}`} stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>}
        <rect x="74" cy={y} y={y-2} width={i===0?22:i===1?16:20} height="4" rx="2" fill="rgba(220,78,255,0.35)"/>
      </g>
    ))}
    <defs>
      <linearGradient id="rg" x1="16" y1="28" x2="72" y2="84">
        <stop offset="0%" stopColor={PURPLE} stopOpacity="0.4"/>
        <stop offset="100%" stopColor={MAGENTA} stopOpacity="0.3"/>
      </linearGradient>
    </defs>
  </svg>
);

const IllustrationReady = () => (
  <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Blank canvas / fresh start */}
    <rect x="18" y="22" width="84" height="76" rx="12" fill="url(#rdg)" opacity="0.12" stroke={PURPLE} strokeWidth="1.5"/>
    {/* Pencil */}
    <g transform="rotate(-35 60 60)">
      <rect x="54" y="20" width="12" height="52" rx="4" fill="url(#pg)"/>
      <polygon points="54,72 66,72 60,84" fill={MAGENTA} opacity="0.9"/>
      <rect x="54" y="20" width="12" height="10" rx="4" fill="#fff" opacity="0.5"/>
    </g>
    {/* Sparkle dots */}
    <circle cx="26" cy="30" r="4" fill={MAGENTA} opacity="0.6"/>
    <circle cx="94" cy="30" r="3" fill={PURPLE}  opacity="0.5"/>
    <circle cx="26" cy="90" r="3" fill={PURPLE}  opacity="0.5"/>
    <circle cx="94" cy="90" r="4" fill={MAGENTA} opacity="0.6"/>
    {/* Big checkmark */}
    <circle cx="60" cy="60" r="18" fill="url(#rdg)" opacity="0.85"/>
    <path d="M51 60 L57 67 L69 53" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
    <defs>
      <linearGradient id="rdg" x1="18" y1="22" x2="102" y2="98">
        <stop offset="0%" stopColor={PURPLE}/>
        <stop offset="100%" stopColor={MAGENTA}/>
      </linearGradient>
      <linearGradient id="pg" x1="54" y1="20" x2="66" y2="72">
        <stop offset="0%" stopColor={PURPLE}/>
        <stop offset="100%" stopColor={MAGENTA}/>
      </linearGradient>
    </defs>
  </svg>
);

// ── Step definitions ──────────────────────────────────────────────────────────
const STEPS = [
  {
    illustration: <IllustrationWelcome />,
    title: 'Welcome to ManchQ 👋',
    body: "You're all set up. Let's take a quick 2-minute tour of the key things you can do here — then you're ready to go.",
    note: null,
  },
  {
    illustration: <IllustrationBatches />,
    title: 'Batches & Students',
    body: 'Batches are your classes. Each batch has a schedule, an enrollment list, and its own cover photo. Students live inside batches — add guardian contacts to unlock the parent portal.',
    note: null,
  },
  {
    illustration: <IllustrationRecitals />,
    title: 'Recitals & To-Dos',
    body: 'Recitals help you plan performances — track tasks, manage participants, and upload a poster. Use To-Dos on your home dashboard to stay on top of daily studio tasks.',
    note: null,
  },
  {
    illustration: <IllustrationReady />,
    title: "You're ready!",
    body: "Explore the app freely. When you're ready, replace the sample data with your real information — it takes just a few minutes.",
    note: "We've added some sample data to get you started — 2 batches, 4 students, 4 upcoming recitals and 5 to-dos. Feel free to explore or delete any of it. None of it affects billing or real records.",
  },
];

// ── Main component ────────────────────────────────────────────────────────────
export default function OnboardingWizard({ schoolId, onDismiss }) {
  const [step, setStep] = useState(0);
  const isLast = step === STEPS.length - 1;

  const dismiss = () => {
    if (schoolId) localStorage.setItem(`manchq_onboarded_${schoolId}`, '1');
    onDismiss();
  };

  const next = () => {
    if (isLast) { dismiss(); return; }
    setStep(s => s + 1);
  };

  const { illustration, title, body, note } = STEPS[step];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9998,
      background: 'rgba(0,0,0,0.72)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
      backdropFilter: 'blur(6px)',
    }}>
      <div style={{
        background: 'var(--card)',
        borderRadius: 22,
        padding: '32px 32px 28px',
        maxWidth: 480, width: '100%',
        boxShadow: '0 24px 72px rgba(0,0,0,0.55)',
        border: '1px solid rgba(255,255,255,0.09)',
        position: 'relative',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        textAlign: 'center',
      }}>

        {/* Skip button */}
        <button
          onClick={dismiss}
          style={{
            position: 'absolute', top: 16, right: 16,
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 12, color: 'var(--muted)', fontWeight: 600,
            letterSpacing: '0.04em', padding: '4px 8px', borderRadius: 6,
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--muted)'}
        >
          Skip
        </button>

        {/* Progress dots */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 28 }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              width: i === step ? 22 : 7,
              height: 7, borderRadius: 99,
              background: i === step ? GRAD : (i < step ? PURPLE : 'rgba(255,255,255,0.15)'),
              transition: 'width .3s ease, background .3s',
            }} />
          ))}
        </div>

        {/* Illustration */}
        <div style={{ marginBottom: 22 }}>
          {illustration}
        </div>

        {/* Title */}
        <h2 style={{
          fontSize: 21, fontWeight: 800, margin: '0 0 12px',
          color: 'var(--text)', lineHeight: 1.25, letterSpacing: '-0.3px',
        }}>
          {title}
        </h2>

        {/* Body */}
        <p style={{
          fontSize: 14, color: 'var(--muted)', lineHeight: 1.78,
          margin: '0 0 20px', maxWidth: 380,
        }}>
          {body}
        </p>

        {/* Dummy data note (last step only) */}
        {note && (
          <div style={{
            width: '100%', background: 'rgba(220,78,255,0.08)',
            border: '1.5px solid rgba(220,78,255,0.22)',
            borderRadius: 12, padding: '12px 16px', marginBottom: 20, textAlign: 'left',
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: MAGENTA, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 6 }}>
              Sample data included
            </div>
            <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.65, margin: 0 }}>
              {note}
            </p>
          </div>
        )}

        {/* Navigation buttons */}
        <div style={{ display: 'flex', gap: 10, width: '100%' }}>
          {step > 0 && (
            <button
              onClick={() => setStep(s => s - 1)}
              style={{
                flex: '0 0 auto', padding: '12px 20px',
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 11, color: 'var(--muted)',
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}
            >
              ← Back
            </button>
          )}
          <button
            onClick={next}
            style={{
              flex: 1, padding: '13px',
              background: GRAD, border: 'none',
              borderRadius: 11, color: '#fff',
              fontSize: 15, fontWeight: 700, cursor: 'pointer',
              letterSpacing: '0.01em',
              boxShadow: '0 4px 20px rgba(124,58,237,0.45)',
              transition: 'transform .15s, box-shadow .15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 28px rgba(124,58,237,0.58)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(124,58,237,0.45)'; }}
          >
            {isLast ? "Let's go →" : 'Next →'}
          </button>
        </div>

      </div>
    </div>
  );
}
