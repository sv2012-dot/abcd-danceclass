import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const inputStyle = {
  width: '100%',
  background: 'var(--surface)',
  border: '1.5px solid var(--border)',
  borderRadius: 9,
  padding: '11px 14px',
  fontSize: 15,
  color: 'var(--text)',
  boxSizing: 'border-box',
  outline: 'none',
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
          <div style={{ marginBottom: 14, display:'flex', justifyContent:'center' }}>
            <button onClick={() => navigate('/')} style={{ background:'none', border:'none', cursor:'pointer', padding:0, borderRadius:'50%', display:'flex' }} title="Go to homepage">
              <img src="/ManchQ-Logo.png" alt="ManchQ" style={{ width:80, height:80, borderRadius:'50%', display:'block' }} />
            </button>
          </div>
          <h1 style={{ fontFamily: 'var(--font-d)', fontSize: 28, color: '#fff', marginBottom: 6, letterSpacing: '-0.5px' }}>ManchQ</h1>
          <p style={{ color: '#888', fontSize: 13, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Dance School Management</p>
        </div>

        {/* Card */}
        <div style={{ background: 'var(--card)', borderRadius: 16, padding: 32, boxShadow: '0 0 0 1px rgba(255,255,255,0.08)' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 24, color: 'var(--text)' }}>Sign in to your account</h2>

          <form onSubmit={handle}>
            {/* Email */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>Email</label>
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
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>Password</label>
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
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--muted)', display: 'flex', alignItems: 'center' }}
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
          <div style={{ marginTop: 20, padding: 14, background: 'var(--surface)', borderRadius: 10, fontSize: 12, color: 'var(--muted)', borderLeft: '3px solid var(--border)' }}>
            <div style={{ fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>Demo Accounts</div>
            {[
              { label: 'teacher@manchq.com', pw: 'School123!', note: 'Demo Academy' },
              { label: 'parent@manchq.com',  pw: 'Parent123!', note: 'Parent view'  },
            ].map(({ label, pw, note }) => (
              <button key={label} type="button" onClick={() => setForm({ email: label, password: pw })}
                style={{ display:'block', width:'100%', textAlign:'left', background:'none', border:'none', cursor:'pointer', padding:'4px 0', color:'var(--muted)', fontSize:12, lineHeight:1.5 }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--muted)'}
              >
                <span style={{ color:'var(--text)', fontWeight:600 }}>{label}</span>
                {' / '}{pw}
                <span style={{ marginLeft:6, opacity:0.6 }}>({note})</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
