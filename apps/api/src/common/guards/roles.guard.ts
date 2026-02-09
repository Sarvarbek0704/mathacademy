import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { ROLES_KEY } from "../decorators/roles.decorator";
import { ensureUser } from "../auth/jwt-request.util";

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
    const user = await ensureUser(req, this.jwt);

    const roles = Array.isArray(user?.roles) ? user.roles : [];
    const ok = required.some((r) => roles.includes(r));
    if (!ok) throw new ForbiddenException("FORBIDDEN_ROLE");

    return true;
  }
}
