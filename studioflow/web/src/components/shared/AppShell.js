import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

// ── SVG Icons (Lucide-style line icons) ──────────────────────────────────────
const Icons = {
  dashboard: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  ),
  students: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  batches: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
      <rect x="5" y="2" width="14" height="20" rx="2"/>
      <line x1="9" y1="7" x2="15" y2="7"/><line x1="9" y1="11" x2="15" y2="11"/>
      <line x1="9" y1="15" x2="13" y2="15"/>
    </svg>
  ),
  schedule: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  users: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  schools: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  ),
  parent: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <circle cx="17" cy="10" r="3"/>
    </svg>
  ),
};

const NAV_ITEMS = {
  superadmin: [
    { to:'/', label:'Dashboard', icon:'dashboard' },
    { to:'/schools', label:'Schools', icon:'schools' },
  ],
  school_admin: [
    { to:'/', label:'Dashboard', icon:'dashboard' },
    { to:'/students', label:'Students', icon:'students' },
    { to:'/batches', label:'Batches', icon:'batches' },
    { to:'/schedule', label:'My Events', icon:'schedule' },
    { to:'/users', label:'Users', icon:'users' },
  ],
  teacher: [
    { to:'/', label:'Dashboard', icon:'dashboard' },
    { to:'/students', label:'Students', icon:'students' },
    { to:'/batches', label:'Batches', icon:'batches' },
    { to:'/schedule', label:'My Events', icon:'schedule' },
  ],
  parent: [
    { to:'/', label:'Dashboard', icon:'dashboard' },
    { to:'/parent', label:'My Children', icon:'parent' },
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
    width:232, background:'var(--sidebar)', display:'flex', flexDirection:'column',
    flexShrink:0, height:'100vh', borderRight:'1px solid var(--sidebar-border)',
  },
  schoolBrand: {
    padding:'18px 16px 15px', borderBottom:'1px solid var(--sidebar-border)',
    cursor:'pointer', transition:'background .15s', userSelect:'none',
  },
  schoolRow:   { display:'flex', alignItems:'center', gap:11, marginBottom:6 },
  schoolAvatar:{
    width:40, height:40, borderRadius:10, flexShrink:0,
    display:'flex', alignItems:'center', justifyContent:'center',
    fontWeight:800, color:'#fff', fontSize:14, letterSpacing:'-0.5px',
  },
  schoolName:  {
    fontSize:13, fontWeight:700, color:'var(--sidebar-foreground)',
    lineHeight:1.2, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
  },
  schoolBrief: { fontSize:11, color:'var(--sidebar-muted)', paddingLeft:51, lineHeight:1.4 },
  schoolHint:  {
    fontSize:10, color:'var(--sidebar-accent-foreground)', paddingLeft:51, marginTop:3,
    letterSpacing:'0.04em', opacity:0.7,
  },
  nav:       { flex:1, padding:'12px 10px', overflowY:'auto' },
  navBtn:    {
    display:'flex', alignItems:'center', gap:10, width:'100%',
    padding:'9px 12px', borderRadius:8, border:'none', marginBottom:2,
    fontSize:13, fontWeight:500, color:'var(--sidebar-muted)',
    background:'transparent', cursor:'pointer', textDecoration:'none', transition:'all .15s',
  },
  navActive: { background:'var(--sidebar-accent)', color:'var(--sidebar-accent-foreground)', fontWeight:600 },
  footer:    { padding:'12px 16px 10px', borderTop:'1px solid var(--sidebar-border)' },
  userLabel: { fontSize:10, color:'var(--sidebar-muted)', marginBottom:1, textTransform:'uppercase', letterSpacing:'0.06em' },
  userName:  { fontSize:12, fontWeight:700, color:'var(--sidebar-foreground)', marginBottom:6, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' },
  logoutBtn: { background:'none', border:'none', color:'var(--sidebar-muted)', fontSize:11, cursor:'pointer', width:'100%', textAlign:'left', padding:'4px 0', transition:'color .15s' },
  platform: { padding:'10px 16px 14px', borderTop:'1px solid var(--sidebar-border)', display:'flex', alignItems:'center', gap:9, opacity:0.5 },
  platformName: { fontSize:11, fontWeight:700, color:'var(--sidebar-foreground)', letterSpacing:'-0.2px' },
  platformSub:  { fontSize:9, color:'var(--sidebar-muted)', letterSpacing:'0.07em', textTransform:'uppercase', marginTop:1 },
  main:    { flex:1, overflowY:'auto', background:'var(--background)' },
  content: { padding:'32px 36px', maxWidth:1140, margin:'0 auto' },
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
          onMouseEnter={e => { if (!isSuperAdmin) e.currentTarget.style.background = 'var(--sidebar-accent)'; }}
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
          {isSuperAdmin && <div style={s.schoolBrief}>Multi-school platform admin</div>}
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
              {Icons[item.icon]}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* ── Signed-in user ────────────────────────────────── */}
        <div style={s.footer}>
          <div style={s.userLabel}>Signed in as</div>
          <div style={s.userName}>{user?.name}</div>
          <button style={s.logoutBtn}
            onMouseEnter={e => { e.currentTarget.style.color = '#DC2626'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--sidebar-muted)'; }}
            onClick={handleLogout}>Sign out →</button>
        </div>

        {/* ── StudioFlow platform brand — very bottom ────────── */}
        <div style={s.platform}>
          <span style={{ fontSize:18 }}>🩰</span>
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
