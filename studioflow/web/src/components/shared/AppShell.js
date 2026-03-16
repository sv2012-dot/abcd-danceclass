import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

// ── Classical Dance Icon ───────────────────────────────────────────────────────
// Bharatanatyam dancer: aramandi stance, hasta mudra arm, crown ornament, stage
const ClassicalDanceIcon = ({ size = 20, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Crown ornament */}
    <path d="M10.8 1.4 L12 0.2 L13.2 1.4" stroke={color} strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round"/>
    {/* Head */}
    <circle cx="12" cy="3.4" r="2.1" fill={color}/>
    {/* Torso */}
    <path d="M12 5.5 L12 12.5" stroke={color} strokeWidth="2" strokeLinecap="round"/>
    {/* Right arm raised — hasta mudra */}
    <path d="M12 8 L17.2 4.8 L18.8 3.4" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
    {/* Left arm extended with wrist gesture */}
    <path d="M12 8 L6.8 11.2 L5.2 12.8" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
    {/* Right leg — aramandi (bent knee out to side) */}
    <path d="M12 12.5 L16.5 16.5 L16.5 21" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    {/* Left leg — mirror */}
    <path d="M12 12.5 L7.5 16.5 L7.5 21" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    {/* Stage platform */}
    <path d="M5 22 L19 22" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
    <path d="M7 23.5 L17 23.5" stroke={color} strokeWidth="0.8" strokeLinecap="round" opacity="0.5"/>
  </svg>
);

// ── SVG Icons ─────────────────────────────────────────────────────────────────
const Icons = {
  dashboard: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  ),
  students: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  batches: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
      <rect x="5" y="2" width="14" height="20" rx="2"/>
      <line x1="9" y1="7" x2="15" y2="7"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="13" y2="15"/>
    </svg>
  ),
  schedule: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  users: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
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
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><circle cx="17" cy="10" r="3"/>
    </svg>
  ),
  todos: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
      <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
    </svg>
  ),
  studios: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/>
    </svg>
  ),
  menu: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  ),
  close: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
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
    { to:'/batches', label:'Batches', icon:'batches' },
    { to:'/schedule', label:'My Events', icon:'schedule' },
    { to:'/todos', label:'To-Dos', icon:'todos' },
    { to:'/students', label:'Students', icon:'users' },
    { to:'/studios', label:'Studios', icon:'studios' },
  ],
  teacher: [
    { to:'/', label:'Dashboard', icon:'dashboard' },
    { to:'/batches', label:'Batches', icon:'batches' },
    { to:'/schedule', label:'My Events', icon:'schedule' },
    { to:'/todos', label:'To-Dos', icon:'todos' },
    { to:'/students', label:'Students', icon:'users' },
    { to:'/studios', label:'Studios', icon:'studios' },
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

const SIDEBAR_W = 232;
const MOBILE_BP = 768;

export default function AppShell() {
  const { user, school, logout } = useAuth();
  const { theme, toggleTheme }   = useTheme();
  const navigate  = useNavigate();
  const location  = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < MOBILE_BP);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < MOBILE_BP);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // Close drawer on route change
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  const navItems     = NAV_ITEMS[user?.role] || [];
  const isSuperAdmin = user?.role === 'superadmin';
  const schoolName   = school?.name || (isSuperAdmin ? 'ManchQ Platform' : 'Your Studio');
  const danceStyle   = school?.dance_style || '';
  const city         = school?.city || '';
  const brief        = [danceStyle, city].filter(Boolean).join(' · ') || 'Dance Studio';
  const handleLogout = () => { logout(); navigate('/login'); };

  // ── Sidebar content (shared between desktop & mobile drawer) ──────────────
  const SidebarContent = () => (
    <>
      {/* School brand */}
      <div
        style={{ padding:'18px 16px 15px', borderBottom:'1px solid var(--sidebar-border)', cursor: isSuperAdmin ? 'default' : 'pointer', userSelect:'none' }}
        onClick={() => { if (!isSuperAdmin) { navigate('/about'); setMenuOpen(false); } }}
      >
        <div style={{ display:'flex', alignItems:'center', gap:11, marginBottom:6 }}>
          <div style={{ width:40, height:40, borderRadius:10, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, color:'#fff', fontSize:14, letterSpacing:'-0.5px', background: schoolGradient(schoolName) }}>
            {initials(schoolName)}
          </div>
          <span style={{ fontSize:13, fontWeight:700, color:'var(--sidebar-foreground)', lineHeight:1.2, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {schoolName}
          </span>
        </div>
        {!isSuperAdmin && (
          <>
            <div style={{ fontSize:11, color:'var(--sidebar-muted)', paddingLeft:51 }}>{brief}</div>
            <div style={{ fontSize:10, color:'var(--sidebar-accent-foreground)', paddingLeft:51, marginTop:3, letterSpacing:'0.04em', opacity:0.7 }}>View school profile →</div>
          </>
        )}
        {isSuperAdmin && <div style={{ fontSize:11, color:'var(--sidebar-muted)', paddingLeft:51 }}>Multi-school platform admin</div>}
      </div>

      {/* Nav */}
      <nav style={{ flex:1, padding:'12px 10px', overflowY:'auto' }}>
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            style={({ isActive }) => ({
              display:'flex', alignItems:'center', gap:10, width:'100%',
              padding:'9px 12px', borderRadius:8, border:'none', marginBottom:2,
              fontSize:13, fontWeight: isActive ? 600 : 500,
              color: isActive ? 'var(--sidebar-accent-foreground)' : 'var(--sidebar-muted)',
              background: isActive ? 'var(--sidebar-accent)' : 'transparent',
              cursor:'pointer', textDecoration:'none', transition:'all .15s',
              boxSizing:'border-box',
            })}
          >
            {Icons[item.icon]}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User footer */}
      <div style={{ padding:'12px 16px 10px', borderTop:'1px solid var(--sidebar-border)' }}>
        <div style={{ fontSize:10, color:'var(--sidebar-muted)', marginBottom:1, textTransform:'uppercase', letterSpacing:'0.06em' }}>Signed in as</div>
        <div style={{ fontSize:12, fontWeight:700, color:'var(--sidebar-foreground)', marginBottom:6, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user?.name}</div>
        <button
          style={{ background:'none', border:'none', color:'var(--sidebar-muted)', fontSize:11, cursor:'pointer', width:'100%', textAlign:'left', padding:'4px 0' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#DC2626'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--sidebar-muted)'; }}
          onClick={handleLogout}
        >Sign out →</button>
      </div>

      {/* Theme toggle */}
      <div style={{ padding:'10px 16px', borderTop:'1px solid var(--sidebar-border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <span style={{ fontSize:11, color:'var(--sidebar-muted)', fontWeight:600 }}>
          {theme === 'dark' ? 'Night mode' : 'Day mode'}
        </span>
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to day mode' : 'Switch to night mode'}
          style={{
            display:'flex', alignItems:'center', gap:0,
            background: theme === 'dark' ? 'oklch(0.3715 0 0)' : '#e5e7eb',
            border:'none', borderRadius:999, padding:'3px 4px',
            cursor:'pointer', width:44, height:24,
            position:'relative', transition:'background .25s',
            flexShrink:0,
          }}
        >
          {/* Track icons */}
          <span style={{ position:'absolute', left:5, fontSize:11, lineHeight:1, opacity: theme === 'dark' ? 0.3 : 1, transition:'opacity .2s' }}>☀️</span>
          <span style={{ position:'absolute', right:5, fontSize:11, lineHeight:1, opacity: theme === 'dark' ? 1 : 0.3, transition:'opacity .2s' }}>🌙</span>
          {/* Knob */}
          <span style={{
            display:'block', width:18, height:18, borderRadius:'50%',
            background:'#fff', boxShadow:'0 1px 4px rgba(0,0,0,0.25)',
            position:'absolute',
            left: theme === 'dark' ? 'calc(100% - 22px)' : '3px',
            transition:'left .25s cubic-bezier(0.4,0,0.2,1)',
          }} />
        </button>
      </div>

      {/* Platform brand */}
      <div style={{ padding:'10px 16px 14px', borderTop:'1px solid var(--sidebar-border)', display:'flex', alignItems:'center', gap:9, opacity:0.5 }}>
        <ClassicalDanceIcon size={20} color="var(--sidebar-foreground)" />
        <div>
          <div style={{ fontSize:11, fontWeight:700, color:'var(--sidebar-foreground)', letterSpacing:'-0.2px' }}>ManchQ</div>
          <div style={{ fontSize:9, color:'var(--sidebar-muted)', letterSpacing:'0.07em', textTransform:'uppercase', marginTop:1 }}>Dance studio platform</div>
        </div>
      </div>
    </>
  );

  // ── Desktop layout ─────────────────────────────────────────────────────────
  if (!isMobile) {
    return (
      <div style={{ display:'flex', height:'100vh', overflow:'hidden' }}>
        <aside style={{ width:SIDEBAR_W, background:'var(--sidebar)', display:'flex', flexDirection:'column', flexShrink:0, height:'100vh', borderRight:'1px solid var(--sidebar-border)' }}>
          <SidebarContent />
        </aside>
        <main style={{ flex:1, overflowY:'auto', background:'var(--background)' }}>
          <div style={{ padding:'32px 36px', maxWidth:1340, margin:'0 auto' }}>
            <Outlet />
          </div>
        </main>
      </div>
    );
  }

  // ── Mobile layout ──────────────────────────────────────────────────────────
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', overflow:'hidden' }}>

      {/* Top bar */}
      <header style={{ height:56, background:'var(--sidebar)', borderBottom:'1px solid var(--sidebar-border)', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 16px', flexShrink:0, zIndex:200 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <ClassicalDanceIcon size={22} color="var(--sidebar-foreground)" />
          <span style={{ fontSize:15, fontWeight:700, color:'var(--sidebar-foreground)', letterSpacing:'-0.3px' }}>{schoolName}</span>
        </div>
        <button
          onClick={() => setMenuOpen(o => !o)}
          style={{ background:'none', border:'none', cursor:'pointer', color:'var(--sidebar-foreground)', display:'flex', alignItems:'center', padding:4 }}
          aria-label="Toggle menu"
        >
          {menuOpen ? Icons.close : Icons.menu}
        </button>
      </header>

      {/* Drawer overlay */}
      {menuOpen && (
        <div
          onClick={() => setMenuOpen(false)}
          style={{ position:'fixed', inset:0, top:56, background:'rgba(0,0,0,0.45)', zIndex:299 }}
        />
      )}

      {/* Slide-in drawer */}
      <div style={{
        position:'fixed', top:56, left:0, bottom:0, width: Math.min(SIDEBAR_W, window.innerWidth * 0.82),
        background:'var(--sidebar)', display:'flex', flexDirection:'column',
        borderRight:'1px solid var(--sidebar-border)',
        transform: menuOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition:'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
        zIndex:300, overflowY:'auto',
      }}>
        <SidebarContent />
      </div>

      {/* Page content */}
      <main style={{ flex:1, overflowY:'auto', background:'var(--background)' }}>
        <div style={{ padding:'20px 16px', maxWidth:1340, margin:'0 auto' }}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
