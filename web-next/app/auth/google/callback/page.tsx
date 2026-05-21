// /auth/google/callback — server-rendered OAuth callback handler.
//
// This page is intentionally a Server Component with no React hydration
// dependency. The OAuth code → token exchange runs as plain inline JS,
// which executes on parse regardless of whether React hydrates. This
// fixes the iPad / iOS WebKit issue where React's onClick / useEffect
// silently fail to attach, which previously left users stuck on
// "Completing sign-in…".
//
// Flow:
//   1. GoogleSignIn POSTs to /api/auth/google/start
//   2. /api/auth/google/start sets `sf_oauth_<state>` cookie with
//      { mode, form? } and redirects to Google
//   3. Google sends user back here with ?code=...&state=...
//   4. Inline <script> reads cookie + URL params, POSTs to backend,
//      writes session to localStorage, then redirects to /home
//      (or /register?googleData=... / /auth/choose-school / etc.)

import { Suspense } from 'react';

const PROD_API = 'https://abcd-danceclass-production.up.railway.app/api';
const API_URL = (process.env.NEXT_PUBLIC_API_URL?.trim()) || PROD_API;

function buildInlineScript() {
  // Anything that needs to be substituted from server-side must be
  // JSON.stringified for safe embedding. Plain `${variable}` strings here
  // are interpolated server-side at build time; the rest is plain JS that
  // runs in the browser.
  return `
(function () {
  // Run as soon as the script is parsed — don't wait for DOMContentLoaded
  // or any framework lifecycle. Heavy work goes inside an async IIFE.
  (async function () {
    var API_URL = ${JSON.stringify(API_URL)};
    var STATE_KEY = 'sf_oauth_';

    function getParam(name) {
      var m = new RegExp('[?&]' + name + '=([^&]+)').exec(location.search);
      return m ? decodeURIComponent(m[1].replace(/\\+/g, ' ')) : null;
    }
    function readCookie(name) {
      var parts = document.cookie.split(';');
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i].trim();
        if (p.indexOf(name + '=') === 0) {
          return decodeURIComponent(p.substring(name.length + 1));
        }
      }
      return null;
    }
    function clearCookie(name) {
      document.cookie = name + '=; Path=/; Max-Age=0; SameSite=Lax';
    }
    function go(url) { location.replace(url); }

    var code = getParam('code');
    var state = getParam('state');
    var oauthError = getParam('error');

    if (oauthError) {
      go('/login?error=' + encodeURIComponent('google-' + oauthError));
      return;
    }
    if (!code || !state) {
      go('/login?error=missing-params');
      return;
    }

    // State data lookup — cookie first (set by /api/auth/google/start),
    // sessionStorage as legacy fallback.
    var stateData = null;
    var cookieValue = readCookie(STATE_KEY + state);
    if (cookieValue) {
      try { stateData = JSON.parse(cookieValue); } catch (_) {}
      clearCookie(STATE_KEY + state);
    }
    if (!stateData) {
      try {
        var raw = sessionStorage.getItem(STATE_KEY + state);
        if (raw) {
          stateData = JSON.parse(raw);
          sessionStorage.removeItem(STATE_KEY + state);
        }
      } catch (_) {}
    }
    if (!stateData) {
      go('/login?error=state-expired');
      return;
    }

    var redirectUri = location.origin + '/auth/google/callback';
    var endpoint, payload;

    if (stateData.mode === 'register' && stateData.form) {
      endpoint = API_URL + '/auth/register-school';
      payload = Object.assign({}, stateData.form, {
        google_code: code,
        google_redirect_uri: redirectUri,
      });
    } else {
      endpoint = API_URL + '/auth/google';
      payload = { code: code, redirect_uri: redirectUri };
    }

    var res, data;
    try {
      res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      data = await res.json();
    } catch (e) {
      go('/login?error=network');
      return;
    }

    if (res.ok && data.token) {
      try {
        localStorage.setItem('sf_token', data.token);
        if (data.user) localStorage.setItem('sf_user', JSON.stringify(data.user));
        if (data.school) localStorage.setItem('sf_school', JSON.stringify(data.school));
      } catch (_) {}
      go('/home');
      return;
    }
    if (res.ok && data.requires_choice && data.chooser_token) {
      try {
        sessionStorage.setItem('sf_pending_chooser', JSON.stringify({
          chooser_token: data.chooser_token,
          memberships: data.memberships || [],
          user: data.user,
        }));
      } catch (_) {}
      go('/auth/choose-school');
      return;
    }
    if (res.ok && data.requiresRegistration) {
      go('/register?googleData=' + encodeURIComponent(JSON.stringify(data.googleData)));
      return;
    }
    if (data && data.existing_user) {
      try {
        sessionStorage.setItem('sf_pending_existing_user', JSON.stringify({
          email: data.email,
          schools: data.schools || [],
        }));
      } catch (_) {}
      go('/register?existing=1');
      return;
    }
    go('/login?error=' + encodeURIComponent((data && data.error) || 'sign-in-failed'));
  })();
})();
`.trim();
}

export default function GoogleCallbackPage() {
  return (
    <Suspense fallback={null}>
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
          aria-hidden
          style={{
            width: 36,
            height: 36,
            border: '3px solid var(--border)',
            borderTopColor: 'var(--primary)',
            borderRadius: '50%',
            animation: 'sf-cb-spin 0.8s linear infinite',
          }}
        />
        <div style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>Completing sign-in…</div>
        <style
          dangerouslySetInnerHTML={{ __html: '@keyframes sf-cb-spin { to { transform: rotate(360deg); } }' }}
        />
        <script dangerouslySetInnerHTML={{ __html: buildInlineScript() }} />
      </div>
    </Suspense>
  );
}
