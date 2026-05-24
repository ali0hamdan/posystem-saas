import Dexie, { type Table } from 'dexie';

/** Cached product row (full `Product` JSON in `payload`). */
export type CachedProductRow = {
  id: string;
  payload: string;
  updatedAt: number;
};

export type CachedCategoryRow = {
  id: string;
  payload: string;
  updatedAt: number;
};

export type CachedSettingsRow = {
  key: string;
  payload: string;
  updatedAt: number;
};

export type CachedUserRow = {
  id: string;
  payload: string;
  updatedAt: number;
};

export type RecentSaleRow = {
  id: string;
  payload: string;
  savedAt: number;
};

export type OfflineQueueStatus = 'pending' | 'syncing' | 'failed' | 'synced';

export type OfflineSaleQueueRow = {
  localId: string;
  status: OfflineQueueStatus;
  attempts: number;
  lastError: string | null;
  /** ms epoch — used for retry backoff */
  lastAttemptAt: number | null;
  nextRetryAt: number;
  createdAt: number;
  bodyJson: string;
  receiptSnapshotJson: string;
  offlineInvoiceNumber: string;
  conflictCode: string | null;
  serverSaleId: string | null;
};

export type SyncAuditOutcome = 'success' | 'failed_rollback' | 'failed_no_rollback';

export type SyncAuditLogRow = {
  id: string;
  at: number;
  localId: string;
  offlineInvoiceNumber: string;
  outcome: SyncAuditOutcome;
  detailJson: string;
};

export type CachedSupplierRow = {
  id: string;
  payload: string;
  updatedAt: number;
};

export type OfflinePurchaseQueueRow = {
  localId: string;
  action: 'create' | 'update';
  serverId: string | null;
  status: OfflineQueueStatus;
  attempts: number;
  lastError: string | null;
  lastAttemptAt: number | null;
  nextRetryAt: number;
  createdAt: number;
  bodyJson: string;
  localRef: string;
  supplierName: string;
};

class PosOfflineDb extends Dexie {
  products!: Table<CachedProductRow, string>;
  categories!: Table<CachedCategoryRow, string>;
  settings!: Table<CachedSettingsRow, string>;
  users!: Table<CachedUserRow, string>;
  recentSales!: Table<RecentSaleRow, string>;
  offlineSaleQueue!: Table<OfflineSaleQueueRow, string>;
  syncAuditLog!: Table<SyncAuditLogRow, string>;
  suppliers!: Table<CachedSupplierRow, string>;
  offlinePurchaseQueue!: Table<OfflinePurchaseQueueRow, string>;

  constructor() {
    super('pos-offline-v1');
    this.version(1).stores({
      products: 'id, updatedAt',
      categories: 'id, updatedAt',
      settings: 'key, updatedAt',
      users: 'id, updatedAt',
      recentSales: 'id, savedAt',
      offlineSaleQueue: 'localId, status, createdAt, nextRetryAt',
      syncAuditLog: 'id, at, localId',
    });
    this.version(2).stores({
      suppliers: 'id, updatedAt',
      offlinePurchaseQueue: 'localId, status, createdAt, nextRetryAt, action',
    });
  }
}

export const posOfflineDb = new PosOfflineDb();
