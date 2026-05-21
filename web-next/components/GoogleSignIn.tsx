'use client';

// Google sign-in button — uses OAuth 2.0 authorization code flow with a
// full-page redirect. Rendered as a native HTML <form> that POSTs to
// /api/auth/google/start; the Next.js route there generates the OAuth state
// token, sets a short-lived cookie with any registration form data, and
// redirects the browser to Google.
//
// Why a form (not an <a href>)?
// React hydration sometimes fails on iPad / iOS WebKit. Anything that depends
// on useEffect (e.g. building the OAuth URL on mount) is then a dead button.
// A native <form action="..." method="post"> works with zero JS — browser
// POSTs, server redirects, user lands on Google. Progressive enhancement:
// JS users get the same behaviour with the same fast UX; non-JS users get
// the same outcome.

import { useState } from 'react';
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
  // 'login' (default): standalone form, no extra data needed.
  // 'register':       hidden inputs mirror the studio form for the OAuth
  //                   callback to find after the Google round-trip.
  mode?: 'login' | 'register';
  // For register mode — current form values to send along with the OAuth
  // start request. Rendered as hidden inputs inside the form.
  formData?: Record<string, any>;
  // Legacy snapshot callback. No longer used; kept in the prop signature
  // for source compatibility.
  registerForm?: () => Record<string, any>;
  label?: string;
  disabled?: boolean;
  disabledTitle?: string;
  // Legacy kept for source compatibility.
  onToken?: (...args: any[]) => void;
};

export default function GoogleSignIn({
  mode = 'login',
  formData,
  label,
  disabled = false,
  disabledTitle,
}: Props = {}) {
  const { theme } = useTheme();
  const [submitting, setSubmitting] = useState(false);

  const isDark = theme === 'dark';
  // Google brand-approved palette. https://developers.google.com/identity/branding-guidelines
  const palette = isDark
    ? { bg: '#131314', text: '#E3E3E3', border: '#3C4043', hoverBg: '#1F2122', hoverBorder: '#5F6368' }
    : { bg: '#FFFFFF', text: '#1F1F1F', border: '#DADCE0', hoverBg: '#F8F9FA', hoverBorder: '#C0C4C9' };

  const buttonLabel = label || (mode === 'register' ? 'Sign up with Google' : 'Continue with Google');
  const isDisabled = submitting || disabled;

  // Light visual feedback on submit. Form still POSTs natively even if
  // this handler doesn't fire (e.g. React not hydrated on iPad).
  const onSubmit = () => {
    if (isDisabled) return;
    setSubmitting(true);
  };

  // Studio form fields (register mode). Empty strings if absent — backend
  // can validate. The keys mirror what /api/auth/google/start expects.
  const hiddenFields = mode === 'register' ? {
    ownerName:  formData?.ownerName  ?? '',
    schoolName: formData?.schoolName ?? '',
    city:       formData?.city       ?? '',
    danceStyle: formData?.danceStyle ?? '',
  } : null;

  return (
    <form
      action="/api/auth/google/start"
      method="post"
      onSubmit={onSubmit}
      style={{ margin: 0, width: '100%' }}
    >
      <input type="hidden" name="mode" value={mode} />
      {hiddenFields && Object.entries(hiddenFields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={String(v ?? '')} />
      ))}
      <button
        type="submit"
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
        {!submitting && <GoogleIcon />}
        {submitting ? 'Redirecting…' : buttonLabel}
      </button>
    </form>
  );
}
