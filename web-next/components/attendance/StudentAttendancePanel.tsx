'use client';

// Read-only attendance summary + recent history for a single student.
// Designed to be embedded inside the existing student detail panel
// (uses the same PanelSection visual rhythm).

import React, { useEffect, useState } from 'react';
import { attendance, type AttendanceStatus } from '@/lib/api';

type Props = {
  schoolId: string;
  studentId: number;
  rangeDays?: number;  // defaults to 90
};

type Stats = { total: number; present: number; late: number; absent: number; excused: number; rate: number | null };
type AttendanceRecord = {
  id: number; class_date: string; status: AttendanceStatus; notes?: string | null;
  event_id: number | null; schedule_id: number | null;
  event_title?: string | null; batch_name?: string | null;
};

const STATUS_META: Record<AttendanceStatus, { label: string; color: string; icon: string }> = {
  present: { label: 'Present', color: '#10B981', icon: '✓' },
  late:    { label: 'Late',    color: '#F59E0B', icon: '⏱' },
  excused: { label: 'Excused', color: '#6366F1', icon: '∼' },
  absent:  { label: 'Absent',  color: '#EF4444', icon: '✗' },
};

function fmtDate(d: string) {
  try {
    const dt = new Date(String(d).slice(0, 10) + 'T12:00:00');
    return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  } catch { return d; }
}

export default function StudentAttendancePanel({ schoolId, studentId, rangeDays = 90 }: Props) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);

  useEffect(() => {
    if (!studentId || !schoolId) return;
    setLoading(true);
    const today = new Date();
    const from = new Date(); from.setDate(today.getDate() - rangeDays);
    attendance
      .forStudent(schoolId, studentId, {
        from: from.toISOString().slice(0, 10),
        to: today.toISOString().slice(0, 10),
      })
      .then((data: any) => {
        setStats(data.stats);
        setRecords(data.records || []);
        setRange(data.range || null);
      })
      .catch(() => {
        setStats({ total: 0, present: 0, late: 0, absent: 0, excused: 0, rate: null });
        setRecords([]);
      })
      .finally(() => setLoading(false));
  }, [studentId, schoolId, rangeDays]);

  if (loading) {
    return <p style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: '14px 0' }}>Loading attendance…</p>;
  }

  if (!stats || stats.total === 0) {
    return (
      <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
        No attendance records in the last {rangeDays} days. Mark attendance from the schedule page.
      </p>
    );
  }

  return (
    <div>
      {/* Headline rate */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 32, fontWeight: 800, color: (stats.rate ?? 0) >= 80 ? '#10B981' : (stats.rate ?? 0) >= 60 ? '#F59E0B' : '#EF4444', lineHeight: 1 }}>
          {stats.rate ?? 0}%
        </span>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
          attended ({stats.present + stats.late} of {stats.total} classes)
        </span>
      </div>

      {/* Status breakdown chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
        {(['present', 'late', 'excused', 'absent'] as AttendanceStatus[]).map((s) => {
          const n = stats[s];
          const meta = STATUS_META[s];
          return (
            <span
              key={s}
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '3px 9px',
                borderRadius: 14,
                background: meta.color + '18',
                color: meta.color,
                opacity: n > 0 ? 1 : 0.4,
              }}
            >
              {meta.icon} {meta.label}: {n}
            </span>
          );
        })}
      </div>

      {/* Recent records */}
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>
        Recent
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 240, overflowY: 'auto' }}>
        {records.slice(0, 30).map((r) => {
          const meta = STATUS_META[r.status];
          return (
            <div
              key={r.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 10px',
                background: 'var(--surface)',
                borderRadius: 8,
                borderLeft: `3px solid ${meta.color}`,
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 700, color: meta.color, minWidth: 18 }}>{meta.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.event_title || r.batch_name || 'Class'}
                </div>
                <div style={{ fontSize: 10, color: 'var(--muted)' }}>{fmtDate(r.class_date)}</div>
              </div>
            </div>
          );
        })}
      </div>

      {range && (
        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 8 }}>
          Range: {fmtDate(range.from)} — {fmtDate(range.to)}
        </div>
      )}
    </div>
  );
}
