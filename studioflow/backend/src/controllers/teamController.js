// teamController.js
// Multi-user team management for a single school.
//
// Roles supported:
//   - school_admin  (owner OR co-admin; owner is school_admin + is_owner=1)
//   - teacher       (limited access)
//   - parent        (read-only, future)
//
// Auth model: built on the magic-link infrastructure. Sending an invite
// creates one row in `invitations` AND one row in `magic_tokens` with
// purpose='invite' and the role/school_id baked in. When the recipient
// clicks the link, the consumeMagicLink endpoint attaches them to the
// school in the same transaction.

const crypto = require('crypto');
const pool = require('../../config/db');
const { effectivePlan } = require('../lib/plan');
const { sendInvitationEmail } = require('../services/emailService');

const INVITE_TTL_DAYS = 7;

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}
const appUrl = () => (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');

// Pre-check: caller must be school_admin (owner or co-admin) of the resolved school.
function requireSchoolAdmin(req, res) {
  if (req.user.role !== 'school_admin' && req.user.role !== 'superadmin') {
    res.status(403).json({ error: 'Only school admins can manage the team.' });
    return false;
  }
  return true;
}
function requireOwner(req, res, ownerFlag) {
  if (req.user.role === 'superadmin') return true;
  if (!ownerFlag) {
    res.status(403).json({ error: 'Only the school owner can perform this action.' });
    return false;
  }
  return true;
}

// GET /team  → active members + pending invites
exports.list = async (req, res) => {
  if (!requireSchoolAdmin(req, res)) return;
  const schoolId = req.user.school_id;
  if (!schoolId) return res.status(400).json({ error: 'No school context.' });

  try {
    // Memberships are the per-school source of truth for role and is_owner.
    const [members] = await pool.query(
      `SELECT u.id, u.name, u.email, u.is_active, u.last_sign_in_at, u.last_login, u.created_at,
              sm.role, sm.is_owner, sm.joined_at, sm.id AS membership_id
         FROM school_memberships sm
         JOIN users u ON u.id = sm.user_id
        WHERE sm.school_id = ?
          AND sm.removed_at IS NULL
          AND u.removed_at IS NULL
        ORDER BY sm.is_owner DESC, sm.joined_at ASC`,
      [schoolId]
    );
    const [invites] = await pool.query(
      `SELECT i.id, i.email, i.role, i.status, i.created_at, u.name AS invited_by_name
         FROM invitations i
         LEFT JOIN users u ON u.id = i.invited_by_user_id
        WHERE i.school_id = ? AND i.status = 'pending'
        ORDER BY i.created_at DESC`,
      [schoolId]
    );
    res.json({ members, pending: invites });
  } catch (err) {
    console.error('[team.list]', err);
    res.status(500).json({ error: err.message });
  }
};

// POST /team/invitations  { email, role }
exports.invite = async (req, res) => {
  if (!requireSchoolAdmin(req, res)) return;
  const schoolId = req.user.school_id;
  if (!schoolId) return res.status(400).json({ error: 'No school context.' });

  const email = String(req.body.email || '').trim().toLowerCase();
  const role  = String(req.body.role  || '').trim();
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Valid email required.' });
  if (!['school_admin', 'teacher'].includes(role)) {
    return res.status(400).json({ error: 'Role must be school_admin or teacher.' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Plan check — free plan = owner only, no team invites
    const eff = await effectivePlan(Number(schoolId));
    if (eff.plan === 'free') {
      // Count current active memberships for THIS school
      const [[row]] = await conn.query(
        `SELECT COUNT(*) AS n FROM school_memberships sm
          JOIN users u ON u.id = sm.user_id
          WHERE sm.school_id = ? AND sm.removed_at IS NULL
            AND u.removed_at IS NULL AND u.is_active = 1`,
        [schoolId]
      );
      const limit = eff.limits.team_members;
      if (row.n >= limit) {
        await conn.rollback();
        return res.status(402).json({
          error: 'plan_limit_reached',
          resource: 'team_members',
          limit,
          current: row.n,
          message: `Free plan is limited to ${limit} member. Upgrade to invite teammates.`,
        });
      }
    }

    // Don't allow inviting someone already an ACTIVE member of THIS school
    const [exists] = await conn.query(
      `SELECT sm.id FROM school_memberships sm
         JOIN users u ON u.id = sm.user_id
        WHERE LOWER(u.email) = LOWER(?) AND sm.school_id = ? AND sm.removed_at IS NULL`,
      [email, schoolId]
    );
    if (exists[0]) {
      await conn.rollback();
      return res.status(400).json({ error: 'That email is already on your team.' });
    }

    // Upsert behavior: revoke any prior pending invite for the same email+school
    await conn.query(
      `UPDATE invitations SET status='revoked'
        WHERE school_id = ? AND email = ? AND status = 'pending'`,
      [schoolId, email]
    );

    const token = generateToken();
    await conn.query(
      `INSERT INTO magic_tokens (token, email, purpose, school_id, role, invited_by, expires_at)
       VALUES (?, ?, 'invite', ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? DAY))`,
      [token, email, schoolId, role, req.user.id, INVITE_TTL_DAYS]
    );
    await conn.query(
      `INSERT INTO invitations (school_id, email, role, token, invited_by_user_id)
       VALUES (?, ?, ?, ?, ?)`,
      [schoolId, email, role, token, req.user.id]
    );

    // Fetch context for the email
    const [[school]]  = await conn.query('SELECT name FROM schools WHERE id = ?', [schoolId]);
    const [[inviter]] = await conn.query('SELECT name FROM users WHERE id = ?', [req.user.id]);

    await conn.commit();

    const link = `${appUrl()}/auth/magic?token=${token}`;
    sendInvitationEmail(email, link, inviter?.name, school?.name, role).catch(err =>
      console.error('Invitation email failed:', err.message)
    );

    res.json({ ok: true, message: `Invite sent to ${email}.` });
  } catch (err) {
    await conn.rollback();
    console.error('[team.invite]', err);
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
};

// POST /team/invitations/:id/resend
exports.resendInvite = async (req, res) => {
  if (!requireSchoolAdmin(req, res)) return;
  const schoolId = req.user.school_id;
  const id = Number(req.params.id);
  try {
    const [rows] = await pool.query(
      `SELECT * FROM invitations WHERE id = ? AND school_id = ? AND status = 'pending'`,
      [id, schoolId]
    );
    const inv = rows[0];
    if (!inv) return res.status(404).json({ error: 'Invite not found or no longer pending.' });

    // Refresh the underlying magic-token expiry, or regenerate a new one
    const newToken = generateToken();
    await pool.query(
      `INSERT INTO magic_tokens (token, email, purpose, school_id, role, invited_by, expires_at)
       VALUES (?, ?, 'invite', ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? DAY))`,
      [newToken, inv.email, schoolId, inv.role, req.user.id, INVITE_TTL_DAYS]
    );
    await pool.query(`UPDATE invitations SET token = ? WHERE id = ?`, [newToken, id]);

    const [[school]]  = await pool.query('SELECT name FROM schools WHERE id = ?', [schoolId]);
    const [[inviter]] = await pool.query('SELECT name FROM users WHERE id = ?', [req.user.id]);
    const link = `${appUrl()}/auth/magic?token=${newToken}`;
    sendInvitationEmail(inv.email, link, inviter?.name, school?.name, inv.role).catch(() => {});
    res.json({ ok: true, message: `Invite resent to ${inv.email}.` });
  } catch (err) {
    console.error('[team.resendInvite]', err);
    res.status(500).json({ error: err.message });
  }
};

// DELETE /team/invitations/:id
exports.revokeInvite = async (req, res) => {
  if (!requireSchoolAdmin(req, res)) return;
  const schoolId = req.user.school_id;
  const id = Number(req.params.id);
  try {
    const [result] = await pool.query(
      `UPDATE invitations SET status='revoked'
        WHERE id = ? AND school_id = ? AND status = 'pending'`,
      [id, schoolId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Invite not found or already resolved.' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('[team.revokeInvite]', err);
    res.status(500).json({ error: err.message });
  }
};

// Look up the caller's membership in the current school
async function callerMembership(req) {
  const [[m]] = await pool.query(
    `SELECT id, role, is_owner FROM school_memberships
      WHERE user_id = ? AND school_id = ? AND removed_at IS NULL LIMIT 1`,
    [req.user.id, req.user.school_id]
  );
  return m || null;
}

// PATCH /team/members/:id  { role }
exports.updateRole = async (req, res) => {
  if (!requireSchoolAdmin(req, res)) return;
  const schoolId = req.user.school_id;
  const id   = Number(req.params.id);  // target user_id
  const role = String(req.body.role || '').trim();
  if (!['school_admin', 'teacher'].includes(role)) {
    return res.status(400).json({ error: 'Role must be school_admin or teacher.' });
  }
  try {
    const me = await callerMembership(req);
    if (!requireOwner(req, res, me?.is_owner)) return;

    const [[target]] = await pool.query(
      `SELECT id, is_owner FROM school_memberships
        WHERE user_id = ? AND school_id = ? AND removed_at IS NULL`,
      [id, schoolId]
    );
    if (!target) return res.status(404).json({ error: 'Member not found.' });
    if (target.is_owner) return res.status(400).json({ error: "You can't change the owner's role. Transfer ownership first." });

    await pool.query('UPDATE school_memberships SET role = ? WHERE id = ?', [role, target.id]);
    // Mirror to users.role only if this is the user's currently-active school
    await pool.query(
      `UPDATE users SET role = ? WHERE id = ? AND school_id = ?`,
      [role, id, schoolId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[team.updateRole]', err);
    res.status(500).json({ error: err.message });
  }
};

// DELETE /team/members/:id  (remove from THIS school only — soft delete the membership)
exports.removeMember = async (req, res) => {
  if (!requireSchoolAdmin(req, res)) return;
  const schoolId = req.user.school_id;
  const id = Number(req.params.id);
  try {
    if (id === req.user.id) {
      return res.status(400).json({ error: "You can't remove yourself. Ask another admin." });
    }
    const [[target]] = await pool.query(
      `SELECT id, is_owner FROM school_memberships
        WHERE user_id = ? AND school_id = ? AND removed_at IS NULL`,
      [id, schoolId]
    );
    if (!target) return res.status(404).json({ error: 'Member not found.' });
    if (target.is_owner) {
      return res.status(400).json({ error: "You can't remove the owner. Transfer ownership first." });
    }
    await pool.query(
      `UPDATE school_memberships SET removed_at = NOW() WHERE id = ?`,
      [target.id]
    );
    // If the removed user's currently-active school is THIS school, clear it
    // so their next session bounces them to the chooser (or login if no others)
    await pool.query(
      `UPDATE users SET school_id = NULL, role = 'orphan', is_owner = 0
        WHERE id = ? AND school_id = ?`,
      [id, schoolId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[team.removeMember]', err);
    res.status(500).json({ error: err.message });
  }
};

// POST /team/transfer-ownership  { to_user_id, confirm_email }
exports.transferOwnership = async (req, res) => {
  if (!requireSchoolAdmin(req, res)) return;
  const schoolId = req.user.school_id;
  const toUserId = Number(req.body.to_user_id);
  const confirm  = String(req.body.confirm_email || '').trim().toLowerCase();
  if (!toUserId) return res.status(400).json({ error: 'to_user_id required.' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const me = await callerMembership(req);
    if (!requireOwner(req, res, me?.is_owner)) { await conn.rollback(); return; }

    const [[target]] = await conn.query(
      `SELECT sm.id AS membership_id, u.id AS user_id, u.email
         FROM school_memberships sm
         JOIN users u ON u.id = sm.user_id
        WHERE u.id = ? AND sm.school_id = ?
          AND sm.removed_at IS NULL AND u.removed_at IS NULL AND u.is_active = 1`,
      [toUserId, schoolId]
    );
    if (!target) { await conn.rollback(); return res.status(404).json({ error: 'Target member not found.' }); }
    if (target.email.toLowerCase() !== confirm) {
      await conn.rollback();
      return res.status(400).json({ error: 'Confirmation email does not match the chosen member.' });
    }

    // Flip ownership on the memberships
    await conn.query(
      `UPDATE school_memberships SET is_owner = 0
        WHERE user_id = ? AND school_id = ?`,
      [req.user.id, schoolId]
    );
    await conn.query(
      `UPDATE school_memberships SET is_owner = 1, role = 'school_admin'
        WHERE id = ?`,
      [target.membership_id]
    );

    // Mirror to users.is_owner ONLY if THIS school is their currently-active session
    await conn.query(
      `UPDATE users SET is_owner = 0 WHERE id = ? AND school_id = ?`,
      [req.user.id, schoolId]
    );
    await conn.query(
      `UPDATE users SET is_owner = 1, role = 'school_admin' WHERE id = ? AND school_id = ?`,
      [toUserId, schoolId]
    );

    await conn.commit();
    res.json({ ok: true, message: `Ownership transferred to ${target.email}.` });
  } catch (err) {
    await conn.rollback();
    console.error('[team.transferOwnership]', err);
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
};

// GET /team/invitations/:token/preview  (public)
// Lets the invite-acceptance UI show "Sarah invited you to Bloom Studio…"
// before the user signs in.
//
// Always returns 200 with { is_invite: boolean }. This lets the magic-link
// page branch cleanly without relying on HTTP-status sniffing.
//   - { is_invite: false }                    → token isn't an invite (or doesn't exist)
//   - { is_invite: true,  status: 'pending', email, role, school_name, ... }
//   - { is_invite: true,  status: 'expired' | 'used' | 'revoked' }
exports.previewInvite = async (req, res) => {
  const token = String(req.params.token || '').trim();
  if (!token) return res.json({ is_invite: false });
  try {
    const [rows] = await pool.query(
      `SELECT i.email, i.role, i.status, i.created_at,
              s.name AS school_name, s.city AS school_city,
              u.name AS inviter_name,
              mt.expires_at, mt.consumed_at
         FROM invitations i
         JOIN magic_tokens mt ON mt.token = i.token
         JOIN schools s ON s.id = i.school_id
         LEFT JOIN users u ON u.id = i.invited_by_user_id
        WHERE i.token = ?`,
      [token]
    );
    const inv = rows[0];
    if (!inv) return res.json({ is_invite: false });
    if (inv.consumed_at)
      return res.json({ is_invite: true, status: 'used' });
    if (inv.status !== 'pending')
      return res.json({ is_invite: true, status: inv.status });
    if (new Date(inv.expires_at) < new Date())
      return res.json({ is_invite: true, status: 'expired' });
    res.json({
      is_invite:    true,
      status:       'pending',
      email:        inv.email,
      role:         inv.role,
      school_name:  inv.school_name,
      school_city:  inv.school_city,
      inviter_name: inv.inviter_name,
    });
  } catch (err) {
    console.error('[team.previewInvite]', err);
    res.status(500).json({ error: err.message });
  }
};
