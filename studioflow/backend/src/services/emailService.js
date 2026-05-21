// Email service — uses Resend's HTTPS API instead of SMTP.
//
// Why: Gmail SMTP from cloud-hosted backends (Railway, Render, Fly,
// Heroku) consistently times out or gets silently blocked by Gmail's
// anti-spam. Resend uses a normal HTTPS API call on port 443, has
// dedicated transactional-email IP reputation, and ships in <100ms.
//
// Env required:
//   RESEND_API_KEY  — get one at https://resend.com/api-keys
//   EMAIL_FROM      — optional; defaults to 'ManchQ <noreply@manchq.com>'
//                     Whatever address you use here must come from a
//                     domain verified in your Resend dashboard.
//
// All exports keep the same name + signature as the previous nodemailer
// implementation so no caller needs to change.

const { Resend } = require('resend');

// Lazy-init: the Resend constructor throws if no key is supplied, which
// would crash the backend at boot if RESEND_API_KEY isn't set yet (during
// migration, in CI, in dev without an account, etc.). Build the client
// on first use instead, and degrade gracefully when the key is missing.
let resendClient = null;
function getResend() {
  if (resendClient) return resendClient;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  resendClient = new Resend(key);
  return resendClient;
}

const FROM = process.env.EMAIL_FROM || 'ManchQ <noreply@manchq.com>';
const SUPPORT = 'support@manchq.com';

/**
 * Send the email through Resend and log the result with a consistent
 * shape. Never throws — email failure should never block the caller's
 * core flow (sign-in, registration, invitation).
 */
async function sendEmail(opts, label) {
  const resend = getResend();
  if (!resend) {
    console.warn(`⚠ ${label} skipped — RESEND_API_KEY not set`);
    return { success: false, error: 'RESEND_API_KEY not configured' };
  }
  try {
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
    if (error) {
      console.error(`✗ Failed to send ${label}:`, error.message || error);
      return { success: false, error: error.message || String(error) };
    }
    console.log(`✓ ${label} sent to ${opts.to} (id: ${data?.id})`);
    return { success: true, id: data?.id };
  } catch (err) {
    console.error(`✗ Failed to send ${label}:`, err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Welcome email — new school admin registration.
 */
const sendWelcomeEmail = async (schoolName, adminEmail, adminName, schoolId) => {
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const dashboardLink = `${appUrl}/dashboard/${schoolId}/settings`;
  const appName = process.env.APP_NAME || 'ManchQ';

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #7C3AED 0%, #DC4EFF 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
          .header h1 { margin: 0; font-size: 28px; font-weight: 700; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .section { margin: 25px 0; padding: 20px; background: white; border-radius: 6px; border-left: 4px solid #7C3AED; }
          .section h2 { margin-top: 0; color: #7C3AED; font-size: 18px; }
          .section ul { margin: 10px 0; padding-left: 20px; }
          .section li { margin: 8px 0; color: #555; }
          .button { display: inline-block; background: linear-gradient(135deg, #7C3AED 0%, #DC4EFF 100%); color: white; padding: 14px 32px; border-radius: 9px; text-decoration: none; font-weight: 600; margin: 20px 0; }
          .footer { font-size: 12px; color: #999; text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; }
          .footer a { color: #7C3AED; text-decoration: none; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header"><h1>🎉 Welcome to ${appName}!</h1></div>
          <div class="content">
            <p>Hi <strong>${adminName}</strong>,</p>
            <p>Your dance school <strong>"${schoolName}"</strong> has been successfully registered on ${appName}. We're excited to help you manage your dance academy!</p>
            <div class="section">
              <h2>🚀 Quick Start Guide</h2>
              <ul>
                <li><strong>Complete Your School Profile:</strong> Add contact information, address, and more details about your school</li>
                <li><strong>Create Your First Batch:</strong> Set up dance classes and add instructors</li>
                <li><strong>Invite Teachers &amp; Staff:</strong> Add team members to help manage your school</li>
                <li><strong>Enroll Students:</strong> Start building your student roster</li>
              </ul>
            </div>
            <div class="section">
              <h2>📋 What You Can Do</h2>
              <ul>
                <li>Manage student enrollments and attendance</li>
                <li>Schedule classes and create batches</li>
                <li>Organize recitals and performances</li>
                <li>Track fees and payments</li>
                <li>Send announcements, fee reminders, and recital updates from one place</li>
                <li>Manage studios, vendors, and resources</li>
              </ul>
            </div>
            <div style="text-align: center;">
              <a href="${dashboardLink}" class="button">Complete Your School Profile</a>
            </div>
            <div class="section">
              <h2>❓ Need Help?</h2>
              <p>If you have any questions or need assistance setting up your school:</p>
              <ul>
                <li>📧 Email us: <a href="mailto:${SUPPORT}">${SUPPORT}</a></li>
                <li>📚 Check our <a href="${appUrl}/help">documentation</a></li>
                <li>💬 Contact our support team for personalized assistance</li>
              </ul>
            </div>
            <div class="footer">
              <p>You're receiving this email because you registered a school on ${appName}.</p>
              <p>&copy; ${new Date().getFullYear()} ${appName}. All rights reserved.</p>
              <p>
                <a href="${appUrl}/privacy">Privacy Policy</a> |
                <a href="${appUrl}/terms">Terms of Service</a>
              </p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail(
    {
      to: adminEmail,
      subject: `Welcome to ${appName}, ${schoolName}!`,
      html,
      text: `Welcome to ${appName}!\n\nYour school "${schoolName}" has been successfully registered.\n\nNext steps:\n1. Complete your school profile\n2. Add dance classes/batches\n3. Invite teachers and staff\n4. Enroll students\n\nLogin here: ${dashboardLink}\n\nNeed help? Email us at ${SUPPORT}`,
    },
    'welcome email',
  );
};

/**
 * Magic-link sign-in email.
 */
const sendMagicLinkEmail = async (toEmail, link) => {
  const appName = process.env.APP_NAME || 'ManchQ';
  const html = `
    <!DOCTYPE html>
    <html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;padding:24px;">
      <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <div style="text-align:center;margin-bottom:24px;">
          <div style="font-size:22px;font-weight:700;color:#111;letter-spacing:-0.5px;">${appName}</div>
          <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.08em;margin-top:4px;">Dance school management</div>
        </div>
        <h2 style="font-size:18px;margin:0 0 12px;color:#111;">Your sign-in link</h2>
        <p style="font-size:14px;color:#444;line-height:1.55;margin:0 0 24px;">
          Click the button below to sign in to ${appName}. This link expires in 15 minutes and can only be used once.
        </p>
        <div style="text-align:center;margin:24px 0;">
          <a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#7C3AED 0%,#DC4EFF 100%);color:#fff;padding:13px 28px;border-radius:9px;font-weight:700;font-size:14px;text-decoration:none;">Sign in to ${appName} &rarr;</a>
        </div>
        <p style="font-size:12px;color:#888;line-height:1.55;margin:24px 0 0;word-break:break-all;">
          Or copy this link into your browser:<br/>
          <a href="${link}" style="color:#7C3AED;">${link}</a>
        </p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0;"/>
        <p style="font-size:11px;color:#999;margin:0;">
          If you didn't request this, you can safely ignore this email.<br/>
          &mdash; ${appName} &middot; <a href="mailto:${SUPPORT}" style="color:#7C3AED;">${SUPPORT}</a>
        </p>
      </div>
    </body></html>
  `;
  return sendEmail(
    {
      to: toEmail,
      subject: `Your ${appName} sign-in link`,
      html,
      text: `Sign in to ${appName}:\n\n${link}\n\nThis link expires in 15 minutes.\nIf you didn't request it, ignore this email.`,
    },
    'magic-link email',
  );
};

/**
 * Team-invitation email.
 */
const sendInvitationEmail = async (toEmail, link, inviterName, schoolName, role) => {
  const appName = process.env.APP_NAME || 'ManchQ';
  const roleLabel = role === 'school_admin' ? 'Admin' : role === 'teacher' ? 'Teacher' : role;
  const html = `
    <!DOCTYPE html>
    <html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;padding:24px;">
      <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <div style="text-align:center;margin-bottom:24px;">
          <div style="font-size:22px;font-weight:700;color:#111;letter-spacing:-0.5px;">${appName}</div>
          <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.08em;margin-top:4px;">Dance school management</div>
        </div>
        <h2 style="font-size:18px;margin:0 0 12px;color:#111;">You've been invited</h2>
        <p style="font-size:14px;color:#444;line-height:1.6;margin:0 0 16px;">
          <strong>${inviterName || 'A teammate'}</strong> invited you to join
          <strong>${schoolName}</strong> on ${appName} as <strong>${roleLabel}</strong>.
        </p>
        <p style="font-size:14px;color:#444;line-height:1.55;margin:0 0 24px;">
          Click the button below to accept &mdash; you'll be signed in right away. No password needed. This invite expires in 7 days.
        </p>
        <div style="text-align:center;margin:24px 0;">
          <a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#7C3AED 0%,#DC4EFF 100%);color:#fff;padding:13px 28px;border-radius:9px;font-weight:700;font-size:14px;text-decoration:none;">Accept invite &rarr;</a>
        </div>
        <p style="font-size:12px;color:#888;line-height:1.55;margin:24px 0 0;word-break:break-all;">
          Or copy this link:<br/>
          <a href="${link}" style="color:#7C3AED;">${link}</a>
        </p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0;"/>
        <p style="font-size:11px;color:#999;margin:0;">
          Didn't expect this invite? Just ignore the email.<br/>
          &mdash; ${appName} &middot; <a href="mailto:${SUPPORT}" style="color:#7C3AED;">${SUPPORT}</a>
        </p>
      </div>
    </body></html>
  `;
  return sendEmail(
    {
      to: toEmail,
      subject: `${inviterName || 'A teammate'} invited you to ${schoolName} on ${appName}`,
      html,
      text: `${inviterName || 'A teammate'} invited you to join ${schoolName} on ${appName} as ${roleLabel}.\n\nAccept the invite:\n${link}\n\nThis invite expires in 7 days.`,
    },
    'invitation email',
  );
};

/**
 * Boot-time verification — just confirms the API key is present.
 * (Resend doesn't have a "ping" endpoint, and we don't want to waste a
 * send-quota check; if the key is wrong we'll find out on first send.)
 */
const verifyEmailConfig = async () => {
  if (!process.env.RESEND_API_KEY) {
    console.warn('⚠ Email service not configured. Set RESEND_API_KEY in env.');
    return false;
  }
  console.log('✓ Email service configured (Resend)');
  return true;
};

module.exports = {
  sendWelcomeEmail,
  sendMagicLinkEmail,
  sendInvitationEmail,
  verifyEmailConfig,
};
