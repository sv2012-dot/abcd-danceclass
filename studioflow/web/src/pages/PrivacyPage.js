import React from 'react';
import { useNavigate } from 'react-router-dom';

const PURPLE = '#7C3AED';

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 36 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 12, borderLeft: `3px solid ${PURPLE}`, paddingLeft: 12 }}>{title}</h2>
      <div style={{ color: '#aaa', lineHeight: 1.8, fontSize: 15 }}>{children}</div>
    </div>
  );
}

export default function PrivacyPage() {
  const navigate = useNavigate();
  return (
    <div style={{ minHeight: '100vh', background: '#000', color: '#fff', fontFamily: 'var(--font-d, system-ui, sans-serif)' }}>
      {/* Nav */}
      <div style={{ borderBottom: '1px solid #1a1a1a', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: PURPLE, fontWeight: 700, fontSize: 20, padding: 0 }}>ManchQ</button>
        <span style={{ color: '#444' }}>/</span>
        <span style={{ color: '#888', fontSize: 14 }}>Privacy Policy</span>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '60px 24px' }}>
        <h1 style={{ fontSize: 36, fontWeight: 800, marginBottom: 8 }}>Privacy Policy</h1>
        <p style={{ color: '#555', fontSize: 14, marginBottom: 48 }}>Last updated: April 28, 2026</p>

        <Section title="1. What We Collect">
          <p>When you register a school or log in via Google, we collect:</p>
          <ul style={{ paddingLeft: 20, marginTop: 8 }}>
            <li>Your name and email address</li>
            <li>Your school's name, city, and dance style</li>
            <li>Usage data (pages visited, features used) to improve the platform</li>
          </ul>
          <p style={{ marginTop: 12 }}>We do <strong style={{ color: '#fff' }}>not</strong> collect payment card details — billing, if applicable, is handled by a third-party payment processor.</p>
        </Section>

        <Section title="2. How We Use Your Data">
          <ul style={{ paddingLeft: 20 }}>
            <li>To provide and operate the ManchQ platform</li>
            <li>To send onboarding and transactional emails (e.g. welcome email on registration)</li>
            <li>To authenticate your identity via Google OAuth</li>
            <li>To improve features based on aggregated, anonymised usage patterns</li>
          </ul>
          <p style={{ marginTop: 12 }}>We do <strong style={{ color: '#fff' }}>not</strong> sell your data to any third party, ever.</p>
        </Section>

        <Section title="3. Google OAuth">
          <p>If you sign in with Google, we receive your name, email address, and profile picture from Google. We store only your name and email. We do not access your Google contacts, Drive, or any other Google service beyond basic identity.</p>
        </Section>

        <Section title="4. Data Storage & Security">
          <p>Your data is stored on secured servers hosted via Railway (database) and Vercel (web). We use industry-standard encryption in transit (HTTPS/TLS) and at rest. Passwords are hashed with bcrypt and never stored in plain text.</p>
        </Section>

        <Section title="5. Data Retention">
          <p>We retain your account data for as long as your account is active. You may request deletion of your account and associated data at any time by emailing <a href="mailto:support@manchq.com" style={{ color: PURPLE }}>support@manchq.com</a>. We will process deletion requests within 30 days.</p>
        </Section>

        <Section title="6. Cookies">
          <p>We use session storage and local storage to keep you logged in. We do not use third-party advertising cookies. Analytics, if any, are privacy-respecting and do not track you across other websites.</p>
        </Section>

        <Section title="7. Your Rights">
          <p>Depending on your jurisdiction you may have the right to access, correct, export, or delete your personal data. To exercise any of these rights, contact us at <a href="mailto:support@manchq.com" style={{ color: PURPLE }}>support@manchq.com</a>.</p>
        </Section>

        <Section title="8. Changes to This Policy">
          <p>We may update this policy from time to time. We'll notify registered users of material changes via email. Continued use of ManchQ after changes constitutes acceptance of the updated policy.</p>
        </Section>

        <Section title="9. Contact">
          <p>Questions? Reach us at <a href="mailto:support@manchq.com" style={{ color: PURPLE }}>support@manchq.com</a>.</p>
        </Section>
      </div>

      {/* Footer */}
      <div style={{ borderTop: '1px solid #1a1a1a', padding: '24px', textAlign: 'center', color: '#444', fontSize: 13 }}>
        © {new Date().getFullYear()} ManchQ · <button onClick={() => navigate('/terms')} style={{ background: 'none', border: 'none', color: PURPLE, cursor: 'pointer', fontSize: 13, padding: 0 }}>Terms of Service</button>
      </div>
    </div>
  );
}
