/** Maps a shared store path to its wholesale-prefixed equivalent. */
const WHOLESALE_PREFIXED: Record<string, string> = {
  '/pos': '/wholesale/pos',
  '/sales': '/wholesale/sales',
  '/customers': '/wholesale/customers',
  '/products': '/wholesale/products',
  '/product-labels': '/wholesale/product-labels',
  '/categories': '/wholesale/categories',
  '/stock-movements': '/wholesale/stock-movements',
  '/stock-transfers': '/wholesale/stock-transfers',
  '/purchases': '/wholesale/purchases',
  '/suppliers': '/wholesale/suppliers',
  '/branches': '/wholesale/branches',
  '/users': '/wholesale/users',
  '/offline-queue': '/wholesale/offline-queue',
  '/reports': '/wholesale/shared-reports',
  '/billing': '/wholesale/billing',
  '/download': '/wholesale/download',
  '/license': '/wholesale/license',
  '/settings': '/wholesale/settings',
};

export function wholesalePrefixedPath(path: string): string {
  return WHOLESALE_PREFIXED[path] ?? path;
}

export function isWholesalePrefixedSharedPath(path: string): boolean {
  return path.startsWith('/wholesale/') && path !== '/wholesale/dashboard' && !path.startsWith('/wholesale/quotations')
    && !path.startsWith('/wholesale/proforma') && !path.startsWith('/wholesale/invoices')
    && !path.startsWith('/wholesale/bulk') && !path.startsWith('/wholesale/delivery')
    && !path.startsWith('/wholesale/payment') && !path.startsWith('/wholesale/customer-statements')
    && !path.startsWith('/wholesale/stock-reservations') && path !== '/wholesale/reports';
}
