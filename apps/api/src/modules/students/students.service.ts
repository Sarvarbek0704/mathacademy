import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { parseDateOnlyOrNow } from '../../common/utils/date.util';

function toBigInt(v: unknown, field: string): bigint {
  const s = String(v ?? '').trim();
  if (!s || !/^\d+$/.test(s))
    throw new BadRequestException(`INVALID_${field.toUpperCase()}`);
  return BigInt(s);
}

function prismaErrorToHttp(e: unknown): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === 'P2002') throw new ConflictException('UNIQUE_CONSTRAINT');
    if (e.code === 'P2003') throw new ConflictException('FK_CONSTRAINT');
    if (e.code === 'P2025') throw new NotFoundException('NOT_FOUND');
  }
  throw e;
}

function genTempPassword(): string {
  return randomBytes(6).toString('base64url'); // ~8-10 char
}

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
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const q = String(args.q || '').trim();
      const limit = Math.max(1, Math.min(200, Number(args.limit || 50)));
      const offset = Math.max(0, Number(args.offset || 0));

      const where: Prisma.studentsWhereInput = {
        tenant_id,
        ...(args.groupId
          ? { current_group_id: toBigInt(args.groupId, 'groupId') }
          : {}),
        ...(args.status ? { status: String(args.status) } : {}),
        ...(q
          ? {
              OR: [
                { full_name: { contains: q, mode: 'insensitive' } },
                {
                  student_accounts: {
                    is: {
                      student_login_id: { contains: q, mode: 'insensitive' },
                    },
                  },
                },
              ],
            }
          : {}),
      };

      const [rows, total] = await this.prisma.$transaction([
        this.prisma.students.findMany({
          where,
          orderBy: { id: 'desc' },
          skip: offset,
          take: limit,
          include: {
            groups: { select: { id: true, name: true } },
            // ✅ 1:1 relation → take/orderBy kerak emas
            student_accounts: { select: { student_login_id: true } },
          },
        }),
        this.prisma.students.count({ where }),
      ]);

      return {
        data: rows.map((r) => ({
          id: r.id,
          full_name: r.full_name,
          status: r.status,
          created_at: r.created_at,
          current_group_id: r.current_group_id,
          group_name: r.groups?.name ?? null,
          student_login_id: r.student_accounts?.student_login_id ?? null,
        })),
        meta: { limit, offset, total },
      };
    } catch (e) {
      prismaErrorToHttp(e);
    }
  }

  async create(args: { tenantId: string; createdByUserId: string; dto: any }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const created_by_user_id = args.createdByUserId
        ? toBigInt(args.createdByUserId, 'createdByUserId')
        : null;

      const full_name = String(args.dto.fullName || '').trim();
      if (!full_name) throw new BadRequestException('FULL_NAME_REQUIRED');

      const status = String(args.dto.status || 'ACTIVE').trim();

      const admission_grade = Number(args.dto.admissionGrade ?? 10);
      if (![10, 11].includes(admission_grade))
        throw new BadRequestException('INVALID_ADMISSION_GRADE');

      const admission_date = parseDateOnlyOrNow(
        args.dto.admissionDate,
        'admissionDate',
      );
      const expected_graduation_year =
        args.dto.expectedGraduationYear ??
        new Date().getFullYear() + (11 - admission_grade);

      const current_group_id = args.dto.currentGroupId
        ? toBigInt(args.dto.currentGroupId, 'currentGroupId')
        : null;

      const tenant = await this.prisma.tenants.findUnique({
        where: { id: tenant_id },
        select: { slug: true },
      });
      const tenantSlug = tenant?.slug || 'tenant';

      const tempPassword = genTempPassword();
      const password_hash = await bcrypt.hash(tempPassword, 10);

      const result = await this.prisma.$transaction(async (tx) => {
        if (current_group_id) {
          const g = await tx.groups.findFirst({
            where: { id: current_group_id, tenant_id },
            select: { id: true },
          });
          if (!g) throw new BadRequestException('GROUP_NOT_FOUND');
        }

        const student = await tx.students.create({
          data: {
            tenants: { connect: { id: tenant_id } },
            full_name,
            status,
            admission_grade,
            admission_date,
            expected_graduation_year,
            ...(current_group_id
              ? { groups: { connect: { id: current_group_id } } }
              : {}),
            ...(created_by_user_id
              ? { users: { connect: { id: created_by_user_id } } }
              : {}),
          },
          select: { id: true },
        });

        const seq = await tx.student_id_sequences.upsert({
          where: { tenant_id },
          create: { tenant_id, last_seq: 1 },
          update: { last_seq: { increment: 1 } },
          select: { last_seq: true },
        });

        const loginId = String(seq.last_seq).padStart(6, '0');

        await tx.student_accounts.create({
          data: {
            tenants: { connect: { id: tenant_id } },
            students: { connect: { id: student.id } },
            student_login_id: loginId,
            password_hash,
            is_active: true,
            must_change_password: true,
            ...(created_by_user_id
              ? { users: { connect: { id: created_by_user_id } } }
              : {}),
          },
          select: { id: true },
        });

        if (current_group_id) {
          // ✅ mana shu joyda changed_by_user_id endi bor
          const changed_by_user_id = created_by_user_id;
          await tx.student_group_history.create({
            data: {
              tenants: { connect: { id: tenant_id } },
              students: { connect: { id: student.id } },
              groups: { connect: { id: current_group_id } },
              ...(changed_by_user_id
                ? { users: { connect: { id: changed_by_user_id } } }
                : {}),
            },
          });
        }

        return { studentId: student.id, loginId };
      });

      return {
        id: result.studentId.toString(),
        studentLoginId: result.loginId,
        guardianLogin: `${tenantSlug}-${result.loginId}`,
        mustChangePassword: true,
        tempPassword, // dev/admin uchun qulay
      };
    } catch (e) {
      prismaErrorToHttp(e);
    }
  }

  async assignGroup(args: {
    tenantId: string;
    changedByUserId: string;
    studentId: string;
    groupId: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const student_id = toBigInt(args.studentId, 'studentId');
      const group_id = toBigInt(args.groupId, 'groupId');
      const changed_by_user_id = args.changedByUserId
        ? toBigInt(args.changedByUserId, 'changedByUserId')
        : null;

      const [s, g] = await this.prisma.$transaction([
        this.prisma.students.findFirst({
          where: { id: student_id, tenant_id },
          select: { id: true },
        }),
        this.prisma.groups.findFirst({
          where: { id: group_id, tenant_id },
          select: { id: true },
        }),
      ]);
      if (!s) throw new NotFoundException('STUDENT_NOT_FOUND');
      if (!g) throw new BadRequestException('GROUP_NOT_FOUND');

      await this.prisma.$transaction(async (tx) => {
        await tx.students.update({
          where: { id: student_id },
          data: { groups: { connect: { id: group_id } } },
        });

        await tx.student_group_history.create({
          data: {
            tenants: { connect: { id: tenant_id } },
            students: { connect: { id: student_id } },
            groups: { connect: { id: group_id } },
            ...(changed_by_user_id
              ? { users: { connect: { id: changed_by_user_id } } }
              : {}),
          },
        });
      });

      return { ok: true };
    } catch (e) {
      prismaErrorToHttp(e);
    }
  }

  async detail(args: { tenantId: string; studentId: string }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const id = toBigInt(args.studentId, 'studentId');

      const row = await this.prisma.students.findFirst({
        where: { id, tenant_id },
        include: {
          groups: { select: { id: true, name: true } },
          student_accounts: {
            select: {
              student_login_id: true,
              is_active: true,
              must_change_password: true,
            },
          },
        },
      });

      if (!row) throw new NotFoundException('STUDENT_NOT_FOUND');

      return {
        ...row,
        group_name: row.groups?.name ?? null,
        student_login_id: row.student_accounts?.student_login_id ?? null,
      };
    } catch (e) {
      prismaErrorToHttp(e);
    }
  }

  async guardianMe(args: { studentAccountId: string }) {
    try {
      const studentAccountId = toBigInt(
        args.studentAccountId,
        'studentAccountId',
      );

      const acc = await this.prisma.student_accounts.findFirst({
        where: { id: studentAccountId },
        include: {
          students: {
            include: {
              groups: { select: { id: true, name: true } },
            },
          },
        },
      });

      if (!acc?.students) return null;

      return {
        id: acc.students.id,
        full_name: acc.students.full_name,
        status: acc.students.status,
        admission_grade: acc.students.admission_grade,
        admission_date: acc.students.admission_date,
        expected_graduation_year: acc.students.expected_graduation_year,
        created_at: acc.students.created_at,
        current_group_id: acc.students.current_group_id,
        group_name: acc.students.groups?.name ?? null,
        student_login_id: acc.student_login_id,
        must_change_password: acc.must_change_password,
      };
    } catch (e) {
      prismaErrorToHttp(e);
    }
  }
}
