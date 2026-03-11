import React, { useState } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, Alert, RefreshControl } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { students as api } from '../api';
import { colors } from '../theme';

export default function StudentsScreen() {
  const { user } = useAuth();
  const sid = user?.school_id;
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const { data: list=[], isFetching, refetch } = useQuery({ queryKey:['students-m',sid], queryFn:()=>api.list(sid), enabled:!!sid });
  const filtered = list.filter(s=>s.name.toLowerCase().includes(search.toLowerCase()));

  const renderItem = ({ item: s }) => (
    <View style={st.card}>
      <View style={[st.avatar, { backgroundColor:`hsl(${s.name.charCodeAt(0)*7%360},55%,68%)` }]}>
        <Text style={st.avatarText}>{s.name[0]}</Text>
      </View>
      <View style={{ flex:1 }}>
        <Text style={st.name}>{s.name}</Text>
        <Text style={st.sub}>{[s.age&&`Age ${s.age}`, s.phone].filter(Boolean).join(' · ')}</Text>
        {s.batches ? <Text style={st.batch}>📚 {s.batches}</Text> : null}
      </View>
    </View>
  );

  return (
    <View style={st.screen}>
      <TextInput style={st.search} value={search} onChangeText={setSearch} placeholder="Search students…" placeholderTextColor={colors.muted} />
      <FlatList
        data={filtered}
        keyExtractor={s=>String(s.id)}
        renderItem={renderItem}
        contentContainerStyle={{ padding:16, paddingTop:0 }}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor={colors.accent} />}
        ListEmptyComponent={<Text style={st.empty}>No students found.</Text>}
      />
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex:1, backgroundColor:colors.bg },
  search: { margin:16, marginBottom:8, borderWidth:1.5, borderColor:colors.border, borderRadius:10, padding:10, fontSize:14, color:colors.text, backgroundColor:'#faf8fc' },
  card: { backgroundColor:'#fff', borderRadius:13, padding:14, flexDirection:'row', alignItems:'center', gap:12, marginBottom:9, shadowColor:'#000', shadowOpacity:0.05, shadowRadius:4, elevation:2 },
  avatar: { width:40, height:40, borderRadius:20, alignItems:'center', justifyContent:'center' },
  avatarText: { color:'#fff', fontWeight:'800', fontSize:15 },
  name: { fontWeight:'700', fontSize:14, color:colors.text },
  sub: { fontSize:12, color:colors.muted, marginTop:1 },
  batch: { fontSize:11, color:colors.info, marginTop:3 },
  empty: { textAlign:'center', color:colors.muted, marginTop:40 },
});