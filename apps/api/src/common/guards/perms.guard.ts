import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PERMS_KEY } from '../decorators/perms.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(PERMS_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = ctx.switchToHttp().getRequest();
    const auth = String(req.headers?.authorization || '');
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (!token) throw new UnauthorizedException('NO_ACCESS_TOKEN');

    const payload = await this.jwt.verifyAsync(token, {
      secret: process.env.JWT_ACCESS_SECRET!,
    });
    req.user = payload;

    const perms: string[] = Array.isArray(payload?.permissions)
      ? payload.permissions
      : [];
    const ok = required.every((p) => perms.includes(p)); // all perms required
    if (!ok) throw new ForbiddenException('FORBIDDEN_PERMISSION');

    return true;
  }
}
