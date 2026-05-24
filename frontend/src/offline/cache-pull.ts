import { fetchProducts } from '@/api/products.api';
import { fetchCategories } from '@/api/categories.api';
import { fetchStoreSettings } from '@/api/settings.api';
import { fetchUsers } from '@/api/users.api';
import { fetchSales } from '@/api/sales.api';
import { fetchSuppliers } from '@/api/suppliers.api';
import type { Product } from '@/types/product';
import type { Category } from '@/types/category';
import type { StoreSettings } from '@/types/store-settings';
import type { AdminUser } from '@/types/users-admin';
import type { CreatedSale } from '@/types/sales';
import type { Supplier } from '@/types/supplier';
import { posOfflineDb } from '@/offline/pos-db';

const PRODUCT_PAGE_SIZE = 500;

export type PullCatalogOptions = {
  /** When true, also cache users list (admin screens). */
  includeUsers?: boolean;
  /** When true, append recent server sales for local reference. */
  includeRecentSales?: boolean;
};

async function pullAllProducts(): Promise<Product[]> {
  const all: Product[] = [];
  let page = 1;
  for (;;) {
    const res = await fetchProducts({ page, limit: PRODUCT_PAGE_SIZE });
    all.push(...res.data);
    if (page >= res.meta.totalPages) break;
    page += 1;
    if (page > 200) break;
  }
  return all;
}

/**
 * Refreshes local IndexedDB from the API. Call when online after login or after successful sync.
 */
export async function pullOfflineCatalog(opts?: PullCatalogOptions): Promise<void> {
  const settings = await fetchStoreSettings();
  const categoriesRes = await fetchCategories({ limit: 500, page: 1 });
  const products = await pullAllProducts();

  const suppliersRes = await fetchSuppliers({ limit: 500, page: 1, includeInactive: false });

  await posOfflineDb.transaction('rw', posOfflineDb.products, posOfflineDb.categories, posOfflineDb.settings, posOfflineDb.suppliers, async () => {
    await posOfflineDb.products.clear();
    const now = Date.now();
    await posOfflineDb.products.bulkPut(
      products.map((p) => ({
        id: p.id,
        payload: JSON.stringify(p),
        updatedAt: now,
      })),
    );

    await posOfflineDb.categories.clear();
    await posOfflineDb.categories.bulkPut(
      categoriesRes.data.map((c: Category) => ({
        id: c.id,
        payload: JSON.stringify(c),
        updatedAt: now,
      })),
    );

    await posOfflineDb.settings.put({
      key: 'store',
      payload: JSON.stringify(settings),
      updatedAt: now,
    });

    await posOfflineDb.suppliers.clear();
    await posOfflineDb.suppliers.bulkPut(
      suppliersRes.data.map((s: Supplier) => ({
        id: s.id,
        payload: JSON.stringify(s),
        updatedAt: now,
      })),
    );
  });

  if (opts?.includeUsers) {
    const usersRes = await fetchUsers({ page: 1, limit: 500 });
    const now = Date.now();
    await posOfflineDb.transaction('rw', posOfflineDb.users, async () => {
      await posOfflineDb.users.clear();
      await posOfflineDb.users.bulkPut(
        usersRes.data.map((u: AdminUser) => ({
          id: u.id,
          payload: JSON.stringify(u),
          updatedAt: now,
        })),
      );
    });
  }

  if (opts?.includeRecentSales) {
    const salesRes = await fetchSales({ page: 1, limit: 40 });
    const now = Date.now();
    await posOfflineDb.transaction('rw', posOfflineDb.recentSales, async () => {
      await posOfflineDb.recentSales.clear();
      for (const row of salesRes.data) {
        await posOfflineDb.recentSales.put({
          id: row.id,
          payload: JSON.stringify(row),
          savedAt: now,
        });
      }
    });
  }
}

export async function mergeProductsFromServerList(products: Product[]): Promise<void> {
  const now = Date.now();
  await posOfflineDb.transaction('rw', posOfflineDb.products, async () => {
    for (const p of products) {
      await posOfflineDb.products.put({
        id: p.id,
        payload: JSON.stringify(p),
        updatedAt: now,
      });
    }
  });
}

/** Append or replace a server sale in the recent-sales cache (e.g. after online checkout). */
export async function cacheRecentSaleSnapshot(sale: CreatedSale): Promise<void> {
  await posOfflineDb.recentSales.put({
    id: sale.id,
    payload: JSON.stringify(sale),
    savedAt: Date.now(),
  });
}

export async function readCachedStoreSettings(): Promise<StoreSettings | null> {
  const row = await posOfflineDb.settings.get('store');
  if (!row) return null;
  try {
    return JSON.parse(row.payload) as StoreSettings;
  } catch {
    return null;
  }
}
