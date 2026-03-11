import { useState } from 'react';

const S = {
  btn: (variant='primary', small=false, full=false) => ({
    display:'inline-flex', alignItems:'center', gap:6,
    padding: small ? '6px 13px' : '10px 22px',
    fontSize: small ? 13 : 14, fontWeight:600,
    borderRadius: small ? 8 : 11,
    border: variant==='outline' ? '1.5px solid var(--border)' : 'none',
    background: variant==='primary' ? 'var(--accent)' : variant==='danger' ? 'var(--danger)' : variant==='success' ? 'var(--success)' : variant==='outline' ? 'transparent' : 'var(--surface)',
    color: ['primary','danger','success'].includes(variant) ? '#fff' : 'var(--text)',
    cursor:'pointer', fontFamily:'var(--font-b)',
    width: full ? '100%' : undefined,
    justifyContent: full ? 'center' : undefined,
    transition:'all .15s',
    whiteSpace:'nowrap',
  }),
  inp: {
    width:'100%', background:'#faf8fc', border:'1.5px solid var(--border)',
    borderRadius:9, padding:'9px 13px', fontSize:14, color:'var(--text)',
    fontFamily:'var(--font-b)', outline:'none',
  },
  card: (style={}) => ({
    background:'var(--card)', borderRadius:14, padding:20,
    border:'1px solid var(--border)', boxShadow:'var(--shadow)', ...style,
  }),
};

export const Btn = ({ children, variant='primary', small, full, onClick, disabled, type='button', icon, style:s={} }) => (
  <button type={type} onClick={onClick} disabled={disabled}
    style={{...S.btn(variant,small,full), opacity:disabled?.5:1, cursor:disabled?'not-allowed':'pointer', ...s}}>
    {icon && <span style={{display:'flex'}}>{icon}</span>}
    {children}
  </button>
);

export const Input = (props) => (
  <input {...props} style={{...S.inp, ...props.style}}
    onFocus={e => e.target.style.borderColor='var(--accent)'}
    onBlur={e => e.target.style.borderColor='var(--border)'}
  />
);

export const Select = ({ children, ...props }) => (
  <select {...props} style={{...S.inp, ...props.style}}
    onFocus={e => e.target.style.borderColor='var(--accent)'}
    onBlur={e => e.target.style.borderColor='var(--border)'}
  >{children}</select>
);

export const Textarea = (props) => (
  <textarea {...props} style={{...S.inp, resize:'vertical', minHeight:72, ...props.style}}
    onFocus={e => e.target.style.borderColor='var(--accent)'}
    onBlur={e => e.target.style.borderColor='var(--border)'}
  />
);

export const Field = ({ label, children, required, error }) => (
  <div style={{marginBottom:14}}>
    <label style={{display:'block',fontSize:11,fontWeight:700,letterSpacing:'0.07em',textTransform:'uppercase',color:error?'var(--danger)':'var(--muted)',marginBottom:5}}>
      {label}{required && <span style={{color:'var(--accent)',marginLeft:2}}>*</span>}
    </label>
    {children}
    {error && <p style={{fontSize:12,color:'var(--danger)',marginTop:4}}>{error}</p>}
  </div>
);

export const Card = ({ children, style, onClick }) => (
  <div onClick={onClick} style={{...S.card(style), cursor:onClick?'pointer':'default'}}>{children}</div>
);

export const Badge = ({ children, color, style:s={} }) => (
  <span style={{display:'inline-block',padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:700,
    background: color||'var(--surface)', color: color?'#fff':'var(--muted)',
    border:'1px solid '+(color||'var(--border)'), ...s}}>
    {children}
  </span>
);

export const Avatar = ({ name, size=40 }) => {
  const hue = name ? name.charCodeAt(0) * 7 % 360 : 200;
  return (
    <div style={{width:size,height:size,borderRadius:'50%',background:`hsl(${hue},55%,68%)`,
      display:'flex',alignItems:'center',justifyContent:'center',
      fontWeight:800,fontSize:size*.36,color:'#fff',flexShrink:0}}>
      {name?.[0]?.toUpperCase()||'?'}
    </div>
  );
};

export const Spinner = ({ size=24 }) => (
  <div style={{width:size,height:size,border:`3px solid var(--border)`,borderTopColor:'var(--accent)',
    borderRadius:'50%',animation:'spin .8s linear infinite'}}/>
);

export const Modal = ({ title, onClose, children, wide }) => (
  <div style={{position:'fixed',inset:0,background:'rgba(20,10,30,0.6)',backdropFilter:'blur(5px)',
    zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
    <div style={{background:'#fff',borderRadius:20,width:'100%',maxWidth:wide?680:480,
      maxHeight:'90vh',overflow:'auto',boxShadow:'0 24px 60px rgba(0,0,0,0.35)'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'20px 24px 0'}}>
        <h2 style={{fontFamily:'var(--font-d)',fontSize:18,color:'var(--text)'}}>{title}</h2>
        <Btn variant="outline" small onClick={onClose} style={{padding:'5px 8px',border:'none',background:'none',color:'var(--muted)'}}>✕</Btn>
      </div>
      <div style={{padding:'20px 24px 24px'}}>{children}</div>
    </div>
  </div>
);

export const Grid2 = ({ children, style }) => (
  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 16px',...style}}>{children}</div>
);

export const PageHeader = ({ title, subtitle, action }) => (
  <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:24}}>
    <div>
      <h1 style={{fontFamily:'var(--font-d)',fontSize:26,color:'var(--text)',marginBottom:2}}>{title}</h1>
      {subtitle && <p style={{color:'var(--muted)',fontSize:13}}>{subtitle}</p>}
    </div>
    {action}
  </div>
);

export const EmptyState = ({ icon='📋', title, message, action }) => (
  <Card style={{textAlign:'center',padding:48,border:'1.5px dashed var(--border)'}}>
    <div style={{fontSize:36,marginBottom:10}}>{icon}</div>
    <h3 style={{fontFamily:'var(--font-d)',color:'var(--text)',marginBottom:8,fontSize:17}}>{title}</h3>
    {message && <p style={{color:'var(--muted)',fontSize:13,marginBottom:action?20:0}}>{message}</p>}
    {action}
  </Card>
);

export const StatusBadge = ({ status }) => {
  const colors = { Paid:'#52c4a0', Pending:'#f4a041', Overdue:'#e05c6a', Waived:'#8a7a9a',
    Planning:'#6a7fdb', Confirmed:'#52c4a0', Rehearsals:'#f4a041', Completed:'#8ab4c0', Cancelled:'#e05c6a' };
  return <Badge color={colors[status]||'#888'}>{status}</Badge>;
};

export const ProgressBar = ({ value, color='var(--accent)' }) => (
  <div style={{height:5,background:'var(--border)',borderRadius:10,overflow:'hidden'}}>
    <div style={{height:'100%',width:`${Math.min(100,value||0)}%`,background:color,borderRadius:10,transition:'width .4s'}}/>
  </div>
);

export function useToast() {
  const [toasts, setToasts] = useState([]);
  const show = (msg, type='success') => {
    const id = Date.now();
    setToasts(t => [...t, {id,msg,type}]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  };
  const Toast = () => (
    <div style={{position:'fixed',bottom:24,right:24,zIndex:500,display:'grid',gap:8}}>
      {toasts.map(t => (
        <div key={t.id} style={{background:t.type==='error'?'var(--danger)':'var(--success)',color:'#fff',
          padding:'12px 18px',borderRadius:11,fontSize:14,fontWeight:600,
          boxShadow:'0 4px 16px rgba(0,0,0,0.2)',animation:'fadeIn .2s ease'}}>
          {t.type==='error'?'❌':'✅'} {t.msg}
        </div>
      ))}
    </div>
  );
  return { show, Toast };
}

export const DANCE_STYLES = ['Ballet','Hip-Hop','Contemporary','Jazz','Tap','Bollywood','Salsa','Ballroom','K-Pop','Freestyle'];
export const LEVELS = ['Beginner','Intermediate','Advanced','Mixed'];
export const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
export const BATCH_COLORS = ['#e8607a','#6a7fdb','#f4a041','#52c4a0','#b47fe8','#e87a52'];
