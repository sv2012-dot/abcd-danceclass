import React from 'react';
import { useAuth } from '../context/AuthContext';

/* ── Divider ──────────────────────────────────────────────── */
function Divider() {
  return <div style={{ borderTop: '1px solid #e5e5e7', margin: '0' }} />;
}

/* ── Eyebrow label ────────────────────────────────────────── */
function Eyebrow({ children, center }) {
  return (
    <div style={{
      fontSize: 12, fontWeight: 700, letterSpacing: '0.1em',
      textTransform: 'uppercase', color: '#6e6e73',
      marginBottom: 14, textAlign: center ? 'center' : 'left',
    }}>
      {children}
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────── */
export default function SchoolAboutPage() {
  const { school } = useAuth();

  const schoolName = school?.name        || 'Nritya Vahini Academy of Indian Classical Dance';
  const city       = school?.city        || 'Seattle';

  return (
    <div style={{ fontFamily: 'var(--font-sans)', color: '#1d1d1f', background: '#fff', borderRadius: 20, overflow: 'hidden' }}>

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section style={{ padding: '72px 64px 68px', textAlign: 'center', background: '#fff' }}>
        <Eyebrow center>{city}, Washington</Eyebrow>
        <h1 style={{
          fontSize: 48, fontWeight: 900, letterSpacing: '-1.5px',
          lineHeight: 1.08, color: '#1d1d1f', margin: '0 auto 24px',
          maxWidth: 640,
        }}>
          {schoolName}
        </h1>
        <p style={{
          fontSize: 19, color: '#6e6e73', lineHeight: 1.6,
          maxWidth: 520, margin: '0 auto',
          fontWeight: 400,
        }}>
          Dedicated to the ancient art of Bharatanatyam —
          where rhythm, expression, and tradition meet.
        </p>
      </section>

      <Divider />

      {/* ── STAT STRIP ───────────────────────────────────────── */}
      <section style={{
        display: 'flex', padding: '44px 64px',
        background: '#f5f5f7', gap: 0,
      }}>
        {[
          { stat: '15+',          label: 'Years of teaching\nexperience' },
          { stat: 'All ages',     label: 'Children, teens\nand adults' },
          { stat: 'Seattle',      label: 'Pacific Northwest\ncommunity' },
          { stat: 'Chennai',      label: 'Lineage rooted in\nclassical tradition' },
        ].map(({ stat, label }, i, arr) => (
          <div key={stat} style={{
            flex: 1, textAlign: 'center', padding: '0 20px',
            borderRight: i < arr.length - 1 ? '1px solid #d2d2d7' : 'none',
          }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: '#1d1d1f', letterSpacing: '-0.5px', marginBottom: 6 }}>
              {stat}
            </div>
            <div style={{
              fontSize: 13, color: '#6e6e73', lineHeight: 1.5,
              whiteSpace: 'pre-line',
            }}>{label}</div>
          </div>
        ))}
      </section>

      <Divider />

      {/* ── BHSVATANATYAM ────────────────────────────────────── */}
      <section style={{ padding: '72px 64px', background: '#fff' }}>
        <div style={{ display: 'flex', gap: 80, alignItems: 'flex-start' }}>

          {/* Left — headline */}
          <div style={{ flex: '0 0 280px' }}>
            <Eyebrow>The Art Form</Eyebrow>
            <h2 style={{
              fontSize: 36, fontWeight: 900, letterSpacing: '-0.8px',
              lineHeight: 1.1, color: '#1d1d1f', margin: 0,
            }}>
              Bharata­natyam.
            </h2>
            <p style={{ fontSize: 14, color: '#6e6e73', marginTop: 16, lineHeight: 1.6 }}>
              One of the oldest classical dance traditions in the world.
            </p>
          </div>

          {/* Right — content */}
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 16, color: '#1d1d1f', lineHeight: 1.75, marginBottom: 32 }}>
              Rooted in ancient temple traditions of South India, Bharatanatyam
              combines rhythmic footwork, expressive storytelling, sculptural poses,
              and devotional spirit into a single, breathtaking art form.
            </p>

            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6e6e73', marginBottom: 16 }}>
              At our {city} studio, students learn
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 32px' }}>
              {[
                'Foundational adavus (basic movements)',
                'Abhinaya — facial expression & storytelling',
                'Alarippu, Jatiswaram, Varnam, and Padams',
                'Cultural context, rhythm, and classical aesthetics',
              ].map(item => (
                <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#1d1d1f', flexShrink: 0, marginTop: 8 }} />
                  <span style={{ fontSize: 14, color: '#1d1d1f', lineHeight: 1.55 }}>{item}</span>
                </div>
              ))}
            </div>

            <p style={{ fontSize: 13, color: '#6e6e73', marginTop: 24, lineHeight: 1.6, borderTop: '1px solid #e5e5e7', paddingTop: 20 }}>
              Classes welcome children, teens, and adults — with or without prior dance experience.
            </p>
          </div>
        </div>
      </section>

      <Divider />

      {/* ── PHILOSOPHY QUOTE ─────────────────────────────────── */}
      <section style={{ padding: '80px 64px', background: '#f5f5f7', textAlign: 'center' }}>
        <Eyebrow center>Our Philosophy</Eyebrow>
        <blockquote style={{
          fontSize: 30, fontWeight: 800, letterSpacing: '-0.6px',
          lineHeight: 1.25, color: '#1d1d1f',
          maxWidth: 580, margin: '0 auto 28px',
          fontStyle: 'normal',
        }}>
          "Dance is more than performance — it is a journey of discipline,
          cultural connection, and inner expression."
        </blockquote>
        <p style={{ fontSize: 15, color: '#6e6e73', maxWidth: 520, margin: '0 auto', lineHeight: 1.7 }}>
          At Nritya Vahini, Indian classical dance blends body, mind, and emotion
          into a living art form passed down through generations. We cultivate respect
          for tradition, confidence, grace, and a deep connection to musical storytelling.
        </p>
      </section>

      <Divider />

      {/* ── PEOPLE ───────────────────────────────────────────── */}
      <section style={{ padding: '72px 64px', background: '#fff' }}>
        <Eyebrow>The People</Eyebrow>
        <h2 style={{
          fontSize: 36, fontWeight: 900, letterSpacing: '-0.8px',
          lineHeight: 1.1, color: '#1d1d1f', marginBottom: 52,
        }}>
          Guided by masters.
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

          {/* Swapna Varma */}
          <div style={{ display: 'flex', gap: 48, alignItems: 'flex-start', paddingBottom: 52 }}>
            <div style={{
              width: 72, height: 72, borderRadius: 20,
              background: 'linear-gradient(135deg, #1d1d1f 0%, #424245 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, fontWeight: 800, color: '#fff', flexShrink: 0,
              letterSpacing: '-0.5px',
            }}>SV</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#1d1d1f', letterSpacing: '-0.3px', marginBottom: 4 }}>Swapna Varma</div>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6e6e73', marginBottom: 16 }}>Founder &amp; Artistic Director</div>
              <p style={{ fontSize: 15, color: '#1d1d1f', lineHeight: 1.75, margin: 0 }}>
                Ananya founded Nritya Vahini Academy in Seattle with the vision of creating a vibrant
                community space for learning Indian classical dance. Trained in Bharatanatyam from a young
                age in India, she continued her advanced studies after moving to the United States.
                With over 15 years of teaching experience, her style blends traditional rigor with
                encouragement and creativity — helping students build strong technique while
                genuinely loving the art form.
              </p>
            </div>
          </div>

          <Divider />

          {/* Guru Meenakshi */}
          <div style={{ display: 'flex', gap: 48, alignItems: 'flex-start', paddingTop: 52 }}>
            <div style={{
              width: 72, height: 72, borderRadius: 20,
              background: 'linear-gradient(135deg, #6e3367 0%, #a2547d 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, fontWeight: 800, color: '#fff', flexShrink: 0,
              letterSpacing: '-0.5px',
            }}>MN</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#1d1d1f', letterSpacing: '-0.3px', marginBottom: 4 }}>Guru Meenakshi Narayanan</div>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6e6e73', marginBottom: 16 }}>Our Guru in India &nbsp;·&nbsp; Chennai</div>
              <p style={{ fontSize: 15, color: '#1d1d1f', lineHeight: 1.75, margin: '0 0 24px' }}>
                The academy proudly continues its lineage under the guidance of Guru Meenakshi Narayanan,
                a senior Bharatanatyam exponent based in Chennai. With decades of performance and teaching
                experience, she provides ongoing mentorship that keeps the academy deeply connected to
                authentic classical tradition.
              </p>
              <div style={{ display: 'flex', gap: 32 }}>
                {[
                  'Advanced choreography guidance',
                  'Online workshops & masterclasses',
                  'Curriculum rooted in traditional pedagogy',
                ].map(item => (
                  <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flex: 1 }}>
                    <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#6e6e73', flexShrink: 0, marginTop: 8 }} />
                    <span style={{ fontSize: 13, color: '#6e6e73', lineHeight: 1.55 }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <Divider />

      {/* ── WELCOME ──────────────────────────────────────────── */}
      <section style={{ padding: '80px 64px', background: '#f5f5f7', textAlign: 'center' }}>
        <Eyebrow center>New Students</Eyebrow>
        <h2 style={{
          fontSize: 40, fontWeight: 900, letterSpacing: '-1px',
          lineHeight: 1.1, color: '#1d1d1f', margin: '0 auto 20px',
          maxWidth: 560,
        }}>
          Your journey begins here.
        </h2>
        <p style={{
          fontSize: 17, color: '#6e6e73', lineHeight: 1.7,
          maxWidth: 480, margin: '0 auto 44px',
        }}>
          We warmly welcome students of all backgrounds. Whether you are discovering
          Bharatanatyam for the first time or continuing your journey, Nritya Vahini
          offers a supportive and inspiring space to learn.
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
          {[
            'Beginner-friendly classes',
            'Small group instruction',
            'Performance opportunities',
            `Cultural community in ${city}`,
          ].map(label => (
            <div key={label} style={{
              background: '#fff', border: '1px solid #d2d2d7',
              borderRadius: 999, padding: '9px 20px',
              fontSize: 14, fontWeight: 500, color: '#1d1d1f',
            }}>
              {label}
            </div>
          ))}
        </div>

        <p style={{ fontSize: 14, color: '#6e6e73', marginTop: 40, fontStyle: 'italic' }}>
          Come dance with us and experience the joy of rhythm, expression, and tradition.
        </p>
      </section>

    </div>
  );
}
