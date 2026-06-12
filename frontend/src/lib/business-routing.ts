import type { BusinessType } from '@/types/tenant-context';

export const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  RETAIL: 'Retail Store',
  FOOD_BEVERAGE: 'Food & Beverage',
  WHOLESALE: 'Wholesale / B2B',
  HYBRID: 'Hybrid',
};

/** Default landing path after login for each business type. */
export function defaultDashboardPath(businessType: BusinessType | undefined): string {
  if (businessType === 'FOOD_BEVERAGE') return '/fnb/dashboard';
  if (businessType === 'WHOLESALE') return '/wholesale/dashboard';
  return '/dashboard';
}

/** Shared pages accessible regardless of business vertical. */
export const SHARED_STORE_PATHS = [
  '/users',
  '/settings',
  '/billing',
  '/license',
  '/reports',
  '/branches',
  '/customers',
  '/offline-queue',
  '/products',
  '/categories',
  '/stock-movements',
  '/stock-transfers',
  '/purchases',
  '/suppliers',
  '/sales',
] as const;

/** Retail POS paths hidden for pure F&B / Wholesale clients. */
export const RETAIL_EXCLUSIVE_PATHS = [
  '/dashboard',
  '/pos',
  '/coupons',
  '/product-labels',
] as const;

export const FNB_PATH_PREFIX = '/fnb';
export const WHOLESALE_PATH_PREFIX = '/wholesale';

export function isFnbPath(path: string): boolean {
  return path === FNB_PATH_PREFIX || path.startsWith(`${FNB_PATH_PREFIX}/`);
}

export function isWholesalePath(path: string): boolean {
  return path === WHOLESALE_PATH_PREFIX || path.startsWith(`${WHOLESALE_PATH_PREFIX}/`);
}

export function isRetailExclusivePath(path: string): boolean {
  return (RETAIL_EXCLUSIVE_PATHS as readonly string[]).includes(path);
}

/** @deprecated Use isRetailExclusivePath */
export function isRetailOnlyPath(path: string): boolean {
  return isRetailExclusivePath(path);
}

export function canAccessRetailExclusive(businessType: BusinessType | undefined): boolean {
  return !businessType || businessType === 'RETAIL' || businessType === 'HYBRID';
}

export function canAccessFnbPages(
  businessType: BusinessType | undefined,
  fnbModuleEnabled: boolean,
): boolean {
  if (!businessType) return false;
  const isFnbBusiness = businessType === 'FOOD_BEVERAGE' || businessType === 'HYBRID';
  return isFnbBusiness && fnbModuleEnabled;
}

export function canAccessWholesalePages(
  businessType: BusinessType | undefined,
  wholesaleModuleEnabled: boolean,
): boolean {
  if (!businessType) return false;
  const isWholesaleBusiness = businessType === 'WHOLESALE' || businessType === 'HYBRID';
  return isWholesaleBusiness && wholesaleModuleEnabled;
}

/** Whether retail dashboard/POS nav should appear. */
export function canAccessRetailPages(businessType: BusinessType | undefined): boolean {
  return canAccessRetailExclusive(businessType);
}
