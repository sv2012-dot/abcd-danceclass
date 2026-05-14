'use client';

// /register — sign up a new studio.
// Layout: carousel left, form right on desktop. Compact carousel on top, form below on mobile.
// Auth options: Google (primary CTA) + email fallback ("or use email instead").
//
// Confirmation flow: if the resolved email already has a ManchQ account,
// backend returns { existing_user: true, schools: [...] } and the page shows
// a confirm dialog: "Create new anyway" / "Sign in to existing studios".

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

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--surface)',
  border: '1.5px solid var(--border)',
  borderRadius: 10,
  padding: '12px 14px',
  fontSize: 15,
  color: 'var(--text)',
  boxSizing: 'border-box',
  outline: 'none',
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
  // Last submitted payload, so "Create new anyway" can re-submit with acknowledge_existing=true
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

  function validate(): string | null {
    if (!form.ownerName.trim()) return 'Owner name is required.';
    if (!form.schoolName.trim()) return 'Studio name is required.';
    if (!agreeToTerms) return 'You must agree to the Terms and Privacy Policy.';
    return null;
  }

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

      if (!res.ok) {
        throw new Error(data.error || 'Registration failed.');
      }

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

      // Email path → magic-link sent, show "check inbox"
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
    const err = validate();
    if (err) { toast.error(err); return; }
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
    const err = validate();
    if (err) { toast.error(err); return; }
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
      <div style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ width: '100%', maxWidth: 440, background: 'var(--card)', borderRadius: 16, padding: 36, textAlign: 'center', boxShadow: '0 0 0 1px rgba(255,255,255,0.08)' }}>
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
      </div>
    );
  }

  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', color: '#888' }}>
        Loading…
      </div>
    );
  }

  // ── Form column (used in both layouts) ───────────────────────────────
  const formColumn = (
    <div style={{ width: '100%', padding: isMobile ? '24px 20px 32px' : '48px 56px' }}>
      <div style={{ maxWidth: 420, margin: '0 auto' }}>
        <h1 style={{ fontSize: isMobile ? 24 : 28, fontWeight: 800, color: 'var(--text)', margin: '0 0 6px', letterSpacing: '-0.5px' }}>
          Start your studio in 60 seconds
        </h1>
        <p style={{ fontSize: 14, color: 'var(--muted)', margin: '0 0 24px', lineHeight: 1.5 }}>
          30-day free trial · No credit card · Cancel anytime
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={labelStyle}>Owner name *</label>
            <input
              type="text"
              value={form.ownerName}
              onChange={e => setForm({ ...form, ownerName: e.target.value })}
              placeholder="Your full name"
              disabled={submitting}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Studio name *</label>
            <input
              type="text"
              value={form.schoolName}
              onChange={e => setForm({ ...form, schoolName: e.target.value })}
              placeholder="e.g. Bloom Dance Academy"
              disabled={submitting}
              style={inputStyle}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>City</label>
              <input
                type="text"
                value={form.city}
                onChange={e => setForm({ ...form, city: e.target.value })}
                placeholder="Seattle"
                disabled={submitting}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Dance style</label>
              <input
                type="text"
                value={form.danceStyle}
                onChange={e => setForm({ ...form, danceStyle: e.target.value })}
                placeholder="Contemporary"
                disabled={submitting}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Terms */}
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px', background: 'var(--surface)', borderRadius: 8, borderLeft: '3px solid var(--border)', cursor: submitting ? 'not-allowed' : 'pointer' }}>
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
        <div style={{ marginTop: 18 }}>
          <GoogleSignIn
            mode="register"
            label="Sign up with Google →"
            onToken={handleGoogleToken}
          />
        </div>

        {/* Email fallback */}
        {!showEmail ? (
          <div style={{ textAlign: 'center', marginTop: 14 }}>
            <button
              type="button"
              onClick={() => setShowEmail(true)}
              style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 13, cursor: 'pointer', padding: 6, textDecoration: 'underline' }}
            >
              or use email instead
            </button>
          </div>
        ) : (
          <form onSubmit={handleEmailSubmit} style={{ marginTop: 16 }}>
            <label style={labelStyle}>Your email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={submitting}
              required
              style={inputStyle}
            />
            <button
              type="submit"
              disabled={submitting}
              style={{
                marginTop: 10,
                width: '100%',
                padding: '12px 14px',
                background: submitting ? '#555' : '#111',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 700,
                cursor: submitting ? 'wait' : 'pointer',
              }}
            >
              {submitting ? 'Creating…' : 'Create studio & email me a link'}
            </button>
          </form>
        )}

        {/* Sign-in link */}
        <div style={{ marginTop: 24, textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>
          Already have an account?{' '}
          <button
            onClick={() => router.push('/login')}
            style={{ background: 'none', border: 'none', color: '#6a7fdb', cursor: 'pointer', fontWeight: 700, padding: 0, textDecoration: 'underline' }}
          >
            Sign in here →
          </button>
        </div>
      </div>
    </div>
  );

  // ── Layout ────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#000', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar with logo + back-to-home */}
      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src="/ManchQ-Logo.png" alt="ManchQ" style={{ width: 28, height: 28, display: 'block' }} />
          <span style={{ fontWeight: 800, fontSize: 16, color: '#fff' }}>
            Manch<span style={{ background: GRAD, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Q</span>
          </span>
        </button>
        <button
          onClick={() => router.push('/login')}
          style={{ background: 'none', border: '1px solid rgba(255,255,255,0.18)', color: '#fff', fontSize: 13, fontWeight: 600, padding: '7px 16px', borderRadius: 8, cursor: 'pointer' }}
        >
          Sign in
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: 'stretch' }}>
        {/* Left (or top on mobile): carousel */}
        <div style={{ flex: isMobile ? 'none' : '0 0 44%', padding: isMobile ? '16px 16px 0' : '32px 24px 24px 56px', display: 'flex' }}>
          <RegisterCarousel compact={isMobile} />
        </div>

        {/* Right (or below on mobile): form */}
        <div style={{ flex: 1, background: 'var(--background)', display: 'flex', alignItems: 'center' }}>
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
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--muted)',
  marginBottom: 6,
};

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
