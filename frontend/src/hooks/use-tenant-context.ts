import { useQuery } from '@tanstack/react-query';
import { fetchTenantContext } from '@/api/tenant.api';
import { useStoreAuthReady } from '@/hooks/use-store-auth-ready';
import type { BusinessType } from '@/types/tenant-context';

/**
 * Fetches the tenant's business type + enabled plan feature flags. Used to gate
 * which POS surfaces (retail / F&B / Wholesale) are shown. Server-side gating
 * remains the real security boundary; this only drives navigation/UX.
 */
export function useTenantContext() {
  const authReady = useStoreAuthReady();
  return useQuery({
    queryKey: ['tenant-context'],
    queryFn: fetchTenantContext,
    enabled: authReady,
    staleTime: 60_000,
  });
}

/** True when the given plan feature flag is enabled for the tenant. */
export function useFeature(feature: string): boolean {
  const { data } = useTenantContext();
  return data?.enabledFeatures?.[feature] === true;
}

/** Tenant business vertical (undefined until loaded). */
export function useBusinessType(): BusinessType | undefined {
  const { data } = useTenantContext();
  return data?.businessType;
}

/** Whether the F&B module surfaces should be shown (business type + plan flag). */
export function useFnbEnabled(): boolean {
  const { data } = useTenantContext();
  if (!data) return false;
  const isFnbBusiness = data.businessType === 'FOOD_BEVERAGE' || data.businessType === 'HYBRID';
  return isFnbBusiness && data.enabledFeatures.fnb_module === true;
}

/** Whether the Wholesale / B2B module surfaces should be shown. */
export function useWholesaleEnabled(): boolean {
  const { data } = useTenantContext();
  if (!data) return false;
  const isWholesaleBusiness = data.businessType === 'WHOLESALE' || data.businessType === 'HYBRID';
  return isWholesaleBusiness && data.enabledFeatures.wholesale_module === true;
}
