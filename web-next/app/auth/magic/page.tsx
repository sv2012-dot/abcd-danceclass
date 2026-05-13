'use client';

// /auth/magic?token=... — consumes a magic-link token and signs the user in.
// Two flows land here:
//   1. Sign-in link  → token is consumed immediately, user is redirected.
//   2. Invitation    → we first show "Sarah invited you to Bloom Studio as Teacher"
//                      with an Accept button; consuming happens on confirm.

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';
import { auth, team } from '@/lib/api';
import { redirectToDashboard } from '@/lib/redirectToDashboard';
import toast from 'react-hot-toast';

type InvitePreview = {
  email: string;
  role: string;
  school_name: string;
  school_city: string | null;
  inviter_name: string | null;
};

const PURPLE = '#7C3AED';
const MAGENTA = '#DC4EFF';
const GRAD = `linear-gradient(135deg, ${PURPLE} 0%, ${MAGENTA} 100%)`;

function roleLabel(r: string) {
  if (r === 'school_admin') return 'Admin';
  if (r === 'teacher') return 'Teacher';
  return r;
}

function MagicConsumer() {
  const router = useRouter();
  const params = useSearchParams();
  const { setSession } = useAuth();
  const [status, setStatus] = useState<'loading' | 'invite' | 'consuming' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [token, setToken] = useState('');

  // On mount, ask the backend if this token is an invitation.
  // Backend returns { is_invite: boolean, status?: 'pending'|'expired'|'used'|'revoked' }.
  useEffect(() => {
    const t = params.get('token');
    if (!t) {
      setStatus('error');
      setErrorMsg('No sign-in link found. Try requesting a new one.');
      return;
    }
    setToken(t);

    (async () => {
      try {
        const p: any = await team.previewInvite(t);
        if (p?.is_invite) {
          if (p.status === 'pending') {
            setPreview(p as InvitePreview);
            setStatus('invite');
            return;
          }
          // Invite exists but is no longer usable
          setStatus('error');
          setErrorMsg(
            p.status === 'expired' ? 'This invite expired. Ask for a new one.' :
            p.status === 'used'    ? 'This invite has already been used.' :
            p.status === 'revoked' ? 'This invite was revoked.' :
            'This invite is no longer valid.'
          );
          return;
        }
        // Not an invite → plain sign-in token, consume directly
        await consumeToken(t);
      } catch (err: any) {
        // Network / 500 — try the consume path anyway as a last resort
        await consumeToken(t);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function consumeToken(t: string) {
    setStatus('consuming');
    try {
      const data: any = await auth.consumeMagicLink(t);
      // Multi-school branch: stash the chooser payload and route to /auth/choose-school
      if (data?.requires_choice && data?.chooser_token) {
        try {
          sessionStorage.setItem('sf_pending_chooser', JSON.stringify({
            chooser_token: data.chooser_token,
            memberships: data.memberships || [],
            user: data.user,
            accepted_school_id: data.accepted_school_id || null,
          }));
        } catch (_) {}
        setStatus('success');
        setTimeout(() => router.replace('/auth/choose-school'), 200);
        return;
      }
      // Single-membership / superadmin / orphan: full token returned, sign in directly
      setSession(data.token, data.user, data.school || null);
      setStatus('success');
      toast.success(`Welcome${data.user?.name ? `, ${data.user.name}` : ''}!`);
      setTimeout(() => redirectToDashboard(router), 400);
    } catch (err: any) {
      setStatus('error');
      setErrorMsg(err?.error || err?.message || 'This link is invalid or has expired.');
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 440, background: 'var(--card)', borderRadius: 16, padding: 36, textAlign: 'center', boxShadow: '0 0 0 1px rgba(255,255,255,0.08)' }}>

        {status === 'loading' && (
          <>
            <div style={{ fontSize: 36, marginBottom: 14 }}>⏳</div>
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>Checking your link&hellip;</p>
          </>
        )}

        {status === 'invite' && preview && (
          <>
            <div style={{ fontSize: 36, marginBottom: 14 }}>👋</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>You're invited</h2>
            <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 24 }}>
              <strong style={{ color: 'var(--text)' }}>{preview.inviter_name || 'A teammate'}</strong> invited you to join{' '}
              <strong style={{ color: 'var(--text)' }}>{preview.school_name}</strong>
              {preview.school_city ? <> in {preview.school_city}</> : null} on ManchQ as{' '}
              <strong style={{ color: 'var(--text)' }}>{roleLabel(preview.role)}</strong>.
            </p>
            <div style={{ background: 'var(--surface)', borderRadius: 10, padding: 12, marginBottom: 22, fontSize: 12, color: 'var(--muted)', lineHeight: 1.55 }}>
              You'll be signed in as <strong style={{ color: 'var(--text)' }}>{preview.email}</strong>. No password needed.
            </div>
            <button
              onClick={() => consumeToken(token)}
              style={{ width: '100%', background: GRAD, color: '#fff', border: 'none', padding: '13px', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.01em', marginBottom: 10 }}
            >
              Accept &amp; sign in →
            </button>
            <button
              onClick={() => router.push('/')}
              style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 12, padding: '6px 0' }}
            >
              Not now
            </button>
          </>
        )}

        {status === 'consuming' && (
          <>
            <div style={{ fontSize: 36, marginBottom: 14 }}>🔐</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Signing you in&hellip;</h2>
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>One moment.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{ fontSize: 36, marginBottom: 14 }}>✅</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>You're in!</h2>
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>Redirecting&hellip;</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{ fontSize: 36, marginBottom: 14 }}>⚠️</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Couldn't sign you in</h2>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 22, lineHeight: 1.55 }}>
              {errorMsg}
            </p>
            <button
              onClick={() => router.push('/login')}
              style={{ background: '#111', color: '#fff', border: 'none', padding: '11px 22px', borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
            >
              Back to sign-in
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function MagicLinkPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
        <p style={{ color: '#888' }}>Loading&hellip;</p>
      </div>
    }>
      <MagicConsumer />
    </Suspense>
  );
}
