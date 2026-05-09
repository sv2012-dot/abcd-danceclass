require('dotenv').config();
const pool = require('./config/db');

async function main() {
  // Check events for all schools
  const [events] = await pool.query(`
    SELECT e.id, e.school_id, e.title, e.type, e.start_datetime,
           GROUP_CONCAT(eb.batch_id) as batch_ids
    FROM events e
    LEFT JOIN event_batches eb ON eb.event_id = e.id
    WHERE e.start_datetime >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    GROUP BY e.id
    ORDER BY e.school_id, e.start_datetime
    LIMIT 50
  `);

  console.log('\n── Upcoming events (with batch associations) ──');
  if (!events.length) { console.log('  No events found'); }
  else {
    events.forEach(e =>
      console.log(`  school=${e.school_id} | id=${e.id} | "${e.title}" | ${String(e.start_datetime).slice(0,16)} | batch_ids=${e.batch_ids || 'none'}`)
    );
  }

  // Also check the exact API response shape for schedules
  const [schedules] = await pool.query(`
    SELECT sc.id, sc.school_id, sc.batch_id, sc.day_of_week, sc.start_time, sc.end_time,
           b.name as batch_name
    FROM schedules sc
    LEFT JOIN batches b ON b.id = sc.batch_id
    WHERE sc.school_id = 6
  `);
  console.log('\n── FlyingSwan schedules (raw API response shape) ──');
  console.log(JSON.stringify(schedules, null, 2));

  process.exit(0);
}
main().catch(e => { console.error(e.message); process.exit(1); });
