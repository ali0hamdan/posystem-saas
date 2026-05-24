import type { Product } from '@/types/product';

export type ProductLabelFields = Pick<Product, 'id' | 'name' | 'sku' | 'barcode' | 'sellingPrice'>;

export function toLabelFields(p: Product | ProductLabelFields): ProductLabelFields {
  return {
    id: p.id,
    name: p.name,
    sku: p.sku,
    barcode: p.barcode,
    sellingPrice: p.sellingPrice,
  };
}

/**
 * Value encoded in the barcode: prefer product barcode, then SKU, then a stable fallback.
 */
export function resolveLabelBarcodeValue(p: ProductLabelFields): string {
  const bc = p.barcode?.trim();
  if (bc) return bc;
  const sku = p.sku?.trim();
  if (sku) return sku;
  return `ID${p.id.replace(/-/g, '').slice(0, 12).toUpperCase()}`;
}

export function expandLabelSlots(rows: { product: ProductLabelFields; quantity: number }[]): ProductLabelFields[] {
  const out: ProductLabelFields[] = [];
  for (const r of rows) {
    const q = Math.min(500, Math.max(1, Math.trunc(Number(r.quantity)) || 1));
    for (let i = 0; i < q; i += 1) {
      out.push(r.product);
    }
  }
  return out;
}

export function gridColumnCount(
  sheetWidthMm: number,
  sheetMarginMm: number,
  labelWidthMm: number,
  gapMm: number,
): number {
  const usable = Math.max(labelWidthMm, sheetWidthMm - sheetMarginMm * 2);
  return Math.max(1, Math.floor((usable + gapMm) / (labelWidthMm + gapMm)));
}
