import { posOfflineDb } from '@/offline/pos-db';

/** Offline queue rows that still need server reconciliation (anything except fully synced). */
export async function countUnsyncedOfflineSaleQueue(): Promise<number> {
  return posOfflineDb.offlineSaleQueue.filter((r) => r.status !== 'synced').count();
}
