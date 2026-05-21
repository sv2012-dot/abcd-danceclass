// /api/auth/magic-link — Next.js route handler that proxies the magic-link
// request to the backend.
//
// Purpose: native form-submission fallback for iPad Chrome where React's
// onSubmit may not fire (event delegation broken on iOS WebKit hydration).
// When JS works, the login page intercepts the form submission via React
// onSubmit and skips this route entirely. When JS doesn't fire, the browser
// posts here natively; we relay to the backend and redirect back to /login
// with a state param that tells the page to render the "check your inbox"
// view.

import { NextRequest, NextResponse } from 'next/server';

const PROD_API = 'https://abcd-danceclass-production.up.railway.app/api';
const API_URL = (process.env.NEXT_PUBLIC_API_URL?.trim())
  || (process.env.NODE_ENV === 'production' ? PROD_API : 'http://localhost:5000/api');

export async function POST(req: NextRequest) {
  const origin = req.nextUrl.origin;
  let email = '';

  // Accept either form-encoded (native HTML submit) or JSON bodies.
  const contentType = req.headers.get('content-type') || '';
  try {
    if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
      const fd = await req.formData();
      email = String(fd.get('email') || '').trim();
    } else {
      const body = await req.json().catch(() => ({}));
      email = String(body.email || '').trim();
    }
  } catch (_) { /* fall through */ }

  if (!email || !email.includes('@')) {
    return NextResponse.redirect(`${origin}/login?error=invalid-email`, { status: 303 });
  }

  try {
    const res = await fetch(`${API_URL}/auth/magic-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      return NextResponse.redirect(`${origin}/login?error=send-failed`, { status: 303 });
    }
  } catch (_) {
    return NextResponse.redirect(`${origin}/login?error=network`, { status: 303 });
  }

  // Success — redirect back to /login with the email in a query param so the
  // page can render the "check your inbox" state without losing context.
  return NextResponse.redirect(`${origin}/login?sent=${encodeURIComponent(email)}`, { status: 303 });
}
