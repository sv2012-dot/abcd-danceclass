import React, { useEffect } from 'react';
export default function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const handler = e => { if(e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);
  return (
    <div onClick={e => { if(e.target === e.currentTarget) onClose(); }} style={{position:'fixed',inset:0,background:'rgba(20,10,30,0.6)',backdropFilter:'blur(4px)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
      <div style={{background:'var(--card)',borderRadius:20,width:'100%',maxWidth:wide?680:460,maxHeight:'90vh',overflow:'auto',boxShadow:'0 24px 60px rgba(0,0,0,0.35)'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'20px 24px 0'}}>
          <h2 style={{fontFamily:'var(--font-d)',fontSize:18,color:'var(--text)'}}>{title}</h2>
          <button onClick={onClose} style={{background:'none',border:'none',color:'var(--muted)',cursor:'pointer',fontSize:20,lineHeight:1,padding:'2px 6px'}}>×</button>
        </div>
        <div style={{padding:'20px 24px 24px'}}>{children}</div>
      </div>
    </div>
  );
}