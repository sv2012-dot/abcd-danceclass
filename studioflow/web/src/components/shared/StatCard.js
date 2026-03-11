import React from 'react';
import Card from './Card';
export default function StatCard({ label, value, icon, color, sub }) {
  return (
    <Card style={{display:'flex',alignItems:'center',gap:14,padding:18}}>
      <div style={{width:44,height:44,borderRadius:12,background:color+'22',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0}}>{icon}</div>
      <div>
        <div style={{fontSize:26,fontWeight:800,fontFamily:'var(--font-d)',color:color||'var(--text)',lineHeight:1}}>{value}</div>
        <div style={{fontSize:12,color:'var(--muted)',marginTop:2}}>{label}</div>
        {sub && <div style={{fontSize:11,color:'var(--muted)',marginTop:1}}>{sub}</div>}
      </div>
    </Card>
  );
}