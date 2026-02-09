import { PrismaClient, Prisma } from '@prisma/client';
import type { subjects, permissions } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import * as path from 'path';
import { config as dotenvConfig } from 'dotenv';
dotenvConfig({ path: path.join(__dirname, '..', '.env') });

const connectionString = String(process.env.DATABASE_URL || '').trim();
if (!connectionString) {
  throw new Error('DATABASE_URL is missing. Check apps/api/.env');
}

type Tx = Prisma.TransactionClient;

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

function envStr(key: string, fallback: string) {
  const v = String(process.env[key] || '').trim();
  return v || fallback;
}
function envInt(key: string, fallback: number) {
  const n = Number(process.env[key] || '');
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

async function ensurePermission(tx: Tx, code: string, description?: string) {
  const existing = await tx.permissions.findUnique({ where: { code } });
  if (existing) return existing;
  return tx.permissions.create({ data: { code, description } });
}

async function ensureRole(tx: Tx, tenantId: bigint, name: string) {
  const existing = await tx.roles.findFirst({
    where: { tenant_id: tenantId, name },
  });
  if (existing) return existing;
  return tx.roles.create({ data: { tenant_id: tenantId, name } });
}

async function main() {
  const TENANT_SLUG = envStr('SEED_TENANT_SLUG', 'mathacademy');
  const TENANT_NAME = envStr('SEED_TENANT_NAME', 'Mathacademy');

  const ADMIN_USERNAME = envStr('SEED_ADMIN_USERNAME', 'admin');
  const ADMIN_PASSWORD = envStr('SEED_ADMIN_PASSWORD', 'pass1234');

  const TEACHER_USERNAME = envStr('SEED_TEACHER_USERNAME', 'teacher1');
  const TEACHER_PASSWORD = envStr('SEED_TEACHER_PASSWORD', 'pass1234');

  const GUARDIAN_PASSWORD = envStr('SEED_GUARDIAN_PASSWORD', 'pass1234');

  const BCRYPT_ROUNDS = envInt('BCRYPT_ROUNDS', 10);

  const result = await prisma.$transaction(async (tx) => {
    // TENANT
    const tenant =
      (await tx.tenants.findUnique({ where: { slug: TENANT_SLUG } })) ??
      (await tx.tenants.create({
        data: {
          slug: TENANT_SLUG,
          name: TENANT_NAME,
          timezone: 'Asia/Tashkent',
        },
      }));
    const tenantId = tenant.id;

    // CAMPUS
    const campus =
      (await tx.campuses.findFirst({
        where: { tenant_id: tenantId, name: 'Main Campus' },
      })) ??
      (await tx.campuses.create({
        data: { tenant_id: tenantId, name: 'Main Campus', is_active: true },
      }));

    // ACADEMIC YEAR (CURRENT)
    let year = await tx.academic_years.findFirst({
      where: { tenant_id: tenantId, is_current: true },
    });
    if (!year) {
      year =
        (await tx.academic_years.findFirst({
          where: { tenant_id: tenantId, name: '2025-2026' },
        })) ??
        (await tx.academic_years.create({
          data: {
            tenant_id: tenantId,
            name: '2025-2026',
            start_date: new Date('2025-09-01'),
            end_date: new Date('2026-06-30'),
            is_current: true,
          },
        }));

      await tx.academic_years.updateMany({
        where: { tenant_id: tenantId, id: { not: year.id } },
        data: { is_current: false },
      });
    }

    // LIVING TYPES
    const livingSeed = [
      {
        code: 'DAY_ONLY',
        name: 'Home commuter (faqat obed)',
        description: 'Uyidan qatnaydigan o‘quvchi (faqat tushlik).',
      },
      {
        code: 'WEEKDAYS_ONLY',
        name: 'Weekday resident (Dushanba–Juma)',
        description: 'Hafta ichida yotoqxonada qoladi (Dushanba–Juma).',
      },
      {
        code: 'FULL_BOARD',
        name: 'Full resident (7 kun)',
        description: 'Haftaning 7 kuni yotoqxonada qoladi.',
      },
    ] as const;

    for (const lt of livingSeed) {
      const ex = await tx.living_types.findFirst({
        where: { tenant_id: tenantId, code: lt.code },
      });
      if (!ex) {
        await tx.living_types.create({
          data: {
            tenant_id: tenantId,
            code: lt.code,
            name: lt.name,
            description: lt.description,
            is_active: true,
          },
        });
      }
    }

    const livingFull = await tx.living_types.findFirst({
      where: { tenant_id: tenantId, code: 'FULL_BOARD' },
    });

    // TRACK + COHORT
    const track =
      (await tx.student_tracks.findFirst({
        where: { tenant_id: tenantId, name: 'General Track' },
      })) ??
      (await tx.student_tracks.create({
        data: {
          tenant_id: tenantId,
          name: 'General Track',
          description: 'Default track',
        },
      }));

    const cohort =
      (await tx.cohorts.findFirst({
        where: { tenant_id: tenantId, label: 'Bitiruvchi-2026' },
      })) ??
      (await tx.cohorts.create({
        data: {
          tenant_id: tenantId,
          label: 'Bitiruvchi-2026',
          graduation_year: 2026,
        },
      }));

    // SUBJECTS (MUHIM: typed array -> never[] bo‘lmasin)
    const subjects = ['Matematika', 'Ingliz tili', 'Fizika'];
    const subjectRows: Prisma.subjectsUncheckedCreateInput[] = []; // ✅ type bor

    const createdSubjects: subjects[] = [];
    for (const s of subjects) {
      const row =
        (await tx.subjects.findFirst({
          where: { tenant_id: tenantId, name: s },
        })) ??
        (await tx.subjects.create({
          data: { tenant_id: tenantId, name: s, is_core: true },
        }));
      createdSubjects.push(row);
      subjectRows.push({
        tenant_id: tenantId,
        name: row.name,
        is_core: row.is_core,
      });
    }

    // PERMISSIONS (typed)
    const permCodes = [
      'students.read',
      'students.write',
      'groups.read',
      'groups.write',
      'attendance.read',
      'attendance.write',
      'assessments.read',
      'assessments.write',
      'ranking.read',
      'risk.read',
      'billing.read',
      'billing.write',
      'notifications.read',
      'notifications.write',
      'events.read',
      'competitions.read',
      'awards.read',
      'displays.read',
    ];

    const permRows: Prisma.permissionsUncheckedCreateInput[] = []; // ✅ type bor
    const createdPerms: permissions[] = [];
    for (const code of permCodes) {
      const p = await ensurePermission(tx, code, code);
      createdPerms.push(p);
      permRows.push({ code: p.code, description: p.description ?? null });
    }

    // ROLES
    const superadminRole = await ensureRole(tx, tenantId, 'SUPERADMIN');
    const adminRole = await ensureRole(tx, tenantId, 'ADMIN');
    const teacherRole = await ensureRole(tx, tenantId, 'TEACHER');

    // role_permissions (SUPERADMIN -> hammasi)
    for (const p of createdPerms) {
      await tx.role_permissions.upsert({
        where: {
          role_id_permission_id: {
            role_id: superadminRole.id,
            permission_id: p.id,
          },
        },
        create: { role_id: superadminRole.id, permission_id: p.id },
        update: {},
      });
      await tx.role_permissions.upsert({
        where: {
          role_id_permission_id: { role_id: adminRole.id, permission_id: p.id },
        },
        create: { role_id: adminRole.id, permission_id: p.id },
        update: {},
      });
    }

    // teacher minimal perms
    const teacherAllow = new Set([
      'students.read',
      'groups.read',
      'attendance.read',
      'attendance.write',
      'assessments.read',
      'assessments.write',
      'ranking.read',
    ]);
    for (const p of createdPerms) {
      if (!teacherAllow.has(p.code)) continue;
      await tx.role_permissions.upsert({
        where: {
          role_id_permission_id: {
            role_id: teacherRole.id,
            permission_id: p.id,
          },
        },
        create: { role_id: teacherRole.id, permission_id: p.id },
        update: {},
      });
    }

    // USERS
    const adminHash = await bcrypt.hash(ADMIN_PASSWORD, BCRYPT_ROUNDS);
    const teacherHash = await bcrypt.hash(TEACHER_PASSWORD, BCRYPT_ROUNDS);

    const adminUser =
      (await tx.users.findFirst({
        where: { tenant_id: tenantId, username: ADMIN_USERNAME },
      })) ??
      (await tx.users.create({
        data: {
          tenant_id: tenantId,
          username: ADMIN_USERNAME,
          password_hash: adminHash,
          full_name: 'Director (Superadmin)',
          is_active: true,
        },
      }));

    const teacherUser =
      (await tx.users.findFirst({
        where: { tenant_id: tenantId, username: TEACHER_USERNAME },
      })) ??
      (await tx.users.create({
        data: {
          tenant_id: tenantId,
          username: TEACHER_USERNAME,
          password_hash: teacherHash,
          full_name: 'Teacher 1',
          is_active: true,
        },
      }));

    await tx.user_roles.upsert({
      where: {
        user_id_role_id: { user_id: adminUser.id, role_id: superadminRole.id },
      },
      create: { user_id: adminUser.id, role_id: superadminRole.id },
      update: {},
    });

    await tx.user_roles.upsert({
      where: {
        user_id_role_id: { user_id: teacherUser.id, role_id: teacherRole.id },
      },
      create: { user_id: teacherUser.id, role_id: teacherRole.id },
      update: {},
    });

    // GROUP
    const group =
      (await tx.groups.findFirst({
        where: { tenant_id: tenantId, academic_year_id: year.id, name: '10-A' },
      })) ??
      (await tx.groups.create({
        data: {
          tenant_id: tenantId,
          academic_year_id: year.id,
          campus_id: campus.id,
          track_id: track.id,
          name: '10-A',
          grade: 10,
          curator_user_id: teacherUser.id,
        },
      }));

    // group_subjects
    for (const s of createdSubjects) {
      await tx.group_subjects.upsert({
        where: {
          group_id_subject_id: { group_id: group.id, subject_id: s.id },
        },
        create: { group_id: group.id, subject_id: s.id },
        update: {},
      });
    }

    // STUDENT + GUARDIAN ACCOUNT
    const student =
      (await tx.students.findFirst({
        where: { tenant_id: tenantId, full_name: 'Test Student' },
      })) ??
      (await tx.students.create({
        data: {
          tenant_id: tenantId,
          campus_id: campus.id,
          current_group_id: group.id,
          track_id: track.id,
          living_type_id: livingFull?.id ?? null,
          full_name: 'Test Student',
          admission_grade: 10,
          admission_date: new Date('2025-09-01'),
          expected_graduation_year: 2026,
          status: 'ACTIVE',
          created_by_user_id: adminUser.id,
        },
      }));

    // cohort link
    await tx.student_cohort.upsert({
      where: { student_id: student.id },
      create: {
        student_id: student.id,
        cohort_id: cohort.id,
        assigned_by_user_id: adminUser.id,
      },
      update: { cohort_id: cohort.id },
    });

    // student_id_sequences
    await tx.student_id_sequences.upsert({
      where: { tenant_id: tenantId },
      create: { tenant_id: tenantId, last_seq: 1 },
      update: { last_seq: 1, updated_at: new Date() },
    });

    // history
    await tx.student_group_history.create({
      data: {
        tenant_id: tenantId,
        student_id: student.id,
        group_id: group.id,
        start_date: new Date('2025-09-01'),
        changed_by_user_id: adminUser.id,
      },
    });

    if (livingFull?.id) {
      await tx.student_living_history.create({
        data: {
          tenant_id: tenantId,
          student_id: student.id,
          living_type_id: livingFull.id,
          start_date: new Date('2025-09-01'),
          changed_by_user_id: adminUser.id,
          note: 'Seed',
        },
      });
    }

    const guardianHash = await bcrypt.hash(GUARDIAN_PASSWORD, BCRYPT_ROUNDS);
    const studentAccount =
      (await tx.student_accounts.findFirst({
        where: { tenant_id: tenantId, student_id: student.id },
      })) ??
      (await tx.student_accounts.create({
        data: {
          tenant_id: tenantId,
          student_id: student.id,
          student_login_id: '000001',
          password_hash: guardianHash,
          must_change_password: true,
          is_active: true,
          created_by_user_id: adminUser.id,
        },
      }));

    return { tenant, adminUser, teacherUser, student, studentAccount };
  });

  console.log('✅ Seed done');
  console.log('STAFF login:');
  console.log({
    tenantSlug: result.tenant.slug,
    username: 'admin',
    password: 'pass1234',
  });
  console.log('GUARDIAN login:');
  console.log({
    studentId: `${result.tenant.slug}-000001`,
    password: 'pass1234',
  });
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
