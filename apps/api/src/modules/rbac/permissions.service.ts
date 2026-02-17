// apps/api/src/modules/rbac/permissions.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogger } from '../../common/utils/audit.util';
import { rethrowServiceError } from '../../common/utils/service-error.util';

import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { ListPermissionsQueryDto } from './dto/list-permissions.query.dto';

function toBigInt(value: unknown, field = 'id'): bigint {
  const s = String(value ?? '').trim();
  if (!/^\d+$/.test(s) || s === '0')
    throw new BadRequestException(`INVALID_${field.toUpperCase()}`);
  return BigInt(s);
}

@Injectable()
export class PermissionsService {
  private readonly auditLogger: AuditLogger;

  constructor(private readonly prisma: PrismaService) {
    this.auditLogger = new AuditLogger(prisma);
  }

  async create(args: {
    tenantId: string;
    userId: string;
    dto: CreatePermissionDto;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const created_by_user_id = args.userId
        ? toBigInt(args.userId, 'userId')
        : null;

      const existing = await this.prisma.permissions.findUnique({
        where: { code: args.dto.code },
      });
      if (existing)
        throw new BadRequestException('PERMISSION_CODE_ALREADY_EXISTS');

      const permission = await this.prisma.permissions.create({
        data: {
          code: args.dto.code,
          description: args.dto.description,
        },
      });

      await this.auditLogger.log({
        tenantId: tenant_id,
        actorType: 'STAFF',
        actorUserId: created_by_user_id,
        action: 'CREATE',
        entityType: 'permissions',
        entityId: permission.id,
        afterData: { code: permission.code },
        ipAddress: args.ipAddress,
      });

      return {
        id: permission.id.toString(),
        code: permission.code,
        description: permission.description,
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async list(args: { query: ListPermissionsQueryDto }) {
    try {
      const page = args.query.page ?? 1;
      const limit = Math.min(args.query.limit ?? 50, 200);
      const skip = (page - 1) * limit;

      const [total, items] = await this.prisma.$transaction([
        this.prisma.permissions.count(),
        this.prisma.permissions.findMany({
          skip,
          take: limit,
          orderBy: { code: 'asc' },
        }),
      ]);

      return {
        data: items.map((p) => ({
          id: p.id.toString(),
          code: p.code,
          description: p.description,
        })),
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async getById(args: { permissionId: string }) {
    try {
      const id = toBigInt(args.permissionId, 'permissionId');
      const permission = await this.prisma.permissions.findUnique({
        where: { id },
      });
      if (!permission) throw new NotFoundException('PERMISSION_NOT_FOUND');
      return {
        id: permission.id.toString(),
        code: permission.code,
        description: permission.description,
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async update(args: {
    tenantId: string;
    permissionId: string;
    userId: string;
    dto: UpdatePermissionDto;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const id = toBigInt(args.permissionId, 'permissionId');
      const updated_by_user_id = args.userId
        ? toBigInt(args.userId, 'userId')
        : null;

      const permission = await this.prisma.permissions.findUnique({
        where: { id },
      });
      if (!permission) throw new NotFoundException('PERMISSION_NOT_FOUND');

      if (args.dto.code && args.dto.code !== permission.code) {
        const existing = await this.prisma.permissions.findUnique({
          where: { code: args.dto.code },
        });
        if (existing)
          throw new BadRequestException('PERMISSION_CODE_ALREADY_EXISTS');
      }

      const updated = await this.prisma.permissions.update({
        where: { id },
        data: {
          code: args.dto.code,
          description: args.dto.description,
        },
      });

      await this.auditLogger.log({
        tenantId: tenant_id,
        actorType: 'STAFF',
        actorUserId: updated_by_user_id,
        action: 'UPDATE',
        entityType: 'permissions',
        entityId: id,
        beforeData: { code: permission.code },
        afterData: { code: updated.code },
        ipAddress: args.ipAddress,
      });

      return {
        id: updated.id.toString(),
        code: updated.code,
        description: updated.description,
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async delete(args: {
    tenantId: string;
    permissionId: string;
    userId: string;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const id = toBigInt(args.permissionId, 'permissionId');
      const deleted_by_user_id = args.userId
        ? toBigInt(args.userId, 'userId')
        : null;

      const permission = await this.prisma.permissions.findUnique({
        where: { id },
      });
      if (!permission) throw new NotFoundException('PERMISSION_NOT_FOUND');

      // Check if permission is used in any role_permissions
      const used = await this.prisma.role_permissions.count({
        where: { permission_id: id },
      });
      if (used > 0) {
        throw new BadRequestException('PERMISSION_IS_ASSIGNED_TO_ROLES');
      }

      await this.prisma.permissions.delete({ where: { id } });

      await this.auditLogger.log({
        tenantId: tenant_id,
        actorType: 'STAFF',
        actorUserId: deleted_by_user_id,
        action: 'DELETE',
        entityType: 'permissions',
        entityId: id,
        beforeData: { code: permission.code },
        ipAddress: args.ipAddress,
      });

      return { ok: true };
    } catch (error) {
      rethrowServiceError(error);
    }
  }
}
