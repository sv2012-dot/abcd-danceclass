import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = {
  superadmin:   [
    { to:'/',         label:'Dashboard', emoji:'🏠' },
    { to:'/schools',  label:'Schools',   emoji:'🏫' },
  ],
  school_admin: [
    { to:'/',         label:'Dashboard', emoji:'🏠' },
    { to:'/students', label:'Students',  emoji:'👤' },
    { to:'/batches',  label:'Batches',   emoji:'📚' },
    { to:'/schedule', label:'Schedule',  emoji:'📅' },
    { to:'/recitals', label:'Recitals',  emoji:'🌟' },
    { to:'/fees',     label:'Fees',      emoji:'💰' },
  ],
  teacher: [
    { to:'/',         label:'Dashboard', emoji:'🏠' },
    { to:'/students', label:'Students',  emoji:'👤' },
    { to:'/batches',  label:'Batches',   emoji:'📚' },
    { to:'/schedule', label:'Schedule',  emoji:'📅' },
    { to:'/recitals', label:'Recitals',  emoji:'🌟' },
  ],
  parent: [
    { to:'/parent',   label:'My Portal', emoji:'🏠' },
  ],
};

const navLinkStyle = ({ isActive }) => ({
  display:'flex', alignItems:'center', gap:11, width:'100%', padding:'10px 13px',
  borderRadius:10, border:'none', cursor:'pointer', marginBottom:2,
  fontSize:13, fontWeight: isActive ? 700 : 500,
  color: isActive ? '#f0a0b8' : '#9a8aaa',
  background: isActive ? '#c4527a33' : 'transparent',
  transition:'all .15s', textDecoration:'none',
});

export default function Layout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const items = NAV_ITEMS[user.role] || [];

  const roleLabel = { superadmin:'Super Admin', school_admin:'School Admin', teacher:'Teacher', parent:'Parent' };

  return (
    <div style={{display:'flex',height:'100vh',overflow:'hidden'}}>
      {/* Sidebar */}
      <aside style={{width:210,background:'#1e1228',display:'flex',flexDirection:'column',flexShrink:0,height:'100vh'}}>
        <div style={{padding:'22px 18px 16px'}}>
          <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:4}}>
            <span style={{fontSize:22}}>🩰</span>
            <span style={{fontFamily:'var(--font-d)',fontSize:17,fontWeight:700,color:'#f0e8f8'}}>StudioFlow</span>
          </div>
          <div style={{fontSize:11,color:'#7a6a8a',paddingLeft:31,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
            {user.school_name || 'Platform Admin'}
          </div>
        </div>

        <nav style={{flex:1,padding:'0 8px',overflow:'auto'}}>
          {items.map(item => (
            <NavLink key={item.to} to={item.to} end={item.to==='/'||item.to==='/parent'} style={navLinkStyle}>
              <span style={{fontSize:15}}>{item.emoji}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div style={{padding:'12px 14px',borderTop:'1px solid #2e1e40'}}>
          <div style={{fontSize:11,color:'#7a6a8a',marginBottom:2}}>{roleLabel[user.role]}</div>
          <div style={{fontSize:12,fontWeight:600,color:'#e0d0f0',marginBottom:10,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{user.name}</div>
          <button onClick={() => { signOut(); navigate('/login'); }}
            style={{display:'flex',alignItems:'center',gap:8,background:'transparent',border:'1px solid #3e2e50',color:'#9a8aaa',borderRadius:8,padding:'6px 10px',fontSize:12,cursor:'pointer',fontFamily:'var(--font-b)',width:'100%'}}>
            🚪 Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{flex:1,overflowY:'auto',padding:'28px 32px',background:'var(--bg)'}}>
        <div style={{maxWidth:1100,margin:'0 auto'}}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
