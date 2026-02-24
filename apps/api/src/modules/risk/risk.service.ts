// apps/api/src/modules/risk/risk.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogger } from '../../common/utils/audit.util';
import { rethrowServiceError } from '../../common/utils/service-error.util';

import { SetRiskDto } from './dto/set-risk.dto';
import { ListRiskQueryDto } from './dto/list-risk.query.dto';

function toBigInt(value: unknown, field = 'id'): bigint {
  const s = String(value ?? '').trim();
  if (!/^\d+$/.test(s) || s === '0')
    throw new BadRequestException(`INVALID_${field.toUpperCase()}`);
  return BigInt(s);
}

function levelFromScore(score: number): 'GREEN' | 'YELLOW' | 'RED' {
  if (score <= 33) return 'GREEN';
  if (score <= 66) return 'YELLOW';
  return 'RED';
}

@Injectable()
export class RiskService {
  private readonly auditLogger: AuditLogger;

  constructor(private readonly prisma: PrismaService) {
    this.auditLogger = new AuditLogger(prisma);
  }

  // ---------- Set risk score ----------

  async setRisk(args: {
    tenantId: string;
    userId: string;
    dto: SetRiskDto;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const student_id = toBigInt(args.dto.studentId, 'studentId');
      const created_by_user_id = args.userId
        ? toBigInt(args.userId, 'userId')
        : null;

      // Verify student exists and belongs to tenant
      const student = await this.prisma.students.findFirst({
        where: { id: student_id, tenant_id, archived_at: null },
        select: { id: true, full_name: true },
      });
      if (!student) throw new NotFoundException('STUDENT_NOT_FOUND');

      const score = args.dto.score;
      const level = levelFromScore(score);
      const signals = { manual: true, note: args.dto.note || null };

      const riskScore = await this.prisma.student_risk_scores.create({
        data: {
          tenant_id,
          student_id,
          score,
          level,
          signals: JSON.stringify(signals),
          note: args.dto.note?.trim() || null,
          calculated_at: new Date(),
        },
      });

      await this.auditLogger.log({
        tenantId: tenant_id,
        actorType: 'STAFF',
        actorUserId: created_by_user_id,
        action: 'CREATE',
        entityType: 'student_risk_scores',
        entityId: riskScore.id,
        afterData: {
          id: riskScore.id.toString(),
          studentId: student_id.toString(),
          studentName: student.full_name,
          score,
          level,
        },
        ipAddress: args.ipAddress,
      });

      return {
        ok: true,
        id: riskScore.id.toString(),
        level,
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  // ---------- List risk scores (with filters) ----------

  async listRisk(args: { tenantId: string; query: ListRiskQueryDto }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const page = args.query.page ?? 1;
      const limit = Math.min(args.query.limit ?? 20, 200);
      const skip = (page - 1) * limit;

      const where: Prisma.student_risk_scoresWhereInput = {
        tenant_id,
      };

      if (args.query.studentId) {
        where.student_id = toBigInt(args.query.studentId, 'studentId');
      }
      if (args.query.level) {
        where.level = args.query.level;
      }
      if (args.query.groupId) {
        where.students = {
          current_group_id: toBigInt(args.query.groupId, 'groupId'),
        };
      }

      const [total, items] = await this.prisma.$transaction([
        this.prisma.student_risk_scores.count({ where }),
        this.prisma.student_risk_scores.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ calculated_at: 'desc' }, { id: 'desc' }],
          include: {
            students: {
              select: {
                id: true,
                full_name: true,
                current_group_id: true,
                groups: { select: { name: true } },
              },
            },
          },
        }),
      ]);

      return {
        data: items.map((r) => ({
          id: r.id.toString(),
          studentId: r.student_id.toString(),
          studentName: r.students.full_name,
          groupId: r.students.current_group_id?.toString() || null,
          groupName: r.students.groups?.name || null,
          score: r.score,
          level: r.level,
          signals: r.signals ? JSON.parse(r.signals) : null,
          note: r.note,
          calculatedAt: r.calculated_at,
        })),
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  // ---------- Latest risk score for all students in a group ----------

  async latestByGroup(args: { tenantId: string; groupId: string }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const group_id = toBigInt(args.groupId, 'groupId');

      const group = await this.prisma.groups.findFirst({
        where: { id: group_id, tenant_id },
        select: { id: true },
      });
      if (!group) throw new NotFoundException('GROUP_NOT_FOUND');

      // Use Prisma raw query to get latest per student
      // Alternatively, we could use groupBy and join, but raw is simpler here.
      // However, we can also do this with a subquery using Prisma.
      const students = await this.prisma.students.findMany({
        where: {
          tenant_id,
          current_group_id: group_id,
          status: 'ACTIVE',
        },
        select: {
          id: true,
          full_name: true,
          student_risk_scores: {
            orderBy: { calculated_at: 'desc' },
            take: 1,
            select: {
              score: true,
              level: true,
              calculated_at: true,
            },
          },
        },
      });

      const data = students.map((s) => ({
        studentId: s.id.toString(),
        studentName: s.full_name,
        score: s.student_risk_scores[0]?.score ?? null,
        level: s.student_risk_scores[0]?.level ?? 'GREEN',
        calculatedAt: s.student_risk_scores[0]?.calculated_at ?? null,
      }));

      return { data };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  // ---------- Latest risk score for a single student ----------

  async latestByStudent(args: { tenantId: string; studentId: string }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const student_id = toBigInt(args.studentId, 'studentId');

      const student = await this.prisma.students.findFirst({
        where: { id: student_id, tenant_id, archived_at: null },
        select: { id: true, full_name: true },
      });
      if (!student) throw new NotFoundException('STUDENT_NOT_FOUND');

      const latest = await this.prisma.student_risk_scores.findFirst({
        where: { student_id, tenant_id },
        orderBy: [{ calculated_at: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          score: true,
          level: true,
          signals: true,
          note: true,
          calculated_at: true,
        },
      });

      return {
        data: latest
          ? {
              id: latest.id.toString(),
              studentId: student_id.toString(),
              studentName: student.full_name,
              score: latest.score,
              level: latest.level,
              signals: latest.signals ? JSON.parse(latest.signals) : null,
              note: latest.note,
              calculatedAt: latest.calculated_at,
            }
          : null,
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  // ---------- Guardian: get latest risk score ----------

  async guardianMe(args: { studentAccountId: string }) {
    try {
      const student_account_id = toBigInt(
        args.studentAccountId,
        'studentAccountId',
      );

      const account = await this.prisma.student_accounts.findUnique({
        where: { id: student_account_id },
        include: {
          students: { select: { tenant_id: true, id: true, full_name: true } },
        },
      });
      if (!account) throw new NotFoundException('GUARDIAN_ACCOUNT_NOT_FOUND');

      const studentId = account.students.id;
      const tenantId = account.students.tenant_id;

      const latest = await this.prisma.student_risk_scores.findFirst({
        where: { student_id: studentId, tenant_id: tenantId },
        orderBy: [{ calculated_at: 'desc' }, { id: 'desc' }],
        select: {
          score: true,
          level: true,
          calculated_at: true,
        },
      });

      return {
        student: {
          id: studentId.toString(),
          fullName: account.students.full_name,
        },
        risk: latest || null,
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async getRiskSummary(args: { tenantId: string }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');

      const students = await this.prisma.students.findMany({
        where: { tenant_id, status: 'ACTIVE', archived_at: null },
        select: {
          id: true,
          student_risk_scores: {
            orderBy: { calculated_at: 'desc' },
            take: 1,
            select: { level: true },
          },
        },
      });

      const summary = { low: 0, medium: 0, high: 0 };

      students.forEach((s) => {
        const level = s.student_risk_scores[0]?.level || 'GREEN';
        if (level === 'RED') summary.high++;
        else if (level === 'YELLOW') summary.medium++;
        else summary.low++;
      });

      return { summary };
    } catch (error) {
      rethrowServiceError(error);
    }
  }
}
