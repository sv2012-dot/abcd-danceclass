'use client';

// /register — sign up a new studio.
// Layout: one rounded "island" card centered on a dynamic video background.
// The island splits internally into two columns:
//   - Left  (desktop) / top   (mobile): carousel
//   - Right (desktop) / below (mobile): form + Google CTA + email fallback
//
// Auth options:
//   - "Sign up with Google →" (primary CTA — disabled until form + terms are complete)
//   - "or use email instead" (secondary button — also disabled until form + terms are complete)
//
// Confirmation flow: if the resolved email already has a ManchQ account,
// backend returns { existing_user: true, schools: [...] } and the page shows
// an explicit modal — "Create new anyway" or "Sign in to existing studios".

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/context/AuthContext';
import { redirectToDashboard } from '@/lib/redirectToDashboard';
import GoogleSignIn from '@/components/GoogleSignIn';
import RegisterCarousel from '@/components/RegisterCarousel';

const PURPLE = '#7C3AED';
const MAGENTA = '#DC4EFF';
const GRAD = `linear-gradient(135deg, ${PURPLE} 0%, ${MAGENTA} 100%)`;

// Placeholder-as-label inputs: the field name sits inside the input by default
// and vanishes as soon as the user starts typing. No external <label> element.
const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--surface)',
  border: '1.5px solid var(--border)',
  borderRadius: 10,
  padding: '14px 16px',
  fontSize: 15,
  fontWeight: 500,
  color: 'var(--text)',
  boxSizing: 'border-box',
  outline: 'none',
  transition: 'border-color .15s, box-shadow .15s',
};

function useIsMobile(bp = 900) {
  const [m, setM] = useState(false);
  useEffect(() => {
    const fn = () => setM(window.innerWidth < bp);
    fn();
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, [bp]);
  return m;
}

type ExistingPrompt = {
  email: string;
  schools: Array<{ school_name: string; school_city: string | null }>;
};

function RegisterForm() {
  const { user, loading: authLoading, setSession } = useAuth() as any;
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMobile = useIsMobile();

  const [form, setForm] = useState({
    ownerName: '',
    schoolName: '',
    city: '',
    danceStyle: '',
  });
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Email fallback UI
  const [showEmail, setShowEmail] = useState(false);
  const [email, setEmail] = useState('');

  // Existing-user confirm modal
  const [existing, setExisting] = useState<ExistingPrompt | null>(null);
  const [pendingPayload, setPendingPayload] = useState<any | null>(null);

  // Post-email-signup "check inbox" state
  const [linkSentTo, setLinkSentTo] = useState<string | null>(null);

  // If already logged in, kick to dashboard — must sign out first to register another
  useEffect(() => {
    if (user && !authLoading) router.push('/');
  }, [user, authLoading, router]);

  // Pre-fill from Google redirect (legacy path from /login → /register)
  useEffect(() => {
    const googleDataStr = searchParams.get('googleData');
    if (googleDataStr) {
      try {
        const gd = JSON.parse(decodeURIComponent(googleDataStr));
        setForm(prev => ({ ...prev, ownerName: gd.name || '' }));
        if (gd.email) setEmail(gd.email);
      } catch (_) {}
    }
  }, [searchParams]);

  const apiUrl = (process.env.NEXT_PUBLIC_API_URL?.trim()) || 'http://localhost:5000/api';

  // Required fields for either auth path: owner name, studio name, terms.
  // City + Dance style stay optional. Email is required only for the email path.
  const baseFormComplete =
    form.ownerName.trim().length > 0 &&
    form.schoolName.trim().length > 0 &&
    agreeToTerms;

  const disabledTitle = !agreeToTerms
    ? 'Agree to the Terms and Privacy Policy to continue'
    : 'Fill in your name and studio name to continue';

  async function submitRegister(payload: any) {
    setSubmitting(true);
    try {
      const res = await fetch(`${apiUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      // Existing user — show confirm dialog
      if (res.ok && data.existing_user) {
        setExisting({ email: data.email, schools: data.schools || [] });
        setPendingPayload(payload);
        setSubmitting(false);
        return;
      }

      if (!res.ok) throw new Error(data.error || 'Registration failed.');

      // Google path → JWT or chooser
      if (data.requires_choice && data.chooser_token) {
        try {
          sessionStorage.setItem('sf_pending_chooser', JSON.stringify({
            chooser_token: data.chooser_token,
            memberships: data.memberships || [],
            user: data.user,
          }));
        } catch (_) {}
        toast.success('Studio created! Pick which one to enter.');
        router.replace('/auth/choose-school');
        return;
      }
      if (data.token) {
        setSession(data.token, data.user, data.school || null);
        toast.success('Welcome to ManchQ!');
        redirectToDashboard(router);
        return;
      }
      if (data.magic_link_sent) {
        setLinkSentTo(data.email);
        return;
      }

      toast.error("Something didn't add up. Please try again.");
    } catch (e: any) {
      toast.error(e?.message || 'Registration failed.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleGoogleToken(token: string) {
    if (!baseFormComplete) { toast.error(disabledTitle); return; }
    submitRegister({
      ownerName: form.ownerName.trim(),
      schoolName: form.schoolName.trim(),
      city: form.city.trim() || null,
      danceStyle: form.danceStyle.trim() || null,
      google_access_token: token,
    });
  }

  function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!baseFormComplete) { toast.error(disabledTitle); return; }
    if (!email.trim() || !email.includes('@')) {
      toast.error('Please enter a valid email.');
      return;
    }
    submitRegister({
      ownerName: form.ownerName.trim(),
      ownerEmail: email.trim(),
      schoolName: form.schoolName.trim(),
      city: form.city.trim() || null,
      danceStyle: form.danceStyle.trim() || null,
    });
  }

  function handleConfirmNewStudio() {
    if (!pendingPayload) return;
    submitRegister({ ...pendingPayload, acknowledge_existing: true });
    setExisting(null);
  }

  function handleSignInInstead() {
    setExisting(null);
    router.push('/login');
  }

  // ── Magic-link sent state ────────────────────────────────────────────
  if (linkSentTo) {
    return (
      <BackgroundFrame>
        <div style={{ width: '100%', maxWidth: 440, background: 'var(--card)', borderRadius: 16, padding: 36, textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.45)' }}>
          <div style={{ fontSize: 40, marginBottom: 14 }}>✉️</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', margin: '0 0 8px' }}>Studio created!</h2>
          <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.6, margin: '0 0 22px' }}>
            We sent a sign-in link to <strong style={{ color: 'var(--text)' }}>{linkSentTo}</strong>. Open it to enter your new studio. The link expires in 15 minutes.
          </p>
          <button
            onClick={() => router.push('/login')}
            style={{ background: 'none', border: 'none', color: '#6a7fdb', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}
          >
            ← Back to sign-in
          </button>
        </div>
      </BackgroundFrame>
    );
  }

  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', color: '#888' }}>
        Loading…
      </div>
    );
  }

  // ── Form column ──────────────────────────────────────────────────────
  const formColumn = (
    <div style={{ width: '100%', padding: isMobile ? '24px 22px 28px' : '44px 48px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <h1 style={{ fontSize: isMobile ? 26 : 34, fontWeight: 800, color: 'var(--text)', margin: '0 0 8px', letterSpacing: '-0.7px', lineHeight: 1.15 }}>
        Ready to Transform Your Studio?
      </h1>
      <p style={{ fontSize: isMobile ? 13 : 14, color: 'var(--muted)', margin: '0 0 24px', lineHeight: 1.55 }}>
        Step into your new digital home for seamless management.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input
          type="text"
          value={form.schoolName}
          onChange={e => setForm({ ...form, schoolName: e.target.value })}
          placeholder="Studio name *"
          aria-label="Studio name"
          disabled={submitting}
          style={inputStyle}
        />
        <input
          type="text"
          value={form.ownerName}
          onChange={e => setForm({ ...form, ownerName: e.target.value })}
          placeholder="Owner name *"
          aria-label="Owner name"
          disabled={submitting}
          style={inputStyle}
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <input
            type="text"
            value={form.city}
            onChange={e => setForm({ ...form, city: e.target.value })}
            placeholder="City"
            aria-label="City"
            disabled={submitting}
            style={inputStyle}
          />
          <input
            type="text"
            value={form.danceStyle}
            onChange={e => setForm({ ...form, danceStyle: e.target.value })}
            placeholder="Dance style"
            aria-label="Dance style"
            disabled={submitting}
            style={inputStyle}
          />
        </div>

        {/* Terms */}
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 12px', background: 'var(--surface)', borderRadius: 8, borderLeft: '3px solid var(--border)', cursor: submitting ? 'not-allowed' : 'pointer' }}>
          <input
            type="checkbox"
            checked={agreeToTerms}
            onChange={e => setAgreeToTerms(e.target.checked)}
            disabled={submitting}
            style={{ width: 17, height: 17, marginTop: 2, flexShrink: 0, cursor: submitting ? 'not-allowed' : 'pointer' }}
          />
          <span style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.55, flex: 1 }}>
            I agree to ManchQ's{' '}
            <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: '#7C3AED', textDecoration: 'none', fontWeight: 600 }}>Terms</a>
            {' '}and{' '}
            <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: '#7C3AED', textDecoration: 'none', fontWeight: 600 }}>Privacy Policy</a>
          </span>
        </label>
      </div>

      {/* Google primary CTA */}
      <div style={{ marginTop: 16 }}>
        <GoogleSignIn
          mode="register"
          label="Sign up with Google →"
          onToken={handleGoogleToken}
          disabled={!baseFormComplete || submitting}
          disabledTitle={disabledTitle}
        />
      </div>

      {/* Email fallback — now a button (not a text link) */}
      {!showEmail ? (
        <button
          type="button"
          onClick={() => setShowEmail(true)}
          disabled={!baseFormComplete || submitting}
          title={!baseFormComplete ? disabledTitle : undefined}
          style={{
            marginTop: 10,
            width: '100%',
            padding: '11px 14px',
            background: 'transparent',
            border: '1.5px solid var(--border)',
            borderRadius: 9,
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--text)',
            cursor: (!baseFormComplete || submitting) ? 'not-allowed' : 'pointer',
            opacity: (!baseFormComplete || submitting) ? 0.55 : 1,
            transition: 'background .15s, border-color .15s, opacity .15s',
          }}
          onMouseEnter={e => {
            if (baseFormComplete && !submitting) {
              (e.currentTarget as HTMLElement).style.borderColor = PURPLE;
              (e.currentTarget as HTMLElement).style.color = PURPLE;
            }
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
            (e.currentTarget as HTMLElement).style.color = 'var(--text)';
          }}
        >
          or use email instead
        </button>
      ) : (
        <form onSubmit={handleEmailSubmit} style={{ marginTop: 12 }}>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Your email *"
            aria-label="Email"
            disabled={submitting}
            required
            style={inputStyle}
            autoFocus
          />
          <button
            type="submit"
            disabled={!baseFormComplete || submitting || !email.trim()}
            style={{
              marginTop: 10,
              width: '100%',
              padding: '12px 14px',
              background: (!baseFormComplete || submitting || !email.trim()) ? '#555' : '#111',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 700,
              cursor: (!baseFormComplete || submitting || !email.trim()) ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting ? 'Creating…' : 'Create studio & email me a link'}
          </button>
          <button
            type="button"
            onClick={() => setShowEmail(false)}
            style={{ marginTop: 6, background: 'none', border: 'none', color: 'var(--muted)', fontSize: 12, cursor: 'pointer', padding: 4 }}
          >
            ← Back to Google sign-up
          </button>
        </form>
      )}

      {/* Sign-in link */}
      <div style={{ marginTop: 18, textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>
        Already have an account?{' '}
        <button
          onClick={() => router.push('/login')}
          style={{ background: 'none', border: 'none', color: '#6a7fdb', cursor: 'pointer', fontWeight: 700, padding: 0, textDecoration: 'underline' }}
        >
          Sign in →
        </button>
      </div>
    </div>
  );

  // ── Layout — island on dynamic video background ──────────────────────
  return (
    <BackgroundFrame>
      {/* Top bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 5, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src="/ManchQ-Logo.png" alt="ManchQ" style={{ width: 28, height: 28, display: 'block' }} />
          <span style={{ fontWeight: 800, fontSize: 16, color: '#fff' }}>
            Manch<span style={{ background: GRAD, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Q</span>
          </span>
        </button>
        <button
          onClick={() => router.push('/login')}
          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: 13, fontWeight: 600, padding: '7px 16px', borderRadius: 8, cursor: 'pointer', backdropFilter: 'blur(8px)' }}
        >
          Sign in
        </button>
      </div>

      {/* The unified island */}
      <div
        style={{
          position: 'relative',
          zIndex: 4,
          width: '100%',
          maxWidth: isMobile ? 480 : 1040,
          margin: isMobile ? '70px auto 32px' : '0 auto',
          background: 'var(--card)',
          borderRadius: 20,
          boxShadow: '0 30px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: 'stretch',
        }}
      >
        {/* Left / top: carousel */}
        <div style={{ flex: isMobile ? 'none' : '0 0 44%', minHeight: isMobile ? 200 : 'auto', display: 'flex' }}>
          <div style={{ flex: 1, display: 'flex' }}>
            <RegisterCarousel compact={isMobile} />
          </div>
        </div>

        {/* Right / bottom: form */}
        <div style={{ flex: 1, display: 'flex', minWidth: 0 }}>
          {formColumn}
        </div>
      </div>

      {/* Existing-user confirm modal */}
      {existing && (
        <div
          onClick={() => setExisting(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, background: 'var(--card)', borderRadius: 14, padding: 26, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>👋</div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', margin: '0 0 10px' }}>You already have an account</h3>
            <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.6, margin: '0 0 14px' }}>
              <strong style={{ color: 'var(--text)' }}>{existing.email}</strong> is already on ManchQ
              {existing.schools.length > 0 ? (
                <>
                  {' '}as a member of{' '}
                  <strong style={{ color: 'var(--text)' }}>
                    {existing.schools.map(s => s.school_name).join(', ')}
                  </strong>.
                </>
              ) : '.'}
            </p>
            <p style={{ fontSize: 14, color: 'var(--text)', margin: '0 0 18px' }}>
              Did you mean to:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={handleSignInInstead}
                style={{ background: '#111', color: '#fff', border: 'none', padding: '12px 18px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
              >
                Sign in to my existing studio →
              </button>
              <button
                onClick={handleConfirmNewStudio}
                style={{ background: 'transparent', color: 'var(--text)', border: '1.5px solid var(--border)', padding: '11px 18px', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
              >
                Create a new studio anyway
              </button>
            </div>
            <button
              onClick={() => setExisting(null)}
              style={{ marginTop: 14, background: 'none', border: 'none', color: 'var(--muted)', fontSize: 12, cursor: 'pointer', padding: 4 }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </BackgroundFrame>
  );
}

// ── Dynamic video background wrapper ─────────────────────────────────────
function BackgroundFrame({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      position: 'relative',
      minHeight: '100vh',
      width: '100%',
      overflow: 'hidden',
      background: '#08060F',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 20px',
      boxSizing: 'border-box',
    }}>
      <video
        autoPlay
        muted
        loop
        playsInline
        aria-hidden
        style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          // Heavier blur so the video reads as soft, abstract texture.
          // scale prevents the blurred edges from leaking past the viewport.
          objectFit: 'cover', filter: 'blur(14px)', transform: 'scale(1.1)', zIndex: 0,
        }}
      >
        <source src="/manchq-hero-bg-long.mp4" type="video/mp4" />
      </video>
      {/* Darker overlay so the island pops more — roughly 2x the prior darkness */}
      <div aria-hidden style={{
        position: 'absolute', inset: 0, zIndex: 1,
        background: 'linear-gradient(to bottom, rgba(8,6,15,0.94) 0%, rgba(8,6,15,0.80) 30%, rgba(8,6,15,0.80) 70%, rgba(8,6,15,0.96) 100%)',
        pointerEvents: 'none',
      }} />
      {children}
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', color: '#888' }}>
        Loading…
      </div>
    }>
      <RegisterForm />
    </Suspense>
  );
}
