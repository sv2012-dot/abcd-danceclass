import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getSchool, getFeesSummary, getStudents, getBatches, getSchedules, getRecitals } from '../api';
import { Card, Badge, StatusBadge, ProgressBar, Spinner } from '../components/UI';

const StatCard = ({ label, value, color, emoji }) => (
  <Card style={{display:'flex',alignItems:'center',gap:14,padding:18}}>
    <div style={{width:46,height:46,borderRadius:13,background:color+'22',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0}}>{emoji}</div>
    <div>
      <div style={{fontSize:26,fontWeight:800,fontFamily:'var(--font-d)',color,lineHeight:1}}>{value}</div>
      <div style={{fontSize:12,color:'var(--muted)',marginTop:2}}>{label}</div>
    </div>
  </Card>
);

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user.school_id) { setLoading(false); return; }
    Promise.all([
      getStudents(user.school_id),
      getBatches(user.school_id),
      getSchedules(user.school_id),
      getRecitals(user.school_id),
      getFeesSummary(user.school_id),
    ]).then(([s, b, sc, r, f]) => {
      setData({ students: s.data.students, batches: b.data.batches, schedules: sc.data.schedules, recitals: r.data.recitals, fees: f.data.summary });
    }).catch(console.error).finally(() => setLoading(false));
  }, [user.school_id]);

  if (loading) return <div style={{display:'flex',justifyContent:'center',padding:60}}><Spinner size={36}/></div>;

  const upcoming = data?.recitals?.filter(r => new Date(r.event_date) >= new Date()).sort((a,b) => new Date(a.event_date)-new Date(b.event_date)) || [];

  if (user.role === 'superadmin') {
    return (
      <div>
        <h1 style={{fontFamily:'var(--font-d)',fontSize:26,marginBottom:4}}>Super Admin Dashboard</h1>
        <p style={{color:'var(--muted)',marginBottom:28}}>Welcome back, {user.name}!</p>
        <Card style={{textAlign:'center',padding:40}}>
          <div style={{fontSize:40,marginBottom:12}}>🏫</div>
          <h3 style={{fontFamily:'var(--font-d)',marginBottom:8}}>Manage All Schools</h3>
          <p style={{color:'var(--muted)',fontSize:14}}>Use the Schools section to create and manage dance schools across the platform.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <h1 style={{fontFamily:'var(--font-d)',fontSize:26,marginBottom:4}}>Good day! 👋</h1>
      <p style={{color:'var(--muted)',marginBottom:26,fontSize:14}}>{user.school_name}</p>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:13,marginBottom:28}}>
        <StatCard label="Students"       value={data?.students?.length||0}  color="#e8607a" emoji="👤"/>
        <StatCard label="Batches"        value={data?.batches?.length||0}   color="#6a7fdb" emoji="📚"/>
        <StatCard label="Weekly Classes" value={data?.schedules?.length||0} color="#f4a041" emoji="📅"/>
        <StatCard label="Upcoming Shows" value={upcoming.length}            color="#52c4a0" emoji="🌟"/>
        {user.role === 'school_admin' && (
          <StatCard label="Fees Overdue" value={`$${parseFloat(data?.fees?.total_overdue||0).toFixed(0)}`} color="#e05c6a" emoji="💰"/>
        )}
      </div>

      {/* Fee Summary */}
      {user.role === 'school_admin' && data?.fees && (
        <Card style={{marginBottom:24}}>
          <h2 style={{fontFamily:'var(--font-d)',fontSize:17,marginBottom:16}}>💰 Fee Summary</h2>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
            {[
              {label:'Collected',    val:data.fees.total_paid,    color:'var(--success)'},
              {label:'Pending',      val:data.fees.total_pending, color:'var(--warning)'},
              {label:'Overdue',      val:data.fees.total_overdue, color:'var(--danger)'},
            ].map(f=>(
              <div key={f.label} style={{background:'var(--surface)',borderRadius:11,padding:'14px 16px',textAlign:'center'}}>
                <div style={{fontSize:20,fontWeight:800,color:f.color,fontFamily:'var(--font-d)'}}>
                  ${parseFloat(f.val||0).toFixed(0)}
                </div>
                <div style={{fontSize:12,color:'var(--muted)'}}>{f.label}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Upcoming Recitals */}
      {upcoming.length > 0 && (
        <div style={{marginBottom:24}}>
          <h2 style={{fontFamily:'var(--font-d)',fontSize:17,marginBottom:12}}>🌟 Upcoming Recitals</h2>
          <div style={{display:'grid',gap:9}}>
            {upcoming.slice(0,3).map(r => {
              const pct = r.task_count ? Math.round((r.tasks_done/r.task_count)*100) : 0;
              return (
                <Card key={r.id} style={{display:'flex',alignItems:'center',gap:15,padding:15}}>
                  <div style={{textAlign:'center',minWidth:50,background:'#c4527a22',borderRadius:10,padding:8}}>
                    <div style={{fontSize:17,fontWeight:800,color:'var(--accent)',fontFamily:'var(--font-d)'}}>{new Date(r.event_date).getDate()}</div>
                    <div style={{fontSize:9,color:'var(--muted)',textTransform:'uppercase'}}>{new Date(r.event_date).toLocaleString('default',{month:'short'})}</div>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:14,marginBottom:2}}>{r.title}</div>
                    {r.venue && <div style={{fontSize:12,color:'var(--muted)',marginBottom:r.task_count?6:0}}>📍 {r.venue}</div>}
                    {r.task_count > 0 && <ProgressBar value={pct} color="var(--accent)"/>}
                  </div>
                  <StatusBadge status={r.status}/>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {data?.students?.length === 0 && (
        <Card style={{textAlign:'center',padding:44,border:'1.5px dashed var(--border)'}}>
          <div style={{fontSize:34,marginBottom:10}}>🎵</div>
          <h3 style={{fontFamily:'var(--font-d)',marginBottom:8}}>Ready to build your studio?</h3>
          <p style={{color:'var(--muted)',fontSize:13}}>Start by adding students → create batches → set your schedule</p>
        </Card>
      )}
    </div>
  );
}
