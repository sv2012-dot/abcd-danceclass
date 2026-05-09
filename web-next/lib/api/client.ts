import axios from 'axios';

const PROD_API = 'https://abcd-danceclass-production.up.railway.app/api';
const API_URL = process.env.NEXT_PUBLIC_API_URL
  || (process.env.NODE_ENV === 'production' ? PROD_API : 'http://localhost:5000/api');

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
});

// Request interceptor: add auth token if available (client-side only)
if (typeof window !== 'undefined') {
  api.interceptors.request.use(config => {
    const token = sessionStorage.getItem('sf_token') || localStorage.getItem('sf_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  api.interceptors.response.use(
    res => res.data,
    err => {
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
