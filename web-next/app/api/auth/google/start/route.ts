// /api/auth/google/start — server-side entry for the Google OAuth flow.
//
// Why this exists: previously the OAuth URL was built client-side in
// GoogleSignIn's useEffect. That depends on React hydration completing,
// which fails on some iPad / iOS WebKit configurations. By moving URL
// construction to a Next.js route handler, the flow works without any
// JavaScript on the client — the browser POSTs the form natively, this
// handler responds with a 303 redirect, the browser follows to Google.
//
// Behaviour:
//   - POST { mode: 'login' | 'register', + optional studio form fields }
//   - Generates a random state token
//   - Stores { mode, form? } in a short-lived cookie keyed by the token
//   - Redirects (303) to Google's OAuth URL with state=<token>
//
// The /auth/google/callback page reads the state from the URL, looks the
// stashed data up (cookie OR sessionStorage for back-compat), then exchanges
// the auth code with our backend.

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

const OAUTH_COOKIE_PREFIX = 'sf_oauth_';
const STATE_TTL_SECONDS = 600; // 10 minutes — plenty for the round-trip

export async function POST(req: NextRequest) {
  const origin = req.nextUrl.origin;

  // Accept form-encoded (native HTML submit) or JSON.
  let mode: string = 'login';
  let form: Record<string, string> = {};
  const contentType = req.headers.get('content-type') || '';

  try {
    if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
      const fd = await req.formData();
      mode = String(fd.get('mode') || 'login');
      for (const [k, v] of fd.entries()) {
        if (k === 'mode') continue;
        // Skip files / CSRF / framework fields
        if (typeof v !== 'string') continue;
        form[k] = v;
      }
    } else {
      const body = await req.json().catch(() => ({}));
      mode = String(body.mode || 'login');
      form = { ...body };
      delete (form as any).mode;
    }
  } catch (_) { /* fall through with defaults */ }

  if (mode !== 'login' && mode !== 'register') mode = 'login';

  const clientId = (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '').trim();
  if (!clientId) {
    return NextResponse.redirect(`${origin}/login?error=oauth-misconfigured`, { status: 303 });
  }

  const stateToken = randomUUID();
  const stateData = mode === 'register' ? { mode, form } : { mode };

  const redirectUri = `${origin}/auth/google/callback`;
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

  const googleUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  const res = NextResponse.redirect(googleUrl, { status: 303 });

  // Stash the state data in a cookie. Non-HttpOnly because the callback
  // page reads it via document.cookie. SameSite=Lax so it survives the
  // cross-site redirect back from Google. Short TTL.
  //
  // IMPORTANT: pass the JSON string raw. Next.js's cookies.set()
  // URL-encodes the value automatically — wrapping it in
  // encodeURIComponent here previously produced a double-encoded cookie
  // that JSON.parse() couldn't read on the callback side, which made
  // every sign-in attempt fail with "Sign-in state expired".
  res.cookies.set({
    name: OAUTH_COOKIE_PREFIX + stateToken,
    value: JSON.stringify(stateData),
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: STATE_TTL_SECONDS,
  });

  return res;
}
