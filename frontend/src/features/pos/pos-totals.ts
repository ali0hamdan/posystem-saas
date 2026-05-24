import type { Product } from '@/types/product';

export type CartLine = {
  productId: string;
  name: string;
  barcode: string | null;
  sku: string | null;
  unitPrice: number;
  quantity: number;
  lineDiscount: number;
  stockAvailable: number;
  minStock: number;
};

/** Mirrors backend `SalesService.computeTotals` for cashier preview. */
export function computePosTotals(
  lines: CartLine[],
  globalDiscount: number,
  tax: number,
): {
  subtotal: number;
  lineDiscountSum: number;
  globalApplied: number;
  discountTotal: number;
  afterDiscounts: number;
  taxTotal: number;
  total: number;
} {
  let gross = 0;
  let lineDiscountSum = 0;
  let netAfterLine = 0;

  for (const line of lines) {
    const lineGross = line.unitPrice * line.quantity;
    const rawDisc = line.lineDiscount ?? 0;
    const discount = Math.min(rawDisc, lineGross);
    const lineTotal = lineGross - discount;
    gross += lineGross;
    lineDiscountSum += discount;
    netAfterLine += lineTotal;
  }

  const rawGlobal = globalDiscount ?? 0;
  const globalApplied = Math.min(rawGlobal, Math.max(netAfterLine, 0));
  const discountTotal = lineDiscountSum + globalApplied;
  const subtotal = gross;
  const afterDiscounts = Math.max(subtotal - discountTotal, 0);
  const taxTotal = Math.max(tax ?? 0, 0);
  const total = afterDiscounts + taxTotal;

  return { subtotal, lineDiscountSum, globalApplied, discountTotal, afterDiscounts, taxTotal, total };
}

export function productToCartLine(p: Product): Omit<CartLine, 'quantity' | 'lineDiscount'> {
  return {
    productId: p.id,
    name: p.name,
    barcode: p.barcode,
    sku: p.sku,
    unitPrice: Number(p.sellingPrice),
    stockAvailable: p.quantity,
    minStock: p.minStock,
  };
}

export function stockWarning(line: CartLine): 'none' | 'low' | 'out' {
  if (line.quantity > line.stockAvailable) return 'out';
  const remaining = line.stockAvailable - line.quantity;
  if (remaining <= line.minStock) return 'low';
  return 'none';
}
