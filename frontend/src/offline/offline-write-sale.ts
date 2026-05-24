import { computePosTotals, productToCartLine, type CartLine } from '@/features/pos/pos-totals';
import type { CreateSaleBody, CreatedSale } from '@/types/sales';
import type { Product } from '@/types/product';
import type { AuthUser } from '@/types/auth';
import { posOfflineDb } from '@/offline/pos-db';
import { getCachedProductById } from '@/offline/local-products';
import { useBranchStore } from '@/stores/branch-store';

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function buildOfflineInvoiceNumber(): string {
  const part = crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase();
  return `OFF-${Date.now().toString(36).toUpperCase()}-${part}`;
}

function paymentStatusLabel(paid: number, total: number): string {
  const t = round2(total);
  const p = round2(paid);
  if (p <= 0) return 'UNPAID';
  if (p >= t - 0.001) return 'PAID';
  return 'PARTIAL';
}

function aggregateNeedByProduct(body: CreateSaleBody): Map<string, number> {
  const m = new Map<string, number>();
  for (const it of body.items) {
    m.set(it.productId, (m.get(it.productId) ?? 0) + it.quantity);
  }
  return m;
}

export type OfflineReceiptSnapshot = {
  offlineInvoiceNumber: string;
  createdAt: string;
  cashier: NonNullable<CreatedSale['cashier']>;
  items: CreatedSale['items'];
  payments: CreatedSale['payments'];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  paymentStatus: string;
  branchName: string | null;
};

function buildCartLines(body: CreateSaleBody, productById: Map<string, Product>): CartLine[] {
  return body.items.map((it) => {
    const p = productById.get(it.productId);
    if (!p) throw new Error(`Unknown product: ${it.productId}`);
    const base = productToCartLine(p);
    return {
      ...base,
      quantity: it.quantity,
      lineDiscount: it.discount ?? 0,
      stockAvailable: p.quantity,
      minStock: p.minStock,
    };
  });
}

function buildCreatedSaleFromSnapshot(snap: OfflineReceiptSnapshot, localId: string): CreatedSale {
  return {
    id: `local-${localId}`,
    invoiceNumber: snap.offlineInvoiceNumber,
    subtotal: snap.subtotal,
    discountTotal: snap.discountTotal,
    taxTotal: snap.taxTotal,
    total: snap.total,
    paymentStatus: snap.paymentStatus,
    createdAt: snap.createdAt,
    items: snap.items,
    payments: snap.payments,
    cashier: snap.cashier,
    branch: snap.branchName ? { name: snap.branchName } : null,
  };
}

/**
 * Persists an offline sale: validates cache, decrements local stock, enqueues for sync.
 * @throws Error with user-facing message when catalog or stock is invalid.
 */
export async function persistOfflineSale(body: CreateSaleBody, cashier: AuthUser): Promise<CreatedSale> {
  const count = await posOfflineDb.products.count();
  if (count < 1) {
    throw new Error('Product catalog is not available offline. Connect once while online to download data.');
  }

  const need = aggregateNeedByProduct(body);
  const productById = new Map<string, Product>();
  for (const pid of need.keys()) {
    const p = await getCachedProductById(pid);
    if (!p) {
      throw new Error(`Product "${pid}" is missing from the offline catalog. Refresh while online.`);
    }
    productById.set(pid, p);
  }

  for (const [pid, qty] of need) {
    const p = productById.get(pid)!;
    if (!p.isActive) {
      throw new Error(`Product is inactive: ${p.name}`);
    }
    if (p.quantity < qty) {
      throw new Error(`Insufficient stock for ${p.name} (offline). Available: ${p.quantity}, needed: ${qty}.`);
    }
  }

  const cartLines = buildCartLines(body, productById);
  const totals = computePosTotals(cartLines, body.globalDiscount ?? 0, body.tax ?? 0);
  const payments = body.payments ?? [];
  const paidSum = payments.reduce((s, r) => s + r.amount, 0);

  const realMoneyPaid = payments.filter((p) => p.method !== 'CREDIT').reduce((s, p) => s + p.amount, 0);
  const receivable = Math.max(0, round2(totals.total - realMoneyPaid));
  const hasCreditPayment = payments.some((p) => p.method === 'CREDIT');
  if (hasCreditPayment || receivable >= 0.01) {
    throw new Error(
      'Recording sales on customer credit requires the live server. Pay the full total with cash or card while offline, or reconnect.',
    );
  }

  const { selectedBranchId, branches } = useBranchStore.getState();
  const branchName = branches.find((b) => b.id === selectedBranchId)?.name ?? null;

  const snap: OfflineReceiptSnapshot = {
    offlineInvoiceNumber: buildOfflineInvoiceNumber(),
    createdAt: new Date().toISOString(),
    cashier: {
      id: cashier.id,
      name: cashier.name,
      username: cashier.username,
      role: cashier.role,
    },
    items: body.items.map((it, idx) => {
      const p = productById.get(it.productId)!;
      const line = cartLines[idx]!;
      const g = line.unitPrice * line.quantity;
      const disc = Math.min(line.lineDiscount, g);
      const total = g - disc;
      return {
        id: `off-item-${idx}-${it.productId}`,
        productId: it.productId,
        quantity: it.quantity,
        unitPrice: line.unitPrice,
        discount: disc,
        total,
        product: {
          id: p.id,
          name: p.name,
          sku: p.sku,
          barcode: p.barcode,
        },
      };
    }),
    payments: payments.map((pay, i) => ({
      id: `off-pay-${i}`,
      method: pay.method,
      amount: pay.amount,
    })),
    subtotal: totals.subtotal,
    discountTotal: totals.discountTotal,
    taxTotal: totals.taxTotal,
    total: totals.total,
    paymentStatus: paymentStatusLabel(paidSum, totals.total),
    branchName,
  };

  const localId = crypto.randomUUID();
  const queueRow = {
    localId,
    status: 'pending' as const,
    attempts: 0,
    lastError: null as string | null,
    lastAttemptAt: null as number | null,
    nextRetryAt: 0,
    createdAt: Date.now(),
    bodyJson: JSON.stringify(body),
    receiptSnapshotJson: JSON.stringify(snap),
    offlineInvoiceNumber: snap.offlineInvoiceNumber,
    conflictCode: null as string | null,
    serverSaleId: null as string | null,
  };

  await posOfflineDb.transaction('rw', posOfflineDb.products, posOfflineDb.offlineSaleQueue, async () => {
    for (const [pid, qty] of need) {
      const row = await posOfflineDb.products.get(pid);
      if (!row) throw new Error('Catalog changed during checkout. Try again.');
      const p = JSON.parse(row.payload) as Product;
      const nextQty = p.quantity - qty;
      if (nextQty < 0) throw new Error(`Insufficient stock for ${p.name}`);
      await posOfflineDb.products.put({
        id: pid,
        payload: JSON.stringify({ ...p, quantity: nextQty }),
        updatedAt: Date.now(),
      });
    }
    await posOfflineDb.offlineSaleQueue.add(queueRow);
  });

  return buildCreatedSaleFromSnapshot(snap, localId);
}

/** Restore local stock after a failed server sync (conflict paths). */
export async function rollbackOfflineSaleStock(body: CreateSaleBody): Promise<void> {
  const need = aggregateNeedByProduct(body);
  await posOfflineDb.transaction('rw', posOfflineDb.products, async () => {
    for (const [pid, qty] of need) {
      const row = await posOfflineDb.products.get(pid);
      if (!row) continue;
      const p = JSON.parse(row.payload) as Product;
      await posOfflineDb.products.put({
        id: pid,
        payload: JSON.stringify({ ...p, quantity: p.quantity + qty }),
        updatedAt: Date.now(),
      });
    }
  });
}

export { buildCreatedSaleFromSnapshot };
