import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SafeUser } from '../../auth/types/safe-user.type';
import { FeatureService } from './feature.service';
import { REQUIRE_FEATURE_KEY } from './fnb-features.constants';

/**
 * Enforces `@RequireFeature(...)` on store routes. Must run after a guard that
 * populates `request.user` (e.g. `JwtAuthGuard`):
 *   `@UseGuards(JwtAuthGuard, RolesGuard, FeatureGuard)`
 */
@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly features: FeatureService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(REQUIRE_FEATURE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: SafeUser }>();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException({ message: 'Authentication required', code: 'AUTH_REQUIRED' });
    }

    for (const feature of required) {
      await this.features.assertFeature(user.clientId, feature);
    }
    return true;
  }
}
