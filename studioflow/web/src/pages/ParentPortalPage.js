import React from "react";
import { useQuery } from "@tanstack/react-query";
import { parent as api } from "../api";
import Card from "../components/shared/Card";
import Badge from "../components/shared/Badge";

export default function ParentPortalPage() {
  const { data: children=[] } = useQuery({ queryKey:["parent-students"], queryFn: api.students });
  const { data: recitals=[] } = useQuery({ queryKey:["parent-recitals"], queryFn: api.recitals });
  const upcoming = recitals.filter(r=>new Date(r.event_date)>=new Date());

  return (
    <div>
      <h1 style={{fontFamily:"var(--font-d)",fontSize:26,marginBottom:4}}>My Children</h1>
      <p style={{color:"var(--muted)",marginBottom:24,fontSize:13}}>View your children's batches, schedule, and upcoming events</p>
      <div style={{display:"grid",gap:12,marginBottom:28}}>
        {children.map(s=>(
          <Card key={s.id} style={{display:"flex",alignItems:"center",gap:14,padding:16}}>
            <div style={{width:44,height:44,borderRadius:"50%",background:`hsl(${s.name.charCodeAt(0)*7%360},55%,68%)`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,color:"#fff",fontSize:18,flexShrink:0}}>{s.name[0]}</div>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:15}}>{s.name}</div>
              {s.batches && <div style={{fontSize:12,color:"var(--muted)",marginTop:2}}>📚 {s.batches}</div>}
            </div>
            {s.age && <Badge color="#6a7fdb">Age {s.age}</Badge>}
          </Card>
        ))}
      </div>
      {upcoming.length > 0 && <>
        <h2 style={{fontFamily:"var(--font-d)",fontSize:18,marginBottom:12}}>🌟 Upcoming Events</h2>
        <div style={{display:"grid",gap:9}}>
          {upcoming.map(r=>(
            <Card key={r.id} style={{display:"flex",alignItems:"center",gap:14,padding:14}}>
              <div style={{textAlign:"center",minWidth:50,background:"#c4527a22",borderRadius:10,padding:"8px"}}>
                <div style={{fontSize:17,fontWeight:800,color:"#c4527a",fontFamily:"var(--font-d)"}}>{new Date(r.event_date).getDate()}</div>
                <div style={{fontSize:9,color:"var(--muted)",textTransform:"uppercase"}}>{new Date(r.event_date).toLocaleString("default",{month:"short",year:"2-digit"})}</div>
              </div>
              <div style={{flex:1}}><div style={{fontWeight:700,fontSize:13}}>{r.title}</div><div style={{color:"var(--muted)",fontSize:11}}>{r.venue}</div></div>
              <Badge>{r.status}</Badge>
            </Card>
          ))}
        </div>
      </>}
    </div>
  );
}