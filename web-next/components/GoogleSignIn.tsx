'use client';

// Google sign-in button — uses GIS (Google Identity Services) via the
// <GoogleLogin> component from @react-oauth/google.
//
// Why <GoogleLogin> and not useGoogleLogin?
//   useGoogleLogin opens an OAuth popup that mobile browsers (iOS Safari,
//   Chrome Mobile) treat as a new tab. The original tab gets backgrounded
//   and is often killed for memory pressure before postMessage can land,
//   leaving the user stranded with their login state lost. GIS uses an
//   iframe-based ID-token flow that works on mobile without that fragility.
//
// What we get back: a JWT "credential" (signed by Google).
//   - login mode:    POST it to /auth/google as { credential } — the backend
//                    already verifies it via google-auth-library.
//   - register mode: decode it client-side to pre-fill the studio form, then
//                    hand the credential up via onToken() for the parent to
//                    submit with the studio details.

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import toast from 'react-hot-toast';
import { redirectToDashboard } from '@/lib/redirectToDashboard';
import { useAuth } from '@/lib/context/AuthContext';
import { useTheme } from '@/lib/context/ThemeContext';

type Props = {
  // 'login' (default): runs the full sign-in flow — POSTs the credential to
  //                    /auth/google and handles the response branches.
  // 'register':        decodes the credential and hands it back to the parent
  //                    via onToken(). Parent submits it with the studio form.
  mode?: 'login' | 'register';
  onToken?: (credential: string, profile: { email: string; name: string; picture?: string }) => void;
  disabled?: boolean;          // when true, the button is non-interactive
  disabledTitle?: string;      // tooltip explaining why
  // `label` was used by the previous custom button. GIS renders its own
  // branded button with a fixed copy ("Sign in with Google" / "Sign up with
  // Google"), so it's no longer honoured. Kept in the prop type for source
  // compatibility — callers can keep passing it without a TS error.
  label?: string;
};

// Decode a JWT payload (no signature verification — the backend re-verifies
// the credential before trusting it). Handles UTF-8 names correctly.
function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const part = token.split('.')[1];
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(b64);
    const utf8 = decodeURIComponent(
      raw.split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
    );
    return JSON.parse(utf8);
  } catch {
    return null;
  }
}

export default function GoogleSignIn({ mode = 'login', onToken, disabled = false, disabledTitle }: Props = {}) {
  const router = useRouter();
  const { setSession } = useAuth();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number>(320);

  // GIS button takes a fixed pixel width — match it to the container so the
  // button fills the auth island the same way our old custom button did.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setWidth(Math.min(400, Math.floor(w))); // GIS caps at 400
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleSuccess = async (resp: CredentialResponse) => {
    const credential = resp?.credential;
    if (!credential) {
      toast.error("Google sign-in didn't return a credential. Try again.");
      return;
    }

    // REGISTER MODE: decode + hand off to parent.
    if (mode === 'register') {
      const claims = decodeJwtPayload(credential);
      if (!claims?.email) {
        toast.error("Couldn't read your Google profile. Please try again.");
        return;
      }
      onToken?.(credential, {
        email: String(claims.email).toLowerCase(),
        name: claims.name || '',
        picture: claims.picture,
      });
      return;
    }

    // LOGIN MODE: full sign-in flow against our backend.
    setLoading(true);
    const t = toast.loading('Getting you in…');
    try {
      const apiUrl = (process.env.NEXT_PUBLIC_API_URL?.trim()) || 'http://localhost:5000/api';
      const response = await fetch(`${apiUrl}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential }),
      });
      const data = await response.json();

      if (response.ok) {
        if (data.requires_choice && data.chooser_token) {
          try {
            sessionStorage.setItem('sf_pending_chooser', JSON.stringify({
              chooser_token: data.chooser_token,
              memberships: data.memberships || [],
              user: data.user,
            }));
          } catch (_) {}
          toast.dismiss(t);
          router.replace('/auth/choose-school');
        } else if (data.token) {
          setSession(data.token, data.user, data.school || null);
          toast.success(`Welcome back, ${data.user?.name?.split(' ')[0] || 'there'}!`, { id: t });
          redirectToDashboard(router);
        } else if (data.requiresRegistration) {
          toast.success('Almost there — just a few details about your studio.', { id: t });
          router.push(`/register?googleData=${encodeURIComponent(JSON.stringify(data.googleData))}`);
        } else {
          toast.error("Something didn't add up — please try again.", { id: t });
        }
      } else {
        console.error('[GoogleSignIn] backend error', response.status, data);
        toast.error("We couldn't sign you in. Please try again.", { id: t });
      }
    } catch (error: any) {
      console.error('[GoogleSignIn] fetch error:', error);
      toast.error("Couldn't reach our servers. Check your connection and try again.", { id: t });
    } finally {
      setLoading(false);
    }
  };

  const handleError = () => {
    console.warn('[GoogleSignIn] GIS reported an error / cancellation');
    toast.error("Google sign-in was cancelled or blocked.");
  };

  const isDark = theme === 'dark';
  const blocked = disabled || loading;

  return (
    <div
      ref={wrapRef}
      title={disabled && disabledTitle ? disabledTitle : undefined}
      style={{ position: 'relative', width: '100%', minHeight: 44 }}
    >
      <GoogleLogin
        onSuccess={handleSuccess}
        onError={handleError}
        theme={isDark ? 'filled_black' : 'outline'}
        size="large"
        text={mode === 'register' ? 'signup_with' : 'continue_with'}
        shape="rectangular"
        width={width}
        useOneTap={false}
      />
      {blocked && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: isDark ? 'rgba(10,10,15,0.55)' : 'rgba(255,255,255,0.6)',
            borderRadius: 6,
            cursor: 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isDark ? '#E3E3E3' : '#374151',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {loading ? 'Signing in…' : ''}
        </div>
      )}
    </div>
  );
}
