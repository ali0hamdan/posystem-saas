/**
 * Frontend route path → required permission(s).
 * Paths are matched without query strings; dynamic segments use `:param`.
 */
export const ROUTE_PERMISSIONS: Record<string, string | string[]> = {
  '/dashboard': 'dashboard:view',
  '/pos': 'pos:access',
  '/sales': 'sales:view',
  '/commissions': ['commissions:view', 'commissions:view_own'],
  '/sales/:id/print': 'sales:print',
  '/refunds': 'refunds:view',
  '/refunds/:id/print': 'refunds:print',
  '/products': 'products:view',
  '/product-labels': 'product_labels:view',
  '/categories': 'categories:view',
  '/stock-movements': 'stock:view',
  '/stock-transfers': 'stock:transfer',
  '/purchases': 'purchase_orders:view',
  '/suppliers': 'suppliers:view',
  '/customers': 'customers:view',
  '/customers/:id': 'customers:view',
  '/branches': 'branches:view',
  '/reports': 'reports:view',
  '/users': 'users:view',
  '/settings': 'settings:view',
  '/settings/notifications': 'notifications:view',
  '/billing': 'billing:view',
  '/license': 'settings:view',
  '/coupons': 'settings:view',
  '/quotations': 'quotations:view',
  '/quotations/:id/print': 'quotations:print',
  '/proforma-invoices': 'proforma:view',
  '/proforma-invoices/:id/print': 'proforma:print',
  '/offline-queue': 'settings:view',
  '/download': 'billing:view',

  '/fnb/dashboard': 'fnb:access',
  '/fnb/pos': 'fnb:access',
  '/fnb/tables': 'tables:view',
  '/fnb/kitchen': 'kitchen:view',
  '/fnb/menu': 'menu:view',
  '/fnb/modifiers': 'menu:view',
  '/fnb/ingredients': 'ingredients:view',
  '/fnb/recipes': 'menu:view',
  '/fnb/waste': 'ingredients:view',
  '/fnb/delivery': 'fnb_orders:view',
  '/fnb/reservations': 'fnb_orders:view',
  '/fnb/reports': 'reports:view',

  '/wholesale/dashboard': 'wholesale:access',
  '/wholesale/quotations': 'quotations:view',
  '/wholesale/quotations/:id/print': 'quotations:print',
  '/wholesale/proforma-invoices': 'proforma:view',
  '/wholesale/proforma-invoices/:id/print': 'proforma:print',
  '/wholesale/invoices': 'official_invoices:view',
  '/wholesale/invoices/new': 'official_invoices:create',
  '/wholesale/invoices/:id/print': 'official_invoices:print',
  '/wholesale/bulk-pricing': 'bulk_pricing:view',
  '/wholesale/delivery-notes': 'delivery_notes:view',
  '/wholesale/payment-terms': 'customers:view',
  '/wholesale/customer-statements': 'customer_statements:view',
  '/wholesale/stock-reservations': 'stock_reservations:view',
  '/wholesale/reports': 'reports:view',
  '/wholesale/commissions': ['commissions:view', 'commissions:view_own'],

  // Wholesale shared routes (same permissions as retail equivalents)
  '/wholesale/pos': 'pos:access',
  '/wholesale/sales': 'sales:view',
  '/wholesale/products': 'products:view',
  '/wholesale/product-labels': 'product_labels:view',
  '/wholesale/categories': 'categories:view',
  '/wholesale/stock-movements': 'stock:view',
  '/wholesale/stock-transfers': 'stock:transfer',
  '/wholesale/purchases': 'purchase_orders:view',
  '/wholesale/suppliers': 'suppliers:view',
  '/wholesale/customers': 'customers:view',
  '/wholesale/customers/:id': 'customers:view',
  '/wholesale/branches': 'branches:view',
  '/wholesale/users': 'users:view',
  '/wholesale/offline-queue': 'settings:view',
  '/wholesale/shared-reports': 'reports:view',
  '/wholesale/settings': 'settings:view',
  '/wholesale/settings/notifications': 'notifications:view',
  '/wholesale/billing': 'billing:view',
  '/wholesale/license': 'settings:view',
  '/wholesale/download': 'billing:view',
};

function patternToRegex(pattern: string): RegExp {
  const escaped = pattern
    .split('/')
    .map((seg) => (seg.startsWith(':') ? '[^/]+' : seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .join('/');
  return new RegExp(`^${escaped}$`);
}

const sortedPatterns = Object.keys(ROUTE_PERMISSIONS).sort((a, b) => b.length - a.length);

export function permissionForPath(pathname: string): string | string[] | null {
  const path = pathname.replace(/\/+$/, '') || '/';
  for (const pattern of sortedPatterns) {
    if (patternToRegex(pattern).test(path)) {
      return ROUTE_PERMISSIONS[pattern] ?? null;
    }
  }
  return null;
}
