// /auth/google/callback — server-rendered OAuth callback handler.
//
// Pure inline <script> that runs on parse, regardless of React hydration.
// On success: writes session to localStorage and redirects to /home.
// On error:   redirects to /login?error=<message> so the verbose toast
//             on /login shows the actual backend cause.
//
// No DOM mutation after the script's initial run — React's hydration was
// resetting our textContent changes on the spinner, which made errors
// invisible. Redirecting with the error in the URL avoids the conflict.

import { Suspense } from 'react';

const PROD_API = 'https://abcd-danceclass-production.up.railway.app/api';
const API_URL = (process.env.NEXT_PUBLIC_API_URL?.trim()) || PROD_API;

function buildInlineScript() {
  return `
(function () {
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

    var stateData = null;
    var cookieValue = readCookie(STATE_KEY + state);
    if (cookieValue) {
      try { stateData = JSON.parse(cookieValue); } catch (e) {
        console.warn('[google-callback] cookie parse failed', e);
      }
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

    console.log('[google-callback] POST', endpoint, 'mode:', stateData.mode);

    var res, data;
    try {
      res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      try { data = await res.json(); } catch (_) { data = {}; }
    } catch (e) {
      console.error('[google-callback] network error', e);
      go('/login?error=network');
      return;
    }

    console.log('[google-callback] response', res.status, data);

    if (res.ok && data.token) {
      try {
        localStorage.setItem('sf_token', data.token);
        if (data.user) localStorage.setItem('sf_user', JSON.stringify(data.user));
        if (data.school) localStorage.setItem('sf_school', JSON.stringify(data.school));
      } catch (e) {
        console.warn('[google-callback] localStorage write failed', e);
      }
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

    // Surface the actual backend error in the URL so /login's toast can show
    // it verbatim ("Sign-in failed: <error>") instead of a generic message.
    var msg = (data && data.error) ? data.error : ('HTTP ' + res.status);
    go('/login?error=' + encodeURIComponent(msg));
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
          background: '#0a0a0f',
          color: '#f5f5f7',
          fontFamily: 'var(--font-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}
      >
        <div
          aria-hidden
          style={{
            width: 36,
            height: 36,
            border: '3px solid rgba(255,255,255,0.08)',
            borderTopColor: '#7C3AED',
            borderRadius: '50%',
            animation: 'sf-cb-spin 0.8s linear infinite',
          }}
        />
        <div style={{ fontSize: 14, color: '#9ca3af' }}>Completing sign-in…</div>
        <style
          dangerouslySetInnerHTML={{
            __html: '@keyframes sf-cb-spin { to { transform: rotate(360deg); } }',
          }}
        />
        <script dangerouslySetInnerHTML={{ __html: buildInlineScript() }} />
      </div>
    </Suspense>
  );
}
