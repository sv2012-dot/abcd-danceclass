'use client';

// Compact attendance grid for a batch: students × class dates.
// Each cell colored by status. Click a student name to see their detail.
//
// Header is a month navigator (← MAY 2026 →) instead of the prior
// "Last 7d / 30d / 90d" range buttons. Constraining the data window to
// a single calendar month keeps the table's column count manageable on
// mobile (typical 4-12 class dates per month for a batch). Users browse
// historical months with the arrow buttons.

import React, { useEffect, useState } from 'react';
import { attendance, type AttendanceStatus } from '@/lib/api';

type Props = {
  schoolId: string;
  batchId: number;
};

type StudentRow = { id: number; name: string };
type StudentStats = {
  // excused kept for backend-compat type; not displayed in the UI.
  present: number; late: number; absent: number; excused?: number;
  total: number; rate: number | null;
  dates: string[];
  statuses: AttendanceStatus[];
};

const STATUS_COLOR: Record<AttendanceStatus, string> = {
  present: '#10B981',
  late: '#F59E0B',
  absent: '#EF4444',
};

const MONTHS_UPPER = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

function fmtShort(d: string) {
  try {
    const dt = new Date(String(d).slice(0, 10) + 'T12:00:00');
    return dt.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
  } catch { return d; }
}

// First and last day of a month, returned as "YYYY-MM-DD" strings.
function monthBounds(d: Date) {
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const last  = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const fmt = (x: Date) =>
    `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  return { from: fmt(first), to: fmt(last) };
}

export default function BatchAttendanceGrid({ schoolId, batchId }: Props) {
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [byStudent, setByStudent] = useState<Record<number, StudentStats>>({});
  const [allDates, setAllDates] = useState<string[]>([]);
  // Cursor for the currently displayed month — defaults to current month.
  const [cursor, setCursor] = useState<Date>(() => {
    const d = new Date(); d.setDate(1); return d;
  });

  useEffect(() => {
    if (!schoolId || !batchId) return;
    setLoading(true);
    const { from, to } = monthBounds(cursor);
    attendance
      .batchStats(schoolId, batchId, { from, to })
      .then((data: any) => {
        setStudents(data.students || []);
        setByStudent(data.byStudent || {});
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
  }, [schoolId, batchId, cursor]);

  const navMonth = (dir: number) => {
    const d = new Date(cursor);
    d.setMonth(d.getMonth() + dir);
    setCursor(d);
  };

  // Section header — month navigator. Same uppercase + gradient-year
  // typography as the schedule page month header / home page SectionTitle.
  const header = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 12 }}>
      <button
        onClick={() => navMonth(-1)}
        aria-label="Previous month"
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 10px', color: 'var(--accent)', fontSize: 22, lineHeight: 1, fontWeight: 300 }}
      >‹</button>
      <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em', textTransform: 'uppercase' }}>
        {MONTHS_UPPER[cursor.getMonth()]}{' '}
        <span style={{
          background: 'linear-gradient(135deg, #7C3AED 0%, #D946EF 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>{cursor.getFullYear()}</span>
      </span>
      <button
        onClick={() => navMonth(1)}
        aria-label="Next month"
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 10px', color: 'var(--accent)', fontSize: 22, lineHeight: 1, fontWeight: 300 }}
      >›</button>
    </div>
  );

  if (loading) {
    return (
      <div>
        {header}
        <p style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: '14px 0' }}>Loading attendance…</p>
      </div>
    );
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

  const monthLabel = `${MONTHS_UPPER[cursor.getMonth()]} ${cursor.getFullYear()}`;

  return (
    <div>
      {header}

      {!hasAnyAttendance ? (
        <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, textAlign: 'center', padding: '12px 0' }}>
          No attendance marked in {monthLabel} for this batch. Mark some from the schedule page first.
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
                                  width: 14,
                                  height: 14,
                                  borderRadius: '50%',
                                  background: color,
                                }}
                              />
                            ) : (
                              <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%', background: 'var(--border)' }} />
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

          {/* Legend — filled circles, matches the cell dots above */}
          <div style={{ display: 'flex', gap: 12, marginTop: 10, fontSize: 11, flexWrap: 'wrap' }}>
            {(['present', 'late', 'absent'] as AttendanceStatus[]).map((s) => (
              <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--muted)' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: STATUS_COLOR[s], display: 'inline-block' }} />
                {s}
              </span>
            ))}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--muted)' }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--border)', display: 'inline-block' }} />
              not marked
            </span>
          </div>
        </>
      )}
    </div>
  );
}
