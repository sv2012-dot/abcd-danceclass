const nodemailer = require('nodemailer');

// Initialize transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

/**
 * Send welcome email to new school administrator
 * @param {string} schoolName - Name of the registered school
 * @param {string} adminEmail - Administrator email address
 * @param {string} adminName - Administrator full name
 * @param {number} schoolId - School ID for dashboard link
 */
const sendWelcomeEmail = async (schoolName, adminEmail, adminName, schoolId) => {
  try {
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const dashboardLink = `${appUrl}/dashboard/${schoolId}/settings`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif;
              line-height: 1.6;
              color: #333;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background: linear-gradient(135deg, #6a7fdb 0%, #8b9fef 100%);
              color: white;
              padding: 30px;
              border-radius: 8px 8px 0 0;
              text-align: center;
            }
            .header h1 {
              margin: 0;
              font-size: 28px;
              font-weight: 700;
            }
            .content {
              background: #f9fafb;
              padding: 30px;
              border-radius: 0 0 8px 8px;
            }
            .greeting {
              font-size: 16px;
              margin-bottom: 20px;
            }
            .section {
              margin: 25px 0;
              padding: 20px;
              background: white;
              border-radius: 6px;
              border-left: 4px solid #6a7fdb;
            }
            .section h2 {
              margin-top: 0;
              color: #6a7fdb;
              font-size: 18px;
            }
            .section ul {
              margin: 10px 0;
              padding-left: 20px;
            }
            .section li {
              margin: 8px 0;
              color: #555;
            }
            .button {
              display: inline-block;
              background: #6a7fdb;
              color: white;
              padding: 14px 32px;
              border-radius: 6px;
              text-decoration: none;
              font-weight: 600;
              margin: 20px 0;
              text-align: center;
              transition: background 0.3s;
            }
            .button:hover {
              background: #5568c4;
            }
            .footer {
              font-size: 12px;
              color: #999;
              text-align: center;
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #eee;
            }
            .footer a {
              color: #6a7fdb;
              text-decoration: none;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Welcome to ManchQ!</h1>
            </div>

            <div class="content">
              <div class="greeting">
                <p>Hi <strong>${adminName}</strong>,</p>
                <p>Your dance school <strong>"${schoolName}"</strong> has been successfully registered on ManchQ. We're excited to help you manage your dance academy!</p>
              </div>

              <div class="section">
                <h2>🚀 Quick Start Guide</h2>
                <ul>
                  <li><strong>Complete Your School Profile:</strong> Add contact information, address, and more details about your school</li>
                  <li><strong>Create Your First Batch:</strong> Set up dance classes and add instructors</li>
                  <li><strong>Invite Teachers & Staff:</strong> Add team members to help manage your school</li>
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
                  <li>Communicate with parents through our parent portal</li>
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
                  <li>📧 Email us: <a href="mailto:support@manchq.com">support@manchq.com</a></li>
                  <li>📚 Check our <a href="${appUrl}/help" style="color: #6a7fdb; text-decoration: none;">documentation</a></li>
                  <li>💬 Contact our support team for personalized assistance</li>
                </ul>
              </div>

              <div class="footer">
                <p>You're receiving this email because you registered a school on ManchQ.</p>
                <p>&copy; ${new Date().getFullYear()} ManchQ. All rights reserved.</p>
                <p>
                  <a href="${appUrl}/PRIVACY_POLICY.md">Privacy Policy</a> |
                  <a href="${appUrl}/TERMS_OF_SERVICE.md">Terms of Service</a>
                </p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    const mailOptions = {
      from: `"${process.env.APP_NAME}" <${process.env.SMTP_USER}>`,
      to: adminEmail,
      subject: `Welcome to ${process.env.APP_NAME}, ${schoolName}!`,
      html: htmlContent,
      text: `Welcome to ${process.env.APP_NAME}!\n\nYour school "${schoolName}" has been successfully registered.\n\nNext steps:\n1. Complete your school profile\n2. Add dance classes/batches\n3. Invite teachers and staff\n4. Enroll students\n\nLogin here: ${appUrl}/dashboard/${schoolId}/settings\n\nNeed help? Email us at support@manchq.com`,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✓ Welcome email sent to ${adminEmail} for school: ${schoolName}`);
    return { success: true, message: 'Welcome email sent successfully' };
  } catch (error) {
    console.error('✗ Failed to send welcome email:', error.message);
    // Don't throw - email failure shouldn't block registration
    return { success: false, error: error.message };
  }
};

/**
 * Verify email service configuration
 */
const verifyEmailConfig = async () => {
  try {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
      console.warn('⚠ Email service not configured. Set SMTP_USER and SMTP_PASSWORD in .env');
      return false;
    }
    await transporter.verify();
    console.log('✓ Email service verified and ready');
    return true;
  } catch (error) {
    console.error('✗ Email service verification failed:', error.message);
    return false;
  }
};

module.exports = {
  sendWelcomeEmail,
  verifyEmailConfig,
};
