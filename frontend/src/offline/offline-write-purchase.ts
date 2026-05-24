import { posOfflineDb } from '@/offline/pos-db';
import type { CreatePurchaseOrderBody, UpdatePurchaseOrderBody } from '@/api/purchase-orders.api';

function generateOfflinePORef(): string {
  const rand = Math.floor(Math.random() * 900_000) + 100_000;
  return `OFF-PO-${rand}`;
}

export async function persistOfflinePurchaseOrder(
  body: CreatePurchaseOrderBody | UpdatePurchaseOrderBody,
  action: 'create' | 'update',
  serverId: string | null,
  supplierName: string,
): Promise<string> {
  const localId = crypto.randomUUID();
  const localRef = generateOfflinePORef();
  await posOfflineDb.offlinePurchaseQueue.add({
    localId,
    action,
    serverId,
    status: 'pending',
    attempts: 0,
    lastError: null,
    lastAttemptAt: null,
    nextRetryAt: 0,
    createdAt: Date.now(),
    bodyJson: JSON.stringify(body),
    localRef,
    supplierName,
  });
  return localRef;
}
