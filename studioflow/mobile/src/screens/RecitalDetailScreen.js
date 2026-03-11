import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { recitals as api } from '../api';
import { colors, STATUS_COLORS } from '../theme';

export default function RecitalDetailScreen({ route }) {
  const { id, schoolId } = route.params;
  const qc = useQueryClient();
  const [newTask, setNewTask] = useState('');
  const { data: recital } = useQuery({ queryKey:['recital-detail',id], queryFn:()=>api.get(schoolId, id) });

  const toggleMutation = useMutation({
    mutationFn: taskId => api.toggleTask(schoolId, id, taskId),
    onSuccess: () => qc.invalidateQueries(['recital-detail', id]),
  });

  const addMutation = useMutation({
    mutationFn: text => api.addTask(schoolId, id, text),
    onSuccess: () => { qc.invalidateQueries(['recital-detail', id]); setNewTask(''); },
  });

  if (!recital) return <View style={s.screen}><Text style={{color:colors.muted,textAlign:'center',marginTop:60}}>Loading…</Text></View>;

  const color = STATUS_COLORS[recital.status] || colors.accent;
  const tasks = recital.tasks || [];
  const done = tasks.filter(t=>t.is_done).length;

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <View style={[s.badge, { backgroundColor: color }]}><Text style={s.badgeText}>{recital.status}</Text></View>
      <Text style={s.date}>📅 {new Date(recital.event_date).toLocaleDateString('en',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</Text>
      {recital.venue ? <Text style={s.venue}>📍 {recital.venue}</Text> : null}
      {recital.description ? <Text style={s.desc}>{recital.description}</Text> : null}
      <Text style={s.sectionTitle}>Checklist · {done}/{tasks.length}</Text>
      {tasks.map(t=>(
        <TouchableOpacity key={t.id} style={[s.task, t.is_done && s.taskDone]} onPress={()=>toggleMutation.mutate(t.id)}>
          <View style={[s.check, t.is_done && { backgroundColor: colors.accent, borderColor: colors.accent }]}>
            {t.is_done && <Text style={{ color:'#fff', fontSize:10, fontWeight:'800' }}>✓</Text>}
          </View>
          <Text style={[s.taskText, t.is_done && { textDecorationLine:'line-through', opacity:0.5 }]}>{t.task_text}</Text>
        </TouchableOpacity>
      ))}
      <View style={s.addRow}>
        <TextInput style={s.addInput} value={newTask} onChangeText={setNewTask} placeholder="Add a task…" placeholderTextColor={colors.muted} />
        <TouchableOpacity style={s.addBtn} onPress={()=>{ if(newTask.trim()) addMutation.mutate(newTask); }}>
          <Text style={s.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex:1, backgroundColor:colors.bg },
  content: { padding:20 },
  badge: { alignSelf:'flex-start', borderRadius:20, paddingHorizontal:10, paddingVertical:3, marginBottom:10 },
  badgeText: { color:'#fff', fontWeight:'700', fontSize:12 },
  date: { fontSize:13, color:colors.muted, marginBottom:4 },
  venue: { fontSize:13, color:colors.muted, marginBottom:10 },
  desc: { fontSize:14, color:colors.text, marginBottom:16 },
  sectionTitle: { fontSize:16, fontWeight:'700', color:colors.text, marginBottom:12 },
  task: { flexDirection:'row', alignItems:'center', gap:11, padding:12, borderRadius:10, backgroundColor:'#fff', marginBottom:7, borderWidth:1.5, borderColor:colors.border },
  taskDone: { backgroundColor:'#c4527a11', borderColor:colors.accent },
  check: { width:20, height:20, borderRadius:5, borderWidth:2, borderColor:colors.border, alignItems:'center', justifyContent:'center' },
  taskText: { flex:1, fontSize:13, color:colors.text },
  addRow: { flexDirection:'row', gap:9, marginTop:8 },
  addInput: { flex:1, borderWidth:1.5, borderColor:colors.border, borderRadius:10, padding:10, fontSize:14, color:colors.text, backgroundColor:'#faf8fc' },
  addBtn: { backgroundColor:colors.accent, borderRadius:10, paddingHorizontal:16, justifyContent:'center' },
  addBtnText: { color:'#fff', fontWeight:'700' },
});