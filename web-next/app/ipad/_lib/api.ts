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

const PROD_API = 'https://abcd-danceclass-production.up.railway.app/api';
const API_URL = (process.env.NEXT_PUBLIC_API_URL?.trim())
  || (process.env.NODE_ENV === 'production' ? PROD_API : 'http://localhost:5000/api');

export const IPAD_TOKEN_KEY = 'sf_ipad_token';
export const IPAD_USER_KEY = 'sf_ipad_user';
export const IPAD_SCHOOL_KEY = 'sf_ipad_school';

export function getIpadToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(IPAD_TOKEN_KEY);
}

export function setIpadSession(token: string, user: any, school: any | null) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(IPAD_TOKEN_KEY, token);
  localStorage.setItem(IPAD_USER_KEY, JSON.stringify(user));
  if (school) localStorage.setItem(IPAD_SCHOOL_KEY, JSON.stringify(school));
}

export function clearIpadSession() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(IPAD_TOKEN_KEY);
  localStorage.removeItem(IPAD_USER_KEY);
  localStorage.removeItem(IPAD_SCHOOL_KEY);
}

export function getIpadUser(): any | null {
  if (typeof window === 'undefined') return null;
  try { return JSON.parse(localStorage.getItem(IPAD_USER_KEY) || 'null'); } catch { return null; }
}

export function getIpadSchool(): any | null {
  if (typeof window === 'undefined') return null;
  try { return JSON.parse(localStorage.getItem(IPAD_SCHOOL_KEY) || 'null'); } catch { return null; }
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
