// @ts-nocheck
// ── Shared date/time utilities ───────────────────────────────────────────────
// All dates are stored & passed as `YYYY-MM-DD` strings.
// All times as `HH:MM` 24h.
// All datetimes as `YYYY-MM-DDTHH:MM` local (no Z, no offset).
// Everything is interpreted in the browser's local timezone — which matches
// school-local time for this app. No cross-tz logic.
//
// New code should NOT use `new Date('YYYY-MM-DD')` directly — that parses as
// UTC midnight and shifts a day in negative offsets. Use `parseLocalDate`.

const pad = n => String(n).padStart(2, '0');

// ── Today / now ─────────────────────────────────────────────────────────────
export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function nowDateTimeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ── Parsing — local-safe ────────────────────────────────────────────────────
export function parseLocalDate(s) {
  if (!s || typeof s !== 'string') return null;
  // Accept YYYY-MM-DD or YYYY-MM-DDTHH:MM[:SS]
  const [datePart] = s.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export function parseLocalDateTime(s) {
  if (!s || typeof s !== 'string') return null;
  // Accept YYYY-MM-DDTHH:MM or full ISO
  const [datePart, timePart = '00:00'] = s.split('T');
  const [y, mo, d] = datePart.split('-').map(Number);
  const [h, mi] = timePart.slice(0, 5).split(':').map(Number);
  if (!y || !mo || !d) return null;
  return new Date(y, mo - 1, d, h || 0, mi || 0);
}

// ── Formatters — replace the 6+ inline toLocaleDateString variants ──────────
export function formatDate(s, style = 'short') {
  const d = parseLocalDate(s);
  if (!d) return '';
  if (style === 'long')    return d.toLocaleDateString([], { month: 'long',  day: 'numeric', year: 'numeric' });
  if (style === 'weekday') return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  if (style === 'full')    return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  // 'short' default
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatTime(s) {
  if (!s) return '';
  // Accept HH:MM 24h OR full datetime
  let h, m;
  if (s.includes('T')) {
    const d = parseLocalDateTime(s);
    if (!d) return '';
    h = d.getHours(); m = d.getMinutes();
  } else {
    [h, m] = s.split(':').map(Number);
    if (isNaN(h)) return '';
  }
  const period = h < 12 ? 'AM' : 'PM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${pad(m || 0)} ${period}`;
}

export function formatDateTime(s) {
  const d = parseLocalDateTime(s);
  if (!d) return '';
  return `${d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} · ${formatTime(s)}`;
}

export function formatTimeRange(a, b) {
  if (!a || !b) return formatTime(a || b);
  return `${formatTime(a)} – ${formatTime(b)}`;
}

// ── Time arithmetic ─────────────────────────────────────────────────────────
export function addMinutesToTime(time, minutes) {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  if (isNaN(h)) return '';
  const total = h * 60 + (m || 0) + Number(minutes || 0);
  const hh = Math.floor((total % (24 * 60)) / 60);
  const mm = total % 60;
  return `${pad(hh)}:${pad(mm)}`;
}

export function diffMinutes(start, end) {
  if (!start || !end) return 0;
  const [h1, m1] = start.split(':').map(Number);
  const [h2, m2] = end.split(':').map(Number);
  return (h2 * 60 + m2) - (h1 * 60 + m1);
}

export function computeEndDateTime(startStr, durationMins) {
  if (!startStr || !durationMins) return '';
  const d = parseLocalDateTime(startStr);
  if (!d) return '';
  const end = new Date(d.getTime() + Number(durationMins) * 60000);
  return `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}T${pad(end.getHours())}:${pad(end.getMinutes())}`;
}

// ── Day-of-week helpers ─────────────────────────────────────────────────────
// 0 = Sunday … 6 = Saturday (matches JS Date.getDay())
export const DOW_SHORT  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
export const DOW_SINGLE = ['S','M','T','W','T','F','S'];
export const DOW_FULL   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

// Legacy batches schema stores day_of_week as "Mon"/"Tue"/.../"Sun" strings
export const DOW_CODE = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
export function dowCodeToIndex(code) { return DOW_CODE.indexOf(code); }
export function dowIndexToCode(i)   { return DOW_CODE[i] || 'Mon'; }

// ── Misc ────────────────────────────────────────────────────────────────────
export function isFutureISO(s) {
  const d = parseLocalDate(s);
  if (!d) return false;
  const today = new Date(); today.setHours(0,0,0,0);
  return d.getTime() > today.getTime();
}

export function isOverdueISO(s) {
  const d = parseLocalDate(s);
  if (!d) return false;
  const today = new Date(); today.setHours(0,0,0,0);
  return d.getTime() < today.getTime();
}

// Canonical 15-min slots (24*4 = 96)
export const TIME_SLOTS_15 = Array.from({ length: 96 }, (_, i) => {
  const h = Math.floor(i / 4);
  const m = (i % 4) * 15;
  return `${pad(h)}:${pad(m)}`;
});

// ── Standard duration options for dance classes ─────────────────────────────
export const DURATION_OPTIONS = [
  { value: 30,  label: '30 min' },
  { value: 45,  label: '45 min' },
  { value: 60,  label: '1 hr' },
  { value: 75,  label: '1 hr 15' },
  { value: 90,  label: '1 hr 30' },
  { value: 120, label: '2 hr' },
];

export function formatDuration(mins) {
  if (!mins) return '';
  const n = Number(mins);
  if (n < 60) return `${n} min`;
  const h = Math.floor(n / 60);
  const m = n % 60;
  if (m === 0) return `${h} hr`;
  return `${h} hr ${m}`;
}
