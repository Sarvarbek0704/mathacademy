import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(args: {
    tenantId: string;
    q?: string;
    groupId?: string;
    status?: string;
    limit: number;
    offset: number;
  }) {
    const tenantId = BigInt(args.tenantId || '0');
    const q = String(args.q || '').trim();
    const limit = Math.max(1, Math.min(200, args.limit || 50));
    const offset = Math.max(0, args.offset || 0);

    const rows = await this.prisma.$queryRaw<any[]>(
      Prisma.sql`
    SELECT
      s.id,
      s.full_name,
      s.status,
      s.created_at,
      s.current_group_id,
      g.name AS group_name,
      sa.student_login_id
    FROM students s
    LEFT JOIN groups g ON g.id = s.current_group_id
    LEFT JOIN student_accounts sa ON sa.student_id = s.id
    WHERE s.tenant_id = ${tenantId}
      ${
        args.groupId
          ? Prisma.sql`AND s.current_group_id = ${BigInt(args.groupId)}`
          : Prisma.empty
      }
      ${args.status ? Prisma.sql`AND s.status = ${args.status}` : Prisma.empty}
      ${
        q
          ? Prisma.sql`AND (s.full_name ILIKE ${'%' + q + '%'} OR sa.student_login_id ILIKE ${'%' + q + '%'})`
          : Prisma.empty
      }
    ORDER BY s.id DESC
    LIMIT ${limit} OFFSET ${offset}
  `,
    );

    return { data: rows, meta: { limit, offset } };
  }

  async create(args: { tenantId: string; createdByUserId: string; dto: any }) {
    const tenantId = BigInt(args.tenantId);
    const createdByUserId = args.createdByUserId
      ? BigInt(args.createdByUserId)
      : null;

    const fullName = String(args.dto.fullName || '').trim();
    const status = String(args.dto.status || 'ACTIVE').trim();
    const currentGroupId = args.dto.currentGroupId
      ? BigInt(args.dto.currentGroupId)
      : null;

    const admissionGrade = Number(args.dto.admissionGrade || 10); // default 10
    const admissionDateSql = args.dto.admissionDate
      ? Prisma.sql`${args.dto.admissionDate}::date`
      : Prisma.sql`now()::date`;

    const expectedGraduationYear =
      args.dto.expectedGraduationYear ??
      (
        await this.prisma.$queryRaw<{ y: number }[]>(
          Prisma.sql`
        SELECT (EXTRACT(YEAR FROM now())::int + (11 - ${admissionGrade})) AS y
      `,
        )
      )[0].y;

    // tenant slug (guardian login uchun)
    const t = await this.prisma.$queryRaw<{ slug: string }[]>(
      Prisma.sql`SELECT slug FROM tenants WHERE id = ${tenantId} LIMIT 1`,
    );
    const tenantSlug = t[0]?.slug || 'tenant';

    // 1) student yaratish (NOT NULL fieldlar bilan)
    const created = await this.prisma.$queryRaw<{ id: bigint }[]>(
      Prisma.sql`
      INSERT INTO students (
        tenant_id,
        full_name,
        status,
        current_group_id,
        admission_grade,
        admission_date,
        expected_graduation_year,
        created_by_user_id
      )
      VALUES (
        ${tenantId},
        ${fullName},
        ${status},
        ${currentGroupId},
        ${admissionGrade},
        ${admissionDateSql},
        ${expectedGraduationYear},
        ${createdByUserId}
      )
      RETURNING id
    `,
    );
    const studentId = created[0].id;

    // 2) next student_login_id (000001...)
    const last = await this.prisma.$queryRaw<{ student_login_id: string }[]>(
      Prisma.sql`
      SELECT student_login_id
      FROM student_accounts
      WHERE tenant_id = ${tenantId}
      ORDER BY student_login_id DESC
      LIMIT 1
    `,
    );

    const lastNum = last.length ? Number(last[0].student_login_id) : 0;
    const nextNum = lastNum + 1;
    const loginId = String(nextNum).padStart(6, '0');

    // 3) account yaratish
    const hash = await bcrypt.hash('root', 10);

    await this.prisma.$executeRaw(
      Prisma.sql`
      INSERT INTO student_accounts (
        tenant_id, student_id, student_login_id,
        password_hash, is_active, must_change_password, created_at
      )
      VALUES (${tenantId}, ${studentId}, ${loginId}, ${hash}, true, true, now())
    `,
    );

    return {
      id: studentId.toString(),
      studentLoginId: loginId,
      guardianLogin: `${tenantSlug}-${loginId}`,
      mustChangePassword: true,
    };
  }

  async assignGroup(args: {
    tenantId: string;
    studentId: string;
    groupId: string;
  }) {
    const tenantId = BigInt(args.tenantId);
    const studentId = BigInt(args.studentId);
    const groupId = BigInt(args.groupId);

    // group mavjudmi (tenant ichida)
    const g = await this.prisma.$queryRaw<{ id: bigint }[]>(
      Prisma.sql`
      SELECT id FROM groups
      WHERE tenant_id = ${tenantId} AND id = ${groupId}
      LIMIT 1
    `,
    );
    if (!g.length) throw new BadRequestException('GROUP_NOT_FOUND');

    // student mavjudmi (tenant ichida)
    const s = await this.prisma.$queryRaw<{ id: bigint }[]>(
      Prisma.sql`
      SELECT id FROM students
      WHERE tenant_id = ${tenantId} AND id = ${studentId}
      LIMIT 1
    `,
    );
    if (!s.length) throw new BadRequestException('STUDENT_NOT_FOUND');

    await this.prisma.$executeRaw(
      Prisma.sql`
      UPDATE students
      SET current_group_id = ${groupId}
      WHERE id = ${studentId}
    `,
    );

    return { ok: true };
  }

  async detail(args: { tenantId: string; studentId: string }) {
    const tenantId = BigInt(args.tenantId);
    const studentId = BigInt(args.studentId);

    const rows = await this.prisma.$queryRaw<any[]>(
      Prisma.sql`
      SELECT
        s.id,
        s.full_name,
        s.status,
        s.admission_grade,
        s.admission_date,
        s.expected_graduation_year,
        s.created_at,
        s.current_group_id,
        g.name AS group_name,
        sa.student_login_id,
        sa.is_active AS account_is_active,
        sa.must_change_password
      FROM students s
      LEFT JOIN groups g ON g.id = s.current_group_id
      LEFT JOIN student_accounts sa ON sa.student_id = s.id
      WHERE s.tenant_id = ${tenantId} AND s.id = ${studentId}
      LIMIT 1
    `,
    );

    if (!rows.length) throw new NotFoundException('STUDENT_NOT_FOUND');
    return rows[0];
  }

  async guardianMe(args: { studentAccountId: string }) {
    const studentAccountId = BigInt(args.studentAccountId);

    const rows = await this.prisma.$queryRaw<any[]>(
      Prisma.sql`
      SELECT
        s.id,
        s.full_name,
        s.status,
        s.admission_grade,
        s.admission_date,
        s.expected_graduation_year,
        s.created_at,
        s.current_group_id,
        g.name AS group_name,
        sa.student_login_id,
        sa.must_change_password
      FROM student_accounts sa
      JOIN students s ON s.id = sa.student_id
      LEFT JOIN groups g ON g.id = s.current_group_id
      WHERE sa.id = ${studentAccountId}
      LIMIT 1
    `,
    );

    return rows.length ? rows[0] : null;
  }
}
