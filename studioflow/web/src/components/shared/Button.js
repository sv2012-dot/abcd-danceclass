import React from 'react';
const styles = {
  primary: { background:'var(--accent)', color:'#fff', border:'none' },
  outline: { background:'transparent', color:'var(--text)', border:'1.5px solid var(--border)' },
  danger:  { background:'var(--danger)', color:'#fff', border:'none' },
  ghost:   { background:'var(--surface)', color:'var(--text)', border:'none' },
};
export default function Button({ children, variant='primary', size='md', onClick, disabled, type='button', style:s, icon }) {
  const base = { display:'inline-flex', alignItems:'center', gap:6, fontWeight:600, cursor:'pointer', transition:'all .15s', borderRadius:10, fontFamily:'var(--font-b)', opacity:disabled?.5:1 };
  const sizes = { sm:{padding:'6px 12px',fontSize:12}, md:{padding:'10px 20px',fontSize:14}, lg:{padding:'13px 26px',fontSize:15} };
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{...base,...styles[variant],...sizes[size],...s}}>
      {icon && <span>{icon}</span>}{children}
    </button>
  );
}