/**
 * Create / update a test user for /ops/signin testing.
 *
 * Run from the backend dir against whichever DB your .env points at
 * (typically prod Railway for testing on Vercel preview URLs):
 *
 *   cd studioflow/backend
 *   node scripts/create-test-user.js
 *
 * Optional CLI args (override the defaults below):
 *   --email=<email>     default: tester@manchq.dev
 *   --password=<pw>     default: PrevTest2026!
 *   --role=<role>       default: school_admin   (one of: superadmin, school_admin, teacher, parent)
 *   --school-id=<id>    default: first school in DB
 *   --name=<full name>  default: Preview Tester
 *
 * Behavior:
 *   - If a user with that email already exists, the password / role /
 *     school_id are UPDATED (so re-running rotates the password).
 *   - If not, a new user is INSERTED.
 *   - Password is hashed with bcrypt (cost 12, same as setup.js).
 *
 * Notes:
 *   - This creates a real row in the connected DB. If you run it
 *     against the prod Railway DB, the test user can sign in to prod
 *     too via /ops/signin. Delete it (or rotate the password) when
 *     you're not actively testing.
 *   - The seed setup.js also creates a 'admin@studioflow.app /
 *     Admin123!' superadmin row but only when run against a fresh
 *     local DB — that path doesn't help on Railway. This script does.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

// ── parse simple CLI args ─────────────────────────────────────────
function arg(name, fallback) {
  const m = process.argv.find(a => a.startsWith(`--${name}=`));
  return m ? m.slice(name.length + 3) : fallback;
}

const EMAIL     = arg('email',     'tester@manchq.dev');
const PASSWORD  = arg('password',  'PrevTest2026!');
const ROLE      = arg('role',      'school_admin');
const NAME      = arg('name',      'Preview Tester');
const SCHOOL_ID = arg('school-id', null);

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'studioflow',
  });

  try {
    // Resolve school_id — explicit arg wins, otherwise first school in DB.
    let schoolId = SCHOOL_ID ? Number(SCHOOL_ID) : null;
    if (!schoolId && ROLE !== 'superadmin') {
      const [rows] = await conn.query('SELECT id, name FROM schools ORDER BY id ASC LIMIT 1');
      if (rows.length === 0) {
        throw new Error('No schools found in DB — pass --school-id=<id> or create a school first.');
      }
      schoolId = rows[0].id;
      console.log(`  Using school_id=${schoolId} (${rows[0].name})`);
    }

    const hash = bcrypt.hashSync(PASSWORD, 12);

    // INSERT ... ON DUPLICATE KEY UPDATE — re-runnable.
    // (Assumes users.email has a UNIQUE constraint; the seed schema
    //  declares it UNIQUE.)
    await conn.query(
      `INSERT INTO users (name, email, password, role, school_id)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         name       = VALUES(name),
         password   = VALUES(password),
         role       = VALUES(role),
         school_id  = VALUES(school_id)`,
      [NAME, EMAIL, hash, ROLE, ROLE === 'superadmin' ? null : schoolId]
    );

    console.log('\n✓ Test user ready\n');
    console.log('  email     :', EMAIL);
    console.log('  password  :', PASSWORD);
    console.log('  role      :', ROLE);
    console.log('  school_id :', ROLE === 'superadmin' ? '(none — superadmin)' : schoolId);
    console.log('\n  Sign in at: <your-url>/ops/signin\n');
  } catch (err) {
    console.error('✗ Failed:', err.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
})();
