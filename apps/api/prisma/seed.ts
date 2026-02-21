import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import { config } from 'dotenv';
import * as path from 'path';

// .env faylini yuklash (apps/api/.env)
const envPath = path.join(__dirname, '..', '.env');
console.log('🔍 Loading .env from:', envPath);
config({ path: envPath });

// DATABASE_URL mavjudligini tekshirish
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.trim() === '') {
  console.error('❌ DATABASE_URL environment variable is not set or empty');
  console.error('Please make sure apps/api/.env file exists with DATABASE_URL');
  process.exit(1);
}
console.log(
  '✅ DATABASE_URL found (first 20 chars):',
  process.env.DATABASE_URL.substring(0, 20) + '...',
);

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  // 1. Tenant
  const tenant = await prisma.tenants.upsert({
    where: { slug: 'mathacademy' },
    update: {},
    create: {
      slug: 'mathacademy',
      name: 'Mathacademy',
      timezone: 'Asia/Tashkent',
    },
  });

  // 2. Permissions
  const permissions = [
    // Generated from all RequirePermissions() occurrences in controllers
    'academic_years.delete',
    'academic_years.read',
    'academic_years.write',
    'announcements.read',
    'announcements.write',
    'assessments.read',
    'assessments.write',
    'attendance.read',
    'attendance.write',
    'awards.read',
    'awards.write',
    'billing.read',
    'billing.write',
    'campuses.read',
    'campuses.write',
    'certificates.read',
    'certificates.write',
    'cohorts.read',
    'cohorts.write',
    'competitions.read',
    'competitions.write',
    'discipline.read',
    'discipline.write',
    'displays.read',
    'displays.write',
    'dorms.assign',
    'dorms.read',
    'dorms.write',
    'events.read',
    'events.write',
    'files.read',
    'files.write',
    'groups.read',
    'groups.write',
    'leaves.read',
    'leaves.write',
    'notifications.read',
    'notifications.write',
    'outcomes.read',
    'outcomes.write',
    'permissions.manage',
    'permissions.view',
    'ranking.read',
    'ranking.write',
    'risk.read',
    'risk.write',
    'roles.manage',
    'roles.view',
    'students.read',
    'students.write',
    'subjects.read',
    'subjects.write',
    'timetable.read',
    'timetable.write',
    'tracks.read',
    'tracks.write',
    'users.manage',
    'users.view',
  ];

  const permissionRecords: any[] = [];

  for (const code of permissions) {
    const perm = await prisma.permissions.upsert({
      where: { code },
      update: {},
      create: { code, description: code },
    });
    permissionRecords.push(perm);
  }

  // 3. Rollar
  const superadminRole = await prisma.roles.upsert({
    where: { tenant_id_name: { tenant_id: tenant.id, name: 'SUPERADMIN' } },
    update: {},
    create: { tenant_id: tenant.id, name: 'SUPERADMIN' },
  });

  const adminRole = await prisma.roles.upsert({
    where: { tenant_id_name: { tenant_id: tenant.id, name: 'ADMIN' } },
    update: {},
    create: { tenant_id: tenant.id, name: 'ADMIN' },
  });

  const teacherRole = await prisma.roles.upsert({
    where: { tenant_id_name: { tenant_id: tenant.id, name: 'TEACHER' } },
    update: {},
    create: { tenant_id: tenant.id, name: 'TEACHER' },
  });

  const assistantTeacherRole = await prisma.roles.upsert({
    where: {
      tenant_id_name: { tenant_id: tenant.id, name: 'ASSISTANT_TEACHER' },
    },
    update: {},
    create: { tenant_id: tenant.id, name: 'ASSISTANT_TEACHER' },
  });

  for (const perm of permissionRecords) {
    await prisma.role_permissions.upsert({
      where: {
        role_id_permission_id: {
          role_id: superadminRole.id,
          permission_id: perm.id,
        },
      },
      update: {},
      create: {
        role_id: superadminRole.id,
        permission_id: perm.id,
      },
    });
  }

  // Default permission sets (Superadmin can later customize)
  const allCodes = new Set(permissionRecords.map((p) => p.code));
  const denyAdmin = new Set(['permissions.manage', 'roles.manage', 'users.manage']);

  const teacherAllow = new Set([
    'students.read',
    'groups.read',
    'campuses.read',
    'subjects.read',
    'tracks.read',
    'academic_years.read',
    'cohorts.read',
    'timetable.read',
    'attendance.read',
    'attendance.write',
    'assessments.read',
    'assessments.write',
    'ranking.read',
    'risk.read',
    'discipline.read',
    'discipline.write',
    'leaves.read',
    'events.read',
    'competitions.read',
    'awards.read',
    'announcements.read',
    'files.read',
  ]);

  const assistantAllow = new Set([
    ...teacherAllow,
    'files.write',
    'events.write',
  ]);

  async function attachPerms(roleId: bigint, allowCodes: Set<string>) {
    const perms = permissionRecords.filter((p) => allowCodes.has(p.code));
    for (const perm of perms) {
      await prisma.role_permissions.upsert({
        where: {
          role_id_permission_id: {
            role_id: roleId,
            permission_id: perm.id,
          },
        },
        update: {},
        create: { role_id: roleId, permission_id: perm.id },
      });
    }
  }

  // ADMIN: everything except a few management-only permissions
  await attachPerms(
    adminRole.id,
    new Set([...allCodes].filter((c) => !denyAdmin.has(c))),
  );
  await attachPerms(teacherRole.id, teacherAllow);
  await attachPerms(assistantTeacherRole.id, assistantAllow);

  // 4. Superadmin foydalanuvchi
  const adminPassword = await bcrypt.hash('pass1234', 10);
  const admin = await prisma.users.upsert({
    where: { tenant_id_username: { tenant_id: tenant.id, username: 'admin' } },
    update: {},
    create: {
      tenant_id: tenant.id,
      username: 'admin',
      password_hash: adminPassword,
      full_name: 'Super Admin',
      is_active: true,
    },
  });

  await prisma.user_roles.upsert({
    where: {
      user_id_role_id: { user_id: admin.id, role_id: superadminRole.id },
    },
    update: {},
    create: { user_id: admin.id, role_id: superadminRole.id },
  });

  // 5. Living types
  const livingTypes = [
    { code: 'DAY_ONLY', name: 'Home commuter (lunch only)' },
    { code: 'WEEKDAYS_ONLY', name: 'Weekday resident (Mon–Fri)' },
    { code: 'FULL_BOARD', name: 'Full resident (7 days)' },
  ];
  for (const lt of livingTypes) {
    await prisma.living_types.upsert({
      where: { tenant_id_code: { tenant_id: tenant.id, code: lt.code } },
      update: {},
      create: {
        tenant_id: tenant.id,
        code: lt.code,
        name: lt.name,
        is_active: true,
      },
    });
  }

  console.log('✅ Seed completed');
  console.log('Tenant slug: mathacademy');
  console.log('Admin login: admin / pass1234');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
