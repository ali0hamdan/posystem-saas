import type { Product } from '@/types/product';
import { posOfflineDb } from '@/offline/pos-db';
import { normalizeScanToken } from '@/features/pos/pos-scan';

export async function getCachedProductCount(): Promise<number> {
  return posOfflineDb.products.count();
}

export async function getAllCachedProducts(): Promise<Product[]> {
  const rows = await posOfflineDb.products.toArray();
  return rows.map((r) => JSON.parse(r.payload) as Product);
}

export async function getCachedProductById(id: string): Promise<Product | undefined> {
  const row = await posOfflineDb.products.get(id);
  if (!row) return undefined;
  return JSON.parse(row.payload) as Product;
}

/** Case-insensitive exact match on barcode or SKU. */
export async function getCachedProductByBarcodeOrSku(token: string): Promise<Product | undefined> {
  const q = normalizeScanToken(token);
  if (!q) return undefined;
  const rows = await posOfflineDb.products.toArray();
  for (const row of rows) {
    const p = JSON.parse(row.payload) as Product;
    if (normalizeScanToken(p.barcode) === q || normalizeScanToken(p.sku) === q) return p;
  }
  return undefined;
}

/** Server-style search: substring on name, exact-ish on barcode/sku. */
export async function searchCachedProducts(q: string, limit: number): Promise<Product[]> {
  const t = q.trim().toLowerCase();
  if (!t) return [];
  const rows = await posOfflineDb.products.toArray();
  const out: Product[] = [];
  for (const row of rows) {
    const p = JSON.parse(row.payload) as Product;
    const name = p.name.toLowerCase();
    const bc = normalizeScanToken(p.barcode);
    const sku = normalizeScanToken(p.sku);
    if (name.includes(t) || bc.includes(t) || sku.includes(t)) {
      out.push(p);
      if (out.length >= limit) break;
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
