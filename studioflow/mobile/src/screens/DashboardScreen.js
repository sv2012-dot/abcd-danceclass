import React from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { students, batches, recitals, fees } from '../api';
import { colors, STATUS_COLORS } from '../theme';

function StatCard({ label, value, icon, color }) {
  return (
    <View style={[s.stat, { flex: 1 }]}>
      <Text style={s.statIcon}>{icon}</Text>
      <Text style={[s.statVal, { color }]}>{value ?? '—'}</Text>
      <Text style={s.statLbl}>{label}</Text>
    </View>
  );
}

export default function DashboardScreen() {
  const { user, school, logout } = useAuth();
  const sid = user?.school_id;

  const { data: studentList = [], isFetching: fetchingStudents, refetch: refetchStudents } =
    useQuery({ queryKey: ['students-dash', sid], queryFn: () => students.list(sid), enabled: !!sid });

  const { data: batchList = [], isFetching: fetchingBatches, refetch: refetchBatches } =
    useQuery({ queryKey: ['batches-dash', sid], queryFn: () => batches.list(sid), enabled: !!sid });

  const { data: recitalList = [], isFetching: fetchingRecitals, refetch: refetchRecitals } =
    useQuery({ queryKey: ['recitals-dash', sid], queryFn: () => recitals.list(sid), enabled: !!sid });

  const { data: feeSummary, isFetching: fetchingFees, refetch: refetchFees } =
    useQuery({ queryKey: ['fees-summary-dash', sid], queryFn: () => fees.summary(sid), enabled: !!sid });

  const isFetching = fetchingStudents || fetchingBatches || fetchingRecitals || fetchingFees;
  const refetchAll = () => { refetchStudents(); refetchBatches(); refetchRecitals(); refetchFees(); };

  const upcoming = recitalList
    .filter(r => new Date(r.event_date) >= new Date())
    .sort((a, b) => new Date(a.event_date) - new Date(b.event_date));

  const pendingFees = feeSummary?.total_pending ?? 0;

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetchAll} tintColor={colors.accent} />}
    >
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.greeting}>{greeting} 👋</Text>
          <Text style={s.schoolName}>{school?.name || 'ManchQ'}</Text>
        </View>
        <TouchableOpacity style={s.logoutBtn} onPress={logout}>
          <Text style={s.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* Stats Row */}
      <View style={s.statRow}>
        <StatCard label="Students" value={studentList.length} icon="👤" color={colors.accent} />
        <StatCard label="Batches" value={batchList.length} icon="📚" color={colors.info} />
        <StatCard label="Events" value={recitalList.length} icon="⭐" color={colors.warning} />
      </View>

      {/* Fees Due */}
      {pendingFees > 0 && (
        <View style={[s.alertCard, { borderLeftColor: colors.warning }]}>
          <Text style={s.alertIcon}>💳</Text>
          <View>
            <Text style={s.alertTitle}>Fees Pending</Text>
            <Text style={s.alertSub}>₹{Number(pendingFees).toLocaleString('en-IN')} outstanding</Text>
          </View>
        </View>
      )}

      {/* Upcoming Events */}
      {upcoming.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>🌟 Upcoming Events</Text>
          {upcoming.slice(0, 3).map(r => {
            const d = new Date(r.event_date);
            const color = STATUS_COLORS[r.status] || colors.accent;
            return (
              <View key={r.id} style={s.eventCard}>
                <View style={[s.dateBadge, { backgroundColor: color + '22' }]}>
                  <Text style={[s.dateDay, { color }]}>{d.getDate()}</Text>
                  <Text style={s.dateMon}>{d.toLocaleString('default', { month: 'short' })}</Text>
                </View>
                <View style={{ flex: 1 }}>
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

      {upcoming.length === 0 && recitalList.length === 0 && (
        <View style={s.emptyState}>
          <Text style={s.emptyEmoji}>🩰</Text>
          <Text style={s.emptyText}>No upcoming events.</Text>
          <Text style={s.emptySub}>Head to Recitals to add one.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  greeting: { fontSize: 24, fontWeight: '800', color: colors.text },
  schoolName: { fontSize: 13, color: colors.muted, marginTop: 2 },
  logoutBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5, borderColor: colors.border },
  logoutText: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  statRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  stat: { backgroundColor: '#fff', borderRadius: 14, padding: 16, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  statIcon: { fontSize: 22, marginBottom: 6 },
  statVal: { fontSize: 24, fontWeight: '800', lineHeight: 28 },
  statLbl: { fontSize: 11, color: colors.muted, marginTop: 2 },
  alertCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20, borderLeftWidth: 4, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  alertIcon: { fontSize: 24 },
  alertTitle: { fontWeight: '700', fontSize: 14, color: colors.text },
  alertSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 12 },
  eventCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 13, marginBottom: 9, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  dateBadge: { width: 46, borderRadius: 10, padding: 8, alignItems: 'center' },
  dateDay: { fontSize: 16, fontWeight: '800' },
  dateMon: { fontSize: 9, color: colors.muted, textTransform: 'uppercase' },
  eventTitle: { fontWeight: '700', fontSize: 13, color: colors.text },
  eventVenue: { fontSize: 11, color: colors.muted },
  statusBadge: { borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3 },
  statusText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  emptyState: { alignItems: 'center', paddingTop: 48 },
  emptyEmoji: { fontSize: 52, marginBottom: 12 },
  emptyText: { fontSize: 18, fontWeight: '700', color: colors.text },
  emptySub: { fontSize: 13, color: colors.muted, marginTop: 4 },
});
