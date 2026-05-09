// Quick diagnostic — run with: node test-schedules.js
require('dotenv').config();
const pool = require('./config/db');

async function main() {
  const [schools] = await pool.query('SELECT id, name FROM schools WHERE is_active = 1 LIMIT 10');
  console.log('\n── Schools ──────────────────────────');
  schools.forEach(s => console.log(`  id=${s.id}  ${s.name}`));

  console.log('\n── Schedules (with batch JOIN) ──────');
  const [schedules] = await pool.query(`
    SELECT sc.id, sc.school_id, sc.batch_id, sc.day_of_week, sc.start_time, sc.end_time,
           b.name as batch_name
    FROM schedules sc
    LEFT JOIN batches b ON b.id = sc.batch_id
    ORDER BY sc.school_id, sc.id
    LIMIT 40
  `);

  if (!schedules.length) {
    console.log('  ⚠  NO SCHEDULES FOUND IN DB');
  } else {
    schedules.forEach(s =>
      console.log(`  school=${s.school_id} | sched_id=${s.id} | batch_id=${s.batch_id} | day=${s.day_of_week} | ${s.start_time}-${s.end_time} | batch_name="${s.batch_name}"`)
    );
  }

  console.log('\n── Batches ──────────────────────────');
  const [batches] = await pool.query('SELECT id, school_id, name FROM batches ORDER BY school_id, id LIMIT 40');
  batches.forEach(b => console.log(`  school=${b.school_id} | batch_id=${b.id} | name="${b.name}"`));

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
