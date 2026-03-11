import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, TextInput, RefreshControl } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { recitals as api, parent } from '../api';
import { colors, STATUS_COLORS } from '../theme';

export default function RecitalsScreen({ navigation }) {
  const { user } = useAuth();
  const sid = user?.school_id;
  const isParent = user?.role === 'parent';
  const qc = useQueryClient();
  const { data: list=[], isFetching, refetch } = useQuery({
    queryKey: ['recitals-m', sid, isParent],
    queryFn: () => isParent ? parent.recitals() : api.list(sid),
    enabled: !!sid || isParent,
  });
  const sorted = [...list].sort((a,b)=>new Date(b.event_date)-new Date(a.event_date));

  const renderItem = ({ item: r }) => {
    const done = r.tasks_done || 0;
    const total = r.task_count || 0;
    const pct = total ? Math.round(done/total*100) : 0;
    const color = STATUS_COLORS[r.status] || colors.accent;
    const d = new Date(r.event_date);
    return (
      <TouchableOpacity style={s.card} onPress={()=>navigation.navigate('RecitalDetail', { id: r.id, schoolId: sid })}>
        <View style={[s.dateBlock, { backgroundColor: color+'20' }]}>
          <Text style={[s.dateDay, { color }]}>{d.getDate()}</Text>
          <Text style={s.dateMon}>{d.toLocaleString('default',{month:'short',year:'2-digit'})}</Text>
        </View>
        <View style={{ flex:1 }}>
          <View style={{ flexDirection:'row', alignItems:'center', gap:8, flexWrap:'wrap' }}>
            <Text style={s.title}>{r.title}</Text>
            <View style={[s.badge, { backgroundColor: color }]}><Text style={s.badgeText}>{r.status}</Text></View>
          </View>
          {r.venue ? <Text style={s.venue}>📍 {r.venue}</Text> : null}
          {total > 0 && (
            <View>
              <Text style={s.taskLabel}>{done}/{total} tasks</Text>
              <View style={s.progressBg}><View style={[s.progressFill, { width:`${pct}%`, backgroundColor: color }]} /></View>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      data={sorted}
      keyExtractor={r=>String(r.id)}
      renderItem={renderItem}
      contentContainerStyle={{ padding:16 }}
      refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor={colors.accent} />}
      ListEmptyComponent={<Text style={s.empty}>No events yet.</Text>}
    />
  );
}

const s = StyleSheet.create({
  card: { backgroundColor:'#fff', borderRadius:14, padding:14, flexDirection:'row', gap:13, marginBottom:10, shadowColor:'#000', shadowOpacity:0.05, shadowRadius:4, elevation:2 },
  dateBlock: { borderRadius:10, padding:8, alignItems:'center', minWidth:50 },
  dateDay: { fontSize:17, fontWeight:'800' },
  dateMon: { fontSize:9, color:colors.muted, textTransform:'uppercase' },
  title: { fontWeight:'800', fontSize:14, color:colors.text },
  venue: { fontSize:11, color:colors.muted, marginTop:3 },
  badge: { borderRadius:20, paddingHorizontal:8, paddingVertical:2 },
  badgeText: { color:'#fff', fontSize:10, fontWeight:'700' },
  taskLabel: { fontSize:10, color:colors.muted, marginTop:6, marginBottom:3 },
  progressBg: { height:4, backgroundColor:colors.border, borderRadius:10, overflow:'hidden' },
  progressFill: { height:'100%', borderRadius:10 },
  empty: { textAlign:'center', color:colors.muted, marginTop:60 },
});