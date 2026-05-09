'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        // If authenticated, redirect to dashboard (to be built)
        // For now, stay on home
      } else {
        // If not authenticated, redirect to login
        router.push('/login');
      }
    }
  }, [user, loading, router]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
      <p style={{ color: '#888' }}>Loading...</p>
    </div>
  );
}
