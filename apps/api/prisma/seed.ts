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
    'permissions.manage',
    'roles.manage',
    'users.manage',
    'dorms.read',
    'dorms.write',
    'dorms.assign',
    'files.read',
    'files.write',
    'campuses.read',
    'campuses.write',
    'subjects.read',
    'subjects.write',
    'tracks.read',
    'tracks.write',
    'cohorts.read',
    'cohorts.write',
    'announcements.read',
    'announcements.write',
    'system.settings',
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
