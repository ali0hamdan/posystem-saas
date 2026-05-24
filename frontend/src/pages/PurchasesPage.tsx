import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { CloudOff, Loader2, PackageCheck, Pencil, Plus, Printer, Search, Trash2, X } from 'lucide-react';
import {
  createPurchaseOrder,
  fetchPurchaseOrder,
  fetchPurchaseOrders,
  receivePurchaseOrder,
  updatePurchaseOrder,
  type CreatePurchaseOrderBody,
  type POLineInput,
  type PurchaseOrderDetail,
  type PurchaseOrderSummary,
  type PurchaseStatus,
  type UpdatePurchaseOrderBody,
} from '@/api/purchase-orders.api';
import { fetchSuppliers } from '@/api/suppliers.api';
import { fetchProducts } from '@/api/products.api';
import { getApiErrorMessage } from '@/api/client';
import { useDebouncedValue } from '@/features/products/use-debounced-value';
import { toLabelFields } from '@/features/product-labels/label-utils';
import { useStoreSettings } from '@/hooks/use-store-settings';
import { useConnectivityStore } from '@/stores/connectivity-store';
import { posOfflineDb } from '@/offline/pos-db';
import { getAllCachedSuppliers } from '@/offline/local-suppliers';
import { searchCachedProducts } from '@/offline/local-products';
import { persistOfflinePurchaseOrder } from '@/offline/offline-write-purchase';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { Product } from '@/types/product';
import type { Supplier } from '@/types/supplier';

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: '' | PurchaseStatus; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'ORDERED', label: 'Ordered' },
  { value: 'RECEIVED', label: 'Received' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const inputCls =
  'w-full rounded-lg border border-line bg-canvas px-3 py-2.5 text-sm text-ink outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-500/25';
const labelCls = 'mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-muted';

function canReceive(po: PurchaseOrderSummary | PurchaseOrderDetail): boolean {
  return po.status !== 'RECEIVED' && po.status !== 'CANCELLED';
}

function canEdit(po: PurchaseOrderSummary | PurchaseOrderDetail): boolean {
  return po.status === 'DRAFT' || po.status === 'ORDERED';
}

// ── PO form types ─────────────────────────────────────────────────────────────

type LineItem = {
  productId: string;
  productName: string;
  sku: string | null;
  quantity: number;
  costPrice: number;
};

type POFormMode =
  | { type: 'create' }
  | { type: 'edit'; order: PurchaseOrderDetail };

// ── PO Form (create + edit) ───────────────────────────────────────────────────

type POFormProps = {
  mode: POFormMode;
  onClose: () => void;
  onSaved: (id: string) => void;
};

function POForm({ mode, onClose, onSaved }: POFormProps) {
  const { formatMoney: fmt } = useStoreSettings();
  const qc = useQueryClient();
  const isOffline = useConnectivityStore((s) => s.shouldUseOfflineSales());

  // Supplier selector — API when online, IndexedDB when offline
  const [cachedSuppliers, setCachedSuppliers] = useState<Supplier[]>([]);
  useEffect(() => {
    if (isOffline) getAllCachedSuppliers().then(setCachedSuppliers).catch(() => {});
  }, [isOffline]);

  const suppliersQuery = useQuery({
    queryKey: ['suppliers', '', true],
    queryFn: () => fetchSuppliers({ includeInactive: false, limit: 200 }),
    enabled: !isOffline,
  });
  const suppliers = isOffline ? cachedSuppliers : (suppliersQuery.data?.data ?? []);

  // Pre-fill from existing order
  const initial = useMemo(() => {
    if (mode.type === 'edit') {
      const o = mode.order;
      return {
        supplierId: o.supplierId,
        status: o.status as 'DRAFT' | 'ORDERED',
        paidAmount: Number(o.paidAmount) || 0,
        lines: o.items.map<LineItem>((it) => ({
          productId: it.productId,
          productName: it.product.name,
          sku: it.product.sku ?? null,
          quantity: it.quantity,
          costPrice: Number(it.costPrice),
        })),
      };
    }
    return { supplierId: '', status: 'DRAFT' as const, paidAmount: 0, lines: [] as LineItem[] };
  }, [mode]);

  const [supplierId, setSupplierId] = useState(initial.supplierId);
  const [lines, setLines] = useState<LineItem[]>(initial.lines);
  const [status, setStatus] = useState<'DRAFT' | 'ORDERED'>(initial.status);
  const [paidAmount, setPaidAmount] = useState(initial.paidAmount);

  // Product search — API when online, IndexedDB when offline
  const [productSearch, setProductSearch] = useState('');
  const debouncedSearch = useDebouncedValue(productSearch, 300);

  const productQuery = useQuery({
    queryKey: ['products', 'po-search', debouncedSearch],
    queryFn: () => fetchProducts({ q: debouncedSearch.trim(), limit: 10, page: 1 }),
    enabled: debouncedSearch.trim().length >= 1 && !isOffline,
  });

  const [offlineProductResults, setOfflineProductResults] = useState<Product[]>([]);
  useEffect(() => {
    if (!isOffline || debouncedSearch.trim().length < 1) { setOfflineProductResults([]); return; }
    searchCachedProducts(debouncedSearch.trim(), 10).then(setOfflineProductResults).catch(() => {});
  }, [isOffline, debouncedSearch]);

  const productResults = isOffline ? offlineProductResults : (productQuery.data?.data ?? []);
  const productLoading = isOffline ? false : productQuery.isLoading;

  const addProduct = useCallback(
    (p: Product) => {
      setLines((prev) => {
        const existing = prev.find((l) => l.productId === p.id);
        if (existing) {
          return prev.map((l) =>
            l.productId === p.id ? { ...l, quantity: l.quantity + 1 } : l,
          );
        }
        return [
          ...prev,
          {
            productId: p.id,
            productName: p.name,
            sku: p.sku,
            quantity: 1,
            costPrice: Number(p.costPrice) || 0,
          },
        ];
      });
      setProductSearch('');
    },
    [],
  );

  const removeLine = (productId: string) =>
    setLines((prev) => prev.filter((l) => l.productId !== productId));

  const updateLine = (productId: string, field: 'quantity' | 'costPrice', raw: string) => {
    const val = parseFloat(raw);
    if (isNaN(val)) return;
    setLines((prev) =>
      prev.map((l) => (l.productId === productId ? { ...l, [field]: Math.max(0, val) } : l)),
    );
  };

  const orderTotal = lines.reduce((sum, l) => sum + l.quantity * l.costPrice, 0);

  // Mutations
  const createMutation = useMutation({
    mutationFn: (body: CreatePurchaseOrderBody) => createPurchaseOrder(body),
    onSuccess: (po) => {
      toast.success('Purchase order created');
      void qc.invalidateQueries({ queryKey: ['purchase-orders'] });
      onSaved(po.id);
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Could not create order')),
  });

  const updateMutation = useMutation({
    mutationFn: (body: UpdatePurchaseOrderBody) => {
      if (mode.type !== 'edit') throw new Error('unreachable');
      return updatePurchaseOrder(mode.order.id, body);
    },
    onSuccess: (po) => {
      toast.success('Purchase order updated');
      void qc.invalidateQueries({ queryKey: ['purchase-orders'] });
      void qc.invalidateQueries({ queryKey: ['purchase-order', po.id] });
      onSaved(po.id);
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Could not update order')),
  });

  const saving = createMutation.isPending || updateMutation.isPending;
  const [offlineSaving, setOfflineSaving] = useState(false);

  function handleSave() {
    if (!supplierId) { toast.error('Select a supplier.'); return; }
    if (!lines.length) { toast.error('Add at least one product.'); return; }
    const items: POLineInput[] = lines.map((l) => ({
      productId: l.productId,
      quantity: Math.max(1, Math.trunc(l.quantity)),
      costPrice: Math.max(0, l.costPrice),
    }));

    if (isOffline) {
      const supplierName = suppliers.find((s) => s.id === supplierId)?.name ?? supplierId;
      const body: CreatePurchaseOrderBody | UpdatePurchaseOrderBody = {
        supplierId, items, status, paidAmount: paidAmount || undefined,
      };
      setOfflineSaving(true);
      persistOfflinePurchaseOrder(body, mode.type === 'create' ? 'create' : 'update', mode.type === 'edit' ? mode.order.id : null, supplierName)
        .then((localRef) => {
          toast.info(`Order saved offline as ${localRef} — will sync when connected.`);
          onSaved(`offline:${localRef}`);
        })
        .catch(() => toast.error('Could not save order offline'))
        .finally(() => setOfflineSaving(false));
      return;
    }

    if (mode.type === 'create') {
      createMutation.mutate({ supplierId, items, status, paidAmount: paidAmount || undefined });
    } else {
      updateMutation.mutate({ supplierId, items, status, paidAmount: paidAmount || undefined });
    }
  }

  const anySaving = saving || offlineSaving;
  const title = mode.type === 'create' ? 'New purchase order' : 'Edit purchase order';

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto p-4 py-8">
      <button
        type="button"
        className="fixed inset-0 bg-ink/40 backdrop-blur-[2px]"
        aria-label="Close"
        onClick={() => !anySaving && onClose()}
      />
      <div className="relative z-[101] w-full max-w-3xl rounded-2xl border border-line bg-surface shadow-panel">
        {/* Offline banner */}
        {isOffline ? (
          <div className="flex items-center gap-2 rounded-t-2xl bg-warning-50 px-6 py-2.5 text-sm text-warning-700 border-b border-warning-200">
            <CloudOff className="h-4 w-4 shrink-0" />
            You are offline. This order will be queued and synced automatically when you reconnect.
          </div>
        ) : null}
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
          <button
            type="button"
            onClick={() => !anySaving && onClose()}
            className="rounded p-1.5 text-ink-faint hover:bg-canvas hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-6 p-6">
          {/* Supplier + Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Supplier *</label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className={inputCls}
              >
                <option value="">Select supplier…</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'DRAFT' | 'ORDERED')}
                className={inputCls}
              >
                <option value="DRAFT">Draft</option>
                <option value="ORDERED">Ordered</option>
              </select>
            </div>
          </div>

          {/* Product search */}
          <div>
            <label className={labelCls}>Add product</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
              <input
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Search by name, SKU, or barcode…"
                className="w-full rounded-lg border border-line bg-canvas py-2.5 pl-10 pr-3 text-sm text-ink outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-500/25"
              />
            </div>
            {debouncedSearch.trim().length >= 1 ? (
              <ul className="mt-1.5 max-h-48 space-y-0.5 overflow-y-auto rounded-lg border border-line bg-canvas p-1.5">
                {productLoading ? (
                  <li className="px-2 py-2 text-sm text-ink-muted">Searching…</li>
                ) : !productResults.length ? (
                  <li className="px-2 py-2 text-sm text-ink-muted">No matches.</li>
                ) : (
                  productResults.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => addProduct(p)}
                        className="flex w-full flex-col rounded-md px-2 py-2 text-left text-sm text-ink hover:bg-surface"
                      >
                        <span className="font-medium">{p.name}</span>
                        <span className="text-xs text-ink-faint">
                          {p.sku ? `SKU ${p.sku}` : '—'} · Cost {fmt(p.costPrice)}
                        </span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            ) : null}
          </div>

          {/* Line items */}
          {lines.length > 0 ? (
            <div>
              <label className={labelCls}>Order lines ({lines.length})</label>
              <div className="overflow-hidden rounded-lg border border-line">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-line bg-canvas text-xs font-semibold uppercase tracking-wide text-ink-faint">
                    <tr>
                      <th className="px-3 py-2">Product</th>
                      <th className="px-3 py-2 w-24">Qty</th>
                      <th className="px-3 py-2 w-28">Cost / unit</th>
                      <th className="px-3 py-2 text-right w-24">Total</th>
                      <th className="px-3 py-2 w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {lines.map((l) => (
                      <tr key={l.productId}>
                        <td className="px-3 py-2 text-ink">
                          <div className="font-medium">{l.productName}</div>
                          {l.sku ? <div className="text-xs text-ink-faint">SKU {l.sku}</div> : null}
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min={1}
                            max={1000000}
                            value={l.quantity}
                            onChange={(e) => updateLine(l.productId, 'quantity', e.target.value)}
                            className="w-20 rounded border border-line bg-canvas px-2 py-1 text-sm text-ink outline-none focus:border-primary-400"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={l.costPrice}
                            onChange={(e) => updateLine(l.productId, 'costPrice', e.target.value)}
                            className="w-24 rounded border border-line bg-canvas px-2 py-1 text-sm text-ink outline-none focus:border-primary-400"
                          />
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-ink">
                          {fmt(l.quantity * l.costPrice)}
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => removeLine(l.productId)}
                            className="rounded p-1 text-ink-faint hover:text-danger-600"
                            aria-label="Remove line"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-line bg-canvas">
                    <tr>
                      <td colSpan={3} className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-ink-faint">
                        Order total
                      </td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums text-ink">
                        {fmt(orderTotal)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ) : (
            <p className="text-sm text-ink-muted">No lines yet. Search and add products above.</p>
          )}

          {/* Paid amount */}
          <div className="max-w-xs">
            <label className={labelCls}>Amount paid</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={paidAmount}
              onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
              className={inputCls}
              placeholder="0.00"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-line px-6 py-4">
          <Button type="button" variant="secondary" disabled={anySaving} onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="primary" disabled={anySaving} onClick={handleSave} className="gap-2">
            {anySaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {mode.type === 'create' ? (isOffline ? 'Save offline' : 'Create order') : (isOffline ? 'Save offline' : 'Save changes')}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function PurchasesPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { formatMoney: fmt } = useStoreSettings();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<'' | PurchaseStatus>('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [updateCosts, setUpdateCosts] = useState(true);
  const [formMode, setFormMode] = useState<POFormMode | null>(null);

  const offlinePurchaseQueue = useLiveQuery(
    () => posOfflineDb.offlinePurchaseQueue.orderBy('createdAt').reverse().toArray(),
    [],
    [],
  );

  const listQuery = useQuery({
    queryKey: ['purchase-orders', page, status],
    queryFn: () => fetchPurchaseOrders({ page, limit: 15, ...(status ? { status } : {}) }),
  });

  const detailQuery = useQuery({
    queryKey: ['purchase-order', selectedId],
    queryFn: () => fetchPurchaseOrder(selectedId!),
    enabled: Boolean(selectedId),
  });

  const receiveMutation = useMutation({
    mutationFn: (id: string) => receivePurchaseOrder(id, { updateProductCostPrices: updateCosts }),
    onSuccess: (received: PurchaseOrderDetail) => {
      toast.success('Purchase order received');
      void queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      void queryClient.invalidateQueries({ queryKey: ['purchase-order', received.id] });
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      setReceiveOpen(false);
      const rows = received.items.map((it) => ({
        product: toLabelFields({
          id: it.product.id,
          name: it.product.name,
          sku: it.product.sku,
          barcode: it.product.barcode,
          sellingPrice: it.product.sellingPrice ?? 0,
        }),
        quantity: it.quantity,
      }));
      toast.custom(
        (id) => (
          <div className="flex max-w-sm flex-col gap-2 rounded-lg border border-line bg-surface px-4 py-3 text-sm text-ink shadow-card">
            <p>Stock updated. Print shelf labels for received lines?</p>
            <div className="flex gap-2">
              <button
                type="button"
                className="inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-primary-600 px-3 py-2 font-medium text-white hover:bg-primary-500"
                onClick={() => {
                  toast.dismiss(id);
                  navigate('/product-labels', { state: { initialRows: rows } });
                }}
              >
                <Printer className="h-3.5 w-3.5" />
                Print labels
              </button>
              <button
                type="button"
                className="rounded-md border border-line px-3 py-2 text-ink-muted hover:bg-canvas"
                onClick={() => toast.dismiss(id)}
              >
                Dismiss
              </button>
            </div>
          </div>
        ),
        { duration: 20_000 },
      );
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Receive failed'));
    },
  });

  const rows = listQuery.data?.data ?? [];
  const meta = listQuery.data?.meta;
  const selected = detailQuery.data;
  const totalPages = meta?.totalPages ?? 0;
  const detailLines = useMemo(() => selected?.items ?? [], [selected]);

  function handleFormSaved(id: string) {
    setFormMode(null);
    if (!id.startsWith('offline:')) setSelectedId(id);
  }

  function openEdit() {
    if (!selected) return;
    setFormMode({ type: 'edit', order: selected });
  }

  return (
    <div className="mx-auto max-w-[1200px] space-y-6 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink md:text-3xl">Purchase orders</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Create orders, receive stock into inventory, then optionally print product labels.
          </p>
        </div>
        <Button
          type="button"
          variant="primary"
          onClick={() => setFormMode({ type: 'create' })}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          New order
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-line bg-surface p-4 shadow-card">
        <div>
          <label htmlFor="po-status" className="mb-1 block text-xs font-semibold uppercase text-ink-faint">
            Status
          </label>
          <select
            id="po-status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as '' | PurchaseStatus);
              setPage(1);
            }}
            className="rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-500/25"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.label} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          {/* Offline queue badge */}
          {offlinePurchaseQueue.length > 0 ? (
            <div className="mb-3 overflow-hidden rounded-xl border border-warning-200 bg-warning-50 shadow-card">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-warning-200">
                <CloudOff className="h-4 w-4 text-warning-600 shrink-0" />
                <span className="text-sm font-medium text-warning-700">
                  {offlinePurchaseQueue.length} order{offlinePurchaseQueue.length > 1 ? 's' : ''} queued for sync
                </span>
              </div>
              <ul className="divide-y divide-warning-100">
                {offlinePurchaseQueue.map((q) => (
                  <li key={q.localId} className="px-4 py-2.5 text-sm">
                    <span className="font-mono text-xs font-medium text-warning-600">{q.localRef}</span>
                    <span className="ml-2 text-ink">{q.supplierName}</span>
                    <span className="ml-2 capitalize text-xs text-ink-faint">{q.status}</span>
                    {q.lastError ? <span className="ml-2 text-xs text-danger-600 truncate">{q.lastError}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
            {listQuery.isLoading ? (
              <div className="flex items-center justify-center gap-2 p-8 text-ink-muted">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading…
              </div>
            ) : listQuery.isError ? (
              <p className="p-6 text-sm text-danger-700">{getApiErrorMessage(listQuery.error, 'Could not load orders.')}</p>
            ) : !rows.length ? (
              <p className="p-6 text-sm text-ink-muted">No purchase orders for this branch.</p>
            ) : (
              <ul className="divide-y divide-line">
                {rows.map((po) => (
                  <li key={po.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(po.id)}
                      className={cn(
                        'flex w-full flex-col gap-1 px-4 py-3 text-left transition hover:bg-canvas',
                        selectedId === po.id && 'bg-primary-50 ring-1 ring-inset ring-primary-200',
                      )}
                    >
                      <span className="text-xs font-mono text-ink-faint">{po.id.slice(0, 8)}…</span>
                      <span className="font-medium text-ink">{po.supplier.name}</span>
                      <span className="text-xs text-ink-muted">
                        {po.status} · {po._count.items} lines · {fmt(po.total)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {totalPages > 1 ? (
              <div className="flex items-center justify-between border-t border-line px-4 py-2 text-sm text-ink-muted">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded px-2 py-1 hover:bg-canvas disabled:opacity-40"
                >
                  Prev
                </button>
                <span>
                  Page {page} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded px-2 py-1 hover:bg-canvas disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="lg:col-span-3">
          <div className="min-h-[280px] rounded-xl border border-line bg-surface p-5 shadow-card">
            {!selectedId ? (
              <p className="text-sm text-ink-muted">Select an order to view lines and receive.</p>
            ) : detailQuery.isLoading ? (
              <div className="flex items-center gap-2 text-ink-muted">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading order…
              </div>
            ) : detailQuery.isError ? (
              <p className="text-sm text-danger-700">{getApiErrorMessage(detailQuery.error, 'Could not load order.')}</p>
            ) : !selected ? (
              <p className="text-sm text-ink-muted">Order not found.</p>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg font-semibold text-ink">{selected.supplier.name}</h2>
                    <p className="mt-1 text-xs text-ink-faint">
                      Status: <span className="text-ink-muted">{selected.status}</span> · Total {fmt(selected.total)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {canEdit(selected) ? (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={openEdit}
                        className="gap-2"
                        size="sm"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                    ) : null}
                    {canReceive(selected) ? (
                      <Button
                        type="button"
                        variant="primary"
                        onClick={() => setReceiveOpen(true)}
                        disabled={receiveMutation.isPending}
                        className="gap-2"
                        size="sm"
                      >
                        <PackageCheck className="h-3.5 w-3.5" />
                        Receive into stock
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="overflow-x-auto rounded-lg border border-line">
                  <table className="w-full min-w-[320px] text-left text-sm">
                    <thead className="border-b border-line bg-canvas text-xs font-semibold uppercase tracking-wide text-ink-faint">
                      <tr>
                        <th className="px-3 py-2">Product</th>
                        <th className="px-3 py-2 text-right">Qty</th>
                        <th className="px-3 py-2 text-right">Cost</th>
                        <th className="px-3 py-2 text-right">Line</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {detailLines.map((ln) => (
                        <tr key={ln.id}>
                          <td className="px-3 py-2 text-ink">{ln.product.name}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-ink">{ln.quantity}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-ink-muted">{fmt(ln.costPrice)}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-ink">{fmt(ln.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Receive confirm dialog */}
      {receiveOpen && selected ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
            aria-label="Close"
            onClick={() => !receiveMutation.isPending && setReceiveOpen(false)}
          />
          <div className="relative z-[101] w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-panel">
            <h3 className="font-display text-lg font-semibold text-ink">Receive purchase order</h3>
            <p className="mt-2 text-sm text-ink-muted">
              Stock will be increased for each line. You can print barcode labels afterward from the toast action.
            </p>
            <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                className="rounded border-line"
                checked={updateCosts}
                onChange={(e) => setUpdateCosts(e.target.checked)}
              />
              Update each product&apos;s cost price from this order
            </label>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={receiveMutation.isPending}
                onClick={() => setReceiveOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={receiveMutation.isPending}
                onClick={() => receiveMutation.mutate(selected.id)}
                className="gap-2"
              >
                {receiveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Confirm receive
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Create / Edit PO modal */}
      {formMode ? (
        <POForm mode={formMode} onClose={() => setFormMode(null)} onSaved={handleFormSaved} />
      ) : null}
    </div>
  );
}
