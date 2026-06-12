import { BusinessType } from '@prisma/client';

/** Default post-login dashboard path for a tenant business type. */
export function resolveDashboardPath(businessType: BusinessType | null | undefined): string {
  switch (businessType) {
    case BusinessType.FOOD_BEVERAGE:
      return '/fnb/dashboard';
    case BusinessType.WHOLESALE:
      return '/wholesale/dashboard';
    case BusinessType.HYBRID:
    case BusinessType.RETAIL:
    default:
      return '/dashboard';
  }
}
