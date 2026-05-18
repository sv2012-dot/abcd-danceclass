'use client';

// Client island for /ops/signin. Re-uses the same visual chrome as
// the public /login page (AuthBackground + var(--card) island) so the
// surface stays on-brand, but the form is the legacy email+password
// flow against POST /auth/login.

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';
import AuthBackground from '@/components/AuthBackground';
import toast from 'react-hot-toast';
import { redirectToDashboard } from '@/lib/redirectToDashboard';

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

export default function OpsSignInClient() {
  const { user, loading: authLoading, login } = useAuth() as any;
  const router = useRouter();
  const isMobile = useIsMobile();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      redirectToDashboard(router);
    }
  }, [authLoading, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    try {
      // useAuth().login persists the token to localStorage + fetches
      // school + updates context state, so we just call it and then
      // redirect. Same code path Google sign-in and (formerly) the
      // public /login form used.
      await login(email.trim(), password);
      toast.success('Signed in');
      redirectToDashboard(router);
    } catch (err: any) {
      toast.error(err?.error || err?.message || 'Sign-in failed.');
    } finally {
      setLoading(false);
    }
  };

  const cardPadding = isMobile ? '24px 16px 22px' : '40px 44px 32px';

  return (
    <AuthBackground>
      <div
        style={{
          position: 'relative',
          zIndex: 4,
          width: '100%',
          maxWidth: 460,
          background: 'var(--card)',
          color: 'var(--text)',
          borderRadius: 20,
          padding: cardPadding,
          boxSizing: 'border-box',
          boxShadow: '0 30px 80px rgba(0,0,0,0.45), 0 0 0 1px rgba(0,0,0,0.06)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <img
            src="/ManchQ-Logo.png"
            alt="ManchQ"
            style={{ width: isMobile ? 56 : 68, height: isMobile ? 56 : 68, borderRadius: '50%', display: 'inline-block' }}
          />
        </div>

        <h2 style={{ fontSize: isMobile ? 19 : 20, fontWeight: 700, margin: '0 0 6px', color: 'var(--text)', textAlign: 'center' }}>
          Ops sign-in
        </h2>
        <p style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.55, margin: '0 0 22px', textAlign: 'center' }}>
          Internal recovery sign-in. If you came here by accident, head to{' '}
          <a href="/login" style={{ color: '#6a7fdb', fontWeight: 600 }}>the normal sign-in</a>.
        </p>

        <form onSubmit={handleSubmit} style={{ width: '100%' }}>
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
          <div style={{ position: 'relative', marginTop: 12 }}>
            <input
              type={showPw ? 'text' : 'password'}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password *"
              aria-label="Password"
              style={{ ...inputStyle, paddingRight: 46 }}
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              aria-label={showPw ? 'Hide password' : 'Show password'}
              style={{
                position: 'absolute',
                top: '50%',
                right: 8,
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--muted)',
                padding: 8,
                fontSize: 14,
              }}
            >
              {showPw ? '🙈' : '👁'}
            </button>
          </div>
          <button
            type="submit"
            disabled={loading || !email.trim() || !password}
            style={{
              width: '100%',
              marginTop: 14,
              padding: '13px',
              background: loading || !email.trim() || !password ? 'var(--muted)' : 'var(--text)',
              color: 'var(--card)',
              border: 'none',
              borderRadius: 10,
              fontSize: 14.5,
              fontWeight: 700,
              cursor: loading || !email.trim() || !password ? 'not-allowed' : 'pointer',
              letterSpacing: '0.01em',
              opacity: loading || !email.trim() || !password ? 0.7 : 1,
            }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p style={{ marginTop: 20, fontSize: 11, color: 'var(--muted)', lineHeight: 1.55, textAlign: 'center' }}>
          This page is not indexed and not linked from anywhere public.
          Bookmark it if you need recurring access.
        </p>
      </div>
    </AuthBackground>
  );
}
