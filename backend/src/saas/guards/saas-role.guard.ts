import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SaasAdminRole } from '@prisma/client';
import { SAAS_ROLES_KEY } from '../saas.constants';
import type { SaasAdminSafe } from '../strategies/saas-jwt.strategy';

@Injectable()
export class SaasRoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<SaasAdminRole[]>(SAAS_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) {
      return true;
    }

    const req = context.switchToHttp().getRequest<{ user?: SaasAdminSafe }>();
    const admin = req.user;
    if (!admin) {
      throw new ForbiddenException({
        message: 'SaaS authentication required',
        code: 'SAAS_AUTH_REQUIRED',
      });
    }
    if (!required.includes(admin.role)) {
      throw new ForbiddenException({
        message: 'You do not have permission for this SaaS operation',
        code: 'SAAS_FORBIDDEN_ROLE',
      });
    }
    return true;
  }
}
