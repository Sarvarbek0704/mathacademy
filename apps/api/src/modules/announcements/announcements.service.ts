import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogger } from '../../common/utils/audit.util';
import { rethrowServiceError } from '../../common/utils/service-error.util';

import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';
import { ListAnnouncementsQueryDto } from './dto/list-announcements.query.dto';

function toBigInt(value: unknown, field = 'id'): bigint {
  const s = String(value ?? '').trim();
  if (!/^\d+$/.test(s) || s === '0')
    throw new BadRequestException(`INVALID_${field.toUpperCase()}`);
  return BigInt(s);
}

@Injectable()
export class AnnouncementsService {
  private readonly auditLogger: AuditLogger;

  constructor(private readonly prisma: PrismaService) {
    this.auditLogger = new AuditLogger(prisma);
  }

  async create(args: {
    tenantId: string;
    userId: string;
    dto: CreateAnnouncementDto;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const created_by_user_id = args.userId
        ? toBigInt(args.userId, 'userId')
        : null;

      const published_at = args.dto.publishedAt
        ? new Date(args.dto.publishedAt)
        : args.dto.isPublished
          ? new Date()
          : null;

      const announcement = await this.prisma.announcements.create({
        data: {
          tenant_id,
          audience: args.dto.audience,
          title: args.dto.title.trim(),
          body: args.dto.body.trim(),
          is_published: args.dto.isPublished ?? false,
          published_at,
          created_by_user_id,
        },
        include: { users: { select: { full_name: true } } },
      });

      await this.auditLogger.log({
        tenantId: tenant_id,
        actorType: 'STAFF',
        actorUserId: created_by_user_id,
        action: 'CREATE',
        entityType: 'announcements',
        entityId: announcement.id,
        afterData: {
          id: announcement.id.toString(),
          title: announcement.title,
          audience: announcement.audience,
          isPublished: announcement.is_published,
        },
        ipAddress: args.ipAddress,
      });

      return {
        id: announcement.id.toString(),
        audience: announcement.audience,
        title: announcement.title,
        body: announcement.body,
        isPublished: announcement.is_published,
        publishedAt: announcement.published_at,
        createdBy: announcement.users?.full_name || null,
        createdAt: announcement.created_at,
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async list(args: { tenantId: string; query: ListAnnouncementsQueryDto }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const page = args.query.page ?? 1;
      const limit = Math.min(args.query.limit ?? 20, 200);
      const skip = (page - 1) * limit;

      const where: Prisma.announcementsWhereInput = { tenant_id };
      if (args.query.audience) {
        where.audience = args.query.audience;
      }
      if (args.query.isPublished !== undefined) {
        where.is_published = args.query.isPublished;
      }
      if (args.query.q) {
        const search = args.query.q.trim();
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { body: { contains: search, mode: 'insensitive' } },
        ];
      }
      if (args.query.from || args.query.to) {
        where.published_at = {};
        if (args.query.from) {
          where.published_at.gte = new Date(args.query.from);
        }
        if (args.query.to) {
          const toDate = new Date(args.query.to);
          toDate.setHours(23, 59, 59, 999);
          where.published_at.lte = toDate;
        }
      }

      const orderBy: Prisma.announcementsOrderByWithRelationInput = {};
      if (args.query.sortBy === 'publishedAt') {
        orderBy.published_at = args.query.sortDir ?? 'desc';
      } else if (args.query.sortBy === 'title') {
        orderBy.title = args.query.sortDir ?? 'desc';
      } else {
        (orderBy as any).created_at = args.query.sortDir ?? 'desc';
      }

      const [total, items] = await this.prisma.$transaction([
        this.prisma.announcements.count({ where }),
        this.prisma.announcements.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          include: { users: { select: { full_name: true } } },
        }),
      ]);

      return {
        data: items.map((a) => ({
          id: a.id.toString(),
          audience: a.audience,
          title: a.title,
          body: a.body,
          isPublished: a.is_published,
          publishedAt: a.published_at,
          createdBy: a.users?.full_name || null,
          createdAt: a.created_at,
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

  async getById(args: { tenantId: string; announcementId: string }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const announcement_id = toBigInt(args.announcementId, 'announcementId');

      const announcement = await this.prisma.announcements.findFirst({
        where: { id: announcement_id, tenant_id },
        include: { users: { select: { full_name: true } } },
      });
      if (!announcement) throw new NotFoundException('ANNOUNCEMENT_NOT_FOUND');

      return {
        id: announcement.id.toString(),
        audience: announcement.audience,
        title: announcement.title,
        body: announcement.body,
        isPublished: announcement.is_published,
        publishedAt: announcement.published_at,
        createdBy: announcement.users?.full_name || null,
        createdAt: announcement.created_at,
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async update(args: {
    tenantId: string;
    announcementId: string;
    userId: string;
    dto: UpdateAnnouncementDto;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const announcement_id = toBigInt(args.announcementId, 'announcementId');
      const updated_by_user_id = args.userId
        ? toBigInt(args.userId, 'userId')
        : null;

      const announcement = await this.prisma.announcements.findFirst({
        where: { id: announcement_id, tenant_id },
      });
      if (!announcement) throw new NotFoundException('ANNOUNCEMENT_NOT_FOUND');

      // Handle publishing logic if isPublished changed
      let published_at = announcement.published_at;
      if (
        args.dto.isPublished !== undefined &&
        args.dto.isPublished !== announcement.is_published
      ) {
        published_at = args.dto.isPublished ? new Date() : null;
      } else if (args.dto.publishedAt) {
        published_at = new Date(args.dto.publishedAt);
      }

      const updateData: Prisma.announcementsUpdateInput = {
        audience: args.dto.audience,
        title: args.dto.title?.trim(),
        body: args.dto.body?.trim(),
        is_published: args.dto.isPublished,
        published_at,
      };

      const updated = await this.prisma.announcements.update({
        where: { id: announcement_id },
        data: updateData,
        include: { users: { select: { full_name: true } } },
      });

      await this.auditLogger.log({
        tenantId: tenant_id,
        actorType: 'STAFF',
        actorUserId: updated_by_user_id,
        action: 'UPDATE',
        entityType: 'announcements',
        entityId: announcement_id,
        beforeData: {
          id: announcement.id.toString(),
          title: announcement.title,
        },
        afterData: { id: updated.id.toString(), title: updated.title },
        ipAddress: args.ipAddress,
      });

      return {
        id: updated.id.toString(),
        audience: updated.audience,
        title: updated.title,
        body: updated.body,
        isPublished: updated.is_published,
        publishedAt: updated.published_at,
        createdBy: updated.users?.full_name || null,
        createdAt: updated.created_at,
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async delete(args: {
    tenantId: string;
    announcementId: string;
    userId: string;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const announcement_id = toBigInt(args.announcementId, 'announcementId');
      const deleted_by_user_id = args.userId
        ? toBigInt(args.userId, 'userId')
        : null;

      const announcement = await this.prisma.announcements.findFirst({
        where: { id: announcement_id, tenant_id },
      });
      if (!announcement) throw new NotFoundException('ANNOUNCEMENT_NOT_FOUND');

      await this.prisma.announcements.delete({
        where: { id: announcement_id },
      });

      await this.auditLogger.log({
        tenantId: tenant_id,
        actorType: 'STAFF',
        actorUserId: deleted_by_user_id,
        action: 'DELETE',
        entityType: 'announcements',
        entityId: announcement_id,
        beforeData: {
          id: announcement.id.toString(),
          title: announcement.title,
        },
        ipAddress: args.ipAddress,
      });

      return { ok: true };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async publish(args: {
    tenantId: string;
    announcementId: string;
    userId: string;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const announcement_id = toBigInt(args.announcementId, 'announcementId');
      const updated_by_user_id = args.userId
        ? toBigInt(args.userId, 'userId')
        : null;

      const announcement = await this.prisma.announcements.findFirst({
        where: { id: announcement_id, tenant_id },
      });
      if (!announcement) throw new NotFoundException('ANNOUNCEMENT_NOT_FOUND');
      if (announcement.is_published) {
        return { alreadyPublished: true };
      }

      const updated = await this.prisma.announcements.update({
        where: { id: announcement_id },
        data: { is_published: true, published_at: new Date() },
      });

      await this.auditLogger.log({
        tenantId: tenant_id,
        actorType: 'STAFF',
        actorUserId: updated_by_user_id,
        action: 'PUBLISH',
        entityType: 'announcements',
        entityId: announcement_id,
        beforeData: { isPublished: false },
        afterData: { isPublished: true },
        ipAddress: args.ipAddress,
      });

      return { ok: true };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async unpublish(args: {
    tenantId: string;
    announcementId: string;
    userId: string;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const announcement_id = toBigInt(args.announcementId, 'announcementId');
      const updated_by_user_id = args.userId
        ? toBigInt(args.userId, 'userId')
        : null;

      const announcement = await this.prisma.announcements.findFirst({
        where: { id: announcement_id, tenant_id },
      });
      if (!announcement) throw new NotFoundException('ANNOUNCEMENT_NOT_FOUND');
      if (!announcement.is_published) {
        return { alreadyUnpublished: true };
      }

      const updated = await this.prisma.announcements.update({
        where: { id: announcement_id },
        data: { is_published: false, published_at: null },
      });

      await this.auditLogger.log({
        tenantId: tenant_id,
        actorType: 'STAFF',
        actorUserId: updated_by_user_id,
        action: 'UNPUBLISH',
        entityType: 'announcements',
        entityId: announcement_id,
        beforeData: { isPublished: true },
        afterData: { isPublished: false },
        ipAddress: args.ipAddress,
      });

      return { ok: true };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  // Guardian methods

  async listForGuardian(args: {
    tenantId: string;
    query: ListAnnouncementsQueryDto;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const page = args.query.page ?? 1;
      const limit = Math.min(args.query.limit ?? 20, 200);
      const skip = (page - 1) * limit;

      const where: Prisma.announcementsWhereInput = {
        tenant_id,
        is_published: true,
        audience: { in: ['GUARDIANS', 'ALL'] },
      };

      if (args.query.q) {
        const search = args.query.q.trim();
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { body: { contains: search, mode: 'insensitive' } },
        ];
      }
      if (args.query.from || args.query.to) {
        where.published_at = {};
        if (args.query.from) {
          where.published_at.gte = new Date(args.query.from);
        }
        if (args.query.to) {
          const toDate = new Date(args.query.to);
          toDate.setHours(23, 59, 59, 999);
          where.published_at.lte = toDate;
        }
      }

      const orderBy: Prisma.announcementsOrderByWithRelationInput = {};
      if (args.query.sortBy === 'publishedAt') {
        orderBy.published_at = args.query.sortDir ?? 'desc';
      } else {
        (orderBy as any).created_at = args.query.sortDir ?? 'desc';
      }

      const [total, items] = await this.prisma.$transaction([
        this.prisma.announcements.count({ where }),
        this.prisma.announcements.findMany({
          where,
          skip,
          take: limit,
          orderBy,
        }),
      ]);

      return {
        data: items.map((a) => ({
          id: a.id.toString(),
          audience: a.audience,
          title: a.title,
          body: a.body,
          publishedAt: a.published_at,
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

  async getForGuardian(args: { tenantId: string; announcementId: string }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const announcement_id = toBigInt(args.announcementId, 'announcementId');

      const announcement = await this.prisma.announcements.findFirst({
        where: {
          id: announcement_id,
          tenant_id,
          is_published: true,
          audience: { in: ['GUARDIANS', 'ALL'] },
        },
      });
      if (!announcement)
        throw new NotFoundException('ANNOUNCEMENT_NOT_FOUND_OR_NOT_PUBLISHED');

      return {
        id: announcement.id.toString(),
        audience: announcement.audience,
        title: announcement.title,
        body: announcement.body,
        publishedAt: announcement.published_at,
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }
}
