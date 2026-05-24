import type { SaleDetail } from '@/types/sales-history';

export function refundedQtyBySaleItem(sale: SaleDetail): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of sale.refunds ?? []) {
    for (const ri of r.items) {
      m.set(ri.saleItemId, (m.get(ri.saleItemId) ?? 0) + ri.quantity);
    }
  }
  return m;
}

export function remainingItemQty(sale: SaleDetail): Map<string, number> {
  const refunded = refundedQtyBySaleItem(sale);
  const m = new Map<string, number>();
  for (const it of sale.items) {
    const already = refunded.get(it.id) ?? 0;
    m.set(it.id, Math.max(0, it.quantity - already));
  }
  return m;
}
