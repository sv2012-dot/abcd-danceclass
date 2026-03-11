import React from 'react';
const PRESET = { Paid:'#52c4a0', Pending:'#f4a041', Overdue:'#e05c6a', Waived:'#8ab4c0', Planning:'#6a7fdb', Confirmed:'#52c4a0', Rehearsals:'#f4a041', Completed:'#8ab4c0', Cancelled:'#e05c6a' };
export default function Badge({ children, color }) {
  const bg = color || PRESET[children] || '#8a7a9a';
  return <span style={{display:'inline-block',padding:'2px 9px',borderRadius:20,fontSize:11,fontWeight:700,background:bg,color:'#fff'}}>{children}</span>;
}