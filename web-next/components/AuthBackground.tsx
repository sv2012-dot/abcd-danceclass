'use client';

// AuthBackground — shared video + dark gradient background for /login and
// /register. Centers its children, full viewport height, heavy blur on the
// video so the foreground content stays the focus.

import { ReactNode } from 'react';

export default function AuthBackground({ children }: { children: ReactNode }) {
  return (
    <div style={{
      position: 'relative',
      minHeight: '100vh',
      width: '100%',
      overflow: 'hidden',
      background: '#08060F',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 20px',
      boxSizing: 'border-box',
    }}>
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
      {children}
    </div>
  );
}
