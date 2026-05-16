'use client';

import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import SmartModal from './SmartModal';
import SmartButton from './SmartButton';
import SmartUsageFooter from './SmartUsageFooter';
import { smart, type SmartParsedEvent } from '@/lib/api/smart';
import { events as eventsApi, batches as batchesApi } from '@/lib/api';
import { DateField, TimeField } from '@/components/shared/date/Picker';

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

const EXAMPLES = [
  'Hip Hop Mon Wed Fri 5pm March',
  'Junio batch May 21, June 26 27, July 20',
  'Bharatanatyam Beg Tuesdays 6pm for next 6 weeks',
];

type Row = SmartParsedEvent & {
  _selected: boolean;
  _editTime: string;       // user-editable
  _editDate: string;       // user-editable
};

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
  const [defaultTime, setDefaultTime] = useState('17:00'); // 5 PM
  const [batchesCache, setBatchesCache] = useState<{ id: number; name: string }[]>([]);
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

  const reset = () => {
    setText('');
    setRows([]);
    setWarnings([]);
    setYearAssumed(null);
    setError(null);
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
      setRows(
        parsed.events.map((e) => ({
          ...e,
          _selected: !(e.warning === 'duplicate'),  // dedupe by default
          _editTime: e.time || defaultTime,
          _editDate: e.date,
        }))
      );
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
      for (const r of selected) {
        const start = isoFromDateTime(r._editDate, r._editTime);
        const end = addMinutes(r._editDate, r._editTime, r.duration_min || 60);
        try {
          await eventsApi.create(schoolId, {
            title: r.proposed_batch_name
              ? `${r.proposed_batch_name} class`
              : batchesCache.find((b) => b.id === r.batch_id)?.name || r.type,
            type: r.type,
            batch_ids: r.batch_id ? [r.batch_id] : [],
            start_datetime: start,
            end_datetime: end,
            duration: r.duration_min || 60,
            location: '',
            recurrence: 'none',
            notes: '',
          });
          ok++;
        } catch {
          failed++;
        }
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
      subtitle="Type or paste a casual schedule. We'll suggest events you can review and add in one click."
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
            <div style={{ marginBottom: 12, padding: '10px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, fontSize: 13, color: '#DC2626', lineHeight: 1.5 }}>
              {error}
            </div>
          )}
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
              padding: '12px 14px',
              fontSize: 14,
              borderRadius: 10,
              border: '1.5px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
              outline: 'none',
              fontFamily: 'inherit',
              resize: 'vertical',
            }}
          />
          <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 4 }}>Try:</span>
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => setText(ex)}
                disabled={parsing}
                style={{ fontSize: 11, padding: '4px 9px', borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--muted)', cursor: 'pointer' }}
              >
                {ex}
              </button>
            ))}
          </div>

          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <label style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
              Default time when missing:
              <div style={{ minWidth: 140 }}>
                <TimeField value={defaultTime} onChange={(v: string) => setDefaultTime(v)} size="sm" />
              </div>
            </label>
            <SmartButton onClick={doParse} loading={parsing} disabled={!text.trim()} size="md">
              {parsing ? 'Thinking…' : 'Create Events'}
            </SmartButton>
          </div>
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

          <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            {/* header — desktop only */}
            {!narrow && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: '36px 1.4fr 80px 1.6fr 80px',
                gap: 8,
                padding: '8px 12px',
                background: 'var(--surface)',
                borderBottom: '1px solid var(--border)',
                fontSize: 10,
                fontWeight: 700,
                color: 'var(--muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
              }}>
                <div></div>
                <div>Date</div>
                <div>Time</div>
                <div>Batch</div>
                <div>Type</div>
              </div>
            )}

            {rows.map((r, i) => (
              <div
                key={i}
                style={{
                  display: 'grid',
                  gridTemplateColumns: narrow ? '36px 1fr' : '36px 1.4fr 80px 1.6fr 80px',
                  gap: 8,
                  padding: narrow ? '12px' : '8px 12px',
                  alignItems: narrow ? 'flex-start' : 'center',
                  borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none',
                  background: r._selected ? 'var(--card)' : 'var(--surface)',
                  opacity: r._selected ? 1 : 0.55,
                }}
              >
                <input
                  type="checkbox"
                  checked={r._selected}
                  onChange={(e) =>
                    setRows((prev) => prev.map((row, idx) => (idx === i ? { ...row, _selected: e.target.checked } : row)))
                  }
                  style={{ width: 16, height: 16, cursor: 'pointer' }}
                />
                {narrow ? (
                  // ── Mobile: stacked card layout ──
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <DateField value={r._editDate} onChange={(v: string) => setRows((prev) => prev.map((row, idx) => (idx === i ? { ...row, _editDate: v } : row)))} size="sm" />
                      <TimeField value={r._editTime} onChange={(v: string) => setRows((prev) => prev.map((row, idx) => (idx === i ? { ...row, _editTime: v } : row)))} size="sm" />
                    </div>
                    <select
                      value={r.batch_id ?? ''}
                      onChange={(e) => setRows((prev) => prev.map((row, idx) => (idx === i ? { ...row, batch_id: e.target.value ? Number(e.target.value) : null, proposed_batch_name: null } : row)))}
                      style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: 13, cursor: 'pointer', width: '100%' }}
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
                      style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: 13, cursor: 'pointer', width: '100%' }}
                    >
                      <option>Class</option>
                      <option>Recital</option>
                      <option>Rehearsal</option>
                      <option>Workshop</option>
                      <option>Other</option>
                    </select>
                    {r.warning && (
                      <div style={{ fontSize: 11, color: '#B45309', marginTop: 2 }}>⚠ {r.warning === 'duplicate' ? 'Same date appears twice — unchecked by default. Check it to add anyway.' : r.warning}</div>
                    )}
                    {r.proposed_batch_name && !r.batch_id && (
                      <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
                        Will create a new batch named "{r.proposed_batch_name}" — or pick one above.
                      </div>
                    )}
                  </div>
                ) : (
                  // ── Desktop: inline grid columns ──
                  <>
                    <DateField value={r._editDate} onChange={(v: string) => setRows((prev) => prev.map((row, idx) => (idx === i ? { ...row, _editDate: v } : row)))} size="sm" />
                    <TimeField value={r._editTime} onChange={(v: string) => setRows((prev) => prev.map((row, idx) => (idx === i ? { ...row, _editTime: v } : row)))} size="sm" />
                    <select
                      value={r.batch_id ?? ''}
                      onChange={(e) => setRows((prev) => prev.map((row, idx) => (idx === i ? { ...row, batch_id: e.target.value ? Number(e.target.value) : null, proposed_batch_name: null } : row)))}
                      style={{ padding: '5px 6px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: 12, cursor: 'pointer' }}
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
                      style={{ padding: '5px 6px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: 12, cursor: 'pointer' }}
                    >
                      <option>Class</option>
                      <option>Recital</option>
                      <option>Rehearsal</option>
                      <option>Workshop</option>
                      <option>Other</option>
                    </select>
                    {r.warning && (
                      <div style={{ gridColumn: '2 / -1', fontSize: 11, color: '#B45309', marginTop: 2 }}>⚠ {r.warning === 'duplicate' ? 'Same date appears twice — unchecked by default. Check it to add anyway.' : r.warning}</div>
                    )}
                    {r.proposed_batch_name && !r.batch_id && (
                      <div style={{ gridColumn: '2 / -1', fontSize: 11, color: '#6B7280', marginTop: 2 }}>
                        Will create a new batch named "{r.proposed_batch_name}" — or pick one above.
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>

          <button
            onClick={() => setRows([])}
            disabled={creating}
            style={{ marginTop: 12, fontSize: 12, background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', textDecoration: 'underline' }}
          >
            ← back to edit
          </button>
        </>
      )}
      <SmartUsageFooter />
    </SmartModal>
  );
}
