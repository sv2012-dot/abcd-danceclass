import React from 'react';
export default function Card({ children, style, onClick, className }) {
  return (
    <div onClick={onClick} className={className} style={{
      background:'var(--card)', borderRadius:'var(--radius)', padding:20,
      border:'1px solid var(--border)', boxShadow:'var(--shadow)',
      cursor:onClick?'pointer':'default', ...style
    }}>{children}</div>
  );
}