// apps/api/src/modules/rbac/roles.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogger } from '../../common/utils/audit.util';
import { rethrowServiceError } from '../../common/utils/service-error.util';

import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AssignPermissionsDto } from './dto/assign-permissions.dto';
import { ListRolesQueryDto } from './dto/list-roles.query.dto';

function toBigInt(value: unknown, field = 'id'): bigint {
  const s = String(value ?? '').trim();
  if (!/^\d+$/.test(s) || s === '0')
    throw new BadRequestException(`INVALID_${field.toUpperCase()}`);
  return BigInt(s);
}

@Injectable()
export class RolesService {
  private readonly auditLogger: AuditLogger;

  constructor(private readonly prisma: PrismaService) {
    this.auditLogger = new AuditLogger(prisma);
  }

  async create(args: {
    tenantId: string;
    userId: string;
    dto: CreateRoleDto;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const created_by_user_id = args.userId
        ? toBigInt(args.userId, 'userId')
        : null;

      // Check if role already exists for this tenant
      const existing = await this.prisma.roles.findFirst({
        where: { tenant_id, name: args.dto.name },
      });
      if (existing) throw new BadRequestException('ROLE_ALREADY_EXISTS');

      const role = await this.prisma.roles.create({
        data: {
          tenant_id,
          name: args.dto.name,
        },
      });

      await this.auditLogger.log({
        tenantId: tenant_id,
        actorType: 'STAFF',
        actorUserId: created_by_user_id,
        action: 'CREATE',
        entityType: 'roles',
        entityId: role.id,
        afterData: { name: role.name },
        ipAddress: args.ipAddress,
      });

      return {
        id: role.id.toString(),
        name: role.name,
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async list(args: { tenantId: string; query: ListRolesQueryDto }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const page = args.query.page ?? 1;
      const limit = Math.min(args.query.limit ?? 20, 200);
      const skip = (page - 1) * limit;

      const where: Prisma.rolesWhereInput = { tenant_id };

      const [total, items] = await this.prisma.$transaction([
        this.prisma.roles.count({ where }),
        this.prisma.roles.findMany({
          where,
          skip,
          take: limit,
          orderBy: { name: 'asc' },
          include: {
            _count: { select: { user_roles: true, role_permissions: true } },
          },
        }),
      ]);

      return {
        data: items.map((r) => ({
          id: r.id.toString(),
          name: r.name,
          usersCount: r._count.user_roles,
          permissionsCount: r._count.role_permissions,
          createdAt: r.created_at,
        })),
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async getById(args: { tenantId: string; roleId: string }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const role_id = toBigInt(args.roleId, 'roleId');

      const role = await this.prisma.roles.findFirst({
        where: { id: role_id, tenant_id },
        include: {
          role_permissions: {
            include: { permissions: true },
          },
        },
      });
      if (!role) throw new NotFoundException('ROLE_NOT_FOUND');

      return {
        id: role.id.toString(),
        name: role.name,
        permissions: role.role_permissions.map((rp) => ({
          id: rp.permissions.id.toString(),
          code: rp.permissions.code,
          description: rp.permissions.description,
        })),
        createdAt: role.created_at,
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async update(args: {
    tenantId: string;
    roleId: string;
    userId: string;
    dto: UpdateRoleDto;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const role_id = toBigInt(args.roleId, 'roleId');
      const updated_by_user_id = args.userId
        ? toBigInt(args.userId, 'userId')
        : null;

      const role = await this.prisma.roles.findFirst({
        where: { id: role_id, tenant_id },
      });
      if (!role) throw new NotFoundException('ROLE_NOT_FOUND');

      if (args.dto.name && args.dto.name !== role.name) {
        const existing = await this.prisma.roles.findFirst({
          where: { tenant_id, name: args.dto.name },
        });
        if (existing) throw new BadRequestException('ROLE_NAME_ALREADY_EXISTS');
      }

      const updated = await this.prisma.roles.update({
        where: { id: role_id },
        data: { name: args.dto.name },
      });

      await this.auditLogger.log({
        tenantId: tenant_id,
        actorType: 'STAFF',
        actorUserId: updated_by_user_id,
        action: 'UPDATE',
        entityType: 'roles',
        entityId: role_id,
        beforeData: { name: role.name },
        afterData: { name: updated.name },
        ipAddress: args.ipAddress,
      });

      return { id: updated.id.toString(), name: updated.name };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async delete(args: {
    tenantId: string;
    roleId: string;
    userId: string;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const role_id = toBigInt(args.roleId, 'roleId');
      const deleted_by_user_id = args.userId
        ? toBigInt(args.userId, 'userId')
        : null;

      const role = await this.prisma.roles.findFirst({
        where: { id: role_id, tenant_id },
      });
      if (!role) throw new NotFoundException('ROLE_NOT_FOUND');

      // Check if role is assigned to any user
      const userRolesCount = await this.prisma.user_roles.count({
        where: { role_id },
      });
      if (userRolesCount > 0) {
        throw new BadRequestException('ROLE_IS_ASSIGNED_TO_USERS');
      }

      await this.prisma.roles.delete({ where: { id: role_id } });

      await this.auditLogger.log({
        tenantId: tenant_id,
        actorType: 'STAFF',
        actorUserId: deleted_by_user_id,
        action: 'DELETE',
        entityType: 'roles',
        entityId: role_id,
        beforeData: { name: role.name },
        ipAddress: args.ipAddress,
      });

      return { ok: true };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async assignPermissions(args: {
    tenantId: string;
    roleId: string;
    userId: string;
    dto: AssignPermissionsDto;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const role_id = toBigInt(args.roleId, 'roleId');
      const updated_by_user_id = args.userId
        ? toBigInt(args.userId, 'userId')
        : null;

      const role = await this.prisma.roles.findFirst({
        where: { id: role_id, tenant_id },
      });
      if (!role) throw new NotFoundException('ROLE_NOT_FOUND');

      // Get permission IDs from codes
      const permissions = await this.prisma.permissions.findMany({
        where: { code: { in: args.dto.permissionCodes } },
      });
      if (permissions.length !== args.dto.permissionCodes.length) {
        const foundCodes = permissions.map((p) => p.code);
        const missing = args.dto.permissionCodes.filter(
          (c) => !foundCodes.includes(c),
        );
        throw new BadRequestException(
          `PERMISSIONS_NOT_FOUND: ${missing.join(', ')}`,
        );
      }

      // Replace all role_permissions
      await this.prisma.$transaction(async (tx) => {
        await tx.role_permissions.deleteMany({ where: { role_id } });

        await tx.role_permissions.createMany({
          data: permissions.map((p) => ({ role_id, permission_id: p.id })),
        });
      });

      await this.auditLogger.log({
        tenantId: tenant_id,
        actorType: 'STAFF',
        actorUserId: updated_by_user_id,
        action: 'UPDATE',
        entityType: 'role_permissions',
        entityId: role_id,
        afterData: { permissionCodes: args.dto.permissionCodes },
        ipAddress: args.ipAddress,
      });

      return { ok: true, assignedCount: permissions.length };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async getPermissions(args: { tenantId: string; roleId: string }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const role_id = toBigInt(args.roleId, 'roleId');

      const role = await this.prisma.roles.findFirst({
        where: { id: role_id, tenant_id },
      });
      if (!role) throw new NotFoundException('ROLE_NOT_FOUND');

      const rolePermissions = await this.prisma.role_permissions.findMany({
        where: { role_id },
        include: { permissions: true },
      });

      return rolePermissions.map((rp) => ({
        id: rp.permissions.id.toString(),
        code: rp.permissions.code,
        description: rp.permissions.description,
      }));
    } catch (error) {
      rethrowServiceError(error);
    }
  }
}
