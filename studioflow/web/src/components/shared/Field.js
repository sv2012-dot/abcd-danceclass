import React from 'react';
const inp = { width:'100%', background:'#faf8fc', border:'1.5px solid var(--border)', borderRadius:9, padding:'9px 13px', fontSize:14, color:'var(--text)', fontFamily:'var(--font-b)' };
export function Field({ label, children }) {
  return (
    <div style={{marginBottom:14}}>
      <label style={{display:'block',fontSize:11,fontWeight:700,letterSpacing:'0.07em',textTransform:'uppercase',color:'var(--muted)',marginBottom:5}}>{label}</label>
      {children}
    </div>
  );
}
export function Input(props) { return <input {...props} style={{...inp,...props.style}} />; }
export function Select({ children, ...props }) { return <select {...props} style={{...inp,...props.style}}>{children}</select>; }
export function Textarea(props) { return <textarea {...props} style={{...inp,minHeight:80,resize:'vertical',...props.style}} />; }