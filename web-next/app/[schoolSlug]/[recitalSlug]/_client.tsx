'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { recitals } from '@/lib/api';

type ClientProps = {
  schoolSlug: string;
  recitalSlug: string;
  initialData?: any;
  autoScrollToRsvp?: boolean;
};

const PURPLE = '#7C3AED';
const MAGENTA = '#D946EF';
const GRAD = `linear-gradient(135deg, ${PURPLE} 0%, ${MAGENTA} 100%)`;
const BG = '#0D0A1A';
const OUTER = '#06040F';

// ── Helpers ─────────────────────────────────────────────────────────────────
function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return null;
  const d = new Date(String(dateStr).slice(0, 10) + 'T12:00:00');
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function formatDateShort(dateStr: string | null | undefined) {
  if (!dateStr) return null;
  const d = new Date(String(dateStr).slice(0, 10) + 'T12:00:00');
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(t: string | null | undefined) {
  if (!t) return null;
  const [h, m] = t.split(':');
  const hr = parseInt(h, 10);
  return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`;
}

// ── Icons ───────────────────────────────────────────────────────────────────
const CalIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);
const ClockIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);
const PinIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
  </svg>
);
const UsersIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);
const ShareIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
  </svg>
);
const CheckIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const HeartIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
  </svg>
);
const SadIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><path d="M16 16s-1.5-2-4-2-4 2-4 2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>
  </svg>
);
const TheatreIcon = ({ size = 48 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 10s3-3 3-8h14c0 5 3 8 3 8"/><path d="M6 15s2-2 6-2 6 2 6 2"/><path d="M22 10c0 7-4.5 12-10 12S2 17 2 10"/>
    <circle cx="8.5" cy="11.5" r="1.5"/><circle cx="15.5" cy="11.5" r="1.5"/>
  </svg>
);

// ── RSVP Section ────────────────────────────────────────────────────────────
const rsvpKey = (school: string, recital: string) => `manchq_rsvp_${school}_${recital}`;

type RsvpResponse = 'Confirmed' | 'Declined';
type Stored = { response: RsvpResponse; confirmedCount: number } | null;

function readStored(school: string, recital: string): Stored {
  if (typeof window === 'undefined') return null;
  try { return JSON.parse(localStorage.getItem(rsvpKey(school, recital)) || 'null'); } catch { return null; }
}

type RSVPSectionProps = {
  schoolSlug: string;
  recitalSlug: string;
  confirmedCount: number;
  setConfirmedCount: (n: number) => void;
  onRsvpChange?: (r: RsvpResponse | null) => void;
};

function RSVPSection({ schoolSlug, recitalSlug, confirmedCount, setConfirmedCount, onRsvpChange }: RSVPSectionProps) {
  // Read localStorage AFTER mount to avoid SSR/hydration mismatch
  const [stored, setStored] = useState<Stored>(null);
  const [state, setState] = useState<'idle' | 'yes-form' | 'no-form' | 'submitting' | 'submitted'>('idle');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [plusOnes, setPlusOnes] = useState(0);
  const [err, setErr] = useState('');
  const [submitted, setSubmitted] = useState<RsvpResponse | null>(null);

  // Hydrate localStorage state on the client only
  useEffect(() => {
    const s = readStored(schoolSlug, recitalSlug);
    if (s?.response) {
      setStored(s);
      setSubmitted(s.response);
      setState('submitted');
      onRsvpChange?.(s.response);
    }
  }, [schoolSlug, recitalSlug]); // eslint-disable-line react-hooks/exhaustive-deps

  const isForm = state === 'yes-form' || state === 'no-form';
  const isGoing = state === 'yes-form';
  const isBusy = state === 'submitting';

  const inp: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 10,
    border: '1.5px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)',
    color: '#fff', fontSize: 15, fontFamily: 'inherit', outline: 'none',
  };

  const handleSubmit = useCallback(async () => {
    if (!name.trim()) { setErr('Please enter your name'); return; }
    const attempted = state;
    setState('submitting');
    setErr('');
    try {
      const response: RsvpResponse = attempted === 'yes-form' ? 'Confirmed' : 'Declined';
      const data = await recitals.submitPublicRsvp(schoolSlug, recitalSlug, {
        name: name.trim(),
        email: email.trim() || undefined,
        response,
        plus_ones: plusOnes,
      });
      const cnt = typeof data?.confirmed === 'number' ? data.confirmed : confirmedCount;
      setConfirmedCount(cnt);
      setSubmitted(response);
      setState('submitted');
      onRsvpChange?.(response);
      try {
        localStorage.setItem(rsvpKey(schoolSlug, recitalSlug), JSON.stringify({ response, confirmedCount: cnt }));
      } catch { /* ignore */ }
    } catch (e: any) {
      setErr(e?.message || 'Something went wrong. Try again.');
      setState(attempted);
    }
  }, [name, email, plusOnes, state, schoolSlug, recitalSlug, confirmedCount, setConfirmedCount, onRsvpChange]);

  const reset = () => {
    try { localStorage.removeItem(rsvpKey(schoolSlug, recitalSlug)); } catch { /* ignore */ }
    setStored(null);
    setState('idle');
    setSubmitted(null);
    setName('');
    setEmail('');
    setPlusOnes(0);
    onRsvpChange?.(null);
  };

  if (state === 'submitted') {
    const isYes = submitted === 'Confirmed';
    const displayCount = confirmedCount || stored?.confirmedCount || 0;
    return (
      <div style={{
        background: isYes ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.04)',
        border: `1.5px solid ${isYes ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.08)'}`,
        borderRadius: 16, padding: '24px 18px', textAlign: 'center',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: isYes ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 14px', color: isYes ? '#10B981' : '#9CA3AF',
        }}>
          {isYes ? <CheckIcon size={26} /> : <SadIcon size={24} />}
        </div>
        <h3 style={{ fontSize: 18, fontWeight: 900, margin: '0 0 6px' }}>
          {isYes ? 'See you there!' : 'Thanks for letting us know'}
        </h3>
        <p style={{ fontSize: 13, color: '#9CA3AF', margin: '0 0 18px', lineHeight: 1.65 }}>
          {isYes
            ? `You're in!${displayCount > 0 ? ` ${displayCount} ${displayCount === 1 ? 'person is' : 'people are'} going.` : ''}`
            : "Sorry you can't make it. Hope to see you next time!"}
        </p>
        <button
          onClick={reset}
          style={{ fontSize: 12, color: MAGENTA, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, textDecoration: 'underline' }}
        >
          Change my RSVP
        </button>
      </div>
    );
  }

  return (
    <div style={{ background: 'rgba(124,58,237,0.10)', border: '1.5px solid rgba(124,58,237,0.35)', borderRadius: 16, padding: '20px 18px' }}>
      <h3 style={{ fontSize: 18, fontWeight: 900, margin: '0 0 6px' }}>Will you be there?</h3>
      {confirmedCount > 0 ? (
        <p style={{ fontSize: 12, color: '#10B981', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 5 }}>
          <UsersIcon /><strong>{confirmedCount}</strong>&nbsp;{confirmedCount === 1 ? 'person is' : 'people are'} going
        </p>
      ) : (
        <div style={{ marginBottom: 14 }} />
      )}

      {isForm && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <button onClick={() => setState('yes-form')} style={{ flex: 1, padding: '9px 6px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: state === 'yes-form' ? GRAD : 'rgba(255,255,255,0.07)', color: state === 'yes-form' ? '#fff' : '#6B7280' }}>
            <CheckIcon size={13} /> I'm in
          </button>
          <button onClick={() => setState('no-form')} style={{ flex: 1, padding: '9px 6px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: state === 'no-form' ? GRAD : 'rgba(255,255,255,0.07)', color: state === 'no-form' ? '#fff' : '#6B7280' }}>
            <SadIcon size={13} /> Can't make it
          </button>
        </div>
      )}

      {state === 'idle' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button onClick={() => setState('yes-form')} style={{ width: '100%', padding: '14px', borderRadius: 12, border: 'none', cursor: 'pointer', background: GRAD, color: '#fff', fontWeight: 800, fontSize: 15, boxShadow: '0 4px 20px rgba(124,58,237,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <HeartIcon size={16} /> Yes, I'll be there!
          </button>
          <button onClick={() => setState('no-form')} style={{ width: '100%', padding: '13px', borderRadius: 12, cursor: 'pointer', fontWeight: 700, fontSize: 14, border: '1.5px solid rgba(255,255,255,0.14)', background: 'transparent', color: '#9CA3AF', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <SadIcon size={15} /> Can't make it
          </button>
        </div>
      )}

      {isForm && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', letterSpacing: '.08em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
              Your name <span style={{ color: MAGENTA }}>*</span>
            </label>
            <input
              autoFocus
              value={name}
              onChange={e => { setName(e.target.value); setErr(''); }}
              placeholder="Enter your name"
              style={inp}
              onFocus={e => (e.currentTarget.style.borderColor = PURPLE)}
              onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)')}
            />
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', letterSpacing: '.08em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
              Email <span style={{ fontWeight: 400, color: '#4B5563', fontSize: 9 }}>optional</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              style={inp}
              onFocus={e => (e.currentTarget.style.borderColor = PURPLE)}
              onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)')}
            />
          </div>
          {isGoing && (
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', letterSpacing: '.08em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Bringing anyone?</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[{ v: 0, l: 'Just me' }, { v: 1, l: '+1' }, { v: 2, l: '+2' }, { v: 3, l: '3+' }].map(({ v, l }) => (
                  <button
                    key={v}
                    onClick={() => setPlusOnes(v)}
                    style={{
                      flex: 1, padding: '10px 4px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                      border: plusOnes === v ? `1.5px solid ${PURPLE}` : '1.5px solid rgba(255,255,255,0.1)',
                      background: plusOnes === v ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.04)',
                      color: plusOnes === v ? '#C4B5FD' : '#6B7280',
                    }}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          )}
          {err && <p style={{ fontSize: 12, color: '#F87171', margin: 0, fontWeight: 600 }}>{err}</p>}
          <button
            onClick={handleSubmit}
            disabled={isBusy}
            style={{
              width: '100%', padding: '14px', borderRadius: 12, border: 'none',
              cursor: isBusy ? 'not-allowed' : 'pointer',
              background: isBusy ? 'rgba(124,58,237,0.4)' : GRAD,
              color: '#fff', fontWeight: 800, fontSize: 14, opacity: isBusy ? 0.7 : 1,
              boxShadow: isBusy ? 'none' : '0 4px 18px rgba(124,58,237,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {isBusy ? 'Saving…' : isGoing ? <><CheckIcon size={15} /> Confirm RSVP</> : <><CheckIcon size={15} /> Send response</>}
          </button>
          <button
            onClick={() => { setState('idle'); setErr(''); }}
            style={{ fontSize: 11, color: '#4B5563', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
            </svg>
            Back
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main client component ───────────────────────────────────────────────────
export function RecitalClient({ schoolSlug, recitalSlug, initialData, autoScrollToRsvp }: ClientProps) {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmedCount, setConfirmedCount] = useState<number>(initialData?.recital?.rsvp_stats?.confirmed || 0);
  const [rsvpResponse, setRsvpResponse] = useState<RsvpResponse | null>(null);
  const rsvpRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!initialData) {
      (async () => {
        try {
          const result = await recitals.getPublic(schoolSlug, recitalSlug);
          if (result?.error || !result?.recital) {
            setError(result?.error || 'Could not load this event page');
          } else {
            setData(result);
            setConfirmedCount(result?.recital?.rsvp_stats?.confirmed || 0);
          }
        } catch {
          setError('Could not load this event page');
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [schoolSlug, recitalSlug, initialData]);

  // Auto-scroll to the RSVP section when arriving via /<school>/<recital>/rsvp
  useEffect(() => {
    if (!autoScrollToRsvp || loading) return;
    const t = setTimeout(() => {
      rsvpRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 200);
    return () => clearTimeout(t);
  }, [autoScrollToRsvp, loading]);

  const shareLink = () => {
    if (typeof window === 'undefined') return;
    const url = window.location.href;
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({ title: data?.recital?.title || 'Event', url }).catch(() => {});
    } else if (navigator?.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: OUTER, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui,sans-serif' }}>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: `3px solid rgba(124,58,237,0.2)`, borderTopColor: PURPLE, borderRadius: '50%', margin: '0 auto 14px', animation: 'spin .8s linear infinite' }} />
          <p style={{ color: '#6B7280', fontSize: 13, margin: 0 }}>Loading event…</p>
        </div>
      </div>
    );
  }

  // Cancelled state: school exists but recital row is gone (the
  // school admin deleted it). Backend returns
  // { school, recital: null, cancelled: true } with contact_name /
  // email / phone pulled from the schools row. Renders the
  // "editorial + contact" mock layout — serif headline, gradient
  // rule, contact rows that hide individually when null, and an
  // "Explore ManchQ" link in lieu of a school CTA.
  if (data && (data as any).cancelled) {
    const sch = (data as any).school || {};
    return <CancelledView school={sch} />;
  }

  if (error || !data || !(data as any).recital) {
    return (
      <div style={{ minHeight: '100vh', background: OUTER, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'system-ui,sans-serif' }}>
        <div style={{ textAlign: 'center', maxWidth: 360 }}>
          <div style={{ color: 'rgba(255,255,255,0.2)', marginBottom: 14 }}><TheatreIcon size={52} /></div>
          <h2 style={{ color: '#fff', marginBottom: 8, fontSize: 20, fontWeight: 800 }}>Event not found</h2>
          <p style={{ color: '#6B7280', fontSize: 13, lineHeight: 1.65, marginBottom: 24 }}>
            {error || "This event page doesn't exist or may have been removed."}
          </p>
          <a href="/" style={{ color: MAGENTA, fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>← Back to ManchQ</a>
        </div>
      </div>
    );
  }

  const { school, recital } = data;

  // Completed state: recital exists but the event date is in the
  // past. Renders the "wrapped 🎉" mock layout — keeps the poster
  // hero with a "Past event" stamp, replaces the RSVP/details
  // section with a thank-you headline + shared contact block.
  // Detection uses date-only comparison in the user's local TZ to
  // avoid edge cases at midnight in other zones.
  const eventDateStr = (recital?.event_date && String(recital.event_date).slice(0, 10)) || null;
  const isPastEvent = (() => {
    if (!eventDateStr) return false;
    const ed = new Date(eventDateStr + 'T00:00:00');
    if (isNaN(ed.getTime())) return false;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return ed.getTime() < today.getTime();
  })();
  if (isPastEvent) {
    return <CompletedView school={school} recital={recital} />;
  }

  const hasPoster = recital.poster_url && recital.poster_url.length > 20;
  const fmtDateSh = formatDateShort(recital.event_date);
  const fmtTime = formatTime(recital.event_time);

  const META = [
    { icon: <CalIcon />, label: 'Date', value: fmtDateSh || 'TBD' },
    { icon: <ClockIcon />, label: 'Time', value: fmtTime || 'TBD' },
    { icon: <PinIcon />, label: 'Venue', value: recital.venue || 'TBD' },
    { icon: <UsersIcon />, label: 'Going', value: confirmedCount > 0 ? `${confirmedCount} confirmed` : 'Be the first!' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: OUTER, display: 'flex', justifyContent: 'center', fontFamily: 'system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 430, background: BG, color: '#fff', minHeight: '100vh', display: 'flex', flexDirection: 'column', boxShadow: '0 0 60px rgba(124,58,237,0.1), 0 0 0 1px rgba(255,255,255,0.04)' }}>

        {/* Hero section */}
        <div style={{ position: 'relative', background: hasPoster ? '#000' : 'linear-gradient(135deg,#1a1035 0%,#2d1b69 100%)', flexShrink: 0 }}>
          {hasPoster ? (
            <div style={{ width: '100%', paddingTop: '133.33%', position: 'relative' }}>
              <img src={recital.poster_url} alt={recital.title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', display: 'block' }} />
            </div>
          ) : (
            <div style={{ minHeight: 280 }} />
          )}

          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(13,10,26,.95) 0%, rgba(0,0,0,.25) 55%, transparent 100%)' }} />

          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '28px 16px 32px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', zIndex: 10, background: 'linear-gradient(to bottom, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.3) 70%, transparent 100%)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: '.06em', textTransform: 'uppercase' }}>{school.name}</span>
              <span style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,.72)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Presents</span>
            </div>
            <button onClick={shareLink} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 20, background: copied ? 'rgba(16,185,129,0.3)' : 'rgba(0,0,0,.5)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,.22)', color: copied ? '#10B981' : '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              <ShareIcon />{copied ? 'Copied!' : 'Share'}
            </button>
          </div>

          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 18px 20px', zIndex: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.45)', textTransform: 'uppercase', letterSpacing: '.14em', marginBottom: 5 }}>Performance</div>
            <h1 style={{ fontFamily: 'inherit', fontSize: 22, fontWeight: 900, color: '#fff', margin: '0 0 10px', lineHeight: 1.2 }}>{recital.title}</h1>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              {fmtDateSh && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'rgba(255,255,255,.72)', fontWeight: 500 }}><CalIcon />{fmtDateSh}</span>}
              {fmtTime && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'rgba(255,255,255,.72)', fontWeight: 500 }}><ClockIcon />{fmtTime}</span>}
              {recital.venue && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'rgba(255,255,255,.72)', fontWeight: 500 }}><PinIcon />{recital.venue}</span>}
            </div>
          </div>
        </div>

        {/* ── Primary CTA — three states based on rsvpResponse ── */}
        <div style={{ padding: '16px 16px 0' }}>
          {rsvpResponse === 'Confirmed' ? (
            <button
              onClick={() => rsvpRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '13px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#059669,#10B981)', boxShadow: '0 2px 12px rgba(16,185,129,.28)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
            >
              <CheckIcon size={16} />
              You're going — see you there!
            </button>
          ) : rsvpResponse === 'Declined' ? (
            <button
              onClick={() => rsvpRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '13px', borderRadius: 12, border: '1.5px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: '#9CA3AF', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
            >
              💙 Thanks for letting us know
            </button>
          ) : (
            <button
              onClick={() => rsvpRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '13px', borderRadius: 12, border: 'none', background: GRAD, boxShadow: '0 2px 12px rgba(124,58,237,.28)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
            >
              <HeartIcon size={15} />
              RSVP for this event
            </button>
          )}
        </div>

        {/* Meta grid */}
        <div style={{ margin: '16px 16px 0', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 0, background: '#000', borderRadius: 14, overflow: 'hidden' }}>
          {META.map((m) => (
            <div key={m.label} style={{ background: '#000', padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7, color: 'rgba(255,255,255,0.4)' }}>
                {m.icon}
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em' }}>{m.label}</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#F3F4F6' }}>{m.value}</div>
            </div>
          ))}
        </div>

        {/* Content sections */}
        <div style={{ margin: '22px 16px 0' }}>
          <div style={{ marginBottom: 28 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 8px', color: '#fff' }}>Event Overview</h3>
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, lineHeight: 1.75, margin: 0 }}>
              {recital.description || 'No description added yet.'}
            </p>
          </div>

          {Array.isArray(recital.important_info) && recital.important_info.length > 0 && (
            <div style={{ paddingBottom: 32 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 12px', color: '#fff' }}>Important Information</h3>
              <ul style={{ margin: 0, padding: '0 0 0 18px', display: 'flex', flexDirection: 'column', gap: 9 }}>
                {recital.important_info.map((item: string, i: number) => (
                  <li key={i} style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* ── Real RSVP section ── */}
        <div ref={rsvpRef} style={{ margin: '14px 16px 0' }}>
          <RSVPSection
            schoolSlug={schoolSlug}
            recitalSlug={recitalSlug}
            confirmedCount={confirmedCount}
            setConfirmedCount={setConfirmedCount}
            onRsvpChange={setRsvpResponse}
          />
        </div>

        {/* Footer */}
        <footer style={{ marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.06)', padding: '14px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, textAlign: 'center' }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>
            Managed by{' '}
            <a href="https://manchq.com" target="_blank" rel="noopener noreferrer" style={{ color: MAGENTA, textDecoration: 'none' }}>ManchQ</a>
          </span>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', fontWeight: 500 }}>
            © {new Date().getFullYear()} ManchQ. All rights reserved.
          </span>
        </footer>

      </div>
    </div>
  );
}

// ── Shared icons + contact block + footer link for past-state views ───────
const PersonIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
);
const MailIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
  </svg>
);
const PhoneIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

// Contact rows — render only the rows whose field is set on the
// school's About page (contact_name = owner_name, email, phone).
// Returns null if NO contact info is set, so the parent can skip
// the whole block.
function ContactBlock({ school }: { school: any }) {
  const rows: { Icon: () => React.ReactElement; value: string }[] = [];
  if (school?.contact_name) rows.push({ Icon: PersonIcon, value: school.contact_name });
  if (school?.email) rows.push({ Icon: MailIcon, value: school.email });
  if (school?.phone) rows.push({ Icon: PhoneIcon, value: school.phone });
  if (rows.length === 0) return null;
  return (
    <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.08)', width: '100%' }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: '#9b8aab', marginBottom: 10 }}>Contact</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map((r, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#f3f3f7' }}>
            <span style={{ color: PURPLE, width: 14, display: 'flex', flexShrink: 0 }}><r.Icon /></span>
            {r.value}
          </div>
        ))}
      </div>
    </div>
  );
}

function ExploreLink() {
  return (
    <a
      href="/"
      style={{
        marginTop: 18, display: 'inline-flex', alignSelf: 'flex-start',
        fontSize: 12, color: MAGENTA, textDecoration: 'none', fontWeight: 600,
      }}
    >
      Explore ManchQ
    </a>
  );
}

// ── Cancelled view (editorial layout + contact block) ─────────────────────
function CancelledView({ school }: { school: any }) {
  const name = school?.name || 'the studio';
  return (
    <div style={{ minHeight: '100vh', background: OUTER, display: 'flex', justifyContent: 'center', fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 430, background: BG, minHeight: '100vh', padding: '64px 28px 40px', display: 'flex', flexDirection: 'column', color: '#fff' }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: MAGENTA, marginBottom: 18 }}>
          Programme update
        </div>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 30, fontWeight: 400, lineHeight: 1.18, letterSpacing: '-0.5px', marginBottom: 18 }}>
          This event has been cancelled.
        </h1>
        <div style={{ width: 32, height: 2, background: GRAD, marginBottom: 18 }} />
        <p style={{ fontSize: 14, color: '#9b8aab', lineHeight: 1.7, marginBottom: 28 }}>
          The recital page you opened is no longer active. For any questions about this performance, please reach out to{' '}
          <strong style={{ color: '#fff', fontWeight: 600 }}>{name}</strong> directly.
        </p>
        <div style={{ marginTop: 'auto' }}>
          <ContactBlock school={school} />
          <ExploreLink />
        </div>
      </div>
    </div>
  );
}

// ── Completed view (poster hero + "wrapped 🎉" + contact block) ───────────
function CompletedView({ school, recital }: { school: any; recital: any }) {
  const hasPoster = recital?.poster_url && String(recital.poster_url).length > 20;
  const fmtDateLong = formatDate(recital?.event_date);
  const fmtT = formatTime(recital?.event_time);
  const whenLine = [fmtDateLong, fmtT, recital?.venue].filter(Boolean).join(' · ');
  return (
    <div style={{ minHeight: '100vh', background: OUTER, display: 'flex', justifyContent: 'center', fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 430, background: BG, color: '#fff', minHeight: '100vh', display: 'flex', flexDirection: 'column', boxShadow: '0 0 60px rgba(124,58,237,0.1), 0 0 0 1px rgba(255,255,255,0.04)' }}>

        {/* Poster hero — same 3:4 frame as the active page so the
            link still feels like a keepsake. "Past event ✓" stamp
            top-right and the title + when line painted over the
            bottom gradient. */}
        <div style={{ position: 'relative', background: hasPoster ? '#000' : 'linear-gradient(135deg,#1a1035 0%,#2d1b69 100%)', flexShrink: 0 }}>
          {hasPoster ? (
            <div style={{ width: '100%', paddingTop: '133.33%', position: 'relative' }}>
              <img src={recital.poster_url} alt={recital.title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', display: 'block' }} />
            </div>
          ) : (
            <div style={{ minHeight: 280 }} />
          )}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(13,10,26,.95) 0%, rgba(0,0,0,.25) 55%, transparent 100%)' }} />

          <div style={{
            position: 'absolute', top: 16, right: 16,
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', borderRadius: 999,
            background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,.18)',
            fontSize: 10, fontWeight: 800, letterSpacing: '.06em', color: '#fff', textTransform: 'uppercase',
          }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            Past event
          </div>

          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '20px', color: '#fff' }}>
            <div style={{ fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(255,255,255,.7)', marginBottom: 6 }}>
              Performance
            </div>
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 24, fontWeight: 400, lineHeight: 1.15, marginBottom: 6 }}>{recital?.title}</h1>
            {whenLine && (
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.75)' }}>{whenLine}</div>
            )}
          </div>
        </div>

        {/* Body — serif "wrapped 🎉" headline, thanks, contact, explore. */}
        <div style={{ padding: '28px 24px 28px', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 400, lineHeight: 1.18, letterSpacing: '-0.4px', color: '#fff', marginBottom: 14 }}>
            This recital has <span style={{ background: GRAD, WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>wrapped</span>
            <span style={{ fontSize: 24, marginLeft: 6, verticalAlign: 'middle' }} role="img" aria-label="celebrate">🎉</span>
          </h2>
          <div style={{ width: 32, height: 2, background: GRAD, marginBottom: 20 }} />
          <p style={{ fontSize: 14, color: '#9b8aab', lineHeight: 1.75, marginBottom: 6 }}>
            Thank you to every family who came out for our {recital?.title}. The energy in the room was unforgettable.
          </p>
          <ContactBlock school={school} />
          <ExploreLink />
        </div>
      </div>
    </div>
  );
}
