import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, RefreshControl, FlatList } from 'react-native';
import { useAuth } from '../context/AuthContext';
import * as api from '../api';
import { COLORS, BATCH_COLORS, STATUS_COLORS, Btn, Card, Badge, Avatar, Inp, Spinner, SectionTitle, EmptyCard } from '../components/UI';

// ── LOGIN ─────────────────────────────────────────────────────────────────
export function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const DEMOS = [
    { label:'School Admin', email:'priya@rhythmgrace.com', pw:'School123!' },
    { label:'Teacher',      email:'teacher@rhythmgrace.com', pw:'Teacher123!' },
    { label:'Parent',       email:'parent@rhythmgrace.com', pw:'Parent123!' },
  ];

  const handleLogin = async () => {
    if (!email || !password) { setError('Enter email and password'); return; }
    setLoading(true); setError('');
    try {
      const r = await api.login(email, password);
      await signIn(r.data.token, r.data.user);
    } catch (e) { setError(e.response?.data?.error || 'Login failed'); }
    finally { setLoading(false); }
  };

  return (
    <ScrollView contentContainerStyle={{ flexGrow:1, alignItems:'center', justifyContent:'center', backgroundColor:'#1e1228', padding:24 }}>
      <Text style={{ fontSize:52, marginBottom:10 }}>🩰</Text>
      <Text style={{ fontSize:30, fontWeight:'800', color:'#f0e8f8', marginBottom:6 }}>StudioFlow</Text>
      <Text style={{ fontSize:14, color:'#9a8aaa', marginBottom:32 }}>Dance School Management</Text>
      <View style={{ backgroundColor:'#fff', borderRadius:20, padding:24, width:'100%', maxWidth:400 }}>
        <Inp label="Email" value={email} onChangeText={setEmail} placeholder="your@email.com" keyboardType="email-address" autoCapitalize="none"/>
        <Inp label="Password" value={password} onChangeText={setPassword} placeholder="••••••••" secureTextEntry/>
        {error ? <Text style={{ color:COLORS.danger, fontSize:13, marginBottom:14, textAlign:'center' }}>{error}</Text> : null}
        <Btn label={loading ? 'Signing in…' : 'Sign In'} onPress={handleLogin} disabled={loading}/>
        <View style={{ marginTop:20, paddingTop:16, borderTopWidth:1, borderTopColor:COLORS.border }}>
          <Text style={{ fontSize:11, color:COLORS.muted, fontWeight:'700', letterSpacing:0.7, textTransform:'uppercase', marginBottom:10 }}>Demo Accounts</Text>
          {DEMOS.map(d => (
            <TouchableOpacity key={d.label} onPress={() => { setEmail(d.email); setPassword(d.pw); }}
              style={{ backgroundColor:COLORS.surface, borderRadius:9, padding:11, marginBottom:7, borderWidth:1, borderColor:COLORS.border }}>
              <Text style={{ fontWeight:'700', fontSize:13, color:COLORS.text }}>{d.label}</Text>
              <Text style={{ fontSize:11, color:COLORS.muted }}>{d.email}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────
export function DashboardScreen() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user.school_id) { setLoading(false); return; }
    try {
      const [s, b, sc, r, f] = await Promise.all([
        api.getStudents(user.school_id), api.getBatches(user.school_id),
        api.getSchedules(user.school_id), api.getRecitals(user.school_id), api.getFeesSummary(user.school_id),
      ]);
      setData({ students:s.data.students, batches:b.data.batches, schedules:sc.data.schedules, recitals:r.data.recitals, fees:f.data.summary });
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [user.school_id]);

  useEffect(() => { load(); }, []);
  const onRefresh = () => { setRefreshing(true); load(); };

  if (loading) return <Spinner/>;

  const upcoming = (data?.recitals || []).filter(r => new Date(r.event_date) >= new Date()).slice(0,3);
  const stats = [
    { label:'Students', val:data?.students?.length||0, color:'#e8607a', emoji:'👤' },
    { label:'Batches',  val:data?.batches?.length||0,  color:'#6a7fdb', emoji:'📚' },
    { label:'Classes',  val:data?.schedules?.length||0, color:'#f4a041', emoji:'📅' },
    { label:'Shows',    val:upcoming.length,             color:'#52c4a0', emoji:'🌟' },
  ];

  return (
    <ScrollView style={{ flex:1, backgroundColor:COLORS.bg }} contentContainerStyle={{ padding:18 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent}/>}>
      <Text style={{ fontSize:22, fontWeight:'800', color:COLORS.text, marginBottom:4 }}>Good day! 👋</Text>
      <Text style={{ fontSize:13, color:COLORS.muted, marginBottom:20 }}>{user.school_name}</Text>

      <View style={{ flexDirection:'row', flexWrap:'wrap', gap:10, marginBottom:22 }}>
        {stats.map(s => (
          <Card key={s.label} style={{ flex:1, minWidth:130, flexDirection:'row', alignItems:'center', gap:11, padding:14 }}>
            <View style={{ width:40, height:40, borderRadius:11, backgroundColor:s.color+'22', alignItems:'center', justifyContent:'center' }}>
              <Text style={{ fontSize:18 }}>{s.emoji}</Text>
            </View>
            <View>
              <Text style={{ fontSize:22, fontWeight:'800', color:s.color }}>{s.val}</Text>
              <Text style={{ fontSize:11, color:COLORS.muted }}>{s.label}</Text>
            </View>
          </Card>
        ))}
      </View>

      {data?.fees && user.role === 'school_admin' && (
        <Card style={{ marginBottom:20 }}>
          <Text style={{ fontSize:15, fontWeight:'800', color:COLORS.text, marginBottom:13 }}>💰 Fee Summary</Text>
          <View style={{ flexDirection:'row', gap:10 }}>
            {[{l:'Collected',v:data.fees.total_paid,c:COLORS.success},{l:'Pending',v:data.fees.total_pending,c:COLORS.warning},{l:'Overdue',v:data.fees.total_overdue,c:COLORS.danger}].map(f=>(
              <View key={f.l} style={{ flex:1, backgroundColor:COLORS.surface, borderRadius:10, padding:11, alignItems:'center' }}>
                <Text style={{ fontSize:16, fontWeight:'800', color:f.c }}>${parseFloat(f.v||0).toFixed(0)}</Text>
                <Text style={{ fontSize:10, color:COLORS.muted }}>{f.l}</Text>
              </View>
            ))}
          </View>
        </Card>
      )}

      {upcoming.length > 0 && (
        <View>
          <Text style={{ fontSize:15, fontWeight:'800', color:COLORS.text, marginBottom:11 }}>🌟 Upcoming Recitals</Text>
          {upcoming.map(r => (
            <Card key={r.id} style={{ flexDirection:'row', alignItems:'center', gap:13, padding:14, marginBottom:9 }}>
              <View style={{ backgroundColor:'#c4527a22', borderRadius:10, padding:8, alignItems:'center', minWidth:46 }}>
                <Text style={{ fontSize:16, fontWeight:'800', color:COLORS.accent }}>{new Date(r.event_date).getDate()}</Text>
                <Text style={{ fontSize:9, color:COLORS.muted, textTransform:'uppercase' }}>{new Date(r.event_date).toLocaleString('default',{month:'short'})}</Text>
              </View>
              <View style={{ flex:1 }}>
                <Text style={{ fontWeight:'700', fontSize:13, color:COLORS.text }}>{r.title}</Text>
                {r.venue && <Text style={{ fontSize:11, color:COLORS.muted }}>📍 {r.venue}</Text>}
              </View>
              <Badge label={r.status} color={STATUS_COLORS[r.status]}/>
            </Card>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

// ── STUDENTS ──────────────────────────────────────────────────────────────
export function StudentsScreen() {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(() => {
    api.getStudents(user.school_id).then(r => setStudents(r.data.students)).finally(() => { setLoading(false); setRefreshing(false); });
  }, [user.school_id]);
  useEffect(() => { load(); }, []);

  const remove = id => {
    Alert.alert('Remove Student', 'Are you sure?', [
      { text:'Cancel', style:'cancel' },
      { text:'Remove', style:'destructive', onPress: async () => { await api.updateStudent(user.school_id, id, { is_active:0 }); load(); } }
    ]);
  };

  const filtered = students.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <Spinner/>;
  return (
    <View style={{ flex:1, backgroundColor:COLORS.bg }}>
      <View style={{ padding:16, paddingBottom:8 }}>
        <TextInput value={search} onChangeText={setSearch} placeholder="Search students…"
          style={{ backgroundColor:'#fff', borderRadius:10, paddingHorizontal:14, paddingVertical:10, fontSize:14, borderWidth:1.5, borderColor:COLORS.border, color:COLORS.text }}/>
      </View>
      <FlatList data={filtered} keyExtractor={i=>String(i.id)} refreshing={refreshing}
        onRefresh={() => { setRefreshing(true); load(); }}
        contentContainerStyle={{ padding:16, paddingTop:8, gap:9 }}
        ListEmptyComponent={<EmptyCard icon="👤" title="No students" message="No students found"/>}
        renderItem={({ item:s }) => {
          const batch = s.batch_names?.split(',')[0];
          return (
            <Card style={{ flexDirection:'row', alignItems:'center', gap:12 }}>
              <Avatar name={s.name}/>
              <View style={{ flex:1, minWidth:0 }}>
                <Text style={{ fontWeight:'700', fontSize:14, color:COLORS.text }}>{s.name}</Text>
                <Text style={{ fontSize:12, color:COLORS.muted }} numberOfLines={1}>
                  {[s.age && `Age ${s.age}`, s.phone].filter(Boolean).join(' · ')}
                </Text>
                {s.guardian_name && <Text style={{ fontSize:11, color:COLORS.muted }}>👨‍👩‍👧 {s.guardian_name}</Text>}
              </View>
              <View style={{ alignItems:'flex-end', gap:6 }}>
                {batch && <Badge label={batch} color="#6a7fdb"/>}
                <TouchableOpacity onPress={() => remove(s.id)}>
                  <Text style={{ fontSize:18 }}>🗑</Text>
                </TouchableOpacity>
              </View>
            </Card>
          );
        }}
      />
    </View>
  );
}

// ── SCHEDULE ──────────────────────────────────────────────────────────────
const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

export function ScheduleScreen() {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    Promise.all([api.getSchedules(user.school_id), api.getBatches(user.school_id)])
      .then(([s, b]) => { setSchedules(s.data.schedules); setBatches(b.data.batches); })
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, [user.school_id]);
  useEffect(() => { load(); }, []);

  if (loading) return <Spinner/>;
  const byDay = DAYS.reduce((a,d) => { a[d] = schedules.filter(s=>s.day_of_week===d).sort((a,b)=>a.start_time.localeCompare(b.start_time)); return a; }, {});

  return (
    <ScrollView style={{ flex:1, backgroundColor:COLORS.bg }} contentContainerStyle={{ padding:18 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.accent}/>}>
      <Text style={{ fontSize:22, fontWeight:'800', color:COLORS.text, marginBottom:18 }}>Weekly Schedule</Text>
      {DAYS.map(day => {
        const classes = byDay[day];
        if (!classes.length) return null;
        return (
          <View key={day} style={{ marginBottom:18 }}>
            <Text style={{ fontSize:11, fontWeight:'700', color:COLORS.muted, letterSpacing:1, textTransform:'uppercase', marginBottom:9 }}>{day}</Text>
            {classes.map(cls => {
              const bi = batches.findIndex(b => b.id === cls.batch_id);
              const color = BATCH_COLORS[bi % BATCH_COLORS.length] || '#888';
              return (
                <View key={cls.id} style={{ backgroundColor:color+'18', borderLeftWidth:3, borderLeftColor:color, borderRadius:9, padding:12, marginBottom:8 }}>
                  <Text style={{ fontWeight:'700', fontSize:14, color:COLORS.text }}>{cls.batch_name}</Text>
                  <Text style={{ fontSize:12, color:COLORS.muted }}>{cls.start_time.slice(0,5)} – {cls.end_time.slice(0,5)}</Text>
                  {cls.room && <Text style={{ fontSize:12, color:COLORS.muted }}>📍 {cls.room}</Text>}
                  <View style={{ marginTop:6 }}><Badge label={cls.frequency}/></View>
                </View>
              );
            })}
          </View>
        );
      })}
      {schedules.length === 0 && <EmptyCard icon="📅" title="No classes scheduled" message="Add classes via the web app"/>}
    </ScrollView>
  );
}

// ── RECITALS ──────────────────────────────────────────────────────────────
export function RecitalsScreen({ navigation }) {
  const { user } = useAuth();
  const [recitals, setRecitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    api.getRecitals(user.school_id).then(r => setRecitals(r.data.recitals)).finally(() => { setLoading(false); setRefreshing(false); });
  }, [user.school_id]);
  useEffect(() => { load(); }, []);

  if (loading) return <Spinner/>;
  const sorted = [...recitals].sort((a,b) => new Date(b.event_date)-new Date(a.event_date));

  return (
    <FlatList data={sorted} keyExtractor={i=>String(i.id)} refreshing={refreshing}
      onRefresh={() => { setRefreshing(true); load(); }}
      contentContainerStyle={{ padding:18, gap:11, backgroundColor:COLORS.bg }}
      style={{ backgroundColor:COLORS.bg }}
      ListHeaderComponent={<Text style={{ fontSize:22, fontWeight:'800', color:COLORS.text, marginBottom:6 }}>Recitals & Events</Text>}
      ListEmptyComponent={<EmptyCard icon="🌟" title="No events yet" message="Plan your first recital!"/>}
      renderItem={({ item:r }) => {
        const color = STATUS_COLORS[r.status]||'#888';
        const d = new Date(r.event_date);
        const pct = r.task_count ? Math.round((r.tasks_done/r.task_count)*100) : 0;
        return (
          <Card onPress={() => navigation.navigate('RecitalDetail', { recitalId:r.id, schoolId:user.school_id })}>
            <View style={{ flexDirection:'row', gap:13, alignItems:'flex-start' }}>
              <View style={{ backgroundColor:color+'20', borderRadius:10, padding:8, alignItems:'center', minWidth:50 }}>
                <Text style={{ fontSize:17, fontWeight:'800', color }}>{d.getDate()}</Text>
                <Text style={{ fontSize:9, color:COLORS.muted, textTransform:'uppercase' }}>{d.toLocaleString('default',{month:'short',year:'2-digit'})}</Text>
              </View>
              <View style={{ flex:1 }}>
                <View style={{ flexDirection:'row', alignItems:'center', gap:8, marginBottom:3, flexWrap:'wrap' }}>
                  <Text style={{ fontWeight:'800', fontSize:14, color:COLORS.text }}>{r.title}</Text>
                  <Badge label={r.status} color={color}/>
                </View>
                {r.venue && <Text style={{ fontSize:12, color:COLORS.muted, marginBottom:r.task_count?8:0 }}>📍 {r.venue}</Text>}
                {r.task_count > 0 && (
                  <View>
                    <Text style={{ fontSize:11, color:COLORS.muted, marginBottom:4 }}>Tasks: {r.tasks_done}/{r.task_count} done</Text>
                    <View style={{ height:4, backgroundColor:COLORS.border, borderRadius:10, overflow:'hidden' }}>
                      <View style={{ height:'100%', width:`${pct}%`, backgroundColor:color, borderRadius:10 }}/>
                    </View>
                  </View>
                )}
              </View>
            </View>
          </Card>
        );
      }}
    />
  );
}

export function RecitalDetailScreen({ route }) {
  const { recitalId, schoolId } = route.params;
  const [recital, setRecital] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTask, setNewTask] = useState('');

  const load = useCallback(() => {
    api.getRecital(schoolId, recitalId).then(r => { setRecital(r.data.recital); setTasks(r.data.tasks); }).finally(() => setLoading(false));
  }, [schoolId, recitalId]);
  useEffect(() => { load(); }, []);

  const toggleTask = async (t) => {
    await api.updateTask(schoolId, recitalId, t.id, { is_done: !t.is_done });
    setTasks(prev => prev.map(x => x.id===t.id ? {...x, is_done:!x.is_done} : x));
  };

  const addTask = async () => {
    if (!newTask.trim()) return;
    const r = await api.createTask(schoolId, recitalId, { task_text: newTask });
    setTasks(prev => [...prev, r.data.task]); setNewTask('');
  };

  if (loading || !recital) return <Spinner/>;
  const done = tasks.filter(t=>t.is_done).length;

  return (
    <ScrollView style={{ flex:1, backgroundColor:COLORS.bg }} contentContainerStyle={{ padding:18 }}>
      <Text style={{ fontSize:22, fontWeight:'800', color:COLORS.text, marginBottom:6 }}>{recital.title}</Text>
      <View style={{ flexDirection:'row', gap:9, marginBottom:12, flexWrap:'wrap', alignItems:'center' }}>
        <Badge label={recital.status} color={STATUS_COLORS[recital.status]}/>
        <Text style={{ fontSize:12, color:COLORS.muted }}>📅 {new Date(recital.event_date).toLocaleDateString('en',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</Text>
      </View>
      {recital.venue && <Text style={{ fontSize:13, color:COLORS.muted, marginBottom:14 }}>📍 {recital.venue}</Text>}
      {recital.description && <Text style={{ fontSize:13, color:COLORS.muted, marginBottom:18 }}>{recital.description}</Text>}

      <Text style={{ fontSize:16, fontWeight:'800', color:COLORS.text, marginBottom:11 }}>Checklist · {done}/{tasks.length}</Text>
      {tasks.map(t => (
        <TouchableOpacity key={t.id} onPress={() => toggleTask(t)} activeOpacity={0.7}
          style={{ flexDirection:'row', alignItems:'center', gap:11, padding:12, borderRadius:10,
            borderWidth:1.5, borderColor:t.is_done?COLORS.accent:COLORS.border,
            backgroundColor:t.is_done?'#c4527a11':COLORS.surface, marginBottom:7 }}>
          <View style={{ width:20, height:20, borderRadius:6, borderWidth:2, borderColor:t.is_done?COLORS.accent:COLORS.border,
            backgroundColor:t.is_done?COLORS.accent:'transparent', alignItems:'center', justifyContent:'center' }}>
            {t.is_done && <Text style={{ color:'#fff', fontSize:11, fontWeight:'800' }}>✓</Text>}
          </View>
          <Text style={{ flex:1, fontSize:13, color:COLORS.text, textDecorationLine:t.is_done?'line-through':'none', opacity:t.is_done?.6:1 }}>{t.task_text}</Text>
        </TouchableOpacity>
      ))}
      <View style={{ flexDirection:'row', gap:9, marginTop:8 }}>
        <TextInput value={newTask} onChangeText={setNewTask} placeholder="Add a task…" onSubmitEditing={addTask}
          style={{ flex:1, backgroundColor:'#fff', borderWidth:1.5, borderColor:COLORS.border, borderRadius:9, paddingHorizontal:13, paddingVertical:10, fontSize:14, color:COLORS.text }}/>
        <Btn label="Add" onPress={addTask} style={{ paddingHorizontal:16 }}/>
      </View>
    </ScrollView>
  );
}

// ── FEES ──────────────────────────────────────────────────────────────────
export function FeesScreen() {
  const { user } = useAuth();
  const [fees, setFees] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    Promise.all([api.getFees(user.school_id, filter?{status:filter}:{}), api.getFeesSummary(user.school_id)])
      .then(([f,s]) => { setFees(f.data.fees); setSummary(s.data.summary); })
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, [user.school_id, filter]);
  useEffect(() => { load(); }, [filter]);

  const markPaid = id => {
    Alert.alert('Mark as Paid', 'Confirm payment received?', [
      { text:'Cancel', style:'cancel' },
      { text:'Confirm', onPress: async () => { await api.updateFee(user.school_id, id, { status:'Paid', paid_date: new Date().toISOString().split('T')[0] }); load(); } }
    ]);
  };

  if (loading) return <Spinner/>;

  return (
    <ScrollView style={{ flex:1, backgroundColor:COLORS.bg }} contentContainerStyle={{ padding:18 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.accent}/>}>
      <Text style={{ fontSize:22, fontWeight:'800', color:COLORS.text, marginBottom:16 }}>Fee Management</Text>

      {summary && (
        <View style={{ flexDirection:'row', gap:9, marginBottom:20 }}>
          {[{l:'Collected',v:summary.total_paid,c:COLORS.success},{l:'Pending',v:summary.total_pending,c:COLORS.warning},{l:'Overdue',v:summary.total_overdue,c:COLORS.danger}].map(s => (
            <Card key={s.l} style={{ flex:1, alignItems:'center', padding:12 }}>
              <Text style={{ fontSize:16, fontWeight:'800', color:s.c }}>${parseFloat(s.v||0).toFixed(0)}</Text>
              <Text style={{ fontSize:10, color:COLORS.muted }}>{s.l}</Text>
            </Card>
          ))}
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom:16 }}>
        <View style={{ flexDirection:'row', gap:8 }}>
          {['All','Pending','Paid','Overdue'].map(s => (
            <TouchableOpacity key={s} onPress={() => setFilter(s==='All'?'':s)}
              style={{ paddingVertical:7, paddingHorizontal:16, borderRadius:20, borderWidth:1.5, borderColor:COLORS.border,
                backgroundColor:(filter===s||(s==='All'&&!filter))?COLORS.accent:'transparent' }}>
              <Text style={{ fontSize:13, fontWeight:'600', color:(filter===s||(s==='All'&&!filter))?'#fff':COLORS.text }}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {fees.length === 0 ? <EmptyCard icon="💰" title="No fee records" message="No fees match the current filter"/> :
        fees.map(f => (
          <Card key={f.id} style={{ flexDirection:'row', alignItems:'center', gap:13, marginBottom:9, paddingVertical:13 }}>
            <View style={{ flex:1 }}>
              <Text style={{ fontWeight:'700', fontSize:14, color:COLORS.text }}>{f.student_name}</Text>
              <Text style={{ fontSize:12, color:COLORS.muted }}>{f.description || 'Tuition'} · Due {new Date(f.due_date).toLocaleDateString()}</Text>
            </View>
            <View style={{ alignItems:'flex-end', gap:6 }}>
              <Text style={{ fontWeight:'800', fontSize:15, color:f.status==='Overdue'?COLORS.danger:COLORS.text }}>${parseFloat(f.amount).toFixed(2)}</Text>
              <Badge label={f.status} color={STATUS_COLORS[f.status]}/>
              {f.status !== 'Paid' && f.status !== 'Waived' && (
                <TouchableOpacity onPress={() => markPaid(f.id)} style={{ backgroundColor:COLORS.success+'22', paddingVertical:4, paddingHorizontal:10, borderRadius:8 }}>
                  <Text style={{ fontSize:11, fontWeight:'700', color:COLORS.success }}>✓ Paid</Text>
                </TouchableOpacity>
              )}
            </View>
          </Card>
        ))
      }
    </ScrollView>
  );
}

// ── PARENT PORTAL ─────────────────────────────────────────────────────────
export function ParentScreen() {
  const { user } = useAuth();
  const [children, setChildren] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [recitals, setRecitals] = useState([]);
  const [fees, setFees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    Promise.all([api.parentGetChildren(), api.parentGetSchedules(), api.parentGetRecitals(), api.parentGetFees()])
      .then(([c,s,r,f]) => { setChildren(c.data.children); setSchedules(s.data.schedules); setRecitals(r.data.recitals); setFees(f.data.fees); })
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []);
  useEffect(() => { load(); }, []);

  if (loading) return <Spinner/>;
  const pendingFees = fees.filter(f => f.status !== 'Paid' && f.status !== 'Waived');

  return (
    <ScrollView style={{ flex:1, backgroundColor:COLORS.bg }} contentContainerStyle={{ padding:18 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.accent}/>}>
      <Text style={{ fontSize:22, fontWeight:'800', color:COLORS.text, marginBottom:4 }}>My Portal</Text>
      <Text style={{ fontSize:13, color:COLORS.muted, marginBottom:20 }}>Welcome, {user.name}!</Text>

      {children.length > 0 && (
        <View style={{ marginBottom:22 }}>
          <Text style={{ fontSize:15, fontWeight:'800', color:COLORS.text, marginBottom:11 }}>👤 My Children</Text>
          {children.map(c => (
            <Card key={c.id} style={{ flexDirection:'row', alignItems:'center', gap:12, marginBottom:9 }}>
              <Avatar name={c.name}/>
              <View style={{ flex:1 }}>
                <Text style={{ fontWeight:'700', fontSize:14, color:COLORS.text }}>{c.name}</Text>
                <Text style={{ fontSize:12, color:COLORS.muted }}>{c.batch_names || 'No batch assigned'}</Text>
              </View>
            </Card>
          ))}
        </View>
      )}

      {schedules.length > 0 && (
        <View style={{ marginBottom:22 }}>
          <Text style={{ fontSize:15, fontWeight:'800', color:COLORS.text, marginBottom:11 }}>📅 Class Schedule</Text>
          {schedules.map(s => (
            <Card key={s.id} style={{ flexDirection:'row', alignItems:'center', gap:12, marginBottom:9 }}>
              <View style={{ width:46, height:46, borderRadius:10, backgroundColor:COLORS.accent+'22', alignItems:'center', justifyContent:'center' }}>
                <Text style={{ fontSize:12, fontWeight:'800', color:COLORS.accent }}>{s.day_of_week}</Text>
              </View>
              <View style={{ flex:1 }}>
                <Text style={{ fontWeight:'700', fontSize:13, color:COLORS.text }}>{s.batch_name}</Text>
                <Text style={{ fontSize:12, color:COLORS.muted }}>{s.start_time.slice(0,5)} – {s.end_time.slice(0,5)}{s.room?` · ${s.room}`:''}</Text>
              </View>
              <Badge label={s.frequency}/>
            </Card>
          ))}
        </View>
      )}

      {recitals.length > 0 && (
        <View style={{ marginBottom:22 }}>
          <Text style={{ fontSize:15, fontWeight:'800', color:COLORS.text, marginBottom:11 }}>🌟 Upcoming Recitals</Text>
          {recitals.map(r => (
            <Card key={r.id} style={{ flexDirection:'row', alignItems:'center', gap:12, marginBottom:9 }}>
              <View style={{ backgroundColor:COLORS.accent+'22', borderRadius:9, padding:7, alignItems:'center', minWidth:46 }}>
                <Text style={{ fontSize:16, fontWeight:'800', color:COLORS.accent }}>{new Date(r.event_date).getDate()}</Text>
                <Text style={{ fontSize:9, color:COLORS.muted, textTransform:'uppercase' }}>{new Date(r.event_date).toLocaleString('default',{month:'short'})}</Text>
              </View>
              <View style={{ flex:1 }}>
                <Text style={{ fontWeight:'700', fontSize:13, color:COLORS.text }}>{r.title}</Text>
                {r.venue && <Text style={{ fontSize:11, color:COLORS.muted }}>📍 {r.venue}</Text>}
              </View>
              <Badge label={r.status} color={STATUS_COLORS[r.status]}/>
            </Card>
          ))}
        </View>
      )}

      {pendingFees.length > 0 && (
        <View>
          <Text style={{ fontSize:15, fontWeight:'800', color:COLORS.text, marginBottom:11 }}>💰 Outstanding Fees</Text>
          {pendingFees.map(f => (
            <Card key={f.id} style={{ flexDirection:'row', alignItems:'center', gap:12, marginBottom:9, borderLeftWidth:3, borderLeftColor:COLORS.warning }}>
              <View style={{ flex:1 }}>
                <Text style={{ fontWeight:'700', fontSize:13, color:COLORS.text }}>{f.description || 'Tuition Fee'}</Text>
                <Text style={{ fontSize:11, color:COLORS.muted }}>Due {new Date(f.due_date).toLocaleDateString()}</Text>
              </View>
              <View style={{ alignItems:'flex-end', gap:5 }}>
                <Text style={{ fontWeight:'800', fontSize:15, color:COLORS.warning }}>${parseFloat(f.amount).toFixed(2)}</Text>
                <Badge label={f.status} color={STATUS_COLORS[f.status]}/>
              </View>
            </Card>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

// ── PROFILE ───────────────────────────────────────────────────────────────
export function ProfileScreen() {
  const { user, signOut } = useAuth();
  const roleLabel = { superadmin:'Super Admin', school_admin:'School Admin', teacher:'Teacher', parent:'Parent' };
  return (
    <ScrollView style={{ flex:1, backgroundColor:COLORS.bg }} contentContainerStyle={{ padding:18 }}>
      <Text style={{ fontSize:22, fontWeight:'800', color:COLORS.text, marginBottom:22 }}>Profile</Text>
      <Card style={{ alignItems:'center', padding:28, marginBottom:18 }}>
        <Avatar name={user.name} size={72}/>
        <Text style={{ fontSize:20, fontWeight:'800', color:COLORS.text, marginTop:14, marginBottom:4 }}>{user.name}</Text>
        <Text style={{ fontSize:13, color:COLORS.muted, marginBottom:6 }}>{user.email}</Text>
        <Badge label={roleLabel[user.role]||user.role} color={COLORS.accent}/>
        {user.school_name && <Text style={{ fontSize:12, color:COLORS.muted, marginTop:8 }}>🏫 {user.school_name}</Text>}
      </Card>
      <Btn label="🚪 Sign Out" variant="danger" onPress={() => Alert.alert('Sign Out','Are you sure?',[{text:'Cancel',style:'cancel'},{text:'Sign Out',style:'destructive',onPress:signOut}])}/>
    </ScrollView>
  );
}
