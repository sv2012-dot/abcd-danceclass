'use client';

import { useEffect } from 'react';
import { useAuth } from '@/lib/context/AuthContext';

export default function Home() {
  const { user } = useAuth();

  useEffect(() => {
    // Only redirect if definitely no user (not loading)
    if (user === null) {
      window.location.href = '/login';
    }
  }, [user]);

  // Show nothing while determining auth state
  return null;
}
