import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogger } from '../../common/utils/audit.util';
import { rethrowServiceError } from '../../common/utils/service-error.util';

import { CreateCohortDto } from './dto/create-cohort.dto';
import { UpdateCohortDto } from './dto/update-cohort.dto';
import { ListCohortsQueryDto } from './dto/list-cohorts.query.dto';

function toBigInt(value: unknown, field = 'id'): bigint {
  const s = String(value ?? '').trim();
  if (!/^\d+$/.test(s) || s === '0')
    throw new BadRequestException(`INVALID_${field.toUpperCase()}`);
  return BigInt(s);
}

@Injectable()
export class CohortsService {
  private readonly auditLogger: AuditLogger;

  constructor(private readonly prisma: PrismaService) {
    this.auditLogger = new AuditLogger(prisma);
  }

  async create(args: {
    tenantId: string;
    userId: string;
    dto: CreateCohortDto;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const created_by_user_id = args.userId
        ? toBigInt(args.userId, 'userId')
        : null;

      // Check if cohort already exists for this tenant
      const existing = await this.prisma.cohorts.findFirst({
        where: { tenant_id, label: args.dto.label.trim() },
      });
      if (existing) throw new BadRequestException('COHORT_ALREADY_EXISTS');

      const cohort = await this.prisma.cohorts.create({
        data: {
          tenant_id,
          label: args.dto.label.trim(),
          graduation_year: args.dto.graduationYear,
        },
      });

      await this.auditLogger.log({
        tenantId: tenant_id,
        actorType: 'STAFF',
        actorUserId: created_by_user_id,
        action: 'CREATE',
        entityType: 'cohorts',
        entityId: cohort.id,
        afterData: { id: cohort.id.toString(), label: cohort.label },
        ipAddress: args.ipAddress,
      });

      return {
        id: cohort.id.toString(),
        label: cohort.label,
        graduationYear: cohort.graduation_year,
        createdAt: cohort.created_at,
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async list(args: { tenantId: string; query: ListCohortsQueryDto }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const page = args.query.page ?? 1;
      const limit = Math.min(args.query.limit ?? 20, 200);
      const skip = (page - 1) * limit;

      const where: Prisma.cohortsWhereInput = { tenant_id };
      if (args.query.q) {
        where.label = { contains: args.query.q, mode: 'insensitive' };
      }
      if (args.query.graduationYear) {
        where.graduation_year = args.query.graduationYear;
      }

      const orderBy: Prisma.cohortsOrderByWithRelationInput = {};
      if (args.query.sortBy === 'label') {
        orderBy.label = args.query.sortDir ?? 'desc';
      } else if (args.query.sortBy === 'graduationYear') {
        orderBy.graduation_year = args.query.sortDir ?? 'desc';
      } else if (args.query.sortBy === 'id') {
        orderBy.id = args.query.sortDir ?? 'desc';
      } else {
        (orderBy as any).created_at = args.query.sortDir ?? 'desc';
      }

      const [total, items] = await this.prisma.$transaction([
        this.prisma.cohorts.count({ where }),
        this.prisma.cohorts.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          include: {
            _count: { select: { student_cohort: true } },
          },
        }),
      ]);

      return {
        data: items.map((c) => ({
          id: c.id.toString(),
          label: c.label,
          graduationYear: c.graduation_year,
          createdAt: c.created_at,
          studentsCount: c._count.student_cohort,
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

  async getById(args: { tenantId: string; cohortId: string }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const cohort_id = toBigInt(args.cohortId, 'cohortId');

      const cohort = await this.prisma.cohorts.findFirst({
        where: { id: cohort_id, tenant_id },
        include: {
          _count: { select: { student_cohort: true } },
        },
      });
      if (!cohort) throw new NotFoundException('COHORT_NOT_FOUND');

      return {
        id: cohort.id.toString(),
        label: cohort.label,
        graduationYear: cohort.graduation_year,
        createdAt: cohort.created_at,
        studentsCount: cohort._count.student_cohort,
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async update(args: {
    tenantId: string;
    cohortId: string;
    userId: string;
    dto: UpdateCohortDto;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const cohort_id = toBigInt(args.cohortId, 'cohortId');
      const updated_by_user_id = args.userId
        ? toBigInt(args.userId, 'userId')
        : null;

      const cohort = await this.prisma.cohorts.findFirst({
        where: { id: cohort_id, tenant_id },
      });
      if (!cohort) throw new NotFoundException('COHORT_NOT_FOUND');

      if (args.dto.label && args.dto.label.trim() !== cohort.label) {
        const existing = await this.prisma.cohorts.findFirst({
          where: { tenant_id, label: args.dto.label.trim() },
        });
        if (existing)
          throw new BadRequestException('COHORT_LABEL_ALREADY_EXISTS');
      }

      const updateData: Prisma.cohortsUpdateInput = {};
      if (args.dto.label) updateData.label = args.dto.label.trim();
      if (args.dto.graduationYear !== undefined)
        updateData.graduation_year = args.dto.graduationYear;

      const updated = await this.prisma.cohorts.update({
        where: { id: cohort_id },
        data: updateData,
      });

      await this.auditLogger.log({
        tenantId: tenant_id,
        actorType: 'STAFF',
        actorUserId: updated_by_user_id,
        action: 'UPDATE',
        entityType: 'cohorts',
        entityId: cohort_id,
        beforeData: { id: cohort.id.toString(), label: cohort.label },
        afterData: { id: updated.id.toString(), label: updated.label },
        ipAddress: args.ipAddress,
      });

      return {
        id: updated.id.toString(),
        label: updated.label,
        graduationYear: updated.graduation_year,
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async delete(args: {
    tenantId: string;
    cohortId: string;
    userId: string;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const cohort_id = toBigInt(args.cohortId, 'cohortId');
      const deleted_by_user_id = args.userId
        ? toBigInt(args.userId, 'userId')
        : null;

      const cohort = await this.prisma.cohorts.findFirst({
        where: { id: cohort_id, tenant_id },
        include: {
          _count: { select: { student_cohort: true } },
        },
      });
      if (!cohort) throw new NotFoundException('COHORT_NOT_FOUND');

      if (cohort._count.student_cohort > 0) {
        throw new BadRequestException('COHORT_HAS_STUDENTS');
      }

      await this.prisma.cohorts.delete({ where: { id: cohort_id } });

      await this.auditLogger.log({
        tenantId: tenant_id,
        actorType: 'STAFF',
        actorUserId: deleted_by_user_id,
        action: 'DELETE',
        entityType: 'cohorts',
        entityId: cohort_id,
        beforeData: { id: cohort.id.toString(), label: cohort.label },
        ipAddress: args.ipAddress,
      });

      return { ok: true };
    } catch (error) {
      rethrowServiceError(error);
    }
  }
}
