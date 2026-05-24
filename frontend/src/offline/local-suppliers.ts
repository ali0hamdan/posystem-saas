import type { Supplier } from '@/types/supplier';
import { posOfflineDb } from '@/offline/pos-db';

export async function getAllCachedSuppliers(): Promise<Supplier[]> {
  const rows = await posOfflineDb.suppliers.toArray();
  return rows.map((r) => JSON.parse(r.payload) as Supplier);
}

export async function searchCachedSuppliers(q: string, limit = 50): Promise<Supplier[]> {
  const t = q.trim().toLowerCase();
  const rows = await posOfflineDb.suppliers.toArray();
  const out: Supplier[] = [];
  for (const row of rows) {
    const s = JSON.parse(row.payload) as Supplier;
    if (!t || s.name.toLowerCase().includes(t)) {
      out.push(s);
      if (out.length >= limit) break;
    }
  }
  return out;
}
