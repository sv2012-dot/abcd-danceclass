'use client';

// Google sign-in button — uses the OAuth 2.0 authorization code flow with a
// full-page redirect (NOT a popup, NOT GIS iframe).
//
// Why? Both the popup flow (useGoogleLogin) and the GIS iframe (<GoogleLogin>)
// proved unreliable on mobile — popups open as new tabs and lose state when
// iOS Safari kills the backgrounded original tab. The full-page redirect has
// no tab/iframe to lose: the browser navigates to Google, the user signs in,
// Google redirects back to /auth/google/callback?code=...&state=... which
// then completes the sign-in. Works in 100% of browsers including iOS in-app
// webviews.
//
// Visual: custom button matching the original dark/light palette — Google's
// branding rules allow custom buttons as long as the icon + "Sign in with
// Google" / "Continue with Google" copy is present.

import { useState } from 'react';
import toast from 'react-hot-toast';
import { useTheme } from '@/lib/context/ThemeContext';

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
    <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908C16.658 14.013 17.64 11.705 17.64 9.2z"/>
    <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
    <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.039l3.007-2.332z"/>
    <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"/>
  </svg>
);

type Props = {
  // 'login' (default): just redirects to Google. Callback runs the sign-in flow.
  // 'register':        stashes the studio-creation form data alongside the
  //                    OAuth state so the callback can submit it with the code.
  mode?: 'login' | 'register';
  // Called at click time to snapshot the form data before we redirect to
  // Google. Must be synchronous and cheap.
  registerForm?: () => Record<string, any>;
  label?: string;
  disabled?: boolean;
  disabledTitle?: string;
  // Kept in the prop signature for source compatibility with the old
  // useGoogleLogin/GIS variants. No longer called — the callback page owns
  // the credential now. Will be removed once register/page stops passing it.
  onToken?: (...args: any[]) => void;
};

const OAUTH_STATE_KEY_PREFIX = 'sf_oauth_';

function randomStateToken(): string {
  // Prefer crypto.randomUUID where available (all modern browsers); fall back
  // to a Math.random concatenation for ancient environments.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function GoogleSignIn({
  mode = 'login',
  registerForm,
  label,
  disabled = false,
  disabledTitle,
}: Props = {}) {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);

  const isDark = theme === 'dark';
  // Google brand-approved palette pair.
  // https://developers.google.com/identity/branding-guidelines
  const palette = isDark
    ? { bg: '#131314', text: '#E3E3E3', border: '#3C4043', hoverBg: '#1F2122', hoverBorder: '#5F6368' }
    : { bg: '#FFFFFF', text: '#1F1F1F', border: '#DADCE0', hoverBg: '#F8F9FA', hoverBorder: '#C0C4C9' };

  const buttonLabel = label || (mode === 'register' ? 'Sign up with Google' : 'Continue with Google');
  const isDisabled = loading || disabled;

  function startOAuthRedirect() {
    if (isDisabled) return;

    const clientId = (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '').trim();
    if (!clientId) {
      toast.error('Google sign-in is not configured.');
      return;
    }

    // Snapshot context (mode + register form) so the callback knows what to do.
    const stateToken = randomStateToken();
    const stateData = mode === 'register' && registerForm
      ? { mode: 'register', form: registerForm() }
      : { mode: 'login' };
    try {
      sessionStorage.setItem(OAUTH_STATE_KEY_PREFIX + stateToken, JSON.stringify(stateData));
    } catch (_) {
      // sessionStorage can be disabled in some private modes — fail loud so
      // the user retries instead of silently breaking.
      toast.error('Browser storage is disabled. Please enable cookies/storage and try again.');
      return;
    }

    setLoading(true);

    const redirectUri = `${window.location.origin}/auth/google/callback`;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state: stateToken,
      prompt: 'select_account',
      access_type: 'online',
      include_granted_scopes: 'true',
    });

    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  return (
    <button
      type="button"
      onClick={startOAuthRedirect}
      disabled={isDisabled}
      title={disabled && disabledTitle ? disabledTitle : undefined}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        padding: '11px 14px',
        background: palette.bg,
        border: `1.5px solid ${palette.border}`,
        borderRadius: 9,
        fontSize: 15,
        fontWeight: 600,
        color: palette.text,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.55 : 1,
        boxSizing: 'border-box',
        transition: 'background .15s, border-color .15s, box-shadow .15s, opacity .15s',
        letterSpacing: '0.01em',
        fontFamily: 'inherit',
      }}
      onMouseEnter={(e) => {
        if (!isDisabled) {
          const t = e.currentTarget;
          t.style.background = palette.hoverBg;
          t.style.borderColor = palette.hoverBorder;
          t.style.boxShadow = isDark ? '0 1px 6px rgba(0,0,0,0.5)' : '0 1px 6px rgba(0,0,0,0.12)';
        }
      }}
      onMouseLeave={(e) => {
        const t = e.currentTarget;
        t.style.background = palette.bg;
        t.style.borderColor = palette.border;
        t.style.boxShadow = 'none';
      }}
    >
      {!loading && <GoogleIcon />}
      {loading ? 'Redirecting…' : buttonLabel}
    </button>
  );
}
