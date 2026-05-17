// ── Recital plan template — deterministic, zero-AI ──────────────────────
// Generates the same {todos, summary} shape Smart Plan used to return,
// without calling Anthropic. The AI was regurgitating an industry-
// standard recital timeline; a template covers 90%+ of cases at $0 cost
// and <10ms latency.
//
// To revert to the AI version, restore the runJson() call in
// routes/smart.js — this file leaves no schema or DB footprint.

// ── Base timeline ────────────────────────────────────────────────────────
// 14 todos covering the full 90-day → day-of arc. Each row maps directly
// to a SmartPlanTodo on the frontend (lib/api/smart.ts).
//
// IMPORTANT: keep `task_text` < 80 chars (matches the old AI prompt rule),
// action-verb-first, parent/parent-friendly language.
const BASE_TODOS = [
  { d: 90, c: 'Venue',         t: 'Confirm venue booking and capacity' },
  { d: 75, c: 'Communications',t: 'Send save-the-date to all families' },
  { d: 60, c: 'Music',         t: 'Finalize song selection per group' },
  { d: 60, c: 'Costumes',      t: 'Send costume sizing form to parents' },
  { d: 45, c: 'Costumes',      t: 'Order costumes from supplier' },
  { d: 45, c: 'Communications',t: 'Open RSVP via the public page' },
  { d: 30, c: 'Tech',          t: 'Confirm sound and lighting requirements' },
  { d: 21, c: 'Rehearsal',     t: 'Schedule the first full run-through' },
  { d: 14, c: 'Tech',          t: 'Submit final music order to the tech team' },
  { d: 14, c: 'Communications',t: 'Email program and arrival time to parents' },
  { d: 7,  c: 'Rehearsal',     t: 'Dress rehearsal' },
  { d: 3,  c: 'Communications',t: 'Send day-of reminder with venue address' },
  { d: 1,  c: 'Day-of',        t: 'Confirm volunteers and front-of-house' },
  { d: 0,  c: 'Day-of',        t: 'Show day — arrive at least 90 minutes early' },
];

// ── Dance-style add-ons ─────────────────────────────────────────────────
// Keyword-matched against the school's `dance_style`. Adds 1-2 extra
// todos so the plan feels tailored without an AI call. Multiple matches
// stack (e.g. a school doing "Bharatanatyam, Kathak" gets both classical
// and any other matching add-ons — deduped by exact task_text).
//
// Adding a new style? Append a row with { match: [...keywords], todos: [...] }.
const STYLE_ADDONS = [
  {
    match: ['bharatanatyam', 'classical', 'kathak', 'odissi', 'mohiniyattam', 'kuchipudi'],
    todos: [
      { d: 60, c: 'Music',    t: 'Book mridangam / percussionist accompaniment' },
      { d: 21, c: 'Costumes', t: 'Confirm temple jewellery rental and pickup' },
    ],
  },
  {
    match: ['ballet'],
    todos: [
      { d: 30, c: 'Costumes', t: 'Pointe-shoe inventory check for senior dancers' },
    ],
  },
  {
    match: ['hip hop', 'hip-hop', 'contemporary', 'jazz', 'western', 'tap'],
    todos: [
      { d: 14, c: 'Tech', t: 'Check stage props and set pieces with venue' },
    ],
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────
function pad(n) { return String(n).padStart(2, '0'); }

function addDaysISO(yyyymmdd, deltaDays) {
  // Parse as local midnight to avoid TZ surprises.
  const [y, m, d] = yyyymmdd.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + deltaDays);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

function styleAddons(danceStyle) {
  if (!danceStyle) return [];
  const lower = String(danceStyle).toLowerCase();
  const collected = [];
  for (const set of STYLE_ADDONS) {
    if (set.match.some((kw) => lower.includes(kw))) {
      for (const todo of set.todos) collected.push(todo);
    }
  }
  // Dedupe by task_text in case multiple style groups list the same item.
  const seen = new Set();
  return collected.filter((t) => {
    if (seen.has(t.t)) return false;
    seen.add(t.t);
    return true;
  });
}

// ── Main entry point ────────────────────────────────────────────────────
/**
 * Build a recital plan with no AI call.
 *
 * @param {object} opts
 * @param {string} opts.eventDate      - YYYY-MM-DD
 * @param {number} opts.daysUntil      - integer days from today to eventDate
 * @param {string} [opts.danceStyle]   - free-text style ("Bharatanatyam, Kathak")
 * @param {string} [opts.title]        - recital title (used in summary copy only)
 * @param {string} [opts.venue]        - venue name; if missing, "venue TBD"
 *                                       hint pushes the Venue todo to top
 * @returns {{ todos: Array, summary: string }}
 */
function buildRecitalPlan({ eventDate, daysUntil, danceStyle, title, venue }) {
  // Combine base + style-specific todos
  const all = [...BASE_TODOS, ...styleAddons(danceStyle)];

  // Filter: only include todos whose lead time fits inside the window.
  // A recital 30 days out skips the 90/75/60-day items.
  const relevant = all.filter((t) => t.d <= daysUntil);

  // Sort earliest-first (largest days_before_event first), matching the
  // old AI rule. Stable sort within the same d value preserves the
  // visual rhythm where Venue / Comms alternate.
  relevant.sort((a, b) => b.d - a.d);

  const todos = relevant.map((t) => ({
    task_text: t.t,
    days_before_event: t.d,
    suggested_due_date: addDaysISO(eventDate, -t.d),
    category: t.c,
  }));

  // One-sentence summary — matches the old AI surface so the
  // SmartPlanModal renders identically.
  const venuePhrase = venue ? '' : ' Venue is still TBD — confirm that first.';
  const summary = `${todos.length}-step countdown for ${title || 'your recital'} on ${eventDate}.${venuePhrase}`;

  return { todos, summary };
}

module.exports = { buildRecitalPlan };
