import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogger } from '../../common/utils/audit.util';
import { rethrowServiceError } from '../../common/utils/service-error.util';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ListUsersQueryDto } from './dto/list-users.query.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

function toBigInt(value: unknown, field = 'id'): bigint {
  const s = String(value ?? '').trim();
  if (!/^\d+$/.test(s) || s === '0')
    throw new BadRequestException(`INVALID_${field.toUpperCase()}`);
  return BigInt(s);
}

function generateRandomPassword(): string {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

@Injectable()
export class UsersService {
  private readonly auditLogger: AuditLogger;

  constructor(private readonly prisma: PrismaService) {
    this.auditLogger = new AuditLogger(prisma);
  }

  // ==================== CREATE ====================
  async create(args: {
    tenantId: string;
    createdByUserId: string;
    dto: CreateUserDto;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const created_by_user_id = toBigInt(
        args.createdByUserId,
        'createdByUserId',
      );

      // Check username uniqueness within tenant
      const existing = await this.prisma.users.findFirst({
        where: { tenant_id, username: args.dto.username },
      });
      if (existing) {
        throw new BadRequestException('USERNAME_ALREADY_EXISTS');
      }

      const rawPassword = args.dto.password || generateRandomPassword();
      const password_hash = await bcrypt.hash(rawPassword, 12);

      const user = await this.prisma.users.create({
        data: {
          tenant_id,
          username: args.dto.username,
          password_hash,
          full_name: args.dto.fullName,
          phone: args.dto.phone,
          email: args.dto.email,
          is_active: args.dto.isActive ?? true,
          created_by_user_id,
        },
      });

      if (args.dto.roleIds?.length) {
        const roleIds = args.dto.roleIds.map((id) => toBigInt(id, 'roleId'));
        const roles = await this.prisma.roles.findMany({
          where: { tenant_id, id: { in: roleIds } },
        });
        if (roles.length !== roleIds.length) {
          throw new BadRequestException('SOME_ROLES_NOT_FOUND');
        }

        await this.prisma.user_roles.createMany({
          data: roleIds.map((roleId) => ({
            user_id: user.id,
            role_id: roleId,
          })),
        });
      }

      await this.auditLogger.logStaffAction(
        tenant_id,
        created_by_user_id,
        'CREATE',
        'users',
        user.id,
        {
          before: null,
          after: {
            id: user.id.toString(),
            username: user.username,
            fullName: user.full_name,
            roles: args.dto.roleIds,
          },
        },
        args.ipAddress,
      );

      return {
        id: user.id.toString(),
        username: user.username,
        fullName: user.full_name,
        phone: user.phone,
        email: user.email,
        isActive: user.is_active,
        generatedPassword: args.dto.password ? undefined : rawPassword,
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  // ==================== LIST ====================
  async list(args: { tenantId: string; query: ListUsersQueryDto }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const page = args.query.page ?? 1;
      const limit = Math.min(args.query.limit ?? 20, 200);
      const skip = (page - 1) * limit;

      const where: Prisma.usersWhereInput = { tenant_id };
      if (args.query.q) {
        const search = args.query.q.trim();
        where.OR = [
          { username: { contains: search, mode: 'insensitive' } },
          { full_name: { contains: search, mode: 'insensitive' } },
        ];
      }
      if (args.query.isActive !== undefined) {
        where.is_active = args.query.isActive;
      }
      if (args.query.roleId) {
        const role_id = toBigInt(args.query.roleId, 'roleId');
        where.user_roles = { some: { role_id } };
      }

      const orderBy: Prisma.usersOrderByWithRelationInput = {};
      if (args.query.sortBy === 'username') {
        orderBy.username = args.query.sortDir ?? 'desc';
      } else if (args.query.sortBy === 'fullName') {
        orderBy.full_name = args.query.sortDir ?? 'desc';
      } else {
        (orderBy as any).created_at = args.query.sortDir ?? 'desc';
      }

      const [total, items] = await this.prisma.$transaction([
        this.prisma.users.count({ where }),
        this.prisma.users.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          include: {
            user_roles: { include: { roles: true } },
            _count: { select: { user_roles: true } },
          },
        }),
      ]);

      return {
        data: items.map((u) => ({
          id: u.id.toString(),
          username: u.username,
          fullName: u.full_name,
          phone: u.phone,
          email: u.email,
          isActive: u.is_active,
          createdAt: u.created_at,
          roles: u.user_roles.map((ur) => ({
            id: ur.role_id.toString(),
            name: ur.roles.name,
          })),
        })),
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  // ==================== GET BY ID ====================
  async getById(args: { tenantId: string; userId: string }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const user_id = toBigInt(args.userId, 'userId');

      const user = await this.prisma.users.findFirst({
        where: { id: user_id, tenant_id },
        include: {
          user_roles: { include: { roles: true } },
          users: { select: { username: true, full_name: true } }, // ✅ to'g'ri relation nomi
        },
      });
      if (!user) throw new NotFoundException('USER_NOT_FOUND');

      return {
        id: user.id.toString(),
        username: user.username,
        fullName: user.full_name,
        phone: user.phone,
        email: user.email,
        isActive: user.is_active,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
        lastLoginAt: user.last_login_at,
        createdBy: user.users
          ? {
              username: user.users.username,
              fullName: user.users.full_name,
            }
          : null,
        roles: user.user_roles.map((ur) => ({
          id: ur.role_id.toString(),
          name: ur.roles.name,
        })),
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  // ==================== UPDATE ====================
  async update(args: {
    tenantId: string;
    userId: string;
    updatedByUserId: string;
    dto: UpdateUserDto;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const user_id = toBigInt(args.userId, 'userId');
      const updated_by_user_id = toBigInt(
        args.updatedByUserId,
        'updatedByUserId',
      );

      const user = await this.prisma.users.findFirst({
        where: { id: user_id, tenant_id },
        include: { user_roles: { include: { roles: true } } },
      });
      if (!user) throw new NotFoundException('USER_NOT_FOUND');

      if (args.dto.username && args.dto.username !== user.username) {
        const existing = await this.prisma.users.findFirst({
          where: { tenant_id, username: args.dto.username },
        });
        if (existing) throw new BadRequestException('USERNAME_ALREADY_EXISTS');
      }

      const updateData: Prisma.usersUpdateInput = {};
      if (args.dto.username) updateData.username = args.dto.username;
      if (args.dto.fullName) updateData.full_name = args.dto.fullName;
      if (args.dto.phone !== undefined) updateData.phone = args.dto.phone;
      if (args.dto.email !== undefined) updateData.email = args.dto.email;
      if (args.dto.isActive !== undefined)
        updateData.is_active = args.dto.isActive;

      const updated = await this.prisma.users.update({
        where: { id: user_id },
        data: updateData,
      });

      if (args.dto.roleIds) {
        const roleIds = args.dto.roleIds.map((id) => toBigInt(id, 'roleId'));
        const roles = await this.prisma.roles.findMany({
          where: { tenant_id, id: { in: roleIds } },
        });
        if (roles.length !== roleIds.length) {
          throw new BadRequestException('SOME_ROLES_NOT_FOUND');
        }

        await this.prisma.user_roles.deleteMany({ where: { user_id } });
        if (roleIds.length) {
          await this.prisma.user_roles.createMany({
            data: roleIds.map((roleId) => ({ user_id, role_id: roleId })),
          });
        }
      }

      await this.auditLogger.logStaffAction(
        tenant_id,
        updated_by_user_id,
        'UPDATE',
        'users',
        user_id,
        {
          before: { username: user.username },
          after: { username: updated.username },
        },
        args.ipAddress,
      );

      return { id: updated.id.toString(), username: updated.username };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  // ==================== DELETE (soft delete) ====================
  async delete(args: {
    tenantId: string;
    userId: string;
    deletedByUserId: string;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const user_id = toBigInt(args.userId, 'userId');
      const deleted_by_user_id = toBigInt(
        args.deletedByUserId,
        'deletedByUserId',
      );

      const user = await this.prisma.users.findFirst({
        where: { id: user_id, tenant_id },
      });
      if (!user) throw new NotFoundException('USER_NOT_FOUND');

      await this.prisma.users.update({
        where: { id: user_id },
        data: { is_active: false },
      });

      await this.auditLogger.logStaffAction(
        tenant_id,
        deleted_by_user_id,
        'DELETE',
        'users',
        user_id,
        {
          before: { username: user.username, isActive: true },
          after: { isActive: false },
        },
        args.ipAddress,
      );

      return { ok: true, message: 'User deactivated' };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  // ==================== RESET PASSWORD ====================
  async resetPassword(args: {
    tenantId: string;
    userId: string;
    updatedByUserId: string;
    dto: ResetPasswordDto;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const user_id = toBigInt(args.userId, 'userId');
      const updated_by_user_id = toBigInt(
        args.updatedByUserId,
        'updatedByUserId',
      );

      const user = await this.prisma.users.findFirst({
        where: { id: user_id, tenant_id },
      });
      if (!user) throw new NotFoundException('USER_NOT_FOUND');

      const newPassword = args.dto.newPassword || generateRandomPassword();
      const password_hash = await bcrypt.hash(newPassword, 12);

      await this.prisma.users.update({
        where: { id: user_id },
        data: { password_hash, updated_at: new Date() },
      });

      // Revoke all active sessions
      await this.prisma.auth_sessions.updateMany({
        where: { user_id, revoked_at: null },
        data: { revoked_at: new Date() },
      });

      await this.auditLogger.logStaffAction(
        tenant_id,
        updated_by_user_id,
        'RESET_PASSWORD',
        'users',
        user_id,
        { before: { passwordReset: false }, after: { passwordReset: true } },
        args.ipAddress,
      );

      return {
        ok: true,
        newPassword: args.dto.newPassword ? undefined : newPassword,
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async getStaffCount(tenantId: string) {
    const tenant_id = toBigInt(tenantId, 'tenantId');
    const count = await this.prisma.users.count({
      where: {
        tenant_id,
        is_active: true,
      },
    });
    return { count };
  }

  async getTeacherWorkload(tenantId: string) {
    const tenant_id = toBigInt(tenantId, 'tenantId');
    const teachers = await this.prisma.users.findMany({
      where: {
        tenant_id,
        is_active: true,
        // Assuming staff/teachers are identified by some other means if 'type' is missing
        // or just list all active staff users in the tenant.
      },
      select: {
        id: true,
        full_name: true,
        _count: {
          select: {
            timetable_lessons: true,
          },
        },
      },
    });

    return teachers
      .map((t) => ({
        name: t.full_name,
        lessons: t._count.timetable_lessons,
      }))
      .sort((a, b) => b.lessons - a.lessons)
      .slice(0, 10);
  }
}
