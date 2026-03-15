import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const inputStyle = {
  width: '100%',
  background: '#fff',
  border: '1.5px solid #d0d0d0',
  borderRadius: 9,
  padding: '11px 14px',
  fontSize: 15,
  color: '#111',
  boxSizing: 'border-box',
  outline: 'none',
  /* Override mobile autofill orange/yellow tint */
  WebkitBoxShadow: '0 0 0px 1000px #fff inset',
  WebkitTextFillColor: '#111',
};

export default function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  if (user) { navigate('/'); return null; }

  const handle = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      const u = await login(form.email, form.password);
      toast.success(`Welcome back, ${u.name}!`);
      navigate('/');
    } catch (err) {
      const msg = err?.error || err?.message || (typeof err === 'string' ? err : 'Login failed. Please check your credentials.');
      toast.error(msg);
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ fontSize: 48, marginBottom: 10 }}>🩰</div>
          <h1 style={{ fontFamily: 'var(--font-d)', fontSize: 28, color: '#fff', marginBottom: 6, letterSpacing: '-0.5px' }}>ManchQ</h1>
          <p style={{ color: '#888', fontSize: 13, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Dance School Management</p>
        </div>

        {/* Card */}
        <div style={{ background: '#fff', borderRadius: 16, padding: 32, boxShadow: '0 0 0 1px rgba(255,255,255,0.08)' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 24, color: '#111' }}>Sign in to your account</h2>

          <form onSubmit={handle}>
            {/* Email */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#555', marginBottom: 6 }}>Email</label>
              <input
                type="email"
                required
                autoComplete="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="you@example.com"
                style={inputStyle}
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#555', marginBottom: 6 }}>Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPw ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  style={{ ...inputStyle, paddingRight: 44 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(p => !p)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#888', display: 'flex', alignItems: 'center' }}
                >
                  {showPw
                    ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  }
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{ width: '100%', padding: '13px', background: loading ? '#555' : '#111', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', letterSpacing: '0.01em' }}
            >
              {loading ? 'Signing in…' : 'Sign In →'}
            </button>
          </form>

          {/* Demo hint */}
          <div style={{ marginTop: 20, padding: 14, background: '#f5f5f5', borderRadius: 10, fontSize: 12, color: '#666', borderLeft: '3px solid #ddd' }}>
            <div style={{ fontWeight: 700, marginBottom: 6, color: '#333' }}>Test accounts</div>
            <div style={{ marginBottom: 2 }}>sv@gmail.com / School123! <span style={{color:'#999'}}>(Nritya Vahini)</span></div>
            <div style={{ marginBottom: 2 }}>vinitha@sankalpa.com / Sankalpa123! <span style={{color:'#999'}}>(Sankalpa)</span></div>
            <div>parent@rhythmgrace.com / Parent123!</div>
          </div>
        </div>
      </div>
    </div>
  );
}
