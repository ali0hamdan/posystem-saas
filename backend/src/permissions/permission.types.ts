/** Dot-notation permission string, e.g. `products:create`. */
export type Permission = string;

export const PERMISSIONS = {
  DASHBOARD_VIEW: 'dashboard:view',

  PRODUCTS_VIEW: 'products:view',
  PRODUCTS_CREATE: 'products:create',
  PRODUCTS_UPDATE: 'products:update',
  PRODUCTS_DELETE: 'products:delete',

  CATEGORIES_VIEW: 'categories:view',
  CATEGORIES_CREATE: 'categories:create',
  CATEGORIES_UPDATE: 'categories:update',
  CATEGORIES_DELETE: 'categories:delete',

  SALES_VIEW: 'sales:view',
  SALES_CREATE: 'sales:create',
  SALES_REFUND: 'sales:refund',
  SALES_DISCOUNT: 'sales:discount',
  SALES_DELETE: 'sales:delete',
  SALES_PRINT: 'sales:print',

  POS_ACCESS: 'pos:access',
  CASHIER_OPEN_SHIFT: 'cashier:open_shift',
  CASHIER_CLOSE_SHIFT: 'cashier:close_shift',

  CUSTOMERS_VIEW: 'customers:view',
  CUSTOMERS_CREATE: 'customers:create',
  CUSTOMERS_UPDATE: 'customers:update',
  CUSTOMERS_DELETE: 'customers:delete',

  SUPPLIERS_VIEW: 'suppliers:view',
  SUPPLIERS_CREATE: 'suppliers:create',
  SUPPLIERS_UPDATE: 'suppliers:update',
  SUPPLIERS_DELETE: 'suppliers:delete',

  STOCK_VIEW: 'stock:view',
  STOCK_ADJUST: 'stock:adjust',
  STOCK_ADD: 'stock:add',
  STOCK_TRANSFER: 'stock:transfer',
  STOCK_HISTORY: 'stock:history',
  STOCK_RECEIVE_PO: 'stock:receive_purchase_order',

  PURCHASE_ORDERS_VIEW: 'purchase_orders:view',
  PURCHASE_ORDERS_CREATE: 'purchase_orders:create',
  PURCHASE_ORDERS_UPDATE: 'purchase_orders:update',
  PURCHASE_ORDERS_RECEIVE: 'purchase_orders:receive',
  PURCHASE_ORDERS_CANCEL: 'purchase_orders:cancel',

  REPORTS_VIEW: 'reports:view',
  REPORTS_ADVANCED: 'reports:advanced',

  USERS_VIEW: 'users:view',
  USERS_CREATE: 'users:create',
  USERS_UPDATE: 'users:update',
  USERS_DEACTIVATE: 'users:deactivate',
  USERS_RESET_PASSWORD: 'users:reset_password',

  BRANCHES_VIEW: 'branches:view',
  BRANCHES_CREATE: 'branches:create',
  BRANCHES_UPDATE: 'branches:update',
  BRANCHES_DELETE: 'branches:delete',

  SETTINGS_VIEW: 'settings:view',
  SETTINGS_UPDATE: 'settings:update',

  BILLING_VIEW: 'billing:view',
  BILLING_UPDATE: 'billing:update',

  NOTIFICATIONS_VIEW: 'notifications:view',
  NOTIFICATIONS_UPDATE: 'notifications:update',

  REFUNDS_VIEW: 'refunds:view',
  REFUNDS_CREATE: 'refunds:create',
  REFUNDS_APPROVE: 'refunds:approve',
  REFUNDS_PRINT: 'refunds:print',

  WHOLESALE_ACCESS: 'wholesale:access',
  QUOTATIONS_VIEW: 'quotations:view',
  QUOTATIONS_CREATE: 'quotations:create',
  QUOTATIONS_UPDATE: 'quotations:update',
  QUOTATIONS_APPROVE: 'quotations:approve',
  QUOTATIONS_CONVERT: 'quotations:convert',
  QUOTATIONS_PRINT: 'quotations:print',

  PROFORMA_VIEW: 'proforma:view',
  PROFORMA_CREATE: 'proforma:create',
  PROFORMA_UPDATE: 'proforma:update',
  PROFORMA_APPROVE: 'proforma:approve',
  PROFORMA_CONVERT: 'proforma:convert',
  PROFORMA_PRINT: 'proforma:print',

  OFFICIAL_INVOICES_VIEW: 'official_invoices:view',
  OFFICIAL_INVOICES_CREATE: 'official_invoices:create',
  OFFICIAL_INVOICES_UPDATE: 'official_invoices:update',
  OFFICIAL_INVOICES_PAY: 'official_invoices:record_payment',
  OFFICIAL_INVOICES_REFUND: 'official_invoices:refund',
  OFFICIAL_INVOICES_PRINT: 'official_invoices:print',

  BULK_PRICING_VIEW: 'bulk_pricing:view',
  BULK_PRICING_CREATE: 'bulk_pricing:create',
  BULK_PRICING_UPDATE: 'bulk_pricing:update',
  BULK_PRICING_DELETE: 'bulk_pricing:delete',

  DELIVERY_NOTES_VIEW: 'delivery_notes:view',
  DELIVERY_NOTES_CREATE: 'delivery_notes:create',
  DELIVERY_NOTES_UPDATE: 'delivery_notes:update',
  DELIVERY_NOTES_PRINT: 'delivery_notes:print',

  CUSTOMER_STATEMENTS_VIEW: 'customer_statements:view',
  CUSTOMER_STATEMENTS_PRINT: 'customer_statements:print',

  FNB_ACCESS: 'fnb:access',
  FNB_ORDERS_VIEW: 'fnb_orders:view',
  FNB_ORDERS_CREATE: 'fnb_orders:create',
  FNB_ORDERS_UPDATE: 'fnb_orders:update',
  FNB_ORDERS_PAY: 'fnb_orders:pay',
  FNB_ORDERS_CANCEL: 'fnb_orders:cancel',
  FNB_ORDERS_REFUND: 'fnb_orders:refund',
  FNB_ORDERS_PRINT: 'fnb_orders:print',

  TABLES_VIEW: 'tables:view',
  TABLES_UPDATE: 'tables:update',
  TABLES_ASSIGN: 'tables:assign',

  KITCHEN_VIEW: 'kitchen:view',
  KITCHEN_UPDATE: 'kitchen:update',

  MENU_VIEW: 'menu:view',
  MENU_CREATE: 'menu:create',
  MENU_UPDATE: 'menu:update',
  MENU_DELETE: 'menu:delete',

  INGREDIENTS_VIEW: 'ingredients:view',
  INGREDIENTS_CREATE: 'ingredients:create',
  INGREDIENTS_UPDATE: 'ingredients:update',
  INGREDIENTS_STOCK: 'ingredients:stock',

  PRODUCT_LABELS_VIEW: 'product_labels:view',
  PRODUCT_LABELS_PRINT: 'product_labels:print',

  STOCK_RESERVATIONS_VIEW: 'stock_reservations:view',

  COMMISSIONS_VIEW: 'commissions:view',
  COMMISSIONS_VIEW_OWN: 'commissions:view_own',
  COMMISSIONS_APPROVE: 'commissions:approve',
  COMMISSIONS_MARK_PAID: 'commissions:mark_paid',
  COMMISSIONS_MANAGE_SETTINGS: 'commissions:manage_settings',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSIONS);
