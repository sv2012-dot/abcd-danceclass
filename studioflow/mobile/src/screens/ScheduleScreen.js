import React from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { schedules as api, parent } from '../api';
import { colors, BATCH_COLORS } from '../theme';

const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

export default function ScheduleScreen() {
  const { user } = useAuth();
  const sid = user?.school_id;
  const isParent = user?.role === 'parent';
  const { data: list=[], isFetching, refetch } = useQuery({
    queryKey: ['schedule-m', sid, isParent],
    queryFn: () => isParent ? parent.schedule() : api.list(sid),
    enabled: !!sid || isParent,
  });

  const byDay = DAYS.reduce((a, d) => { a[d] = list.filter(c=>c.day_of_week===d).sort((a,b)=>a.start_time.localeCompare(b.start_time)); return a; }, {});

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor={colors.accent} />}>
      {DAYS.map(day => {
        const classes = byDay[day];
        if (!classes.length) return null;
        return (
          <View key={day} style={s.dayBlock}>
            <Text style={s.dayLabel}>{day}</Text>
            {classes.map((cls, i) => {
              const color = BATCH_COLORS[i % BATCH_COLORS.length];
              return (
                <View key={cls.id} style={[s.classCard, { borderLeftColor: color }]}>
                  <Text style={s.batchName}>{cls.batch_name}</Text>
                  <Text style={s.time}>{cls.start_time.slice(0,5)} – {cls.end_time.slice(0,5)}</Text>
                  {cls.room ? <Text style={s.room}>📍 {cls.room}</Text> : null}
                  <View style={[s.freqBadge, { backgroundColor: color+'22' }]}>
                    <Text style={[s.freqText, { color }]}>{cls.frequency}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        );
      })}
      {!list.length && <Text style={s.empty}>No classes scheduled yet.</Text>}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex:1, backgroundColor:colors.bg },
  content: { padding:16 },
  dayBlock: { marginBottom:18 },
  dayLabel: { fontSize:12, fontWeight:'700', color:colors.muted, textTransform:'uppercase', letterSpacing:1, marginBottom:8 },
  classCard: { backgroundColor:'#fff', borderRadius:10, padding:12, marginBottom:8, borderLeftWidth:4, shadowColor:'#000', shadowOpacity:0.04, shadowRadius:3, elevation:1 },
  batchName: { fontWeight:'700', fontSize:14, color:colors.text },
  time: { fontSize:12, color:colors.muted, marginTop:2 },
  room: { fontSize:12, color:colors.muted },
  freqBadge: { alignSelf:'flex-start', borderRadius:20, paddingHorizontal:8, paddingVertical:2, marginTop:6 },
  freqText: { fontSize:11, fontWeight:'700' },
  empty: { textAlign:'center', color:colors.muted, marginTop:60 },
});