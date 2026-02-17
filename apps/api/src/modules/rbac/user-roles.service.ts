// apps/api/src/modules/rbac/user-roles.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogger } from '../../common/utils/audit.util';
import { rethrowServiceError } from '../../common/utils/service-error.util';

import { AssignUserRolesDto } from './dto/assign-user-roles.dto';

function toBigInt(value: unknown, field = 'id'): bigint {
  const s = String(value ?? '').trim();
  if (!/^\d+$/.test(s) || s === '0')
    throw new BadRequestException(`INVALID_${field.toUpperCase()}`);
  return BigInt(s);
}

@Injectable()
export class UserRolesService {
  private readonly auditLogger: AuditLogger;

  constructor(private readonly prisma: PrismaService) {
    this.auditLogger = new AuditLogger(prisma);
  }

  async assignRoles(args: {
    tenantId: string;
    targetUserId: string;
    actorUserId: string;
    dto: AssignUserRolesDto;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const target_user_id = toBigInt(args.targetUserId, 'targetUserId');
      const actor_user_id = args.actorUserId
        ? toBigInt(args.actorUserId, 'actorUserId')
        : null;

      // Check if target user exists and belongs to tenant
      const user = await this.prisma.users.findFirst({
        where: { id: target_user_id, tenant_id },
      });
      if (!user) throw new NotFoundException('USER_NOT_FOUND');

      // Get role IDs from dto
      const roleIds = args.dto.roleIds.map((id) => toBigInt(id, 'roleId'));

      // Verify all roles exist and belong to tenant
      const roles = await this.prisma.roles.findMany({
        where: { id: { in: roleIds }, tenant_id },
      });
      if (roles.length !== roleIds.length) {
        throw new BadRequestException('SOME_ROLES_NOT_FOUND');
      }

      // Replace all user_roles
      await this.prisma.$transaction(async (tx) => {
        await tx.user_roles.deleteMany({ where: { user_id: target_user_id } });
        if (roleIds.length) {
          await tx.user_roles.createMany({
            data: roleIds.map((roleId) => ({
              user_id: target_user_id,
              role_id: roleId,
            })),
          });
        }
      });

      // Invalidate cache for user's roles/permissions (optional)
      // await this.invalidateUserCache(target_user_id);

      await this.auditLogger.log({
        tenantId: tenant_id,
        actorType: 'STAFF',
        actorUserId: actor_user_id,
        action: 'UPDATE',
        entityType: 'user_roles',
        entityId: target_user_id,
        afterData: { roleIds: args.dto.roleIds },
        ipAddress: args.ipAddress,
      });

      return { ok: true, assignedCount: roleIds.length };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async getUserRoles(args: { tenantId: string; userId: string }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const user_id = toBigInt(args.userId, 'userId');

      const user = await this.prisma.users.findFirst({
        where: { id: user_id, tenant_id },
      });
      if (!user) throw new NotFoundException('USER_NOT_FOUND');

      const userRoles = await this.prisma.user_roles.findMany({
        where: { user_id },
        include: { roles: true },
      });

      return userRoles.map((ur) => ({
        roleId: ur.role_id.toString(),
        roleName: ur.roles.name,
      }));
    } catch (error) {
      rethrowServiceError(error);
    }
  }
}
