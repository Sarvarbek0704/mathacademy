import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
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

type AccountType = 'STAFF' | 'GUARDIAN';

function sha256Hex(v: string) {
  return createHash('sha256').update(v).digest('hex');
}
function now() {
  return new Date();
}
function addHours(d: Date, h: number) {
  return new Date(d.getTime() + h * 60 * 60 * 1000);
}
function addDays(d: Date, days: number) {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}
function requireEnv(name: string): string {
  const v = String(process.env[name] || '').trim();
  if (!v) throw new InternalServerErrorException(`MISSING_ENV_${name}`);
  return v;
}

// Guardian studentId: "tenant-slug-000123"
function parseGuardianLogin(studentId: string) {
  const s = String(studentId || '').trim();
  const idx = s.lastIndexOf('-');
  if (idx <= 0 || idx === s.length - 1) return null;
  const tenantSlug = s.slice(0, idx).trim();
  const loginId = s.slice(idx + 1).trim();
  if (!tenantSlug || !loginId) return null;
  if (!/^\d+$/.test(loginId)) return null;
  return { tenantSlug, loginId, raw: s };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  private cookieName() {
    return process.env.COOKIE_NAME_REFRESH || 'madc_rt';
  }

  private accessTtl() {
    // "15m" / "2h" etc
    return process.env.ACCESS_TOKEN_TTL || '15m';
  }

  private refreshDays() {
    const n = Number(process.env.REFRESH_TOKEN_DAYS || '30');
    return Number.isFinite(n) && n > 0 ? n : 30;
  }

  private isSecureCookie() {
    return process.env.NODE_ENV === 'production';
  }

  private setRefreshCookie(res: Response, token: string, expiresAt: Date) {
    res.cookie(this.cookieName(), token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.isSecureCookie(),
      path: '/api/auth/refresh',
      expires: expiresAt,
    });
  }

  private clearRefreshCookie(res: Response) {
    res.cookie(this.cookieName(), '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.isSecureCookie(),
      path: '/api/auth/refresh',
      expires: new Date(0),
    });
  }

  private getIpUa(req: Request) {
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

  private async ensureNotLocked(
    tenantId: bigint,
    accountType: AccountType,
    usernameOrId: string,
  ) {
    const lock = await this.prisma.auth_locks.findUnique({
      where: {
        tenant_id_account_type_username_or_id: {
          tenant_id: tenantId,
          account_type: accountType,
          username_or_id: usernameOrId,
        },
      },
      select: { locked_until: true },
    });

    if (lock?.locked_until && lock.locked_until > now()) {
      throw new ForbiddenException('ACCOUNT_LOCKED');
    }
  }

  private async logAttempt(
    tenantId: bigint,
    accountType: AccountType,
    usernameOrId: string,
    success: boolean,
    req: Request,
  ) {
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

  // 5 ta fail (oxirgi 3 soat ichida) -> 3 soat lock
  private async maybeLock(
    tenantId: bigint,
    accountType: AccountType,
    usernameOrId: string,
  ) {
    const since = addHours(now(), -3);

    const count = await this.prisma.auth_attempts.count({
      where: {
        tenant_id: tenantId,
        account_type: accountType,
        username_or_id: usernameOrId,
        success: false,
        created_at: { gte: since },
      },
    });

    if (count >= 5) {
      const lockedUntil = addHours(now(), 3);
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
  ) {
    await this.prisma.auth_locks.deleteMany({
      where: {
        tenant_id: tenantId,
        account_type: accountType,
        username_or_id: usernameOrId,
      },
    });
  }

  private async issueTokens(payload: Record<string, any>) {
    const accessToken = await this.jwt.signAsync(payload, {
      secret: requireEnv('JWT_ACCESS_SECRET'),
      // jsonwebtoken type’lari "StringValue" bo‘lgani uchun cast
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
  }) {
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

  private async getStaffRolesPermissions(userId: bigint) {
    // roles (DB’da roles.code yo‘q, roles.name bor)
    const ur = await this.prisma.user_roles.findMany({
      where: { user_id: userId },
      select: { roles: { select: { id: true, name: true } } },
    });

    const roles = ur.map((x) => x.roles.name);
    const roleIds = ur.map((x) => x.roles.id);

    // permissions (role_permissions -> permissions.code)
    const rp = await this.prisma.role_permissions.findMany({
      where: { role_id: { in: roleIds } },
      select: { permissions: { select: { code: true } } },
    });

    const permissions = Array.from(new Set(rp.map((x) => x.permissions.code)));
    return { roles, permissions };
  }

  async staffLogin(dto: StaffLoginDto, req: Request, res: Response) {
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
        },
      });

      if (!user || !user.is_active) {
        await this.logAttempt(tenantId, 'STAFF', username, false, req);
        await this.maybeLock(tenantId, 'STAFF', username);
        throw new UnauthorizedException('INVALID_CREDENTIALS');
      }

      const ok = await bcrypt.compare(String(dto.password), user.password_hash);
      if (!ok) {
        await this.logAttempt(tenantId, 'STAFF', username, false, req);
        await this.maybeLock(tenantId, 'STAFF', username);
        throw new UnauthorizedException('INVALID_CREDENTIALS');
      }

      await this.logAttempt(tenantId, 'STAFF', username, true, req);
      await this.clearLock(tenantId, 'STAFF', username);

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
        staff: { id: user.id.toString(), fullName: user.full_name },
        roles,
        permissions,
      };
    } catch (e) {
      if (
        e instanceof UnauthorizedException ||
        e instanceof ForbiddenException ||
        e instanceof BadRequestException
      )
        throw e;
      throw e instanceof Error
        ? new InternalServerErrorException(e.message)
        : new InternalServerErrorException('AUTH_STAFF_LOGIN_FAILED');
    }
  }

  async guardianLogin(dto: GuardianLoginDto, req: Request, res: Response) {
    try {
      const parsed = parseGuardianLogin(String(dto.studentId));
      if (!parsed) throw new UnauthorizedException('INVALID_STUDENT_ID_FORMAT');

      const tenantId = await this.getTenantIdBySlugOrThrow(parsed.tenantSlug);

      const usernameOrId = String(dto.studentId || '').trim();
      await this.ensureNotLocked(tenantId, 'GUARDIAN', usernameOrId);

      const acc = await this.prisma.student_accounts.findFirst({
        where: { tenant_id: tenantId, student_login_id: parsed.loginId },
        select: {
          id: true,
          password_hash: true,
          is_active: true,
          must_change_password: true,
          student_id: true,
        },
      });

      if (!acc || !acc.is_active) {
        await this.logAttempt(tenantId, 'GUARDIAN', usernameOrId, false, req);
        await this.maybeLock(tenantId, 'GUARDIAN', usernameOrId);
        throw new UnauthorizedException('INVALID_CREDENTIALS');
      }

      const ok = await bcrypt.compare(String(dto.password), acc.password_hash);
      if (!ok) {
        await this.logAttempt(tenantId, 'GUARDIAN', usernameOrId, false, req);
        await this.maybeLock(tenantId, 'GUARDIAN', usernameOrId);
        throw new UnauthorizedException('INVALID_CREDENTIALS');
      }

      await this.logAttempt(tenantId, 'GUARDIAN', usernameOrId, true, req);
      await this.clearLock(tenantId, 'GUARDIAN', usernameOrId);

      await this.prisma.student_accounts.update({
        where: { id: acc.id },
        data: { last_login_at: now() },
      });

      const payload: Record<string, any> = {
        tenantId: tenantId.toString(),
        type: 'GUARDIAN',
        studentAccountId: acc.id.toString(),
        studentId: acc.student_id.toString(),
      };

      const { accessToken, refreshToken, refreshTokenHash, refreshExpiresAt } =
        await this.issueTokens(payload);

      await this.createSession({
        tenantId,
        accountType: 'GUARDIAN',
        userId: null,
        studentAccountId: acc.id,
        refreshTokenHash,
        refreshExpiresAt,
        req,
      });

      this.setRefreshCookie(res, refreshToken, refreshExpiresAt);

      return {
        accessToken,
        mustChangePassword: acc.must_change_password,
      };
    } catch (e) {
      if (
        e instanceof UnauthorizedException ||
        e instanceof ForbiddenException ||
        e instanceof BadRequestException
      )
        throw e;
      throw e instanceof Error
        ? new InternalServerErrorException(e.message)
        : new InternalServerErrorException('AUTH_GUARDIAN_LOGIN_FAILED');
    }
  }

  async refresh(req: Request, res: Response) {
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
        };
      } else {
        if (!session.student_account_id)
          throw new UnauthorizedException('INVALID_SESSION');

        const acc = await this.prisma.student_accounts.findUnique({
          where: { id: session.student_account_id },
          select: { id: true, is_active: true, student_id: true },
        });

        if (!acc || !acc.is_active)
          throw new UnauthorizedException('ACCOUNT_NOT_FOUND');

        payload = {
          tenantId: session.tenant_id.toString(),
          type: 'GUARDIAN',
          studentAccountId: acc.id.toString(),
          studentId: acc.student_id.toString(),
        };
      }

      const { accessToken, refreshToken, refreshTokenHash, refreshExpiresAt } =
        await this.issueTokens(payload);

      await this.prisma.auth_sessions.update({
        where: { id: session.id },
        data: {
          refresh_token_hash: refreshTokenHash,
          expires_at: refreshExpiresAt,
        },
      });

      this.setRefreshCookie(res, refreshToken, refreshExpiresAt);

      return { accessToken };
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e;
      throw e instanceof Error
        ? new InternalServerErrorException(e.message)
        : new InternalServerErrorException('AUTH_REFRESH_FAILED');
    }
  }

  async logout(req: Request, res: Response) {
    try {
      const token = String(req.cookies?.[this.cookieName()] || '');
      if (token) {
        const hash = sha256Hex(token);
        await this.prisma.auth_sessions.updateMany({
          where: { refresh_token_hash: hash, revoked_at: null },
          data: { revoked_at: now() },
        });
      }
      this.clearRefreshCookie(res);
      return { ok: true };
    } catch (e) {
      this.clearRefreshCookie(res);
      throw e instanceof Error
        ? new InternalServerErrorException(e.message)
        : new InternalServerErrorException('AUTH_LOGOUT_FAILED');
    }
  }

  async me(req: Request) {
    const user = (req as any).user;
    if (!user) return { ok: false };
    return { ok: true, payload: user };
  }

  async guardianChangePassword(
    req: Request,
    res: Response,
    dto: GuardianChangePasswordDto,
  ) {
    try {
      const user: any = (req as any).user;
      if (!user || user.type !== 'GUARDIAN')
        throw new UnauthorizedException('NOT_GUARDIAN');

      const studentAccountId = BigInt(user.studentAccountId);

      const acc = await this.prisma.student_accounts.findUnique({
        where: { id: studentAccountId },
        select: {
          id: true,
          tenant_id: true,
          password_hash: true,
          is_active: true,
        },
      });
      if (!acc || !acc.is_active)
        throw new UnauthorizedException('ACCOUNT_NOT_FOUND');

      const oldPass = String(dto.oldPassword || '');
      const newPass = String(dto.newPassword || '');
      if (!oldPass || !newPass)
        throw new BadRequestException('INVALID_PASSWORD_DATA');
      if (oldPass === newPass)
        throw new BadRequestException('NEW_PASSWORD_SAME_AS_OLD');

      const ok = await bcrypt.compare(oldPass, acc.password_hash);
      if (!ok) throw new UnauthorizedException('INVALID_OLD_PASSWORD');

      const rounds = Number(process.env.BCRYPT_ROUNDS || '10');
      const newHash = await bcrypt.hash(
        newPass,
        Number.isFinite(rounds) ? rounds : 10,
      );

      await this.prisma.$transaction(async (tx) => {
        await tx.student_accounts.update({
          where: { id: studentAccountId },
          data: {
            password_hash: newHash,
            must_change_password: false,
            password_changed_at: now(),
          },
        });

        // barcha eski session’larni bekor qilamiz
        await tx.auth_sessions.updateMany({
          where: { student_account_id: studentAccountId, revoked_at: null },
          data: { revoked_at: now() },
        });
      });

      const payload: Record<string, any> = {
        tenantId: acc.tenant_id.toString(),
        type: 'GUARDIAN',
        studentAccountId: studentAccountId.toString(),
      };

      const { accessToken, refreshToken, refreshTokenHash, refreshExpiresAt } =
        await this.issueTokens(payload);

      await this.createSession({
        tenantId: acc.tenant_id,
        accountType: 'GUARDIAN',
        userId: null,
        studentAccountId,
        refreshTokenHash,
        refreshExpiresAt,
        req,
      });

      this.setRefreshCookie(res, refreshToken, refreshExpiresAt);

      return { ok: true, accessToken, mustChangePassword: false };
    } catch (e) {
      if (
        e instanceof UnauthorizedException ||
        e instanceof ForbiddenException ||
        e instanceof BadRequestException
      )
        throw e;
      throw e instanceof Error
        ? new InternalServerErrorException(e.message)
        : new InternalServerErrorException('AUTH_CHANGE_PASSWORD_FAILED');
    }
  }
}
