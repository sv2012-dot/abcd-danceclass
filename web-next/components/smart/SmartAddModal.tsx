'use client';

import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import SmartModal from './SmartModal';
import SmartButton from './SmartButton';
import SmartUsageFooter from './SmartUsageFooter';
import { smart, type SmartParsedEvent } from '@/lib/api/smart';
import { events as eventsApi, batches as batchesApi, recitals as recitalsApi, studios as studiosApi } from '@/lib/api';
import { DateField } from '@/components/shared/date/Picker';

// Centralised friendly mapping for AI errors
function friendlyError(e: any): string {
  if (e?.message?.includes('429') || e?.error === 'rate_limit_exceeded' || e?.status === 429) {
    return "You've hit today's Smart ManchQ limit (30/day). Resets in ~24h.";
  }
  return e?.error || e?.detail || e?.message || 'Smart ManchQ ran into a hiccup. Try again.';
}

// Compact viewport detector for the modal — mobile = stacked cards, desktop = grid
function useNarrow(breakpoint = 600) {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const fn = () => setNarrow(window.innerWidth < breakpoint);
    fn();
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, [breakpoint]);
  return narrow;
}

// Translate technical backend warnings into friendlier copy users will tolerate.
// Returns null if the warning is purely informational and the UI already
// surfaces the relevant info elsewhere (e.g. the row-level "+ Create X" hint
// already covers "no batch matched").
function humaniseWarning(raw: string): string | null {
  // Hide warnings whose info is already shown inline on each row
  if (/no batch matched/i.test(raw)) return null;
  if (/batch_id set to null/i.test(raw)) return null;
  if (/year auto.?assumed/i.test(raw)) return null; // shown in dedicated chip below

  // Translate the common ones into plain language
  if (/recurring pattern.*detected.*only first/i.test(raw)) {
    return 'A recurring pattern was hinted at but only the first date was added — tap a row to duplicate it manually, or rephrase like "every Mon for 4 weeks" and try again.';
  }
  if (/medium confidence|confidence/i.test(raw) && /batch/i.test(raw)) {
    return 'A batch name was best-guessed — pick the right one in the row dropdown if it\'s wrong.';
  }

  // Default: keep but strip jargon prefixes
  return raw.replace(/^['"]?[A-Z][a-zA-Z_]+['"]?\s*:?\s*/, '');
}

type Props = {
  open: boolean;
  onClose: () => void;
  schoolId: string;
  onCreated?: () => void;        // refetch hook
};

// Static fallback used when the studio has no batches / recitals yet.
// Once real data loads, buildDynamicExamples() returns school-specific
// example prompts that the AI is more likely to parse correctly because
// the names already exist AND the prompts contain concrete date anchors.
const STATIC_EXAMPLES = [
  'Hip Hop Mon Wed Fri 5pm starting next Monday for 6 weeks',
  'Bharatanatyam Beg Tuesdays 6pm for the next 6 weeks',
  'Weekly Saturday class at 5pm starting June 7 for 10 weeks',
];

// ── helpers used to build parser-friendly prompts ─────────────────────────
// The Smart Add parser needs concrete dates. Abstract phrases like
// "ad-hoc" or "leading up to" don't extract — we have to bake the dates
// directly into the prompt text using real recital/batch info.

function fmtMonthDay(dateStr: string): string {
  // Accepts "YYYY-MM-DD" (or ISO with T). Returns "May 21" style.
  const d = (dateStr || '').slice(0, 10);
  const [y, m, day] = d.split('-').map(Number);
  if (!y || !m || !day) return dateStr;
  return new Date(y, m - 1, day).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

function nextSaturdayMonthDay(): string {
  const d = new Date();
  const daysUntilSat = (6 - d.getDay() + 7) % 7 || 7; // never today
  d.setDate(d.getDate() + daysUntilSat);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

function buildDynamicExamples(
  recitalName: string | null,
  recitalDate: string | null,
  batchName: string | null
): string[] {
  const examples: string[] = [];

  // 1. Recital prep — anchored to the recital's real event_date so the
  //    parser can compute "dress rehearsal the day before" etc.
  if (recitalName && recitalDate) {
    const dateLabel = fmtMonthDay(recitalDate);
    examples.push(
      `${recitalName} is on ${dateLabel}. Schedule a tech rehearsal one week before at 5pm, a dress rehearsal the day before at 5pm, and a final practice three days before at 5pm.`
    );
  } else if (recitalName) {
    // No date on the recital → fall through to a generic version that
    // still names the recital but uses relative dates the parser handles.
    examples.push(
      `${recitalName}: add a tech rehearsal next Friday at 5pm and a dress rehearsal next Saturday at 5pm.`
    );
  }

  // 2. Batch ad-hoc make-ups — concrete day + time + duration.
  if (batchName) {
    examples.push(
      `For ${batchName}, add make-up classes on Saturdays at 4pm for the next 4 weeks.`
    );
  }

  // 3. Seasonal series — anchored to the next real Saturday.
  examples.push(
    `Weekly Saturday class at 5pm starting ${nextSaturdayMonthDay()} for 10 weeks.`
  );

  return examples.length >= 3 ? examples.slice(0, 3) : [...examples, ...STATIC_EXAMPLES].slice(0, 3);
}

type Row = SmartParsedEvent & {
  _selected: boolean;
  _editTime: string;       // "HH:MM" 24h, user-editable
  _editDate: string;       // user-editable
  _editDuration: number;   // minutes, user-editable
  _venue: string;          // per-event venue when "Customize per event" is on
};

// ── Time helpers — 24h ↔ 12h for the 4-dropdown time picker ───────────────
function to12h(hhmm: string): { hour: number; minute: number; ampm: 'AM' | 'PM' } {
  const [h, m] = (hhmm || '18:00').split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  // Snap minutes to the nearest 15-min step the dropdown offers.
  const minRounded = Math.floor((m || 0) / 15) * 15;
  return { hour: hr12, minute: minRounded, ampm };
}
function to24h(hour12: number, minute: number, ampm: 'AM' | 'PM'): string {
  let h24 = hour12;
  if (ampm === 'PM' && hour12 < 12) h24 += 12;
  if (ampm === 'AM' && hour12 === 12) h24 = 0;
  return `${String(h24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

const HOURS_12   = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const MINUTES_15 = [0, 15, 30, 45];
const DURATIONS  = [
  { v: 30,  label: '30 min' },
  { v: 45,  label: '45 min' },
  { v: 60,  label: '1 hr'   },
  { v: 75,  label: '1 hr 15' },
  { v: 90,  label: '1 hr 30' },
  { v: 120, label: '2 hr'   },
  { v: 180, label: '3 hr'   },
];

// Helpers used by the V3 collapsed summary line.
function fmtTimeLabel(hhmm: string): string {
  const t = to12h(hhmm);
  return `${t.hour}:${String(t.minute).padStart(2, '0')} ${t.ampm}`;
}
function fmtDurLabel(mins: number): string {
  const f = DURATIONS.find((d) => d.v === mins);
  return f ? f.label : `${mins} min`;
}

// Small pencil — same affordance the inline-edit cells use elsewhere.
const PencilIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z" />
  </svg>
);

// ── helpers ────────────────────────────────────────────────────────────────
function toLocalDate(yyyymmdd: string) {
  const [y, m, d] = yyyymmdd.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
function fmtNice(yyyymmdd: string) {
  const d = toLocalDate(yyyymmdd);
  if (isNaN(d.getTime())) return yyyymmdd;
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
function isoFromDateTime(yyyymmdd: string, hhmm: string | null) {
  // Build a local-time ISO without TZ shifting — backend treats as local
  const d = toLocalDate(yyyymmdd);
  const time = hhmm || '17:00';        // default 5 PM if no time picked
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${time}:00`;
}
function addMinutes(yyyymmdd: string, hhmm: string, mins: number) {
  const [h, m] = hhmm.split(':').map(Number);
  const d = toLocalDate(yyyymmdd);
  d.setHours(h, m + mins, 0, 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:00`;
}

export default function SmartAddModal({ open, onClose, schoolId, onCreated }: Props) {
  const [text, setText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [yearAssumed, setYearAssumed] = useState<number | null>(null);
  // Default start time for events the prompt didn't specify a time for.
  // Hardcoded to 6 PM — no UI disclosure, the user will see it on each row
  // once events are created and can edit there if it's wrong.
  const DEFAULT_TIME = '18:00';
  const [batchesCache, setBatchesCache] = useState<{ id: number; name: string }[]>([]);
  // Studios (a.k.a. venues/rooms) — power the chip strip in the universal
  // venue picker. Fetched once on open.
  const [studioRooms, setStudioRooms] = useState<any[]>([]);
  // Universal values applied to ALL rows when "Customize per event" is OFF.
  //   '' (empty) for batch/type → "Match per event" sentinel; each row
  //   uses whatever the AI parsed for it. Otherwise the universal value
  //   forces every event to the same batch / type.
  //   'none' on batch → explicit "No batch" for all.
  const [universalBatchId, setUniversalBatchId] = useState<string>('');
  const [universalType, setUniversalType] = useState<string>('');
  const [universalVenue, setUniversalVenue] = useState('');
  // When true, hide universal venue + show per-row Batch / Type / Venue
  // editors inside each block. Tertiary opt-in.
  const [customizePerEvent, setCustomizePerEvent] = useState(false);
  // V3 row pattern — index of the currently-expanded row (or null).
  // Default: all rows collapsed (single readable summary line).
  // Clicking a row expands it; clicking outside the rows container
  // collapses back. Only one row open at a time.
  const [expandedRowIdx, setExpandedRowIdx] = useState<number | null>(null);
  const rowsContainerRef = useRef<HTMLDivElement | null>(null);
  // Collapsible "TRY THESE PROMPTS" section — open by default for
  // first-time users; user can collapse to reclaim vertical space.
  const [promptsOpen, setPromptsOpen] = useState(true);
  // Sample names used to build example prompts — pulled once when the
  // modal opens so the suggested chips reference REAL data the studio
  // already has. Falls back to STATIC_EXAMPLES when empty.
  const [sampleRecitalName, setSampleRecitalName] = useState<string | null>(null);
  const [sampleRecitalDate, setSampleRecitalDate] = useState<string | null>(null);
  const [sampleBatchName,   setSampleBatchName]   = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const narrow = useNarrow();

  // Autofocus the textarea when modal opens
  useEffect(() => {
    if (open && rows.length === 0) {
      const t = setTimeout(() => textareaRef.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [open, rows.length]);

  // Collapse expanded V3 row on click outside the rows container.
  // DateField / TimeField popovers live INSIDE the row DOM, so their
  // clicks are still considered inside and won't trigger collapse.
  useEffect(() => {
    if (expandedRowIdx === null) return;
    const handler = (e: MouseEvent) => {
      const c = rowsContainerRef.current;
      if (c && !c.contains(e.target as Node)) setExpandedRowIdx(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [expandedRowIdx]);

  // When the rows list changes (e.g. user re-parses), collapse any
  // open editor so the new list lands clean.
  useEffect(() => { setExpandedRowIdx(null); }, [rows.length]);

  // Preload one recital + one batch name on open. These power dynamic
  // example prompts. Pick the soonest upcoming recital (or most recent
  // if none upcoming) and the first available batch.
  useEffect(() => {
    if (!open || !schoolId) return;
    let cancelled = false;
    Promise.all([
      recitalsApi.list(schoolId).catch(() => []) as Promise<any[]>,
      batchesApi.list(schoolId).catch(() => []) as Promise<any[]>,
      studiosApi.list(schoolId).catch(() => ({ studios: [] })) as Promise<any>,
    ]).then(([recs, bats, studiosRes]) => {
      if (cancelled) return;
      const todayStr = new Date().toISOString().slice(0, 10);
      const upcoming = (recs || [])
        .filter((r: any) => (r.event_date || '').slice(0, 10) >= todayStr)
        .sort((a: any, b: any) => (a.event_date || '').localeCompare(b.event_date || ''));
      const pickRecital = upcoming[0] || (recs || []).slice(-1)[0] || null;
      setSampleRecitalName(pickRecital?.title || null);
      setSampleRecitalDate(pickRecital?.event_date || null);
      setSampleBatchName((bats || [])[0]?.name || null);
      if (bats && bats.length) {
        setBatchesCache((bats as any[]).map((b: any) => ({ id: b.id, name: b.name })));
      }
      // studios endpoint returns { studios: [...] } or a plain array
      const rooms = Array.isArray(studiosRes) ? studiosRes : (studiosRes?.studios || []);
      setStudioRooms(rooms);
      // Pre-fill universal venue with the favorite studio if there is one
      const fav = rooms.find((s: any) => s.is_favorite);
      if (fav) setUniversalVenue((prev) => prev || fav.name);
    });
    return () => { cancelled = true; };
  }, [open, schoolId]);

  const examples = buildDynamicExamples(sampleRecitalName, sampleRecitalDate, sampleBatchName);

  const reset = () => {
    setText('');
    setRows([]);
    setWarnings([]);
    setYearAssumed(null);
    setError(null);
    setCustomizePerEvent(false);
    setUniversalBatchId('');
    setUniversalType('');
  };

  const handleClose = () => {
    if (creating || parsing) return;
    reset();
    onClose();
  };

  const doParse = async () => {
    if (!text.trim()) {
      setError('Type some event details first');
      return;
    }
    setParsing(true);
    setError(null);
    try {
      // Fetch batches in parallel for the dropdown
      const [parsed, batchList] = await Promise.all([
        smart.parseEvents(text.trim()),
        batchesApi.list(schoolId).catch(() => []),
      ]);
      setBatchesCache((batchList as any[]).map((b) => ({ id: b.id, name: b.name })));
      if (!parsed.events || parsed.events.length === 0) {
        setError("Couldn't detect any events. Try being more specific — e.g. include a date and a class name.");
        return;
      }
      const builtRows = parsed.events.map((e) => ({
        ...e,
        _selected: !(e.warning === 'duplicate'),  // dedupe by default
        _editTime: e.time || DEFAULT_TIME,
        _editDate: e.date,
        _editDuration: e.duration_min || 60,
        _venue: '',
      }));
      setRows(builtRows);
      // Smart pre-fill the universal Batch + Type selectors. If every
      // parsed event landed on the same batch_id (incl. all-null) we
      // pre-select that specific value so the user can see + confirm
      // it; if the rows differ we leave the selector on the "Match per
      // event" sentinel so each row keeps its own AI-parsed value.
      const allBatch = builtRows.map((r) => r.batch_id);
      const allTypes = builtRows.map((r) => r.type);
      const sameBatch = allBatch.length > 0 && allBatch.every((b) => b === allBatch[0]);
      const sameType  = allTypes.length > 0 && allTypes.every((t) => t === allTypes[0]);
      setUniversalBatchId(sameBatch ? (allBatch[0] ? String(allBatch[0]) : 'none') : '');
      setUniversalType(sameType ? (allTypes[0] || '') : '');
      setWarnings(parsed.warnings || []);
      setYearAssumed(parsed.year_assumed);
    } catch (e: any) {
      setError(friendlyError(e));
    } finally {
      setParsing(false);
    }
  };

  const doCreate = async () => {
    const selected = rows.filter((r) => r._selected);
    if (selected.length === 0) {
      toast.error('Nothing selected to create');
      return;
    }
    setCreating(true);
    let ok = 0;
    let failed = 0;
    try {
      // When "Customize per event" is OFF, every event picks up the
      // universal venue / batch / type (with "Match per event" sentinel
      // falling back to each row's AI-parsed value). When ON, each
      // row's own values are used.
      // resolve universal batch — '' means "match per event", 'none'
      // forces null, anything else is a specific batch id string.
      const universalBatchEffective: number | null | 'PER_EVENT' =
        universalBatchId === '' ? 'PER_EVENT'
        : universalBatchId === 'none' ? null
        : Number(universalBatchId);
      const universalTypeEffective: string | 'PER_EVENT' =
        universalType === '' ? 'PER_EVENT' : universalType;

      for (const r of selected) {
        const start = isoFromDateTime(r._editDate, r._editTime);
        const dur = r._editDuration || r.duration_min || 60;
        const end = addMinutes(r._editDate, r._editTime, dur);
        // Effective batch + type per row, accounting for customize toggle
        // and the universal-vs-per-event sentinel.
        const effectiveBatchId: number | null = customizePerEvent
          ? (r.batch_id ?? null)
          : (universalBatchEffective === 'PER_EVENT' ? (r.batch_id ?? null) : universalBatchEffective);
        const effectiveType: string = customizePerEvent
          ? r.type
          : (universalTypeEffective === 'PER_EVENT' ? r.type : universalTypeEffective);
        const location = (customizePerEvent ? r._venue : universalVenue) || '';
        // Title: honor proposed_batch_name only when we're actually
        // using the AI's per-row batch (user didn't override). Once
        // overridden, the chosen batch's name wins.
        const usingAiBatch = effectiveBatchId === (r.batch_id ?? null);
        const title = usingAiBatch && r.proposed_batch_name
          ? `${r.proposed_batch_name} class`
          : batchesCache.find((b) => b.id === effectiveBatchId)?.name || effectiveType;
        try {
          await eventsApi.create(schoolId, {
            title,
            type: effectiveType,
            batch_ids: effectiveBatchId ? [effectiveBatchId] : [],
            start_datetime: start,
            end_datetime: end,
            duration: dur,
            location,
            recurrence: 'none',
            notes: '',
          });
          ok++;
        } catch {
          failed++;
        }
      }
      // Best-effort: persist a brand-new free-text venue as a quick-add
      // studio so the next Smart Add session finds it as a chip. Mirrors
      // the schedule create-event flow. Silent on failure.
      const venueToSave = (customizePerEvent ? '' : universalVenue || '').trim();
      if (venueToSave && !studioRooms.some((s) => s.name?.toLowerCase() === venueToSave.toLowerCase())) {
        studiosApi.create(schoolId, { name: venueToSave, is_quick_add: 1 }).catch(() => {});
      }
      if (ok > 0) toast.success(`Created ${ok} event${ok > 1 ? 's' : ''}${failed ? `, ${failed} failed` : ''}`);
      if (ok > 0 && failed === 0) {
        onCreated?.();
        reset();
        onClose();
      } else if (failed > 0) {
        toast.error(`${failed} couldn't be created — check the rows`);
      }
    } finally {
      setCreating(false);
    }
  };

  const selectedCount = rows.filter((r) => r._selected).length;

  return (
    <SmartModal
      open={open}
      onClose={handleClose}
      title="Smart Add"
      subtitle={rows.length === 0 ? "Describe your events in plain language. We'll parse them into your calendar automatically." : undefined}
      maxWidth={760}
      footer={
        rows.length > 0 ? (
          <>
            <button
              onClick={handleClose}
              disabled={creating}
              style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 14px', fontWeight: 600, fontSize: 13, color: 'var(--muted)', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <SmartButton onClick={doCreate} loading={creating} disabled={selectedCount === 0} size="md">
              {creating ? 'Adding…' : `Add ${selectedCount} event${selectedCount !== 1 ? 's' : ''}`}
            </SmartButton>
          </>
        ) : null
      }
    >
      {rows.length === 0 ? (
        <>
          {error && (
            <div style={{ marginBottom: 14, padding: '10px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, fontSize: 13, color: '#DC2626', lineHeight: 1.5 }}>
              {error}
            </div>
          )}

          {/* "TRY THESE PROMPTS" — collapsible. Label is a button that
              toggles the prompt boxes below. Smaller font on the
              prompt text (12px) so they fit in fewer lines and pack
              tighter visually. */}
          <div style={{ marginBottom: 18 }}>
            <button
              type="button"
              onClick={() => setPromptsOpen((o) => !o)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: 'none',
                border: 'none',
                padding: '4px 0',
                marginBottom: promptsOpen ? 10 : 0,
                cursor: 'pointer',
                fontSize: 11,
                color: 'var(--muted)',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
              aria-expanded={promptsOpen}
            >
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ transform: promptsOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform .15s' }}
                aria-hidden
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
              Try these prompts
            </button>
            {promptsOpen && (
              <div style={{ display: 'grid', gap: 8 }}>
                {examples.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => setText(ex)}
                    disabled={parsing}
                    style={{
                      textAlign: 'left',
                      padding: '11px 14px',
                      fontSize: 12,
                      lineHeight: 1.5,
                      borderRadius: 10,
                      border: '1px solid var(--border)',
                      background: 'var(--surface)',
                      color: 'var(--text)',
                      cursor: 'pointer',
                      transition: 'border-color .12s',
                      fontFamily: 'inherit',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(124,58,237,0.4)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}
                  >
                    {ex}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Textarea with crisp 1px gradient border. Outer wrapper
              paints the gradient; inner textarea has a transparent
              background to let the gradient show through 1px on every
              side. resize:both so the native bottom-right resize
              handle is fully visible (the prior resize:vertical
              produced only a horizontal scrub line and felt hidden). */}
          <div style={{
            borderRadius: 12,
            padding: 1,
            background: 'linear-gradient(135deg, #7C3AED 0%, #DC4EFF 100%)',
            marginBottom: 16,
          }}>
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => { setText(e.target.value); if (error) setError(null); }}
              placeholder="e.g. Junio batch May 21, June 26 27, July 20"
              disabled={parsing}
              rows={4}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '14px 16px',
                fontSize: 14,
                borderRadius: 11,
                border: 'none',
                background: 'var(--surface)',
                color: 'var(--text)',
                outline: 'none',
                fontFamily: 'inherit',
                resize: 'both',
                display: 'block',
                minHeight: 110,
              }}
            />
          </div>

          {/* Full-width primary CTA — matches the Create New Event
              modal pattern. The old default-time row that sat below
              this CTA was removed: any prompt that omits a time now
              silently uses 6 PM, and the user can adjust per-row in
              the preview that follows. */}
          <SmartButton onClick={doParse} loading={parsing} disabled={!text.trim()} size="md" style={{ width: '100%', justifyContent: 'center', padding: '14px 18px', fontSize: 15 }}>
            {parsing ? 'Thinking…' : 'Create Events'}
          </SmartButton>
        </>
      ) : (
        // ── Preview table ──
        <>
          {(() => {
            const friendly = warnings.map(humaniseWarning).filter(Boolean) as string[];
            if (friendly.length === 0 && !yearAssumed) return null;
            return (
              <div style={{ marginBottom: 12, padding: '10px 12px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 8 }}>
                {friendly.map((w, i) => (
                  <div key={i} style={{ fontSize: 12, color: '#B45309', lineHeight: 1.5, marginBottom: i < friendly.length - 1 ? 4 : 0 }}>💡 {w}</div>
                ))}
                {yearAssumed && (
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: friendly.length ? 6 : 0 }}>
                    Year not specified — using <strong>{yearAssumed}</strong>. Adjust any row's date below if that's wrong.
                  </div>
                )}
              </div>
            );
          })()}

          {/* Preview rows — one rounded card per parsed event.
              Default layout (compact):
                · Date on its own row
                · Time as 4 native dropdowns (H · M · AM/PM · Dur)
              Customize-per-event layout (full):
                · adds Batch, Type, Venue selectors per row
              Batch + Type are hidden by default — the AI's parsed
              values are still applied silently on submit. */}
          {(() => {
            // Shared native-select styling for the per-row controls.
            const SELECT: React.CSSProperties = {
              padding: '10px 9px',
              minHeight: 42,
              borderRadius: 9,
              border: '1.5px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
              fontSize: 13,
              cursor: 'pointer',
              width: '100%',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
            };
            return (
              <div ref={rowsContainerRef} style={{ display: 'grid', gap: 10 }}>
                {rows.map((r, i) => {
                  const isExpanded = expandedRowIdx === i;
                  const t = to12h(r._editTime);
                  const updateTime = (next: { hour?: number; minute?: number; ampm?: 'AM' | 'PM' }) => {
                    const hour = next.hour ?? t.hour;
                    const minute = next.minute ?? t.minute;
                    const ampm = next.ampm ?? t.ampm;
                    const hhmm = to24h(hour, minute, ampm);
                    setRows((prev) => prev.map((row, idx) => (idx === i ? { ...row, _editTime: hhmm } : row)));
                  };
                  return (
                    <div
                      key={i}
                      onClick={() => { if (!isExpanded) setExpandedRowIdx(i); }}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '20px 1fr',
                        gap: 8,
                        padding: isExpanded ? '14px' : '13px 14px',
                        borderRadius: 12,
                        border: `1px solid ${isExpanded ? 'rgba(124,58,237,0.55)' : 'var(--border)'}`,
                        background: !r._selected ? 'var(--surface)' : isExpanded ? 'var(--card)' : 'var(--surface)',
                        opacity: r._selected ? 1 : 0.55,
                        alignItems: isExpanded ? 'start' : 'center',
                        cursor: isExpanded ? 'default' : 'pointer',
                        boxShadow: isExpanded ? '0 4px 20px rgba(124,58,237,0.18)' : 'none',
                        transition: 'background .12s, border-color .12s, box-shadow .12s, padding .15s',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={r._selected}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) =>
                          setRows((prev) => prev.map((row, idx) => (idx === i ? { ...row, _selected: e.target.checked } : row)))
                        }
                        style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--accent)' }}
                      />
                      {isExpanded ? (
                        // ── Expanded editor — clicks inside don't bubble
                        //    to the row click handler (which would no-op
                        //    anyway, but stop them for clarity).
                        <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
                          <DateField value={r._editDate} onChange={(v: string) => setRows((prev) => prev.map((row, idx) => (idx === i ? { ...row, _editDate: v } : row)))} size="md" />

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1.4fr', gap: 6 }}>
                            <select aria-label="Hour" value={t.hour} onChange={(e) => updateTime({ hour: Number(e.target.value) })} style={SELECT}>
                              {HOURS_12.map((h) => <option key={h} value={h}>{h}</option>)}
                            </select>
                            <select aria-label="Minute" value={t.minute} onChange={(e) => updateTime({ minute: Number(e.target.value) })} style={SELECT}>
                              {MINUTES_15.map((m) => <option key={m} value={m}>:{String(m).padStart(2, '0')}</option>)}
                            </select>
                            <select aria-label="AM or PM" value={t.ampm} onChange={(e) => updateTime({ ampm: e.target.value as 'AM' | 'PM' })} style={SELECT}>
                              <option value="AM">AM</option>
                              <option value="PM">PM</option>
                            </select>
                            <select
                              aria-label="Duration"
                              value={r._editDuration}
                              onChange={(e) => setRows((prev) => prev.map((row, idx) => (idx === i ? { ...row, _editDuration: Number(e.target.value) } : row)))}
                              style={SELECT}
                            >
                              {DURATIONS.map((d) => <option key={d.v} value={d.v}>{d.label}</option>)}
                            </select>
                          </div>

                          {customizePerEvent && (
                            <>
                              <select
                                value={r.batch_id ?? ''}
                                onChange={(e) => setRows((prev) => prev.map((row, idx) => (idx === i ? { ...row, batch_id: e.target.value ? Number(e.target.value) : null, proposed_batch_name: null } : row)))}
                                style={SELECT}
                              >
                                {r.proposed_batch_name && !r.batch_id ? (
                                  <option value="">+ Create "{r.proposed_batch_name}"</option>
                                ) : (
                                  <option value="">— No batch —</option>
                                )}
                                {batchesCache.map((b) => (
                                  <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                              </select>
                              <select
                                value={r.type}
                                onChange={(e) => setRows((prev) => prev.map((row, idx) => (idx === i ? { ...row, type: e.target.value as any } : row)))}
                                style={SELECT}
                              >
                                <option>Class</option>
                                <option>Recital</option>
                                <option>Rehearsal</option>
                                <option>Workshop</option>
                                <option>Other</option>
                              </select>
                              <input
                                type="text"
                                placeholder="Venue / Location"
                                value={r._venue}
                                onChange={(e) => setRows((prev) => prev.map((row, idx) => (idx === i ? { ...row, _venue: e.target.value } : row)))}
                                style={{ ...SELECT, cursor: 'text' }}
                              />
                            </>
                          )}

                          {r.warning && (
                            <div style={{ fontSize: 11, color: '#B45309', marginTop: 2 }}>⚠ {r.warning === 'duplicate' ? 'Same date appears twice — unchecked by default. Check it to add anyway.' : r.warning}</div>
                          )}
                          {r.proposed_batch_name && !r.batch_id && (
                            <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
                              Will create a new batch named "{r.proposed_batch_name}".
                            </div>
                          )}
                        </div>
                      ) : (
                        // ── Collapsed read-only summary
                        //    Day · Time · Duration, with pencil hint
                        //    on the right that fades in on hover.
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                          <div
                            className="smart-row-summary"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 7,
                              flexWrap: 'wrap',
                              fontSize: 14,
                              lineHeight: 1.4,
                              color: 'var(--text)',
                            }}
                          >
                            <span style={{ fontWeight: 700, color: 'var(--text)' }}>{fmtNice(r._editDate)}</span>
                            <span style={{ color: 'var(--muted)' }}>·</span>
                            <span style={{ fontWeight: 600, color: 'var(--text)' }}>{fmtTimeLabel(r._editTime)}</span>
                            <span style={{ color: 'var(--muted)' }}>·</span>
                            <span style={{ color: 'var(--muted)', fontWeight: 500 }}>{fmtDurLabel(r._editDuration)}</span>
                            <span
                              aria-label="Edit"
                              style={{
                                marginLeft: 'auto',
                                color: 'var(--muted)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                opacity: 0.55,
                                flexShrink: 0,
                              }}
                            >
                              <PencilIcon />
                            </span>
                          </div>
                          {r.warning && (
                            <div style={{ fontSize: 11, color: '#B45309' }}>⚠ {r.warning === 'duplicate' ? 'Same date appears twice — unchecked by default. Check it to add anyway.' : r.warning}</div>
                          )}
                          {r.proposed_batch_name && !r.batch_id && (
                            <div style={{ fontSize: 11, color: '#6B7280' }}>
                              Will create a new batch named "{r.proposed_batch_name}".
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* ── Universal Batch + Event Type + Venue ──
              Hidden when "Customize per event" is ON (per-row editors
              take over inside each expanded row). Smart pre-fill from
              parsed rows; "Match per event" sentinel keeps AI's per-row
              values intact when the rows differ. */}
          {!customizePerEvent && (
            <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Batch */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: 11, fontWeight: 700, color: 'var(--muted)',
                  letterSpacing: '0.07em', textTransform: 'uppercase',
                  marginBottom: 8,
                }}>
                  Batch <span style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0, color: 'var(--muted)' }}>· applies to all</span>
                </label>
                <select
                  value={universalBatchId}
                  onChange={(e) => setUniversalBatchId(e.target.value)}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '11px 13px', borderRadius: 9,
                    border: '1.5px solid var(--border)',
                    background: 'var(--surface)', color: 'var(--text)',
                    fontSize: 14, fontFamily: 'inherit', cursor: 'pointer',
                  }}
                >
                  <option value="">— Match per event —</option>
                  <option value="none">— No batch —</option>
                  {batchesCache.map((b) => (
                    <option key={b.id} value={String(b.id)}>{b.name}</option>
                  ))}
                </select>
              </div>

              {/* Event Type */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: 11, fontWeight: 700, color: 'var(--muted)',
                  letterSpacing: '0.07em', textTransform: 'uppercase',
                  marginBottom: 8,
                }}>
                  Event Type <span style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0, color: 'var(--muted)' }}>· applies to all</span>
                </label>
                <select
                  value={universalType}
                  onChange={(e) => setUniversalType(e.target.value)}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '11px 13px', borderRadius: 9,
                    border: '1.5px solid var(--border)',
                    background: 'var(--surface)', color: 'var(--text)',
                    fontSize: 14, fontFamily: 'inherit', cursor: 'pointer',
                  }}
                >
                  <option value="">— Match per event —</option>
                  <option value="Class">Class</option>
                  <option value="Recital">Recital</option>
                  <option value="Rehearsal">Rehearsal</option>
                  <option value="Workshop">Workshop</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Venue */}
              <div>
              <label style={{
                display: 'block',
                fontSize: 11, fontWeight: 700, color: 'var(--muted)',
                letterSpacing: '0.07em', textTransform: 'uppercase',
                marginBottom: 8,
              }}>
                Venue / Location <span style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0, color: 'var(--muted)' }}>· applies to all</span>
              </label>
              <input
                type="text"
                value={universalVenue}
                onChange={(e) => setUniversalVenue(e.target.value)}
                placeholder={studioRooms.length > 0 ? 'Or type a custom location…' : 'e.g. Studio A'}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '11px 13px', borderRadius: 9,
                  border: '1.5px solid var(--border)',
                  background: 'var(--surface)', color: 'var(--text)',
                  fontSize: 14, fontFamily: 'inherit', outline: 'none',
                }}
              />
              {studioRooms.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginTop: 9 }}>
                  {[...studioRooms]
                    .sort((a: any, b: any) =>
                      (b.is_favorite ? 1 : 0) - (a.is_favorite ? 1 : 0) ||
                      (Number(b.id) || 0) - (Number(a.id) || 0)
                    )
                    .slice(0, 4)
                    .map((s: any) => {
                      const active = universalVenue === s.name;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          title={s.name}
                          onClick={() => setUniversalVenue(active ? '' : s.name)}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                            padding: '6px 12px', borderRadius: 20, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                            border: `1.5px solid ${active ? 'var(--accent)' : s.is_favorite ? '#F59E0B' : 'var(--border)'}`,
                            background: active ? 'var(--accent)' : s.is_favorite ? '#FFFBEB' : 'transparent',
                            color: active ? '#fff' : s.is_favorite ? '#B45309' : 'var(--muted)',
                            transition: 'all .12s', minWidth: 0,
                            fontFamily: 'inherit',
                          }}
                        >
                          {!!s.is_favorite && !active && <span style={{ fontSize: 11, flexShrink: 0 }}>★</span>}
                          {active && <span style={{ flexShrink: 0 }}>✓</span>}
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                        </button>
                      );
                    })}
                </div>
              )}
              </div>{/* /Venue inner */}
            </div>
          )}

          {/* ── "Customize per event" — tertiary opt-in.
              Lives just above the back-link, small, muted; matches
              the spec (tertiary treatment, opted out by default). */}
          <label
            style={{
              marginTop: 18,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              cursor: 'pointer',
              fontSize: 11.5,
              color: 'var(--muted)',
              userSelect: 'none',
            }}
          >
            <input
              type="checkbox"
              checked={customizePerEvent}
              onChange={(e) => setCustomizePerEvent(e.target.checked)}
              style={{ width: 13, height: 13, cursor: 'pointer', accentColor: 'var(--accent)' }}
            />
            Customize per event (batch, type, venue)
          </label>

          <button
            onClick={() => setRows([])}
            disabled={creating}
            style={{ display: 'block', marginTop: 10, fontSize: 12, background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', textDecoration: 'underline' }}
          >
            ← back to edit
          </button>
        </>
      )}
      <SmartUsageFooter />
    </SmartModal>
  );
}
