/**
 * MathAcademy — demo/development seed.
 *
 * ⚠️  SECURITY — read before changing anything here.
 *
 * This script creates working superadmin, teacher and guardian accounts.
 * It is meant for LOCAL DEVELOPMENT and DEMO environments only.
 *
 * Two safeguards protect production:
 *
 *   1. Running with NODE_ENV=production aborts unless ALLOW_SEED=true is set
 *      explicitly. Seeding a live tenant is never something that should
 *      happen by accident.
 *
 *   2. Passwords are read from the environment. The fallbacks below are used
 *      ONLY outside production; when NODE_ENV=production the script refuses to
 *      start unless every password is supplied via env.
 *
 * Why this matters: an earlier version hardcoded the passwords here AND
 * published them in the public README, while `npm run seed:prod` pointed at
 * this same file. Anyone reading the repository could have signed in as
 * superadmin on a seeded production instance.
 *
 * Accounts created (passwords come from env — see the SEED_* keys below):
 *   superadmin : admin
 *   demo admin : demo            (read-only)
 *   teachers   : teacher.001…010
 *   demo teacher: demo.teacher   (read-only)
 *   guardians  : MA-0001…MA-0060
 *   demo guardian: MA-DEMO       (read-only)
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import { config } from 'dotenv';
import * as path from 'path';

const envPath = path.join(__dirname, '..', '.env');
config({ path: envPath });

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// ─── Safeguard 1: never seed production by accident ──────────────────────────
if (IS_PRODUCTION && process.env.ALLOW_SEED !== 'true') {
  console.error(
    '\n❌ Refusing to seed: NODE_ENV=production.\n' +
      '   This script creates privileged accounts and is intended for local/demo use.\n' +
      '   If you genuinely need to seed a production database, set ALLOW_SEED=true\n' +
      '   and supply every SEED_* password via the environment.\n',
  );
  process.exit(1);
}

/**
 * Safeguard 2: resolve a seed password.
 *
 * Outside production the documented demo fallback is used so `npm run seed`
 * keeps working with no setup. In production there is no fallback — the value
 * must come from the environment or the script aborts.
 */
function seedPassword(envKey: string, devFallback: string): string {
  const fromEnv = process.env[envKey];
  if (fromEnv && fromEnv.length > 0) return fromEnv;

  if (IS_PRODUCTION) {
    console.error(
      `\n❌ ${envKey} is not set.\n` +
        '   Production seeding requires every password to be supplied explicitly.\n',
    );
    process.exit(1);
  }
  return devFallback;
}

/**
 * Resolved at module load — deliberately BEFORE any database work.
 *
 * An earlier revision resolved these inside main(), after the tenant and
 * permission rows had already been written. A production run missing a
 * SEED_* value would therefore half-seed the database and only then abort.
 * Failing before the first query keeps the operation all-or-nothing.
 */
const SEED_PASSWORDS = {
  admin: seedPassword('SEED_ADMIN_PASSWORD', 'MathAdmin@2025!'),
  demo: seedPassword('SEED_DEMO_PASSWORD', 'Demo@1234'),
  teacher: seedPassword('SEED_TEACHER_PASSWORD', 'Ustoz@2025!'),
  guardian: seedPassword('SEED_GUARDIAN_PASSWORD', 'Ota@12345'),
} as const;

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// ─── helpers ─────────────────────────────────────────────────────────────────
const ROUNDS = 10;
const hash = (pw: string) => bcrypt.hash(pw, ROUNDS);

function d(iso: string) { return new Date(iso); }

function addDays(date: Date, n: number): Date {
  const r = new Date(date);
  r.setDate(r.getDate() + n);
  return r;
}

/** Returns Mon–Fri dates going back `weekCount` weeks from today */
function workdaysBack(weekCount: number): Date[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days: Date[] = [];
  for (let i = 0; i < weekCount * 5; i++) {
    const d2 = addDays(today, -(i + 1));
    const dow = d2.getDay(); // 0=Sun 6=Sat
    if (dow >= 1 && dow <= 5) days.push(d2);
  }
  return days.reverse();
}

// ─── static data ─────────────────────────────────────────────────────────────
const ALL_PERMS = [
  'academic_years.delete', 'academic_years.read', 'academic_years.write',
  'announcements.read', 'announcements.write',
  'assessments.read', 'assessments.write',
  'attendance.read', 'attendance.write',
  'awards.read', 'awards.write',
  'billing.read', 'billing.write',
  'campuses.read', 'campuses.write',
  'certificates.read', 'certificates.write',
  'cohorts.read', 'cohorts.write',
  'competitions.read', 'competitions.write',
  'discipline.read', 'discipline.write',
  'displays.read', 'displays.write',
  'dorms.assign', 'dorms.read', 'dorms.write',
  'events.read', 'events.write',
  'files.read', 'files.write',
  'groups.read', 'groups.write',
  'leaves.read', 'leaves.write',
  'notifications.read', 'notifications.write',
  'outcomes.read', 'outcomes.write',
  'permissions.manage', 'permissions.view',
  'ranking.read', 'ranking.write',
  'risk.read', 'risk.write',
  'roles.manage', 'roles.view',
  'students.read', 'students.write',
  'subjects.read', 'subjects.write',
  'timetable.read', 'timetable.write',
  'tracks.read', 'tracks.write',
  'users.manage', 'users.view',
];

const READ_ONLY_PERMS = ALL_PERMS.filter(p =>
  p.endsWith('.read') || p.endsWith('.view')
);

const TEACHER_PERMS = new Set([
  'students.read', 'groups.read', 'campuses.read', 'subjects.read',
  'tracks.read', 'academic_years.read', 'cohorts.read',
  'timetable.read', 'timetable.write',
  'attendance.read', 'attendance.write',
  'assessments.read', 'assessments.write',
  'ranking.read', 'risk.read',
  'discipline.read', 'discipline.write',
  'leaves.read', 'events.read', 'events.write',
  'competitions.read', 'awards.read',
  'announcements.read', 'files.read', 'files.write',
  'certificates.read', 'outcomes.read',
  'notifications.read',
]);

const TEACHER_READ_ONLY = new Set([...TEACHER_PERMS].filter(p =>
  p.endsWith('.read') || p.endsWith('.view')
));

const UZBEK_MALE_NAMES = [
  'Abror', 'Akbar', 'Alisher', 'Aziz', 'Bekzod', 'Bobur', 'Doniyor',
  'Eldor', 'Farrukh', 'Husan', 'Ilhom', 'Jasur', 'Javlon', 'Kamol',
  'Laziz', 'Mansur', 'Murod', 'Nodir', 'Otabek', 'Parviz', 'Qodir',
  'Ravshan', 'Sanjar', 'Sardor', 'Sherzod', 'Temur', 'Ulugbek', 'Vohid',
  'Xurshid', 'Zafar',
];
const UZBEK_FEMALE_NAMES = [
  'Aziza', 'Barno', 'Dildora', 'Feruza', 'Gavhar', 'Gulnora', 'Hilola',
  'Iroda', 'Kamola', 'Lola', 'Madina', 'Malika', 'Nafisa', 'Nargiza',
  'Nilufar', 'Nozima', 'Oydin', 'Parizod', 'Rohila', 'Sarvinoz',
  'Shahlo', 'Tabassum', 'Umida', 'Yulduz', 'Zulfiya',
];
const SURNAMES = [
  'Karimov', 'Rahimov', 'Toshmatov', 'Mirzayev', 'Xasanov', 'Yusupov',
  'Qodirov', 'Normatov', 'Abdullayev', 'Ismoilov', 'Holiqov', 'Nazarov',
  'Sultonov', 'Ergashev', 'Fayzullayev', 'Haydarov', 'Jalolov', 'Komilov',
  'Latipov', 'Mamatov', 'Nishonov', 'Ortiqov', 'Pulatov', 'Razzaqov',
  'Sobirov', 'Tojimatov', 'Umarov', 'Valiyev', 'Xoliqov', 'Zokirov',
];

// Deterministic pick (not random — same result every run)
function pick<T>(arr: T[], idx: number): T { return arr[idx % arr.length]; }

function studentName(idx: number): { full_name: string; gender: string } {
  const isMale = idx % 3 !== 0; // ~2/3 male
  const namePool = isMale ? UZBEK_MALE_NAMES : UZBEK_FEMALE_NAMES;
  const first = pick(namePool, idx);
  const last = pick(SURNAMES, idx + 7);
  const gender = isMale ? 'MALE' : 'FEMALE';
  return { full_name: `${last} ${first}`, gender };
}

function guardianName(studentFull: string): string {
  const parts = studentFull.split(' ');
  const surname = parts[0];
  const parentNames = ['Hamid', 'Sardor', 'Alisher', 'Nodir', 'Farrukh',
    'Ulugbek', 'Bahodir', 'Jasur', 'Sherzod', 'Bekzod'];
  const idx = surname.length % parentNames.length;
  return `${surname} ${pick(parentNames, idx)}`;
}

function randScore(min: number, max: number, idx: number): number {
  // Deterministic "random" using idx
  return Math.round((min + ((idx * 37 + 13) % (max - min + 1))) * 10) / 10;
}

// ─── main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🌱 Starting production seed...\n');

  // ── 1. Tenant ──────────────────────────────────────────────────────────────
  const tenant = await prisma.tenants.upsert({
    where: { slug: 'mathacademy' },
    update: { name: 'MathAcademy', timezone: 'Asia/Tashkent' },
    create: { slug: 'mathacademy', name: 'MathAcademy', timezone: 'Asia/Tashkent' },
  });
  const tid = tenant.id;
  console.log(`✅ Tenant: ${tenant.name} (id=${tid})`);

  // ── 2. Permissions ─────────────────────────────────────────────────────────
  const permMap = new Map<string, bigint>();
  for (const code of ALL_PERMS) {
    const p = await prisma.permissions.upsert({
      where: { code },
      update: {},
      create: { code, description: code },
    });
    permMap.set(code, p.id);
  }
  console.log(`✅ Permissions: ${permMap.size} ta`);

  // ── 3. Roles ───────────────────────────────────────────────────────────────
  async function upsertRole(name: string) {
    return prisma.roles.upsert({
      where: { tenant_id_name: { tenant_id: tid, name } },
      update: {},
      create: { tenant_id: tid, name },
    });
  }

  async function attachPerms(roleId: bigint, codes: string[]) {
    for (const code of codes) {
      const pid = permMap.get(code);
      if (!pid) continue;
      await prisma.role_permissions.upsert({
        where: { role_id_permission_id: { role_id: roleId, permission_id: pid } },
        update: {},
        create: { role_id: roleId, permission_id: pid },
      });
    }
  }

  const superadminRole   = await upsertRole('SUPERADMIN');
  const adminRole        = await upsertRole('ADMIN');
  const teacherRole      = await upsertRole('TEACHER');
  const demoViewerRole   = await upsertRole('DEMO_VIEWER');    // read-only all
  const demoTeacherRole  = await upsertRole('DEMO_TEACHER');   // read-only teacher scope

  await attachPerms(superadminRole.id, ALL_PERMS);
  await attachPerms(adminRole.id,
    ALL_PERMS.filter(p => !['permissions.manage','roles.manage','users.manage'].includes(p)));
  await attachPerms(teacherRole.id, Array.from(TEACHER_PERMS));
  await attachPerms(demoViewerRole.id, READ_ONLY_PERMS);
  await attachPerms(demoTeacherRole.id, Array.from(TEACHER_READ_ONLY));
  console.log('✅ Roles & permissions');

  // ── 4. Living types ────────────────────────────────────────────────────────
  const livingTypeDefs = [
    { code: 'DAY_ONLY',      name: 'Kundalik (faqat tushlik)'     },
    { code: 'WEEKDAYS_ONLY', name: 'Hafta kunlari (Mon–Jum)'       },
    { code: 'FULL_BOARD',    name: 'To\'liq (7 kun yotoqxona)'     },
  ];
  const ltMap = new Map<string, bigint>();
  for (const lt of livingTypeDefs) {
    const r = await prisma.living_types.upsert({
      where: { tenant_id_code: { tenant_id: tid, code: lt.code } },
      update: {},
      create: { tenant_id: tid, ...lt, is_active: true },
    });
    ltMap.set(lt.code, r.id);
  }
  console.log('✅ Living types');

  // ── 5. Campus ──────────────────────────────────────────────────────────────
  let campus = await prisma.campuses.findFirst({ where: { tenant_id: tid, name: 'Asosiy Kampus' } });
  if (!campus) {
    campus = await prisma.campuses.create({
      data: {
        tenant_id: tid,
        name: 'Asosiy Kampus',
        address: 'Toshkent, Yunusobod tumani, Amir Temur ko\'chasi 108',
        lat: 41.2995,
        lng: 69.2401,
        is_active: true,
      },
    });
  }
  console.log(`✅ Campus: ${campus.name}`);

  // ── 6. Dorm ────────────────────────────────────────────────────────────────
  let dorm = await prisma.dorms.findFirst({ where: { tenant_id: tid } });
  if (!dorm) {
    dorm = await prisma.dorms.create({
      data: {
        tenant_id: tid,
        campus_id: campus.id,
        name: 'A Blok Yotoqxona',
        description: 'Asosiy kampusdagi 3 qavatli yotoqxona binosi',
        is_active: true,
      },
    });
  }
  // Create 20 rooms
  const dormRoomIds: bigint[] = [];
  for (let r = 1; r <= 20; r++) {
    const floor = Math.ceil(r / 7);
    const roomNum = ((r - 1) % 7) + 1;
    const code = `${floor}0${roomNum}`;
    let room = await prisma.dorm_rooms.findFirst({ where: { dorm_id: dorm.id, room_code: code } });
    if (!room) {
      room = await prisma.dorm_rooms.create({
        data: { dorm_id: dorm.id, room_code: code, capacity: 3 },
      });
    }
    dormRoomIds.push(room.id);
  }
  console.log('✅ Dorm + 20 xona');

  // ── 7. Academic year ───────────────────────────────────────────────────────
  let ayear = await prisma.academic_years.findFirst({ where: { tenant_id: tid, name: '2024-2025' } });
  if (!ayear) {
    ayear = await prisma.academic_years.create({
      data: {
        tenant_id: tid,
        name: '2024-2025',
        start_date: d('2024-09-02'),
        end_date: d('2025-06-15'),
        is_current: true,
      },
    });
  }
  console.log('✅ Academic year: 2024-2025');

  // ── 8. Student tracks ──────────────────────────────────────────────────────
  const trackDefs = [
    { name: 'Matematika va Fizika',     color: '#4f46e5', desc: 'Aniq fanlar yo\'nalishi — matematika, fizika va muhandislik' },
    { name: 'Informatika va Dasturlash', color: '#0ea5e9', desc: 'IT va dasturlash, algoritmlar, sun\'iy intellekt' },
    { name: 'Kimyo va Biologiya',        color: '#10b981', desc: 'Tabiiy fanlar, tibbiyot va biologik tadqiqotlar' },
  ];
  const trackMap = new Map<string, bigint>();
  for (const t of trackDefs) {
    let tr = await prisma.student_tracks.findFirst({ where: { tenant_id: tid, name: t.name } });
    if (!tr) {
      tr = await prisma.student_tracks.create({
        data: { tenant_id: tid, name: t.name, description: t.desc, color: t.color },
      });
    }
    trackMap.set(t.name, tr.id);
  }
  console.log('✅ Tracks: 3 ta');

  // ── 9. Subjects ────────────────────────────────────────────────────────────
  const subjectDefs = [
    // Core
    { name: 'Matematika',         code: 'MATH',  is_core: true,  track: null },
    { name: 'Ingliz tili',        code: 'ENG',   is_core: true,  track: null },
    { name: 'O\'zbek tili',       code: 'UZB',   is_core: true,  track: null },
    { name: 'Tarix',              code: 'HIST',  is_core: true,  track: null },
    { name: 'Geografiya',         code: 'GEO',   is_core: true,  track: null },
    // Math/Physics track
    { name: 'Fizika',             code: 'PHYS',  is_core: true,  track: 'Matematika va Fizika' },
    { name: 'Algebra va analiz',  code: 'ALGB',  is_core: false, track: 'Matematika va Fizika' },
    { name: 'Chizmachilik',       code: 'DRAW',  is_core: false, track: 'Matematika va Fizika' },
    // IT track
    { name: 'Informatika',        code: 'CS',    is_core: true,  track: 'Informatika va Dasturlash' },
    { name: 'Dasturlash (Python)',code: 'PY',    is_core: false, track: 'Informatika va Dasturlash' },
    { name: 'Ma\'lumotlar bazasi',code: 'DB',    is_core: false, track: 'Informatika va Dasturlash' },
    // Chemistry/Biology track
    { name: 'Kimyo',              code: 'CHEM',  is_core: true,  track: 'Kimyo va Biologiya' },
    { name: 'Biologiya',          code: 'BIO',   is_core: true,  track: 'Kimyo va Biologiya' },
    { name: 'Organik kimyo',      code: 'OCHEM', is_core: false, track: 'Kimyo va Biologiya' },
  ];
  const subMap = new Map<string, bigint>();
  for (const s of subjectDefs) {
    const trackId = s.track ? trackMap.get(s.track) : undefined;
    let sub = await prisma.subjects.findFirst({ where: { tenant_id: tid, name: s.name } });
    if (!sub) {
      sub = await prisma.subjects.create({
        data: {
          tenant_id: tid,
          name: s.name,
          code: s.code,
          is_core: s.is_core,
          track_id: trackId ?? null,
        },
      });
    }
    subMap.set(s.name, sub.id);
  }
  console.log(`✅ Subjects: ${subMap.size} ta`);

  // ── 10. Staff users ────────────────────────────────────────────────────────
  // Passwords were resolved at module load (see SEED_PASSWORDS above) so that a
  // production run with missing env aborts before writing anything.
  const adminPw      = await hash(SEED_PASSWORDS.admin);
  const demoPw       = await hash(SEED_PASSWORDS.demo);
  const teacherPw    = await hash(SEED_PASSWORDS.teacher);
  const guardianPw   = await hash(SEED_PASSWORDS.guardian);
  const demoGuardPw  = await hash(SEED_PASSWORDS.demo);

  async function upsertUser(username: string, pwHash: string, fullName: string, phone?: string) {
    return prisma.users.upsert({
      where: { tenant_id_username: { tenant_id: tid, username } },
      update: {},
      create: { tenant_id: tid, username, password_hash: pwHash, full_name: fullName, phone, is_active: true },
    });
  }

  async function assignRole(userId: bigint, roleId: bigint) {
    await prisma.user_roles.upsert({
      where: { user_id_role_id: { user_id: userId, role_id: roleId } },
      update: {},
      create: { user_id: userId, role_id: roleId },
    });
  }

  // Real superadmin
  const admin = await upsertUser('admin', adminPw, 'Adminov Superadmin', '+998901234567');
  await assignRole(admin.id, superadminRole.id);

  // Demo superadmin (view-only)
  const demoAdmin = await upsertUser('demo', demoPw, 'Demo Foydalanuvchi');
  await assignRole(demoAdmin.id, demoViewerRole.id);

  // 10 real teachers
  const teacherDefs = [
    { username: 'teacher.azimov',    name: 'Azimov Bahodir Sobirovich',    phone: '+998901110001' },
    { username: 'teacher.rahimova',  name: 'Rahimova Dilorom Mirzayevna',  phone: '+998901110002' },
    { username: 'teacher.toshmatov', name: 'Toshmatov Sardor Hamidovich',  phone: '+998901110003' },
    { username: 'teacher.mirzayeva', name: 'Mirzayeva Nilufar Karimovna',  phone: '+998901110004' },
    { username: 'teacher.xasanov',   name: 'Xasanov Firdavs Nematovich',   phone: '+998901110005' },
    { username: 'teacher.yusupova',  name: 'Yusupova Zulfiya Rашидовна',  phone: '+998901110006' },
    { username: 'teacher.qodirov',   name: 'Qodirov Alisher Toxirovich',   phone: '+998901110007' },
    { username: 'teacher.normatov',  name: 'Normatov Jasur Ergashevich',   phone: '+998901110008' },
    { username: 'teacher.ergasheva', name: 'Ergasheva Maftuna Sobirovna',  phone: '+998901110009' },
    { username: 'teacher.holiqov',   name: 'Holiqov Nodir Umarovich',      phone: '+998901110010' },
  ];
  const teachers: Awaited<ReturnType<typeof upsertUser>>[] = [];
  for (const t of teacherDefs) {
    const u = await upsertUser(t.username, teacherPw, t.name, t.phone);
    await assignRole(u.id, teacherRole.id);
    teachers.push(u);
  }

  // Demo teacher (read-only)
  const demoTeacher = await upsertUser('demo.teacher', demoPw, 'Demo O\'qituvchi');
  await assignRole(demoTeacher.id, demoTeacherRole.id);

  console.log(`✅ Staff: 1 admin + 1 demo + ${teachers.length} teacher + 1 demo.teacher`);

  // ── 11. Groups ─────────────────────────────────────────────────────────────
  // 6 groups: 10A/10B/10C/11A/11B/11C
  // Curators: teachers[0,2,4] for grade 10; teachers[1,3,5] for grade 11
  const groupDefs = [
    { name: '10-A', grade: 10, track: 'Matematika va Fizika',     curator: teachers[0] },
    { name: '10-B', grade: 10, track: 'Informatika va Dasturlash', curator: teachers[6] },
    { name: '10-C', grade: 10, track: 'Kimyo va Biologiya',        curator: teachers[2] },
    { name: '11-A', grade: 11, track: 'Matematika va Fizika',     curator: teachers[8] },
    { name: '11-B', grade: 11, track: 'Informatika va Dasturlash', curator: teachers[9] },
    { name: '11-C', grade: 11, track: 'Kimyo va Biologiya',        curator: teachers[3] },
  ];
  const groups: any[] = [];
  for (const g of groupDefs) {
    let gr = await prisma.groups.findFirst({
      where: { tenant_id: tid, academic_year_id: ayear.id, name: g.name },
    });
    if (!gr) {
      gr = await prisma.groups.create({
        data: {
          tenant_id: tid,
          campus_id: campus.id,
          academic_year_id: ayear.id,
          track_id: trackMap.get(g.track),
          name: g.name,
          grade: g.grade,
          curator_user_id: g.curator.id,
        },
      });
    }
    groups.push(gr);
  }
  console.log(`✅ Groups: ${groups.length} ta`);

  // ── 12. Group subjects ─────────────────────────────────────────────────────
  const coreSubjects = ['Matematika', 'Ingliz tili', 'O\'zbek tili', 'Tarix', 'Geografiya'];
  const trackSubjects: Record<string, string[]> = {
    'Matematika va Fizika':     ['Fizika', 'Algebra va analiz', 'Chizmachilik'],
    'Informatika va Dasturlash':['Informatika', 'Dasturlash (Python)', 'Ma\'lumotlar bazasi'],
    'Kimyo va Biologiya':       ['Kimyo', 'Biologiya', 'Organik kimyo'],
  };
  for (const g of groups) {
    const gDef = groupDefs[groups.indexOf(g)];
    const allSubs = [...coreSubjects, ...(trackSubjects[gDef.track] || [])];
    for (const subName of allSubs) {
      const subId = subMap.get(subName);
      if (!subId) continue;
      await prisma.group_subjects.upsert({
        where: { group_id_subject_id: { group_id: g.id, subject_id: subId } },
        update: {},
        create: { group_id: g.id, subject_id: subId },
      });
    }
  }
  console.log('✅ Group subjects');

  // ── 13. Timetables ─────────────────────────────────────────────────────────
  // Teacher → subject assignment
  const teacherSubjects: Array<{ teacherIdx: number; subjects: string[] }> = [
    { teacherIdx: 0, subjects: ['Matematika'] },
    { teacherIdx: 1, subjects: ['Fizika'] },
    { teacherIdx: 2, subjects: ['Kimyo'] },
    { teacherIdx: 3, subjects: ['Biologiya', 'Organik kimyo'] },
    { teacherIdx: 4, subjects: ['Ingliz tili'] },
    { teacherIdx: 5, subjects: ['O\'zbek tili'] },
    { teacherIdx: 6, subjects: ['Informatika'] },
    { teacherIdx: 7, subjects: ['Tarix', 'Geografiya'] },
    { teacherIdx: 8, subjects: ['Algebra va analiz', 'Chizmachilik'] },
    { teacherIdx: 9, subjects: ['Dasturlash (Python)', 'Ma\'lumotlar bazasi'] },
  ];
  function findTeacher(subjectName: string): bigint | null {
    for (const ts of teacherSubjects) {
      if (ts.subjects.includes(subjectName)) return teachers[ts.teacherIdx].id;
    }
    return null;
  }

  const classRooms = ['101', '102', '103', '201', '202', '203', '301', '302'];
  for (const [gi, g] of groups.entries()) {
    const gDef = groupDefs[gi];
    let tt = await prisma.timetable.findFirst({ where: { group_id: g.id, academic_year_id: ayear.id } });
    if (!tt) {
      tt = await prisma.timetable.create({
        data: {
          tenant_id: tid,
          group_id: g.id,
          academic_year_id: ayear.id,
          name: `${g.name} - 2024/2025`,
          created_by_user_id: admin.id,
        },
      });
    }

    const groupSubs = [...coreSubjects, ...(trackSubjects[gDef.track] || [])];
    let lessonIdx = 0;
    for (let day = 1; day <= 5; day++) {
      const periodsCount = 8;
      for (let period = 1; period <= periodsCount; period++) {
        const subName = groupSubs[lessonIdx % groupSubs.length];
        const subId = subMap.get(subName);
        if (!subId) { lessonIdx++; continue; }
        const teacherId = findTeacher(subName);
        const exists = await prisma.timetable_lessons.findFirst({
          where: { timetable_id: tt.id, day_of_week: day, period_no: period },
        });
        if (!exists) {
          await prisma.timetable_lessons.create({
            data: {
              timetable_id: tt.id,
              day_of_week: day,
              period_no: period,
              subject_id: subId,
              teacher_user_id: teacherId,
              room: classRooms[(gi * 8 + period - 1) % classRooms.length],
            },
          });
        }
        lessonIdx++;
      }
    }
  }
  console.log('✅ Timetables');

  // ── 14. Students (60 real + 1 demo) ───────────────────────────────────────
  await prisma.student_id_sequences.upsert({
    where: { tenant_id: tid },
    update: { last_seq: 61 },
    create: { tenant_id: tid, last_seq: 61 },
  });

  const allStudents: any[] = [];
  let seqNum = 1;

  for (const [gi, g] of groups.entries()) {
    const gDef = groupDefs[gi];
    const trackId = trackMap.get(gDef.track);
    const isGrade11 = g.grade === 11;
    const admissionYear = isGrade11 ? 2023 : 2024;
    const gradYear = isGrade11 ? 2025 : 2026;

    for (let si = 0; si < 10; si++) {
      const { full_name, gender } = studentName(gi * 10 + si);
      const birthYear = 2007 + (si % 2);
      const loginId = `MA-${String(seqNum).padStart(4, '0')}`;
      const livingCode = ['DAY_ONLY', 'WEEKDAYS_ONLY', 'FULL_BOARD'][si % 3];

      let student = await prisma.students.findFirst({
        where: { tenant_id: tid, full_name, current_group_id: g.id },
      });
      if (!student) {
        student = await prisma.students.create({
          data: {
            tenant_id: tid,
            campus_id: campus.id,
            current_group_id: g.id,
            track_id: trackId,
            living_type_id: ltMap.get(livingCode),
            full_name,
            gender,
            birth_date: d(`${birthYear}-${String((si % 12) + 1).padStart(2, '0')}-${String((si % 28) + 1).padStart(2, '0')}`),
            admission_grade: g.grade,
            admission_date: d(`${admissionYear}-09-02`),
            expected_graduation_year: gradYear,
            status: 'ACTIVE',
            created_by_user_id: admin.id,
          },
        });
        // Group history
        await prisma.student_group_history.create({
          data: {
            tenant_id: tid,
            student_id: student.id,
            group_id: g.id,
            start_date: d(`${admissionYear}-09-02`),
            changed_by_user_id: admin.id,
          },
        });
      }

      // Guardian account
      const existingAcc = await prisma.student_accounts.findFirst({
        where: { tenant_id: tid, student_login_id: loginId },
      });
      if (!existingAcc) {
        await prisma.student_accounts.create({
          data: {
            tenant_id: tid,
            student_id: student.id,
            student_login_id: loginId,
            password_hash: guardianPw,
            must_change_password: false,
            is_active: true,
            profile_full_name: guardianName(full_name),
            profile_phone: `+9989012${String(seqNum).padStart(5, '0')}`,
            profile_relation: si % 3 === 0 ? 'ONA' : 'OTA',
            created_by_user_id: admin.id,
          },
        });
      }

      allStudents.push(student);
      seqNum++;
    }
  }

  // Demo student
  let demoStudent = await prisma.students.findFirst({ where: { tenant_id: tid, full_name: 'Demo O\'quvchi' } });
  if (!demoStudent) {
    demoStudent = await prisma.students.create({
      data: {
        tenant_id: tid,
        campus_id: campus.id,
        current_group_id: groups[0].id,
        track_id: trackMap.get('Matematika va Fizika'),
        living_type_id: ltMap.get('WEEKDAYS_ONLY'),
        full_name: 'Demo O\'quvchi',
        gender: 'MALE',
        birth_date: d('2008-01-15'),
        admission_grade: 10,
        admission_date: d('2024-09-02'),
        expected_graduation_year: 2026,
        status: 'ACTIVE',
        created_by_user_id: admin.id,
      },
    });
  }
  const demoAccExists = await prisma.student_accounts.findFirst({
    where: { tenant_id: tid, student_login_id: 'MA-DEMO' },
  });
  if (!demoAccExists) {
    await prisma.student_accounts.create({
      data: {
        tenant_id: tid,
        student_id: demoStudent.id,
        student_login_id: 'MA-DEMO',
        password_hash: demoGuardPw,
        must_change_password: false,
        is_active: true,
        profile_full_name: 'Demo Ota',
        profile_phone: '+998901000000',
        profile_relation: 'OTA',
        created_by_user_id: admin.id,
      },
    });
  }
  console.log(`✅ Students: ${allStudents.length} real + 1 demo`);

  // ── 15. Cohorts ────────────────────────────────────────────────────────────
  const cohort2025 = await prisma.cohorts.upsert({
    where: { tenant_id_label: { tenant_id: tid, label: 'Bitiruv 2025' } },
    update: {},
    create: { tenant_id: tid, label: 'Bitiruv 2025', graduation_year: 2025 },
  });
  const cohort2026 = await prisma.cohorts.upsert({
    where: { tenant_id_label: { tenant_id: tid, label: 'Bitiruv 2026' } },
    update: {},
    create: { tenant_id: tid, label: 'Bitiruv 2026', graduation_year: 2026 },
  });
  // Assign 11th grade to 2025, 10th to 2026
  for (const [gi, st] of allStudents.entries()) {
    const cohortId = gi < 30 ? cohort2025.id : cohort2026.id; // first 30 = 11th grade
    const exists = await prisma.student_cohort.findFirst({ where: { student_id: st.id } });
    if (!exists) {
      await prisma.student_cohort.create({
        data: { student_id: st.id, cohort_id: cohortId, assigned_by_user_id: admin.id },
      });
    }
  }
  console.log('✅ Cohorts');

  // ── 16. Attendance (8 hafta orqaga) ───────────────────────────────────────
  const workdays = workdaysBack(8); // ~40 ish kuni
  console.log(`📅 Attendance: ${workdays.length} kun...`);

  for (const g of groups) {
    const groupStudents = allStudents.filter(s => String(s.current_group_id) === String(g.id));
    for (const day of workdays) {

      let session = await prisma.attendance_sessions.findFirst({
        where: { group_id: g.id, session_date: day, type: 'MORNING', period_no: 0 },
      });
      if (!session) {
        session = await prisma.attendance_sessions.create({
          data: {
            tenant_id: tid,
            group_id: g.id,
            session_date: day,
            type: 'MORNING',
            period_no: 0,
            created_by_user_id: teachers[groups.indexOf(g) % teachers.length].id,
          },
        });
      }

      for (const [si, st] of groupStudents.entries()) {
        const existing = await prisma.attendance_marks.findFirst({
          where: { session_id: session.id, student_id: st.id },
        });
        if (!existing) {
          const seed = si + day.getDate() + day.getMonth();
          const status = seed % 15 === 0 ? 'ABSENT' : seed % 10 === 0 ? 'LATE' : 'PRESENT';
          await prisma.attendance_marks.create({
            data: { session_id: session.id, student_id: st.id, status },
          });
        }
      }
    }
  }
  console.log('✅ Attendance');

  // ── 17. Assessments + scores ───────────────────────────────────────────────
  const assessmentDefs = [
    { type: 'MONTHLY_TEST', title: '1-Oylik nazorat', date: '2024-10-15', maxScore: 100 },
    { type: 'MONTHLY_TEST', title: '2-Oylik nazorat', date: '2024-11-20', maxScore: 100 },
    { type: 'MONTHLY_TEST', title: '3-Oylik nazorat', date: '2025-01-15', maxScore: 100 },
    { type: 'MONTHLY_TEST', title: '4-Oylik nazorat', date: '2025-02-19', maxScore: 100 },
    { type: 'BLOCK_TEST',   title: '1-Blok test',    date: '2024-12-10', maxScore: 189 },
    { type: 'MOCK_EXAM',    title: 'Mock imtihon',   date: '2025-03-05', maxScore: 120 },
  ];

  for (const g of groups) {
    const gDef = groupDefs[groups.indexOf(g)];
    const groupSubs = [...coreSubjects, ...(trackSubjects[gDef.track] || [])].slice(0, 4);
    const groupStudents = allStudents.filter(s => String(s.current_group_id) === String(g.id));

    for (const sub of groupSubs) {
      const subId = subMap.get(sub);
      if (!subId) continue;

      for (const adef of assessmentDefs) {
        let assessment = await prisma.assessments.findFirst({
          where: { group_id: g.id, subject_id: subId, title: adef.title, type: adef.type },
        });
        if (!assessment) {
          assessment = await prisma.assessments.create({
            data: {
              tenant_id: tid,
              academic_year_id: ayear.id,
              group_id: g.id,
              subject_id: subId,
              type: adef.type,
              title: adef.title,
              max_score: adef.maxScore,
              held_at: d(`${adef.date}T09:00:00`),
              created_by_user_id: findTeacher(sub) ?? admin.id,
              is_published_to_guardians: true,
            },
          });
        }

        for (const [si, st] of groupStudents.entries()) {
          const existing = await prisma.assessment_scores.findFirst({
            where: { assessment_id: assessment.id, student_id: st.id },
          });
          if (!existing) {
            const score = randScore(
              Math.floor(adef.maxScore * 0.45),
              adef.maxScore,
              si + groups.indexOf(g) * 10,
            );
            await prisma.assessment_scores.create({
              data: {
                assessment_id: assessment.id,
                student_id: st.id,
                score,
                entered_by_user_id: findTeacher(sub) ?? admin.id,
              },
            });
          }
        }
      }
    }
  }
  console.log('✅ Assessments + scores');

  // ── 18. Events ─────────────────────────────────────────────────────────────
  const eventDefs = [
    { title: 'Yangi yil tadbirlari',           type: 'CELEBRATION',  start: '2024-12-28T10:00:00', end: '2024-12-28T14:00:00', desc: 'O\'quvchilar va o\'qituvchilar bilan birgalikda yangi yil bayrami' },
    { title: 'Ochiq dars (Matematika)',         type: 'ACADEMIC',     start: '2024-11-15T10:00:00', end: '2024-11-15T12:00:00', desc: 'Azimov Bahodir tomonidan o\'tkazilgan ochiq dars' },
    { title: 'Olimpiada tayyorlov seminari',    type: 'ACADEMIC',     start: '2025-01-20T09:00:00', end: '2025-01-20T17:00:00', desc: 'Respublika olimpiadasiga tayyorlov mashg\'uloti' },
    { title: 'Sport musobaqasi',                type: 'SPORT',        start: '2025-02-10T14:00:00', end: '2025-02-10T18:00:00', desc: 'Guruhlar o\'rtasidagi sport musobaqasi' },
    { title: 'Vatan himoyachilari kuni',        type: 'CELEBRATION',  start: '2025-01-14T10:00:00', end: '2025-01-14T12:00:00', desc: 'Bayram tadbiri' },
    { title: 'Xotira va Qadrlash kuni tadbirlari', type: 'CELEBRATION', start: '2025-05-09T10:00:00', end: '2025-05-09T12:00:00', desc: 'Yodgorlik marosimi' },
    { title: 'Navro\'z bayrami',               type: 'CELEBRATION',  start: '2025-03-21T09:00:00', end: '2025-03-21T15:00:00', desc: 'Milliy bayrami tadbirlari va ko\'rgazma' },
    { title: 'Ilmiy loyiha ko\'rgazmasi',      type: 'ACADEMIC',     start: '2025-04-05T10:00:00', end: '2025-04-05T16:00:00', desc: 'O\'quvchilar ilmiy ishlarining namoyishi' },
    { title: 'IT Hackathon 2025',               type: 'COMPETITION',  start: '2025-04-19T09:00:00', end: '2025-04-20T18:00:00', desc: '24 soatlik dasturlash musobaqasi' },
    { title: 'Bitiruv kechasi tayyorgarlik',    type: 'OTHER',        start: '2025-05-25T14:00:00', end: '2025-05-25T18:00:00', desc: 'Bitiruv kechasi uchun tayyorgarlik mashq' },
  ];
  for (const ev of eventDefs) {
    const exists = await prisma.events.findFirst({ where: { tenant_id: tid, title: ev.title } });
    if (!exists) {
      const event = await prisma.events.create({
        data: {
          tenant_id: tid,
          campus_id: campus.id,
          title: ev.title,
          event_type: ev.type,
          starts_at: d(ev.start),
          ends_at: d(ev.end),
          description: ev.desc,
          created_by_user_id: admin.id,
        },
      });
      // Add some participants (first 5 students per event)
      const participants = allStudents.slice(ev.type === 'SPORT' ? 10 : 0, 5);
      for (const st of participants) {
        await prisma.event_participants.create({
          data: { event_id: event.id, student_id: st.id, role: 'PARTICIPANT' },
        }).catch(() => {});
      }
    }
  }
  console.log('✅ Events: 10 ta');

  // ── 19. Competitions ───────────────────────────────────────────────────────
  const compDefs = [
    {
      title: 'Matematika olimpiadasi 2025',
      mode: 'INDIVIDUAL',
      start: '2025-02-01T09:00:00',
      end: '2025-02-01T12:00:00',
      rules: 'Har bir o\'quvchi mustaqil ishtirok etadi. 3 soat vaqt beriladi.',
    },
    {
      title: 'Respublika kimyo musobaqasi',
      mode: 'INDIVIDUAL',
      start: '2025-03-10T09:00:00',
      end: '2025-03-10T13:00:00',
      rules: 'Nazariy va amaliy qismdan iborat.',
    },
    {
      title: 'IT Guruh loyiha konkursi',
      mode: 'TEAM',
      start: '2025-04-15T09:00:00',
      end: '2025-04-15T18:00:00',
      rules: 'Jamoaviy loyiha taqdimoti. Har jamoada 3-5 a\'zo.',
    },
  ];
  for (const c of compDefs) {
    const exists = await prisma.competitions.findFirst({ where: { tenant_id: tid, title: c.title } });
    if (!exists) {
      const comp = await prisma.competitions.create({
        data: {
          tenant_id: tid,
          title: c.title,
          mode: c.mode,
          starts_at: d(c.start),
          ends_at: d(c.end),
          rules: c.rules,
        },
      });
      // Add 5 entries with results
      const entryStudents = allStudents.slice(0, 5);
      for (const [ri, st] of entryStudents.entries()) {
        const entry = await prisma.competition_entries.create({
          data: {
            competition_id: comp.id,
            entry_type: 'INDIVIDUAL',
            student_id: st.id,
            name_display: st.full_name,
          },
        });
        await prisma.competition_results.create({
          data: {
            competition_id: comp.id,
            entry_id: entry.id,
            rank: ri + 1,
            score: 95 - ri * 5,
            prize: ri === 0 ? '1-o\'rin (Oltin medal)' : ri === 1 ? '2-o\'rin (Kumush medal)' : ri === 2 ? '3-o\'rin (Bronza medal)' : null,
          },
        }).catch(() => {});
      }
    }
  }
  console.log('✅ Competitions: 3 ta');

  // ── 20. Awards ─────────────────────────────────────────────────────────────
  const awardDefs = [
    { type: 'SCHOLARSHIP', title: 'Prezident stipendiyasi', desc: 'Akademik yutuqlari uchun', amount: 1500000, studentIdx: 0 },
    { type: 'CERTIFICATE', title: 'Matematika olimpiadasi g\'olibi', desc: '1-o\'rin', amount: null, studentIdx: 0 },
    { type: 'CERTIFICATE', title: 'Kimyo musobaqasi g\'olibi',       desc: '2-o\'rin', amount: null, studentIdx: 30 },
    { type: 'SCHOLARSHIP', title: 'Maktab stipendiyasi',              desc: 'Har oylik targ\'ib', amount: 500000, studentIdx: 10 },
    { type: 'TROPHY',      title: 'Sport musobaqasi g\'olibi',        desc: 'Voleybol', amount: null, studentIdx: 20 },
  ];
  for (const aw of awardDefs) {
    const exists = await prisma.awards.findFirst({ where: { tenant_id: tid, title: aw.title } });
    if (!exists) {
      const award = await prisma.awards.create({
        data: {
          tenant_id: tid,
          award_type: aw.type,
          title: aw.title,
          description: aw.desc,
          value_amount: aw.amount,
          issued_at: new Date(),
          issued_by_user_id: admin.id,
        },
      });
      const st = allStudents[aw.studentIdx];
      await prisma.award_recipients.create({
        data: {
          award_id: award.id,
          recipient_type: 'INDIVIDUAL',
          student_id: st.id,
          group_id: st.current_group_id,
        },
      }).catch(() => {});
    }
  }
  console.log('✅ Awards: 5 ta');

  // ── 21. Certificates ───────────────────────────────────────────────────────
  const certDefs = [
    { studentIdx: 0,  title: 'IELTS 7.5',          issuer: 'British Council',   score: '7.5',  subject: 'Ingliz tili' },
    { studentIdx: 5,  title: 'SAT Math 800',        issuer: 'College Board',     score: '800',  subject: 'Matematika' },
    { studentIdx: 10, title: 'Python Developer',    issuer: 'Coursera',          score: '95%',  subject: 'Dasturlash (Python)' },
    { studentIdx: 15, title: 'Kimyo olimpiadasi',   issuer: 'XTI',               score: '3-o\'rin', subject: 'Kimyo' },
    { studentIdx: 20, title: 'IELTS 6.5',           issuer: 'British Council',   score: '6.5',  subject: 'Ingliz tili' },
    { studentIdx: 30, title: 'AMC 10 Musobaqasi',   issuer: 'MAA',               score: '110',  subject: 'Matematika' },
    { studentIdx: 35, title: 'Biologiya fanlari',   issuer: 'Respublika musobaqa', score: '2-o\'rin', subject: 'Biologiya' },
  ];
  for (const c of certDefs) {
    const st = allStudents[c.studentIdx];
    const subId = subMap.get(c.subject);
    const exists = await prisma.certificates.findFirst({
      where: { tenant_id: tid, student_id: st.id, title: c.title },
    });
    if (!exists) {
      await prisma.certificates.create({
        data: {
          tenant_id: tid,
          student_id: st.id,
          title: c.title,
          subject_id: subId,
          issuer: c.issuer,
          score: c.score,
          issued_at: d('2024-11-01'),
        },
      });
    }
  }
  console.log('✅ Certificates: 7 ta');

  // ── 22. Leave requests ─────────────────────────────────────────────────────
  const leaveDefs = [
    { sIdx: 2,  reason: 'Tibbiy muolaja (shifokor yorlig\'i bilan)',    start: '2025-01-13', end: '2025-01-15', status: 'APPROVED' },
    { sIdx: 5,  reason: 'Oilaviy marosim — katta aka to\'yi',          start: '2025-02-03', end: '2025-02-04', status: 'APPROVED' },
    { sIdx: 12, reason: 'Grippe kasalligi',                              start: '2025-03-10', end: '2025-03-14', status: 'APPROVED' },
    { sIdx: 18, reason: 'Xalqaro olimpiadaga sayohat (Toshkent)',        start: '2025-02-20', end: '2025-02-22', status: 'APPROVED' },
    { sIdx: 25, reason: 'Og\'iz tish muolajasi',                        start: '2025-03-05', end: '2025-03-05', status: 'APPROVED' },
    { sIdx: 33, reason: 'Gripp kasalligi',                               start: '2025-04-01', end: '2025-04-03', status: 'PENDING'  },
    { sIdx: 40, reason: 'Sport musobaqasi (viloyat bosqichi)',           start: '2025-04-10', end: '2025-04-11', status: 'PENDING'  },
    { sIdx: 50, reason: 'Oilaviy holat',                                 start: '2025-05-02', end: '2025-05-02', status: 'PENDING'  },
  ];
  for (const l of leaveDefs) {
    const st = allStudents[l.sIdx];
    const exists = await prisma.leave_requests.findFirst({
      where: { tenant_id: tid, student_id: st.id, reason: l.reason },
    });
    if (!exists) {
      await prisma.leave_requests.create({
        data: {
          tenant_id: tid,
          student_id: st.id,
          requested_by: 'GUARDIAN',
          reason: l.reason,
          start_at: d(`${l.start}T08:00:00`),
          end_at: d(`${l.end}T17:00:00`),
          status: l.status,
          approved_by_user_id: l.status === 'APPROVED' ? admin.id : null,
          approved_at: l.status === 'APPROVED' ? d(`${l.start}T07:00:00`) : null,
        },
      });
    }
  }
  console.log('✅ Leave requests: 8 ta');

  // ── 23. Discipline actions ─────────────────────────────────────────────────
  const disciplineDefs = [
    { sIdx: 7,  type: 'WARNING',    reason: 'Dars vaqtida telefon ishlatish (3-marta)' },
    { sIdx: 14, type: 'REPRIMAND',  reason: 'Sinfdoshiga nisbatan to\'g\'ri kelmaydigan so\'z ishlatish' },
    { sIdx: 22, type: 'WARNING',    reason: 'Uy vazifasini ketma-ket 3 marta topshirmaslik' },
    { sIdx: 38, type: 'SUSPENSION', reason: 'Akademik halolsizlik — boshqasidan ko\'chirish' },
    { sIdx: 45, type: 'WARNING',    reason: 'Kech kelish (hafta ichida 3 marotaba)' },
  ];
  for (const dd of disciplineDefs) {
    const st = allStudents[dd.sIdx];
    const exists = await prisma.discipline_actions.findFirst({
      where: { tenant_id: tid, student_id: st.id, reason: dd.reason },
    });
    if (!exists) {
      const da = await prisma.discipline_actions.create({
        data: {
          tenant_id: tid,
          student_id: st.id,
          action_type: dd.type,
          reason: dd.reason,
          issued_by_user_id: teachers[0].id,
          is_active: true,
        },
      });
      await prisma.violations.create({
        data: {
          tenant_id: tid,
          student_id: st.id,
          rule_code: dd.type,
          description: dd.reason,
          severity: dd.type === 'SUSPENSION' ? 'HIGH' : dd.type === 'REPRIMAND' ? 'MEDIUM' : 'LOW',
          detected_at: new Date(),
          recorded_by_user_id: teachers[0].id,
          linked_discipline_action_id: da.id,
        },
      });
    }
  }
  console.log('✅ Discipline actions: 5 ta');

  // ── 24. Risk scores ────────────────────────────────────────────────────────
  const riskDefs = [
    { sIdx: 7,  score: 72, level: 'YELLOW', signals: 'Devona intizom, ba\'zi fanlardan past ball' },
    { sIdx: 14, score: 85, level: 'RED',    signals: 'Intizom buzilishi, davomat muammosi' },
    { sIdx: 22, score: 65, level: 'YELLOW', signals: 'Uy vazifalari topshirilmayapti' },
    { sIdx: 38, score: 90, level: 'RED',    signals: 'Akademik halolsizlik qayd etildi' },
  ];
  for (const r of riskDefs) {
    const st = allStudents[r.sIdx];
    const exists = await prisma.student_risk_scores.findFirst({ where: { tenant_id: tid, student_id: st.id } });
    if (!exists) {
      await prisma.student_risk_scores.create({
        data: {
          tenant_id: tid,
          student_id: st.id,
          score: r.score,
          level: r.level,
          signals: r.signals,
        },
      });
    }
  }
  console.log('✅ Risk scores: 4 ta');

  // ── 25. Student outcomes (11-sinf) ─────────────────────────────────────────
  const outcomeDefs = [
    { sIdx: 0,  status: 'ADMITTED',      inst: 'TATU',       faculty: 'Dasturiy muhandislik' },
    { sIdx: 1,  status: 'ADMITTED',      inst: 'NUUz',       faculty: 'Matematika' },
    { sIdx: 2,  status: 'ADMITTED',      inst: 'Turin Poly.', faculty: 'Kompyuter fanlari' },
    { sIdx: 5,  status: 'PENDING',       inst: 'MIT',        faculty: 'Mathematics' },
    { sIdx: 10, status: 'ADMITTED',      inst: 'TATU',       faculty: 'Kiberxavfsizlik' },
    { sIdx: 15, status: 'ADMITTED',      inst: 'ToshDTU',    faculty: 'Muhandislik' },
    { sIdx: 20, status: 'GAP_YEAR',      inst: null,         faculty: null },
    { sIdx: 25, status: 'ADMITTED',      inst: 'TDPU',       faculty: 'Kimyo' },
    { sIdx: 29, status: 'NOT_ADMITTED',  inst: null,         faculty: null },
  ];
  for (const o of outcomeDefs) {
    const st = allStudents[o.sIdx];
    const exists = await prisma.student_outcomes.findFirst({ where: { tenant_id: tid, student_id: st.id } });
    if (!exists) {
      await prisma.student_outcomes.create({
        data: {
          tenant_id: tid,
          student_id: st.id,
          outcome_status: o.status,
          institution_name: o.inst,
          faculty_or_program: o.faculty,
          decision_date: d('2025-08-15'),
          created_by_user_id: admin.id,
        },
      });
    }
  }
  console.log('✅ Student outcomes: 9 ta (11-sinf)');

  // ── 26. Invoices + payments (ba'zi o'quvchilar uchun) ─────────────────────
  for (const [si, st] of allStudents.slice(0, 20).entries()) {
    const existing = await prisma.invoices.findFirst({ where: { tenant_id: tid, student_id: st.id } });
    if (!existing) {
      const amount = [1200000, 1500000, 800000][si % 3];
      const status = si % 4 === 0 ? 'PAID' : si % 4 === 1 ? 'PARTIALLY_PAID' : 'PENDING';
      const inv = await prisma.invoices.create({
        data: {
          tenant_id: tid,
          student_id: st.id,
          type: 'TUITION',
          period_start: d('2025-01-01'),
          period_end: d('2025-03-31'),
          amount,
          currency: 'UZS',
          status,
          due_date: d('2025-01-31'),
          created_by_user_id: admin.id,
        },
      });
      if (status !== 'PENDING') {
        await prisma.payments.create({
          data: {
            tenant_id: tid,
            invoice_id: inv.id,
            source: 'MANUAL',
            paid_amount: status === 'PAID' ? amount : amount / 2,
            method: si % 2 === 0 ? 'CASH' : 'TRANSFER',
            paid_at: d('2025-01-10'),
            created_by_user_id: admin.id,
            received_by_user_id: admin.id,
          },
        });
      }
    }
  }
  console.log('✅ Invoices + payments: 20 ta');

  // ── 27. Announcements ──────────────────────────────────────────────────────
  const announcementDefs = [
    {
      audience: 'ALL', title: 'Yangi o\'quv yili boshlanishi haqida', is_published: true,
      body: '2024-2025 o\'quv yili 2-sentabrdan boshlanadi. Barcha o\'quvchilar va ota-onalar e\'tiboriga!',
    },
    {
      audience: 'STAFF', title: 'O\'qituvchilar majlisi', is_published: true,
      body: '25-yanvar kuni soat 14:00 da barcha o\'qituvchilar majlisi bo\'lib o\'tadi. Qatnashish majburiy.',
    },
    {
      audience: 'GUARDIAN', title: 'Oylik to\'lov eslatmasi', is_published: true,
      body: 'Fevral oyi to\'lovlarini o\'z vaqtida amalga oshirishingizni so\'raymiz. Muddati: 10-fevral.',
    },
    {
      audience: 'ALL', title: 'Navro\'z bayrami tadbirlari', is_published: true,
      body: '21-mart kuni Navro\'z bayrami munosabati bilan maxsus tadbirlar bo\'lib o\'tadi. Barchani taklif etamiz!',
    },
    {
      audience: 'STAFF', title: 'Imtihon jadvali e\'lon qilindi', is_published: true,
      body: 'May oyidagi yakuniy imtihonlar jadvali e\'lon qilindi. Batafsil ma\'lumot admin sahifasida.',
    },
  ];
  for (const a of announcementDefs) {
    const exists = await prisma.announcements.findFirst({ where: { tenant_id: tid, title: a.title } });
    if (!exists) {
      await prisma.announcements.create({
        data: {
          tenant_id: tid,
          audience: a.audience,
          title: a.title,
          body: a.body,
          is_published: a.is_published,
          published_at: a.is_published ? new Date() : null,
          created_by_user_id: admin.id,
        },
      });
    }
  }
  console.log('✅ Announcements: 5 ta');

  // ── 28. Displays ───────────────────────────────────────────────────────────
  const displayDefs = [
    { name: 'Kirish holi ekrani',    location: 'Bosh kirish — 1-qavat' },
    { name: 'Kutubxona ekrani',      location: '2-qavat kutubxona' },
    { name: 'Sport zali ekrani',     location: 'Sport zali old tomoni' },
  ];
  for (const dd of displayDefs) {
    const exists = await prisma.displays.findFirst({ where: { tenant_id: tid, name: dd.name } });
    if (!exists) {
      await prisma.displays.create({
        data: { tenant_id: tid, campus_id: campus.id, name: dd.name, location_desc: dd.location, is_active: true },
      });
    }
  }
  console.log('✅ Displays: 3 ta');

  // ── 29. Dorm assignments (20 o'quvchi) ────────────────────────────────────
  const dormStudents = allStudents.filter((s, i) => i % 3 !== 0).slice(0, 20);
  for (const [ri, st] of dormStudents.entries()) {
    const dormRoomId = dormRoomIds[ri % dormRoomIds.length];
    const exists = await prisma.student_room_assignments.findFirst({
      where: { tenant_id: tid, student_id: st.id },
    });
    if (!exists) {
      await prisma.student_room_assignments.create({
        data: {
          tenant_id: tid,
          student_id: st.id,
          room_id: dormRoomId,
          start_date: d('2024-09-02'),
          assigned_by_user_id: admin.id,
        },
      });
    }
  }
  console.log('✅ Dorm assignments: ~20 ta');

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60));
  console.log('✅  SEED MUVAFFAQIYATLI YAKUNLANDI!');
  console.log('═'.repeat(60));
  // Logins are printed; passwords are not. They live in the environment
  // (SEED_* keys) or, outside production, in .env.example.
  console.log('\n📌  YARATILGAN HISOBLAR (loginlar):\n');
  console.log('🔴  SUPERADMIN     : admin                  → SEED_ADMIN_PASSWORD');
  console.log('👁️   DEMO ADMIN     : demo                   → SEED_DEMO_PASSWORD  (read-only)');
  console.log(`🔴  O'QITUVCHILAR  : ${teacherDefs.length} ta (teacher.001…)   → SEED_TEACHER_PASSWORD`);
  console.log('👁️   DEMO O\'QITUVCHI: demo.teacher           → SEED_DEMO_PASSWORD  (read-only)');
  console.log('👨‍👩‍👧  GUARDIAN       : MA-0001 … MA-0060      → SEED_GUARDIAN_PASSWORD');
  console.log('👁️   DEMO GUARDIAN  : MA-DEMO                → SEED_DEMO_PASSWORD  (read-only)');
  console.log('\n    Guardian login formati: <tenant-slug>-<student-id>, masalan mathacademy-MA-0001');

  if (!IS_PRODUCTION) {
    console.log('\n⚠️   Bu demo parollar. Ular faqat local/demo uchun.');
    console.log('    Production\'da har bir SEED_* qiymati env orqali berilishi shart.');
  }
  console.log('\n' + '═'.repeat(60));
}

main()
  .catch(e => { console.error('❌ Seed xatosi:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
