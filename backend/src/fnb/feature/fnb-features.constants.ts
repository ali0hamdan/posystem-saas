/**
 * Canonical plan-feature flags for F&B, Wholesale/B2B, and shared document modules.
 * Stored on `Plan.features` (Json) and read by `FeatureGuard` via `FeatureService`.
 */
export const FNB_FEATURE_KEYS = [
  'fnb_module',
  'table_management',
  'kitchen_display',
  'recipe_inventory',
  'delivery_management',
  'reservations',
  'split_billing',
  'multi_printer_routing',
] as const;

export const WHOLESALE_FEATURE_KEYS = [
  'wholesale_module',
  'quotations',
  'proforma_invoices',
  'official_invoices',
  'bulk_pricing',
  'customer_credit',
  'payment_terms',
  'delivery_notes',
  'stock_reservations',
  'customer_statements',
  'approval_workflow',
] as const;

/** All known plan feature keys (F&B + Wholesale). */
export const PLAN_FEATURE_KEYS = [
  ...FNB_FEATURE_KEYS,
  ...WHOLESALE_FEATURE_KEYS,
] as const;

export type FnbFeatureKey = (typeof FNB_FEATURE_KEYS)[number];
export type WholesaleFeatureKey = (typeof WHOLESALE_FEATURE_KEYS)[number];
export type PlanFeatureKey = (typeof PLAN_FEATURE_KEYS)[number];

/** Metadata key used by the `@RequireFeature()` decorator + `FeatureGuard`. */
export const REQUIRE_FEATURE_KEY = 'require_feature';
