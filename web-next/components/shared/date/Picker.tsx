// @ts-nocheck
'use client';

// ── Unified date / time picker ─────────────────────────────────────────────
// One visual language for every date/time input in the app:
//   <WhenField>      → date + time, combined popover (calendar + AM/PM hour list)
//   <DateField>      → date only, same calendar popover
//   <TimeField>      → time only (AM/PM, 15-min steps)
//   <DurationField>  → six chips (30 / 45 / 1 hr / 1 hr 15 / 1 hr 30 / 2 hr)
//   <DayOfWeekField> → seven round pills (S M T W T F S) multi-select
//
// All values are plain strings:
//   When  → "YYYY-MM-DDTHH:MM"
//   Date  → "YYYY-MM-DD"
//   Time  → "HH:MM"     (24h)
//   Dur   → number (minutes)
//   DOW   → number[]    (0=Sun..6=Sat)
//
// School-local timezone is implicit. No UTC, no offset handling.

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { parseLocalDate, parseLocalDateTime, formatDate, formatTime, addMinutesToTime, DOW_SINGLE, DOW_SHORT, DURATION_OPTIONS, formatDuration } from '@/lib/date';

const pad = n => String(n).padStart(2, '0');
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS_SHORT   = ['Su','Mo','Tu','We','Th','Fr','Sa'];

// ─── Shared visual chrome ───────────────────────────────────────────────────
const triggerStyle = (open, size, hasValue) => ({
  width: '100%',
  background: 'var(--surface)',
  border: `1.5px solid ${open ? 'var(--accent)' : 'var(--border)'}`,
  borderRadius: 9,
  padding: size === 'sm' ? '7px 11px' : '9px 13px',
  cursor: 'pointer',
  boxShadow: open ? '0 0 0 3px rgba(124,58,237,0.12)' : 'none',
  transition: 'all .15s',
  textAlign: 'left',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  fontSize: size === 'sm' ? 13 : 14,
  fontWeight: 600,
  color: hasValue ? 'var(--text)' : 'var(--muted)',
  fontFamily: 'var(--font-b)',
});

const labelStyle = {
  display: 'block',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.07em',
  textTransform: 'uppercase',
  color: 'var(--muted)',
  marginBottom: 5,
};

function CalendarIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.7 }}>
      <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function ClockIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.7 }}>
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function ChevronDown({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto', flexShrink: 0, opacity: 0.5 }}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

// ─── Calendar grid (shared by WhenField + DateField) ────────────────────────
function CalendarGrid({ year, month, selectedY, selectedM, selectedD, onPick, onMonthChange, minDate }) {
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMo = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMo; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const today = new Date();
  const isToday    = d => d && year === today.getFullYear() && month === today.getMonth() && d === today.getDate();
  const isSelected = d => d && year === selectedY && month === selectedM && d === selectedD;

  // Disable cells before minDate
  const minD = minDate ? parseLocalDate(minDate) : null;
  const isDisabled = d => {
    if (!d || !minD) return false;
    const cell = new Date(year, month, d);
    return cell < minD;
  };

  const goPrev = () => onMonthChange(month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 });
  const goNext = () => onMonthChange(month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <button type="button" onClick={goPrev} style={navBtn}>‹</button>
        <span style={{ fontWeight: 700, fontSize: 13 }}>{MONTHS_SHORT[month]} {year}</span>
        <button type="button" onClick={goNext} style={navBtn}>›</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', marginBottom: 4 }}>
        {DAYS_SHORT.map(d => <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'var(--muted)', padding: '2px 0' }}>{d}</div>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
        {cells.map((d, i) => {
          const disabled = isDisabled(d);
          return (
            <button
              key={i}
              type="button"
              disabled={!d || disabled}
              onClick={() => d && !disabled && onPick(d)}
              style={{
                padding: '6px 0',
                textAlign: 'center',
                fontSize: 12,
                border: 'none',
                cursor: d && !disabled ? 'pointer' : 'default',
                borderRadius: 7,
                background: isSelected(d) ? 'var(--accent)' : 'transparent',
                color: isSelected(d) ? '#fff' : isToday(d) ? 'var(--accent)' : disabled ? 'var(--muted)' : d ? 'var(--text)' : 'transparent',
                opacity: disabled ? 0.35 : 1,
                fontWeight: isToday(d) || isSelected(d) ? 700 : 500,
              }}
            >
              {d || ''}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const navBtn = {
  background: 'var(--surface)',
  border: 'none',
  borderRadius: 6,
  padding: '4px 9px',
  cursor: 'pointer',
  fontSize: 13,
  color: 'var(--text)',
};

// ─── Time list (hours + minutes) ────────────────────────────────────────────
function TimeColumn({ hour, minute, onChange }) {
  const HOURS = Array.from({ length: 24 }, (_, i) => i);
  const MINUTES = [0, 15, 30, 45];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 8 }}>
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Hour</div>
        <div style={{ maxHeight: 220, overflowY: 'auto', display: 'grid', gap: 2, paddingRight: 4 }}>
          {HOURS.map(h => {
            const label = h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`;
            return (
              <button key={h} type="button" onClick={() => onChange(h, minute)} style={{
                padding: '6px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, textAlign: 'left',
                background: hour === h ? 'var(--accent)' : 'transparent',
                color: hour === h ? '#fff' : 'var(--text)',
              }}>{label}</button>
            );
          })}
        </div>
      </div>
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Min</div>
        <div style={{ display: 'grid', gap: 2 }}>
          {MINUTES.map(m => (
            <button key={m} type="button" onClick={() => onChange(hour, m)} style={{
              padding: '6px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, textAlign: 'left',
              background: minute === m ? 'var(--accent)' : 'transparent',
              color: minute === m ? '#fff' : 'var(--text)',
            }}>:{pad(m)}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Popover wrapper with outside-click + escape ────────────────────────────
function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onClick = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey   = e => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey); };
  }, [open]);
  return { open, setOpen, ref };
}

const popoverStyle = {
  position: 'absolute',
  top: 'calc(100% + 8px)',
  left: 0,
  zIndex: 300,
  background: 'var(--card)',
  borderRadius: 12,
  boxShadow: '0 12px 40px rgba(0,0,0,0.32)',
  border: '1px solid var(--border)',
  padding: 14,
  minWidth: 280,
};

// ─── <WhenField> — combined date + time ─────────────────────────────────────
export function WhenField({ label = null, value = '', onChange = () => {}, minDate = undefined, size = 'md', placeholder = 'Pick date & time…' }: any) {
  const { open, setOpen, ref } = usePopover();
  const parsed = useMemo(() => parseLocalDateTime(value), [value]);

  const [cal, setCal] = useState(() => {
    const d = parsed || new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  useEffect(() => {
    if (parsed) setCal({ year: parsed.getFullYear(), month: parsed.getMonth() });
  }, [parsed?.getTime()]);

  const hour   = parsed ? parsed.getHours() : 18;
  const minute = parsed ? Math.floor(parsed.getMinutes() / 15) * 15 : 0;

  const emit = useCallback((y, mo, d, h, mi) => {
    onChange(`${y}-${pad(mo + 1)}-${pad(d)}T${pad(h)}:${pad(mi)}`);
  }, [onChange]);

  const selectDay = d => {
    emit(cal.year, cal.month, d, hour, minute);
  };
  const selectTime = (h, mi) => {
    if (parsed) emit(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), h, mi);
    else        emit(cal.year, cal.month, new Date().getDate(), h, mi);
  };

  const displayDate = parsed ? formatDate(`${parsed.getFullYear()}-${pad(parsed.getMonth()+1)}-${pad(parsed.getDate())}`, 'weekday') : null;
  const displayTime = parsed ? formatTime(`${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`) : null;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {label && <label style={labelStyle}>{label}</label>}
      <button type="button" onClick={() => setOpen(p => !p)} style={triggerStyle(open, size, !!parsed)}>
        <CalendarIcon />
        {parsed ? (
          <>
            <span style={{ color: 'var(--text)', fontWeight: 600 }}>{displayDate}</span>
            <span style={{ color: 'var(--muted)', fontWeight: 600 }}>·</span>
            <span style={{ color: 'var(--text)', fontWeight: 600 }}>{displayTime}</span>
          </>
        ) : (
          <span>{placeholder}</span>
        )}
        <ChevronDown />
      </button>
      {open && (
        <div style={{ ...popoverStyle, display: 'grid', gridTemplateColumns: '240px 180px', gap: 16 }}>
          <CalendarGrid
            year={cal.year} month={cal.month}
            selectedY={parsed?.getFullYear()} selectedM={parsed?.getMonth()} selectedD={parsed?.getDate()}
            onPick={selectDay}
            onMonthChange={setCal}
            minDate={minDate}
          />
          <TimeColumn hour={hour} minute={minute} onChange={selectTime} />
        </div>
      )}
    </div>
  );
}

// ─── <DateField> — date only, same calendar ─────────────────────────────────
export function DateField({ label = null, value = '', onChange = () => {}, min = undefined, max = undefined, futureOnly = false, size = 'md', placeholder = 'Pick a date…' }: any) {
  const { open, setOpen, ref } = usePopover();
  const parsed = useMemo(() => parseLocalDate(value), [value]);

  const [cal, setCal] = useState(() => {
    const d = parsed || new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  useEffect(() => { if (parsed) setCal({ year: parsed.getFullYear(), month: parsed.getMonth() }); }, [parsed?.getTime()]);

  const effectiveMin = futureOnly ? (() => { const t = new Date(); return `${t.getFullYear()}-${pad(t.getMonth()+1)}-${pad(t.getDate())}`; })() : min;

  const pick = d => {
    onChange(`${cal.year}-${pad(cal.month + 1)}-${pad(d)}`);
    setOpen(false);
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {label && <label style={labelStyle}>{label}</label>}
      <button type="button" onClick={() => setOpen(p => !p)} style={triggerStyle(open, size, !!parsed)}>
        <CalendarIcon />
        {parsed
          ? <span style={{ color: 'var(--text)', fontWeight: 600 }}>{formatDate(value, 'full')}</span>
          : <span>{placeholder}</span>}
        <ChevronDown />
      </button>
      {open && (
        <div style={popoverStyle}>
          <CalendarGrid
            year={cal.year} month={cal.month}
            selectedY={parsed?.getFullYear()} selectedM={parsed?.getMonth()} selectedD={parsed?.getDate()}
            onPick={pick}
            onMonthChange={setCal}
            minDate={effectiveMin}
          />
        </div>
      )}
    </div>
  );
}

// ─── <TimeField> — time only, AM/PM 15-min steps ────────────────────────────
export function TimeField({ label = null, value = '', onChange = () => {}, nullable = false, size = 'md', placeholder = 'Pick a time…' }: any) {
  const { open, setOpen, ref } = usePopover();
  const [h, m] = (value || '').split(':').map(n => parseInt(n, 10));
  const hasValue = !isNaN(h);
  const hour   = hasValue ? h : 18;
  const minute = hasValue ? (Math.floor((m || 0) / 15) * 15) : 0;

  const emit = (hh, mm) => {
    onChange(`${pad(hh)}:${pad(mm)}`);
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {label && <label style={labelStyle}>{label}</label>}
      <button type="button" onClick={() => setOpen(p => !p)} style={triggerStyle(open, size, hasValue)}>
        <ClockIcon />
        {hasValue
          ? <span style={{ color: 'var(--text)', fontWeight: 600 }}>{formatTime(value)}</span>
          : <span>{placeholder}</span>}
        <ChevronDown />
      </button>
      {open && (
        <div style={popoverStyle}>
          {nullable && (
            <button type="button"
              onClick={() => { onChange(''); setOpen(false); }}
              style={{ width: '100%', marginBottom: 10, padding: '6px 10px', borderRadius: 6, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--muted)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
              — No time —
            </button>
          )}
          <TimeColumn hour={hour} minute={minute} onChange={emit} />
        </div>
      )}
    </div>
  );
}

// ─── <DurationField> — six chips ────────────────────────────────────────────
export function DurationField({ label = 'Duration', value = 60, onChange = () => {}, startTime = '', options = DURATION_OPTIONS, size = 'md' }: any) {
  // `startTime` may be either "HH:MM" or a full datetime — both supported.
  const endHint = useMemo(() => {
    if (!startTime || !value) return null;
    if (startTime.includes('T')) {
      // datetime — derive HH:MM from it
      const d = parseLocalDateTime(startTime);
      if (!d) return null;
      const hhmm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
      return formatTime(addMinutesToTime(hhmm, value));
    }
    return formatTime(addMinutesToTime(startTime, value));
  }, [startTime, value]);

  return (
    <div>
      {label && <label style={labelStyle}>{label}</label>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {options.map(o => {
          const selected = Number(value) === o.value;
          return (
            <button key={o.value} type="button" onClick={() => onChange(o.value)} style={{
              background: selected ? 'var(--accent)' : 'var(--surface)',
              color: selected ? '#fff' : 'var(--text)',
              border: `1.5px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
              padding: size === 'sm' ? '5px 10px' : '7px 12px',
              borderRadius: 18,
              fontSize: size === 'sm' ? 12 : 13,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all .12s',
              fontFamily: 'var(--font-b)',
            }}>{o.label}</button>
          );
        })}
      </div>
      {endHint && (
        <p style={{ fontSize: 12, color: 'var(--muted)', margin: '8px 0 0' }}>
          Ends at <b style={{ color: 'var(--text)' }}>{endHint}</b>
        </p>
      )}
    </div>
  );
}

// ─── <DayOfWeekField> — seven round pills ───────────────────────────────────
export function DayOfWeekField({ label = 'Meets on', value = [], onChange = () => {}, size = 'md' }: any) {
  const toggle = i => {
    if (value.includes(i)) onChange(value.filter(x => x !== i));
    else onChange([...value, i].sort((a, b) => a - b));
  };
  // Render starting Monday for muscle memory (M T W T F S S)
  const order = [1, 2, 3, 4, 5, 6, 0];
  const dim = size === 'sm' ? 32 : 36;
  return (
    <div>
      {label && <label style={labelStyle}>{label}</label>}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {order.map(i => {
          const selected = value.includes(i);
          return (
            <button key={i} type="button" onClick={() => toggle(i)} title={DOW_SHORT[i]} style={{
              width: dim, height: dim, borderRadius: '50%',
              background: selected ? 'var(--accent)' : 'var(--surface)',
              color: selected ? '#fff' : 'var(--text)',
              border: `1.5px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
              fontSize: 13, fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all .12s',
              fontFamily: 'var(--font-b)',
            }}>{DOW_SINGLE[i]}</button>
          );
        })}
      </div>
    </div>
  );
}
