import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { SafeUser } from '../auth/types/safe-user.type';
import { PERMISSIONS_ANY_KEY, PERMISSIONS_KEY } from './permissions.constants';
import { Permission } from './permission.types';
import { PermissionsService } from './permissions.service';
import { matchRoutePermission } from './route-permissions';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissions: PermissionsService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const requiredAny = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_ANY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<{
      user?: SafeUser;
      method?: string;
      route?: { path?: string };
      url?: string;
    }>();
    const user = request.user;

    // JwtAuthGuard runs after global guards — skip permission checks until user is attached.
    if (!user) return true;

    if (required?.length || requiredAny?.length) {
      if (required?.length && !required.every((p) => this.permissions.hasPermission(user.role, p))) {
        throw this.forbidden(user.role, required);
      }
      if (requiredAny?.length && !this.permissions.hasAnyPermission(user.role, requiredAny)) {
        throw this.forbidden(user.role, requiredAny);
      }
      return true;
    }

    const routePerm = matchRoutePermission(
      request.method ?? 'GET',
      request.route?.path ?? request.url ?? '',
    );
    if (!routePerm) return true;
    const perms = Array.isArray(routePerm) ? routePerm : [routePerm];
    if (!this.permissions.hasAnyPermission(user.role, perms)) {
      throw this.forbidden(user.role, perms);
    }
    return true;
  }

  private forbidden(role: UserRole, perms: Permission[]): ForbiddenException {
    return new ForbiddenException({
      message: 'You do not have permission to perform this action',
      code: 'FORBIDDEN_PERMISSION',
      details: { role, required: perms },
    });
  }
}
