import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { CONFIG, type AppConfig } from "../config/configuration.js";

export const ROLES_KEY = "roles";
/** Restrict a route to given roles, e.g. @Roles("admin"). */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

/**
 * JWT guard, config-gated by AUTH_REQUIRED. When auth is disabled (default, so
 * the no-hardware demo works out of the box), it allows all requests. When
 * enabled, it validates the Bearer token and enforces @Roles.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(CONFIG) private readonly config: AppConfig,
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (!this.config.authRequired) return true;

    const req = ctx.switchToHttp().getRequest();
    const auth: string = req.headers?.authorization ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) throw new UnauthorizedException("missing bearer token");

    let payload: { sub: string; role: string };
    try {
      payload = await this.jwt.verifyAsync(token);
    } catch {
      throw new UnauthorizedException("invalid token");
    }
    req.user = payload;

    const roles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (roles && roles.length && !roles.includes(payload.role)) {
      throw new UnauthorizedException("insufficient role");
    }
    return true;
  }
}
