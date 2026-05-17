import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogger } from '../../common/utils/audit.util';
import { rethrowServiceError } from '../../common/utils/service-error.util';

import { CreateTrackDto } from './dto/create-track.dto';
import { UpdateTrackDto } from './dto/update-track.dto';
import { ListTracksQueryDto } from './dto/list-tracks.query.dto';

function toBigInt(value: unknown, field = 'id'): bigint {
  const s = String(value ?? '').trim();
  if (!/^\d+$/.test(s) || s === '0')
    throw new BadRequestException(`INVALID_${field.toUpperCase()}`);
  return BigInt(s);
}

@Injectable()
export class TracksService {
  private readonly auditLogger: AuditLogger;

  constructor(private readonly prisma: PrismaService) {
    this.auditLogger = new AuditLogger(prisma);
  }

  async create(args: {
    tenantId: string;
    userId: string;
    dto: CreateTrackDto;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const created_by_user_id = args.userId
        ? toBigInt(args.userId, 'userId')
        : null;

      // Check if track already exists for this tenant
      const existing = await this.prisma.student_tracks.findFirst({
        where: { tenant_id, name: args.dto.name.trim() },
      });
      if (existing) throw new BadRequestException('TRACK_ALREADY_EXISTS');

      const track = await this.prisma.student_tracks.create({
        data: {
          tenant_id,
          name: args.dto.name.trim(),
          description: args.dto.description?.trim() || null,
          color: args.dto.color || null,
        },
      });

      await this.auditLogger.log({
        tenantId: tenant_id,
        actorType: 'STAFF',
        actorUserId: created_by_user_id,
        action: 'CREATE',
        entityType: 'student_tracks',
        entityId: track.id,
        afterData: { id: track.id.toString(), name: track.name },
        ipAddress: args.ipAddress,
      });

      return {
        id: track.id.toString(),
        name: track.name,
        description: track.description,
        color: track.color,
        createdAt: track.created_at,
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async list(args: { tenantId: string; query: ListTracksQueryDto }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const page = args.query.page ?? 1;
      const limit = Math.min(args.query.limit ?? 20, 200);
      const skip = (page - 1) * limit;

      const where: Prisma.student_tracksWhereInput = { tenant_id };
      if (args.query.q) {
        where.name = { contains: args.query.q, mode: 'insensitive' };
      }

      const orderBy: Prisma.student_tracksOrderByWithRelationInput = {};
      if (args.query.sortBy === 'name') {
        orderBy.name = args.query.sortDir ?? 'asc';
      } else if (args.query.sortBy === 'id') {
        orderBy.id = args.query.sortDir ?? 'asc';
      } else {
        (orderBy as any).created_at = args.query.sortDir ?? 'asc';
      }

      const [total, items] = await this.prisma.$transaction([
        this.prisma.student_tracks.count({ where }),
        this.prisma.student_tracks.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          include: {
            _count: { select: { groups: true, students: true } },
          },
        }),
      ]);

      return {
        data: items.map((t) => ({
          id: t.id.toString(),
          name: t.name,
          description: t.description,
          color: t.color,
          createdAt: t.created_at,
          groupCount: t._count.groups,
          studentCount: t._count.students,
          groupsCount: t._count.groups,
          studentsCount: t._count.students,
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

  async getById(args: { tenantId: string; trackId: string }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const track_id = toBigInt(args.trackId, 'trackId');

      const track = await this.prisma.student_tracks.findFirst({
        where: { id: track_id, tenant_id },
        include: {
          _count: { select: { groups: true, students: true } },
        },
      });
      if (!track) throw new NotFoundException('TRACK_NOT_FOUND');

      return {
        id: track.id.toString(),
        name: track.name,
        description: track.description,
        createdAt: track.created_at,
        groupsCount: track._count.groups,
        studentsCount: track._count.students,
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async update(args: {
    tenantId: string;
    trackId: string;
    userId: string;
    dto: UpdateTrackDto;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const track_id = toBigInt(args.trackId, 'trackId');
      const updated_by_user_id = args.userId
        ? toBigInt(args.userId, 'userId')
        : null;

      const track = await this.prisma.student_tracks.findFirst({
        where: { id: track_id, tenant_id },
      });
      if (!track) throw new NotFoundException('TRACK_NOT_FOUND');

      if (args.dto.name && args.dto.name.trim() !== track.name) {
        const existing = await this.prisma.student_tracks.findFirst({
          where: { tenant_id, name: args.dto.name.trim() },
        });
        if (existing)
          throw new BadRequestException('TRACK_NAME_ALREADY_EXISTS');
      }

      const updateData: Prisma.student_tracksUpdateInput = {};
      if (args.dto.name) updateData.name = args.dto.name.trim();
      if (args.dto.description !== undefined)
        updateData.description = args.dto.description?.trim() || null;
      if (args.dto.color !== undefined) updateData.color = args.dto.color || null;

      const updated = await this.prisma.student_tracks.update({
        where: { id: track_id },
        data: updateData,
      });

      await this.auditLogger.log({
        tenantId: tenant_id,
        actorType: 'STAFF',
        actorUserId: updated_by_user_id,
        action: 'UPDATE',
        entityType: 'student_tracks',
        entityId: track_id,
        beforeData: { id: track.id.toString(), name: track.name },
        afterData: { id: updated.id.toString(), name: updated.name },
        ipAddress: args.ipAddress,
      });

      return {
        id: updated.id.toString(),
        name: updated.name,
        description: updated.description,
        color: updated.color,
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async delete(args: {
    tenantId: string;
    trackId: string;
    userId: string;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const track_id = toBigInt(args.trackId, 'trackId');
      const deleted_by_user_id = args.userId
        ? toBigInt(args.userId, 'userId')
        : null;

      const track = await this.prisma.student_tracks.findFirst({
        where: { id: track_id, tenant_id },
        include: {
          _count: { select: { groups: true, students: true } },
        },
      });
      if (!track) throw new NotFoundException('TRACK_NOT_FOUND');

      if (track._count.groups > 0 || track._count.students > 0) {
        throw new BadRequestException('TRACK_HAS_DEPENDENCIES');
      }

      await this.prisma.student_tracks.delete({ where: { id: track_id } });

      await this.auditLogger.log({
        tenantId: tenant_id,
        actorType: 'STAFF',
        actorUserId: deleted_by_user_id,
        action: 'DELETE',
        entityType: 'student_tracks',
        entityId: track_id,
        beforeData: { id: track.id.toString(), name: track.name },
        ipAddress: args.ipAddress,
      });

      return { ok: true };
    } catch (error) {
      rethrowServiceError(error);
    }
  }
}
