/**
 * Create / update a test user for /ops/signin testing.
 *
 * Run from the backend dir against whichever DB your .env points at
 * (typically prod Railway for testing on Vercel preview URLs):
 *
 *   cd studioflow/backend
 *
 *   # First, list available schools to pick one:
 *   node scripts/create-test-user.js --list-schools
 *
 *   # Then create the user attached to a specific school:
 *   node scripts/create-test-user.js --school-id=3
 *     # or
 *   node scripts/create-test-user.js --school-name="Crazzy4 Dance House"
 *
 * Optional CLI args:
 *   --email=<email>             default: tester@manchq.dev
 *   --password=<pw>             default: PrevTest2026!
 *   --role=<role>               default: school_admin
 *                                (superadmin | school_admin | teacher | parent)
 *   --school-id=<id>            REQUIRED for non-superadmin roles, unless
 *                                --school-name is given. No auto-pick.
 *   --school-name=<name>        Alternative to --school-id; case-insensitive
 *                                exact match against schools.name.
 *   --name=<full name>          default: Preview Tester
 *   --list-schools              Print schools + exit. Does not create user.
 *
 * Behavior:
 *   - If a user with that email already exists, the password / role /
 *     school_id are UPDATED (so re-running rotates the password).
 *   - If not, a new user is INSERTED.
 *   - Password is hashed with bcrypt (cost 12, same as setup.js).
 *   - For non-superadmin roles, a school must be explicitly specified.
 *     The script refuses to auto-pick a "random" school.
 *
 * Notes:
 *   - This creates a real row in the connected DB. If you run it
 *     against the prod Railway DB, the test user can sign in to prod
 *     too via /ops/signin. Delete it (or rotate the password) when
 *     you're not actively testing:
 *       DELETE FROM users WHERE email = 'tester@manchq.dev';
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

// ── parse simple CLI args ─────────────────────────────────────────
function flag(name) {
  return process.argv.includes(`--${name}`);
}
function arg(name, fallback) {
  const m = process.argv.find(a => a.startsWith(`--${name}=`));
  return m ? m.slice(name.length + 3) : fallback;
}

const LIST_ONLY  = flag('list-schools');
const EMAIL      = arg('email',       'tester@manchq.dev');
const PASSWORD   = arg('password',    'PrevTest2026!');
const ROLE       = arg('role',        'school_admin');
const NAME       = arg('name',        'Preview Tester');
const SCHOOL_ID  = arg('school-id',   null);
const SCHOOL_NM  = arg('school-name', null);

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'studioflow',
  });

  try {
    // ── --list-schools mode: print and exit ─────────────────────
    if (LIST_ONLY) {
      const [rows] = await conn.query('SELECT id, name, city FROM schools ORDER BY id ASC');
      if (rows.length === 0) {
        console.log('\nNo schools found in this DB.\n');
      } else {
        console.log('\nSchools in this DB:\n');
        for (const r of rows) {
          const city = r.city ? `  (${r.city})` : '';
          console.log(`  ${String(r.id).padStart(3)}  ${r.name}${city}`);
        }
        console.log('\nRun again with --school-id=<id> or --school-name=<exact name>.\n');
      }
      return;
    }

    // ── Resolve school id ──────────────────────────────────────
    let schoolId = null;
    if (ROLE === 'superadmin') {
      // superadmin has no school. Anything passed is ignored.
      if (SCHOOL_ID || SCHOOL_NM) {
        console.log('  Note: superadmin role ignores --school-id / --school-name.');
      }
    } else if (SCHOOL_ID) {
      // Verify the id exists so we don't create a dangling user.
      const [rows] = await conn.query('SELECT id, name FROM schools WHERE id = ? LIMIT 1', [Number(SCHOOL_ID)]);
      if (rows.length === 0) {
        throw new Error(`No school with id=${SCHOOL_ID}. Run with --list-schools to see options.`);
      }
      schoolId = rows[0].id;
      console.log(`  Using school: ${rows[0].name} (id=${schoolId})`);
    } else if (SCHOOL_NM) {
      // Case-insensitive exact match against schools.name.
      const [rows] = await conn.query(
        'SELECT id, name FROM schools WHERE LOWER(name) = LOWER(?) LIMIT 1',
        [SCHOOL_NM]
      );
      if (rows.length === 0) {
        throw new Error(`No school named "${SCHOOL_NM}". Run with --list-schools to see options.`);
      }
      schoolId = rows[0].id;
      console.log(`  Using school: ${rows[0].name} (id=${schoolId})`);
    } else {
      // No school specified for a role that needs one — refuse to
      // pick a random one. Show options and bail.
      const [rows] = await conn.query('SELECT id, name, city FROM schools ORDER BY id ASC');
      console.error('\n✗ A school is required for role=' + ROLE + '.\n');
      if (rows.length === 0) {
        console.error('  No schools exist yet. Create one before running this script.\n');
      } else {
        console.error('  Pick one with --school-id=<id> or --school-name=<exact name>:\n');
        for (const r of rows) {
          const city = r.city ? `  (${r.city})` : '';
          console.error(`    ${String(r.id).padStart(3)}  ${r.name}${city}`);
        }
        console.error('');
      }
      process.exit(1);
    }

    const hash = bcrypt.hashSync(PASSWORD, 12);

    // INSERT ... ON DUPLICATE KEY UPDATE — re-runnable.
    await conn.query(
      `INSERT INTO users (name, email, password, role, school_id)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         name       = VALUES(name),
         password   = VALUES(password),
         role       = VALUES(role),
         school_id  = VALUES(school_id)`,
      [NAME, EMAIL, hash, ROLE, schoolId]
    );

    console.log('\n✓ Test user ready\n');
    console.log('  email     :', EMAIL);
    console.log('  password  :', PASSWORD);
    console.log('  role      :', ROLE);
    console.log('  school_id :', schoolId == null ? '(none — superadmin)' : schoolId);
    console.log('\n  Sign in at: <your-url>/ops/signin\n');
  } catch (err) {
    console.error('✗ Failed:', err.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
})();
