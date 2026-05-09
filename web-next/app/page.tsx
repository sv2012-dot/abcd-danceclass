'use client';

export default function Home() {
  // Redirect to login on page load
  if (typeof window !== 'undefined') {
    window.location.replace('/login');
  }

  return null;
}
