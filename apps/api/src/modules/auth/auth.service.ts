// src/modules/auth/auth.service.ts - MUKAMMAL VERSIYA
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { StaffLoginDto } from './dto/staff-login.dto';
import { GuardianLoginDto } from './dto/guardian-login.dto';
import { GuardianChangePasswordDto } from './dto/guardian-change-password.dto';
import { StaffChangePasswordDto } from './dto/staff-change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

type AccountType = 'STAFF' | 'GUARDIAN';
type AuditAction =
  | 'LOGIN'
  | 'LOGOUT'
  | 'CHANGE_PASSWORD'
  | 'RESET_PASSWORD'
  | 'LOCK_ACCOUNT'
  | 'UNLOCK_ACCOUNT'
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE' // ✅ UPDATE qo'shildi
  | 'EXPORT'
  | 'IMPORT'
  | 'OTHER';

function sha256Hex(v: string): string {
  return createHash('sha256').update(v).digest('hex');
}

function now(): Date {
  return new Date();
}

function addHours(d: Date, h: number): Date {
  return new Date(d.getTime() + h * 60 * 60 * 1000);
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}

function requireEnv(name: string): string {
  const v = String(process.env[name] || '').trim();
  if (!v) throw new InternalServerErrorException(`MISSING_ENV_${name}`);
  return v;
}

function parseGuardianLogin(
  studentId: string,
): { tenantSlug: string; loginId: string; raw: string } | null {
  const s = String(studentId || '').trim();
  const idx = s.indexOf('-');
  if (idx <= 0 || idx === s.length - 1) return null;
  const tenantSlug = s.slice(0, idx).trim().toLowerCase();
  const loginId = s.slice(idx + 1).trim();
  if (!tenantSlug || !loginId) return null;
  return { tenantSlug, loginId, raw: s };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  // ==================== HELPER METHODS ====================

  private cookieName(): string {
    return process.env.COOKIE_NAME_REFRESH || 'madc_rt';
  }

  private accessTtl(): string {
    return process.env.ACCESS_TOKEN_TTL || '15m';
  }

  private refreshDays(): number {
    const n = Number(process.env.REFRESH_TOKEN_DAYS || '30');
    return Number.isFinite(n) && n > 0 ? n : 30;
  }

  private isSecureCookie(): boolean {
    return process.env.NODE_ENV === 'production';
  }

  private cookieOptions(): { sameSite: 'none' | 'lax'; secure: boolean } {
    const isProd = process.env.NODE_ENV === 'production';
    return {
      sameSite: isProd ? 'none' : 'lax',
      secure: isProd,
    };
  }

  private setRefreshCookie(
    res: Response,
    token: string,
    expiresAt: Date,
  ): void {
    res.cookie(this.cookieName(), token, {
      httpOnly: true,
      ...this.cookieOptions(),
      path: '/api/auth/refresh',
      expires: expiresAt,
    });
  }

  private clearRefreshCookie(res: Response): void {
    res.clearCookie(this.cookieName(), {
      httpOnly: true,
      ...this.cookieOptions(),
      path: '/api/auth/refresh',
    });
  }

  private getIpUa(req: Request): { ip: string | null; ua: string | null } {
    const xf = String(req.headers['x-forwarded-for'] || '')
      .split(',')[0]
      ?.trim();
    const ip = xf || req.ip || null;
    const ua = (req.headers['user-agent'] as string) || null;
    return { ip, ua };
  }

  private async getTenantIdBySlugOrThrow(tenantSlug: string): Promise<bigint> {
    const t = await this.prisma.tenants.findUnique({
      where: { slug: tenantSlug },
      select: { id: true },
    });
    if (!t) throw new UnauthorizedException('TENANT_NOT_FOUND');
    return t.id;
  }

  private async auditLog(args: {
    tenantId: bigint;
    actorType: 'STAFF' | 'GUARDIAN' | 'SYSTEM';
    actorUserId?: bigint;
    actorStudentAccountId?: bigint;
    action: AuditAction;
    entityType: string;
    entityId?: bigint;
    beforeData?: any;
    afterData?: any;
    ipAddress?: string;
  }): Promise<void> {
    try {
      await this.prisma.audit_logs.create({
        data: {
          tenant_id: args.tenantId,
          actor_type: args.actorType,
          actor_user_id: args.actorUserId,
          actor_student_account_id: args.actorStudentAccountId,
          action: args.action,
          entity_type: args.entityType,
          entity_id: args.entityId,
          before_data: args.beforeData ? JSON.stringify(args.beforeData) : null,
          after_data: args.afterData ? JSON.stringify(args.afterData) : null,
          ip_address: args.ipAddress,
        },
      });
    } catch (error) {
      console.error('Audit logging failed:', error);
    }
  }

  // ==================== SECURITY METHODS ====================

  private async ensureNotLocked(
    tenantId: bigint,
    accountType: AccountType,
    usernameOrId: string,
  ): Promise<void> {
    const lock = await this.prisma.auth_locks.findUnique({
      where: {
        tenant_id_account_type_username_or_id: {
          tenant_id: tenantId,
          account_type: accountType,
          username_or_id: usernameOrId,
        },
      },
      select: { locked_until: true, reason: true },
    });

    if (lock?.locked_until && lock.locked_until > now()) {
      throw new ForbiddenException(
        `ACCOUNT_LOCKED: ${lock.reason || 'Too many attempts'}`,
      );
    }
  }

  private async logAttempt(
    tenantId: bigint,
    accountType: AccountType,
    usernameOrId: string,
    success: boolean,
    req: Request,
  ): Promise<void> {
    const { ip, ua } = this.getIpUa(req);

    await this.prisma.auth_attempts.create({
      data: {
        tenant_id: tenantId,
        account_type: accountType,
        username_or_id: usernameOrId,
        success,
        ip_address: ip,
        user_agent: ua,
      },
    });
  }

  private async maybeLock(
    tenantId: bigint,
    accountType: AccountType,
    usernameOrId: string,
    req: Request,
  ): Promise<void> {
    const lockConfig = {
      windowHours: 1,
      maxAttempts: 5,
      lockDurationHours: 3,
    };

    const since = addHours(now(), -lockConfig.windowHours);

    const recentFails = await this.prisma.auth_attempts.count({
      where: {
        tenant_id: tenantId,
        account_type: accountType,
        username_or_id: usernameOrId,
        success: false,
        created_at: { gte: since },
      },
    });

    if (recentFails >= lockConfig.maxAttempts) {
      const lockedUntil = addHours(now(), lockConfig.lockDurationHours);
      const { ip } = this.getIpUa(req);

      await this.auditLog({
        tenantId,
        actorType: 'SYSTEM',
        action: 'LOCK_ACCOUNT',
        entityType: accountType === 'STAFF' ? 'users' : 'student_accounts',
        beforeData: { locked: false },
        afterData: {
          locked: true,
          lockedUntil,
          reason: 'TOO_MANY_ATTEMPTS',
          attempts: recentFails,
        },
        ipAddress: ip || undefined,
      });

      await this.prisma.auth_locks.upsert({
        where: {
          tenant_id_account_type_username_or_id: {
            tenant_id: tenantId,
            account_type: accountType,
            username_or_id: usernameOrId,
          },
        },
        create: {
          tenant_id: tenantId,
          account_type: accountType,
          username_or_id: usernameOrId,
          locked_until: lockedUntil,
          reason: 'TOO_MANY_ATTEMPTS',
        },
        update: {
          locked_until: lockedUntil,
          reason: 'TOO_MANY_ATTEMPTS',
        },
      });
    }
  }

  private async clearLock(
    tenantId: bigint,
    accountType: AccountType,
    usernameOrId: string,
  ): Promise<void> {
    await this.prisma.auth_locks.deleteMany({
      where: {
        tenant_id: tenantId,
        account_type: accountType,
        username_or_id: usernameOrId,
      },
    });
  }

  // ==================== TOKEN & SESSION METHODS ====================

  private async issueTokens(payload: Record<string, any>): Promise<{
    accessToken: string;
    refreshToken: string;
    refreshTokenHash: string;
    refreshExpiresAt: Date;
  }> {
    const accessToken = await this.jwt.signAsync(payload, {
      secret: requireEnv('JWT_ACCESS_SECRET'),
      expiresIn: this.accessTtl() as any,
    });

    const refreshToken = randomBytes(48).toString('hex');
    const refreshTokenHash = sha256Hex(refreshToken);
    const refreshExpiresAt = addDays(now(), this.refreshDays());

    return { accessToken, refreshToken, refreshTokenHash, refreshExpiresAt };
  }

  private async createSession(args: {
    tenantId: bigint;
    accountType: AccountType;
    userId?: bigint | null;
    studentAccountId?: bigint | null;
    refreshTokenHash: string;
    refreshExpiresAt: Date;
    req: Request;
  }): Promise<bigint> {
    const { ip, ua } = this.getIpUa(args.req);

    const s = await this.prisma.auth_sessions.create({
      data: {
        tenant_id: args.tenantId,
        account_type: args.accountType,
        user_id: args.userId ?? null,
        student_account_id: args.studentAccountId ?? null,
        refresh_token_hash: args.refreshTokenHash,
        device_info: ua,
        ip_address: ip,
        expires_at: args.refreshExpiresAt,
      },
      select: { id: true },
    });

    return s.id;
  }

  private async getStaffRolesPermissions(userId: bigint): Promise<{
    roles: string[];
    permissions: string[];
  }> {
    const cacheKey = `user:${userId}:roles_perms`;
    const cached = await this.cacheManager.get<{
      roles: string[];
      permissions: string[];
    }>(cacheKey);

    if (cached) return cached;

    const ur = await this.prisma.user_roles.findMany({
      where: { user_id: userId },
      include: {
        roles: {
          include: {
            role_permissions: {
              include: { permissions: true },
            },
          },
        },
      },
    });

    const roles = ur.map((x) => x.roles.name);
    const permissionsSet = new Set<string>();

    ur.forEach((userRole) => {
      userRole.roles.role_permissions.forEach((rp) => {
        permissionsSet.add(rp.permissions.code);
      });
    });

    const result = {
      roles,
      permissions: Array.from(permissionsSet),
    };

    await this.cacheManager.set(cacheKey, result, 5 * 60 * 1000);
    return result;
  }

  private async invalidateUserCache(userId: bigint): Promise<void> {
    await this.cacheManager.del(`user:${userId}:roles_perms`);
  }

  // ==================== PUBLIC AUTH METHODS ====================

  async staffLogin(
    dto: StaffLoginDto,
    req: Request,
    res: Response,
  ): Promise<{
    accessToken: string;
    staff: { id: string; fullName: string; username: string };
    roles: string[];
    permissions: string[];
    tenantId: string;
  }> {
    try {
      const tenantSlug = String(dto.tenantSlug || '').trim();
      const tenantId = await this.getTenantIdBySlugOrThrow(tenantSlug);

      const username = String(dto.username || '').trim();
      if (!username) throw new UnauthorizedException('INVALID_CREDENTIALS');

      await this.ensureNotLocked(tenantId, 'STAFF', username);

      const user = await this.prisma.users.findFirst({
        where: { tenant_id: tenantId, username },
        select: {
          id: true,
          password_hash: true,
          is_active: true,
          full_name: true,
          username: true,
        },
      });

      if (!user || !user.is_active) {
        await this.logAttempt(tenantId, 'STAFF', username, false, req);
        await this.maybeLock(tenantId, 'STAFF', username, req);
        throw new UnauthorizedException('INVALID_CREDENTIALS');
      }

      const passwordMatch = await bcrypt.compare(
        String(dto.password),
        user.password_hash,
      );
      if (!passwordMatch) {
        await this.logAttempt(tenantId, 'STAFF', username, false, req);
        await this.maybeLock(tenantId, 'STAFF', username, req);
        throw new UnauthorizedException('INVALID_CREDENTIALS');
      }

      await this.logAttempt(tenantId, 'STAFF', username, true, req);
      await this.clearLock(tenantId, 'STAFF', username);

      const { ip } = this.getIpUa(req);
      await this.auditLog({
        tenantId,
        actorType: 'STAFF',
        actorUserId: user.id,
        action: 'LOGIN',
        entityType: 'users',
        entityId: user.id,
        ipAddress: ip || undefined,
      });

      await this.prisma.users.update({
        where: { id: user.id },
        data: { last_login_at: now(), updated_at: now() },
      });

      const { roles, permissions } = await this.getStaffRolesPermissions(
        user.id,
      );

      const payload = {
        tenantId: tenantId.toString(),
        type: 'STAFF',
        userId: user.id.toString(),
        roles,
        permissions,
      };

      const { accessToken, refreshToken, refreshTokenHash, refreshExpiresAt } =
        await this.issueTokens(payload);

      await this.createSession({
        tenantId,
        accountType: 'STAFF',
        userId: user.id,
        studentAccountId: null,
        refreshTokenHash,
        refreshExpiresAt,
        req,
      });

      this.setRefreshCookie(res, refreshToken, refreshExpiresAt);

      return {
        accessToken,
        staff: {
          id: user.id.toString(),
          fullName: user.full_name,
          username: user.username,
        },
        roles,
        permissions,
        tenantId: tenantId.toString(),
      };
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof ForbiddenException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      console.error('Staff login error:', error);
      throw new InternalServerErrorException('AUTH_STAFF_LOGIN_FAILED');
    }
  }

  async guardianLogin(
    dto: GuardianLoginDto,
    req: Request,
    res: Response,
  ): Promise<{
    accessToken: string;
    mustChangePassword: boolean;
    studentId: string;
    studentAccountId: string;
  }> {
    try {
      const parsed = parseGuardianLogin(String(dto.studentId));
      if (!parsed) throw new UnauthorizedException('INVALID_STUDENT_ID_FORMAT');

      const tenantId = await this.getTenantIdBySlugOrThrow(parsed.tenantSlug);
      const usernameOrId = String(dto.studentId || '').trim();

      await this.ensureNotLocked(tenantId, 'GUARDIAN', usernameOrId);

      const account = await this.prisma.student_accounts.findFirst({
        where: { tenant_id: tenantId, student_login_id: parsed.loginId },
        select: {
          id: true,
          password_hash: true,
          is_active: true,
          must_change_password: true,
          student_id: true,
          students: {
            select: {
              id: true,
              full_name: true,
              groups: { select: { name: true } },
            },
          },
        },
      });

      if (!account || !account.is_active) {
        await this.logAttempt(tenantId, 'GUARDIAN', usernameOrId, false, req);
        await this.maybeLock(tenantId, 'GUARDIAN', usernameOrId, req);
        throw new UnauthorizedException('INVALID_CREDENTIALS');
      }

      const passwordMatch = await bcrypt.compare(
        String(dto.password),
        account.password_hash,
      );
      if (!passwordMatch) {
        await this.logAttempt(tenantId, 'GUARDIAN', usernameOrId, false, req);
        await this.maybeLock(tenantId, 'GUARDIAN', usernameOrId, req);
        throw new UnauthorizedException('INVALID_CREDENTIALS');
      }

      await this.logAttempt(tenantId, 'GUARDIAN', usernameOrId, true, req);
      await this.clearLock(tenantId, 'GUARDIAN', usernameOrId);

      const { ip } = this.getIpUa(req);
      await this.auditLog({
        tenantId,
        actorType: 'GUARDIAN',
        actorStudentAccountId: account.id,
        action: 'LOGIN',
        entityType: 'student_accounts',
        entityId: account.id,
        ipAddress: ip || undefined,
      });

      await this.prisma.student_accounts.update({
        where: { id: account.id },
        data: { last_login_at: now() },
      });

      const payload = {
        tenantId: tenantId.toString(),
        type: 'GUARDIAN',
        studentAccountId: account.id.toString(),
        studentId: account.student_id.toString(),
      };

      const { accessToken, refreshToken, refreshTokenHash, refreshExpiresAt } =
        await this.issueTokens(payload);

      await this.createSession({
        tenantId,
        accountType: 'GUARDIAN',
        userId: null,
        studentAccountId: account.id,
        refreshTokenHash,
        refreshExpiresAt,
        req,
      });

      this.setRefreshCookie(res, refreshToken, refreshExpiresAt);

      return {
        accessToken,
        mustChangePassword: account.must_change_password,
        studentId: account.student_id.toString(),
        studentAccountId: account.id.toString(),
      };
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof ForbiddenException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      console.error('Guardian login error:', error);
      throw new InternalServerErrorException('AUTH_GUARDIAN_LOGIN_FAILED');
    }
  }

  async refresh(req: Request, res: Response): Promise<{ accessToken: string }> {
    try {
      const token = String(req.cookies?.[this.cookieName()] || '');
      if (!token) throw new UnauthorizedException('NO_REFRESH_TOKEN');

      const hash = sha256Hex(token);

      const session = await this.prisma.auth_sessions.findFirst({
        where: { refresh_token_hash: hash },
        select: {
          id: true,
          tenant_id: true,
          account_type: true,
          user_id: true,
          student_account_id: true,
          expires_at: true,
          revoked_at: true,
        },
      });

      if (!session) throw new UnauthorizedException('INVALID_REFRESH_TOKEN');
      if (session.revoked_at)
        throw new UnauthorizedException('SESSION_REVOKED');
      if (session.expires_at <= now())
        throw new UnauthorizedException('SESSION_EXPIRED');

      let payload: Record<string, any>;

      if (session.account_type === 'STAFF') {
        if (!session.user_id)
          throw new UnauthorizedException('INVALID_SESSION');
        const { roles, permissions } = await this.getStaffRolesPermissions(
          session.user_id,
        );
        payload = {
          tenantId: session.tenant_id.toString(),
          type: 'STAFF',
          userId: session.user_id.toString(),
          roles,
          permissions,
          sessionId: session.id.toString(),
        };
      } else {
        if (!session.student_account_id)
          throw new UnauthorizedException('INVALID_SESSION');

        const account = await this.prisma.student_accounts.findUnique({
          where: { id: session.student_account_id },
          select: { id: true, is_active: true, student_id: true },
        });

        if (!account || !account.is_active)
          throw new UnauthorizedException('ACCOUNT_NOT_FOUND');

        payload = {
          tenantId: session.tenant_id.toString(),
          type: 'GUARDIAN',
          studentAccountId: account.id.toString(),
          studentId: account.student_id.toString(),
          sessionId: session.id.toString(),
        };
      }

      const { accessToken, refreshToken, refreshTokenHash, refreshExpiresAt } =
        await this.issueTokens(payload);

      await this.prisma.auth_sessions.update({
        where: { id: session.id },
        data: {
          refresh_token_hash: refreshTokenHash,
          expires_at: refreshExpiresAt,
          device_info: this.getIpUa(req).ua || undefined,
        },
      });

      this.setRefreshCookie(res, refreshToken, refreshExpiresAt);

      return { accessToken };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      console.error('Refresh error:', error);
      throw new InternalServerErrorException('AUTH_REFRESH_FAILED');
    }
  }

  async logout(req: Request, res: Response): Promise<{ ok: boolean }> {
    try {
      const token = String(req.cookies?.[this.cookieName()] || '');
      if (token) {
        const hash = sha256Hex(token);
        const session = await this.prisma.auth_sessions.findFirst({
          where: { refresh_token_hash: hash, revoked_at: null },
        });

        if (session) {
          const { ip } = this.getIpUa(req);
          await this.auditLog({
            tenantId: session.tenant_id,
            actorType: session.account_type as 'STAFF' | 'GUARDIAN',
            actorUserId:
              session.account_type === 'STAFF'
                ? session.user_id || undefined
                : undefined,
            actorStudentAccountId:
              session.account_type === 'GUARDIAN'
                ? session.student_account_id || undefined
                : undefined,
            action: 'LOGOUT',
            entityType: 'auth_sessions',
            entityId: session.id,
            ipAddress: ip || undefined,
          });

          await this.prisma.auth_sessions.update({
            where: { id: session.id },
            data: { revoked_at: now() },
          });
        }
      }
      this.clearRefreshCookie(res);
      return { ok: true };
    } catch (error) {
      console.error('Logout error:', error);
      this.clearRefreshCookie(res);
      return { ok: true }; // Logout har doim successful bo'lsin
    }
  }

  async me(req: Request): Promise<{
    ok: boolean;
    user?: {
      tenantId: string;
      type: 'STAFF' | 'GUARDIAN';
      userId?: string;
      studentAccountId?: string;
      studentId?: string;
      roles?: string[];
      permissions?: string[];
      profile?: any;
    };
  }> {
    const user = (req as any).user;
    if (!user) return { ok: false };

    if (user.type === 'STAFF' && user.userId) {
      const staffUser = await this.prisma.users.findUnique({
        where: { id: BigInt(user.userId) },
        select: {
          id: true,
          full_name: true,
          username: true,
          email: true,
          phone: true,
          is_active: true,
          last_login_at: true,
          created_at: true,
        },
      });

      const avatar = await this.prisma.files.findFirst({
        where: {
          tenant_id: BigInt(user.tenantId),
          owner_type: 'USER',
          owner_id: BigInt(user.userId),
          purpose: 'USER_AVATAR',
        },
        orderBy: { created_at: 'desc' },
        select: { url: true },
      });

      return {
        ok: true,
        user: {
          tenantId: user.tenantId,
          type: 'STAFF',
          userId: user.userId,
          roles: user.roles,
          permissions: user.permissions,
          profile: {
            ...staffUser,
            avatarUrl: avatar?.url || null,
          },
        },
      };
    } else if (user.type === 'GUARDIAN' && user.studentAccountId) {
      const guardianAccount = await this.prisma.student_accounts.findUnique({
        where: { id: BigInt(user.studentAccountId) },
        select: {
          id: true,
          student_login_id: true,
          profile_full_name: true,
          profile_phone: true,
          profile_relation: true,
          telegram_username: true,
          must_change_password: true,
          profile_completed_at: true,
          last_login_at: true,
          created_at: true,
          students: {
            select: {
              id: true,
              full_name: true,
              groups: { select: { name: true } },
              campuses: { select: { name: true } },
            },
          },
        },
      });

      const avatar = await this.prisma.files.findFirst({
        where: {
          tenant_id: BigInt(user.tenantId),
          owner_type: 'GUARDIAN',
          owner_id: BigInt(user.studentAccountId),
          purpose: 'GUARDIAN_AVATAR',
        },
        orderBy: { created_at: 'desc' },
        select: { url: true },
      });

      return {
        ok: true,
        user: {
          tenantId: user.tenantId,
          type: 'GUARDIAN',
          studentAccountId: user.studentAccountId,
          studentId: user.studentId,
          profile: {
            ...guardianAccount,
            avatarUrl: avatar?.url || null,
          },
        },
      };
    }

    return { ok: false };
  }

  async guardianChangePassword(
    req: Request,
    res: Response,
    dto: GuardianChangePasswordDto,
  ): Promise<{
    ok: boolean;
    accessToken: string;
    mustChangePassword: boolean;
  }> {
    try {
      const user: any = (req as any).user;
      if (!user || user.type !== 'GUARDIAN')
        throw new UnauthorizedException('NOT_GUARDIAN');

      const studentAccountId = BigInt(user.studentAccountId);
      const tenantId = BigInt(user.tenantId);

      const account = await this.prisma.student_accounts.findUnique({
        where: { id: studentAccountId },
        select: {
          id: true,
          tenant_id: true,
          password_hash: true,
          is_active: true,
          profile_full_name: true,
        },
      });

      if (!account || !account.is_active)
        throw new UnauthorizedException('ACCOUNT_NOT_FOUND');
      if (account.tenant_id !== tenantId)
        throw new ForbiddenException('TENANT_MISMATCH');

      const oldPass = String(dto.oldPassword || '');
      const newPass = String(dto.newPassword || '');
      if (!oldPass || !newPass)
        throw new BadRequestException('INVALID_PASSWORD_DATA');
      if (oldPass === newPass)
        throw new BadRequestException('NEW_PASSWORD_SAME_AS_OLD');
      if (newPass.length < 6)
        throw new BadRequestException('PASSWORD_TOO_SHORT');

      const passwordMatch = await bcrypt.compare(
        oldPass,
        account.password_hash,
      );
      if (!passwordMatch)
        throw new UnauthorizedException('INVALID_OLD_PASSWORD');

      const rounds = Number(process.env.BCRYPT_ROUNDS || '12');
      const newHash = await bcrypt.hash(
        newPass,
        Number.isFinite(rounds) ? rounds : 12,
      );

      const { ip } = this.getIpUa(req);

      await this.prisma.$transaction(async (tx) => {
        await tx.student_accounts.update({
          where: { id: studentAccountId },
          data: {
            password_hash: newHash,
            must_change_password: false,
            password_changed_at: now(),
          },
        });

        await tx.auth_sessions.updateMany({
          where: { student_account_id: studentAccountId, revoked_at: null },
          data: { revoked_at: now() },
        });

        await this.auditLog({
          tenantId,
          actorType: 'GUARDIAN',
          actorStudentAccountId: studentAccountId,
          action: 'CHANGE_PASSWORD',
          entityType: 'student_accounts',
          entityId: studentAccountId,
          beforeData: { passwordChanged: false },
          afterData: { passwordChanged: true, timestamp: now() },
          ipAddress: ip || undefined,
        });
      });

      const payload = {
        tenantId: tenantId.toString(),
        type: 'GUARDIAN',
        studentAccountId: studentAccountId.toString(),
        studentId: user.studentId,
      };

      const { accessToken, refreshToken, refreshTokenHash, refreshExpiresAt } =
        await this.issueTokens(payload);

      await this.createSession({
        tenantId,
        accountType: 'GUARDIAN',
        userId: null,
        studentAccountId,
        refreshTokenHash,
        refreshExpiresAt,
        req,
      });

      this.setRefreshCookie(res, refreshToken, refreshExpiresAt);

      return {
        ok: true,
        accessToken,
        mustChangePassword: false,
      };
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof ForbiddenException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      console.error('Guardian change password error:', error);
      throw new InternalServerErrorException('AUTH_CHANGE_PASSWORD_FAILED');
    }
  }

  async staffChangePassword(
    req: Request,
    res: Response,
    dto: StaffChangePasswordDto,
  ): Promise<{ ok: boolean; accessToken: string }> {
    try {
      const user: any = (req as any).user;
      if (!user || user.type !== 'STAFF')
        throw new UnauthorizedException('NOT_STAFF');

      const userId = BigInt(user.userId);
      const tenantId = BigInt(user.tenantId);

      const staffUser = await this.prisma.users.findUnique({
        where: { id: userId },
        select: {
          id: true,
          tenant_id: true,
          password_hash: true,
          is_active: true,
          username: true,
        },
      });

      if (!staffUser || !staffUser.is_active)
        throw new UnauthorizedException('USER_NOT_FOUND');
      if (staffUser.tenant_id !== tenantId)
        throw new ForbiddenException('TENANT_MISMATCH');

      const oldPass = String(dto.oldPassword || '');
      const newPass = String(dto.newPassword || '');
      if (!oldPass || !newPass)
        throw new BadRequestException('INVALID_PASSWORD_DATA');
      if (oldPass === newPass)
        throw new BadRequestException('NEW_PASSWORD_SAME_AS_OLD');
      if (newPass.length < 6)
        throw new BadRequestException('PASSWORD_TOO_SHORT');

      const passwordMatch = await bcrypt.compare(
        oldPass,
        staffUser.password_hash,
      );
      if (!passwordMatch)
        throw new UnauthorizedException('INVALID_OLD_PASSWORD');

      const rounds = Number(process.env.BCRYPT_ROUNDS || '12');
      const newHash = await bcrypt.hash(
        newPass,
        Number.isFinite(rounds) ? rounds : 12,
      );

      const { ip } = this.getIpUa(req);

      await this.prisma.$transaction(async (tx) => {
        await tx.users.update({
          where: { id: userId },
          data: {
            password_hash: newHash,
            updated_at: now(),
          },
        });

        await tx.auth_sessions.updateMany({
          where: { user_id: userId, revoked_at: null },
          data: { revoked_at: now() },
        });

        await this.invalidateUserCache(userId);

        await this.auditLog({
          tenantId,
          actorType: 'STAFF',
          actorUserId: userId,
          action: 'CHANGE_PASSWORD',
          entityType: 'users',
          entityId: userId,
          beforeData: { passwordChanged: false },
          afterData: { passwordChanged: true, timestamp: now() },
          ipAddress: ip || undefined,
        });
      });

      const { roles, permissions } =
        await this.getStaffRolesPermissions(userId);
      const payload = {
        tenantId: tenantId.toString(),
        type: 'STAFF',
        userId: userId.toString(),
        roles,
        permissions,
      };

      const { accessToken, refreshToken, refreshTokenHash, refreshExpiresAt } =
        await this.issueTokens(payload);

      await this.createSession({
        tenantId,
        accountType: 'STAFF',
        userId,
        studentAccountId: null,
        refreshTokenHash,
        refreshExpiresAt,
        req,
      });

      this.setRefreshCookie(res, refreshToken, refreshExpiresAt);

      return {
        ok: true,
        accessToken,
      };
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof ForbiddenException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      console.error('Staff change password error:', error);
      throw new InternalServerErrorException(
        'AUTH_STAFF_CHANGE_PASSWORD_FAILED',
      );
    }
  }

  async resetStaffPassword(
    userId: bigint,
    dto: ResetPasswordDto,
    actor: any,
  ): Promise<{ ok: boolean; newPassword?: string }> {
    try {
      if (actor.type !== 'STAFF') throw new ForbiddenException('NOT_STAFF');
      if (
        !actor.roles?.includes('SUPERADMIN') &&
        !actor.roles?.includes('ADMIN')
      ) {
        throw new ForbiddenException('INSUFFICIENT_PERMISSIONS');
      }

      const targetUser = await this.prisma.users.findUnique({
        where: { id: userId },
        select: {
          id: true,
          tenant_id: true,
          username: true,
          is_active: true,
        },
      });

      if (!targetUser || !targetUser.is_active)
        throw new NotFoundException('USER_NOT_FOUND');
      if (targetUser.tenant_id.toString() !== actor.tenantId) {
        throw new ForbiddenException('TENANT_MISMATCH');
      }

      const newPassword = dto.newPassword || this.generateRandomPassword();
      const rounds = Number(process.env.BCRYPT_ROUNDS || '12');
      const newHash = await bcrypt.hash(
        newPassword,
        Number.isFinite(rounds) ? rounds : 12,
      );

      await this.prisma.$transaction(async (tx) => {
        await tx.users.update({
          where: { id: userId },
          data: {
            password_hash: newHash,
            updated_at: now(),
          },
        });

        await tx.auth_sessions.updateMany({
          where: { user_id: userId, revoked_at: null },
          data: { revoked_at: now() },
        });

        await this.invalidateUserCache(userId);

        await this.auditLog({
          tenantId: targetUser.tenant_id,
          actorType: 'STAFF',
          actorUserId: BigInt(actor.userId),
          action: 'RESET_PASSWORD',
          entityType: 'users',
          entityId: userId,
          beforeData: { passwordResetBy: null },
          afterData: {
            passwordResetBy: actor.userId,
            resetAt: now(),
            resetByUsername: actor.username,
          },
          ipAddress: 'SYSTEM',
        });
      });

      return {
        ok: true,
        newPassword: dto.newPassword ? undefined : newPassword,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }
      console.error('Reset staff password error:', error);
      throw new InternalServerErrorException('RESET_PASSWORD_FAILED');
    }
  }

  async resetGuardianPassword(
    studentAccountId: bigint,
    dto: ResetPasswordDto,
    actor: any,
  ): Promise<{ ok: boolean; newPassword?: string }> {
    try {
      if (actor.type !== 'STAFF') throw new ForbiddenException('NOT_STAFF');
      if (
        !actor.roles?.includes('SUPERADMIN') &&
        !actor.roles?.includes('ADMIN')
      ) {
        throw new ForbiddenException('INSUFFICIENT_PERMISSIONS');
      }

      const account = await this.prisma.student_accounts.findUnique({
        where: { id: studentAccountId },
        select: {
          id: true,
          tenant_id: true,
          student_login_id: true,
          is_active: true,
          students: { select: { full_name: true } },
        },
      });

      if (!account || !account.is_active)
        throw new NotFoundException('ACCOUNT_NOT_FOUND');
      if (account.tenant_id.toString() !== actor.tenantId) {
        throw new ForbiddenException('TENANT_MISMATCH');
      }

      const newPassword = dto.newPassword || this.generateRandomPassword();
      const rounds = Number(process.env.BCRYPT_ROUNDS || '12');
      const newHash = await bcrypt.hash(
        newPassword,
        Number.isFinite(rounds) ? rounds : 12,
      );

      await this.prisma.$transaction(async (tx) => {
        await tx.student_accounts.update({
          where: { id: studentAccountId },
          data: {
            password_hash: newHash,
            must_change_password: true,
            password_changed_at: null,
          },
        });

        await tx.auth_sessions.updateMany({
          where: { student_account_id: studentAccountId, revoked_at: null },
          data: { revoked_at: now() },
        });

        await this.auditLog({
          tenantId: account.tenant_id,
          actorType: 'STAFF',
          actorUserId: BigInt(actor.userId),
          action: 'RESET_PASSWORD',
          entityType: 'student_accounts',
          entityId: studentAccountId,
          beforeData: { mustChangePassword: false },
          afterData: {
            mustChangePassword: true,
            resetBy: actor.userId,
            resetAt: now(),
            resetByUsername: actor.username,
          },
          ipAddress: 'SYSTEM',
        });
      });

      return {
        ok: true,
        newPassword: dto.newPassword ? undefined : newPassword,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }
      console.error('Reset guardian password error:', error);
      throw new InternalServerErrorException('RESET_GUARDIAN_PASSWORD_FAILED');
    }
  }

  async updateStaffProfile(
    userId: bigint,
    dto: UpdateProfileDto,
    actor: any,
  ): Promise<{ ok: boolean; user: any }> {
    try {
      if (actor.type !== 'STAFF') throw new ForbiddenException('NOT_STAFF');
      if (
        actor.userId !== userId.toString() &&
        !actor.roles?.includes('SUPERADMIN')
      ) {
        throw new ForbiddenException('CANNOT_UPDATE_OTHER_PROFILE');
      }

      const user = await this.prisma.users.findUnique({
        where: { id: userId },
        select: { id: true, tenant_id: true, username: true },
      });

      if (!user) throw new NotFoundException('USER_NOT_FOUND');
      if (user.tenant_id.toString() !== actor.tenantId) {
        throw new ForbiddenException('TENANT_MISMATCH');
      }

      const updateData: any = { updated_at: now() };
      if (dto.fullName) updateData.full_name = dto.fullName;
      if (dto.email) updateData.email = dto.email;
      if (dto.phone) updateData.phone = dto.phone;
      if (dto.username && dto.username !== user.username) {
        const existing = await this.prisma.users.findFirst({
          where: {
            tenant_id: user.tenant_id,
            username: dto.username,
            id: { not: userId },
          },
        });
        if (existing) throw new BadRequestException('USERNAME_ALREADY_EXISTS');
        updateData.username = dto.username;
      }

      const updatedUser = await this.prisma.users.update({
        where: { id: userId },
        data: updateData,
        select: {
          id: true,
          username: true,
          full_name: true,
          email: true,
          phone: true,
          is_active: true,
          last_login_at: true,
          created_at: true,
          updated_at: true,
        },
      });

      await this.auditLog({
        tenantId: user.tenant_id,
        actorType: 'STAFF',
        actorUserId: userId,
        action: 'UPDATE',
        entityType: 'users',
        entityId: userId,
        beforeData: user,
        afterData: updatedUser,
        ipAddress: 'SYSTEM',
      });

      return {
        ok: true,
        user: updatedUser,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      console.error('Update staff profile error:', error);
      throw new InternalServerErrorException('UPDATE_PROFILE_FAILED');
    }
  }

  async updateGuardianProfile(
    studentAccountId: bigint,
    dto: UpdateProfileDto,
    actor: any,
  ): Promise<{ ok: boolean; account: any }> {
    try {
      // Faqat o'z profilini yoki SUPERADMIN yangilashi mumkin
      const canUpdate =
        actor.type === 'GUARDIAN'
          ? actor.studentAccountId === studentAccountId.toString()
          : actor.roles?.includes('SUPERADMIN') ||
            actor.roles?.includes('ADMIN');

      if (!canUpdate) throw new ForbiddenException('CANNOT_UPDATE_PROFILE');

      const account = await this.prisma.student_accounts.findUnique({
        where: { id: studentAccountId },
        select: {
          id: true,
          tenant_id: true,
          student_login_id: true,
          profile_full_name: true,
          profile_phone: true,
          profile_relation: true,
          telegram_username: true,
          telegram_chat_id: true,
        },
      });

      if (!account) throw new NotFoundException('ACCOUNT_NOT_FOUND');
      if (account.tenant_id.toString() !== actor.tenantId) {
        throw new ForbiddenException('TENANT_MISMATCH');
      }

      const updateData: any = {};
      if (dto.fullName) updateData.profile_full_name = dto.fullName;
      if (dto.phone) updateData.profile_phone = dto.phone;
      if (dto.telegramUsername)
        updateData.telegram_username = dto.telegramUsername;

      // Agar profile hali to'ldirilmagan bo'lsa, to'ldirilgan deb belgilaymiz
      if (!account.profile_full_name && dto.fullName) {
        updateData.profile_completed_at = now();
      }

      const updatedAccount = await this.prisma.student_accounts.update({
        where: { id: studentAccountId },
        data: updateData,
        select: {
          id: true,
          student_login_id: true,
          profile_full_name: true,
          profile_phone: true,
          profile_relation: true,
          telegram_username: true,
          telegram_chat_id: true,
          profile_completed_at: true,
          must_change_password: true,
          last_login_at: true,
          created_at: true,
        },
      });

      await this.auditLog({
        tenantId: account.tenant_id,
        actorType: actor.type as 'STAFF' | 'GUARDIAN',
        actorUserId: actor.type === 'STAFF' ? BigInt(actor.userId) : undefined,
        actorStudentAccountId:
          actor.type === 'GUARDIAN' ? studentAccountId : undefined,
        action: 'UPDATE',
        entityType: 'student_accounts',
        entityId: studentAccountId,
        beforeData: account,
        afterData: updatedAccount,
        ipAddress: 'SYSTEM',
      });

      return {
        ok: true,
        account: updatedAccount,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      console.error('Update guardian profile error:', error);
      throw new InternalServerErrorException('UPDATE_GUARDIAN_PROFILE_FAILED');
    }
  }

  // ==================== UTILITY METHODS ====================

  private generateRandomPassword(length: number = 12): string {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  async getActiveSessions(user: any): Promise<{
    ok: boolean;
    sessions: Array<{
      id: string;
      deviceInfo?: string;
      ipAddress?: string;
      createdAt: string;
      expiresAt: string;
      revokedAt?: string;
    }>;
  }> {
    try {
      let sessions: any[] = [];

      if (user.type === 'STAFF' && user.userId) {
        sessions = await this.prisma.auth_sessions.findMany({
          where: {
            user_id: BigInt(user.userId),
            tenant_id: BigInt(user.tenantId),
          },
          orderBy: { created_at: 'desc' },
          take: 20,
        });
      } else if (user.type === 'GUARDIAN' && user.studentAccountId) {
        sessions = await this.prisma.auth_sessions.findMany({
          where: {
            student_account_id: BigInt(user.studentAccountId),
            tenant_id: BigInt(user.tenantId),
          },
          orderBy: { created_at: 'desc' },
          take: 20,
        });
      }

      return {
        ok: true,
        sessions: sessions.map((session) => ({
          id: session.id.toString(),
          deviceInfo: session.device_info || undefined,
          ipAddress: session.ip_address || undefined,
          createdAt: session.created_at.toISOString(),
          expiresAt: session.expires_at.toISOString(),
          revokedAt: session.revoked_at?.toISOString(),
        })),
      };
    } catch (error) {
      console.error('Get active sessions error:', error);
      return { ok: false, sessions: [] };
    }
  }

  async revokeSession(sessionId: bigint, actor: any): Promise<{ ok: boolean }> {
    try {
      const session = await this.prisma.auth_sessions.findUnique({
        where: { id: sessionId },
        select: {
          id: true,
          tenant_id: true,
          account_type: true,
          user_id: true,
          student_account_id: true,
        },
      });

      if (!session) throw new NotFoundException('SESSION_NOT_FOUND');
      if (session.tenant_id.toString() !== actor.tenantId) {
        throw new ForbiddenException('TENANT_MISMATCH');
      }

      // Faqat o'z session'ini yoki SUPERADMIN revoke qilishi mumkin
      const canRevoke =
        actor.type === 'STAFF' && actor.roles?.includes('SUPERADMIN')
          ? true
          : session.account_type === 'STAFF'
            ? session.user_id?.toString() === actor.userId
            : session.student_account_id?.toString() === actor.studentAccountId;

      if (!canRevoke) throw new ForbiddenException('CANNOT_REVOKE_SESSION');

      await this.prisma.auth_sessions.update({
        where: { id: sessionId },
        data: { revoked_at: now() },
      });

      await this.auditLog({
        tenantId: session.tenant_id,
        actorType: actor.type as 'STAFF' | 'GUARDIAN',
        actorUserId: actor.type === 'STAFF' ? BigInt(actor.userId) : undefined,
        actorStudentAccountId:
          actor.type === 'GUARDIAN'
            ? BigInt(actor.studentAccountId)
            : undefined,
        action: 'LOGOUT',
        entityType: 'auth_sessions',
        entityId: sessionId,
        ipAddress: 'SYSTEM',
      });

      return { ok: true };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      console.error('Revoke session error:', error);
      throw new InternalServerErrorException('REVOKE_SESSION_FAILED');
    }
  }

  async revokeAllSessions(
    user: any,
  ): Promise<{ ok: boolean; revoked: number }> {
    try {
      let whereCondition: any = {
        tenant_id: BigInt(user.tenantId),
        revoked_at: null,
      };

      if (user.type === 'STAFF' && user.userId) {
        whereCondition.user_id = BigInt(user.userId);
      } else if (user.type === 'GUARDIAN' && user.studentAccountId) {
        whereCondition.student_account_id = BigInt(user.studentAccountId);
      } else {
        throw new BadRequestException('INVALID_USER_TYPE');
      }

      const result = await this.prisma.auth_sessions.updateMany({
        where: whereCondition,
        data: { revoked_at: now() },
      });

      await this.auditLog({
        tenantId: BigInt(user.tenantId),
        actorType: user.type as 'STAFF' | 'GUARDIAN',
        actorUserId: user.type === 'STAFF' ? BigInt(user.userId) : undefined,
        actorStudentAccountId:
          user.type === 'GUARDIAN' ? BigInt(user.studentAccountId) : undefined,
        action: 'LOGOUT',
        entityType: 'auth_sessions',
        beforeData: { sessionsActive: result.count },
        afterData: { sessionsActive: 0 },
        ipAddress: 'SYSTEM',
      });

      return {
        ok: true,
        revoked: result.count,
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      console.error('Revoke all sessions error:', error);
      throw new InternalServerErrorException('REVOKE_ALL_SESSIONS_FAILED');
    }
  }
}
