import { SetMetadata } from '@nestjs/common';
import { REQUIRE_FEATURE_KEY, type PlanFeatureKey } from './fnb-features.constants';

/**
 * Marks a route (or controller) as requiring one or more plan feature flags.
 * Enforced by `FeatureGuard`, which reads the authenticated store user's
 * clientId and asserts each feature via `FeatureService`.
 *
 * Usage: `@RequireFeature('fnb_module')` or `@RequireFeature('wholesale_module')`
 */
export const RequireFeature = (...features: PlanFeatureKey[]) =>
  SetMetadata(REQUIRE_FEATURE_KEY, features);
