'use client';

// Attendance modal — opened from a Schedule event detail (or a recurring class
// instance). Lists every student in the linked batch(es) with a 4-way status
// toggle. Bulk "Mark all present" at the top. Saves on confirm.
//
// Mobile UX: each student row supports swipe gestures —
//   swipe RIGHT → Present (green)
//   swipe LEFT  → Absent (red)
//   tap toggles still work for Late/Excused or undo.

import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { attendance, type AttendanceStatus } from '@/lib/api';

type Student = { id: number; name: string; avatar?: string | null };

type Props = {
  open: boolean;
  onClose: () => void;
  schoolId: string;
  // Pass exactly ONE of these:
  eventId?: number;
  scheduleId?: number;
  // The specific class date (YYYY-MM-DD)
  classDate: string;
  eventTitle?: string;
  // When true, renders inline (no overlay, no body-scroll lock, no max-height).
  // Used when the consumer wants the attendance UI to appear inside a parent
  // section rather than as a top-level dialog.
  inline?: boolean;
};

const STATUS_CONFIG: { value: AttendanceStatus; label: string; color: string; icon: string }[] = [
  { value: 'present', label: 'Present', color: '#10B981', icon: '✓' },
  { value: 'late',    label: 'Late',    color: '#F59E0B', icon: '⏱' },
  { value: 'excused', label: 'Excused', color: '#6366F1', icon: '∼' },
  { value: 'absent',  label: 'Absent',  color: '#EF4444', icon: '✗' },
];

// Swipe threshold past which the gesture commits to a status
const SWIPE_THRESHOLD_PX = 70;
const SWIPE_MAX_REVEAL_PX = 120;

// ── Swipeable student row ───────────────────────────────────────────────────
// Tap any of the 4 status icons OR swipe right (Present) / left (Absent).
// On touch devices the row slides under-finger and reveals colored hint.
function SwipeRow({
  student,
  current,
  onSet,
}: {
  student: { id: number; name: string };
  current?: AttendanceStatus;
  onSet: (status: AttendanceStatus) => void;
}) {
  const [dx, setDx] = useState(0);
  const startRef = useRef<{ x: number; y: number; locked: 'h' | 'v' | null } | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    startRef.current = { x: t.clientX, y: t.clientY, locked: null };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const start = startRef.current;
    if (!start) return;
    const t = e.touches[0];
    const ddx = t.clientX - start.x;
    const ddy = t.clientY - start.y;
    // Lock to dominant axis to avoid stealing vertical scroll
    if (!start.locked) {
      if (Math.abs(ddx) > 6 && Math.abs(ddx) > Math.abs(ddy)) start.locked = 'h';
      else if (Math.abs(ddy) > 6) start.locked = 'v';
    }
    if (start.locked === 'h') {
      // Clamp to a max so the row doesn't fly off
      const clamped = Math.max(-SWIPE_MAX_REVEAL_PX, Math.min(SWIPE_MAX_REVEAL_PX, ddx));
      setDx(clamped);
    }
  };
  const onTouchEnd = () => {
    const final = dx;
    if (final >= SWIPE_THRESHOLD_PX) onSet('present');
    else if (final <= -SWIPE_THRESHOLD_PX) onSet('absent');
    setDx(0);
    startRef.current = null;
  };

  const revealRight = Math.max(0, dx);
  const revealLeft = Math.max(0, -dx);
  const willCommit = Math.abs(dx) >= SWIPE_THRESHOLD_PX;

  return (
    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 10 }}>
      {/* Hint backgrounds revealed during swipe */}
      {revealRight > 0 && (
        <div
          aria-hidden
          style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-start',
            paddingLeft: 18, background: '#10B981', color: '#fff', fontWeight: 800, fontSize: 14,
            opacity: Math.min(1, revealRight / SWIPE_THRESHOLD_PX), pointerEvents: 'none',
          }}
        >
          ✓ {willCommit ? 'Present' : 'Swipe →'}
        </div>
      )}
      {revealLeft > 0 && (
        <div
          aria-hidden
          style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
            paddingRight: 18, background: '#EF4444', color: '#fff', fontWeight: 800, fontSize: 14,
            opacity: Math.min(1, revealLeft / SWIPE_THRESHOLD_PX), pointerEvents: 'none',
          }}
        >
          {willCommit ? 'Absent' : '← Swipe'} ✗
        </div>
      )}

      {/* The actual row — translates under finger */}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 12px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          flexWrap: 'wrap',
          transform: `translateX(${dx}px)`,
          transition: dx === 0 ? 'transform 0.2s ease-out' : 'none',
          touchAction: 'pan-y',
        }}
      >
        <div style={{ flex: '1 1 140px', minWidth: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'var(--muted)', border: '1px solid var(--border)', flexShrink: 0 }}>
            {student.name?.[0]?.toUpperCase() || '?'}
          </div>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {student.name}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          {STATUS_CONFIG.map((opt) => {
            const active = current === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => onSet(opt.value)}
                title={opt.label}
                style={{
                  width: 36, height: 32,
                  padding: 0,
                  borderRadius: 8,
                  border: active ? `1.5px solid ${opt.color}` : '1px solid var(--border)',
                  background: active ? opt.color + '20' : 'var(--card)',
                  color: active ? opt.color : 'var(--muted)',
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: 'pointer',
                  transition: 'background .1s, color .1s',
                }}
              >
                {opt.icon}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function AttendanceModal({ open, onClose, schoolId, eventId, scheduleId, classDate, eventTitle, inline = false }: Props) {
  const [students, setStudents] = useState<Student[]>([]);
  const [marks, setMarks] = useState<Record<number, AttendanceStatus>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Lock body scroll while open + ESC to close — only in modal mode.
  useEffect(() => {
    if (!open || inline) return;
    const orig = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = orig;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, inline]);

  // Load roster + existing marks when modal opens
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const fetcher = eventId
      ? attendance.getForEvent(schoolId, eventId, classDate)
      : scheduleId
      ? attendance.getForSchedule(schoolId, scheduleId, classDate)
      : null;
    if (!fetcher) { setLoading(false); return; }
    fetcher
      .then((data: any) => {
        setStudents(data.students || []);
        const existing: Record<number, AttendanceStatus> = {};
        for (const [sid, rec] of Object.entries(data.attendance || {})) {
          existing[Number(sid)] = (rec as any).status;
        }
        setMarks(existing);
      })
      .catch(() => {
        toast.error('Could not load class roster');
        setStudents([]);
      })
      .finally(() => setLoading(false));
  }, [open, eventId, scheduleId, schoolId, classDate]);

  const setStatus = (studentId: number, status: AttendanceStatus) => {
    setMarks((prev) => ({ ...prev, [studentId]: status }));
  };

  const markAll = (status: AttendanceStatus) => {
    const next: Record<number, AttendanceStatus> = {};
    for (const s of students) next[s.id] = status;
    setMarks(next);
  };

  const markedCount = Object.keys(marks).length;
  const presentCount = Object.values(marks).filter((s) => s === 'present' || s === 'late').length;

  const handleSave = async () => {
    if (markedCount === 0) {
      toast.error('Mark at least one student first');
      return;
    }
    setSaving(true);
    try {
      const entries = Object.entries(marks).map(([sid, status]) => ({
        student_id: Number(sid),
        status: status as AttendanceStatus,
      }));
      const body = { class_date: classDate, entries };
      if (eventId) {
        await attendance.saveForEvent(schoolId, eventId, body);
      } else if (scheduleId) {
        await attendance.saveForSchedule(schoolId, scheduleId, body);
      }
      toast.success(`Attendance saved — ${presentCount} of ${students.length} present`);
      onClose();
    } catch (e: any) {
      toast.error(e?.error || e?.message || 'Failed to save attendance');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const niceDate = (() => {
    try {
      const [y, m, d] = classDate.split('-').map(Number);
      return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    } catch { return classDate; }
  })();

  // Card body — shared between modal and inline renderings
  const cardBody = (
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--card)',
          borderRadius: inline ? 12 : 16,
          width: '100%',
          maxWidth: inline ? undefined : 580,
          boxShadow: inline ? 'none' : '0 20px 60px rgba(0,0,0,0.4)',
          border: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column',
          maxHeight: inline ? undefined : 'calc(100vh - 80px)',
        }}
      >
        {/* Header */}
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: 'var(--text)' }}>Attendance</h2>
              <p style={{ fontSize: 12, margin: '3px 0 0', color: 'var(--muted)' }}>
                {eventTitle ? `${eventTitle} · ` : ''}{niceDate}
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4, display: 'flex', alignItems: 'center' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Bulk mark + summary */}
          {!loading && students.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
              <button
                onClick={() => markAll('present')}
                style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #10B981', background: 'rgba(16,185,129,0.08)', color: '#10B981', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
              >
                ✓ Mark all present
              </button>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                {markedCount} of {students.length} marked
              </span>
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{ padding: '14px 20px', overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, padding: 30 }}>Loading roster…</p>
          ) : students.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, padding: 30 }}>
              No students in the linked batch. Add students to the batch first.
            </p>
          ) : (
            <>
              {/* Touch hint — only show on devices that have touch */}
              <p style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', margin: '0 0 10px', display: 'block' }}>
                Tip: swipe right for Present, left for Absent
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {students.map((s) => (
                  <SwipeRow
                    key={s.id}
                    student={s}
                    current={marks[s.id]}
                    onSet={(status) => setStatus(s.id, status)}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--muted)' }}>
            {STATUS_CONFIG.map((opt) => {
              const n = Object.values(marks).filter((s) => s === opt.value).length;
              if (n === 0) return null;
              return (
                <span key={opt.value} style={{ color: opt.color, fontWeight: 700 }}>
                  {opt.icon} {n}
                </span>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onClose}
              disabled={saving}
              style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 14px', fontWeight: 600, fontSize: 13, color: 'var(--muted)', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || markedCount === 0 || students.length === 0}
              style={{
                padding: '8px 18px',
                borderRadius: 8,
                border: 'none',
                background: saving || markedCount === 0 ? '#9CA3AF' : 'var(--accent)',
                color: '#fff',
                fontWeight: 700,
                fontSize: 13,
                cursor: saving || markedCount === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? 'Saving…' : `Save ${markedCount > 0 ? markedCount : ''}`.trim()}
            </button>
          </div>
        </div>
      </div>
  );

  if (inline) return cardBody;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(4px)', zIndex: 600,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '40px 16px', overflowY: 'auto',
      }}
    >
      {cardBody}
    </div>
  );
}
