import React from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import * as api from '../api';
import { colors, STATUS_COLORS } from '../theme';

function StatCard({ label, value, icon, color }) {
  return (
    <View style={[s.stat, { flex:1 }]}>
      <Text style={s.statIcon}>{icon}</Text>
      <Text style={[s.statVal, { color }]}>{value ?? '—'}</Text>
      <Text style={s.statLbl}>{label}</Text>
    </View>
  );
}

export default function DashboardScreen() {
  const { user, school } = useAuth();
  const sid = user?.school_id;
  const { data: stats, refetch, isFetching } = useQuery({ queryKey:['stats',sid], queryFn:()=>api.schools? undefined : undefined, enabled:false });
  const { data: recitals=[], refetch: refetchR } = useQuery({ queryKey:['recitals-mobile',sid], queryFn:()=>api.recitals.list(sid), enabled:!!sid });
  const upcoming = recitals.filter(r=>new Date(r.event_date)>=new Date()).sort((a,b)=>new Date(a.event_date)-new Date(b.event_date));

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={isFetching} onRefresh={()=>{refetch();refetchR();}} tintColor={colors.accent} />}>
      <Text style={s.greeting}>Good day! 👋</Text>
      <Text style={s.schoolName}>{school?.name || 'StudioFlow'}</Text>

      {upcoming.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>🌟 Upcoming Events</Text>
          {upcoming.slice(0,3).map(r=>{
            const d = new Date(r.event_date);
            const color = STATUS_COLORS[r.status] || colors.accent;
            return (
              <View key={r.id} style={s.eventCard}>
                <View style={[s.dateBadge, { backgroundColor: color+'22' }]}>
                  <Text style={[s.dateDay, { color }]}>{d.getDate()}</Text>
                  <Text style={s.dateMon}>{d.toLocaleString('default',{month:'short'})}</Text>
                </View>
                <View style={{ flex:1 }}>
                  <Text style={s.eventTitle}>{r.title}</Text>
                  {r.venue ? <Text style={s.eventVenue}>📍 {r.venue}</Text> : null}
                </View>
                <View style={[s.statusBadge, { backgroundColor: color }]}>
                  <Text style={s.statusText}>{r.status}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex:1, backgroundColor:colors.bg },
  content: { padding:20 },
  greeting: { fontSize:26, fontWeight:'800', color:colors.text, marginBottom:3 },
  schoolName: { fontSize:13, color:colors.muted, marginBottom:24 },
  statRow: { flexDirection:'row', gap:10, marginBottom:28 },
  stat: { backgroundColor:'#fff', borderRadius:14, padding:16, alignItems:'center', shadowColor:'#000', shadowOpacity:0.05, shadowRadius:4, elevation:2 },
  statIcon: { fontSize:22, marginBottom:6 },
  statVal: { fontSize:24, fontWeight:'800', lineHeight:28 },
  statLbl: { fontSize:11, color:colors.muted, marginTop:2 },
  section: { marginBottom:24 },
  sectionTitle: { fontSize:17, fontWeight:'700', color:colors.text, marginBottom:12 },
  eventCard: { backgroundColor:'#fff', borderRadius:14, padding:14, flexDirection:'row', alignItems:'center', gap:13, marginBottom:9, shadowColor:'#000', shadowOpacity:0.05, shadowRadius:4, elevation:2 },
  dateBadge: { width:46, borderRadius:10, padding:8, alignItems:'center' },
  dateDay: { fontSize:16, fontWeight:'800' },
  dateMon: { fontSize:9, color:colors.muted, textTransform:'uppercase' },
  eventTitle: { fontWeight:'700', fontSize:13, color:colors.text },
  eventVenue: { fontSize:11, color:colors.muted },
  statusBadge: { borderRadius:20, paddingHorizontal:9, paddingVertical:3 },
  statusText: { color:'#fff', fontSize:11, fontWeight:'700' },
});