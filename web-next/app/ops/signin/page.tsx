// /ops/signin — hidden password sign-in
//
// Why this exists alongside /login:
//   /login is magic-link-only by design (public, polished UX).
//   This page is for ops / superadmin recovery: when email delivery
//   is down, or when you need to sign in without round-tripping
//   through your inbox, hit this URL directly and use the password
//   you set on your account.
//
// Hidden by design:
//   - Not linked from any nav, footer, /login, or marketing page
//   - export const metadata.robots = { index: false, follow: false }
//   - /app/robots.ts also disallows /ops/ for any crawler that
//     ignores the meta tag
//
// Security note:
//   This is NOT a security feature — it's password auth living at a
//   non-obvious URL. The real protection is the password itself
//   (bcrypt-hashed on the backend). Anyone who finds the URL still
//   needs a valid email + password to sign in.

import type { Metadata } from 'next';
import OpsSignInClient from './client';

export const metadata: Metadata = {
  title: 'Ops Sign-in',
  // Belt-and-suspenders: meta robots + /app/robots.ts both block
  // crawlers. Most respectful bots honor either; both is safest.
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

export default function OpsSignInPage() {
  return <OpsSignInClient />;
}
