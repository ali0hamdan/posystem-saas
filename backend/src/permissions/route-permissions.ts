import { PERMISSIONS } from './permission.types';
import { Permission } from './permission.types';

type RoutePermission = Permission | Permission[];

/**
 * Maps Nest route paths (with :params) to required permission(s).
 * Only applies when handler has no @RequirePermission decorator.
 */
const ROUTE_PERMISSION_MAP: Record<string, RoutePermission> = {
  // Products & categories
  'GET /products': PERMISSIONS.PRODUCTS_VIEW,
  'POST /products': PERMISSIONS.PRODUCTS_CREATE,
  'PATCH /products/:id': PERMISSIONS.PRODUCTS_UPDATE,
  'DELETE /products/:id': PERMISSIONS.PRODUCTS_DELETE,
  'GET /categories': PERMISSIONS.CATEGORIES_VIEW,
  'POST /categories': PERMISSIONS.CATEGORIES_CREATE,
  'PATCH /categories/:id': PERMISSIONS.CATEGORIES_UPDATE,
  'DELETE /categories/:id': PERMISSIONS.CATEGORIES_DELETE,

  // Sales & POS
  'GET /sales': PERMISSIONS.SALES_VIEW,
  'POST /sales': PERMISSIONS.SALES_CREATE,
  'POST /sales/:id/refund': PERMISSIONS.REFUNDS_CREATE,

  // Refunds
  'GET /refunds': PERMISSIONS.REFUNDS_VIEW,
  'GET /refunds/:id': PERMISSIONS.REFUNDS_VIEW,
  'GET /refunds/:id/print-data': PERMISSIONS.REFUNDS_PRINT,
  'GET /refunds/refundable/:sourceType/:sourceId': PERMISSIONS.REFUNDS_VIEW,
  'POST /refunds/preview': PERMISSIONS.REFUNDS_CREATE,
  'POST /refunds': PERMISSIONS.REFUNDS_CREATE,

  // Stock
  'GET /stock-movements': PERMISSIONS.STOCK_HISTORY,
  'POST /stock-movements': PERMISSIONS.STOCK_ADJUST,

  // Purchase orders & suppliers
  'GET /purchase-orders': PERMISSIONS.PURCHASE_ORDERS_VIEW,
  'POST /purchase-orders': PERMISSIONS.PURCHASE_ORDERS_CREATE,
  'PATCH /purchase-orders/:id': PERMISSIONS.PURCHASE_ORDERS_UPDATE,
  'POST /purchase-orders/:id/receive': PERMISSIONS.PURCHASE_ORDERS_RECEIVE,
  'GET /suppliers': PERMISSIONS.SUPPLIERS_VIEW,
  'POST /suppliers': PERMISSIONS.SUPPLIERS_CREATE,
  'PATCH /suppliers/:id': PERMISSIONS.SUPPLIERS_UPDATE,

  // Customers
  'GET /customers': PERMISSIONS.CUSTOMERS_VIEW,
  'POST /customers': PERMISSIONS.CUSTOMERS_CREATE,
  'PATCH /customers/:id': PERMISSIONS.CUSTOMERS_UPDATE,

  // Users & branches
  'GET /users': PERMISSIONS.USERS_VIEW,
  'POST /users': PERMISSIONS.USERS_CREATE,
  'PATCH /users/:id': PERMISSIONS.USERS_UPDATE,
  'PATCH /users/:id/password': PERMISSIONS.USERS_RESET_PASSWORD,
  'PATCH /users/:id/status': PERMISSIONS.USERS_DEACTIVATE,
  'GET /branches': PERMISSIONS.BRANCHES_VIEW,
  'POST /branches': PERMISSIONS.BRANCHES_CREATE,
  'PATCH /branches/:id': PERMISSIONS.BRANCHES_UPDATE,

  // Settings & billing
  'GET /settings': PERMISSIONS.SETTINGS_VIEW,
  'PATCH /settings': PERMISSIONS.SETTINGS_UPDATE,
  'GET /settings/notifications': PERMISSIONS.NOTIFICATIONS_VIEW,
  'PATCH /settings/notifications': PERMISSIONS.NOTIFICATIONS_UPDATE,

  // Reports
  'GET /reports': PERMISSIONS.REPORTS_VIEW,

  // Commissions
  'GET /commissions': [PERMISSIONS.COMMISSIONS_VIEW, PERMISSIONS.COMMISSIONS_VIEW_OWN],
  'GET /commissions/summary': [PERMISSIONS.COMMISSIONS_VIEW, PERMISSIONS.COMMISSIONS_VIEW_OWN],
  'GET /commissions/salesman/:salesmanId': [PERMISSIONS.COMMISSIONS_VIEW, PERMISSIONS.COMMISSIONS_VIEW_OWN],
  'GET /commissions/:id': [PERMISSIONS.COMMISSIONS_VIEW, PERMISSIONS.COMMISSIONS_VIEW_OWN],
  'PATCH /commissions/:id/approve': PERMISSIONS.COMMISSIONS_APPROVE,
  'PATCH /commissions/:id/mark-paid': PERMISSIONS.COMMISSIONS_MARK_PAID,
  'PATCH /commissions/:id/cancel': PERMISSIONS.COMMISSIONS_APPROVE,
  'PATCH /users/:id/commission-settings': PERMISSIONS.COMMISSIONS_MANAGE_SETTINGS,
  'PATCH /users/:id/regenerate-salesman-id': PERMISSIONS.USERS_UPDATE,
  'GET /users/salesmen/lookup': PERMISSIONS.SALES_CREATE,
  'GET /users/salesmen': PERMISSIONS.SALES_CREATE,
  'GET /users/approval-lookup': PERMISSIONS.REFUNDS_CREATE,
  'PATCH /users/:id/regenerate-approval-id': PERMISSIONS.USERS_UPDATE,
  'PATCH /users/:id/nfc/register': PERMISSIONS.USERS_UPDATE,
  'PATCH /users/:id/nfc/remove': PERMISSIONS.USERS_UPDATE,
  'PATCH /users/:id/nfc/enabled': PERMISSIONS.USERS_UPDATE,
  'PATCH /users/:id/approval-pin': PERMISSIONS.USERS_UPDATE,
  'POST /approvals/validate': PERMISSIONS.REFUNDS_CREATE,

  // Shifts
  'GET /shifts': PERMISSIONS.CASHIER_OPEN_SHIFT,
  'POST /shifts/open': PERMISSIONS.CASHIER_OPEN_SHIFT,
  'POST /shifts/:id/close': PERMISSIONS.CASHIER_CLOSE_SHIFT,

  // Wholesale
  'GET /quotations': PERMISSIONS.QUOTATIONS_VIEW,
  'POST /quotations': PERMISSIONS.QUOTATIONS_CREATE,
  'PATCH /quotations/:id': PERMISSIONS.QUOTATIONS_UPDATE,
  'GET /proforma-invoices': PERMISSIONS.PROFORMA_VIEW,
  'POST /proforma-invoices': PERMISSIONS.PROFORMA_CREATE,
  'PATCH /proforma-invoices/:id': PERMISSIONS.PROFORMA_UPDATE,
  'GET /wholesale/bulk-pricing': PERMISSIONS.BULK_PRICING_VIEW,
  'POST /wholesale/bulk-pricing': PERMISSIONS.BULK_PRICING_CREATE,
  'GET /wholesale/delivery-notes': PERMISSIONS.DELIVERY_NOTES_VIEW,
  'POST /wholesale/delivery-notes': PERMISSIONS.DELIVERY_NOTES_CREATE,
  'GET /wholesale/reports': PERMISSIONS.REPORTS_VIEW,

  // F&B
  'GET /fnb/orders': PERMISSIONS.FNB_ORDERS_VIEW,
  'POST /fnb/orders': PERMISSIONS.FNB_ORDERS_CREATE,
  'POST /fnb/orders/:id/settle': PERMISSIONS.FNB_ORDERS_PAY,
  'POST /fnb/orders/:id/refund': PERMISSIONS.FNB_ORDERS_REFUND,
  'POST /fnb/orders/:id/cancel': PERMISSIONS.FNB_ORDERS_CANCEL,
  'GET /fnb/tables': PERMISSIONS.TABLES_VIEW,
  'GET /fnb/kitchen': PERMISSIONS.KITCHEN_VIEW,
  'PATCH /fnb/kitchen/:id': PERMISSIONS.KITCHEN_UPDATE,
  'GET /fnb/menu/items': PERMISSIONS.MENU_VIEW,
  'POST /fnb/menu/items': PERMISSIONS.MENU_CREATE,
  'PATCH /fnb/menu/items/:id': PERMISSIONS.MENU_UPDATE,
  'GET /fnb/ingredients': PERMISSIONS.INGREDIENTS_VIEW,
};

/** Public routes that skip permission checks entirely. */
const PUBLIC_PREFIXES = ['/auth', '/public', '/health', '/activation', '/admin', '/saas'];

export function matchRoutePermission(method: string, path: string): RoutePermission | null {
  const cleanPath = path.split('?')[0].replace(/\/+$/, '') || '/';
  if (PUBLIC_PREFIXES.some((p) => cleanPath.startsWith(p))) return null;

  const key = `${method.toUpperCase()} ${cleanPath}`;
  if (ROUTE_PERMISSION_MAP[key]) return ROUTE_PERMISSION_MAP[key];

  // Match parameterized routes
  for (const [pattern, perm] of Object.entries(ROUTE_PERMISSION_MAP)) {
    const [patMethod, patPath] = pattern.split(' ');
    if (patMethod !== method.toUpperCase()) continue;
    const regex = new RegExp(`^${patPath.replace(/:[^/]+/g, '[^/]+')}$`);
    if (regex.test(cleanPath)) return perm;
  }
  return null;
}
