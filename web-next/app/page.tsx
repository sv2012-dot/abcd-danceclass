'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/context/AuthContext';

export default function Home() {
  const { user, loading } = useAuth();
  const [redirected, setRedirected] = useState(false);

  useEffect(() => {
    // Only redirect after auth check is complete
    if (!loading && !user && !redirected) {
      setRedirected(true);
      window.location.href = '/login';
    }
  }, [loading, user, redirected]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
      <p style={{ color: '#888' }}>Redirecting to login...</p>
    </div>
  );
}
