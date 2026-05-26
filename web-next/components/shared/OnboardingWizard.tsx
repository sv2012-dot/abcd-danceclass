'use client';

import React, { useState } from 'react';

const PURPLE = '#7C3AED';
const MAGENTA = '#D946EF';
const GRAD = `linear-gradient(135deg, ${PURPLE} 0%, ${MAGENTA} 100%)`;

// ── Lineart icons (match the left-nav stroke style — 24×24 viewBox,
//    fill:none, stroke gradient, rounded line caps). Each wrapped in a
//    circular halo (rendered via CSS pseudo on .illust) so the icon has
//    visual weight at hero scale.

const Icon = ({ id, children }: { id: string; children: React.ReactNode }) => (
  <svg
    width="90" height="90" viewBox="0 0 24 24"
    fill="none"
    stroke={`url(#${id})`}
    strokeWidth="0.85"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="24" y2="24">
        <stop offset="0%" stopColor={PURPLE} />
        <stop offset="100%" stopColor={MAGENTA} />
      </linearGradient>
    </defs>
    {children}
  </svg>
);

const IconSparkles = () => (
  <Icon id="ico-welcome">
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    <path d="M5 3v4" /><path d="M19 17v4" /><path d="M3 5h4" /><path d="M17 19h4" />
  </Icon>
);

const IconUsers = () => (
  <Icon id="ico-classes">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </Icon>
);

const IconTicket = () => (
  <Icon id="ico-perf">
    <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z" />
    <path d="M13 5v2" /><path d="M13 11v2" /><path d="M13 17v2" />
  </Icon>
);

const IconSmartMsg = () => (
  <Icon id="ico-smart">
    <path d="M21 14a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z" />
    <path d="M13 8.5l-0.6 1.7a0.7 0.7 0 0 1-0.45 0.45L10.25 11.25l1.7 0.6a0.7 0.7 0 0 1 0.45 0.45L13 14l0.6-1.7a0.7 0.7 0 0 1 0.45-0.45L15.75 11.25l-1.7-0.6a0.7 0.7 0 0 1-0.45-0.45z" />
    <path d="M16.5 6.5v1.5" /><path d="M17.25 7.25h-1.5" />
  </Icon>
);

const IconLayers = () => (
  <Icon id="ico-sample">
    <path d="m12 2 9 4.9-9 4.9-9-4.9z" />
    <path d="m3 12 9 5 9-5" />
    <path d="m3 17 9 5 9-5" />
  </Icon>
);

const IconRocket = () => (
  <Icon id="ico-rocket">
    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
    <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
    <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
    <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
  </Icon>
);

// ── Steps: eyebrow / title / accentWord (rendered gradient-painted) / body.
//    accentWord is the trailing word of the title that gets the brand
//    gradient. The renderer splits the title at the accent word so the
//    rest of the heading stays in --text.
type StepDef = {
  illustration: React.ReactNode;
  eyebrow: string;
  title: string;
  accentWord: string;
  body: string;
};

const STEPS: StepDef[] = [
  {
    illustration: <IconSparkles />,
    eyebrow: 'Welcome',
    title: 'Step inside',
    accentWord: 'inside',
    body: "Let's take a quick tour of the key things you can do here. Two minutes — then you're ready to go.",
  },
  {
    illustration: <IconUsers />,
    eyebrow: 'Classes',
    title: 'Students & Batches',
    accentWord: 'Batches',
    body: 'Group your students into batches with schedules and cover photos. Add contact details to send announcements and reminders.',
  },
  {
    illustration: <IconTicket />,
    eyebrow: 'Performances',
    title: 'Set the stage',
    accentWord: 'stage',
    body: 'Plan performances with tasks and participants. To-Dos on your home dashboard keep you on top of daily studio work.',
  },
  {
    illustration: <IconSmartMsg />,
    eyebrow: 'AI-powered announcements',
    title: 'Smart Messages',
    accentWord: 'Messages',
    body: 'Need to send a reminder, share a recital update, or thank your families? AI drafts the message for you in one click — just review and send. Tweak the tone or details anytime before it goes out.',
  },
  {
    illustration: <IconLayers />,
    eyebrow: 'Sample data',
    title: 'Play around',
    accentWord: 'around',
    body: "A practice batch, dummy students, and a few recitals are pre-loaded. Explore freely — delete anything when you're ready to go live.",
  },
  {
    illustration: <IconRocket />,
    eyebrow: 'Most important',
    title: 'Have Fun',
    accentWord: 'Fun',
    body: "Dive in and discover everything ManchQ can do. You bring the passion and the choreography — we'll handle the chaos so you can stay focused on the dancing.",
  },
];

const HEADING_FONT = "'Playfair Display', Georgia, 'Times New Roman', serif";

// Split the title into a prefix (rendered in --text) and the accent word
// (rendered with the brand gradient). Falls back to the full title in plain
// text if the accent word isn't found.
function renderTitle(title: string, accentWord: string) {
  const idx = title.lastIndexOf(accentWord);
  if (idx < 0) {
    return <span>{title}</span>;
  }
  const prefix = title.slice(0, idx);
  const suffix = title.slice(idx + accentWord.length);
  return (
    <>
      {prefix}
      <span
        style={{
          background: GRAD,
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          color: 'transparent',
        }}
      >
        {accentWord}
      </span>
      {suffix}
    </>
  );
}

export default function OnboardingWizard({ schoolId, onDismiss }: any) {
  const [step, setStep] = useState(0);
  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;

  const dismiss = () => {
    if (schoolId) localStorage.setItem(`manchq_onboarded_${schoolId}`, '1');
    onDismiss();
  };

  const next = () => {
    if (isLast) { dismiss(); return; }
    setStep((s) => s + 1);
  };

  const { illustration, eyebrow, title, accentWord, body } = STEPS[step];

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9998,
        background: 'rgba(0,0,0,0.72)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
        backdropFilter: 'blur(6px)',
      }}
    >
      <div
        style={{
          background: 'var(--card)',
          borderRadius: 22,
          padding: '32px 28px 24px',
          maxWidth: 460, width: '100%',
          boxShadow: '0 24px 72px rgba(0,0,0,0.55)',
          border: '1px solid rgba(255,255,255,0.09)',
          position: 'relative',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          textAlign: 'center',
        }}
      >
        <button
          onClick={dismiss}
          style={{
            position: 'absolute', top: 14, right: 14,
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 11, color: 'var(--muted)', fontWeight: 700,
            letterSpacing: '0.05em', padding: '6px 10px', borderRadius: 6,
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--text)')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--muted)')}
        >
          Skip
        </button>

        {/* Step dots */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
          {STEPS.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === step ? 22 : 7,
                height: 7, borderRadius: 99,
                background: i === step ? GRAD : (i < step ? PURPLE : 'rgba(255,255,255,0.18)'),
                transition: 'width .3s ease, background .3s',
              }}
            />
          ))}
        </div>

        {/* Illustration with circular halo */}
        <div
          style={{
            position: 'relative',
            width: 160, height: 160,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '6px 0 18px',
          }}
        >
          <div
            aria-hidden
            style={{
              position: 'absolute', inset: 0, margin: 'auto',
              width: 140, height: 140, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(124,58,237,0.18), rgba(217,70,239,0.05) 72%)',
              border: '1.5px solid rgba(217,70,239,0.35)',
              boxShadow: '0 0 36px rgba(124,58,237,0.22)',
              top: 0, left: 0, right: 0, bottom: 0,
            }}
          />
          <div style={{ position: 'relative', zIndex: 1, display: 'flex' }}>
            {illustration}
          </div>
        </div>

        {/* Eyebrow */}
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: MAGENTA,
            marginBottom: 8,
            minHeight: 14,
          }}
        >
          {eyebrow}
        </div>

        {/* Title — elegant serif with gradient-painted accent word */}
        <h2
          style={{
            fontFamily: HEADING_FONT,
            fontSize: 28, fontWeight: 500,
            margin: '0 0 14px',
            color: 'var(--text)',
            lineHeight: 1.18,
            letterSpacing: '-0.4px',
            textAlign: 'center',
            width: '100%',
          }}
        >
          {renderTitle(title, accentWord)}
        </h2>

        {/* Body */}
        <p
          style={{
            fontSize: 13.5,
            color: 'var(--muted)',
            lineHeight: 1.7,
            margin: '0 0 22px',
            maxWidth: 320,
          }}
        >
          {body}
        </p>

        {/* Actions — step 1 has full-width CTA, no back */}
        <div style={{ display: 'flex', gap: 10, width: '100%' }}>
          {!isFirst && (
            <button
              onClick={() => setStep((s) => s - 1)}
              style={{
                flex: '0 0 auto', padding: '11px 18px',
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 11, color: 'var(--muted)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              ← Back
            </button>
          )}
          <button
            onClick={next}
            style={{
              flex: 1, padding: '12px',
              background: GRAD, border: 'none',
              borderRadius: 11, color: '#fff',
              fontSize: 14, fontWeight: 700, cursor: 'pointer',
              letterSpacing: '0.01em',
              boxShadow: '0 4px 20px rgba(124,58,237,0.45)',
              transition: 'transform .15s, box-shadow .15s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
              (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 28px rgba(124,58,237,0.58)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.transform = 'none';
              (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(124,58,237,0.45)';
            }}
          >
            {isFirst ? 'Get started ⏵' : isLast ? "Let's go" : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  );
}
