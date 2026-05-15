'use client';

// AuthBackground — shared full-viewport frame for /login, /register, and
// /auth/choose-school. Theme-aware:
//   - dark mode  → blurred video (dancers) + dark overlay
//   - light mode → soft purple-lavender gradient + brand-tinted radial blobs
//     (no video; the source footage is dark studio lighting and would clash
//     with a bright palette).

import { ReactNode } from 'react';
import { useTheme } from '@/lib/context/ThemeContext';

export default function AuthBackground({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div style={{
      position: 'relative',
      // 100dvh = dynamic visible viewport (excludes mobile browser chrome) so
      // the island stays centered in what the user actually sees on iOS Safari.
      minHeight: '100dvh',
      width: '100%',
      overflow: 'hidden',
      background: isDark ? '#08060F' : '#F5EEFF',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 20px',
      boxSizing: 'border-box',
    }}>
      {isDark ? (
        <>
          <video
            autoPlay
            muted
            loop
            playsInline
            aria-hidden
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              objectFit: 'cover', filter: 'blur(14px)', transform: 'scale(1.1)', zIndex: 0,
            }}
          >
            <source src="/manchq-hero-bg-long.mp4" type="video/mp4" />
          </video>
          <div aria-hidden style={{
            position: 'absolute', inset: 0, zIndex: 1,
            background: 'linear-gradient(to bottom, rgba(8,6,15,0.94) 0%, rgba(8,6,15,0.80) 30%, rgba(8,6,15,0.80) 70%, rgba(8,6,15,0.96) 100%)',
            pointerEvents: 'none',
          }} />
        </>
      ) : (
        <>
          <div aria-hidden style={{
            position: 'absolute', inset: 0, zIndex: 0,
            background: 'linear-gradient(145deg, #F0E8FF 0%, #F8F2FF 30%, #EEF2FF 60%, #F5EEFF 100%)',
            pointerEvents: 'none',
          }} />
          <div aria-hidden style={{
            position: 'absolute', top: '-20%', right: '-10%', width: 400, height: 400,
            borderRadius: '50%', zIndex: 1,
            background: 'radial-gradient(circle, rgba(220,78,255,0.20) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />
          <div aria-hidden style={{
            position: 'absolute', bottom: '-20%', left: '-10%', width: 500, height: 500,
            borderRadius: '50%', zIndex: 1,
            background: 'radial-gradient(circle, rgba(124,58,237,0.18) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />
        </>
      )}
      {children}
    </div>
  );
}
