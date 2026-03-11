require('dotenv').config();
const pool = require('../../config/db');
const bcrypt = require('bcryptjs');

async function seed() {
  const conn = await pool.getConnection();
  try {
    console.log('🌱 Seeding database...');
    const hash = (pw) => bcrypt.hashSync(pw, 10);

    // ── Super Admin ────────────────────────────────────────
    await conn.query(`
      INSERT IGNORE INTO users (name, email, password, role) VALUES (?, ?, ?, 'superadmin')
    `, [
      process.env.SUPERADMIN_NAME || 'Super Admin',
      process.env.SUPERADMIN_EMAIL || 'admin@studioflow.app',
      hash(process.env.SUPERADMIN_PASSWORD || 'ChangeMe123!')
    ]);

    // ── School 1 ───────────────────────────────────────────
    const [s1] = await conn.query(`
      INSERT INTO schools (name, owner_name, email, phone, city, dance_style)
      VALUES (?, ?, ?, ?, ?, ?)
    `, ['Rhythm & Grace Dance Academy', 'Priya Sharma', 'priya@rhythmgrace.com', '212-555-0100', 'New York', 'Ballet']);
    const school1Id = s1.insertId;

    const [a1] = await conn.query(`
      INSERT INTO users (name, email, password, role, school_id) VALUES (?, ?, ?, 'school_admin', ?)
    `, ['Priya Sharma', 'priya@rhythmgrace.com', hash('Admin123!'), school1Id]);

    // Students school 1
    const s1Students = [
      ['Aanya Patel', 10, '212-555-0101', 'aanya@email.com', 'Meera Patel', '212-555-0100', '2024-09-01', 'Very dedicated'],
      ['Sofia Martinez', 12, '212-555-0102', 'sofia@email.com', 'Carmen Martinez', '212-555-0103', '2024-09-01', 'Strong technique'],
      ['Lily Chen', 9, '212-555-0104', 'lily@email.com', 'Wei Chen', '212-555-0105', '2024-10-15', 'Fast learner'],
      ['Emma Johnson', 14, '212-555-0106', 'emma@email.com', 'Sarah Johnson', '212-555-0107', '2024-08-01', 'Advanced, auditioning for showcase'],
      ['Mia Thompson', 11, '212-555-0108', 'mia@email.com', 'Karen Thompson', '212-555-0109', '2024-09-15', ''],
      ['Zara Ahmed', 13, '212-555-0110', 'zara@email.com', 'Fatima Ahmed', '212-555-0111', '2024-11-01', 'Joining from another studio'],
      ['Isabelle Roy', 10, '212-555-0112', 'isabelle@email.com', 'Claire Roy', '212-555-0113', '2024-09-01', ''],
      ['Nadia Williams', 15, '212-555-0114', 'nadia@email.com', 'Tanya Williams', '212-555-0115', '2024-07-01', 'Senior, helps with juniors'],
    ];
    const s1StudentIds = [];
    for (const s of s1Students) {
      const [r] = await conn.query(`INSERT INTO students (school_id,name,age,phone,email,guardian_name,guardian_phone,join_date,notes) VALUES (?,?,?,?,?,?,?,?,?)`,
        [school1Id, ...s]);
      s1StudentIds.push(r.insertId);
    }

    // Parent accounts for school 1
    const parentAccounts1 = [
      ['Meera Patel', 'meera@email.com', s1StudentIds[0]],
      ['Carmen Martinez', 'carmen@email.com', s1StudentIds[1]],
      ['Sarah Johnson', 'sarah@email.com', s1StudentIds[3]],
    ];
    for (const [name, email, studentId] of parentAccounts1) {
      const [pr] = await conn.query(`INSERT IGNORE INTO users (name,email,password,role,school_id) VALUES (?,?,?,'parent',?)`,
        [name, email, hash('Parent123!'), school1Id]);
      if (pr.insertId) {
        await conn.query(`INSERT IGNORE INTO parent_students (parent_id,student_id) VALUES (?,?)`, [pr.insertId, studentId]);
      }
    }

    // Batches school 1
    const [b1] = await conn.query(`INSERT INTO batches (school_id,name,dance_style,level,teacher_name,max_size) VALUES (?,?,?,?,?,?)`,
      [school1Id, 'Little Stars', 'Ballet', 'Beginner', 'Priya Sharma', 10]);
    const [b2] = await conn.query(`INSERT INTO batches (school_id,name,dance_style,level,teacher_name,max_size) VALUES (?,?,?,?,?,?)`,
      [school1Id, 'Junior Ballet', 'Ballet', 'Intermediate', 'Priya Sharma', 12]);
    const [b3] = await conn.query(`INSERT INTO batches (school_id,name,dance_style,level,teacher_name,max_size) VALUES (?,?,?,?,?,?)`,
      [school1Id, 'Senior Company', 'Contemporary', 'Advanced', 'Priya Sharma', 8]);

    await conn.query(`INSERT INTO batch_students (batch_id,student_id) VALUES (?,?),(?,?),(?,?)`,
      [b1.insertId, s1StudentIds[0], b1.insertId, s1StudentIds[2], b1.insertId, s1StudentIds[6]]);
    await conn.query(`INSERT INTO batch_students (batch_id,student_id) VALUES (?,?),(?,?),(?,?)`,
      [b2.insertId, s1StudentIds[1], b2.insertId, s1StudentIds[4], b2.insertId, s1StudentIds[5]]);
    await conn.query(`INSERT INTO batch_students (batch_id,student_id) VALUES (?,?),(?,?)`,
      [b3.insertId, s1StudentIds[3], b3.insertId, s1StudentIds[7]]);

    // Schedules school 1
    const schedules1 = [
      [school1Id, b1.insertId, 'Mon', '16:00', '17:00', 'Studio A', 'Weekly'],
      [school1Id, b2.insertId, 'Mon', '17:15', '18:30', 'Studio A', 'Weekly'],
      [school1Id, b3.insertId, 'Wed', '18:00', '19:30', 'Studio B', 'Weekly'],
      [school1Id, b1.insertId, 'Sat', '10:00', '11:00', 'Studio A', 'Weekly'],
      [school1Id, b2.insertId, 'Sat', '11:15', '12:30', 'Studio A', 'Weekly'],
      [school1Id, b3.insertId, 'Sat', '13:00', '14:30', 'Studio B', 'Bi-weekly'],
    ];
    for (const s of schedules1) {
      await conn.query(`INSERT INTO schedules (school_id,batch_id,day_of_week,start_time,end_time,room,frequency) VALUES (?,?,?,?,?,?,?)`, s);
    }

    // Recitals school 1
    const [r1] = await conn.query(`INSERT INTO recitals (school_id,title,event_date,venue,status,description) VALUES (?,?,?,?,?,?)`,
      [school1Id, 'Spring Showcase 2025', '2025-05-17', 'Lincoln Center Plaza', 'Rehearsals', 'Annual spring performance featuring all three batches.']);
    const tasks1 = [
      ['Book Lincoln Center venue', 1], ['Confirm costume fittings', 1], ['Send parent invitation letters', 1],
      ['Book hair & makeup artist', 0], ['Arrange stage lighting', 0], ['Print programs & tickets', 0], ['Final dress rehearsal', 0],
    ];
    for (const [text, done] of tasks1) {
      await conn.query(`INSERT INTO recital_tasks (recital_id,task_text,is_done) VALUES (?,?,?)`, [r1.insertId, text, done]);
    }
    const [r2] = await conn.query(`INSERT INTO recitals (school_id,title,event_date,venue,status,description) VALUES (?,?,?,?,?,?)`,
      [school1Id, 'Summer Intensive Showcase', '2025-08-02', 'Studio B — In-house', 'Planning', 'Informal end-of-summer showing for parents.']);
    await conn.query(`INSERT INTO recital_tasks (recital_id,task_text,is_done) VALUES (?,?,?),(?,?,?)`,
      [r2.insertId, 'Confirm date with all families', 0, r2.insertId, 'Select repertoire pieces', 0]);

    // Fee plans school 1
    const [fp1] = await conn.query(`INSERT INTO fee_plans (school_id,name,amount,currency,period) VALUES (?,?,?,?,?)`,
      [school1Id, 'Monthly Tuition', 120.00, 'USD', 'Monthly']);
    const now = new Date();
    for (const sid of s1StudentIds) {
      const due = new Date(now.getFullYear(), now.getMonth(), 1);
      await conn.query(`INSERT INTO student_fees (school_id,student_id,fee_plan_id,amount,currency,due_date,status) VALUES (?,?,?,?,?,?,?)`,
        [school1Id, sid, fp1.insertId, 120.00, 'USD', due.toISOString().split('T')[0], Math.random() > 0.4 ? 'Paid' : 'Pending']);
    }

    // ── School 2 ───────────────────────────────────────────
    const [s2] = await conn.query(`INSERT INTO schools (name,owner_name,email,phone,city,dance_style) VALUES (?,?,?,?,?,?)`,
      ['Urban Groove Dance Studio', 'Marcus Lee', 'marcus@urbangroove.com', '310-555-0200', 'Los Angeles', 'Hip-Hop']);
    const school2Id = s2.insertId;

    await conn.query(`INSERT INTO users (name,email,password,role,school_id) VALUES (?,?,?,'school_admin',?)`,
      ['Marcus Lee', 'marcus@urbangroove.com', hash('Admin123!'), school2Id]);

    const s2Students = [
      ['Jordan Davis', 16, '310-555-0201', 'jordan@email.com', 'David Davis', '310-555-0200', '2024-06-01', 'Freestyle specialist'],
      ['Aaliyah Brooks', 14, '310-555-0202', 'aaliyah@email.com', 'Tamara Brooks', '310-555-0203', '2024-09-01', ''],
      ['Tyler Nguyen', 15, '310-555-0204', 'tyler@email.com', 'Linh Nguyen', '310-555-0205', '2024-09-01', 'Strong in locking & popping'],
      ['Maya Robinson', 13, '310-555-0206', 'maya@email.com', 'Lisa Robinson', '310-555-0207', '2024-11-01', 'New student'],
      ['Kai Santos', 17, '310-555-0208', 'kai@email.com', 'Rosa Santos', '310-555-0209', '2024-01-15', 'Competing regionally'],
      ['Destiny Clark', 12, '310-555-0210', 'destiny@email.com', 'Brenda Clark', '310-555-0211', '2024-10-01', ''],
    ];
    const s2StudentIds = [];
    for (const s of s2Students) {
      const [r] = await conn.query(`INSERT INTO students (school_id,name,age,phone,email,guardian_name,guardian_phone,join_date,notes) VALUES (?,?,?,?,?,?,?,?,?)`,
        [school2Id, ...s]);
      s2StudentIds.push(r.insertId);
    }

    const [b4] = await conn.query(`INSERT INTO batches (school_id,name,dance_style,level,teacher_name,max_size) VALUES (?,?,?,?,?,?)`,
      [school2Id, 'Foundations Crew', 'Hip-Hop', 'Beginner', 'Marcus Lee', 12]);
    const [b5] = await conn.query(`INSERT INTO batches (school_id,name,dance_style,level,teacher_name,max_size) VALUES (?,?,?,?,?,?)`,
      [school2Id, 'Elite Cypher', 'Hip-Hop', 'Advanced', 'Marcus Lee', 8]);
    const [b6] = await conn.query(`INSERT INTO batches (school_id,name,dance_style,level,teacher_name,max_size) VALUES (?,?,?,?,?,?)`,
      [school2Id, 'K-Pop Vibes', 'K-Pop', 'Intermediate', 'Jay Kim', 10]);

    await conn.query(`INSERT INTO batch_students (batch_id,student_id) VALUES (?,?),(?,?),(?,?)`,
      [b4.insertId, s2StudentIds[1], b4.insertId, s2StudentIds[3], b4.insertId, s2StudentIds[5]]);
    await conn.query(`INSERT INTO batch_students (batch_id,student_id) VALUES (?,?),(?,?),(?,?)`,
      [b5.insertId, s2StudentIds[0], b5.insertId, s2StudentIds[2], b5.insertId, s2StudentIds[4]]);
    await conn.query(`INSERT INTO batch_students (batch_id,student_id) VALUES (?,?),(?,?)`,
      [b6.insertId, s2StudentIds[1], b6.insertId, s2StudentIds[3]]);

    const schedules2 = [
      [school2Id, b4.insertId, 'Tue', '17:00', '18:00', 'Main Floor', 'Weekly'],
      [school2Id, b5.insertId, 'Tue', '18:30', '20:00', 'Main Floor', 'Weekly'],
      [school2Id, b6.insertId, 'Thu', '17:00', '18:15', 'Studio 2', 'Weekly'],
      [school2Id, b4.insertId, 'Sat', '11:00', '12:00', 'Main Floor', 'Weekly'],
      [school2Id, b5.insertId, 'Sat', '14:00', '16:00', 'Main Floor', 'Weekly'],
    ];
    for (const s of schedules2) {
      await conn.query(`INSERT INTO schedules (school_id,batch_id,day_of_week,start_time,end_time,room,frequency) VALUES (?,?,?,?,?,?,?)`, s);
    }

    const [r3] = await conn.query(`INSERT INTO recitals (school_id,title,event_date,venue,status,description) VALUES (?,?,?,?,?,?)`,
      [school2Id, 'Urban Heat Battle 2025', '2025-06-21', 'LA Convention Center', 'Confirmed', 'Regional hip-hop battle. Elite Cypher competing.']);
    const tasks3 = [
      ['Register team for competition', 1], ['Choreograph competition set', 1],
      ['Book team travel & accommodation', 0], ['Order matching team outfits', 0],
      ['Submit music tracks to organizers', 0], ['Run mock battle sessions x3', 0],
    ];
    for (const [text, done] of tasks3) {
      await conn.query(`INSERT INTO recital_tasks (recital_id,task_text,is_done) VALUES (?,?,?)`, [r3.insertId, text, done]);
    }

    const [fp2] = await conn.query(`INSERT INTO fee_plans (school_id,name,amount,currency,period) VALUES (?,?,?,?,?)`,
      [school2Id, 'Monthly Tuition', 150.00, 'USD', 'Monthly']);
    for (const sid of s2StudentIds) {
      const due = new Date(now.getFullYear(), now.getMonth(), 1);
      await conn.query(`INSERT INTO student_fees (school_id,student_id,fee_plan_id,amount,currency,due_date,status) VALUES (?,?,?,?,?,?,?)`,
        [school2Id, sid, fp2.insertId, 150.00, 'USD', due.toISOString().split('T')[0], Math.random() > 0.5 ? 'Paid' : 'Pending']);
    }

    console.log('✅ Seed complete!');
    console.log('');
    console.log('  Super Admin:  admin@studioflow.app  /  ChangeMe123!');
    console.log('  School 1:     priya@rhythmgrace.com /  Admin123!');
    console.log('  School 2:     marcus@urbangroove.com / Admin123!');
    console.log('  Parents:      meera@email.com / carmen@email.com / sarah@email.com  →  Parent123!');
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  } finally {
    conn.release();
    pool.end();
  }
}

seed();
