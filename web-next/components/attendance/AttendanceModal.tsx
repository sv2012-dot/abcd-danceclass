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
import StudentAvatar from '@/components/shared/StudentAvatar';

type Student = { id: number; name: string; avatar?: string | null; photo_url?: string | null };

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
  // Bump this number (from the parent) to force a roster + marks refetch.
  // Used after a parent-driven Mark-All-Present write so the inline list
  // immediately reflects the new server state.
  refreshSignal?: number;
};

// 3 statuses now (Excused removed per spec — not user-markable any longer).
// Icons rendered as inline SVG (line-art) for visual consistency with the
// rest of the app's iconography.
type StatusOpt = { value: AttendanceStatus; label: string; color: string; svg: React.ReactNode };
const SVG_CHECK = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const SVG_CLOCK = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="12" r="9" />
    <polyline points="12 7 12 12 15 14" />
  </svg>
);
const SVG_X = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
const STATUS_CONFIG: StatusOpt[] = [
  { value: 'present', label: 'Present', color: '#10B981', svg: SVG_CHECK },
  { value: 'late',    label: 'Late',    color: '#F59E0B', svg: SVG_CLOCK },
  { value: 'absent',  label: 'Absent',  color: '#EF4444', svg: SVG_X },
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
  student: Student;
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

      {/* The actual row — translates under finger.
          flexWrap:nowrap forces one row per student on mobile; name
          gets ellipsis-truncated so the 3 status buttons never wrap. */}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 10px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          flexWrap: 'nowrap',
          transform: `translateX(${dx}px)`,
          transition: dx === 0 ? 'transform 0.2s ease-out' : 'none',
          touchAction: 'pan-y',
        }}
      >
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Real StudentAvatar (photo if set, gradient initial fallback)
              for visual consistency with /students and the batch panel. */}
          <StudentAvatar student={student} size={36} />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {student.name}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {STATUS_CONFIG.map((opt) => {
            const active = current === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => onSet(opt.value)}
                title={opt.label}
                aria-label={opt.label}
                style={{
                  width: 40, height: 40,
                  padding: 0,
                  borderRadius: 9,
                  border: active ? `1.5px solid ${opt.color}` : '1px solid var(--border)',
                  background: active ? opt.color + '22' : 'var(--card)',
                  color: active ? opt.color : 'var(--muted)',
                  cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background .1s, color .1s',
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                {opt.svg}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function AttendanceModal({ open, onClose, schoolId, eventId, scheduleId, classDate, eventTitle, inline = false, refreshSignal }: Props) {
  const [students, setStudents] = useState<Student[]>([]);
  const [marks, setMarks] = useState<Record<number, AttendanceStatus>>({});
  // savedMarks = the last known server-persisted state. Cancel/Save
  // buttons only appear when `marks` differs from this; Save flushes
  // to the server then resyncs savedMarks. Mark-All-Present from the
  // parent updates the server externally → a refreshSignal bump
  // re-fetches and resets both.
  const [savedMarks, setSavedMarks] = useState<Record<number, AttendanceStatus>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  // Inline-mode collapse: "Take Attendance" header is a toggle. Default
  // open so the user sees the roster immediately on event detail; can
  // collapse to reclaim vertical space.
  const [inlineOpen, setInlineOpen] = useState(true);

  // Deep compare via JSON.stringify is fine for these small maps.
  const isDirty = JSON.stringify(marks) !== JSON.stringify(savedMarks);

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
        setSavedMarks(existing); // sync the "clean" baseline on load.
      })
      .catch(() => {
        toast.error('Could not load class roster');
        setStudents([]);
      })
      .finally(() => setLoading(false));
    // refreshSignal in deps so parent Mark-All-Present writes trigger
    // a refetch and reset isDirty.
  }, [open, eventId, scheduleId, schoolId, classDate, refreshSignal]);

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
      // Sync the "clean" baseline so Cancel/Save hide until the user
      // makes a new edit. The block stays open per spec.
      setSavedMarks({ ...marks });
      toast.success(`Attendance saved — ${presentCount} of ${students.length} present`);
      if (!inline) onClose();
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

  // Inline body — collapsible "Take Attendance" with chevron, tip line,
  // student list, and Cancel/Save that only appear when the user has
  // edited the saved state.
  //
  // Layout: NO outer card border/padding so the student rows are flush
  // with the sibling Smart Message / Mark All Present buttons above
  // (which span the parent event-detail action column). The student
  // rows render in a single line each (no flex-wrap) — long names
  // truncate with ellipsis.
  if (inline) {
    return (
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'transparent',
          width: '100%',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Collapsible header — flush left, no border */}
        <button
          type="button"
          onClick={() => setInlineOpen((o) => !o)}
          aria-expanded={inlineOpen}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            width: '100%',
            padding: '12px 0',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <svg
            width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ color: 'var(--muted)', transform: inlineOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform .15s' }}
            aria-hidden
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
          <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: 'var(--text)' }}>
            Take Attendance
          </h2>
        </button>

        {inlineOpen && (
          <>
            {/* Body — no inner horizontal padding so rows align with the
                Smart Message / Mark All Present buttons above. */}
            <div style={{ padding: '0 0 10px' }}>
              {loading ? (
                <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, padding: 20 }}>Loading roster…</p>
              ) : students.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, padding: 20 }}>
                  No students in the linked batch. Add students to the batch first.
                </p>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>Tip: Swipe to mark</span>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>{markedCount} of {students.length} marked</span>
                  </div>
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

            {/* Cancel + Save — only shown while the user has unsaved
                edits relative to the last persisted state. Mark All
                Present from the parent persists externally so this row
                stays hidden after that. */}
            {!loading && students.length > 0 && isDirty && (
              <div style={{ padding: '0 0 6px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => { setMarks({ ...savedMarks }); }}
                  disabled={saving}
                  style={{
                    padding: '12px',
                    minHeight: 45,
                    borderRadius: 10,
                    border: '1px solid var(--border)',
                    background: 'var(--card)',
                    color: 'var(--text)',
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: saving ? 'not-allowed' : 'pointer',
                    opacity: saving ? 0.6 : 1,
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    padding: '12px',
                    minHeight: 45,
                    borderRadius: 10,
                    border: 'none',
                    background: saving ? '#5b6b88' : 'var(--accent)',
                    color: '#fff',
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: saving ? 'not-allowed' : 'pointer',
                  }}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // Modal (non-inline) body — kept similar to the original layout.
  const cardBody = (
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--card)',
          borderRadius: 16,
          width: '100%',
          maxWidth: 580,
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
          border: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column',
          maxHeight: 'calc(100vh - 80px)',
        }}
      >
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
          {!loading && students.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
              <button
                onClick={() => markAll('present')}
                style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #10B981', background: 'rgba(16,185,129,0.08)', color: '#10B981', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
              >
                Mark all present
              </button>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{markedCount} of {students.length} marked</span>
            </div>
          )}
        </div>
        <div style={{ padding: '14px 20px', overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, padding: 30 }}>Loading roster…</p>
          ) : students.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, padding: 30 }}>
              No students in the linked batch.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {students.map((s) => (
                <SwipeRow key={s.id} student={s} current={marks[s.id]} onSet={(status) => setStatus(s.id, status)} />
              ))}
            </div>
          )}
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, flexShrink: 0 }}>
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
              padding: '8px 18px', borderRadius: 8, border: 'none',
              background: saving || markedCount === 0 ? '#9CA3AF' : 'var(--accent)',
              color: '#fff', fontWeight: 700, fontSize: 13,
              cursor: saving || markedCount === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
  );

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
