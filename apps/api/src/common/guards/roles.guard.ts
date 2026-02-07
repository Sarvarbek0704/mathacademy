import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest();
    const auth = String(req.headers?.authorization || '');
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';

    if (!token) throw new UnauthorizedException('NO_ACCESS_TOKEN');

    const payload = await this.jwt.verifyAsync(token, {
      secret: process.env.JWT_ACCESS_SECRET!,
    });
    req.user = payload;

    const roles: string[] = Array.isArray(payload?.roles) ? payload.roles : [];
    const ok = required.some((r) => roles.includes(r));
    if (!ok) throw new ForbiddenException('FORBIDDEN_ROLE');

    return true;
  }
}
