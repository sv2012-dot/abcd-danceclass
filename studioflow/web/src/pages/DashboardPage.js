import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { recitals as recitalApi } from '../api';
import Card from '../components/shared/Card';
import Badge from '../components/shared/Badge';

export default function DashboardPage() {
  const { user, school } = useAuth();
  const schoolId = user?.school_id;
  const { data: recitalList } = useQuery({ queryKey:['recitals',schoolId], queryFn:()=>recitalApi.list(schoolId), enabled:!!schoolId });

  const upcoming = (recitalList||[]).filter(r=>new Date(r.event_date)>=new Date()).sort((a,b)=>new Date(a.event_date)-new Date(b.event_date));

  if (user?.role === 'superadmin') return <SuperAdminDash />;

  return (
    <div>
      <h1 style={{fontFamily:'var(--font-d)',fontSize:26,marginBottom:4}}>Good day! 👋</h1>
      <p style={{color:'var(--muted)',marginBottom:26,fontSize:13}}>{school?.name} · {user?.name}</p>
      {upcoming.length > 0 && (
        <div style={{marginBottom:28}}>
          <h2 style={{fontFamily:'var(--font-d)',fontSize:17,marginBottom:12}}>🌟 Upcoming Recitals</h2>
          <div style={{display:'grid',gap:9}}>
            {upcoming.slice(0,3).map(r=>(
              <Card key={r.id} style={{display:'flex',alignItems:'center',gap:14,padding:14}}>
                <div style={{textAlign:'center',minWidth:48,background:'#c4527a22',borderRadius:10,padding:'7px 8px'}}>
                  <div style={{fontSize:16,fontWeight:800,color:'#c4527a',fontFamily:'var(--font-d)'}}>{new Date(r.event_date).getDate()}</div>
                  <div style={{fontSize:9,color:'var(--muted)',textTransform:'uppercase'}}>{new Date(r.event_date).toLocaleString('default',{month:'short'})}</div>
                </div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:13}}>{r.title}</div>
                  <div style={{color:'var(--muted)',fontSize:11}}>{r.venue}</div>
                </div>
                <Badge>{r.status}</Badge>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SuperAdminDash() {
  const { data: schoolList } = useQuery({ queryKey:['schools'], queryFn:()=>import('../api').then(m=>m.schools.list()) });
  return (
    <div>
      <h1 style={{fontFamily:'var(--font-d)',fontSize:26,marginBottom:4}}>Super Admin Dashboard</h1>
      <p style={{color:'var(--muted)',marginBottom:24,fontSize:13}}>Manage all schools on the platform</p>
      <h2 style={{fontFamily:'var(--font-d)',fontSize:17,marginBottom:12}}>All Schools</h2>
      <div style={{display:'grid',gap:9}}>
        {(schoolList||[]).map(s=>(
          <Card key={s.id} style={{display:'flex',alignItems:'center',gap:14,padding:14}}>
            <div style={{width:40,height:40,borderRadius:'50%',background:`hsl(${s.name.charCodeAt(0)*7%360},55%,68%)`,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,color:'#fff',fontSize:16,flexShrink:0}}>{s.name[0]}</div>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:14}}>{s.name}</div>
              <div style={{color:'var(--muted)',fontSize:12}}>{s.owner_name} · {s.city} · {s.dance_style}</div>
            </div>
            <div style={{fontSize:12,color:'var(--muted)'}}>{s.student_count} students · {s.batch_count} batches</div>
          </Card>
        ))}
      </div>
    </div>
  );
}