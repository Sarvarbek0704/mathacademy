import {
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtService } from '@nestjs/jwt';

export type RequestUser = {
  tenantId?: string | number;
  roles?: string[];
  permissions?: string[];
  type?: 'STAFF' | 'GUARDIAN'; // ✅ token payload bilan mos
  sessionId?: string;
  userId?: string | number;
  studentAccountId?: string | number;
  studentId?: string | number;
  [k: string]: unknown;
};

function extractBearer(req: Request): string {
  const auth = String(req.headers?.authorization || '');
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  return '';
}

function extractAccessToken(req: Request): string {
  // 1) Authorization: Bearer <token>
  const bearer = extractBearer(req);
  if (bearer) return bearer;

  // 2) Optional: cookie orqali access token (agar keyin qo‘shsangiz)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cookies = (req as any).cookies || {};
  const cookieToken = String(cookies.access_token || '').trim();
  if (cookieToken) return cookieToken;

  // 3) Optional: header fallback (dev uchun)
  const headerToken = String(req.headers['x-access-token'] || '').trim();
  if (headerToken) return headerToken;

  return '';
}

export async function ensureUser(
  req: Request,
  jwt: JwtService,
): Promise<RequestUser> {
  // ✅ AccessGuard allaqachon qo‘ygan bo‘lsa qayta verify qilmaymiz
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existing = (req as any).user as RequestUser | undefined;
  if (existing) return existing;

  const token = extractAccessToken(req);
  if (!token) throw new UnauthorizedException('NO_ACCESS_TOKEN');

  const secret = String(process.env.JWT_ACCESS_SECRET || '').trim();
  if (!secret)
    throw new InternalServerErrorException('JWT_ACCESS_SECRET_MISSING');

  try {
    const payload = await jwt.verifyAsync<RequestUser>(token, { secret });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (req as any).user = payload;
    return payload;
  } catch (e: any) {
    const name = String(e?.name || '');
    if (name === 'TokenExpiredError') {
      throw new UnauthorizedException('ACCESS_TOKEN_EXPIRED');
    }
    throw new UnauthorizedException('INVALID_ACCESS_TOKEN');
  }
}
