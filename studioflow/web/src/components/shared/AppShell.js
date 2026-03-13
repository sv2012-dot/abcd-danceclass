import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const NAV_ITEMS = {
  superadmin: [
    { to:'/', label:'Home', icon:'🏠' },
    { to:'/schools', label:'Schools', icon:'🏫' },
  ],
  school_admin: [
    { to:'/', label:'Home', icon:'🏠' },
    { to:'/students', label:'Students', icon:'👤' },
    { to:'/batches', label:'Batches', icon:'📚' },
    { to:'/recitals', label:'Recitals', icon:'⭐' },
    { to:'/fees', label:'Fees', icon:'💳' },
    { to:'/users', label:'Users', icon:'👥' },
  ],
  teacher: [
    { to:'/', label:'Home', icon:'🏠' },
    { to:'/students', label:'Students', icon:'👤' },
    { to:'/batches', label:'Batches', icon:'📚' },
    { to:'/recitals', label:'Recitals', icon:'⭐' },
  ],
  parent: [
    { to:'/', label:'Home', icon:'🏠' },
    { to:'/parent', label:'My Children', icon:'👨‍👧' },
    { to:'/recitals', label:'Recitals', icon:'⭐' },
  ],
};

const s = {
  shell: { display:'flex', height:'100vh', overflow:'hidden' },
  sidebar: { width:210, background:'#1e1228', display:'flex', flexDirection:'column', flexShrink:0, height:'100vh' },
  logo: { padding:'22px 18px 16px', borderBottom:'1px solid #2e1e40' },
  logoRow: { display:'flex', alignItems:'center', gap:9, marginBottom:4 },
  logoText: { fontFamily:'var(--font-d)', fontSize:17, fontWeight:700, color:'#f0e8f8' },
  schoolName: { fontSize:11, color:'#7a6a8a', paddingLeft:31, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' },
  nav: { flex:1, padding:'10px 8px', overflowY:'auto' },
  navBtn: { display:'flex', alignItems:'center', gap:11, width:'100%', padding:'9px 13px', borderRadius:10, border:'none', marginBottom:2, fontSize:13, fontWeight:500, color:'#9a8aaa', background:'transparent', cursor:'pointer', textDecoration:'none', transition:'all .15s' },
  navActive: { background:'#c4527a33', color:'#f0a0b8', fontWeight:700 },
  footer: { padding:'13px 16px', borderTop:'1px solid #2e1e40' },
  logoutBtn: { background:'none', border:'none', color:'#7a6a8a', fontSize:12, cursor:'pointer', width:'100%', textAlign:'left', padding:'6px 0' },
  main: { flex:1, overflowY:'auto', background:'var(--bg)' },
  content: { padding:'28px 32px', maxWidth:1100, margin:'0 auto' },
};

export default function AppShell() {
  const { user, school, logout } = useAuth();
  const navigate = useNavigate();
  const navItems = NAV_ITEMS[user?.role] || [];
  const schoolName = school?.name || (user?.role === 'superadmin' ? 'Super Admin' : 'StudioFlow');

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div style={s.shell}>
      <aside style={s.sidebar}>
        <div style={s.logo}>
          <div style={s.logoRow}><span style={{fontSize:22}}>🩰</span><span style={s.logoText}>StudioFlow</span></div>
          <div style={s.schoolName}>{schoolName}</div>
        </div>
        <nav style={s.nav}>
          {navItems.map(item => (
            <NavLink key={item.to} to={item.to} end={item.to==='/'} style={({ isActive }) => ({ ...s.navBtn, ...(isActive ? s.navActive : {}) })}>
              <span>{item.icon}</span><span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div style={s.footer}>
          <div style={{fontSize:11,color:'#7a6a8a',marginBottom:2}}>Signed in as</div>
          <div style={{fontSize:12,fontWeight:600,color:'#e0d0f0',marginBottom:8,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{user?.name}</div>
          <button style={s.logoutBtn} onClick={handleLogout}>Sign out →</button>
        </div>
      </aside>
      <main style={s.main}>
        <div style={s.content}><Outlet /></div>
      </main>
    </div>
  );
}