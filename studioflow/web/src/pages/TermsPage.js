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

export default function TermsPage() {
  const navigate = useNavigate();
  return (
    <div style={{ minHeight: '100vh', background: '#000', color: '#fff', fontFamily: 'var(--font-d, system-ui, sans-serif)' }}>
      {/* Nav */}
      <div style={{ borderBottom: '1px solid #1a1a1a', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: PURPLE, fontWeight: 700, fontSize: 20, padding: 0 }}>ManchQ</button>
        <span style={{ color: '#444' }}>/</span>
        <span style={{ color: '#888', fontSize: 14 }}>Terms of Service</span>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '60px 24px' }}>
        <h1 style={{ fontSize: 36, fontWeight: 800, marginBottom: 8 }}>Terms of Service</h1>
        <p style={{ color: '#555', fontSize: 14, marginBottom: 48 }}>Last updated: April 28, 2026</p>

        <Section title="1. Acceptance of Terms">
          <p>By accessing or using ManchQ ("the Service"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.</p>
        </Section>

        <Section title="2. Description of Service">
          <p>ManchQ is a dance school management platform that provides tools for scheduling, student management, recital planning, fee tracking, and parent communication. The Service is provided on an "as is" basis and may be updated or changed at any time.</p>
        </Section>

        <Section title="3. Account Registration">
          <ul style={{ paddingLeft: 20 }}>
            <li>You must provide accurate and complete information when registering</li>
            <li>You are responsible for maintaining the security of your account credentials</li>
            <li>You must notify us immediately of any unauthorised access to your account</li>
            <li>One account per school administrator; you may not share login credentials</li>
          </ul>
        </Section>

        <Section title="4. Acceptable Use">
          <p>You agree not to:</p>
          <ul style={{ paddingLeft: 20, marginTop: 8 }}>
            <li>Use the Service for any unlawful purpose</li>
            <li>Upload or transmit malicious code, spam, or harmful content</li>
            <li>Attempt to gain unauthorised access to other accounts or systems</li>
            <li>Resell or sublicense access to the Service without written permission</li>
            <li>Scrape, reverse-engineer, or copy the platform's code or design</li>
          </ul>
        </Section>

        <Section title="5. Your Data">
          <p>You retain full ownership of the data you enter into ManchQ (student records, schedules, etc.). By using the Service you grant ManchQ a limited licence to store and process that data solely to provide the Service. We do not claim ownership of your data. See our <button onClick={() => navigate('/privacy')} style={{ background: 'none', border: 'none', color: PURPLE, cursor: 'pointer', fontSize: 15, padding: 0, textDecoration: 'underline' }}>Privacy Policy</button> for full details.</p>
        </Section>

        <Section title="6. Intellectual Property">
          <p>All content, design, code, and branding of ManchQ are the intellectual property of ManchQ and its creators. You may not reproduce or distribute any part of the platform without prior written consent.</p>
        </Section>

        <Section title="7. Service Availability">
          <p>We aim for high availability but do not guarantee uninterrupted access. We may perform maintenance, updates, or suspend the Service for technical reasons. We will endeavour to notify users of planned downtime in advance.</p>
        </Section>

        <Section title="8. Limitation of Liability">
          <p>To the fullest extent permitted by law, ManchQ shall not be liable for any indirect, incidental, or consequential damages arising from your use of the Service. Our total liability shall not exceed the amount you paid us in the 12 months preceding the claim.</p>
        </Section>

        <Section title="9. Termination">
          <p>We reserve the right to suspend or terminate your account if you violate these Terms. You may delete your account at any time by contacting <a href="mailto:support@manchq.com" style={{ color: PURPLE }}>support@manchq.com</a>. Upon termination, your data will be retained for 30 days and then permanently deleted upon request.</p>
        </Section>

        <Section title="10. Changes to Terms">
          <p>We may update these Terms from time to time. We will notify registered users of material changes via email. Continued use of the Service after changes constitutes acceptance of the revised Terms.</p>
        </Section>

        <Section title="11. Governing Law">
          <p>These Terms are governed by the laws of the jurisdiction in which ManchQ operates. Any disputes shall be resolved through good-faith negotiation before any formal proceedings.</p>
        </Section>

        <Section title="12. Contact">
          <p>Questions about these Terms? Email us at <a href="mailto:support@manchq.com" style={{ color: PURPLE }}>support@manchq.com</a>.</p>
        </Section>
      </div>

      {/* Footer */}
      <div style={{ borderTop: '1px solid #1a1a1a', padding: '24px', textAlign: 'center', color: '#444', fontSize: 13 }}>
        © {new Date().getFullYear()} ManchQ · <button onClick={() => navigate('/privacy')} style={{ background: 'none', border: 'none', color: PURPLE, cursor: 'pointer', fontSize: 13, padding: 0 }}>Privacy Policy</button>
      </div>
    </div>
  );
}
