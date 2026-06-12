import axios from 'axios';
import { createSale } from '@/api/sales.api';
import { IS_DESKTOP_APP } from '@/lib/env';
import { useAuthStore } from '@/stores/auth-store';
import { useConnectivityStore, noteApiUnreachable } from '@/stores/connectivity-store';
import { persistOfflineSale } from '@/offline/offline-write-sale';
import type { CreateSaleBody, CreatedSale } from '@/types/sales';

export function isLikelyNetworkFailure(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false;
  if (error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK') return true;
  if (!error.response) return true;
  const s = error.response.status;
  return s >= 502 || s === 504;
}

/**
 * Online-first sale creation. Uses the API when reachable; otherwise (or on network failure)
 * persists via IndexedDB and the offline sync queue.
 *
 * Packaged desktop never uses the IndexedDB queue: the local NestJS
 * backend on 127.0.0.1:3001 IS the source of truth, so we always call
 * the API directly and let errors propagate so the cashier sees them.
 */
export async function submitPosSale(body: CreateSaleBody): Promise<CreatedSale> {
  const cashier = useAuthStore.getState().user;
  if (!cashier) throw new Error('Not signed in');

  if (IS_DESKTOP_APP) {
    return createSale(body);
  }

  if (useConnectivityStore.getState().shouldUseOfflineSales()) {
    return persistOfflineSale(body, cashier);
  }

  try {
    const sale = await createSale(body);
    return sale;
  } catch (e) {
    if (isLikelyNetworkFailure(e)) {
      noteApiUnreachable();
      return persistOfflineSale(body, cashier);
    }
    throw e;
  }
}
