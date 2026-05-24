import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { SaasAdminSafe } from '../strategies/saas-jwt.strategy';

export const CurrentSaaSAdmin = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): SaasAdminSafe => {
    const req = ctx.switchToHttp().getRequest<{ user: SaasAdminSafe }>();
    return req.user;
  },
);
