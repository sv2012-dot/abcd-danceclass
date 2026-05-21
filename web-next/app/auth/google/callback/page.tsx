'use client';

// /auth/google/callback — handles Google's OAuth redirect-back.
//
// Flow:
//   1. GoogleSignIn stashed { mode, form? } in sessionStorage under the OAuth
//      state token, then navigated the browser to Google.
//   2. Google redirects here with ?code=...&state=...
//   3. We pull the stashed context, POST { code, redirect_uri } to the
//      backend (which exchanges the code for tokens using GOOGLE_CLIENT_SECRET),
//      and handle the same response branches as the old in-page sign-in flow.

import { Suspense, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/context/AuthContext';
import { redirectToDashboard } from '@/lib/redirectToDashboard';

const OAUTH_STATE_KEY_PREFIX = 'sf_oauth_';

function CallbackInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { setSession } = useAuth();
  // Guard against React strict-mode double-invocation in dev.
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    let cancelled = false;

    async function run() {
      const code = params.get('code');
      const stateToken = params.get('state');
      const oauthError = params.get('error');

      if (oauthError) {
        toast.error(`Google sign-in was cancelled or blocked${oauthError === 'access_denied' ? '.' : `: ${oauthError}`}`);
        router.replace('/login');
        return;
      }
      if (!code || !stateToken) {
        toast.error('Missing code or state from Google. Please sign in again.');
        router.replace('/login');
        return;
      }

      // Retrieve stashed context (mode + register form). Try the cookie set
      // by /api/auth/google/start (new flow) first; fall back to sessionStorage
      // for any in-flight session started by the older client-side GoogleSignIn.
      let stateData: { mode?: string; form?: Record<string, any> } | null = null;
      const cookieKey = OAUTH_STATE_KEY_PREFIX + stateToken;
      try {
        const cookies = document.cookie.split(/;\s*/);
        const match = cookies.find(c => c.startsWith(cookieKey + '='));
        if (match) {
          const value = decodeURIComponent(match.slice(cookieKey.length + 1));
          stateData = JSON.parse(value);
          // Clear the cookie now that we've consumed it.
          document.cookie = `${cookieKey}=; Path=/; Max-Age=0; SameSite=Lax`;
        }
      } catch (_) {}
      if (!stateData) {
        try {
          const raw = sessionStorage.getItem(cookieKey);
          if (raw) stateData = JSON.parse(raw);
          sessionStorage.removeItem(cookieKey);
        } catch (_) {}
      }

      if (!stateData) {
        toast.error('Sign-in state expired. Please try again.');
        router.replace('/login');
        return;
      }

      const apiUrl = (process.env.NEXT_PUBLIC_API_URL?.trim()) || 'http://localhost:5000/api';
      const redirectUri = `${window.location.origin}/auth/google/callback`;

      try {
        if (stateData.mode === 'register' && stateData.form) {
          // Register path — send code + studio form together.
          const res = await fetch(`${apiUrl}/auth/register-school`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...stateData.form,
              google_code: code,
              google_redirect_uri: redirectUri,
            }),
          });
          const data = await res.json();
          if (cancelled) return;

          if (res.ok && data.token) {
            setSession(data.token, data.user, data.school || null);
            toast.success(`Welcome to ManchQ, ${data.user?.name?.split(' ')[0] || 'there'}!`);
            redirectToDashboard(router);
          } else if (data.existing_user) {
            // Re-route through /register so the existing dialog can show.
            sessionStorage.setItem('sf_pending_existing_user', JSON.stringify({
              email: data.email,
              schools: data.schools || [],
            }));
            router.replace('/register?existing=1');
          } else {
            toast.error(data.error || 'Registration failed. Please try again.');
            router.replace('/register');
          }
          return;
        }

        // Login path — just send the code.
        const res = await fetch(`${apiUrl}/auth/google`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, redirect_uri: redirectUri }),
        });
        const data = await res.json();
        if (cancelled) return;

        if (res.ok) {
          if (data.requires_choice && data.chooser_token) {
            try {
              sessionStorage.setItem('sf_pending_chooser', JSON.stringify({
                chooser_token: data.chooser_token,
                memberships: data.memberships || [],
                user: data.user,
              }));
            } catch (_) {}
            router.replace('/auth/choose-school');
          } else if (data.token) {
            setSession(data.token, data.user, data.school || null);
            toast.success(`Welcome back, ${data.user?.name?.split(' ')[0] || 'there'}!`);
            redirectToDashboard(router);
          } else if (data.requiresRegistration) {
            toast.success('Almost there — just a few details about your studio.');
            router.replace(`/register?googleData=${encodeURIComponent(JSON.stringify(data.googleData))}`);
          } else {
            toast.error("Something didn't add up. Please try again.");
            router.replace('/login');
          }
        } else {
          console.error('[google-callback] backend error', res.status, data);
          toast.error(data.error || "We couldn't sign you in. Please try again.");
          router.replace('/login');
        }
      } catch (e: any) {
        if (cancelled) return;
        console.error('[google-callback] fetch error:', e);
        toast.error("Couldn't reach our servers. Check your connection and try again.");
        router.replace('/login');
      }
    }

    run();
    return () => { cancelled = true; };
  }, [params, router, setSession]);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        background: 'var(--background)',
        color: 'var(--foreground)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          border: '3px solid var(--border)',
          borderTopColor: 'var(--primary)',
          borderRadius: '50%',
          animation: 'sf-cb-spin 0.8s linear infinite',
        }}
        aria-hidden
      />
      <div style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>Completing sign-in…</div>
      <style>{`@keyframes sf-cb-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function GoogleCallbackPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24, fontSize: 14, color: 'var(--muted-foreground)' }}>Loading…</div>}>
      <CallbackInner />
    </Suspense>
  );
}
