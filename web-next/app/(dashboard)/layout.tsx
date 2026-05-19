'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';
import AppShell from '@/components/shared/AppShell';
import UpgradeModal from '@/components/billing/UpgradeModal';
import { useUpgradeOnLimit } from '@/components/billing/useUpgradeOnLimit';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  // Global upgrade-prompt modal. Listens for 402/429 from the API
  // client and surfaces a Pro upgrade dialog. Pages don't need to
  // handle limit errors themselves — toss the request, the modal
  // appears automatically when the backend rejects.
  const upgrade = useUpgradeOnLimit();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#000', color: '#888' }}>
      Loading...
    </div>
  );
  if (!user) return null;
  return (
    <>
      <AppShell>{children}</AppShell>
      <UpgradeModal
        open={upgrade.open}
        limit={upgrade.limit}
        onClose={upgrade.close}
        current={upgrade.current}
        cap={upgrade.cap}
      />
    </>
  );
}
