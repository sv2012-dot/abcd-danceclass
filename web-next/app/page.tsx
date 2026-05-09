'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      // If not authenticated, redirect to login
      router.push('/login');
    }
    // If user exists, dashboard will be shown here (to be built)
  }, [user, router]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
      <p style={{ color: '#888' }}>Welcome to ManchQ</p>
    </div>
  );
}
