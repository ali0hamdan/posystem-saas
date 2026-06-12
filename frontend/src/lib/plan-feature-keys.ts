/** F&B plan feature flags (mirrors backend `FNB_FEATURE_KEYS`). */
export const FNB_PLAN_FEATURES = [
  { key: 'fnb_module', label: 'F&B module' },
  { key: 'table_management', label: 'Table management' },
  { key: 'kitchen_display', label: 'Kitchen display' },
  { key: 'recipe_inventory', label: 'Recipe inventory' },
  { key: 'delivery_management', label: 'Delivery management' },
  { key: 'reservations', label: 'Reservations' },
  { key: 'split_billing', label: 'Split billing' },
  { key: 'multi_printer_routing', label: 'Multi-printer routing' },
] as const;

/** Wholesale / B2B plan feature flags (mirrors backend `WHOLESALE_FEATURE_KEYS`). */
export const WHOLESALE_PLAN_FEATURES = [
  { key: 'wholesale_module', label: 'Wholesale module' },
  { key: 'quotations', label: 'Quotations' },
  { key: 'proforma_invoices', label: 'Proforma invoices' },
  { key: 'official_invoices', label: 'Official invoices' },
  { key: 'bulk_pricing', label: 'Bulk pricing' },
  { key: 'customer_credit', label: 'Customer credit' },
  { key: 'payment_terms', label: 'Payment terms' },
  { key: 'delivery_notes', label: 'Delivery notes' },
  { key: 'stock_reservations', label: 'Stock reservations' },
  { key: 'customer_statements', label: 'Customer statements' },
  { key: 'approval_workflow', label: 'Approval workflow' },
] as const;

export const ALL_PLAN_FEATURE_GROUPS = [
  { title: 'Food & Beverage', features: FNB_PLAN_FEATURES },
  { title: 'Wholesale / B2B', features: WHOLESALE_PLAN_FEATURES },
] as const;
