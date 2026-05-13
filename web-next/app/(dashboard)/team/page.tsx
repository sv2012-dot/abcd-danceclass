'use client';

// /team — manage the school's roster of admins + teachers, plus pending invites.
// Owners can transfer ownership, change roles, and remove members. Admins can
// invite/revoke/resend, but cannot demote the owner.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/context/AuthContext';
import { team } from '@/lib/api';

type Member = {
  id: number;
  name: string;
  email: string;
  role: string;
  is_owner: number;
  is_active: number;
  last_sign_in_at: string | null;
  last_login: string | null;
  created_at: string;
};
type Pending = {
  id: number;
  email: string;
  role: string;
  status: string;
  created_at: string;
  invited_by_name: string | null;
};

const PURPLE = '#7C3AED';
const MAGENTA = '#DC4EFF';
const GRAD = `linear-gradient(135deg, ${PURPLE} 0%, ${MAGENTA} 100%)`;

function roleLabel(r: string, isOwner: number) {
  if (isOwner) return 'Owner';
  if (r === 'school_admin') return 'Admin';
  if (r === 'teacher') return 'Teacher';
  if (r === 'parent') return 'Parent';
  return r;
}

function timeAgo(iso: string | null) {
  if (!iso) return 'never';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return 'soon';
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function TeamPage() {
  const router = useRouter();
  const { user } = useAuth() as any;
  const [members, setMembers] = useState<Member[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [planErr, setPlanErr] = useState<string | null>(null);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'school_admin' | 'teacher'>('teacher');

  // Transfer dialog
  const [xferOpen, setXferOpen] = useState(false);
  const [xferTarget, setXferTarget] = useState<Member | null>(null);
  const [xferConfirm, setXferConfirm] = useState('');

  const meId = user?.id != null ? Number(user.id) : null;
  const isMeOwner = (meId != null && members.find(m => m.id === meId)?.is_owner === 1) || false;

  const refresh = async () => {
    setLoading(true);
    try {
      const d: any = await team.list();
      setMembers(d.members || []);
      setPending(d.pending || []);
    } catch (err: any) {
      toast.error(err?.error || 'Could not load team.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, []);

  // Block non-admins
  if (user && user.role !== 'school_admin' && user.role !== 'superadmin') {
    return (
      <div style={{ maxWidth: 720, margin: '40px auto', textAlign: 'center', color: 'var(--muted)' }}>
        <h1 style={{ color: 'var(--text)' }}>Team</h1>
        <p>Only school admins can manage the team.</p>
      </div>
    );
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setBusy('invite');
    setPlanErr(null);
    try {
      await team.invite({ email: inviteEmail.trim(), role: inviteRole });
      toast.success(`Invite sent to ${inviteEmail.trim()}`);
      setInviteEmail('');
      setInviteRole('teacher');
      await refresh();
    } catch (err: any) {
      if (err?.resource === 'team_members' || err?.error === 'plan_limit_reached') {
        setPlanErr(err.message || 'Free plan is limited to 1 team member. Upgrade to invite teammates.');
      } else {
        toast.error(err?.error || err?.message || 'Could not send invite.');
      }
    } finally {
      setBusy(null);
    }
  };

  const handleResend = async (id: number) => {
    setBusy(`resend-${id}`);
    try { await team.resendInvite(id); toast.success('Invite resent.'); await refresh(); }
    catch (err: any) { toast.error(err?.error || 'Resend failed.'); }
    finally { setBusy(null); }
  };
  const handleRevoke = async (id: number) => {
    if (!confirm('Revoke this invite?')) return;
    setBusy(`revoke-${id}`);
    try { await team.revokeInvite(id); await refresh(); }
    catch (err: any) { toast.error(err?.error || 'Revoke failed.'); }
    finally { setBusy(null); }
  };
  const handleChangeRole = async (m: Member, role: 'school_admin' | 'teacher') => {
    setBusy(`role-${m.id}`);
    try { await team.updateRole(m.id, role); toast.success('Role updated.'); await refresh(); }
    catch (err: any) { toast.error(err?.error || 'Role change failed.'); }
    finally { setBusy(null); }
  };
  const handleRemove = async (m: Member) => {
    if (!confirm(`Remove ${m.name || m.email} from the team?`)) return;
    setBusy(`remove-${m.id}`);
    try { await team.removeMember(m.id); toast.success(`Removed ${m.email}.`); await refresh(); }
    catch (err: any) { toast.error(err?.error || 'Remove failed.'); }
    finally { setBusy(null); }
  };
  const handleTransfer = async () => {
    if (!xferTarget) return;
    if (xferConfirm.trim().toLowerCase() !== xferTarget.email.toLowerCase()) {
      toast.error('Confirmation email does not match.');
      return;
    }
    setBusy('xfer');
    try {
      await team.transferOwner(xferTarget.id, xferConfirm.trim());
      toast.success(`Ownership transferred to ${xferTarget.email}.`);
      setXferOpen(false); setXferTarget(null); setXferConfirm('');
      await refresh();
    } catch (err: any) {
      toast.error(err?.error || 'Transfer failed.');
    } finally { setBusy(null); }
  };

  return (
    <div style={{ maxWidth: 880, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px', letterSpacing: '-0.5px' }}>Team</h1>
        <p style={{ fontSize: 14, color: 'var(--muted)', margin: 0 }}>
          Invite admins and teachers to help run your studio. Everyone signs in with a magic link &mdash; no passwords to share.
        </p>
      </div>

      {/* Invite form */}
      <section style={{ background: 'var(--card)', borderRadius: 12, padding: 20, border: '1px solid var(--border)' }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: '0 0 12px' }}>Invite a teammate</h2>
        {planErr ? (
          <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.35)', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>
              <strong>{planErr}</strong>
            </div>
            <button
              onClick={() => router.push('/billing')}
              style={{ alignSelf: 'flex-start', background: GRAD, color: '#fff', border: 'none', padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
            >
              Upgrade to Pro →
            </button>
          </div>
        ) : (
          <form onSubmit={handleInvite} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '2 1 220px' }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>Email</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="teammate@example.com"
                style={{ width: '100%', background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 14, color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }}
                required
              />
            </div>
            <div style={{ flex: '1 1 140px' }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>Role</label>
              <select
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value as any)}
                style={{ width: '100%', background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 14, color: 'var(--text)', outline: 'none' }}
              >
                <option value="teacher">Teacher</option>
                <option value="school_admin">Admin</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={busy === 'invite' || !inviteEmail.trim()}
              style={{ background: '#111', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: busy === 'invite' ? 'wait' : 'pointer', whiteSpace: 'nowrap' }}
            >
              {busy === 'invite' ? 'Sending…' : 'Send invite'}
            </button>
          </form>
        )}
      </section>

      {/* Pending invites */}
      {pending.length > 0 && (
        <section style={{ background: 'var(--card)', borderRadius: 12, padding: 20, border: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: '0 0 12px' }}>Pending invites ({pending.length})</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pending.map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--surface)', borderRadius: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.email}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                    {roleLabel(p.role, 0)} &middot; sent {timeAgo(p.created_at)}
                    {p.invited_by_name ? <> &middot; by {p.invited_by_name}</> : null}
                  </div>
                </div>
                <button onClick={() => handleResend(p.id)} disabled={busy === `resend-${p.id}`} style={iconBtnStyle}>Resend</button>
                <button onClick={() => handleRevoke(p.id)} disabled={busy === `revoke-${p.id}`} style={{ ...iconBtnStyle, color: '#DC2626' }}>Revoke</button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Active members */}
      <section style={{ background: 'var(--card)', borderRadius: 12, padding: 20, border: '1px solid var(--border)' }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: '0 0 12px' }}>Active members ({members.length})</h2>
        {loading ? (
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>Loading…</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {members.map(m => {
              const isMe = meId != null && m.id === meId;
              const canEdit = isMeOwner && !m.is_owner;
              const lastSeen = m.last_sign_in_at || m.last_login;
              return (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px', background: 'var(--surface)', borderRadius: 8 }}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: GRAD, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                    {(m.name || m.email).split(/[\s@]/).filter(Boolean).slice(0,2).map(s => s[0]).join('').toUpperCase() || '?'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{m.name || '(no name)'}</span>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: m.is_owner ? GRAD : 'var(--border)', color: m.is_owner ? '#fff' : 'var(--muted)', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                        {roleLabel(m.role, m.is_owner)}
                      </span>
                      {isMe && <span style={{ fontSize: 11, color: 'var(--muted)' }}>(you)</span>}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.email} &middot; last seen {timeAgo(lastSeen)}
                    </div>
                  </div>
                  {canEdit && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      {m.role === 'teacher' && (
                        <button onClick={() => handleChangeRole(m, 'school_admin')} disabled={busy === `role-${m.id}`} style={iconBtnStyle}>Make Admin</button>
                      )}
                      {m.role === 'school_admin' && (
                        <button onClick={() => handleChangeRole(m, 'teacher')} disabled={busy === `role-${m.id}`} style={iconBtnStyle}>Make Teacher</button>
                      )}
                      <button onClick={() => handleRemove(m)} disabled={busy === `remove-${m.id}`} style={{ ...iconBtnStyle, color: '#DC2626' }}>Remove</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Danger zone */}
      {isMeOwner && members.length > 1 && (
        <section style={{ background: 'var(--card)', borderRadius: 12, padding: 20, border: '1px solid rgba(220,38,38,0.35)' }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#DC2626', margin: '0 0 8px' }}>Danger zone</h2>
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 12px', lineHeight: 1.55 }}>
            Transfer ownership to another admin. You'll drop to Admin and the new owner takes over billing + school deletion rights.
          </p>
          <button
            onClick={() => setXferOpen(true)}
            style={{ background: 'transparent', color: '#DC2626', border: '1.5px solid #DC2626', padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
          >
            Transfer ownership →
          </button>
        </section>
      )}

      {/* Transfer modal */}
      {xferOpen && (
        <div onClick={() => setXferOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 460, background: 'var(--card)', borderRadius: 12, padding: 24, border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', margin: '0 0 8px' }}>Transfer ownership</h3>
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 16px', lineHeight: 1.55 }}>
              Choose a member to become the new owner. They take over billing and school deletion rights. You'll remain as Admin.
            </p>

            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>New owner</label>
            <select
              value={xferTarget?.id || ''}
              onChange={(e) => {
                const id = Number(e.target.value);
                setXferTarget(members.find(m => m.id === id) || null);
              }}
              style={{ width: '100%', background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 14, color: 'var(--text)', outline: 'none', marginBottom: 14 }}
            >
              <option value="">Pick a teammate…</option>
              {members.filter(m => !m.is_owner).map(m => (
                <option key={m.id} value={m.id}>{m.name || m.email} ({m.email})</option>
              ))}
            </select>

            {xferTarget && (
              <>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>
                  Type their email to confirm
                </label>
                <input
                  value={xferConfirm}
                  onChange={(e) => setXferConfirm(e.target.value)}
                  placeholder={xferTarget.email}
                  style={{ width: '100%', background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 14, color: 'var(--text)', outline: 'none', boxSizing: 'border-box', marginBottom: 18 }}
                />
              </>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => { setXferOpen(false); setXferTarget(null); setXferConfirm(''); }} style={{ background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border)', padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
              <button
                onClick={handleTransfer}
                disabled={!xferTarget || busy === 'xfer'}
                style={{ background: '#DC2626', color: '#fff', border: 'none', padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: !xferTarget || busy === 'xfer' ? 'not-allowed' : 'pointer', opacity: !xferTarget ? 0.6 : 1 }}
              >
                {busy === 'xfer' ? 'Transferring…' : 'Transfer ownership'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const iconBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--border)',
  color: 'var(--text)',
  padding: '6px 10px',
  borderRadius: 7,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};
