'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';
import { useEffect, useState } from 'react';

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    if (!user) {
      router.replace('/login');
    }
  }, [mounted, user, router]);

  if (!mounted || !user) {
    return null;
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
      <p style={{ color: '#fff' }}>Welcome to ManchQ Dashboard</p>
    </div>
  );
}
