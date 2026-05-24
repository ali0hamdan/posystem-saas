import { useLicenseStore } from '@/stores/license-store';
import { BYPASS_LICENSE } from '@/lib/env';

// Decode the plan code from the license JWT (no signature check — server validates)
function decodePlanFromToken(token: string | null): string | null {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.plan === 'string' ? payload.plan : null;
  } catch {
    return null;
  }
}

// Features available per plan code
const PLAN_FEATURES: Record<string, Record<string, boolean>> = {
  STARTER: {
    basic_pos: true,
    inventory: true,
    reports: false,
    multi_branch: false,
    coupons: false,
    offline_mode: false,
  },
  BUSINESS: {
    basic_pos: true,
    inventory: true,
    reports: true,
    multi_branch: true,
    coupons: true,
    offline_mode: false,
  },
  PRO: {
    basic_pos: true,
    inventory: true,
    reports: true,
    multi_branch: true,
    coupons: true,
    offline_mode: true,
  },
  ENTERPRISE: {
    basic_pos: true,
    inventory: true,
    reports: true,
    multi_branch: true,
    coupons: true,
    offline_mode: true,
  },
  LIFETIME_DESKTOP: {
    basic_pos: true,
    inventory: true,
    reports: true,
    multi_branch: true,
    coupons: true,
    offline_mode: true,
  },
};

/**
 * Returns the feature flags for the currently active plan.
 * When bypass mode is on, all features are enabled.
 */
export function usePlanFeatures(): Record<string, boolean> {
  const token = useLicenseStore((s) => s.token);
  if (BYPASS_LICENSE) {
    return Object.fromEntries(
      Object.values(PLAN_FEATURES).flatMap((f) => Object.keys(f)).map((k) => [k, true]),
    );
  }
  const plan = decodePlanFromToken(token);
  if (!plan) return {};
  return PLAN_FEATURES[plan] ?? {};
}

/**
 * Check if a specific feature is available on the current plan.
 */
export function usePlanFeature(feature: string): boolean {
  const features = usePlanFeatures();
  return features[feature] === true;
}
