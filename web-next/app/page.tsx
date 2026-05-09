'use client';

import { useEffect } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import { redirectToDashboard } from '@/lib/redirectToDashboard';

export default function Home() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (user) {
      // Authenticated — send to the real dashboard app
      const token = sessionStorage.getItem('sf_token') || '';
      const school = localStorage.getItem('sf_school');
      redirectToDashboard(token, user, school ? JSON.parse(school) : null);
    } else {
      // Not authenticated — go to login
      window.location.replace('/login');
    }
  }, [loading, user]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
      <p style={{ color: '#888' }}>Loading...</p>
    </div>
  );
}
