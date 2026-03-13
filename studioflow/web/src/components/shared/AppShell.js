import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const NAV_ITEMS = {
  superadmin: [
    { to:'/', label:'Dashboard', icon:'🏠' },
    { to:'/schools', label:'Schools', icon:'🏫' },
  ],
  school_admin: [
    { to:'/', label:'Dashboard', icon:'🏠' },
    { to:'/students', label:'Students', icon:'👤' },
    { to:'/batches', label:'Batches', icon:'📚' },
    { to:'/schedule', label:'Schedule', icon:'📅' },
    { to:'/recitals', label:'Recitals', icon:'⭐' },
    { to:'/fees', label:'Fees', icon:'💳' },
    { to:'/users', label:'Users', icon:'👥' },
  ],
  teacher: [
    { to:'/', label:'Dashboard', icon:'🏠' },
    { to:'/students', label:'Students', icon:'👤' },
    { to:'/batches', label:'Batches', icon:'📚' },
    { to:'/schedule', label:'Schedule', icon:'📅' },
    { to:'/recitals', label:'Recitals', icon:'⭐' },
  ],
  parent: [
    { to:'/', label:'Dashboard', icon:'🏠' },
    { to:'/parent', label:'My Children', icon:'👨‍👧' },
    { to:'/recitals', label:'Recitals', icon:'⭐' },
  ],
};

function initials(name = '') {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
}

function schoolGradient(name = '') {
  const h1 = (name.charCodeAt(0) * 37 + (name.charCodeAt(1) || 0) * 13) % 360;
  const h2 = (h1 + 38) % 360;
  return `linear-gradient(135deg, hsl(${h1},62%,42%) 0%, hsl(${h2},55%,35%) 100%)`;
}

const s = {
  shell:   { display:'flex', height:'100vh', overflow:'hidden' },
  sidebar: {
    width:224, background:'var(--sidebar)', display:'flex', flexDirection:'column',
    flexShrink:0, height:'100vh', borderRight:'1px solid var(--sidebar-border)',
  },

  /* School brand top */
  schoolBrand: {
    padding:'16px 14px 13px', borderBottom:'1px solid var(--sidebar-border)',
    cursor:'pointer', transition:'background .15s', userSelect:'none',
  },
  schoolRow:   { display:'flex', alignItems:'center', gap:10, marginBottom:6 },
  schoolAvatar:{
    width:38, height:38, borderRadius:10, flexShrink:0,
    display:'flex', alignItems:'center', justifyContent:'center',
    fontWeight:800, color:'#fff', fontSize:14, letterSpacing:'-0.5px',
  },
  schoolName:  {
    fontSize:13, fontWeight:800, color:'var(--sidebar-foreground)',
    lineHeight:1.2, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
  },
  schoolBrief: { fontSize:10, color:'var(--sidebar-muted)', paddingLeft:48, lineHeight:1.4 },
  schoolHint:  {
    fontSize:8.5, color:'var(--sidebar-muted)', paddingLeft:48, marginTop:3,
    letterSpacing:'0.08em', opacity:0.5, textTransform:'uppercase',
  },

  /* Nav */
  nav:       { flex:1, padding:'10px 8px', overflowY:'auto' },
  navBtn:    {
    display:'flex', alignItems:'center', gap:11, width:'100%',
    padding:'9px 13px', borderRadius:10, border:'none', marginBottom:2,
    fontSize:13, fontWeight:500, color:'var(--sidebar-muted)',
    background:'transparent', cursor:'pointer', textDecoration:'none', transition:'all .15s',
  },
  navActive: { background:'var(--sidebar-accent)', color:'var(--sidebar-accent-foreground)', fontWeight:700 },

  /* User footer */
  footer:    { padding:'11px 14px 8px', borderTop:'1px solid var(--sidebar-border)' },
  userLabel: { fontSize:10, color:'var(--sidebar-muted)', marginBottom:1 },
  userName:  {
    fontSize:12, fontWeight:700, color:'var(--sidebar-foreground)', marginBottom:6,
    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
  },
  logoutBtn: {
    background:'none', border:'none', color:'var(--sidebar-muted)',
    fontSize:11, cursor:'pointer', width:'100%', textAlign:'left', padding:'4px 0',
  },

  /* Platform brand very bottom */
  platform: {
    padding:'9px 14px 14px', borderTop:'1px solid var(--sidebar-border)',
    display:'flex', alignItems:'center', gap:9, opacity:0.6,
  },
  platformName: { fontSize:11, fontWeight:800, color:'var(--sidebar-foreground)', letterSpacing:'-0.2px' },
  platformSub:  { fontSize:8, color:'var(--sidebar-muted)', letterSpacing:'0.07em', textTransform:'uppercase', marginTop:1 },

  /* Main */
  main:    { flex:1, overflowY:'auto', background:'var(--background)' },
  content: { padding:'28px 32px', maxWidth:1100, margin:'0 auto' },
};

export default function AppShell() {
  const { user, school, logout } = useAuth();
  const navigate = useNavigate();
  const navItems     = NAV_ITEMS[user?.role] || [];
  const isSuperAdmin = user?.role === 'superadmin';

  const schoolName = school?.name  || (isSuperAdmin ? 'StudioFlow Platform' : 'Your Studio');
  const danceStyle = school?.dance_style || '';
  const city       = school?.city        || '';
  const brief      = [danceStyle, city].filter(Boolean).join(' · ') || 'Dance Studio';

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div style={s.shell}>
      <aside style={s.sidebar}>

        {/* ── School brand — top ─────────────────────────────── */}
        <div
          style={s.schoolBrand}
          onClick={() => !isSuperAdmin && navigate('/about')}
          onMouseEnter={e => { if (!isSuperAdmin) e.currentTarget.style.background = 'rgba(196,82,122,0.07)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          title={isSuperAdmin ? '' : 'View school profile'}
        >
          <div style={s.schoolRow}>
            <div style={{ ...s.schoolAvatar, background: schoolGradient(schoolName) }}>
              {initials(schoolName)}
            </div>
            <span style={s.schoolName}>{schoolName}</span>
          </div>
          {!isSuperAdmin && (
            <>
              <div style={s.schoolBrief}>{brief}</div>
              <div style={s.schoolHint}>View school profile →</div>
            </>
          )}
          {isSuperAdmin && (
            <div style={s.schoolBrief}>Multi-school platform admin</div>
          )}
        </div>

        {/* ── Navigation ────────────────────────────────────── */}
        <nav style={s.nav}>
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              style={({ isActive }) => ({ ...s.navBtn, ...(isActive ? s.navActive : {}) })}
            >
              <span>{item.icon}</span><span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* ── Signed-in user ────────────────────────────────── */}
        <div style={s.footer}>
          <div style={s.userLabel}>Signed in as</div>
          <div style={s.userName}>{user?.name}</div>
          <button style={s.logoutBtn} onClick={handleLogout}>Sign out →</button>
        </div>

        {/* ── StudioFlow platform brand — very bottom ────────── */}
        <div style={s.platform}>
          <span style={{ fontSize:20 }}>🩰</span>
          <div>
            <div style={s.platformName}>StudioFlow</div>
            <div style={s.platformSub}>Dance studio platform</div>
          </div>
        </div>

      </aside>

      <main style={s.main}>
        <div style={s.content}><Outlet /></div>
      </main>
    </div>
  );
}
