'use client';

// /ipad/login — single email field, sends a magic link.
//
// Belt-and-braces submit handling for iPad reliability:
//   1) React onSubmit (preventDefault → fetch) is the primary path.
//   2) The <form action="/api/ipad/magic-link" method="POST"> is a NATIVE
//      fallback for the case where React's event delegation hasn't hydrated
//      yet on iPad WebKit — the browser will just post the form and we
//      handle it server-side.
//
// Other iOS defenses on this page:
//   - input font-size 16px so iOS Safari doesn't auto-zoom on focus
//   - inputMode/autoComplete/autoCapitalize hints for the email keyboard
//   - minHeight: 100dvh so the card stays centred when the address bar
//     collapses mid-scroll
//   - button minHeight 52px ≥ Apple HIG 44pt tap-target requirement

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ipadAuth } from '../_lib/api';

function IpadLoginInner() {
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  // If the user came back via the native-form fallback (no JS submit), the
  // server redirect carries ?sent=email or ?error=... — surface that state.
  useEffect(() => {
    const sent = params.get('sent');
    if (sent) {
      setEmail(sent);
      setStatus('sent');
      return;
    }
    const err = params.get('error');
    if (err) {
      setStatus('error');
      setErrorMsg(
        err === 'invalid-email' ? 'Please enter a valid email address.' :
        err === 'send-failed'   ? 'Could not send the link. Try again.' :
        err === 'network'       ? 'Network error. Check your connection and retry.' :
        'Something went wrong. Try again.'
      );
    }
  }, [params]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus('sending');
    setErrorMsg('');
    try {
      await ipadAuth.requestMagicLink(email.trim());
      setStatus('sent');
    } catch (err: any) {
      setStatus('error');
      setErrorMsg(err?.message || 'Could not send link. Try again.');
    }
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'var(--background)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 460,
          background: 'var(--card)',
          borderRadius: 20,
          padding: 36,
          boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
          border: '1px solid var(--border)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div
            style={{
              display: 'inline-block',
              padding: '4px 12px',
              borderRadius: 999,
              background: 'var(--accent-bg)',
              color: 'var(--accent-foreground)',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: 16,
              userSelect: 'none',
              WebkitUserSelect: 'none',
            }}
          >
            iPad Demo
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Sign in</h1>
          <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.55 }}>
            We&rsquo;ll send a one-tap sign-in link to your email.
          </p>
        </div>

        {status === 'sent' ? (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: 36, marginBottom: 14 }} aria-hidden>📬</div>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>Check your inbox</h2>
            <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
              If <strong style={{ color: 'var(--text)' }}>{email}</strong> is on ManchQ, a link is on its way.
              Tap it on this iPad to sign in.
            </p>
            <button
              onClick={() => { setStatus('idle'); setEmail(''); }}
              style={{
                marginTop: 22,
                background: 'transparent',
                border: '1px solid var(--border)',
                color: 'var(--muted)',
                fontSize: 14,
                cursor: 'pointer',
                padding: '14px 22px',
                minHeight: 48, // ≥ 44pt HIG tap-target
                borderRadius: 10,
              }}
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            action="/api/ipad/magic-link"
            method="POST"
            noValidate
          >
            <div style={{ marginBottom: 18 }}>
              <label
                htmlFor="ipad-email"
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--muted)',
                  marginBottom: 8,
                }}
              >
                Email
              </label>
              <input
                id="ipad-email"
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@studio.com"
                required
                style={{
                  width: '100%',
                  background: 'var(--surface)',
                  border: '1.5px solid var(--border)',
                  borderRadius: 12,
                  padding: '16px 14px',
                  // 16px exactly — iOS Safari zooms in on inputs < 16px on focus.
                  fontSize: 16,
                  color: 'var(--text)',
                  outline: 'none',
                  boxSizing: 'border-box',
                  minHeight: 52,
                }}
              />
            </div>

            {status === 'error' && (
              <div
                role="alert"
                style={{
                  background: 'rgba(239,68,68,0.08)',
                  color: 'var(--destructive)',
                  border: '1px solid rgba(239,68,68,0.25)',
                  borderRadius: 10,
                  padding: '10px 12px',
                  fontSize: 13,
                  marginBottom: 16,
                }}
              >
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={status === 'sending' || !email.trim()}
              style={{
                width: '100%',
                background: status === 'sending' ? 'var(--muted)' : 'var(--primary)',
                color: '#fff',
                border: 'none',
                borderRadius: 12,
                padding: '16px',
                fontSize: 16,
                fontWeight: 700,
                cursor: 'pointer',
                letterSpacing: '0.01em',
                opacity: status === 'sending' || !email.trim() ? 0.7 : 1,
                minHeight: 52,
                // Re-assert touch defenses on the button itself in case the
                // parent layout style is stripped by some upstream wrapper.
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {status === 'sending' ? 'Sending…' : 'Send sign-in link'}
            </button>
          </form>
        )}

        <p
          style={{
            marginTop: 28,
            paddingTop: 18,
            borderTop: '1px solid var(--border)',
            fontSize: 11,
            color: 'var(--muted)',
            textAlign: 'center',
            lineHeight: 1.6,
          }}
        >
          This is the iPad demo build. Your session here is separate from the main app.
        </p>
      </div>
    </div>
  );
}

// Next.js requires useSearchParams() to live under a Suspense boundary so
// the rest of the page can stream while query-string hydration completes.
export default function IpadLoginPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: '100dvh',
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
      <IpadLoginInner />
    </Suspense>
  );
}
