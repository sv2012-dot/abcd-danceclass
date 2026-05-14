'use client';

// /login — sign in to an existing studio.
// Layout mirrors /register: video background + rounded island card,
// single-column. The island is FORCED-LIGHT (always white) regardless of the
// app's theme setting — colours are hardcoded below, not `var(--*)` tokens.

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';
import GoogleSignIn from '@/components/GoogleSignIn';
import AuthBackground from '@/components/AuthBackground';
import toast from 'react-hot-toast';
import { redirectToDashboard } from '@/lib/redirectToDashboard';
import { auth } from '@/lib/api';

// ── Light palette — used regardless of app-wide dark mode ────────────────
const C = {
  cardBg:   '#FFFFFF',
  surface:  '#F3F4F6',
  border:   '#E5E7EB',
  text:     '#111827',
  textSoft: '#1F2937',
  muted:    '#6B7280',
  mutedSub: '#9CA3AF',
  link:     '#6A7FDB',
  primary:  '#111827', // CTA bg
  primaryDisabled: '#9CA3AF',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: C.surface,
  border: `1.5px solid ${C.border}`,
  borderRadius: 10,
  padding: '14px 16px',
  fontSize: 15,
  fontWeight: 500,
  color: C.text,
  boxSizing: 'border-box',
  outline: 'none',
  transition: 'border-color .15s, box-shadow .15s',
};

function useIsMobile(bp = 600) {
  const [m, setM] = useState(false);
  useEffect(() => {
    const fn = () => setM(window.innerWidth < bp);
    fn();
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, [bp]);
  return m;
}

export default function LoginPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const isMobile = useIsMobile();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [linkSent, setLinkSent] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      redirectToDashboard(router);
    }
  }, [authLoading, user, router]);

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      await auth.requestMagicLink(email.trim());
      setLinkSent(true);
    } catch (err: any) {
      toast.error(err?.error || err?.message || 'Could not send sign-in link.');
    } finally {
      setLoading(false);
    }
  };

  // Mobile-tuned padding so the island fits within visible viewport.
  const cardPadding = isMobile ? '26px 22px 24px' : '40px 44px 32px';

  return (
    <AuthBackground>
      {/* Island — forced light (white) regardless of dark mode */}
      <div
        style={{
          position: 'relative',
          zIndex: 4,
          width: '100%',
          maxWidth: 460,
          background: C.cardBg,
          color: C.text,
          borderRadius: 20,
          padding: cardPadding,
          boxSizing: 'border-box',
          boxShadow: '0 30px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06)',
        }}
      >
        {/* Header — logo only */}
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <button
            onClick={() => router.push('/')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, borderRadius: '50%', display: 'inline-flex' }}
            title="Go to homepage"
          >
            <img
              src="/ManchQ-Logo.png"
              alt="ManchQ"
              style={{ width: isMobile ? 56 : 68, height: isMobile ? 56 : 68, borderRadius: '50%', display: 'block' }}
            />
          </button>
        </div>

        {linkSent ? (
          <div style={{ textAlign: 'center', padding: '4px 0' }}>
            <div style={{ fontSize: 38, marginBottom: 10 }}>✉️</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: C.text }}>Check your inbox</h2>
            <p style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.6, marginBottom: 16 }}>
              We sent a sign-in link to <strong style={{ color: C.text }}>{email}</strong>. It expires in 15 minutes.
            </p>
            <button
              onClick={() => { setLinkSent(false); setEmail(''); }}
              style={{ background: 'none', border: 'none', color: C.link, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}
            >
              ← Use a different email
            </button>
            <div style={{ marginTop: 18, padding: '10px 12px', background: C.surface, borderRadius: 9, fontSize: 11.5, color: C.muted, lineHeight: 1.55, textAlign: 'left' }}>
              <strong style={{ color: C.text }}>Didn't get it?</strong> Check spam or
              {' '}<a href="mailto:support@manchq.com" style={{ color: C.link }}>email support</a>.
            </div>
          </div>
        ) : (
          <>
            <h2 style={{ fontSize: isMobile ? 19 : 20, fontWeight: 700, margin: '0 0 8px', color: C.text, textAlign: 'center' }}>
              Sign in to ManchQ
            </h2>
            {/* Welcome-back — single text style throughout */}
            <p style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.55, margin: '0 0 22px', textAlign: 'center' }}>
              Welcome back to ManchQ! Use the same option — Google or email — you picked at signup to enter your studio. Have a great time!
            </p>

            {/* Google */}
            <GoogleSignIn />

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', margin: '18px 0', gap: 12 }}>
              <div style={{ flex: 1, height: '1px', background: C.border }} />
              <span style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.08em' }}>Or</span>
              <div style={{ flex: 1, height: '1px', background: C.border }} />
            </div>

            {/* No-password hint, sits above the email field */}
            <p style={{ fontSize: 12, color: C.muted, textAlign: 'center', margin: '0 0 14px' }}>
              No password &mdash; we'll send a one-time link.
            </p>

            <form onSubmit={handleMagicLink}>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email *"
                aria-label="Email"
                style={inputStyle}
              />
              <button
                type="submit"
                disabled={loading || !email.trim()}
                style={{
                  width: '100%',
                  marginTop: 12,
                  padding: '13px',
                  background: loading || !email.trim() ? C.primaryDisabled : C.primary,
                  color: '#fff',
                  border: 'none',
                  borderRadius: 10,
                  fontSize: 14.5,
                  fontWeight: 700,
                  cursor: loading || !email.trim() ? 'not-allowed' : 'pointer',
                  letterSpacing: '0.01em',
                }}
              >
                {loading ? 'Sending link…' : 'Email me a sign-in link'}
              </button>
            </form>

            <div style={{ marginTop: 18, textAlign: 'center', fontSize: 12, color: C.muted }}>
              New to ManchQ?{' '}
              <button
                onClick={() => router.push('/register')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.link, fontWeight: 700, padding: 0, textDecoration: 'underline', fontSize: 12 }}
              >
                Register your studio
              </button>
            </div>
          </>
        )}
      </div>
    </AuthBackground>
  );
}
