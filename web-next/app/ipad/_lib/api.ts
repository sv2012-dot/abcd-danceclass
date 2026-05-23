// Isolated API client for the /ipad demo replica.
//
// Why a separate client (not the main lib/api):
//   - The /ipad token lives under a DIFFERENT localStorage key (sf_ipad_token)
//     so signing in on /ipad doesn't touch the main app's session and vice
//     versa. A bug in one can't corrupt the other.
//   - No interceptors for limit-reached / smart-usage events / 401 redirects —
//     /ipad does its own simple redirect on 401, no global event bus.
//   - No portals / global modals are wired here, so we don't import the heavy
//     axios setup from lib/api/client.ts.
//
// iOS hardening:
//   - All localStorage access is wrapped in try/catch. iOS Private Browsing
//     mode throws QuotaExceededError on every setItem; without the guard the
//     login flow would crash silently. iOS can also wipe localStorage when
//     storage pressure is high — readers tolerate null returns.

const PROD_API = 'https://abcd-danceclass-production.up.railway.app/api';
const API_URL = (process.env.NEXT_PUBLIC_API_URL?.trim())
  || (process.env.NODE_ENV === 'production' ? PROD_API : 'http://localhost:5000/api');

export const IPAD_TOKEN_KEY = 'sf_ipad_token';
export const IPAD_USER_KEY = 'sf_ipad_user';
export const IPAD_SCHOOL_KEY = 'sf_ipad_school';

// ── Safe storage helpers ──────────────────────────────────────────────
// iOS Private Browsing makes localStorage.setItem throw. Reads can also
// return null silently after the OS evicts the origin's storage. Wrap
// everything so the /ipad flow degrades gracefully instead of crashing.

function safeGet(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try { return window.localStorage.getItem(key); } catch { return null; }
}

function safeSet(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(key, value); } catch { /* Private Browsing or quota — ignore */ }
}

function safeRemove(key: string): void {
  if (typeof window === 'undefined') return;
  try { window.localStorage.removeItem(key); } catch { /* ignore */ }
}

export function getIpadToken(): string | null {
  return safeGet(IPAD_TOKEN_KEY);
}

export function setIpadSession(token: string, user: any, school: any | null) {
  safeSet(IPAD_TOKEN_KEY, token);
  safeSet(IPAD_USER_KEY, JSON.stringify(user));
  if (school) safeSet(IPAD_SCHOOL_KEY, JSON.stringify(school));
}

export function clearIpadSession() {
  safeRemove(IPAD_TOKEN_KEY);
  safeRemove(IPAD_USER_KEY);
  safeRemove(IPAD_SCHOOL_KEY);
}

export function getIpadUser(): any | null {
  const v = safeGet(IPAD_USER_KEY);
  if (!v) return null;
  try { return JSON.parse(v); } catch { return null; }
}

export function getIpadSchool(): any | null {
  const v = safeGet(IPAD_SCHOOL_KEY);
  if (!v) return null;
  try { return JSON.parse(v); } catch { return null; }
}

// Minimal fetch wrapper — uses native fetch (no axios) so we keep the bundle
// small and avoid any of the global interceptor behaviour from lib/api/client.
export async function ipadFetch(path: string, init: RequestInit = {}) {
  const token = getIpadToken();
  const headers = new Headers(init.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  const text = await res.text();
  const data = text ? safeParse(text) : null;
  if (!res.ok) {
    const err: any = new Error((data && data.error) || res.statusText || 'Request failed');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function safeParse(s: string) { try { return JSON.parse(s); } catch { return s; } }

// Auth endpoints — kept tiny and explicit.
export const ipadAuth = {
  requestMagicLink: (email: string) =>
    ipadFetch('/ipad/magic-link', { method: 'POST', body: JSON.stringify({ email }) }),
  // Reuses the existing consume endpoint — magic_tokens table is shared.
  consumeMagicLink: (token: string) =>
    ipadFetch('/auth/magic-link/consume', { method: 'POST', body: JSON.stringify({ token }) }),
  chooseSchool: (chooser_token: string, school_id: number) =>
    ipadFetch('/auth/choose-school', { method: 'POST', body: JSON.stringify({ chooser_token, school_id }) }),
  me: () => ipadFetch('/auth/me'),
};
