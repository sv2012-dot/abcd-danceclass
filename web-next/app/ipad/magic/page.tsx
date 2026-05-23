'use client';

// /ipad/magic?token=... — consume a magic-link token and sign into the iPad
// demo session.
//
// Differences vs the main /auth/magic page:
//   - Stores token under sf_ipad_token (not sf_token) — isolated session.
//   - On multi-school accounts, auto-picks the first membership so demos
//     don't bounce to a chooser page. (Demo only — no real users land here.)
//   - On success, redirects to /ipad — never /dashboard.

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ipadAuth, setIpadSession } from '../_lib/api';

function MagicConsumer() {
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const t = params.get('token');
    if (!t) {
      setStatus('error');
      setErrorMsg('No sign-in link found. Request a new one.');
      return;
    }
    (async () => {
      try {
        const data: any = await ipadAuth.consumeMagicLink(t);

        // Multi-school: auto-pick the first membership for a smooth demo.
        if (data?.requires_choice && data?.chooser_token && Array.isArray(data.memberships)) {
          const firstSchoolId = data.memberships[0]?.school_id;
          if (!firstSchoolId) {
            setStatus('error');
            setErrorMsg('No school memberships found for this account.');
            return;
          }
          const picked: any = await ipadAuth.chooseSchool(data.chooser_token, firstSchoolId);
          setIpadSession(picked.token, picked.user, picked.school || null);
        } else if (data?.token) {
          setIpadSession(data.token, data.user, data.school || null);
        } else {
          setStatus('error');
          setErrorMsg('Unexpected response from server.');
          return;
        }

        setStatus('success');
        setTimeout(() => router.replace('/ipad'), 350);
      } catch (err: any) {
        setStatus('error');
        setErrorMsg(err?.data?.error || err?.message || 'This link is invalid or has expired.');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--background)',
        padding: 24,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 440,
          background: 'var(--card)',
          borderRadius: 20,
          padding: 36,
          textAlign: 'center',
          border: '1px solid var(--border)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
        }}
      >
        {status === 'loading' && (
          <>
            <div style={{ fontSize: 36, marginBottom: 14 }}>🔐</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Signing you in…</h2>
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>One moment.</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div style={{ fontSize: 36, marginBottom: 14 }}>✅</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>You&rsquo;re in!</h2>
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>Redirecting…</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div style={{ fontSize: 36, marginBottom: 14 }}>⚠️</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Couldn&rsquo;t sign you in</h2>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 22, lineHeight: 1.55 }}>
              {errorMsg}
            </p>
            <a
              href="/ipad/login"
              style={{
                display: 'inline-block',
                background: 'var(--primary)',
                color: '#fff',
                padding: '12px 22px',
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              Back to sign-in
            </a>
          </>
        )}
      </div>
    </div>
  );
}

export default function IpadMagicPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--background)',
          }}
        >
          <p style={{ color: 'var(--muted)' }}>Loading…</p>
        </div>
      }
    >
      <MagicConsumer />
    </Suspense>
  );
}
