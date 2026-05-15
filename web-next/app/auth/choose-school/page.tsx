'use client';

// /auth/choose-school — single screen, mobile-friendly card grid.
// Two entry points:
//   A) Post-sign-in: previous step (magic-link consume, Google, demo, register)
//      returned { requires_choice: true, chooser_token, memberships } and
//      stashed it in sessionStorage. We read it on mount.
//   B) Switch-school: user is already signed in and clicked "Switch school".
//      We call /auth/switch-school to get a fresh chooser_token, then render.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/api';
import { useAuth } from '@/lib/context/AuthContext';
import { redirectToDashboard } from '@/lib/redirectToDashboard';
import AuthBackground from '@/components/AuthBackground';
import toast from 'react-hot-toast';

type Membership = {
  school_id: number;
  school_name: string;
  school_city: string | null;
  dance_style: string | null;
  role: string;
  is_owner: number;
  last_used_at: string | null;
  joined_at: string;
  plan_tier?: 'free' | 'paid' | null;
  trial_ends_at?: string | null;
  stripe_subscription_id?: string | null;
  current_period_end?: string | null;
};

const PURPLE = '#7C3AED';
const MAGENTA = '#DC4EFF';
const GRAD = `linear-gradient(135deg, ${PURPLE} 0%, ${MAGENTA} 100%)`;

const STORAGE_KEY = 'sf_pending_chooser';

// Persist between magic-link → choose-school navigation
export function stashChooser(payload: { chooser_token: string; memberships: Membership[]; user?: any; accepted_school_id?: number | null }) {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload)); } catch (_) {}
}
function popChooser(): { chooser_token: string; memberships: Membership[]; user?: any; accepted_school_id?: number | null } | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(STORAGE_KEY);
    return JSON.parse(raw);
  } catch (_) { return null; }
}

function initials(name: string) {
  return (name || '?').split(/[\s@]/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}
function roleLabel(role: string, isOwner: number) {
  if (isOwner) return 'Owner';
  if (role === 'school_admin') return 'Admin';
  if (role === 'teacher') return 'Teacher';
  if (role === 'parent') return 'Parent';
  return role;
}
function timeAgo(iso: string | null) {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return 'just now';
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}
function planChip(m: Membership) {
  if (m.stripe_subscription_id && m.current_period_end && new Date(m.current_period_end) > new Date()) {
    return { label: 'Pro', bg: GRAD, color: '#fff' };
  }
  if (m.trial_ends_at && new Date(m.trial_ends_at) > new Date()) {
    const days = Math.max(0, Math.ceil((new Date(m.trial_ends_at).getTime() - Date.now()) / 86400000));
    return { label: `${days}d trial`, bg: 'rgba(167,139,250,0.18)', color: '#7C3AED' };
  }
  return { label: 'Free', bg: 'var(--surface)', color: 'var(--muted)' };
}

export default function ChooseSchoolPage() {
  const router = useRouter();
  const { user, setSession, loading: authLoading } = useAuth() as any;
  const [chooserToken, setChooserToken] = useState<string | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Path A: post-sign-in stash from sessionStorage
    const stashed = popChooser();
    if (stashed?.chooser_token && stashed.memberships?.length) {
      setChooserToken(stashed.chooser_token);
      setMemberships(stashed.memberships);
      if (stashed.accepted_school_id) setHighlightId(stashed.accepted_school_id);
      return;
    }
    // Path B: switch-school for an already-signed-in user
    if (!authLoading && user) {
      auth.switchSchool()
        .then((data: any) => {
          if (!data?.chooser_token || !data.memberships?.length) {
            setError("You don't have any active schools to switch to.");
            return;
          }
          setChooserToken(data.chooser_token);
          setMemberships(data.memberships);
        })
        .catch((err: any) => setError(err?.error || 'Could not load your schools.'));
      return;
    }
    if (!authLoading && !user) {
      // No stash + not signed in → back to login
      router.replace('/login');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  const pick = async (m: Membership) => {
    if (!chooserToken) return;
    setBusy(m.school_id);
    try {
      const data: any = await auth.chooseSchool(chooserToken, m.school_id);
      setSession(data.token, data.user, data.school || null);
      toast.success(`Welcome to ${m.school_name}!`);
      // Tiny delay so the success state registers
      setTimeout(() => redirectToDashboard(router), 250);
    } catch (err: any) {
      toast.error(err?.error || 'Could not enter that school.');
      setBusy(null);
    }
  };

  if (error) {
    return (
      <Frame>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: '0 0 8px' }}>Hmm, that didn't work</h2>
        <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 22px' }}>{error}</p>
        <button onClick={() => router.push('/login')} style={primaryBtn}>Back to sign-in</button>
      </Frame>
    );
  }

  if (!chooserToken || memberships.length === 0) {
    return (
      <Frame>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>Loading your schools&hellip;</p>
      </Frame>
    );
  }

  return (
    <AuthBackground>
      <div style={{ width: '100%', maxWidth: 520, position: 'relative', zIndex: 4 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'center' }}>
            <img src="/ManchQ-Logo.png" alt="ManchQ" style={{ width: 64, height: 64, borderRadius: '50%' }} />
          </div>
          <h1 style={{ color: 'var(--text)', fontSize: 22, fontWeight: 700, margin: '0 0 6px', letterSpacing: '-0.4px' }}>
            Choose a studio
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: 13, margin: 0 }}>
            You're a member of {memberships.length} studios. Pick one to enter.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {memberships.map(m => {
            const isHighlight = highlightId === m.school_id;
            const isBusy = busy === m.school_id;
            const chip = planChip(m);
            return (
              <button
                key={m.school_id}
                onClick={() => pick(m)}
                disabled={busy !== null}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: 16,
                  background: 'var(--card)',
                  border: isHighlight ? `2px solid ${PURPLE}` : '1px solid var(--border)',
                  borderRadius: 14,
                  cursor: busy === null ? 'pointer' : 'wait',
                  textAlign: 'left',
                  transition: 'transform .08s, border-color .15s, box-shadow .15s',
                  opacity: busy !== null && !isBusy ? 0.5 : 1,
                  boxShadow: isHighlight ? '0 0 0 4px rgba(124,58,237,0.18)' : 'none',
                }}
                onMouseEnter={(e) => { if (busy === null) (e.currentTarget as HTMLElement).style.borderColor = PURPLE; }}
                onMouseLeave={(e) => { if (busy === null && !isHighlight) (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}
              >
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 16, flexShrink: 0 }}>
                  {initials(m.school_name)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{m.school_name}</span>
                    <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 999, background: m.is_owner ? GRAD : 'var(--surface)', color: m.is_owner ? '#fff' : 'var(--muted)', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                      {roleLabel(m.role, m.is_owner)}
                    </span>
                    <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 999, background: chip.bg, color: chip.color, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                      {chip.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {[m.school_city, m.dance_style].filter(Boolean).join(' · ') || 'Dance studio'}
                    {m.last_used_at ? <> &middot; last visited {timeAgo(m.last_used_at)}</> : null}
                  </div>
                </div>
                <div style={{ color: PURPLE, fontWeight: 700, fontSize: 18, flexShrink: 0, paddingLeft: 6 }}>
                  {isBusy ? '…' : '→'}
                </div>
              </button>
            );
          })}
        </div>

        {/* Sign out escape hatch */}
        <div style={{ textAlign: 'center', marginTop: 28 }}>
          <button
            onClick={() => {
              try { localStorage.clear(); sessionStorage.clear(); } catch (_) {}
              router.push('/login');
            }}
            style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 12, cursor: 'pointer', padding: 6 }}
          >
            Not you? Sign out →
          </button>
        </div>
      </div>
    </AuthBackground>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <AuthBackground>
      <div style={{ width: '100%', maxWidth: 420, background: 'var(--card)', borderRadius: 16, padding: 36, textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.06)', position: 'relative', zIndex: 4 }}>
        {children}
      </div>
    </AuthBackground>
  );
}
const primaryBtn: React.CSSProperties = { background: 'var(--text)', color: 'var(--card)', border: 'none', padding: '11px 22px', borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: 'pointer' };
