import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../auth.constants';
import { SafeUser } from '../types/safe-user.type';

/**
 * Role equivalence: GENERAL_MANAGER has the same access as ADMIN, and
 * CO_MANAGER the same as MANAGER, so the new management roles work across
 * every existing @Roles(...) check without rewriting controllers.
 */
const ROLE_EQUIVALENTS: Partial<Record<UserRole, UserRole>> = {
  [UserRole.GENERAL_MANAGER]: UserRole.ADMIN,
  [UserRole.CO_MANAGER]: UserRole.MANAGER,
};

export function effectiveRoles(role: UserRole): UserRole[] {
  const mapped = ROLE_EQUIVALENTS[role];
  return mapped ? [role, mapped] : [role];
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: SafeUser }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException({
        message: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    }

    if (!effectiveRoles(user.role).some((r) => requiredRoles.includes(r))) {
      throw new ForbiddenException({
        message: 'You do not have permission to access this resource',
        code: 'FORBIDDEN_ROLE',
      });
    }

    return true;
  }
}
