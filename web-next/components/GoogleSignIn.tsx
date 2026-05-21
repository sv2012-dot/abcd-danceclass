'use client';

// Google sign-in button — uses OAuth 2.0 authorization code flow with a
// full-page redirect (NOT a popup, NOT GIS iframe).
//
// Renders as a native <a href={oauthUrl}> styled to look like a button. This
// is critical for iPad Chrome / iOS WebKit, where React's onClick handlers
// sometimes fail to attach during hydration but native <a href> always
// navigates. URL is built once on mount and stays stable; for register mode
// the latest form snapshot is mirrored into sessionStorage on every form
// change, so the OAuth callback always has fresh data even if no JS fires
// at click time.

import { useEffect, useRef, useState } from 'react';
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
  // 'login' (default): just redirects to Google. Callback runs sign-in flow.
  // 'register':        stashes the studio-creation form data alongside the
  //                    OAuth state so the callback can submit it with the code.
  mode?: 'login' | 'register';
  // For register mode — the live form state to mirror into sessionStorage.
  // GoogleSignIn keeps the stash in sync as the form changes.
  formData?: Record<string, any>;
  // Legacy snapshot callback — still accepted for source compatibility, but
  // the formData prop is the recommended path now (works without JS onClick).
  registerForm?: () => Record<string, any>;
  label?: string;
  disabled?: boolean;
  disabledTitle?: string;
  // Kept for source compatibility with older variants; no longer called.
  onToken?: (...args: any[]) => void;
};

const OAUTH_STATE_KEY_PREFIX = 'sf_oauth_';

function randomStateToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function GoogleSignIn({
  mode = 'login',
  formData,
  registerForm,
  label,
  disabled = false,
  disabledTitle,
}: Props = {}) {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);

  // OAuth URL is built once on mount — needs window.location.origin so can't
  // be a render-time constant. Until it's ready, the <a> renders with an
  // intentionally inert href so accidental early taps no-op cleanly.
  const [oauthUrl, setOauthUrl] = useState<string>('#');
  const stateTokenRef = useRef<string>('');

  const isDark = theme === 'dark';
  const palette = isDark
    ? { bg: '#131314', text: '#E3E3E3', border: '#3C4043', hoverBg: '#1F2122', hoverBorder: '#5F6368' }
    : { bg: '#FFFFFF', text: '#1F1F1F', border: '#DADCE0', hoverBg: '#F8F9FA', hoverBorder: '#C0C4C9' };

  const buttonLabel = label || (mode === 'register' ? 'Sign up with Google' : 'Continue with Google');
  const isDisabled = loading || disabled;

  // Build the OAuth URL + initial sessionStorage stash on mount. Stays
  // stable for the lifetime of the component (one state token per page
  // visit). Re-stashing on data change happens in the next effect.
  useEffect(() => {
    const clientId = (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '').trim();
    if (!clientId) {
      // Leave the URL inert; click handler will toast.
      return;
    }
    const stateToken = randomStateToken();
    stateTokenRef.current = stateToken;
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
    // Initial stash. For register mode this includes the current snapshot
    // of formData (or registerForm() if formData prop isn't passed).
    let stateData: any = { mode: 'login' };
    if (mode === 'register') {
      const initialForm = formData ?? (registerForm ? registerForm() : {});
      stateData = { mode: 'register', form: initialForm };
    }
    try {
      sessionStorage.setItem(OAUTH_STATE_KEY_PREFIX + stateToken, JSON.stringify(stateData));
    } catch (_) {
      // sessionStorage disabled — let the click toast take over.
    }
    setOauthUrl(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount only — state token shouldn't churn

  // Mirror live form data into sessionStorage so the OAuth callback always
  // sees the latest values, even though we built the URL on mount.
  useEffect(() => {
    if (mode !== 'register') return;
    if (!stateTokenRef.current) return;
    if (!formData) return;
    try {
      sessionStorage.setItem(
        OAUTH_STATE_KEY_PREFIX + stateTokenRef.current,
        JSON.stringify({ mode: 'register', form: formData }),
      );
    } catch (_) {}
  }, [mode, formData]);

  // Click handler — runs on devices where React onClick works (most). On
  // iPad where it doesn't, the <a href> handles navigation natively.
  // We only use this to (a) block disabled state, (b) show the "Redirecting…"
  // visual hint, and (c) toast if the OAuth URL wasn't built.
  const onClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (isDisabled) {
      e.preventDefault();
      return;
    }
    if (oauthUrl === '#') {
      e.preventDefault();
      toast.error('Google sign-in is not configured.');
      return;
    }
    setLoading(true);
    // Don't preventDefault — let the browser follow href to Google.
  };

  // Render an <a> styled identically to the previous <button>. Browser
  // handles navigation natively, so iPad Chrome / iOS WebKit works even
  // when React's onClick wouldn't fire.
  return (
    <a
      href={oauthUrl}
      onClick={onClick}
      title={disabled && disabledTitle ? disabledTitle : undefined}
      aria-disabled={isDisabled || undefined}
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
        textDecoration: 'none',
        // Prevent iOS Safari from interpreting the tap as a long-press preview.
        WebkitTouchCallout: 'none',
        userSelect: 'none',
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
    </a>
  );
}
