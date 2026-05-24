import { createSale } from '@/api/sales.api';
import { createPurchaseOrder, updatePurchaseOrder } from '@/api/purchase-orders.api';
import type { CreatePurchaseOrderBody, UpdatePurchaseOrderBody } from '@/api/purchase-orders.api';
import { getApiErrorMessage, getAxiosErrorCode } from '@/api/client';
import { reportElectronSyncFailure } from '@/lib/electron-diagnostics-bridge';
import { posOfflineDb } from '@/offline/pos-db';
import { rollbackOfflineSaleStock } from '@/offline/offline-write-sale';
import { pullOfflineCatalog } from '@/offline/cache-pull';
import type { CreateSaleBody } from '@/types/sales';
import { useConnectivityStore } from '@/stores/connectivity-store';

const ROLLBACK_CODES = new Set(['INSUFFICIENT_STOCK', 'PRODUCT_INACTIVE', 'PRODUCT_NOT_FOUND']);

let syncMutex = false;

async function loadRunnableQueueRows() {
  const now = Date.now();
  const rows = await posOfflineDb.offlineSaleQueue.toArray();
  return rows
    .filter((r) => (r.status === 'pending' || r.status === 'failed') && r.nextRetryAt <= now)
    .sort((a, b) => a.createdAt - b.createdAt);
}

/**
 * Pushes pending/failed offline sales to the server (FIFO). Refreshes the local product cache after a run.
 */
export async function processOfflineSaleSyncQueue(): Promise<void> {
  if (syncMutex) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  if (useConnectivityStore.getState().serverReachable === false) return;

  const runnable = await loadRunnableQueueRows();
  if (runnable.length === 0) return;

  syncMutex = true;
  useConnectivityStore.getState().setSyncRunning(true);
  let hadFailures = false;

  try {
    for (const row of runnable) {
      const current = await posOfflineDb.offlineSaleQueue.get(row.localId);
      if (!current || current.status === 'synced') continue;

      await posOfflineDb.offlineSaleQueue.update(row.localId, {
        status: 'syncing',
        lastAttemptAt: Date.now(),
      });

      const body = JSON.parse(row.bodyJson) as CreateSaleBody;
      try {
        const sale = await createSale(body);
        await posOfflineDb.offlineSaleQueue.delete(row.localId);
        await posOfflineDb.syncAuditLog.add({
          id: crypto.randomUUID(),
          at: Date.now(),
          localId: row.localId,
          offlineInvoiceNumber: row.offlineInvoiceNumber,
          outcome: 'success',
          detailJson: JSON.stringify({
            message: 'Offline sale synced to server',
            serverSaleId: sale.id,
            serverInvoiceNumber: sale.invoiceNumber,
            priorOfflineInvoice: row.offlineInvoiceNumber,
          }),
        });
      } catch (e) {
        hadFailures = true;
        const code = getAxiosErrorCode(e);
        const msg = getApiErrorMessage(e, 'Sync failed');
        reportElectronSyncFailure({ localId: row.localId, message: msg, code });
        const shouldRollback = Boolean(code && ROLLBACK_CODES.has(code));
        if (shouldRollback) {
          await rollbackOfflineSaleStock(body);
        }
        const currentRow = await posOfflineDb.offlineSaleQueue.get(row.localId);
        const attempts = (currentRow?.attempts ?? row.attempts) + 1;
        const backoff = Math.min(120_000, 2000 * 2 ** Math.min(attempts, 8));
        await posOfflineDb.offlineSaleQueue.update(row.localId, {
          status: 'failed',
          lastError: msg,
          conflictCode: code ?? null,
          attempts,
          nextRetryAt: Date.now() + backoff,
        });
        await posOfflineDb.syncAuditLog.add({
          id: crypto.randomUUID(),
          at: Date.now(),
          localId: row.localId,
          offlineInvoiceNumber: row.offlineInvoiceNumber,
          outcome: shouldRollback ? 'failed_rollback' : 'failed_no_rollback',
          detailJson: JSON.stringify({ message: msg, code: code ?? null }),
        });
      }
    }
  } finally {
    syncMutex = false;
    useConnectivityStore.getState().setSyncRunning(false);
    useConnectivityStore.getState().markSyncFinished(hadFailures);
    try {
      await pullOfflineCatalog();
    } catch {
      /* catalog refresh is best-effort */
    }
  }
}

let purchaseSyncMutex = false;

export async function processOfflinePurchaseQueue(): Promise<void> {
  if (purchaseSyncMutex) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  if (useConnectivityStore.getState().serverReachable === false) return;

  const now = Date.now();
  const rows = await posOfflineDb.offlinePurchaseQueue.toArray();
  const runnable = rows
    .filter((r) => (r.status === 'pending' || r.status === 'failed') && r.nextRetryAt <= now)
    .sort((a, b) => a.createdAt - b.createdAt);

  if (runnable.length === 0) return;

  purchaseSyncMutex = true;
  try {
    for (const row of runnable) {
      const current = await posOfflineDb.offlinePurchaseQueue.get(row.localId);
      if (!current || current.status === 'synced') continue;

      await posOfflineDb.offlinePurchaseQueue.update(row.localId, {
        status: 'syncing',
        lastAttemptAt: Date.now(),
      });

      try {
        const body = JSON.parse(row.bodyJson);
        if (row.action === 'create') {
          await createPurchaseOrder(body as CreatePurchaseOrderBody);
        } else if (row.action === 'update' && row.serverId) {
          await updatePurchaseOrder(row.serverId, body as UpdatePurchaseOrderBody);
        }
        await posOfflineDb.offlinePurchaseQueue.delete(row.localId);
      } catch (e) {
        const msg = getApiErrorMessage(e, 'Purchase order sync failed');
        const currentRow = await posOfflineDb.offlinePurchaseQueue.get(row.localId);
        const attempts = (currentRow?.attempts ?? row.attempts) + 1;
        const backoff = Math.min(120_000, 2000 * 2 ** Math.min(attempts, 8));
        await posOfflineDb.offlinePurchaseQueue.update(row.localId, {
          status: 'failed',
          lastError: msg,
          attempts,
          nextRetryAt: Date.now() + backoff,
        });
      }
    }
  } finally {
    purchaseSyncMutex = false;
  }
}

export async function resetOfflineQueueEntryForRetry(localId: string): Promise<void> {
  await posOfflineDb.offlineSaleQueue.update(localId, {
    status: 'pending',
    nextRetryAt: 0,
    lastError: null,
    conflictCode: null,
  });
}

export async function deleteOfflineQueueEntry(localId: string): Promise<void> {
  await posOfflineDb.offlineSaleQueue.delete(localId);
}
