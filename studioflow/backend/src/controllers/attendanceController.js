/**
 * Attendance controller — per-student presence for class instances and events.
 *
 * Each row identifies "WHO was at WHAT class instance":
 *   (school_id, student_id, class_date, event_id OR schedule_id)
 *
 * Statuses: present | absent | excused | late
 */

const { pool } = require('../database');

// ── helpers ─────────────────────────────────────────────────────────────────
const VALID_STATUS = ['present', 'absent', 'excused', 'late'];

function parseDate(d) {
  if (!d) return null;
  // Accept YYYY-MM-DD; reject anything else to keep the unique key behaving
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d));
  return m ? m[0] : null;
}

// Resolve the students that belong to a batch (used to seed the attendance form)
async function getStudentsForBatch(schoolId, batchId) {
  const [rows] = await pool.query(
    `SELECT s.id, s.name, s.avatar
       FROM students s
       JOIN batch_students bs ON bs.student_id = s.id
      WHERE bs.batch_id = ? AND s.school_id = ? AND s.is_active = 1
      ORDER BY s.name`,
    [batchId, schoolId]
  );
  return rows;
}

// ── POST /api/schools/:schoolId/attendance/events/:eventId/bulk ─────────────
// body: { class_date: "YYYY-MM-DD", entries: [{student_id, status, notes?}] }
exports.bulkSaveEvent = async (req, res) => {
  try {
    const schoolId = Number(req.params.schoolId);
    const eventId = Number(req.params.eventId);
    const { class_date, entries } = req.body || {};
    const date = parseDate(class_date);
    if (!date) return res.status(400).json({ error: 'class_date (YYYY-MM-DD) required' });
    if (!Array.isArray(entries)) return res.status(400).json({ error: 'entries array required' });

    // Verify the event belongs to the school
    const [ev] = await pool.query('SELECT id FROM events WHERE id = ? AND school_id = ?', [eventId, schoolId]);
    if (!ev[0]) return res.status(404).json({ error: 'event not found' });

    const markedBy = req.user?.id || null;
    let saved = 0;
    for (const e of entries) {
      if (!e?.student_id || !VALID_STATUS.includes(e.status)) continue;
      await pool.query(
        `INSERT INTO attendance (school_id, student_id, event_id, class_date, status, notes, marked_by_user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE status = VALUES(status), notes = VALUES(notes),
                                 marked_by_user_id = VALUES(marked_by_user_id),
                                 updated_at = CURRENT_TIMESTAMP`,
        [schoolId, e.student_id, eventId, date, e.status, e.notes || null, markedBy]
      );
      saved++;
    }
    res.json({ saved, class_date: date });
  } catch (err) {
    console.error('[attendance] bulkSaveEvent', err);
    res.status(500).json({ error: 'Failed to save attendance' });
  }
};

// ── POST /api/schools/:schoolId/attendance/schedule/:scheduleId/bulk ─────────
// body: { class_date: "YYYY-MM-DD", entries: [{student_id, status, notes?}] }
exports.bulkSaveSchedule = async (req, res) => {
  try {
    const schoolId = Number(req.params.schoolId);
    const scheduleId = Number(req.params.scheduleId);
    const { class_date, entries } = req.body || {};
    const date = parseDate(class_date);
    if (!date) return res.status(400).json({ error: 'class_date (YYYY-MM-DD) required' });
    if (!Array.isArray(entries)) return res.status(400).json({ error: 'entries array required' });

    // Verify schedule belongs to the school
    const [sch] = await pool.query('SELECT id FROM schedules WHERE id = ? AND school_id = ?', [scheduleId, schoolId]);
    if (!sch[0]) return res.status(404).json({ error: 'schedule not found' });

    const markedBy = req.user?.id || null;
    let saved = 0;
    for (const e of entries) {
      if (!e?.student_id || !VALID_STATUS.includes(e.status)) continue;
      await pool.query(
        `INSERT INTO attendance (school_id, student_id, schedule_id, class_date, status, notes, marked_by_user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE status = VALUES(status), notes = VALUES(notes),
                                 marked_by_user_id = VALUES(marked_by_user_id),
                                 updated_at = CURRENT_TIMESTAMP`,
        [schoolId, e.student_id, scheduleId, date, e.status, e.notes || null, markedBy]
      );
      saved++;
    }
    res.json({ saved, class_date: date });
  } catch (err) {
    console.error('[attendance] bulkSaveSchedule', err);
    res.status(500).json({ error: 'Failed to save attendance' });
  }
};

// ── GET /api/schools/:schoolId/attendance/events/:eventId ───────────────────
// Returns { students: [...], attendance: { studentId: {status, notes} } }
// `students` is the roster (all students in any linked batch). Frontend uses
// roster as the canonical list and overlays attendance map.
exports.getForEvent = async (req, res) => {
  try {
    const schoolId = Number(req.params.schoolId);
    const eventId = Number(req.params.eventId);
    const classDate = parseDate(req.query.date);
    if (!classDate) return res.status(400).json({ error: 'date (YYYY-MM-DD) required' });

    // Fetch event + its linked batches
    const [ev] = await pool.query('SELECT id, title FROM events WHERE id = ? AND school_id = ?', [eventId, schoolId]);
    if (!ev[0]) return res.status(404).json({ error: 'event not found' });

    // Roster: union of students across all event_batches
    const [students] = await pool.query(
      `SELECT DISTINCT s.id, s.name, s.avatar
         FROM students s
         JOIN batch_students bs ON bs.student_id = s.id
         JOIN event_batches eb  ON eb.batch_id   = bs.batch_id
        WHERE eb.event_id = ? AND s.school_id = ? AND s.is_active = 1
        ORDER BY s.name`,
      [eventId, schoolId]
    );

    // Existing attendance for this date+event
    const [rows] = await pool.query(
      `SELECT student_id, status, notes FROM attendance
        WHERE school_id = ? AND event_id = ? AND class_date = ?`,
      [schoolId, eventId, classDate]
    );
    const attendance = {};
    for (const r of rows) attendance[r.student_id] = { status: r.status, notes: r.notes };

    res.json({ event: ev[0], class_date: classDate, students, attendance });
  } catch (err) {
    console.error('[attendance] getForEvent', err);
    res.status(500).json({ error: 'Failed to load attendance' });
  }
};

// ── GET /api/schools/:schoolId/attendance/schedule/:scheduleId ──────────────
// Same shape as getForEvent but for a recurring class instance
exports.getForSchedule = async (req, res) => {
  try {
    const schoolId = Number(req.params.schoolId);
    const scheduleId = Number(req.params.scheduleId);
    const classDate = parseDate(req.query.date);
    if (!classDate) return res.status(400).json({ error: 'date (YYYY-MM-DD) required' });

    // Get schedule + linked batch
    const [sch] = await pool.query(
      'SELECT id, batch_id FROM schedules WHERE id = ? AND school_id = ?',
      [scheduleId, schoolId]
    );
    if (!sch[0]) return res.status(404).json({ error: 'schedule not found' });

    const students = await getStudentsForBatch(schoolId, sch[0].batch_id);

    const [rows] = await pool.query(
      `SELECT student_id, status, notes FROM attendance
        WHERE school_id = ? AND schedule_id = ? AND class_date = ?`,
      [schoolId, scheduleId, classDate]
    );
    const attendance = {};
    for (const r of rows) attendance[r.student_id] = { status: r.status, notes: r.notes };

    res.json({ schedule: sch[0], class_date: classDate, students, attendance });
  } catch (err) {
    console.error('[attendance] getForSchedule', err);
    res.status(500).json({ error: 'Failed to load attendance' });
  }
};

// ── GET /api/schools/:schoolId/attendance/students/:studentId ───────────────
// ?from=YYYY-MM-DD&to=YYYY-MM-DD — defaults to last 90 days
// Returns { records: [...], stats: { total, present, absent, late, excused, rate } }
exports.getForStudent = async (req, res) => {
  try {
    const schoolId = Number(req.params.schoolId);
    const studentId = Number(req.params.studentId);

    const today = new Date().toISOString().slice(0, 10);
    const from = parseDate(req.query.from) || (() => {
      const d = new Date(); d.setDate(d.getDate() - 90); return d.toISOString().slice(0, 10);
    })();
    const to = parseDate(req.query.to) || today;

    const [records] = await pool.query(
      `SELECT a.id, a.class_date, a.status, a.notes, a.event_id, a.schedule_id,
              e.title AS event_title,
              s.batch_id, b.name AS batch_name
         FROM attendance a
         LEFT JOIN events    e ON e.id = a.event_id
         LEFT JOIN schedules s ON s.id = a.schedule_id
         LEFT JOIN batches   b ON b.id = s.batch_id
        WHERE a.school_id = ? AND a.student_id = ?
          AND a.class_date BETWEEN ? AND ?
        ORDER BY a.class_date DESC`,
      [schoolId, studentId, from, to]
    );

    const present = records.filter(r => r.status === 'present').length;
    const late = records.filter(r => r.status === 'late').length;
    const absent = records.filter(r => r.status === 'absent').length;
    const excused = records.filter(r => r.status === 'excused').length;
    const total = records.length;
    // "Attended" = present + late (showed up but tardy)
    const rate = total > 0 ? Math.round(((present + late) / total) * 100) : null;

    res.json({
      records,
      stats: { total, present, late, absent, excused, rate },
      range: { from, to },
    });
  } catch (err) {
    console.error('[attendance] getForStudent', err);
    res.status(500).json({ error: 'Failed to load student attendance' });
  }
};

// ── GET /api/schools/:schoolId/attendance/batches/:batchId/stats ────────────
// ?from=&to= — defaults to last 30 days
// Returns per-student attendance rate within the date range
exports.getBatchStats = async (req, res) => {
  try {
    const schoolId = Number(req.params.schoolId);
    const batchId = Number(req.params.batchId);

    const today = new Date().toISOString().slice(0, 10);
    const from = parseDate(req.query.from) || (() => {
      const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10);
    })();
    const to = parseDate(req.query.to) || today;

    // Get all students in batch
    const students = await getStudentsForBatch(schoolId, batchId);

    // For each, count attendance in the range
    // (Done in one query for efficiency)
    const [rows] = await pool.query(
      `SELECT a.student_id,
              SUM(a.status = 'present') AS present,
              SUM(a.status = 'late')    AS late,
              SUM(a.status = 'absent')  AS absent,
              SUM(a.status = 'excused') AS excused,
              COUNT(*)                  AS total,
              GROUP_CONCAT(a.class_date ORDER BY a.class_date) AS dates,
              GROUP_CONCAT(a.status     ORDER BY a.class_date) AS statuses
         FROM attendance a
         JOIN batch_students bs ON bs.student_id = a.student_id
        WHERE bs.batch_id = ? AND a.school_id = ?
          AND a.class_date BETWEEN ? AND ?
        GROUP BY a.student_id`,
      [batchId, schoolId, from, to]
    );

    const byStudent = {};
    for (const r of rows) {
      const attended = Number(r.present) + Number(r.late);
      const total = Number(r.total);
      byStudent[r.student_id] = {
        present: Number(r.present),
        late: Number(r.late),
        absent: Number(r.absent),
        excused: Number(r.excused),
        total,
        rate: total > 0 ? Math.round((attended / total) * 100) : null,
        dates: r.dates ? r.dates.split(',') : [],
        statuses: r.statuses ? r.statuses.split(',') : [],
      };
    }

    res.json({
      students,
      byStudent,
      range: { from, to },
    });
  } catch (err) {
    console.error('[attendance] getBatchStats', err);
    res.status(500).json({ error: 'Failed to load batch attendance' });
  }
};
