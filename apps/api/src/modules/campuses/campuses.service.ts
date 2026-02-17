import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogger } from '../../common/utils/audit.util';
import { rethrowServiceError } from '../../common/utils/service-error.util';

import { CreateCampusDto } from './dto/create-campus.dto';
import { UpdateCampusDto } from './dto/update-campus.dto';
import { ListCampusesQueryDto } from './dto/list-campuses.query.dto';

function toBigInt(value: unknown, field = 'id'): bigint {
  const s = String(value ?? '').trim();
  if (!/^\d+$/.test(s) || s === '0')
    throw new BadRequestException(`INVALID_${field.toUpperCase()}`);
  return BigInt(s);
}

@Injectable()
export class CampusesService {
  private readonly auditLogger: AuditLogger;

  constructor(private readonly prisma: PrismaService) {
    this.auditLogger = new AuditLogger(prisma);
  }

  async create(args: {
    tenantId: string;
    userId: string;
    dto: CreateCampusDto;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const created_by_user_id = args.userId
        ? toBigInt(args.userId, 'userId')
        : null;

      const campus = await this.prisma.campuses.create({
        data: {
          tenant_id,
          name: args.dto.name.trim(),
          address: args.dto.address?.trim() || null,
          lat: args.dto.lat,
          lng: args.dto.lng,
          is_active: args.dto.isActive ?? true,
        },
      });

      await this.auditLogger.log({
        tenantId: tenant_id,
        actorType: 'STAFF',
        actorUserId: created_by_user_id,
        action: 'CREATE',
        entityType: 'campuses',
        entityId: campus.id,
        afterData: { id: campus.id.toString(), name: campus.name },
        ipAddress: args.ipAddress,
      });

      return {
        id: campus.id.toString(),
        name: campus.name,
        address: campus.address,
        lat: campus.lat,
        lng: campus.lng,
        isActive: campus.is_active,
        createdAt: campus.created_at,
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async list(args: { tenantId: string; query: ListCampusesQueryDto }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const page = args.query.page ?? 1;
      const limit = Math.min(args.query.limit ?? 20, 200);
      const skip = (page - 1) * limit;

      const where: Prisma.campusesWhereInput = { tenant_id };
      if (args.query.isActive !== undefined) {
        where.is_active = args.query.isActive;
      }
      if (args.query.q) {
        where.name = { contains: args.query.q, mode: 'insensitive' };
      }

      const orderBy: Prisma.campusesOrderByWithRelationInput = {};
      if (args.query.sortBy === 'name') {
        orderBy.name = args.query.sortDir ?? 'asc';
      } else if (args.query.sortBy === 'id') {
        orderBy.id = args.query.sortDir ?? 'asc';
      } else {
        (orderBy as any).created_at = args.query.sortDir ?? 'asc';
      }

      const [total, items] = await this.prisma.$transaction([
        this.prisma.campuses.count({ where }),
        this.prisma.campuses.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          include: {
            _count: {
              select: {
                groups: true,
                dorms: true,
                events: true,
                students: true,
              },
            },
          },
        }),
      ]);

      return {
        data: items.map((c) => ({
          id: c.id.toString(),
          name: c.name,
          address: c.address,
          lat: c.lat,
          lng: c.lng,
          isActive: c.is_active,
          createdAt: c.created_at,
          groupsCount: c._count.groups,
          dormsCount: c._count.dorms,
          eventsCount: c._count.events,
          studentsCount: c._count.students,
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

  async getById(args: { tenantId: string; campusId: string }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const campus_id = toBigInt(args.campusId, 'campusId');

      const campus = await this.prisma.campuses.findFirst({
        where: { id: campus_id, tenant_id },
        include: {
          _count: {
            select: { groups: true, dorms: true, events: true, students: true },
          },
        },
      });
      if (!campus) throw new NotFoundException('CAMPUS_NOT_FOUND');

      return {
        id: campus.id.toString(),
        name: campus.name,
        address: campus.address,
        lat: campus.lat,
        lng: campus.lng,
        isActive: campus.is_active,
        createdAt: campus.created_at,
        groupsCount: campus._count.groups,
        dormsCount: campus._count.dorms,
        eventsCount: campus._count.events,
        studentsCount: campus._count.students,
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async update(args: {
    tenantId: string;
    campusId: string;
    userId: string;
    dto: UpdateCampusDto;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const campus_id = toBigInt(args.campusId, 'campusId');
      const updated_by_user_id = args.userId
        ? toBigInt(args.userId, 'userId')
        : null;

      const campus = await this.prisma.campuses.findFirst({
        where: { id: campus_id, tenant_id },
      });
      if (!campus) throw new NotFoundException('CAMPUS_NOT_FOUND');

      const updateData: Prisma.campusesUpdateInput = {};
      if (args.dto.name) updateData.name = args.dto.name.trim();
      if (args.dto.address !== undefined)
        updateData.address = args.dto.address?.trim() || null;
      if (args.dto.lat !== undefined) updateData.lat = args.dto.lat;
      if (args.dto.lng !== undefined) updateData.lng = args.dto.lng;
      if (args.dto.isActive !== undefined)
        updateData.is_active = args.dto.isActive;

      const updated = await this.prisma.campuses.update({
        where: { id: campus_id },
        data: updateData,
      });

      await this.auditLogger.log({
        tenantId: tenant_id,
        actorType: 'STAFF',
        actorUserId: updated_by_user_id,
        action: 'UPDATE',
        entityType: 'campuses',
        entityId: campus_id,
        beforeData: { id: campus.id.toString(), name: campus.name },
        afterData: { id: updated.id.toString(), name: updated.name },
        ipAddress: args.ipAddress,
      });

      return {
        id: updated.id.toString(),
        name: updated.name,
        address: updated.address,
        lat: updated.lat,
        lng: updated.lng,
        isActive: updated.is_active,
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async delete(args: {
    tenantId: string;
    campusId: string;
    userId: string;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const campus_id = toBigInt(args.campusId, 'campusId');
      const deleted_by_user_id = args.userId
        ? toBigInt(args.userId, 'userId')
        : null;

      const campus = await this.prisma.campuses.findFirst({
        where: { id: campus_id, tenant_id },
        include: {
          _count: {
            select: { groups: true, dorms: true, events: true, students: true },
          },
        },
      });
      if (!campus) throw new NotFoundException('CAMPUS_NOT_FOUND');

      if (
        campus._count.groups > 0 ||
        campus._count.dorms > 0 ||
        campus._count.events > 0 ||
        campus._count.students > 0
      ) {
        throw new BadRequestException('CAMPUS_HAS_DEPENDENCIES');
      }

      await this.prisma.campuses.delete({ where: { id: campus_id } });

      await this.auditLogger.log({
        tenantId: tenant_id,
        actorType: 'STAFF',
        actorUserId: deleted_by_user_id,
        action: 'DELETE',
        entityType: 'campuses',
        entityId: campus_id,
        beforeData: { id: campus.id.toString(), name: campus.name },
        ipAddress: args.ipAddress,
      });

      return { ok: true };
    } catch (error) {
      rethrowServiceError(error);
    }
  }
}
