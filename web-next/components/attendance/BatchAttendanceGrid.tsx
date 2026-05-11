'use client';

// Compact attendance grid for a batch: students × class dates.
// Each cell colored by status. Click a student name to see their detail.

import React, { useEffect, useState } from 'react';
import { attendance, type AttendanceStatus } from '@/lib/api';

type Props = {
  schoolId: string;
  batchId: number;
  rangeDays?: number;  // defaults to 30
};

type StudentRow = { id: number; name: string };
type StudentStats = {
  present: number; late: number; absent: number; excused: number;
  total: number; rate: number | null;
  dates: string[];
  statuses: AttendanceStatus[];
};

const STATUS_COLOR: Record<AttendanceStatus, string> = {
  present: '#10B981',
  late: '#F59E0B',
  excused: '#6366F1',
  absent: '#EF4444',
};

function fmtShort(d: string) {
  try {
    const dt = new Date(String(d).slice(0, 10) + 'T12:00:00');
    return dt.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
  } catch { return d; }
}

export default function BatchAttendanceGrid({ schoolId, batchId, rangeDays = 30 }: Props) {
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [byStudent, setByStudent] = useState<Record<number, StudentStats>>({});
  const [allDates, setAllDates] = useState<string[]>([]);
  const [days, setDays] = useState<number>(rangeDays);

  useEffect(() => {
    if (!schoolId || !batchId) return;
    setLoading(true);
    const today = new Date();
    const from = new Date(); from.setDate(today.getDate() - days);
    attendance
      .batchStats(schoolId, batchId, {
        from: from.toISOString().slice(0, 10),
        to: today.toISOString().slice(0, 10),
      })
      .then((data: any) => {
        setStudents(data.students || []);
        setByStudent(data.byStudent || {});
        // Build a unique set of dates across all students
        const dateSet = new Set<string>();
        for (const s of Object.values(data.byStudent || {}) as StudentStats[]) {
          for (const d of s.dates) dateSet.add(d);
        }
        setAllDates(Array.from(dateSet).sort());
      })
      .catch(() => {
        setStudents([]);
        setByStudent({});
        setAllDates([]);
      })
      .finally(() => setLoading(false));
  }, [schoolId, batchId, days]);

  if (loading) {
    return <p style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: '14px 0' }}>Loading attendance…</p>;
  }

  const hasAnyAttendance = allDates.length > 0;

  // Build per-student lookup: date → status
  const lookup = new Map<number, Map<string, AttendanceStatus>>();
  for (const sid of Object.keys(byStudent)) {
    const s = byStudent[Number(sid)];
    const m = new Map<string, AttendanceStatus>();
    s.dates.forEach((d, i) => m.set(d, s.statuses[i]));
    lookup.set(Number(sid), m);
  }

  return (
    <div>
      {/* Range selector */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        {[7, 30, 90].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            style={{
              fontSize: 11,
              padding: '4px 10px',
              borderRadius: 14,
              border: days === d ? '1.5px solid var(--accent)' : '1px solid var(--border)',
              background: days === d ? 'rgba(124,58,237,0.08)' : 'var(--card)',
              color: days === d ? 'var(--accent)' : 'var(--muted)',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Last {d}d
          </button>
        ))}
      </div>

      {!hasAnyAttendance ? (
        <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
          No attendance marked in the last {days} days for this batch. Mark some from the schedule page first.
        </p>
      ) : (
        <>
          {/* Grid */}
          <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
            <table style={{ borderCollapse: 'collapse', minWidth: '100%', fontSize: 11 }}>
              <thead>
                <tr style={{ background: 'var(--surface)' }}>
                  <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 700, fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', position: 'sticky', left: 0, background: 'var(--surface)', zIndex: 1 }}>
                    Student
                  </th>
                  {allDates.map((d) => (
                    <th key={d} style={{ padding: '8px 4px', fontWeight: 700, fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', minWidth: 36, textAlign: 'center' }}>
                      {fmtShort(d)}
                    </th>
                  ))}
                  <th style={{ padding: '8px 10px', fontWeight: 700, fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', textAlign: 'right' }}>
                    Rate
                  </th>
                </tr>
              </thead>
              <tbody>
                {students.map((s, i) => {
                  const m = lookup.get(s.id);
                  const stats = byStudent[s.id];
                  const rate = stats?.rate ?? null;
                  const rateColor = rate === null
                    ? 'var(--muted)'
                    : rate >= 80
                    ? '#10B981'
                    : rate >= 60
                    ? '#F59E0B'
                    : '#EF4444';
                  return (
                    <tr key={s.id} style={{ background: i % 2 === 0 ? 'var(--card)' : 'var(--surface)' }}>
                      <td style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', position: 'sticky', left: 0, background: i % 2 === 0 ? 'var(--card)' : 'var(--surface)', zIndex: 1 }}>
                        {s.name}
                      </td>
                      {allDates.map((d) => {
                        const status = m?.get(d);
                        const color = status ? STATUS_COLOR[status] : null;
                        return (
                          <td key={d} style={{ padding: 3, textAlign: 'center' }} title={`${fmtShort(d)} — ${status || 'not marked'}`}>
                            {color ? (
                              <span
                                style={{
                                  display: 'inline-block',
                                  width: 18,
                                  height: 18,
                                  borderRadius: 4,
                                  background: color + '22',
                                  border: `1.5px solid ${color}`,
                                }}
                              />
                            ) : (
                              <span style={{ display: 'inline-block', width: 18, height: 18, borderRadius: 4, background: 'var(--border)' }} />
                            )}
                          </td>
                        );
                      })}
                      <td style={{ padding: '8px 10px', fontWeight: 800, color: rateColor, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {rate === null ? '—' : `${rate}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: 12, marginTop: 10, fontSize: 11, flexWrap: 'wrap' }}>
            {(['present', 'late', 'excused', 'absent'] as AttendanceStatus[]).map((s) => (
              <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--muted)' }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: STATUS_COLOR[s] + '22', border: `1.5px solid ${STATUS_COLOR[s]}`, display: 'inline-block' }} />
                {s}
              </span>
            ))}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--muted)' }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--border)', display: 'inline-block' }} />
              not marked
            </span>
          </div>
        </>
      )}
    </div>
  );
}
