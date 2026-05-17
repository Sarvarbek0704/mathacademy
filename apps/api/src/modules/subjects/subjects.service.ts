import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogger } from '../../common/utils/audit.util';
import { rethrowServiceError } from '../../common/utils/service-error.util';

import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import { ListSubjectsQueryDto } from './dto/list-subjects.query.dto';

function toBigInt(value: unknown, field = 'id'): bigint {
  const s = String(value ?? '').trim();
  if (!/^\d+$/.test(s) || s === '0')
    throw new BadRequestException(`INVALID_${field.toUpperCase()}`);
  return BigInt(s);
}

@Injectable()
export class SubjectsService {
  private readonly auditLogger: AuditLogger;

  constructor(private readonly prisma: PrismaService) {
    this.auditLogger = new AuditLogger(prisma);
  }

  async create(args: {
    tenantId: string;
    userId: string;
    dto: CreateSubjectDto;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const created_by_user_id = args.userId
        ? toBigInt(args.userId, 'userId')
        : null;

      // Check if subject already exists for this tenant
      const existing = await this.prisma.subjects.findFirst({
        where: { tenant_id, name: args.dto.name.trim() },
      });
      if (existing) throw new BadRequestException('SUBJECT_ALREADY_EXISTS');

      const track_id = args.dto.trackId ? toBigInt(args.dto.trackId, 'trackId') : null;

      const subject = await this.prisma.subjects.create({
        data: {
          tenant_id,
          name: args.dto.name.trim(),
          code: args.dto.code?.trim() || null,
          is_core: args.dto.isCore ?? true,
          ...(track_id ? { track_id } : {}),
        },
        include: { student_tracks: { select: { id: true, name: true, color: true } } },
      });

      await this.auditLogger.log({
        tenantId: tenant_id,
        actorType: 'STAFF',
        actorUserId: created_by_user_id,
        action: 'CREATE',
        entityType: 'subjects',
        entityId: subject.id,
        afterData: { id: subject.id.toString(), name: subject.name },
        ipAddress: args.ipAddress,
      });

      return {
        id: subject.id.toString(),
        name: subject.name,
        code: subject.code,
        isCore: subject.is_core,
        trackId: subject.track_id?.toString() || null,
        track: (subject as any).student_tracks ? {
          id: (subject as any).student_tracks.id.toString(),
          name: (subject as any).student_tracks.name,
          color: (subject as any).student_tracks.color,
        } : null,
        createdAt: subject.created_at,
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async list(args: { tenantId: string; query: ListSubjectsQueryDto }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const page = args.query.page ?? 1;
      const limit = Math.min(args.query.limit ?? 20, 200);
      const skip = (page - 1) * limit;

      const where: Prisma.subjectsWhereInput = { tenant_id };
      if (args.query.isCore !== undefined) {
        where.is_core = args.query.isCore;
      }
      if (args.query.q) {
        where.name = { contains: args.query.q, mode: 'insensitive' };
      }

      const orderBy: Prisma.subjectsOrderByWithRelationInput = {};
      if (args.query.sortBy === 'name') {
        orderBy.name = args.query.sortDir ?? 'asc';
      } else if (args.query.sortBy === 'id') {
        orderBy.id = args.query.sortDir ?? 'asc';
      } else {
        (orderBy as any).created_at = args.query.sortDir ?? 'asc';
      }

      const [total, items] = await this.prisma.$transaction([
        this.prisma.subjects.count({ where }),
        this.prisma.subjects.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          include: {
            student_tracks: { select: { id: true, name: true, color: true } },
            _count: {
              select: {
                assessments: true,
                group_subjects: true,
                certificates: true,
                timetable_lessons: true,
              },
            },
          },
        }),
      ]);

      return {
        data: items.map((s) => ({
          id: s.id.toString(),
          name: s.name,
          code: s.code,
          isCore: s.is_core,
          trackId: s.track_id?.toString() || null,
          track: (s as any).student_tracks ? {
            id: (s as any).student_tracks.id.toString(),
            name: (s as any).student_tracks.name,
            color: (s as any).student_tracks.color,
          } : null,
          createdAt: s.created_at,
          assessmentsCount: s._count.assessments,
          groupCount: s._count.group_subjects,
          groupsCount: s._count.group_subjects,
          certificatesCount: s._count.certificates,
          lessonsCount: s._count.timetable_lessons,
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

  async getById(args: { tenantId: string; subjectId: string }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const subject_id = toBigInt(args.subjectId, 'subjectId');

      const subject = await this.prisma.subjects.findFirst({
        where: { id: subject_id, tenant_id },
        include: {
          _count: {
            select: {
              assessments: true,
              group_subjects: true,
              certificates: true,
              timetable_lessons: true,
            },
          },
        },
      });
      if (!subject) throw new NotFoundException('SUBJECT_NOT_FOUND');

      return {
        id: subject.id.toString(),
        name: subject.name,
        isCore: subject.is_core,
        createdAt: subject.created_at,
        assessmentsCount: subject._count.assessments,
        groupsCount: subject._count.group_subjects,
        certificatesCount: subject._count.certificates,
        lessonsCount: subject._count.timetable_lessons,
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async update(args: {
    tenantId: string;
    subjectId: string;
    userId: string;
    dto: UpdateSubjectDto;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const subject_id = toBigInt(args.subjectId, 'subjectId');
      const updated_by_user_id = args.userId
        ? toBigInt(args.userId, 'userId')
        : null;

      const subject = await this.prisma.subjects.findFirst({
        where: { id: subject_id, tenant_id },
      });
      if (!subject) throw new NotFoundException('SUBJECT_NOT_FOUND');

      if (args.dto.name && args.dto.name.trim() !== subject.name) {
        const existing = await this.prisma.subjects.findFirst({
          where: { tenant_id, name: args.dto.name.trim() },
        });
        if (existing)
          throw new BadRequestException('SUBJECT_NAME_ALREADY_EXISTS');
      }

      const updateData: Prisma.subjectsUpdateInput = {};
      if (args.dto.name) updateData.name = args.dto.name.trim();
      if (args.dto.code !== undefined) updateData.code = args.dto.code?.trim() || null;
      if (args.dto.isCore !== undefined) updateData.is_core = args.dto.isCore;
      if (args.dto.trackId !== undefined) {
        if (args.dto.trackId) {
          updateData.student_tracks = { connect: { id: toBigInt(args.dto.trackId, 'trackId') } };
        } else {
          updateData.student_tracks = { disconnect: true };
        }
      }

      const updated = await this.prisma.subjects.update({
        where: { id: subject_id },
        data: updateData,
      });

      await this.auditLogger.log({
        tenantId: tenant_id,
        actorType: 'STAFF',
        actorUserId: updated_by_user_id,
        action: 'UPDATE',
        entityType: 'subjects',
        entityId: subject_id,
        beforeData: { id: subject.id.toString(), name: subject.name },
        afterData: { id: updated.id.toString(), name: updated.name },
        ipAddress: args.ipAddress,
      });

      return {
        id: updated.id.toString(),
        name: updated.name,
        code: updated.code,
        isCore: updated.is_core,
        trackId: updated.track_id?.toString() || null,
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async delete(args: {
    tenantId: string;
    subjectId: string;
    userId: string;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const subject_id = toBigInt(args.subjectId, 'subjectId');
      const deleted_by_user_id = args.userId
        ? toBigInt(args.userId, 'userId')
        : null;

      const subject = await this.prisma.subjects.findFirst({
        where: { id: subject_id, tenant_id },
        include: {
          _count: {
            select: {
              assessments: true,
              group_subjects: true,
              certificates: true,
              timetable_lessons: true,
            },
          },
        },
      });
      if (!subject) throw new NotFoundException('SUBJECT_NOT_FOUND');

      if (
        subject._count.assessments > 0 ||
        subject._count.group_subjects > 0 ||
        subject._count.certificates > 0 ||
        subject._count.timetable_lessons > 0
      ) {
        throw new BadRequestException('SUBJECT_HAS_DEPENDENCIES');
      }

      await this.prisma.subjects.delete({ where: { id: subject_id } });

      await this.auditLogger.log({
        tenantId: tenant_id,
        actorType: 'STAFF',
        actorUserId: deleted_by_user_id,
        action: 'DELETE',
        entityType: 'subjects',
        entityId: subject_id,
        beforeData: { id: subject.id.toString(), name: subject.name },
        ipAddress: args.ipAddress,
      });

      return { ok: true };
    } catch (error) {
      rethrowServiceError(error);
    }
  }
}
