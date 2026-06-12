export type BusinessType = 'RETAIL' | 'FOOD_BEVERAGE' | 'WHOLESALE' | 'HYBRID';

/** Runtime tenant context driving which POS surfaces the store UI exposes. */
export type TenantContext = {
  businessType: BusinessType;
  enabledFeatures: Record<string, boolean>;
};
