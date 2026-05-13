'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';
import GoogleSignIn from '@/components/GoogleSignIn';
import toast from 'react-hot-toast';
import { redirectToDashboard } from '@/lib/redirectToDashboard';
import { auth } from '@/lib/api';

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--surface)',
  border: '1.5px solid var(--border)',
  borderRadius: 9,
  padding: '11px 14px',
  fontSize: 15,
  color: 'var(--text)',
  boxSizing: 'border-box',
  outline: 'none',
};

export default function LoginPage() {
  const { user, loading: authLoading, setSession } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [linkSent, setLinkSent] = useState(false);

  // If already logged in, send to dashboard directly
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

  const handleDemo = async (demoEmail: string) => {
    setLoading(true);
    try {
      const data: any = await auth.demoLogin(demoEmail);
      if (data?.requires_choice && data?.chooser_token) {
        try {
          sessionStorage.setItem('sf_pending_chooser', JSON.stringify({
            chooser_token: data.chooser_token,
            memberships: data.memberships || [],
            user: data.user,
          }));
        } catch (_) {}
        router.replace('/auth/choose-school');
        return;
      }
      setSession(data.token, data.user, data.school);
      toast.success(`Welcome to the demo!`);
      redirectToDashboard(router);
    } catch (err: any) {
      toast.error(err?.error || 'Demo sign-in failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'center' }}>
            <button
              onClick={() => router.push('/')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, borderRadius: '50%', display: 'flex' }}
              title="Go to homepage"
            >
              <img src="/ManchQ-Logo.png" alt="ManchQ" style={{ width: 80, height: 80, borderRadius: '50%', display: 'block' }} />
            </button>
          </div>
          <h1 style={{ fontFamily: 'var(--font-d)', fontSize: 28, color: '#fff', marginBottom: 6, letterSpacing: '-0.5px' }}>ManchQ</h1>
          <p style={{ color: '#888', fontSize: 13, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Dance School Management</p>
        </div>

        {/* Card */}
        <div style={{ background: 'var(--card)', borderRadius: 16, padding: 32, boxShadow: '0 0 0 1px rgba(255,255,255,0.08)' }}>
          {linkSent ? (
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✉️</div>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>Check your inbox</h2>
              <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.55, marginBottom: 18 }}>
                We sent a sign-in link to <strong style={{ color: 'var(--text)' }}>{email}</strong>.<br/>
                It expires in 15 minutes.
              </p>
              <button
                onClick={() => { setLinkSent(false); setEmail(''); }}
                style={{ background: 'none', border: 'none', color: '#6a7fdb', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}
              >
                ← Use a different email
              </button>
              <div style={{ marginTop: 22, padding: 14, background: 'var(--surface)', borderRadius: 10, fontSize: 12, color: 'var(--muted)', lineHeight: 1.55, textAlign: 'left' }}>
                <strong style={{ color: 'var(--text)' }}>Didn't get it?</strong> Check spam, or
                {' '}<a href="mailto:support@manchq.com" style={{ color: '#6a7fdb' }}>email support</a>.
              </div>
            </div>
          ) : (
            <>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6, color: 'var(--text)' }}>Sign in to ManchQ</h2>
              <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 22, lineHeight: 1.5 }}>
                No password &mdash; we'll email you a one-time sign-in link.
              </p>

              {/* Google Sign In */}
              <div style={{ marginBottom: 20 }}>
                <GoogleSignIn />
              </div>

              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20, gap: 12 }}>
                <div style={{ flex: 1, height: '1px', background: 'var(--border)' }}></div>
                <span style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700 }}>Or</span>
                <div style={{ flex: 1, height: '1px', background: 'var(--border)' }}></div>
              </div>

              <form onSubmit={handleMagicLink}>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    style={inputStyle}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  style={{ width: '100%', padding: '13px', background: loading || !email.trim() ? '#555' : '#111', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: loading || !email.trim() ? 'not-allowed' : 'pointer', letterSpacing: '0.01em' }}
                >
                  {loading ? 'Sending link…' : 'Email me a sign-in link →'}
                </button>
              </form>

              {/* Demo account */}
              <div style={{ marginTop: 22, padding: 14, background: 'var(--surface)', borderRadius: 10, fontSize: 12, color: 'var(--muted)', borderLeft: '3px solid var(--border)' }}>
                <div style={{ fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>Just exploring?</div>
                <button
                  type="button"
                  onClick={() => handleDemo('teacher@manchq.com')}
                  disabled={loading}
                  style={{ width: '100%', padding: '9px 12px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer', fontSize: 12, color: 'var(--text)', fontWeight: 600 }}
                >
                  Try the demo →
                </button>
              </div>

              {/* Register link */}
              <div style={{ marginTop: 22, textAlign: 'center', fontSize: 14, color: 'var(--muted)' }}>
                Don't have a school?{' '}
                <button
                  onClick={() => router.push('/register')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6a7fdb', fontWeight: 700, padding: 0, textDecoration: 'underline' }}
                >
                  Register here
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
