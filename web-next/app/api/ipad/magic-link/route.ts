// /api/ipad/magic-link — Next.js POST proxy that forwards to the backend's
// /api/ipad/magic-link endpoint.
//
// Mirrors the existing /api/auth/magic-link route. Purpose: native-form
// fallback when React's onSubmit isn't fully wired on iPad WebKit during
// hydration. The /ipad/login form has action="/api/ipad/magic-link"
// method="POST"; if JS handles the submit first, it preventDefaults and this
// route is never hit. If it doesn't, the browser posts here and we relay.

import { NextRequest, NextResponse } from 'next/server';

const PROD_API = 'https://abcd-danceclass-production.up.railway.app/api';
const API_URL = (process.env.NEXT_PUBLIC_API_URL?.trim())
  || (process.env.NODE_ENV === 'production' ? PROD_API : 'http://localhost:5000/api');

export async function POST(req: NextRequest) {
  const origin = req.nextUrl.origin;
  let email = '';

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
    return NextResponse.redirect(`${origin}/ipad/login?error=invalid-email`, { status: 303 });
  }

  try {
    const res = await fetch(`${API_URL}/ipad/magic-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      return NextResponse.redirect(`${origin}/ipad/login?error=send-failed`, { status: 303 });
    }
  } catch (_) {
    return NextResponse.redirect(`${origin}/ipad/login?error=network`, { status: 303 });
  }

  return NextResponse.redirect(`${origin}/ipad/login?sent=${encodeURIComponent(email)}`, { status: 303 });
}
