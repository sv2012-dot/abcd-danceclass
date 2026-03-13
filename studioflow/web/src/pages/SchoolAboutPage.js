import React from 'react';
import { useAuth } from '../context/AuthContext';

/* ── helpers ──────────────────────────────────────────────── */
function initials(name = '') {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
}
function schoolGradient(name = '') {
  const h1 = (name.charCodeAt(0) * 37 + (name.charCodeAt(1) || 0) * 13) % 360;
  const h2 = (h1 + 38) % 360;
  return `linear-gradient(135deg, hsl(${h1},62%,42%) 0%, hsl(${h2},55%,35%) 100%)`;
}

/* ── sub-components ───────────────────────────────────────── */
function SectionCard({ children, style }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 16,
      padding: '28px 32px',
      ...style,
    }}>
      {children}
    </div>
  );
}

function SectionTitle({ icon, title }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
      {icon && <span style={{ fontSize: 22 }}>{icon}</span>}
      <h2 style={{
        fontSize: 16, fontWeight: 800, color: 'var(--text)',
        margin: 0, letterSpacing: '-0.3px',
      }}>{title}</h2>
    </div>
  );
}

function BulletList({ items }) {
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
      {items.map((item, i) => (
        <li key={i} style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          marginBottom: 8, fontSize: 14, color: 'var(--text)', lineHeight: 1.6,
        }}>
          <span style={{ color: 'var(--accent)', marginTop: 3, flexShrink: 0, fontSize: 12 }}>◆</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function PersonCard({ name, role, description, initial }) {
  return (
    <div style={{
      display: 'flex', gap: 18, alignItems: 'flex-start',
    }}>
      <div style={{
        width: 52, height: 52, borderRadius: 14, background: 'var(--accent)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, fontWeight: 800, color: '#fff', flexShrink: 0,
        opacity: 0.9,
      }}>
        {initial}
      </div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', marginBottom: 2 }}>{name}</div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>{role}</div>
        <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.7, margin: 0 }}>{description}</p>
      </div>
    </div>
  );
}

/* ── page ─────────────────────────────────────────────────── */
export default function SchoolAboutPage() {
  const { school } = useAuth();

  const schoolName  = school?.name        || 'Nritya Vahini Academy of Indian Classical Dance';
  const danceStyle  = school?.dance_style || 'Bharatanatyam';
  const city        = school?.city        || 'Seattle';
  const brief       = [danceStyle, city].filter(Boolean).join(' · ');

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>

      {/* ── Hero ─────────────────────────────────────────── */}
      <div style={{
        background: schoolGradient(schoolName),
        borderRadius: 20,
        padding: '36px 36px 32px',
        marginBottom: 24,
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* decorative ring */}
        <div style={{
          position: 'absolute', right: -40, top: -40,
          width: 200, height: 200, borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.12)',
        }} />
        <div style={{
          position: 'absolute', right: -80, top: -80,
          width: 300, height: 300, borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.07)',
        }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 16 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: 'rgba(255,255,255,0.18)',
            backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, fontWeight: 800, color: '#fff',
            flexShrink: 0, border: '1.5px solid rgba(255,255,255,0.25)',
          }}>
            {initials(schoolName)}
          </div>
          <div>
            <h1 style={{
              fontSize: 22, fontWeight: 900, color: '#fff',
              margin: '0 0 4px', lineHeight: 1.2, letterSpacing: '-0.4px',
            }}>
              {schoolName}
            </h1>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: 500 }}>
              {brief}
            </div>
          </div>
        </div>

        {/* logo concept note */}
        <div style={{
          background: 'rgba(255,255,255,0.12)', borderRadius: 12, padding: '12px 16px',
          border: '1px solid rgba(255,255,255,0.18)',
        }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Logo Concept</div>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', margin: 0, lineHeight: 1.6 }}>
            A stylized bronze Nataraja silhouette encircled by flowing wave motifs representing the Pacific Northwest,
            with a lotus at the base symbolizing purity and learning. The academy name appears below in elegant serif
            lettering with subtle temple-inspired design elements.
          </p>
        </div>
      </div>

      {/* ── Two-col grid: Art Form + Philosophy ──────────── */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 20 }}>

        {/* Bharatanatyam */}
        <SectionCard style={{ flex: 1 }}>
          <SectionTitle icon="🪷" title="About Bharatanatyam" />
          <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.7, margin: '0 0 16px' }}>
            Nritya Vahini specializes in Bharatanatyam, one of the oldest and most expressive Indian classical dance
            traditions. Rooted in ancient temple traditions of South India, it combines rhythmic footwork, expressive
            storytelling, sculptural poses, and devotional spirit.
          </p>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            At our {city} studio, students learn:
          </div>
          <BulletList items={[
            'Foundational adavus (basic movements)',
            'Abhinaya (facial expression and storytelling)',
            'Traditional repertoire — Alarippu, Jatiswaram, Varnam, and Padams',
            'Cultural context, rhythm, and classical aesthetics',
          ]} />
          <div style={{
            marginTop: 14, fontSize: 12, color: 'var(--muted)', fontStyle: 'italic',
            borderTop: '1px solid var(--border)', paddingTop: 12,
          }}>
            Classes welcome children, teens, and adults with or without prior experience.
          </div>
        </SectionCard>

        {/* Philosophy */}
        <SectionCard style={{ flex: 1 }}>
          <SectionTitle icon="🕉️" title="Our Dance Philosophy" />
          <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.7, margin: '0 0 16px' }}>
            At Nritya Vahini, we believe dance is more than performance — it is a journey of discipline,
            cultural connection, and inner expression. Indian classical dance blends body, mind, and emotion
            into a living art form passed down through generations.
          </p>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            Our teaching emphasizes:
          </div>
          <BulletList items={[
            'Respect for tradition and lineage (guru-shishya parampara)',
            'Building confidence, grace, and stage presence',
            'Developing musicality, storytelling, and cultural understanding',
          ]} />
          <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, margin: '14px 0 0', fontStyle: 'italic', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            We strive to create a nurturing environment where students grow not only as dancers, but as thoughtful artists connected to a rich heritage.
          </p>
        </SectionCard>
      </div>

      {/* ── People ────────────────────────────────────────── */}
      <SectionCard style={{ marginBottom: 20 }}>
        <SectionTitle icon="👩‍🏫" title="Our People" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

          <PersonCard
            initial="AR"
            name="Ananya Rao"
            role="Founder &amp; Artistic Director"
            description="Ananya Rao founded Nritya Vahini Academy in Seattle with the vision of creating a vibrant community space for learning Indian classical dance. She trained in Bharatanatyam from a young age in India and continued her advanced studies after moving to the United States. With over 15 years of training and teaching experience, Ananya is passionate about sharing the depth and beauty of Bharatanatyam with the next generation. Her teaching style blends traditional rigor with encouragement and creativity."
          />

          <div style={{ borderTop: '1px solid var(--border)' }} />

          <PersonCard
            initial="MN"
            name="Guru Meenakshi Narayanan"
            role="Our Guru in India · Chennai"
            description="The academy proudly continues its lineage under the guidance of Guru Meenakshi Narayanan, a senior Bharatanatyam exponent based in Chennai, India. She brings decades of performance and teaching experience, providing ongoing mentorship through advanced choreography guidance, periodic online workshops and masterclasses, and curriculum development rooted in traditional pedagogy. Her blessings ensure the academy remains deeply connected to authentic classical tradition."
          />
        </div>
      </SectionCard>

      {/* ── Welcome CTA ──────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, hsl(330,55%,97%) 0%, hsl(280,50%,97%) 100%)',
        border: '1px solid hsl(330,40%,88%)',
        borderRadius: 16,
        padding: '28px 32px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 28, marginBottom: 10 }}>🙏</div>
        <h2 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', margin: '0 0 10px', letterSpacing: '-0.3px' }}>
          Welcome to New Students
        </h2>
        <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.7, margin: '0 0 20px', maxWidth: 520, marginLeft: 'auto', marginRight: 'auto' }}>
          We warmly welcome students of all backgrounds to explore the beauty of Indian classical dance.
          Whether you are discovering Bharatanatyam for the first time or continuing your artistic journey,
          Nritya Vahini Academy offers a supportive and inspiring space to learn.
        </p>

        {/* badges */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginBottom: 20 }}>
          {[
            { emoji: '✨', label: 'Beginner-friendly classes' },
            { emoji: '👥', label: 'Small group instruction' },
            { emoji: '🎭', label: 'Performance opportunities' },
            { emoji: '🌸', label: `Cultural community in ${city}` },
          ].map(({ emoji, label }) => (
            <div key={label} style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              background: '#fff', border: '1px solid hsl(330,35%,85%)',
              borderRadius: 999, padding: '6px 14px',
              fontSize: 13, fontWeight: 600, color: 'var(--text)',
            }}>
              <span>{emoji}</span><span>{label}</span>
            </div>
          ))}
        </div>

        <p style={{ fontSize: 14, color: 'hsl(330,50%,40%)', fontWeight: 600, margin: '0 0 4px' }}>
          Come dance with us and experience the joy of rhythm, expression, and tradition.
        </p>
        <p style={{ fontSize: 13, color: 'var(--muted)', fontStyle: 'italic', margin: 0 }}>
          Your journey in Bharatanatyam begins here.
        </p>
      </div>

    </div>
  );
}
