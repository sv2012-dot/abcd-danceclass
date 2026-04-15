const pool = require('../../config/db');

// mysql2 with timezone:'+00:00' converts DATETIME → Date objects marked as UTC,
// which adds a timezone offset on JSON serialization.
// We extract the stored wall-clock value using getUTC* so the frontend receives
// a plain ISO string (no Z) and treats it as local time.
function fmtDt(d) {
  if (!d) return null;
  if (!(d instanceof Date)) return d;
  const p = n => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth()+1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}
function formatEventDates(rows) {
  return rows.map(e => ({ ...e, start_datetime: fmtDt(e.start_datetime), end_datetime: fmtDt(e.end_datetime) }));
}

// Helper: attach batches array to each event row
async function attachBatches(events) {
  if (!events.length) return events;
  const ids = events.map(e => e.id);
  const [brows] = await pool.query(`
    SELECT eb.event_id, b.id, b.name
    FROM event_batches eb
    JOIN batches b ON b.id = eb.batch_id
    WHERE eb.event_id IN (?)
    ORDER BY b.name
  `, [ids]);
  const map = {};
  brows.forEach(r => {
    if (!map[r.event_id]) map[r.event_id] = [];
    map[r.event_id].push({ id: r.id, name: r.name });
  });
  return events.map(e => ({
    ...e,
    batches: map[e.id] || [],
    // keep legacy batch_name for backwards compat
    batch_name: (map[e.id] && map[e.id][0]?.name) || e.batch_name || null,
  }));
}

// Helper: sync event_batches rows for an event
async function syncBatches(conn, eventId, batchIds) {
  await conn.query('DELETE FROM event_batches WHERE event_id = ?', [eventId]);
  if (batchIds && batchIds.length) {
    const rows = batchIds.map(bid => [eventId, bid]);
    await conn.query('INSERT INTO event_batches (event_id, batch_id) VALUES ?', [rows]);
  }
}

// List events for a date range
exports.list = async (req, res) => {
  const schoolId = req.params.schoolId;
  const { from, to } = req.query;
  try {
    let q = `SELECT e.* FROM events e WHERE e.school_id = ?`;
    const params = [schoolId];
    if (from) { q += ' AND e.start_datetime >= ?'; params.push(from); }
    if (to)   { q += ' AND e.start_datetime <= ?'; params.push(to); }
    q += ' ORDER BY e.start_datetime ASC';
    const [rows] = await pool.query(q, params);
    res.json(await attachBatches(formatEventDates(rows)));
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Create event (with optional weekly/biweekly recurrence expansion)
exports.create = async (req, res) => {
  const schoolId = req.params.schoolId;
  const { title, type, batch_ids, batch_id, start_datetime, end_datetime, location,
          requires_studio, studio_booked, recurrence, recurrence_end, color, notes } = req.body;

  // Accept either batch_ids (array) or legacy batch_id (single)
  const batchIds = batch_ids?.length ? batch_ids : (batch_id ? [batch_id] : []);

  if (!title || !start_datetime || !end_datetime)
    return res.status(400).json({ error: 'title, start_datetime, end_datetime required' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const insertOne = async (start, end) => {
      const [r] = await conn.query(`
        INSERT INTO events (school_id,title,type,batch_id,start_datetime,end_datetime,
          location,requires_studio,studio_booked,recurrence,recurrence_end,color,notes)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
      `, [schoolId, title, type||'Class', batchIds[0]||null, start, end,
          location||null, requires_studio?1:0, studio_booked?1:0,
          recurrence||'none', recurrence_end||null, color||null, notes||null]);
      await syncBatches(conn, r.insertId, batchIds);
      return r.insertId;
    };

    const ids = [];
    if (recurrence === 'none' || !recurrence || !recurrence_end) {
      ids.push(await insertOne(start_datetime, end_datetime));
    } else {
      // Parse the wall-clock string directly (no Date conversion to avoid UTC shift)
      const [datePart, timePart] = start_datetime.split('T');
      const [eDatePart, eTimePart] = end_datetime.split('T');
      const interval = recurrence === 'weekly' ? 7 : 14;
      // Advance date portion day-by-day without timezone conversion
      const addDays = (dateStr, days) => {
        const d = new Date(dateStr + 'T00:00:00Z'); // parse as UTC date-only
        d.setUTCDate(d.getUTCDate() + days);
        const p = n => String(n).padStart(2,'0');
        return `${d.getUTCFullYear()}-${p(d.getUTCMonth()+1)}-${p(d.getUTCDate())}`;
      };
      const endDate = new Date(recurrence_end + 'T23:59:59Z');
      let curDate  = datePart;
      let curEDate = eDatePart;
      while (new Date(curDate + 'T00:00:00Z') <= endDate) {
        ids.push(await insertOne(
          `${curDate} ${timePart  || '00:00:00'}`.replace('T',' '),
          `${curEDate} ${eTimePart || '00:00:00'}`.replace('T',' ')
        ));
        curDate  = addDays(curDate,  interval);
        curEDate = addDays(curEDate, interval);
      }
    }

    await conn.commit();
    const [rows] = await pool.query('SELECT e.* FROM events e WHERE e.id IN (?) ORDER BY e.start_datetime', [ids]);
    res.status(201).json(await attachBatches(formatEventDates(rows)));
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally { conn.release(); }
};

exports.update = async (req, res) => {
  const { title, type, batch_ids, batch_id, start_datetime, end_datetime,
          location, requires_studio, studio_booked, color, notes } = req.body;
  const batchIds = batch_ids?.length ? batch_ids : (batch_id ? [batch_id] : []);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(`
      UPDATE events SET title=?,type=?,batch_id=?,start_datetime=?,end_datetime=?,
        location=?,requires_studio=?,studio_booked=?,color=?,notes=?
      WHERE id=? AND school_id=?
    `, [title, type||'Class', batchIds[0]||null, start_datetime, end_datetime,
        location||null, requires_studio?1:0, studio_booked?1:0,
        color||null, notes||null, req.params.id, req.params.schoolId]);
    await syncBatches(conn, req.params.id, batchIds);
    await conn.commit();
    const [rows] = await pool.query('SELECT e.* FROM events e WHERE e.id = ?', [req.params.id]);
    const withBatches = await attachBatches(formatEventDates(rows));
    res.json(withBatches[0]);
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally { conn.release(); }
};

exports.remove = async (req, res) => {
  try {
    await pool.query('DELETE FROM events WHERE id = ? AND school_id = ?', [req.params.id, req.params.schoolId]);
    res.json({ message: 'Event deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.studioRequired = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT e.* FROM events e
      WHERE e.school_id = ? AND e.requires_studio = 1
      ORDER BY e.start_datetime ASC
    `, [req.params.schoolId]);
    res.json(await attachBatches(formatEventDates(rows)));
  } catch (err) { res.status(500).json({ error: err.message }); }
};
