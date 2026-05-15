import axios from 'axios';

const PROD_API = 'https://abcd-danceclass-production.up.railway.app/api';
// Trim defensively — Vercel env vars have been seen to ship with stray \n
// suffixes that silently break URL concatenation.
const API_URL = (process.env.NEXT_PUBLIC_API_URL?.trim())
  || (process.env.NODE_ENV === 'production' ? PROD_API : 'http://localhost:5000/api');

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
});

// Request interceptor: add auth token if available (client-side only)
if (typeof window !== 'undefined') {
  api.interceptors.request.use(config => {
    // localStorage primary (survives iOS Safari backgrounding) + session
    // fallback for any legacy in-flight sessions issued before the switch.
    const token = localStorage.getItem('sf_token') || sessionStorage.getItem('sf_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  api.interceptors.response.use(
    res => {
      // Capture rate-limit headers from Smart ManchQ routes so the modals can
      // show a usage counter footer. express-rate-limit (standardHeaders:true)
      // emits "ratelimit-remaining" / "ratelimit-limit" / "ratelimit-reset".
      const url: string = res.config?.url || '';
      if (url.startsWith('/smart/') || url.includes('/api/smart/')) {
        const h = res.headers || {};
        const remaining = Number(h['ratelimit-remaining'] ?? h['x-ratelimit-remaining']);
        const limit = Number(h['ratelimit-limit'] ?? h['x-ratelimit-limit']);
        const reset = Number(h['ratelimit-reset'] ?? h['x-ratelimit-reset']);
        if (Number.isFinite(remaining) && Number.isFinite(limit)) {
          window.dispatchEvent(new CustomEvent('sf:smart-usage', {
            detail: { remaining, limit, resetInSeconds: reset || null },
          }));
        }
      }
      return res.data;
    },
    err => {
      // Capture rate-limit headers even on 429 so the modal updates to 0
      const url: string = err.config?.url || '';
      if ((url.startsWith('/smart/') || url.includes('/api/smart/')) && err.response?.headers) {
        const h = err.response.headers;
        const remaining = Number(h['ratelimit-remaining'] ?? h['x-ratelimit-remaining']);
        const limit = Number(h['ratelimit-limit'] ?? h['x-ratelimit-limit']);
        if (Number.isFinite(remaining) && Number.isFinite(limit)) {
          window.dispatchEvent(new CustomEvent('sf:smart-usage', {
            detail: { remaining, limit, resetInSeconds: null },
          }));
        }
      }
      if (err.response?.status === 401) {
        // Best-effort logging so we can debug auth bounces in production.
        try {
          const log = JSON.parse(localStorage.getItem('sf_debug_401') || '[]');
          log.push({
            ts: new Date().toISOString(),
            url: err.config?.url,
            method: err.config?.method,
            status: err.response?.status,
            data: err.response?.data,
            path: typeof window !== 'undefined' ? window.location.pathname : '',
          });
          localStorage.setItem('sf_debug_401', JSON.stringify(log.slice(-20)));
        } catch (_) { /* ignore */ }

        // Notify AuthContext so it can clear React state and let the route
        // guards redirect through React (no full page reload — that wipes
        // post-Google-login state mid-flow and causes the bounce loop).
        window.dispatchEvent(new CustomEvent('sf:unauthorized', {
          detail: { url: err.config?.url, status: err.response?.status },
        }));
      }
      return Promise.reject(err.response?.data || err);
    }
  );
}

export default api;
