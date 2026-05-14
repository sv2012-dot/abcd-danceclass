'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';
import GoogleSignIn from '@/components/GoogleSignIn';
import toast from 'react-hot-toast';
import { redirectToDashboard } from '@/lib/redirectToDashboard';
import { auth } from '@/lib/api';

// Placeholder-as-label input — matches the /register page pattern.
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

  // Sizes tuned so the whole page fits inside a 640px-tall mobile viewport
  // without scrolling — small logo, compact card, no superfluous lines.
  const logoSize = isMobile ? 56 : 76;
  const headerMargin = isMobile ? 18 : 28;
  const cardPadding = isMobile ? 22 : 30;
  const titleSize = isMobile ? 18 : 20;

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#000',
      padding: isMobile ? '16px 18px' : 20,
      boxSizing: 'border-box',
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* Header — compact on mobile */}
        <div style={{ textAlign: 'center', marginBottom: headerMargin }}>
          <div style={{ marginBottom: isMobile ? 8 : 12, display: 'flex', justifyContent: 'center' }}>
            <button
              onClick={() => router.push('/')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, borderRadius: '50%', display: 'flex' }}
              title="Go to homepage"
            >
              <img src="/ManchQ-Logo.png" alt="ManchQ" style={{ width: logoSize, height: logoSize, borderRadius: '50%', display: 'block' }} />
            </button>
          </div>
          <h1 style={{ fontFamily: 'var(--font-d)', fontSize: isMobile ? 22 : 26, color: '#fff', margin: 0, letterSpacing: '-0.5px' }}>ManchQ</h1>
        </div>

        {/* Card */}
        <div style={{ background: 'var(--card)', borderRadius: 16, padding: cardPadding, boxShadow: '0 0 0 1px rgba(255,255,255,0.08)' }}>
          {linkSent ? (
            <div style={{ textAlign: 'center', padding: '6px 0' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>✉️</div>
              <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 6, color: 'var(--text)' }}>Check your inbox</h2>
              <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.55, marginBottom: 14 }}>
                We sent a sign-in link to <strong style={{ color: 'var(--text)' }}>{email}</strong>. It expires in 15 minutes.
              </p>
              <button
                onClick={() => { setLinkSent(false); setEmail(''); }}
                style={{ background: 'none', border: 'none', color: '#6a7fdb', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}
              >
                ← Use a different email
              </button>
              <div style={{ marginTop: 16, padding: '10px 12px', background: 'var(--surface)', borderRadius: 9, fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.55, textAlign: 'left' }}>
                <strong style={{ color: 'var(--text)' }}>Didn't get it?</strong> Check spam or
                {' '}<a href="mailto:support@manchq.com" style={{ color: '#6a7fdb' }}>email support</a>.
              </div>
            </div>
          ) : (
            <>
              <h2 style={{ fontSize: titleSize, fontWeight: 700, margin: '0 0 14px', color: 'var(--text)', textAlign: 'center' }}>
                Sign in to ManchQ
              </h2>

              {/* Google */}
              <GoogleSignIn />
              <p style={{ fontSize: 11.5, color: 'var(--muted)', margin: '6px 0 0', textAlign: 'center' }}>
                Fastest way back in.
              </p>

              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center', margin: '14px 0', gap: 12 }}>
                <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.08em' }}>Or</span>
                <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
              </div>

              {/* Email — placeholder-as-label, matches /register */}
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
                    marginTop: 10,
                    padding: '13px',
                    background: loading || !email.trim() ? '#555' : '#111',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 10,
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: loading || !email.trim() ? 'not-allowed' : 'pointer',
                    letterSpacing: '0.01em',
                  }}
                >
                  {loading ? 'Sending link…' : 'Email me a sign-in link'}
                </button>
                <p style={{ fontSize: 11.5, color: 'var(--muted)', margin: '8px 0 0', textAlign: 'center' }}>
                  No password &mdash; we'll send a one-time link.
                </p>
              </form>

              {/* Register link */}
              <div style={{ marginTop: 16, textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>
                New to ManchQ?{' '}
                <button
                  onClick={() => router.push('/register')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6a7fdb', fontWeight: 700, padding: 0, textDecoration: 'underline' }}
                >
                  Register your studio →
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
