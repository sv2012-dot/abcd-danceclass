// ── Smart ManchQ routes ───────────────────────────────────────────────────
// Three endpoints powered by Anthropic Claude Haiku:
//   POST /api/smart/parse-events        — natural-language → event array
//   POST /api/smart/generate-recital-plan — recital → ordered todo list
//   POST /api/smart/draft-message       — context → ready-to-send message
//
// All endpoints:
//   - require a valid JWT (auth())
//   - share a 30-call/24h rate limit per school (smartRateLimit)
//   - return JSON; never throw raw errors at the client
//   - log basic usage to stdout for now (can move to ai_usage_log table later)

const router = require('express').Router();
const { auth } = require('../middleware/auth');
const smartRateLimit = require('../middleware/smartRateLimit');
const pool = require('../../config/db');
const { runJson, runText } = require('../lib/anthropic');

// Apply auth + rate limit to ALL smart routes
router.use(auth());
router.use(smartRateLimit);

function logSmart(req, action, ok, extra = {}) {
  const sid = req.user?.school_id;
  const uid = req.user?.id;
  const meta = JSON.stringify({ school: sid, user: uid, ...extra });
  console.log(`[smart] ${action} ${ok ? 'ok' : 'fail'} ${meta}`);
}

// ── 1. Smart Add — parse natural-language event input ─────────────────────
router.post('/parse-events', async (req, res) => {
  try {
    const { text } = req.body || {};
    if (!text || !text.trim()) return res.status(400).json({ error: 'text required' });
    if (text.length > 2000) return res.status(400).json({ error: 'text too long (max 2000 chars)' });

    const sid = req.user.school_id;
    if (!sid) return res.status(403).json({ error: 'school context required' });

    // Fetch existing batches so the model can match by name/abbreviation
    const [batches] = await pool.query(
      'SELECT id, name FROM batches WHERE school_id = ? ORDER BY name',
      [sid]
    );

    const today = new Date().toISOString().slice(0, 10);
    const batchList = batches.map((b) => `${b.id}: ${b.name}`).join('\n') || '(none yet)';

    const system = `You parse natural-language descriptions of dance class schedules into structured event data.
Return ONLY valid JSON. No prose, no markdown, no code fences.

OUTPUT SCHEMA:
{
  "events": [
    {
      "date": "YYYY-MM-DD",
      "time": "HH:MM" | null,
      "duration_min": 60,
      "batch_id": number | null,
      "proposed_batch_name": string | null,
      "type": "Class" | "Recital" | "Rehearsal" | "Workshop" | "Other",
      "confidence": "high" | "medium" | "low",
      "warning": string | null,
      "source": string
    }
  ],
  "year_assumed": number,
  "warnings": [string]
}

RULES:
- If a date has no year, assume the next future occurrence (today is provided).
- Bare day numbers inherit the most recently mentioned month.
- Match batch names case-insensitively, allowing common abbreviations (Beg→Beginner, Adv→Advanced, Int→Intermediate).
- If multiple batch matches, pick longest common prefix; set confidence "medium".
- If no batch match, set batch_id null and proposed_batch_name to the user's text verbatim.
- Default duration 60 minutes if not stated. Default time null if not stated.
- Default type "Class" unless words like "recital", "rehearsal", "workshop" appear.
- Repeating dates (e.g. "May 21, 21") become two events with warning "duplicate" on the second.
- "source" = the verbatim slice of input that produced this event.`;

    const user = `TODAY: ${today}
SCHOOL_ID: ${sid}
EXISTING BATCHES:
${batchList}

USER INPUT:
"""
${text}
"""

Return JSON only.`;

    const { data, usage, latencyMs } = await runJson({ system, user });
    logSmart(req, 'parse-events', true, { events: data.events?.length, ms: latencyMs, in: usage.input_tokens, out: usage.output_tokens });
    res.json(data);
  } catch (err) {
    logSmart(req, 'parse-events', false, { msg: err.message });
    if (err.raw) console.error('[smart] raw output:', err.raw);
    res.status(500).json({ error: 'Smart Add failed', detail: err.message });
  }
});

// ── 2. Smart Plan — generate recital countdown todos ─────────────────────
router.post('/generate-recital-plan', async (req, res) => {
  try {
    const { recital_id } = req.body || {};
    if (!recital_id) return res.status(400).json({ error: 'recital_id required' });

    const sid = req.user.school_id;
    if (!sid) return res.status(403).json({ error: 'school context required' });

    const [recitals] = await pool.query(
      `SELECT r.id, r.title, r.event_date, r.event_time, r.venue, r.description,
              s.name AS school_name, s.dance_style AS school_dance_style
         FROM recitals r
         JOIN schools s ON s.id = r.school_id
        WHERE r.id = ? AND r.school_id = ? LIMIT 1`,
      [recital_id, sid]
    );
    if (!recitals[0]) return res.status(404).json({ error: 'Recital not found' });
    const r = recitals[0];

    const [[participantStats]] = await pool.query(
      'SELECT COUNT(*) AS n FROM recital_participants WHERE recital_id = ?',
      [recital_id]
    );

    const today = new Date();
    const eventDate = new Date(String(r.event_date).slice(0, 10));
    const daysUntil = Math.ceil((eventDate - today) / (1000 * 60 * 60 * 24));
    if (daysUntil < 0) return res.status(400).json({ error: 'Recital is in the past' });

    const system = `You generate practical recital production checklists for dance schools.
Return ONLY valid JSON. No prose, no markdown.

OUTPUT SCHEMA:
{
  "todos": [
    {
      "task_text": "Short imperative — what to do",
      "days_before_event": number,
      "suggested_due_date": "YYYY-MM-DD",
      "category": "Venue" | "Costumes" | "Music" | "Communications" | "Rehearsal" | "Tech" | "Day-of" | "Other"
    }
  ],
  "summary": "One short sentence summary"
}

RULES:
- Order todos earliest-first (largest days_before_event first).
- Cover the realistic span: venue/save-the-date/costumes/rehearsals/tech/RSVP/communications/day-of.
- 8-15 todos total. Each task_text under 80 chars, action verb first.
- days_before_event must be ≥ 0 and ≤ daysUntil. Don't generate todos for dates before today.
- suggested_due_date = eventDate - days_before_event (calculate it).
- Tailor a few items to the school's dance style if mentioned.`;

    const user = `RECITAL:
  Title: ${r.title}
  School: ${r.school_name}
  Dance style: ${r.school_dance_style || 'not specified'}
  Event date: ${String(r.event_date).slice(0, 10)} (${daysUntil} days from today)
  Venue: ${r.venue || 'not yet booked'}
  Time: ${r.event_time || 'TBD'}
  Description: ${r.description || '(none)'}
  Participants so far: ${participantStats.n}

TODAY: ${today.toISOString().slice(0, 10)}
DAYS UNTIL EVENT: ${daysUntil}

Generate a tailored countdown plan. JSON only.`;

    const { data, usage, latencyMs } = await runJson({ system, user });
    logSmart(req, 'generate-recital-plan', true, { recital: recital_id, todos: data.todos?.length, ms: latencyMs, in: usage.input_tokens, out: usage.output_tokens });
    res.json(data);
  } catch (err) {
    logSmart(req, 'generate-recital-plan', false, { msg: err.message });
    if (err.raw) console.error('[smart] raw output:', err.raw);
    res.status(500).json({ error: 'Smart Plan failed', detail: err.message });
  }
});

// ── 3. Smart Reply — draft a message about an event/recital/batch/student ─
router.post('/draft-message', async (req, res) => {
  try {
    const { context, context_id, purpose, tone, custom } = req.body || {};
    if (!context || !context_id || !purpose) {
      return res.status(400).json({ error: 'context, context_id, purpose required' });
    }
    const validContexts = ['event', 'recital', 'batch', 'student'];
    if (!validContexts.includes(context)) return res.status(400).json({ error: 'invalid context' });

    const validTones = ['friendly', 'formal', 'apologetic'];
    const finalTone = validTones.includes(tone) ? tone : 'friendly';

    const sid = req.user.school_id;
    if (!sid) return res.status(403).json({ error: 'school context required' });

    let contextDetails = '';
    if (context === 'event') {
      const [rows] = await pool.query(
        `SELECT title, type, start_datetime, end_datetime, location, notes
           FROM events WHERE id = ? AND school_id = ? LIMIT 1`,
        [context_id, sid]
      );
      if (!rows[0]) return res.status(404).json({ error: 'event not found' });
      const e = rows[0];
      contextDetails = `EVENT: ${e.title}
Type: ${e.type}
When: ${e.start_datetime}${e.end_datetime ? ` to ${e.end_datetime}` : ''}
Location: ${e.location || 'TBD'}
Notes: ${e.notes || '(none)'}`;
    } else if (context === 'recital') {
      const [rows] = await pool.query(
        `SELECT title, event_date, event_time, venue, description
           FROM recitals WHERE id = ? AND school_id = ? LIMIT 1`,
        [context_id, sid]
      );
      if (!rows[0]) return res.status(404).json({ error: 'recital not found' });
      const r = rows[0];
      contextDetails = `RECITAL: ${r.title}
Date: ${String(r.event_date).slice(0, 10)}${r.event_time ? ` at ${r.event_time}` : ''}
Venue: ${r.venue || 'TBD'}
Description: ${r.description || '(none)'}`;
    } else if (context === 'batch') {
      const [rows] = await pool.query(
        `SELECT name, level, dance_style FROM batches WHERE id = ? AND school_id = ? LIMIT 1`,
        [context_id, sid]
      );
      if (!rows[0]) return res.status(404).json({ error: 'batch not found' });
      const b = rows[0];
      contextDetails = `BATCH: ${b.name}
Level: ${b.level || 'not specified'}
Style: ${b.dance_style || 'not specified'}`;
    } else if (context === 'student') {
      const [rows] = await pool.query(
        `SELECT name, guardian_name FROM students WHERE id = ? AND school_id = ? LIMIT 1`,
        [context_id, sid]
      );
      if (!rows[0]) return res.status(404).json({ error: 'student not found' });
      const s = rows[0];
      contextDetails = `STUDENT: ${s.name}
Guardian: ${s.guardian_name || '(unknown)'}`;
    }

    const [schools] = await pool.query('SELECT name FROM schools WHERE id = ? LIMIT 1', [sid]);
    const schoolName = schools[0]?.name || 'the dance school';

    const toneGuide = {
      friendly: 'Warm, conversational, contractions OK, one casual emoji acceptable at the end.',
      formal: 'Professional, polite, no contractions, no emojis, sign off respectfully.',
      apologetic: 'Sincere acknowledgement of the inconvenience first, brief explanation, clear next step. Empathetic. Optional 🙏 or 💜 at end.',
    }[finalTone];

    const system = `You draft short messages from a dance school admin to parents.
The message will be sent via WhatsApp or email. Keep it under 80 words.
Return ONLY the message text. No greeting like "here is your message", no quotes around it, no markdown.

TONE: ${finalTone}
TONE GUIDANCE: ${toneGuide}
DO: be specific (date, time, location). Sign off with the school name.
DON'T: invent details not in the context. Don't add emojis to formal tone.`;

    const user = `${contextDetails}

SCHOOL NAME: ${schoolName}
PURPOSE: ${purpose}
${custom ? `\nADDITIONAL NOTES FROM ADMIN:\n${custom}` : ''}

Draft the message.`;

    const { text, usage, latencyMs } = await runText({ system, user, maxTokens: 600 });
    logSmart(req, 'draft-message', true, { context, ms: latencyMs, in: usage.input_tokens, out: usage.output_tokens });

    res.json({
      message: text,
      char_count: text.length,
      suggested_send: contextDetails.includes('Email') ? 'email' : 'whatsapp',
      tone: finalTone,
    });
  } catch (err) {
    logSmart(req, 'draft-message', false, { msg: err.message });
    res.status(500).json({ error: 'Smart Reply failed', detail: err.message });
  }
});

module.exports = router;
