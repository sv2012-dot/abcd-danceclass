// Tests the exact API call the Dashboard makes
// run: node test-api.js
const http = require('http');

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: 'localhost', port: 5000,
      path: `/api${path}`, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => resolve(JSON.parse(raw)));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function get(path, token) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost', port: 5000,
      path: `/api${path}`, method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => resolve(JSON.parse(raw)));
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  // Log in as Swapna (FlyingSwan) — try a few known emails
  const emails = [
    { email: 'swapna@flyingswan.com', pass: 'password' },
    { email: 'swapnavarma@gmail.com', pass: 'password' },
  ];

  // Try superadmin first to get school list and find the right user
  console.log('\n── Testing as superadmin ─────────────');
  const sa = await post('/auth/login', { email: 'admin@studioflow.app', password: 'Admin123!' });
  if (!sa.token) { console.log('Superadmin login failed:', sa); }
  else {
    console.log('Superadmin OK, token obtained');
    const schools = await get('/schools', sa.token);
    console.log('Schools with admin emails:');
    schools.forEach(s => console.log(`  id=${s.id} | ${s.name} | admin: ${s.admin_email}`));

    // Test schedules for each school
    for (const s of schools) {
      const scheds = await get(`/schools/${s.id}/schedules`, sa.token);
      const batches = await get(`/schools/${s.id}/batches`, sa.token);
      console.log(`\n school_id=${s.id} (${s.name}): ${scheds.length} schedules, ${batches.length} batches`);
      scheds.slice(0, 3).forEach(sc =>
        console.log(`   sched ${sc.id}: day=${sc.day_of_week} batch_name="${sc.batch_name}" batch_id=${sc.batch_id}`)
      );
    }
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });
