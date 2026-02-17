import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogger } from '../../common/utils/audit.util';
import { rethrowServiceError } from '../../common/utils/service-error.util';

import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { ListTenantsQueryDto } from './dto/list-tenants.query.dto';

function toBigInt(value: unknown, field = 'id'): bigint {
  const s = String(value ?? '').trim();
  if (!/^\d+$/.test(s) || s === '0')
    throw new BadRequestException(`INVALID_${field.toUpperCase()}`);
  return BigInt(s);
}

@Injectable()
export class TenantsService {
  private readonly auditLogger: AuditLogger;

  constructor(private readonly prisma: PrismaService) {
    this.auditLogger = new AuditLogger(prisma);
  }

  async create(args: {
    userId: string;
    dto: CreateTenantDto;
    ipAddress?: string;
  }) {
    try {
      const created_by_user_id = args.userId
        ? toBigInt(args.userId, 'userId')
        : null;

      // Check if slug already exists
      const existing = await this.prisma.tenants.findUnique({
        where: { slug: args.dto.slug },
      });
      if (existing) throw new BadRequestException('SLUG_ALREADY_EXISTS');

      const tenant = await this.prisma.tenants.create({
        data: {
          name: args.dto.name.trim(),
          slug: args.dto.slug,
          timezone: args.dto.timezone ?? 'Asia/Tashkent',
        },
      });

      await this.auditLogger.log({
        tenantId: tenant.id,
        actorType: 'STAFF',
        actorUserId: created_by_user_id,
        action: 'CREATE',
        entityType: 'tenants',
        entityId: tenant.id,
        afterData: {
          id: tenant.id.toString(),
          name: tenant.name,
          slug: tenant.slug,
        },
        ipAddress: args.ipAddress,
      });

      return {
        id: tenant.id.toString(),
        name: tenant.name,
        slug: tenant.slug,
        timezone: tenant.timezone,
        createdAt: tenant.created_at,
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async list(args: { query: ListTenantsQueryDto }) {
    try {
      const page = args.query.page ?? 1;
      const limit = Math.min(args.query.limit ?? 20, 200);
      const skip = (page - 1) * limit;

      const where: Prisma.tenantsWhereInput = {};
      if (args.query.q) {
        const search = args.query.q.trim();
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { slug: { contains: search, mode: 'insensitive' } },
        ];
      }

      const orderBy: Prisma.tenantsOrderByWithRelationInput = {};
      if (args.query.sortBy === 'name') {
        orderBy.name = args.query.sortDir ?? 'asc';
      } else if (args.query.sortBy === 'slug') {
        orderBy.slug = args.query.sortDir ?? 'asc';
      } else if (args.query.sortBy === 'id') {
        orderBy.id = args.query.sortDir ?? 'asc';
      } else {
        (orderBy as any).created_at = args.query.sortDir ?? 'asc';
      }

      const [total, items] = await this.prisma.$transaction([
        this.prisma.tenants.count({ where }),
        this.prisma.tenants.findMany({
          where,
          skip,
          take: limit,
          orderBy,
        }),
      ]);

      return {
        data: items.map((t) => ({
          id: t.id.toString(),
          name: t.name,
          slug: t.slug,
          timezone: t.timezone,
          createdAt: t.created_at,
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

  async getById(args: { tenantId: string }) {
    try {
      const id = toBigInt(args.tenantId, 'tenantId');
      const tenant = await this.prisma.tenants.findUnique({ where: { id } });
      if (!tenant) throw new NotFoundException('TENANT_NOT_FOUND');
      return {
        id: tenant.id.toString(),
        name: tenant.name,
        slug: tenant.slug,
        timezone: tenant.timezone,
        createdAt: tenant.created_at,
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async update(args: {
    tenantId: string;
    userId: string;
    dto: UpdateTenantDto;
    ipAddress?: string;
  }) {
    try {
      const id = toBigInt(args.tenantId, 'tenantId');
      const updated_by_user_id = args.userId
        ? toBigInt(args.userId, 'userId')
        : null;

      const tenant = await this.prisma.tenants.findUnique({ where: { id } });
      if (!tenant) throw new NotFoundException('TENANT_NOT_FOUND');

      if (args.dto.slug && args.dto.slug !== tenant.slug) {
        const existing = await this.prisma.tenants.findUnique({
          where: { slug: args.dto.slug },
        });
        if (existing) throw new BadRequestException('SLUG_ALREADY_EXISTS');
      }

      const updateData: Prisma.tenantsUpdateInput = {};
      if (args.dto.name) updateData.name = args.dto.name.trim();
      if (args.dto.slug) updateData.slug = args.dto.slug;
      if (args.dto.timezone) updateData.timezone = args.dto.timezone;

      const updated = await this.prisma.tenants.update({
        where: { id },
        data: updateData,
      });

      await this.auditLogger.log({
        tenantId: id,
        actorType: 'STAFF',
        actorUserId: updated_by_user_id,
        action: 'UPDATE',
        entityType: 'tenants',
        entityId: id,
        beforeData: {
          id: tenant.id.toString(),
          name: tenant.name,
          slug: tenant.slug,
        },
        afterData: {
          id: updated.id.toString(),
          name: updated.name,
          slug: updated.slug,
        },
        ipAddress: args.ipAddress,
      });

      return {
        id: updated.id.toString(),
        name: updated.name,
        slug: updated.slug,
        timezone: updated.timezone,
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async delete(args: { tenantId: string; userId: string; ipAddress?: string }) {
    try {
      const id = toBigInt(args.tenantId, 'tenantId');
      const deleted_by_user_id = args.userId
        ? toBigInt(args.userId, 'userId')
        : null;

      const tenant = await this.prisma.tenants.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              users: true,
              students: true,
              groups: true,
              // add other key relations if needed
            },
          },
        },
      });
      if (!tenant) throw new NotFoundException('TENANT_NOT_FOUND');

      // Prevent deletion if tenant has any data
      if (
        tenant._count.users > 0 ||
        tenant._count.students > 0 ||
        tenant._count.groups > 0
      ) {
        throw new BadRequestException('TENANT_HAS_DEPENDENCIES');
      }

      await this.prisma.tenants.delete({ where: { id } });

      await this.auditLogger.log({
        tenantId: id,
        actorType: 'STAFF',
        actorUserId: deleted_by_user_id,
        action: 'DELETE',
        entityType: 'tenants',
        entityId: id,
        beforeData: { id: tenant.id.toString(), name: tenant.name },
        ipAddress: args.ipAddress,
      });

      return { ok: true };
    } catch (error) {
      rethrowServiceError(error);
    }
  }
}
