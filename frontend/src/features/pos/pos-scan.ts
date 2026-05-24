import type { Product } from '@/types/product';

/** Normalize barcode / SKU / scan input for comparison. */
export function normalizeScanToken(s: string | null | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

/** First product whose barcode or SKU equals the token (case-insensitive, trimmed). */
export function findProductByExactBarcodeOrSku(products: Product[], token: string): Product | undefined {
  const q = normalizeScanToken(token);
  if (!q) return undefined;
  return products.find(
    (p) => normalizeScanToken(p.barcode) === q || normalizeScanToken(p.sku) === q,
  );
}
