const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function setup() {
  const conn = await mysql.createConnection({
    host: process.env.AIVEN_HOST || '127.0.0.1',
    port: process.env.AIVEN_PORT || 3306,
    user: process.env.AIVEN_USER || 'avnadmin',
    password: process.env.AIVEN_PASS || '',
    database: 'defaultdb',
    ssl: { rejectUnauthorized: false },
    multipleStatements: true,
  });
  console.log('Connected to Aiven MySQL');

  // Schema
  await conn.query('SET FOREIGN_KEY_CHECKS=0');
  await conn.query(`CREATE TABLE IF NOT EXISTS schools (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, name VARCHAR(180) NOT NULL, owner_name VARCHAR(120) NOT NULL, email VARCHAR(180) NULL, phone VARCHAR(40) NULL, city VARCHAR(80) NULL, address TEXT NULL, dance_style VARCHAR(80) NULL, is_active TINYINT(1) NOT NULL DEFAULT 1, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await conn.query(`CREATE TABLE IF NOT EXISTS users (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, name VARCHAR(120) NOT NULL, email VARCHAR(180) NOT NULL, password VARCHAR(255) NOT NULL, role ENUM('superadmin','school_admin','teacher','parent') NOT NULL DEFAULT 'parent', school_id INT UNSIGNED NULL, is_active TINYINT(1) NOT NULL DEFAULT 1, last_login DATETIME NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, UNIQUE KEY uq_email (email), FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE SET NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await conn.query(`CREATE TABLE IF NOT EXISTS students (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, school_id INT UNSIGNED NOT NULL, name VARCHAR(120) NOT NULL, age TINYINT UNSIGNED NULL, phone VARCHAR(40) NULL, email VARCHAR(180) NULL, guardian_name VARCHAR(120) NULL, guardian_phone VARCHAR(40) NULL, guardian_email VARCHAR(180) NULL, join_date DATE NULL, is_active TINYINT(1) NOT NULL DEFAULT 1, notes TEXT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await conn.query(`CREATE TABLE IF NOT EXISTS batches (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, school_id INT UNSIGNED NOT NULL, name VARCHAR(120) NOT NULL, dance_style VARCHAR(80) NULL, level ENUM('Beginner','Intermediate','Advanced','Mixed') NOT NULL DEFAULT 'Beginner', teacher_id INT UNSIGNED NULL, teacher_name VARCHAR(120) NULL, max_size TINYINT UNSIGNED NULL, notes TEXT NULL, is_active TINYINT(1) NOT NULL DEFAULT 1, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE, FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE SET NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await conn.query(`CREATE TABLE IF NOT EXISTS batch_students (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, batch_id INT UNSIGNED NOT NULL, student_id INT UNSIGNED NOT NULL, enrolled_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY uq_batch_student (batch_id, student_id), FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE, FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await conn.query(`CREATE TABLE IF NOT EXISTS schedules (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, school_id INT UNSIGNED NOT NULL, batch_id INT UNSIGNED NOT NULL, day_of_week ENUM('Mon','Tue','Wed','Thu','Fri','Sat','Sun') NOT NULL, start_time TIME NOT NULL, end_time TIME NOT NULL, room VARCHAR(80) NULL, frequency ENUM('Weekly','Bi-weekly','Monthly') NOT NULL DEFAULT 'Weekly', notes TEXT NULL, is_active TINYINT(1) NOT NULL DEFAULT 1, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE, FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await conn.query(`CREATE TABLE IF NOT EXISTS recitals (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, school_id INT UNSIGNED NOT NULL, title VARCHAR(180) NOT NULL, event_date DATE NOT NULL, venue VARCHAR(180) NULL, status ENUM('Planning','Confirmed','Rehearsals','Completed','Cancelled') NOT NULL DEFAULT 'Planning', description TEXT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await conn.query(`CREATE TABLE IF NOT EXISTS recital_tasks (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, recital_id INT UNSIGNED NOT NULL, task_text VARCHAR(255) NOT NULL, is_done TINYINT(1) NOT NULL DEFAULT 0, sort_order SMALLINT NOT NULL DEFAULT 0, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (recital_id) REFERENCES recitals(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await conn.query(`CREATE TABLE IF NOT EXISTS fee_plans (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, school_id INT UNSIGNED NOT NULL, name VARCHAR(120) NOT NULL, amount DECIMAL(10,2) NOT NULL, currency VARCHAR(5) NOT NULL DEFAULT 'USD', period ENUM('Monthly','Term','Annual','One-time') NOT NULL DEFAULT 'Monthly', description TEXT NULL, is_active TINYINT(1) NOT NULL DEFAULT 1, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await conn.query(`CREATE TABLE IF NOT EXISTS student_fees (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, school_id INT UNSIGNED NOT NULL, student_id INT UNSIGNED NOT NULL, fee_plan_id INT UNSIGNED NULL, description VARCHAR(180) NULL, amount DECIMAL(10,2) NOT NULL, currency VARCHAR(5) NOT NULL DEFAULT 'USD', due_date DATE NOT NULL, paid_date DATE NULL, status ENUM('Pending','Paid','Overdue','Waived') NOT NULL DEFAULT 'Pending', notes TEXT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE, FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE, FOREIGN KEY (fee_plan_id) REFERENCES fee_plans(id) ON DELETE SET NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await conn.query(`CREATE TABLE IF NOT EXISTS parent_students (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, parent_id INT UNSIGNED NOT NULL, student_id INT UNSIGNED NOT NULL, UNIQUE KEY uq_parent_student (parent_id, student_id), FOREIGN KEY (parent_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await conn.query('SET FOREIGN_KEY_CHECKS=1');
  console.log('Schema ready');

  // Clear
  await conn.query('SET FOREIGN_KEY_CHECKS=0');
  for (const t of ['parent_students','student_fees','fee_plans','recital_tasks','recitals','schedules','batch_students','batches','students','users','schools']) {
    await conn.query(`DELETE FROM ${t}`);
    await conn.query(`ALTER TABLE ${t} AUTO_INCREMENT = 1`);
  }
  await conn.query('SET FOREIGN_KEY_CHECKS=1');

  const adminPw   = await bcrypt.hash('Admin123!', 12);
  const schoolPw  = await bcrypt.hash('School123!', 12);
  const teacherPw = await bcrypt.hash('Teacher123!', 12);
  const parentPw  = await bcrypt.hash('Parent123!', 12);

  await conn.query(`INSERT INTO schools (id,name,owner_name,email,phone,city,dance_style) VALUES
    (1,'Rhythm & Grace Dance Academy','Swapna Varma','priya@rhythmgrace.com','212-555-0100','New York','Ballet'),
    (2,'Urban Groove Dance Studio','Marcus Lee','marcus@urbangroove.com','310-555-0200','Los Angeles','Hip-Hop')`);
  console.log('Schools seeded');

  await conn.query(`INSERT INTO users (id,name,email,password,role,school_id) VALUES
    (1,'Super Admin','admin@studioflow.app','${adminPw}','superadmin',NULL),
    (2,'Swapna Varma','priya@rhythmgrace.com','${schoolPw}','school_admin',1),
    (3,'Marcus Lee','marcus@urbangroove.com','${schoolPw}','school_admin',2),
    (4,'Aisha Patel','teacher@rhythmgrace.com','${teacherPw}','teacher',1),
    (5,'Jay Kim','jay@urbangroove.com','${teacherPw}','teacher',2),
    (6,'Meera Patel','parent@rhythmgrace.com','${parentPw}','parent',1),
    (7,'Carmen Martinez','carmen@email.com','${parentPw}','parent',1),
    (8,'David Davis','david@email.com','${parentPw}','parent',2)`);
  console.log('Users seeded');

  await conn.query(`INSERT INTO students (id,school_id,name,age,phone,guardian_name,guardian_phone,guardian_email,join_date,notes) VALUES
    (1,1,'Aanya Patel',10,'212-555-0101','Meera Patel','212-555-0100','parent@rhythmgrace.com','2024-09-01','Very dedicated'),
    (2,1,'Sofia Martinez',12,'212-555-0102','Carmen Martinez','212-555-0103','carmen@email.com','2024-09-01','Strong technique'),
    (3,1,'Lily Chen',9,'212-555-0104','Wei Chen','212-555-0105','wei@email.com','2024-10-15','Fast learner'),
    (4,1,'Emma Johnson',14,'212-555-0106','Sarah Johnson','212-555-0107','sarah@email.com','2024-08-01','Auditioning for showcase'),
    (5,1,'Mia Thompson',11,'212-555-0108','Karen Thompson','212-555-0109','karen@email.com','2024-09-15',''),
    (6,1,'Zara Ahmed',13,'212-555-0110','Fatima Ahmed','212-555-0111','fatima@email.com','2024-11-01','Joining from another studio'),
    (7,1,'Isabelle Roy',10,'212-555-0112','Claire Roy','212-555-0113','claire@email.com','2024-09-01',''),
    (8,1,'Nadia Williams',15,'212-555-0114','Tanya Williams','212-555-0115','tanya@email.com','2024-07-01','Senior student'),
    (9,2,'Jordan Davis',16,'310-555-0201','David Davis','310-555-0200','david@email.com','2024-06-01','Freestyle specialist'),
    (10,2,'Aaliyah Brooks',14,'310-555-0202','Tamara Brooks','310-555-0203','tamara@email.com','2024-09-01',''),
    (11,2,'Tyler Nguyen',15,'310-555-0204','Linh Nguyen','310-555-0205','linh@email.com','2024-09-01','Strong in locking & popping'),
    (12,2,'Maya Robinson',13,'310-555-0206','Lisa Robinson','310-555-0207','lisa@email.com','2024-11-01','New student'),
    (13,2,'Kai Santos',17,'310-555-0208','Rosa Santos','310-555-0209','rosa@email.com','2024-01-15','Competing regionally'),
    (14,2,'Destiny Clark',12,'310-555-0210','Brenda Clark','310-555-0211','brenda@email.com','2024-10-01','')`);
  console.log('Students seeded');

  await conn.query(`INSERT INTO batches (id,school_id,name,dance_style,level,teacher_id,teacher_name,max_size,notes) VALUES
    (1,1,'Little Stars','Ballet','Beginner',2,'Swapna Varma',10,'Ages 8-11'),
    (2,1,'Junior Ballet','Ballet','Intermediate',2,'Swapna Varma',12,'Ages 11-13'),
    (3,1,'Senior Company','Contemporary','Advanced',4,'Aisha Patel',8,'Ages 13+'),
    (4,2,'Foundations Crew','Hip-Hop','Beginner',3,'Marcus Lee',12,'Ages 12-14'),
    (5,2,'Elite Cypher','Hip-Hop','Advanced',3,'Marcus Lee',8,'Competition team'),
    (6,2,'K-Pop Vibes','K-Pop','Intermediate',5,'Jay Kim',10,'Mixed ages')`);
  console.log('Batches seeded');

  await conn.query(`INSERT INTO batch_students (batch_id,student_id) VALUES
    (1,1),(1,3),(1,7),(2,2),(2,5),(2,6),(3,4),(3,8),
    (4,10),(4,12),(4,14),(5,9),(5,11),(5,13),(6,10),(6,12)`);

  await conn.query(`INSERT INTO schedules (id,school_id,batch_id,day_of_week,start_time,end_time,room,frequency) VALUES
    (1,1,1,'Mon','16:00','17:00','Studio A','Weekly'),
    (2,1,2,'Mon','17:15','18:30','Studio A','Weekly'),
    (3,1,3,'Wed','18:00','19:30','Studio B','Weekly'),
    (4,1,1,'Sat','10:00','11:00','Studio A','Weekly'),
    (5,1,2,'Sat','11:15','12:30','Studio A','Weekly'),
    (6,1,3,'Sat','13:00','14:30','Studio B','Bi-weekly'),
    (7,2,4,'Tue','17:00','18:00','Main Floor','Weekly'),
    (8,2,5,'Tue','18:30','20:00','Main Floor','Weekly'),
    (9,2,6,'Thu','17:00','18:15','Studio 2','Weekly'),
    (10,2,4,'Sat','11:00','12:00','Main Floor','Weekly'),
    (11,2,5,'Sat','14:00','16:00','Main Floor','Weekly')`);
  console.log('Schedules seeded');

  await conn.query(`INSERT INTO recitals (id,school_id,title,event_date,venue,status,description) VALUES
    (1,1,'Spring Showcase 2025','2025-05-17','Lincoln Center Plaza','Rehearsals','Annual spring performance featuring all three batches.'),
    (2,1,'Summer Intensive Showcase','2025-08-02','Studio B — In-house','Planning','Informal end-of-summer showing for parents.'),
    (3,2,'Urban Heat Battle 2025','2025-06-21','LA Convention Center — Hall B','Confirmed','Regional hip-hop battle. Elite Cypher competing.'),
    (4,2,'End of Year Block Party Show','2025-12-13','Urban Groove — Outdoor Lot','Planning','All-crews year-end celebration open to community.')`);

  await conn.query(`INSERT INTO recital_tasks (recital_id,task_text,is_done,sort_order) VALUES
    (1,'Book Lincoln Center venue',1,1),(1,'Confirm costume fittings for all students',1,2),
    (1,'Send parent invitation letters',1,3),(1,'Book hair & makeup artist',0,4),
    (1,'Arrange stage lighting with venue',0,5),(1,'Print programs & tickets',0,6),
    (1,'Final dress rehearsal',0,7),(2,'Confirm date with all families',0,1),
    (2,'Select repertoire pieces',0,2),(3,'Register team for competition',1,1),
    (3,'Choreograph competition set',1,2),(3,'Book team travel & accommodation',0,3),
    (3,'Order matching team outfits',0,4),(3,'Submit music tracks to organizers',0,5),
    (3,'Run mock battle sessions x3',0,6),(4,'Set outdoor stage layout',0,1),
    (4,'Reach out to local food vendors',0,2),(4,'Design event flyer',0,3)`);
  console.log('Recitals seeded');

  await conn.query(`INSERT INTO fee_plans (id,school_id,name,amount,currency,period) VALUES
    (1,1,'Monthly Tuition — Beginner',120.00,'USD','Monthly'),
    (2,1,'Monthly Tuition — Intermediate',150.00,'USD','Monthly'),
    (3,1,'Monthly Tuition — Advanced',180.00,'USD','Monthly'),
    (4,2,'Monthly Tuition — Standard',140.00,'USD','Monthly'),
    (5,2,'Competition Fee',250.00,'USD','One-time')`);

  const today = new Date();
  const m = o => new Date(today.getFullYear(), today.getMonth()+o, 1).toISOString().split('T')[0];

  await conn.query(`INSERT INTO student_fees (school_id,student_id,fee_plan_id,description,amount,currency,due_date,paid_date,status) VALUES
    (1,1,1,'Monthly Tuition Jan',120.00,'USD','${m(-2)}','${m(-2)}','Paid'),
    (1,1,1,'Monthly Tuition Feb',120.00,'USD','${m(-1)}','${m(-1)}','Paid'),
    (1,1,1,'Monthly Tuition Mar',120.00,'USD','${m(0)}',NULL,'Pending'),
    (1,2,2,'Monthly Tuition Jan',150.00,'USD','${m(-2)}','${m(-2)}','Paid'),
    (1,2,2,'Monthly Tuition Feb',150.00,'USD','${m(-1)}',NULL,'Overdue'),
    (1,2,2,'Monthly Tuition Mar',150.00,'USD','${m(0)}',NULL,'Pending'),
    (1,4,3,'Monthly Tuition Jan',180.00,'USD','${m(-2)}','${m(-2)}','Paid'),
    (1,4,3,'Monthly Tuition Feb',180.00,'USD','${m(-1)}','${m(-1)}','Paid'),
    (1,4,3,'Monthly Tuition Mar',180.00,'USD','${m(0)}',NULL,'Pending'),
    (2,9,4,'Monthly Tuition Jan',140.00,'USD','${m(-2)}','${m(-2)}','Paid'),
    (2,9,5,'Competition Fee',250.00,'USD','${m(-1)}','${m(-1)}','Paid'),
    (2,10,4,'Monthly Tuition Jan',140.00,'USD','${m(-2)}','${m(-2)}','Paid'),
    (2,10,4,'Monthly Tuition Feb',140.00,'USD','${m(-1)}',NULL,'Overdue'),
    (2,13,4,'Monthly Tuition Jan',140.00,'USD','${m(-2)}','${m(-2)}','Paid'),
    (2,13,5,'Competition Fee',250.00,'USD','${m(-1)}','${m(-1)}','Paid')`);

  await conn.query(`INSERT INTO parent_students (parent_id,student_id) VALUES (6,1),(7,2),(8,9)`);
  console.log('Fees & parents seeded');

  await conn.end();
  console.log('\nDone! Database fully seeded.');
  console.log('Login: priya@rhythmgrace.com / School123!');
}

setup().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
