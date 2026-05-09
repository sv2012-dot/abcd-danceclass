'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';
import { redirectToDashboard } from '@/lib/redirectToDashboard';
import toast from 'react-hot-toast';

const inputStyle: React.CSSProperties = {
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

// Inner component uses useSearchParams() — must be inside <Suspense>
function RegisterForm() {
  const { user, loading: authLoading, setSession } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formLoading, setFormLoading] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);

  const [form, setForm] = useState({
    ownerName: '',
    ownerEmail: '',
    schoolName: '',
    city: '',
    danceStyle: '',
  });

  // If already logged in, redirect to dashboard
  useEffect(() => {
    if (user && !authLoading) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  // Pre-fill Google data if redirected from Google login
  useEffect(() => {
    const googleDataStr = searchParams.get('googleData');
    if (googleDataStr) {
      try {
        const googleData = JSON.parse(decodeURIComponent(googleDataStr));
        setForm((prev) => ({
          ...prev,
          ownerName: googleData.name || '',
          ownerEmail: googleData.email || '',
        }));
      } catch (err) {
        console.error('Failed to parse googleData:', err);
      }
    }
  }, [searchParams]);

  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
        <p style={{ color: '#888' }}>Loading...</p>
      </div>
    );
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const validateForm = () => {
    if (!form.ownerEmail) {
      toast.error('Email is required');
      return false;
    }
    if (!form.ownerEmail.includes('@')) {
      toast.error('Please enter a valid email');
      return false;
    }
    if (!form.ownerName.trim()) {
      toast.error('Owner name is required');
      return false;
    }
    if (!form.schoolName.trim()) {
      toast.error('School name is required');
      return false;
    }
    if (!agreeToTerms) {
      toast.error('You must agree to the Terms of Service and Privacy Policy');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setFormLoading(true);
    try {
      const apiUrl = (process.env.NEXT_PUBLIC_API_URL?.trim()) || 'http://localhost:5000/api';
      const response = await fetch(`${apiUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerName: form.ownerName,
          ownerEmail: form.ownerEmail,
          schoolName: form.schoolName,
          city: form.city || null,
          danceStyle: form.danceStyle || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Registration failed');
      }

      const data = await response.json();

      // Push session into AuthContext (also writes storage) so the dashboard
      // route guard sees an authenticated user immediately on navigation.
      setSession(data.token, data.user, data.school || null);

      toast.success('School registered successfully!');
      redirectToDashboard(router);
    } catch (error: any) {
      const msg = error?.message || (typeof error === 'string' ? error : 'Registration failed');
      toast.error(msg);
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 420, background: 'var(--card)', borderRadius: 16, padding: '40px 32px', boxShadow: '0 0 0 1px rgba(255,255,255,0.08)' }}>
        {/* Header */}
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 8px', color: 'var(--text)' }}>Register Your School</h1>
          <p style={{ fontSize: 14, color: 'var(--muted)', margin: 0 }}>Get started with ManchQ in minutes</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Owner Name */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>
              Owner Name <span style={{ color: '#ff4444' }}>*</span>
            </label>
            <input
              type="text"
              name="ownerName"
              value={form.ownerName}
              onChange={handleChange}
              placeholder="Your full name"
              disabled={formLoading}
              style={inputStyle}
            />
          </div>

          {/* Email */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>
              Email <span style={{ color: '#ff4444' }}>*</span>
            </label>
            <input
              type="email"
              name="ownerEmail"
              value={form.ownerEmail}
              onChange={handleChange}
              placeholder="your@email.com"
              disabled={formLoading}
              style={inputStyle}
            />
          </div>

          {/* School Name */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>
              School Name <span style={{ color: '#ff4444' }}>*</span>
            </label>
            <input
              type="text"
              name="schoolName"
              value={form.schoolName}
              onChange={handleChange}
              placeholder="e.g., Elite Dance Academy"
              disabled={formLoading}
              style={inputStyle}
            />
          </div>

          {/* City */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>
              City
            </label>
            <input
              type="text"
              name="city"
              value={form.city}
              onChange={handleChange}
              placeholder="e.g., New York"
              disabled={formLoading}
              style={inputStyle}
            />
          </div>

          {/* Dance Style */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>
              Dance Style
            </label>
            <input
              type="text"
              name="danceStyle"
              value={form.danceStyle}
              onChange={handleChange}
              placeholder="e.g., Classical, Contemporary, Hip-Hop"
              disabled={formLoading}
              style={inputStyle}
            />
          </div>

          {/* Terms Acceptance */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px', background: 'var(--surface)', borderRadius: 8, borderLeft: '3px solid var(--border)' }}>
            <input
              type="checkbox"
              id="agreeToTerms"
              checked={agreeToTerms}
              onChange={(e) => setAgreeToTerms(e.target.checked)}
              disabled={formLoading}
              style={{ width: 18, height: 18, marginTop: 2, cursor: formLoading ? 'not-allowed' : 'pointer' }}
            />
            <label
              htmlFor="agreeToTerms"
              style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5, cursor: formLoading ? 'not-allowed' : 'pointer', flex: 1 }}
            >
              I agree to ManchQ's{' '}
              <a href="/TERMS_OF_SERVICE.md" target="_blank" rel="noopener noreferrer" style={{ color: '#6a7fdb', textDecoration: 'none', fontWeight: 600 }}>
                Terms of Service
              </a>
              {' '}and{' '}
              <a href="/PRIVACY_POLICY.md" target="_blank" rel="noopener noreferrer" style={{ color: '#6a7fdb', textDecoration: 'none', fontWeight: 600 }}>
                Privacy Policy
              </a>
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={formLoading}
            style={{
              width: '100%',
              padding: '13px',
              background: formLoading ? '#555' : '#111',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              fontSize: 15,
              fontWeight: 700,
              cursor: formLoading ? 'not-allowed' : 'pointer',
              letterSpacing: '0.01em',
              marginTop: 8,
            }}
          >
            {formLoading ? 'Registering...' : 'Register School'}
          </button>
        </form>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>or</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>

        {/* Already have account */}
        <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>
          Already have a school?{' '}
          <button
            onClick={() => router.push('/login')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6a7fdb', textDecoration: 'none', fontWeight: 600, padding: 0 }}
          >
            Sign in here
          </button>
        </div>
      </div>
    </div>
  );
}

// Outer page wraps the form in Suspense (required for useSearchParams in Next.js)
export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
        <p style={{ color: '#888' }}>Loading...</p>
      </div>
    }>
      <RegisterForm />
    </Suspense>
  );
}
