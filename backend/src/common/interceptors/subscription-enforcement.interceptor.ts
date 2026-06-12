import {
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { SubscriptionStatus } from '@prisma/client';
import { Observable } from 'rxjs';
import { SafeUser } from '../../auth/types/safe-user.type';

/**
 * Global subscription-state enforcement.
 *
 * The store-user JWT strategy attaches `subscriptionStatus` to `request.user`.
 * For store-user requests we block hard failures (SUSPENDED/EXPIRED/CANCELLED)
 * everywhere except the small set of paths the tenant owner needs to read or
 * remediate the block (login, logout, refresh, billing, tenant context, the
 * SaaS panel, public/activation/health/license paths).
 *
 * PAST_DUE is allowed through (the UI surfaces a warning); other statuses
 * (ACTIVE, LIFETIME, TRIALING, PENDING_PAYMENT) pass through silently.
 */
const ALLOWED_PATH_PREFIXES = [
  '/health',
  '/auth',
  '/saas',
  '/public',
  '/license',
  '/activation',
  '/tenant',
  '/billing',
];

const BLOCKED_STATUSES: SubscriptionStatus[] = [
  SubscriptionStatus.SUSPENDED,
  SubscriptionStatus.EXPIRED,
  SubscriptionStatus.CANCELLED,
];

@Injectable()
export class SubscriptionEnforcementInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{ user?: SafeUser; path?: string; url?: string }>();
    const user = req.user;
    if (!user || typeof user !== 'object' || !('subscriptionStatus' in user)) {
      return next.handle();
    }

    const path = ((req.path ?? req.url ?? '').split('?')[0] || '').toLowerCase();
    if (ALLOWED_PATH_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) {
      return next.handle();
    }

    const status = user.subscriptionStatus ?? null;
    if (status && BLOCKED_STATUSES.includes(status)) {
      throw new ForbiddenException({
        message: 'Your subscription is not active. Visit billing to restore access.',
        code: 'SUBSCRIPTION_BLOCKED',
        subscriptionStatus: status,
      });
    }

    return next.handle();
  }
}
