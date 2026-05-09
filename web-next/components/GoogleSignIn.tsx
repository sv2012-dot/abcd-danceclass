'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGoogleLogin } from '@react-oauth/google';
import toast from 'react-hot-toast';
import { redirectToDashboard } from '@/lib/redirectToDashboard';
import { useAuth } from '@/lib/context/AuthContext';

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
    <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908C16.658 14.013 17.64 11.705 17.64 9.2z"/>
    <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
    <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.039l3.007-2.332z"/>
    <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"/>
  </svg>
);

export default function GoogleSignIn() {
  const router = useRouter();
  const { setSession } = useAuth();
  const [loading, setLoading] = useState(false);

  const login = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true);
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
        const response = await fetch(`${apiUrl}/auth/google`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token: tokenResponse.access_token }),
        });

        const data = await response.json();

        if (response.ok) {
          if (data.token) {
            // Push session into AuthContext so dashboard route guard sees the
            // user immediately on next navigation. setSession also writes to
            // sessionStorage / localStorage.
            setSession(data.token, data.user, data.school || null);
            toast.success('Logged in successfully!');
            redirectToDashboard(router);
          } else if (data.requiresRegistration) {
            router.push(`/register?googleData=${encodeURIComponent(JSON.stringify(data.googleData))}`);
          }
        } else {
          toast.error(data.error || 'Google login failed');
        }
      } catch (error) {
        console.error('Google login error:', error);
        toast.error('Failed to authenticate with Google');
      } finally {
        setLoading(false);
      }
    },
    onError: () => {
      toast.error('Failed to authenticate with Google');
    },
  });

  return (
    <button
      onClick={() => login()}
      disabled={loading}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        padding: '11px 14px',
        background: '#fff',
        border: '1.5px solid #dadce0',
        borderRadius: 9,
        fontSize: 15,
        fontWeight: 600,
        color: '#3c4043',
        cursor: loading ? 'not-allowed' : 'pointer',
        opacity: loading ? 0.7 : 1,
        boxSizing: 'border-box',
        transition: 'background .15s, border-color .15s, box-shadow .15s',
        letterSpacing: '0.01em',
      }}
      onMouseEnter={(e) => {
        if (!loading) {
          const target = e.currentTarget;
          target.style.background = '#f8f9fa';
          target.style.borderColor = '#c0c4c9';
          target.style.boxShadow = '0 1px 6px rgba(0,0,0,0.12)';
        }
      }}
      onMouseLeave={(e) => {
        const target = e.currentTarget;
        target.style.background = '#fff';
        target.style.borderColor = '#dadce0';
        target.style.boxShadow = 'none';
      }}
    >
      {!loading && <GoogleIcon />}
      {loading ? 'Signing in…' : 'Continue with Google'}
    </button>
  );
}
