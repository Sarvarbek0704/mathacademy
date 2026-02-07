import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StaffLoginDto } from './dto/staff-login.dto';
import { GuardianLoginDto } from './dto/guardian-login.dto';

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

// Guardian studentId: "tenant-slug-000123" -> tenantSlug + loginId
function parseGuardianLogin(studentId: string) {
  const s = String(studentId || '').trim();
  const idx = s.lastIndexOf('-');
  if (idx <= 0 || idx === s.length - 1) return null;
  const tenantSlug = s.slice(0, idx).trim();
  const loginId = s.slice(idx + 1).trim();
  if (!tenantSlug || !loginId) return null;
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
    return process.env.ACCESS_TOKEN_TTL || '15m';
  }

  private refreshDays() {
    const n = Number(process.env.REFRESH_TOKEN_DAYS || '30');
    return Number.isFinite(n) && n > 0 ? n : 30;
  }

  private setRefreshCookie(res: Response, token: string, expiresAt: Date) {
    res.cookie(this.cookieName(), token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false, // prod’da true (https)
      path: '/api/auth/refresh',
      expires: expiresAt,
    });
  }

  private clearRefreshCookie(res: Response) {
    res.cookie(this.cookieName(), '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/api/auth/refresh',
      expires: new Date(0),
    });
  }

  private async getTenantIdBySlug(tenantSlug: string): Promise<bigint> {
    const rows = await this.prisma.$queryRaw<{ id: bigint }[]>(
      Prisma.sql`SELECT id FROM tenants WHERE slug = ${tenantSlug} LIMIT 1`,
    );
    if (!rows.length) throw new UnauthorizedException('TENANT_NOT_FOUND');
    return rows[0].id;
  }

  private async ensureNotLocked(
    tenantId: bigint,
    accountType: AccountType,
    usernameOrId: string,
  ) {
    const rows = await this.prisma.$queryRaw<{ locked_until: Date }[]>(
      Prisma.sql`
        SELECT locked_until
        FROM auth_locks
        WHERE tenant_id = ${tenantId}
          AND account_type = ${accountType}
          AND username_or_id = ${usernameOrId}
        LIMIT 1
      `,
    );
    if (rows.length && rows[0].locked_until && rows[0].locked_until > now()) {
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
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip || null;
    const ua = (req.headers['user-agent'] as string) || null;

    await this.prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO auth_attempts(tenant_id, account_type, username_or_id, success, ip_address, user_agent)
        VALUES (${tenantId}, ${accountType}, ${usernameOrId}, ${success}, ${ip}, ${ua})
      `,
    );
  }

  // 5 ta fail (oxirgi 3 soat ichida) -> 3 soat lock
  private async maybeLock(
    tenantId: bigint,
    accountType: AccountType,
    usernameOrId: string,
  ) {
    const since = addHours(now(), -3);
    const rows = await this.prisma.$queryRaw<{ c: bigint }[]>(
      Prisma.sql`
        SELECT COUNT(*)::bigint AS c
        FROM auth_attempts
        WHERE tenant_id = ${tenantId}
          AND account_type = ${accountType}
          AND username_or_id = ${usernameOrId}
          AND success = false
          AND created_at >= ${since}
      `,
    );

    const count = rows.length ? Number(rows[0].c) : 0;
    if (count >= 5) {
      const lockedUntil = addHours(now(), 3);
      await this.prisma.$executeRaw(
        Prisma.sql`
          INSERT INTO auth_locks(tenant_id, account_type, username_or_id, locked_until, reason)
          VALUES (${tenantId}, ${accountType}, ${usernameOrId}, ${lockedUntil}, 'TOO_MANY_ATTEMPTS')
          ON CONFLICT (tenant_id, account_type, username_or_id)
          DO UPDATE SET locked_until = EXCLUDED.locked_until, reason = EXCLUDED.reason
        `,
      );
    }
  }

  private async clearLock(
    tenantId: bigint,
    accountType: AccountType,
    usernameOrId: string,
  ) {
    await this.prisma.$executeRaw(
      Prisma.sql`
        DELETE FROM auth_locks
        WHERE tenant_id = ${tenantId}
          AND account_type = ${accountType}
          AND username_or_id = ${usernameOrId}
      `,
    );
  }

  private async issueTokens(payload: any) {
    const accessToken = await this.jwt.signAsync(
      payload as Record<string, any>,
      {
        secret: process.env.JWT_ACCESS_SECRET!,
        expiresIn: this.accessTtl() as any,
      } as any,
    );

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
    const ip =
      (args.req.headers['x-forwarded-for'] as string) || args.req.ip || null;
    const ua = (args.req.headers['user-agent'] as string) || null;

    const rows = await this.prisma.$queryRaw<{ id: bigint }[]>(
      Prisma.sql`
        INSERT INTO auth_sessions(
          tenant_id, account_type, user_id, student_account_id,
          refresh_token_hash, device_info, ip_address, expires_at
        )
        VALUES (
          ${args.tenantId}, ${args.accountType}, ${args.userId ?? null}, ${args.studentAccountId ?? null},
          ${args.refreshTokenHash}, ${ua}, ${ip}, ${args.refreshExpiresAt}
        )
        RETURNING id
      `,
    );
    return rows[0].id;
  }

  async staffLogin(dto: StaffLoginDto, req: Request, res: Response) {
    const tenantId = await this.getTenantIdBySlug(dto.tenantSlug);
    const username = dto.username.trim();

    await this.ensureNotLocked(tenantId, 'STAFF', username);

    const users = await this.prisma.$queryRaw<
      {
        id: bigint;
        password_hash: string;
        is_active: boolean;
        full_name: string;
      }[]
    >(
      Prisma.sql`
      SELECT id, password_hash, is_active, full_name
      FROM users
      WHERE tenant_id = ${tenantId} AND username = ${username}
      LIMIT 1
    `,
    );

    if (!users.length || !users[0].is_active) {
      await this.logAttempt(tenantId, 'STAFF', username, false, req);
      await this.maybeLock(tenantId, 'STAFF', username);
      throw new UnauthorizedException('INVALID_CREDENTIALS');
    }

    const ok = await bcrypt.compare(dto.password, users[0].password_hash);
    if (!ok) {
      await this.logAttempt(tenantId, 'STAFF', username, false, req);
      await this.maybeLock(tenantId, 'STAFF', username);
      throw new UnauthorizedException('INVALID_CREDENTIALS');
    }

    await this.logAttempt(tenantId, 'STAFF', username, true, req);
    await this.clearLock(tenantId, 'STAFF', username);

    await this.prisma.$executeRaw(
      Prisma.sql`UPDATE users SET last_login_at = now(), updated_at = now() WHERE id = ${users[0].id}`,
    );

    // ✅ roles
    const roleRows = await this.prisma.$queryRaw<{ code: string }[]>(
      Prisma.sql`
      SELECT r.code
      FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = ${users[0].id}
    `,
    );
    const roles = roleRows.map((x) => x.code);

    // ✅ permissions (roles orqali)
    const permRows = await this.prisma.$queryRaw<{ code: string }[]>(
      Prisma.sql`
      SELECT DISTINCT p.code
      FROM user_roles ur
      JOIN role_permissions rp ON rp.role_id = ur.role_id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE ur.user_id = ${users[0].id}
    `,
    );
    const permissions = permRows.map((x) => x.code);

    const payload = {
      tenantId: tenantId.toString(),
      type: 'STAFF',
      userId: users[0].id.toString(),
      roles,
      permissions,
    };

    const { accessToken, refreshToken, refreshTokenHash, refreshExpiresAt } =
      await this.issueTokens(payload);

    const sessionId = await this.createSession({
      tenantId,
      accountType: 'STAFF',
      userId: users[0].id,
      studentAccountId: null,
      refreshTokenHash,
      refreshExpiresAt,
      req,
    });

    this.setRefreshCookie(res, refreshToken, refreshExpiresAt);

    return res.json({
      accessToken,
      staff: { id: users[0].id.toString(), fullName: users[0].full_name },
      roles,
      permissions,
    });
  }

  async guardianLogin(dto: GuardianLoginDto, req: Request, res: Response) {
    const parsed = parseGuardianLogin(dto.studentId);
    if (!parsed) throw new UnauthorizedException('INVALID_STUDENT_ID_FORMAT');

    const tenantId = await this.getTenantIdBySlug(parsed.tenantSlug);
    const loginId = parsed.loginId;

    await this.ensureNotLocked(tenantId, 'GUARDIAN', dto.studentId.trim());

    const accs = await this.prisma.$queryRaw<
      {
        id: bigint;
        password_hash: string;
        is_active: boolean;
        must_change_password: boolean;
      }[]
    >(
      Prisma.sql`
        SELECT id, password_hash, is_active, must_change_password
        FROM student_accounts
        WHERE tenant_id = ${tenantId} AND student_login_id = ${loginId}
        LIMIT 1
      `,
    );

    if (!accs.length || !accs[0].is_active) {
      await this.logAttempt(
        tenantId,
        'GUARDIAN',
        dto.studentId.trim(),
        false,
        req,
      );
      await this.maybeLock(tenantId, 'GUARDIAN', dto.studentId.trim());
      throw new UnauthorizedException('INVALID_CREDENTIALS');
    }

    const ok = await bcrypt.compare(dto.password, accs[0].password_hash);
    if (!ok) {
      await this.logAttempt(
        tenantId,
        'GUARDIAN',
        dto.studentId.trim(),
        false,
        req,
      );
      await this.maybeLock(tenantId, 'GUARDIAN', dto.studentId.trim());
      throw new UnauthorizedException('INVALID_CREDENTIALS');
    }

    await this.logAttempt(
      tenantId,
      'GUARDIAN',
      dto.studentId.trim(),
      true,
      req,
    );
    await this.clearLock(tenantId, 'GUARDIAN', dto.studentId.trim());

    await this.prisma.$executeRaw(
      Prisma.sql`UPDATE student_accounts SET last_login_at = now() WHERE id = ${accs[0].id}`,
    );

    const payload = {
      tenantId: tenantId.toString(),
      type: 'GUARDIAN',
      studentAccountId: accs[0].id.toString(),
    };

    const { accessToken, refreshToken, refreshTokenHash, refreshExpiresAt } =
      await this.issueTokens(payload);

    const sessionId = await this.createSession({
      tenantId,
      accountType: 'GUARDIAN',
      userId: null,
      studentAccountId: accs[0].id,
      refreshTokenHash,
      refreshExpiresAt,
      req,
    });

    this.setRefreshCookie(res, refreshToken, refreshExpiresAt);

    return res.json({
      accessToken,
      mustChangePassword: accs[0].must_change_password,
    });
  }

  async refresh(req: Request, res: Response) {
    const token = (req.cookies?.[this.cookieName()] as string) || '';
    if (!token) throw new UnauthorizedException('NO_REFRESH_TOKEN');

    const hash = sha256Hex(token);

    const sessions = await this.prisma.$queryRaw<
      {
        id: bigint;
        tenant_id: bigint;
        account_type: AccountType;
        user_id: bigint | null;
        student_account_id: bigint | null;
        expires_at: Date;
        revoked_at: Date | null;
      }[]
    >(
      Prisma.sql`
        SELECT id, tenant_id, account_type, user_id, student_account_id, expires_at, revoked_at
        FROM auth_sessions
        WHERE refresh_token_hash = ${hash}
        LIMIT 1
      `,
    );

    if (!sessions.length)
      throw new UnauthorizedException('INVALID_REFRESH_TOKEN');

    const s = sessions[0];
    if (s.revoked_at) throw new UnauthorizedException('SESSION_REVOKED');
    if (s.expires_at <= now())
      throw new UnauthorizedException('SESSION_EXPIRED');

    const payload =
      s.account_type === 'STAFF'
        ? {
            tenantId: s.tenant_id.toString(),
            type: 'STAFF',
            userId: String(s.user_id),
          }
        : {
            tenantId: s.tenant_id.toString(),
            type: 'GUARDIAN',
            studentAccountId: String(s.student_account_id),
          };

    // refresh rotate
    const { accessToken, refreshToken, refreshTokenHash, refreshExpiresAt } =
      await this.issueTokens(payload);

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE auth_sessions
        SET refresh_token_hash = ${refreshTokenHash}, expires_at = ${refreshExpiresAt}
        WHERE id = ${s.id}
      `,
    );

    this.setRefreshCookie(res, refreshToken, refreshExpiresAt);

    return res.json({ accessToken });
  }

  async logout(req: Request, res: Response) {
    const token = (req.cookies?.[this.cookieName()] as string) || '';
    if (token) {
      const hash = sha256Hex(token);
      await this.prisma.$executeRaw(
        Prisma.sql`UPDATE auth_sessions SET revoked_at = now() WHERE refresh_token_hash = ${hash} AND revoked_at IS NULL`,
      );
    }
    this.clearRefreshCookie(res);
    return res.json({ ok: true });
  }

  async me(auth?: string) {
    const token = String(auth || '')
      .replace('Bearer ', '')
      .trim();
    if (!token) return { ok: false };

    const payload = await this.jwt.verifyAsync(token, {
      secret: process.env.JWT_ACCESS_SECRET!,
    });

    return { ok: true, payload };
  }

  async guardianChangePassword(req: Request, res: Response, dto: any) {
    const user: any = (req as any).user;
    if (!user || user.type !== 'GUARDIAN')
      throw new UnauthorizedException('NOT_GUARDIAN');

    const studentAccountId = BigInt(user.studentAccountId);

    const acc = await this.prisma.$queryRaw<
      { id: bigint; password_hash: string; tenant_id: bigint }[]
    >(
      Prisma.sql`
      SELECT id, password_hash, tenant_id
      FROM student_accounts
      WHERE id = ${studentAccountId}
      LIMIT 1
    `,
    );
    if (!acc.length) throw new UnauthorizedException('ACCOUNT_NOT_FOUND');

    const ok = await bcrypt.compare(
      String(dto.oldPassword || ''),
      acc[0].password_hash,
    );
    if (!ok) throw new UnauthorizedException('INVALID_OLD_PASSWORD');

    const newHash = await bcrypt.hash(String(dto.newPassword), 10);

    await this.prisma.$executeRaw(
      Prisma.sql`
      UPDATE student_accounts
      SET password_hash = ${newHash},
          must_change_password = false,
          password_changed_at = now()
      WHERE id = ${studentAccountId}
    `,
    );

    // barcha eski session’larni bekor qilamiz
    await this.prisma.$executeRaw(
      Prisma.sql`
      UPDATE auth_sessions
      SET revoked_at = now()
      WHERE student_account_id = ${studentAccountId} AND revoked_at IS NULL
    `,
    );

    const payload = {
      tenantId: acc[0].tenant_id.toString(),
      type: 'GUARDIAN',
      studentAccountId: studentAccountId.toString(),
    };

    const { accessToken, refreshToken, refreshTokenHash, refreshExpiresAt } =
      await this.issueTokens(payload);

    const sessionId = await this.createSession({
      tenantId: acc[0].tenant_id,
      accountType: 'GUARDIAN',
      userId: null,
      studentAccountId,
      refreshTokenHash,
      refreshExpiresAt,
      req,
    });

    this.setRefreshCookie(res, refreshToken, refreshExpiresAt);

    return res.json({
      ok: true,
      accessToken,
      mustChangePassword: false,
    });
  }
}
