'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Redirect to login if not authenticated and auth check is complete
  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  // Show loading state while checking auth
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
        <p style={{ color: '#888' }}>Loading...</p>
      </div>
    );
  }

  // If no user and not loading, redirect effect will trigger above
  if (!user) {
    return null;
  }

  // USER IS AUTHENTICATED - Show dashboard
  return (
    <div style={{ minHeight: '100vh', background: '#000', color: '#fff', padding: '40px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '32px', marginBottom: '10px' }}>Welcome to ManchQ, {user.name}!</h1>
        <p style={{ fontSize: '16px', color: '#888', marginBottom: '40px' }}>Your dashboard is being built. Here's your profile info:</p>

        <div style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '20px'
        }}>
          <h2 style={{ fontSize: '18px', marginBottom: '16px', color: 'var(--text)' }}>Profile</h2>
          <div style={{ display: 'grid', gap: '12px', fontSize: '14px' }}>
            <div><span style={{ color: 'var(--muted)' }}>Name:</span> {user.name}</div>
            <div><span style={{ color: 'var(--muted)' }}>Email:</span> {user.email}</div>
            <div><span style={{ color: 'var(--muted)' }}>User ID:</span> {user.id}</div>
          </div>
        </div>

        <button
          onClick={() => {
            // Logout function would go here
            localStorage.clear();
            sessionStorage.clear();
            window.location.href = '/login';
          }}
          style={{
            padding: '12px 24px',
            background: '#ff4444',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600'
          }}
        >
          Logout
        </button>
      </div>
    </div>
  );
}
