import {
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { UserRole } from '@prisma/client';
import { SafeUser } from '../auth/types/safe-user.type';
import { PERMISSIONS_ANY_KEY, PERMISSIONS_KEY } from './permissions.constants';
import { Permission } from './permission.types';
import { PermissionsService } from './permissions.service';
import { matchRoutePermission } from './route-permissions';

/**
 * Runs after JwtAuthGuard so `request.user` is available on protected routes.
 */
@Injectable()
export class PermissionsInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissions: PermissionsService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

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

    if (!user) {
      return next.handle();
    }

    if (required?.length || requiredAny?.length) {
      if (required?.length && !required.every((p) => this.permissions.hasPermission(user.role, p))) {
        throw this.forbidden(user.role, required);
      }
      if (requiredAny?.length && !this.permissions.hasAnyPermission(user.role, requiredAny)) {
        throw this.forbidden(user.role, requiredAny);
      }
      return next.handle();
    }

    const routePerm = matchRoutePermission(
      request.method ?? 'GET',
      request.route?.path ?? request.url ?? '',
    );
    if (!routePerm) {
      return next.handle();
    }

    const perms = Array.isArray(routePerm) ? routePerm : [routePerm];
    if (!this.permissions.hasAnyPermission(user.role, perms)) {
      throw this.forbidden(user.role, perms);
    }

    return next.handle();
  }

  private forbidden(role: UserRole, perms: Permission[]): ForbiddenException {
    return new ForbiddenException({
      message: 'You do not have permission to perform this action',
      code: 'FORBIDDEN_PERMISSION',
      details: { role, required: perms },
    });
  }
}
