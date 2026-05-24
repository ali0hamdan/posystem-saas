import { useCallback, useEffect, useId, useMemo, useReducer, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Banknote,
  CreditCard,
  Landmark,
  Layers,
  Loader2,
  Minus,
  Plus,
  ScanLine,
  Search,
  ShoppingCart,
  Trash2,
  UserSearch,
  X,
} from 'lucide-react';
import { fetchProductByBarcode, fetchProducts } from '@/api/products.api';
import { fetchCustomer, fetchCustomers } from '@/api/customers.api';
import { validateCoupon, type CouponValidation } from '@/api/coupons.api';
import { getApiErrorMessage } from '@/api/client';
import { submitPosSale } from '@/offline/pos-submit-sale';
import { cacheRecentSaleSnapshot } from '@/offline/cache-pull';
import { getCachedProductByBarcodeOrSku, searchCachedProducts } from '@/offline/local-products';
import { useBranchStore } from '@/stores/branch-store';
import { useConnectivityStore } from '@/stores/connectivity-store';
import { usePosSaleSessionStore } from '@/stores/pos-sale-session-store';
import { useDebouncedValue } from '@/features/products/use-debounced-value';
import { computePosTotals, productToCartLine, stockWarning, type CartLine } from '@/features/pos/pos-totals';
import { findProductByExactBarcodeOrSku } from '@/features/pos/pos-scan';
import { PosReceiptModal } from '@/features/pos/PosReceiptModal';
import { cn } from '@/lib/utils';
import { useStoreSettings } from '@/hooks/use-store-settings';
import { Button } from '@/components/ui/button';
import type { Product } from '@/types/product';
import type { CreateSaleBody, CreatedSale, SalePaymentRow } from '@/types/sales';

const MAX_QTY = 1_000_000;

type CartAction =
  | { type: 'add'; product: Product }
  | { type: 'setQty'; productId: string; qty: number }
  | { type: 'deltaQty'; productId: string; delta: number }
  | { type: 'remove'; productId: string }
  | { type: 'setLineDiscount'; productId: string; discount: number }
  | { type: 'clear' };

function cartReducer(state: CartLine[], action: CartAction): CartLine[] {
  switch (action.type) {
    case 'clear':
      return [];
    case 'remove':
      return state.filter((l) => l.productId !== action.productId);
    case 'add': {
      const p = action.product;
      if (!p.isActive || p.quantity < 1) {
        return state;
      }
      const base = productToCartLine(p);
      const existing = state.find((l) => l.productId === p.id);
      if (existing) {
        const nextQty = Math.min(existing.quantity + 1, p.quantity, MAX_QTY);
        return state.map((l) =>
          l.productId === p.id ? { ...l, quantity: nextQty, stockAvailable: p.quantity, minStock: p.minStock } : l,
        );
      }
      const qty = Math.min(1, p.quantity, MAX_QTY);
      return [...state, { ...base, quantity: qty, lineDiscount: 0, stockAvailable: p.quantity, minStock: p.minStock }];
    }
    case 'setQty': {
      return state.flatMap((l) => {
        if (l.productId !== action.productId) return [l];
        const raw = action.qty;
        const n = Number.isFinite(raw) ? Math.floor(raw) : 1;
        if (n < 1) return [];
        const q = Math.max(1, Math.min(n, l.stockAvailable, MAX_QTY));
        return [{ ...l, quantity: q }];
      });
    }
    case 'deltaQty': {
      return state.flatMap((l) => {
        if (l.productId !== action.productId) return [l];
        const next = l.quantity + action.delta;
        if (next < 1) return [];
        const q = Math.min(next, l.stockAvailable, MAX_QTY);
        return [{ ...l, quantity: q }];
      });
    }
    case 'setLineDiscount': {
      return state.map((l) => {
        if (l.productId !== action.productId) return l;
        const gross = l.unitPrice * l.quantity;
        const d = Math.max(0, Math.min(action.discount, gross));
        return { ...l, lineDiscount: d };
      });
    }
    default:
      return state;
  }
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

type PayMode = 'CASH' | 'CARD' | 'CREDIT' | 'MIXED';

function buildPayments(
  mode: PayMode,
  total: number,
  singlePaid: number,
  mixedA: { method: 'CASH' | 'CARD' | 'CREDIT'; amount: number },
  mixedB: { method: 'CASH' | 'CARD' | 'CREDIT'; amount: number },
): SalePaymentRow[] {
  const t = round2(total);
  if (mode === 'MIXED') {
    const rows: SalePaymentRow[] = [];
    if (mixedA.amount >= 0.01) rows.push({ method: mixedA.method, amount: round2(mixedA.amount) });
    if (mixedB.amount >= 0.01) rows.push({ method: mixedB.method, amount: round2(mixedB.amount) });
    return rows;
  }
  const amt = mode === 'CASH' ? round2(singlePaid) : round2(Math.max(singlePaid, t));
  if (amt < 0.01) return [];
  return [{ method: mode, amount: amt }];
}

function cashChangeDue(total: number, payments: SalePaymentRow[]): number | null {
  const cashIn = payments.filter((p) => p.method === 'CASH').reduce((s, p) => s + p.amount, 0);
  if (cashIn <= 0) return null;
  const nonCash = payments.filter((p) => p.method !== 'CASH').reduce((s, p) => s + p.amount, 0);
  const owedFromCash = Math.max(0, round2(total) - nonCash);
  return Math.max(0, round2(cashIn - owedFromCash));
}

function validateProductForCart(p: Product): string | null {
  if (!p.isActive) return 'This product is inactive.';
  if (p.quantity < 1) return 'No stock available.';
  return null;
}

export function PosPage() {
  const searchId = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const navigatorOnline = useConnectivityStore((s) => s.navigatorOnline);
  const serverReachable = useConnectivityStore((s) => s.serverReachable);
  const offlineSalesMode = !navigatorOnline || serverReachable === false;
  const { formatMoney: fmt, taxAuto, taxRateNum, settings } = useStoreSettings();
  const branchName = useBranchStore((s) => s.branches.find((b) => b.id === s.selectedBranchId)?.name ?? null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 280);
  const [localSearchResults, setLocalSearchResults] = useState<Product[]>([]);
  const [cart, dispatch] = useReducer(cartReducer, []);
  const [globalDiscount, setGlobalDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [payMode, setPayMode] = useState<PayMode>('CASH');
  const [amountPaid, setAmountPaid] = useState(0);
  const [mixedA, setMixedA] = useState<{ method: 'CASH' | 'CARD' | 'CREDIT'; amount: number }>({
    method: 'CASH',
    amount: 0,
  });
  const [mixedB, setMixedB] = useState<{ method: 'CASH' | 'CARD' | 'CREDIT'; amount: number }>({
    method: 'CARD',
    amount: 0,
  });
  const [receiptSale, setReceiptSale] = useState<CreatedSale | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const debouncedCustomerSearch = useDebouncedValue(customerSearch, 280);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<CouponValidation | null>(null);

  const totals = useMemo(() => computePosTotals(cart, globalDiscount, tax), [cart, globalDiscount, tax]);

  // Net after line discounts — the amount the coupon is validated against
  const netAfterLineDiscounts = useMemo(
    () => round2(totals.subtotal - totals.lineDiscountSum),
    [totals.subtotal, totals.lineDiscountSum],
  );

  // Clear applied coupon when cart items change
  useEffect(() => {
    if (appliedCoupon) {
      setAppliedCoupon(null);
      setGlobalDiscount(0);
      setCouponInput('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart.map((l) => `${l.productId}:${l.quantity}:${l.lineDiscount}`).join(',')]);

  const couponMutation = useMutation({
    mutationFn: ({ code, amount }: { code: string; amount: number }) =>
      validateCoupon(code.trim().toUpperCase(), amount),
    onSuccess: (result) => {
      const discount = round2(parseFloat(result.discount));
      setAppliedCoupon(result);
      setGlobalDiscount(discount);
      toast.success(`Coupon "${result.code}" applied — ${fmt(discount)} off`);
      setCouponInput('');
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Invalid coupon code'));
    },
  });

  useEffect(() => {
    if (!taxAuto) return;
    const base = computePosTotals(cart, globalDiscount, 0);
    setTax(round2(base.afterDiscounts * (taxRateNum / 100)));
  }, [taxAuto, taxRateNum, cart, globalDiscount]);

  useEffect(() => {
    if (payMode === 'CARD' || payMode === 'CREDIT') {
      setAmountPaid(round2(totals.total));
    }
  }, [totals.total, payMode]);

  useEffect(() => {
    if (!offlineSalesMode) {
      setLocalSearchResults([]);
      return;
    }
    const q = debouncedSearch.trim();
    if (!q) {
      setLocalSearchResults([]);
      return;
    }
    let cancelled = false;
    void searchCachedProducts(q, 24).then((rows) => {
      if (!cancelled) setLocalSearchResults(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [offlineSalesMode, debouncedSearch]);

  const productsQuery = useQuery({
    queryKey: ['pos', 'products', debouncedSearch],
    queryFn: () => fetchProducts({ q: debouncedSearch.trim(), limit: 24, page: 1 }),
    enabled: debouncedSearch.trim().length >= 1 && !offlineSalesMode,
  });

  const customersLookupQuery = useQuery({
    queryKey: ['pos', 'customers', debouncedCustomerSearch],
    queryFn: () => fetchCustomers({ q: debouncedCustomerSearch.trim(), limit: 12, page: 1 }),
    enabled: !offlineSalesMode && debouncedCustomerSearch.trim().length >= 1,
  });

  const selectedCustomerQuery = useQuery({
    queryKey: ['customer', selectedCustomerId],
    queryFn: () => fetchCustomer(selectedCustomerId!),
    enabled: !offlineSalesMode && Boolean(selectedCustomerId),
  });

  const results = offlineSalesMode ? localSearchResults : (productsQuery.data?.data ?? []);

  const focusSearch = useCallback(() => {
    const el = searchRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => focusSearch(), 0);
    return () => window.clearTimeout(id);
  }, [focusSearch]);

  const saleMutation = useMutation({
    mutationFn: submitPosSale,
    onSuccess: (sale) => {
      toast.success(`Sale complete · ${sale.invoiceNumber}`);
      setReceiptSale(sale);
      dispatch({ type: 'clear' });
      setGlobalDiscount(0);
      setTax(0);
      setSearch('');
      setPayMode('CASH');
      setAmountPaid(0);
      setMixedA({ method: 'CASH', amount: 0 });
      setMixedB({ method: 'CARD', amount: 0 });
      setCustomerSearch('');
      setSelectedCustomerId(null);
      setAppliedCoupon(null);
      setCouponInput('');
      if (!sale.invoiceNumber.startsWith('OFF-')) {
        void cacheRecentSaleSnapshot(sale);
      }
      void queryClient.invalidateQueries({ queryKey: ['pos'] });
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      void queryClient.invalidateQueries({ queryKey: ['customer'] });
      void queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Sale failed'));
    },
  });

  useEffect(() => {
    const active = cart.length > 0 || saleMutation.isPending || Boolean(receiptSale);
    usePosSaleSessionStore.getState().setSessionActive(active);
    return () => {
      usePosSaleSessionStore.getState().setSessionActive(false);
    };
  }, [cart.length, saleMutation.isPending, receiptSale]);

  const addProduct = useCallback((p: Product, opts?: { clearSearch?: boolean }) => {
    const err = validateProductForCart(p);
    if (err) {
      toast.error(err);
      return;
    }
    dispatch({ type: 'add', product: p });
    toast.success(`Added ${p.name}`);
    if (opts?.clearSearch) setSearch('');
  }, []);

  const tryAddExactBarcodeOrSku = useCallback(async () => {
    const q = search.trim();
    if (!q) {
      toast.message('Scan or type a code', { description: 'Enter adds a product only on an exact barcode or SKU match.' });
      return;
    }

    const offline = !navigator.onLine || useConnectivityStore.getState().serverReachable === false;

    if (offline) {
      const direct = await getCachedProductByBarcodeOrSku(q);
      if (direct) {
        const err = validateProductForCart(direct);
        if (err) {
          toast.error(err);
          return;
        }
        addProduct(direct, { clearSearch: true });
        return;
      }
      const list = await searchCachedProducts(q, 80);
      const exact = findProductByExactBarcodeOrSku(list, q);
      if (exact) {
        const err = validateProductForCart(exact);
        if (err) {
          toast.error(err);
          return;
        }
        addProduct(exact, { clearSearch: true });
        return;
      }
      toast.message('No exact barcode or SKU match', {
        description: 'Select a product from the list, or check the code and try again.',
      });
      return;
    }

    let fromBarcode: Product | undefined;
    try {
      fromBarcode = await fetchProductByBarcode(q);
    } catch {
      fromBarcode = undefined;
    }

    if (fromBarcode) {
      const err = validateProductForCart(fromBarcode);
      if (err) {
        toast.error(err);
        return;
      }
      addProduct(fromBarcode, { clearSearch: true });
      return;
    }

    try {
      const page = await fetchProducts({ q, limit: 80, page: 1 });
      const exact = findProductByExactBarcodeOrSku(page.data, q);
      if (exact) {
        const err = validateProductForCart(exact);
        if (err) {
          toast.error(err);
          return;
        }
        addProduct(exact, { clearSearch: true });
        return;
      }
    } catch {
      toast.error('Could not search products');
      return;
    }

    toast.message('No exact barcode or SKU match', {
      description: 'Select a product from the list, or check the code and try again.',
    });
  }, [search, addProduct]);

  const paymentsPreview = useMemo(
    () => buildPayments(payMode, totals.total, amountPaid, mixedA, mixedB),
    [payMode, totals.total, amountPaid, mixedA, mixedB],
  );

  const realMoneyPaidPreview = useMemo(
    () => paymentsPreview.filter((p) => p.method !== 'CREDIT').reduce((s, p) => s + p.amount, 0),
    [paymentsPreview],
  );
  const saleReceivablePreview = useMemo(
    () => Math.max(0, round2(totals.total - realMoneyPaidPreview)),
    [totals.total, realMoneyPaidPreview],
  );
  const needsCustomerForSale = useMemo(() => {
    const hasCredit = paymentsPreview.some((p) => p.method === 'CREDIT');
    return hasCredit || saleReceivablePreview >= 0.01;
  }, [paymentsPreview, saleReceivablePreview]);

  const existingCustomerDebt = selectedCustomerQuery.data
    ? Number(selectedCustomerQuery.data.balance)
    : 0;

  const hasStockIssue = cart.some((l) => l.quantity > l.stockAvailable);
  const canSubmit = cart.length > 0 && !hasStockIssue && !saleMutation.isPending;

  const handleSubmitSale = useCallback(() => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }
    if (cart.some((l) => l.quantity > l.stockAvailable)) {
      toast.error('Fix stock issues in the cart before checkout');
      return;
    }

    const payments = buildPayments(
      payMode,
      totals.total,
      amountPaid,
      { method: mixedA.method, amount: mixedA.amount },
      { method: mixedB.method, amount: mixedB.amount },
    );
    if (payments.length === 0) {
      toast.error('Enter at least one payment of $0.01 or more');
      return;
    }

    const realMoneyPaid = payments.filter((p) => p.method !== 'CREDIT').reduce((s, p) => s + p.amount, 0);
    const receivable = Math.max(0, round2(totals.total - realMoneyPaid));
    const hasCreditPayment = payments.some((p) => p.method === 'CREDIT');

    if (offlineSalesMode && (hasCreditPayment || receivable >= 0.01)) {
      toast.error(
        'Sales on customer credit or with an unpaid remainder need the live server. Pay the full amount with cash or card while offline, or reconnect.',
      );
      return;
    }

    if (!offlineSalesMode && (hasCreditPayment || receivable >= 0.01) && !selectedCustomerId) {
      toast.error('Choose a customer for this sale — required for CREDIT or when non-credit payments do not cover the total.');
      return;
    }

    const body: CreateSaleBody = {
      ...(selectedCustomerId ? { customerId: selectedCustomerId } : {}),
      items: cart.map((l) => ({
        productId: l.productId,
        quantity: l.quantity,
        discount: l.lineDiscount > 0 ? round2(l.lineDiscount) : undefined,
      })),
      payments,
      ...(appliedCoupon ? { couponCode: appliedCoupon.code } : {}),
      globalDiscount: !appliedCoupon && globalDiscount > 0 ? round2(globalDiscount) : undefined,
      tax: tax > 0 ? round2(tax) : undefined,
    };

    saleMutation.mutate(body);
  }, [
    cart,
    payMode,
    totals.total,
    amountPaid,
    mixedA,
    mixedB,
    globalDiscount,
    tax,
    saleMutation,
    offlineSalesMode,
    selectedCustomerId,
  ]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'F2') {
        e.preventDefault();
        focusSearch();
      }
      if (e.ctrlKey && e.key === 'Enter') {
        if (cart.length === 0 || cart.some((l) => l.quantity > l.stockAvailable) || saleMutation.isPending) {
          return;
        }
        e.preventDefault();
        handleSubmitSale();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focusSearch, cart, saleMutation.isPending, handleSubmitSale]);

  const change = cashChangeDue(totals.total, paymentsPreview);
  const showChangeRow = change !== null;

  const closeReceipt = useCallback(() => {
    setReceiptSale(null);
    queueMicrotask(focusSearch);
  }, [focusSearch]);

  return (
    <div className="pb-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold tracking-tight text-ink sm:text-2xl">Point of sale</h1>
          <p className="mt-0.5 text-xs text-ink-muted sm:text-sm">
            <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[10px] text-ink-muted sm:text-xs">
              F2
            </kbd>{' '}
            focus search ·{' '}
            <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[10px] text-ink-muted sm:text-xs">
              Enter
            </kbd>{' '}
            exact barcode/SKU ·{' '}
            <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[10px] text-ink-muted sm:text-xs">
              Ctrl+Enter
            </kbd>{' '}
            checkout
          </p>
        </div>
        <Button type="button" variant="secondary" size="sm" className="shrink-0 gap-2 self-start" onClick={focusSearch}>
          <ScanLine className="h-4 w-4" aria-hidden />
          Focus search
        </Button>
      </div>

      {offlineSalesMode ? (
        <div
          role="status"
          className="mb-4 flex gap-3 rounded-xl border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-950"
        >
          <AlertTriangle className="h-5 w-5 shrink-0 text-warning-700" aria-hidden />
          <div>
            <p className="font-semibold text-warning-900">You are selling offline</p>
            <p className="mt-1 leading-relaxed text-warning-900/90">
              Invoices use a temporary OFF- number, stock updates on this device immediately, and sales queue for sync
              when the server is reachable again. Connect at least once while online so the product catalog is cached.
            </p>
          </div>
        </div>
      ) : null}

      {/* Full-width scan / search */}
      <section
        className="mb-4 rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-5"
        aria-label="Product search and barcode"
      >
        <label htmlFor={searchId} className="mb-2 block text-sm font-semibold text-ink">
          Scan barcode or search by name, SKU, or code
        </label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted sm:h-6 sm:w-6"
            aria-hidden
          />
          <input
            ref={searchRef}
            id={searchId}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void tryAddExactBarcodeOrSku();
              }
            }}
            autoComplete="off"
            spellCheck={false}
            placeholder="Scan or type — Enter adds on exact barcode / SKU match"
            className="w-full rounded-xl border-2 border-line bg-canvas py-3.5 pl-12 pr-4 text-base font-medium text-ink shadow-inner outline-none transition placeholder:text-ink-faint focus:border-primary-400 focus:ring-4 focus:ring-primary-500/15 sm:py-4 sm:pl-14 sm:text-lg"
          />
        </div>
      </section>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-6">
        {/* Product results */}
        <section
          className="flex min-h-0 min-w-0 flex-1 flex-col rounded-2xl border border-line bg-surface shadow-card lg:max-h-[calc(100dvh-13rem)]"
          aria-label="Product search results"
        >
          <div className="border-b border-line px-4 py-3 sm:px-5">
            <h2 className="text-sm font-semibold text-ink">Catalog matches</h2>
            <p className="text-xs text-ink-muted">Tap a row to add · inactive or out-of-stock items cannot be added</p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {debouncedSearch.trim().length < 1 ? (
              <p className="px-4 py-12 text-center text-sm text-ink-muted sm:px-6">
                Start typing or scan — results appear here. Use the list for partial name matches.
              </p>
            ) : productsQuery.isLoading ? (
              <ul className="divide-y divide-line p-3 sm:p-4" aria-busy>
                {Array.from({ length: 6 }).map((_, i) => (
                  <li key={i} className="animate-pulse py-4">
                    <div className="h-4 w-[66%] max-w-xs rounded bg-line" />
                    <div className="mt-2 h-3 w-[33%] max-w-[8rem] rounded bg-line" />
                  </li>
                ))}
              </ul>
            ) : productsQuery.isError ? (
              <p className="px-4 py-12 text-center text-sm text-danger-600 sm:px-6">
                {getApiErrorMessage(productsQuery.error, 'Search failed')}
              </p>
            ) : results.length === 0 ? (
              <p className="px-4 py-12 text-center text-sm text-ink-muted sm:px-6">No products match that search.</p>
            ) : (
              <ul className="divide-y divide-line">
                {results.map((p) => {
                  const low = p.quantity > 0 && p.quantity <= p.minStock;
                  const out = p.quantity < 1;
                  const blocked = !p.isActive || out;
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        disabled={blocked}
                        onClick={() => addProduct(p)}
                        className={cn(
                          'flex w-full items-center gap-3 px-4 py-3.5 text-left transition sm:gap-4 sm:px-5 sm:py-4',
                          blocked
                            ? 'cursor-not-allowed bg-surface-muted text-ink-faint'
                            : 'hover:bg-primary-50/60 active:bg-primary-50',
                        )}
                      >
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                          <span className="truncate font-semibold text-ink">{p.name}</span>
                          <span className="text-xs text-ink-muted">
                            {[p.barcode ? `BC ${p.barcode}` : null, p.sku ? `SKU ${p.sku}` : null]
                              .filter(Boolean)
                              .join(' · ') || '—'}
                          </span>
                          <div className="flex flex-wrap items-center gap-2 pt-0.5">
                            <span className="text-sm font-semibold tabular-nums text-primary-700">{fmt(p.sellingPrice)}</span>
                            <span className="text-xs tabular-nums text-ink-muted">Stock {p.quantity}</span>
                            {low ? (
                              <span className="inline-flex items-center gap-1 rounded-md border border-warning-200 bg-warning-50 px-2 py-0.5 text-xs font-medium text-warning-800">
                                <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />
                                Low stock
                              </span>
                            ) : null}
                            {out ? (
                              <span className="text-xs font-semibold text-danger-600">Out of stock</span>
                            ) : null}
                            {!p.isActive ? (
                              <span className="text-xs font-semibold text-ink-muted">Inactive</span>
                            ) : null}
                          </div>
                        </div>
                        <span
                          className={cn(
                            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border sm:h-11 sm:w-11',
                            blocked
                              ? 'border-line bg-canvas text-ink-faint'
                              : 'border-primary-200 bg-primary-50 text-primary-700',
                          )}
                          aria-hidden
                        >
                          <Plus className="h-5 w-5" />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        {/* Cart + payment — sticky on large screens */}
        <aside
          className="flex w-full shrink-0 flex-col gap-4 lg:sticky lg:top-4 lg:w-[min(100%,420px)] lg:self-start lg:max-h-[calc(100dvh-6rem)]"
          aria-label="Cart and checkout"
        >
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-card lg:min-h-[200px] lg:max-h-[min(52vh,420px)]">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line px-4 py-3 sm:px-5">
              <h2 className="flex items-center gap-2 font-display text-base font-semibold text-ink sm:text-lg">
                <ShoppingCart className="h-5 w-5 shrink-0 text-primary-600" aria-hidden />
                Cart
                {cart.length > 0 ? (
                  <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-bold text-primary-800">
                    {cart.length}
                  </span>
                ) : null}
              </h2>
              {cart.length > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    dispatch({ type: 'clear' });
                    toast.message('Cart cleared');
                  }}
                  className="text-xs font-semibold text-ink-muted underline-offset-2 hover:text-ink hover:underline"
                >
                  Clear all
                </button>
              ) : null}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line bg-canvas-raised/30 py-12 text-center">
                  <ShoppingCart className="mb-2 h-10 w-10 text-ink-faint" aria-hidden />
                  <p className="text-sm font-medium text-ink-muted">Cart is empty</p>
                  <p className="mt-1 max-w-[240px] text-xs text-ink-faint">
                    Add from the list or scan an exact barcode/SKU and press Enter.
                  </p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {cart.map((line) => {
                    const warn = stockWarning(line);
                    const lineGross = line.unitPrice * line.quantity;
                    const lineNet = lineGross - line.lineDiscount;
                    return (
                      <li
                        key={line.productId}
                        className={cn(
                          'rounded-xl border border-line bg-canvas p-3 shadow-sm sm:p-4',
                          warn === 'out' && 'border-danger-300 bg-danger-50/80',
                          warn === 'low' && 'border-warning-200 bg-warning-50/50',
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold leading-snug text-ink">{line.name}</p>
                            <p className="mt-0.5 text-xs text-ink-muted">
                              Max {line.stockAvailable} · {fmt(line.unitPrice)} unit
                            </p>
                            {warn === 'out' ? (
                              <p className="mt-1.5 text-xs font-semibold text-danger-700">Quantity exceeds stock.</p>
                            ) : warn === 'low' ? (
                              <p className="mt-1.5 text-xs font-semibold text-warning-800">Low stock after this sale.</p>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            onClick={() => dispatch({ type: 'remove', productId: line.productId })}
                            className="shrink-0 rounded-lg p-2 text-ink-muted transition hover:bg-danger-50 hover:text-danger-600"
                            aria-label={`Remove ${line.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-x-4">
                          <div>
                            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">Quantity</p>
                            <div className="inline-flex items-center rounded-xl border border-line bg-surface shadow-sm">
                              <button
                                type="button"
                                className="flex h-10 w-10 items-center justify-center text-ink transition hover:bg-canvas-raised disabled:text-ink-faint"
                                aria-label="Decrease quantity"
                                onClick={() => dispatch({ type: 'deltaQty', productId: line.productId, delta: -1 })}
                              >
                                <Minus className="h-4 w-4" />
                              </button>
                              <input
                                type="number"
                                min={0}
                                max={line.stockAvailable}
                                value={line.quantity}
                                onChange={(e) =>
                                  dispatch({
                                    type: 'setQty',
                                    productId: line.productId,
                                    qty: Number(e.target.value),
                                  })
                                }
                                className="h-10 w-14 border-x border-line bg-canvas text-center text-sm font-semibold tabular-nums text-ink outline-none focus:bg-surface"
                              />
                              <button
                                type="button"
                                className="flex h-10 w-10 items-center justify-center text-ink transition hover:bg-canvas-raised disabled:text-ink-faint"
                                aria-label="Increase quantity"
                                disabled={line.quantity >= line.stockAvailable}
                                onClick={() => dispatch({ type: 'deltaQty', productId: line.productId, delta: 1 })}
                              >
                                <Plus className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                          <div>
                            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                              Line discount
                            </p>
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              max={lineGross}
                              value={line.lineDiscount || ''}
                              onChange={(e) =>
                                dispatch({
                                  type: 'setLineDiscount',
                                  productId: line.productId,
                                  discount: Number(e.target.value),
                                })
                              }
                              className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm font-medium tabular-nums text-ink outline-none focus:border-primary-300 focus:ring-2 focus:ring-primary-500/20"
                              aria-label={`Discount for ${line.name}`}
                            />
                          </div>
                        </div>

                        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-line/80 pt-3 text-xs sm:text-sm">
                          <div className="flex justify-between text-ink-muted">
                            <dt>Unit price</dt>
                            <dd className="tabular-nums text-ink">{fmt(line.unitPrice)}</dd>
                          </div>
                          <div className="flex justify-between text-ink-muted">
                            <dt>Discount</dt>
                            <dd className="tabular-nums text-ink">{fmt(line.lineDiscount)}</dd>
                          </div>
                          <div className="col-span-2 flex justify-between border-t border-line/60 pt-2 text-sm font-bold text-ink sm:text-base">
                            <dt>Line total</dt>
                            <dd className="tabular-nums">{fmt(lineNet)}</dd>
                          </div>
                        </dl>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          <div className="shrink-0 space-y-4 rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-5">
            <div className="rounded-xl border border-line bg-canvas-raised/20 p-3 sm:p-4">
              <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink-muted">
                <UserSearch className="h-4 w-4 text-primary-600" aria-hidden />
                Customer
              </h3>
              {offlineSalesMode ? (
                <p className="text-xs leading-relaxed text-ink-muted">
                  Attaching a customer for on-account sales is only available while online. Offline checkout must cover
                  the full total using cash or card only.
                </p>
              ) : (
                <>
                  {selectedCustomerId && selectedCustomerQuery.data ? (
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-ink">{selectedCustomerQuery.data.name}</p>
                        <p className="text-xs text-ink-muted">
                          Balance {fmt(Number(selectedCustomerQuery.data.balance))}
                          <Link
                            to={`/customers/${selectedCustomerId}`}
                            className="ml-2 font-semibold text-primary-700 underline-offset-2 hover:underline"
                          >
                            Account
                          </Link>
                        </p>
                      </div>
                      <button
                        type="button"
                        className="shrink-0 rounded-lg p-1.5 text-ink-muted hover:bg-danger-50 hover:text-danger-600"
                        aria-label="Clear customer"
                        onClick={() => {
                          setSelectedCustomerId(null);
                          setCustomerSearch('');
                        }}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : null}
                  <input
                    type="search"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    placeholder="Search customer by name or phone…"
                    className="mb-2 h-10 w-full rounded-lg border border-line bg-canvas px-3 text-sm outline-none focus:border-primary-300 focus:ring-2 focus:ring-primary-500/20"
                  />
                  {debouncedCustomerSearch.trim().length >= 1 && customersLookupQuery.isSuccess ? (
                    <ul className="max-h-40 overflow-y-auto rounded-lg border border-line bg-surface text-sm shadow-sm">
                      {(customersLookupQuery.data?.data ?? []).length === 0 ? (
                        <li className="px-3 py-2 text-xs text-ink-muted">No matches.</li>
                      ) : (
                        (customersLookupQuery.data?.data ?? []).map((c) => (
                          <li key={c.id} className="border-b border-line last:border-0">
                            <button
                              type="button"
                              className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-primary-50/60"
                              onClick={() => {
                                setSelectedCustomerId(c.id);
                                setCustomerSearch('');
                              }}
                            >
                              <span className="font-medium text-ink">{c.name}</span>
                              <span className="text-xs text-ink-muted">
                                {c.phone || '—'} · balance {fmt(Number(c.balance))}
                              </span>
                            </button>
                          </li>
                        ))
                      )}
                    </ul>
                  ) : null}
                </>
              )}
            </div>

            {!offlineSalesMode && existingCustomerDebt >= 0.01 && selectedCustomerId ? (
              <div
                role="status"
                className="flex gap-2 rounded-xl border border-warning-200 bg-warning-50 px-3 py-2.5 text-xs text-warning-900"
              >
                <AlertTriangle className="h-4 w-4 shrink-0 text-warning-700" aria-hidden />
                <p>
                  <span className="font-semibold">Outstanding balance.</span> This customer already owes{' '}
                  <span className="font-bold tabular-nums">{fmt(existingCustomerDebt)}</span> before this sale.
                </p>
              </div>
            ) : null}

            {!offlineSalesMode && needsCustomerForSale ? (
              <div
                role="status"
                className="flex gap-2 rounded-xl border border-warning-200 bg-warning-50 px-3 py-2.5 text-xs text-warning-900"
              >
                <AlertTriangle className="h-4 w-4 shrink-0 text-warning-700" aria-hidden />
                <p>
                  {saleReceivablePreview >= 0.01 ? (
                    <>
                      <span className="font-semibold">On-account portion.</span> Non-credit payments leave{' '}
                      <span className="font-bold tabular-nums">{fmt(saleReceivablePreview)}</span> to post to the
                      customer ledger. Select a customer before completing the sale.
                    </>
                  ) : (
                    <>
                      <span className="font-semibold">Credit payment line.</span> Select a customer before completing
                      the sale.
                    </>
                  )}
                </p>
              </div>
            ) : null}

            <div>
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-muted">Totals</h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-4 text-ink">
                  <dt>Subtotal</dt>
                  <dd className="tabular-nums font-medium">{fmt(totals.subtotal)}</dd>
                </div>
                <div className="flex justify-between gap-4 text-ink">
                  <dt>Discounts</dt>
                  <dd className="tabular-nums font-medium text-danger-600">−{fmt(totals.discountTotal)}</dd>
                </div>

                {/* Coupon */}
                {appliedCoupon ? (
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-success-200 bg-success-50 px-3 py-2 text-xs">
                    <div className="min-w-0">
                      <p className="font-semibold text-success-800">
                        Coupon <span className="font-mono">{appliedCoupon.code}</span>
                      </p>
                      <p className="text-success-700">
                        {appliedCoupon.type === 'PERCENTAGE'
                          ? `${appliedCoupon.value}% off`
                          : `${fmt(parseFloat(appliedCoupon.value))} off`}
                        {' '}· saving {fmt(parseFloat(appliedCoupon.discount))}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setAppliedCoupon(null); setGlobalDiscount(0); }}
                      className="shrink-0 rounded-md p-1 text-success-700 hover:bg-success-100"
                      aria-label="Remove coupon"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && couponInput.trim() && cart.length > 0) {
                          e.preventDefault();
                          couponMutation.mutate({ code: couponInput.trim(), amount: netAfterLineDiscounts });
                        }
                      }}
                      placeholder="Coupon code"
                      className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-canvas px-2 text-sm font-mono uppercase outline-none placeholder:normal-case placeholder:text-ink-faint focus:border-primary-300 focus:ring-2 focus:ring-primary-500/20"
                    />
                    <button
                      type="button"
                      disabled={!couponInput.trim() || cart.length === 0 || couponMutation.isPending}
                      onClick={() => couponMutation.mutate({ code: couponInput.trim(), amount: netAfterLineDiscounts })}
                      className="shrink-0 rounded-lg border border-line bg-surface px-3 text-xs font-semibold text-ink transition hover:bg-canvas-raised disabled:cursor-not-allowed disabled:text-ink-faint"
                    >
                      {couponMutation.isPending ? '…' : 'Apply'}
                    </button>
                  </div>
                )}

                <label className="flex items-center justify-between gap-3 text-ink">
                  <span className="text-xs sm:text-sm">Extra discount</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={appliedCoupon ? '' : (globalDiscount || '')}
                    onChange={(e) => {
                      if (!appliedCoupon) setGlobalDiscount(Math.max(0, Number(e.target.value) || 0));
                    }}
                    disabled={Boolean(appliedCoupon)}
                    placeholder={appliedCoupon ? fmt(globalDiscount) : '0'}
                    className="h-9 w-24 rounded-lg border border-line bg-canvas px-2 text-right text-sm tabular-nums outline-none focus:border-primary-300 focus:ring-2 focus:ring-primary-500/20 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-ink-faint"
                  />
                </label>
                <label className="flex flex-wrap items-center justify-between gap-3 text-ink">
                  <span className="text-xs sm:text-sm">
                    Tax
                    {taxAuto ? (
                      <span className="ml-1 block font-normal text-ink-muted sm:inline">
                        (auto {taxRateNum}%)
                      </span>
                    ) : null}
                  </span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={tax || ''}
                    onChange={(e) => setTax(Math.max(0, Number(e.target.value) || 0))}
                    disabled={taxAuto}
                    className="h-9 w-24 rounded-lg border border-line bg-canvas px-2 text-right text-sm tabular-nums outline-none focus:border-primary-300 focus:ring-2 focus:ring-primary-500/20 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-ink-faint"
                  />
                </label>
                <div className="flex justify-between gap-4 border-t border-line pt-3 text-base font-bold text-ink">
                  <dt>Total</dt>
                  <dd className="tabular-nums text-primary-800">{fmt(totals.total)}</dd>
                </div>
              </dl>
            </div>

            <div>
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-muted">Payment</h3>
              <div className="mb-4 grid grid-cols-2 gap-2">
                {(
                  [
                    ['CASH', Banknote],
                    ['CARD', CreditCard],
                    ['CREDIT', Landmark],
                    ['MIXED', Layers],
                  ] as const
                ).map(([m, Icon]) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPayMode(m)}
                    className={cn(
                      'flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-[10px] font-bold uppercase tracking-wide transition sm:text-xs',
                      payMode === m
                        ? 'border-primary-500 bg-primary-50 text-primary-900 ring-1 ring-primary-500/30'
                        : 'border-line text-ink-muted hover:border-line-strong hover:bg-canvas-raised hover:text-ink',
                    )}
                  >
                    <Icon className="h-5 w-5 text-current" aria-hidden />
                    {m}
                  </button>
                ))}
              </div>

              {payMode === 'MIXED' ? (
                <div className="mb-4 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={mixedA.method}
                      onChange={(e) =>
                        setMixedA((s) => ({ ...s, method: e.target.value as 'CASH' | 'CARD' | 'CREDIT' }))
                      }
                      className="h-10 rounded-lg border border-line bg-canvas px-2 text-sm"
                    >
                      <option value="CASH">CASH</option>
                      <option value="CARD">CARD</option>
                      <option value="CREDIT">CREDIT</option>
                    </select>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={mixedA.amount || ''}
                      onChange={(e) => setMixedA((s) => ({ ...s, amount: Math.max(0, Number(e.target.value) || 0) }))}
                      className="h-10 rounded-lg border border-line bg-canvas px-2 text-sm tabular-nums"
                      aria-label="Mixed payment amount 1"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={mixedB.method}
                      onChange={(e) =>
                        setMixedB((s) => ({ ...s, method: e.target.value as 'CASH' | 'CARD' | 'CREDIT' }))
                      }
                      className="h-10 rounded-lg border border-line bg-canvas px-2 text-sm"
                    >
                      <option value="CASH">CASH</option>
                      <option value="CARD">CARD</option>
                      <option value="CREDIT">CREDIT</option>
                    </select>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={mixedB.amount || ''}
                      onChange={(e) => setMixedB((s) => ({ ...s, amount: Math.max(0, Number(e.target.value) || 0) }))}
                      className="h-10 rounded-lg border border-line bg-canvas px-2 text-sm tabular-nums"
                      aria-label="Mixed payment amount 2"
                    />
                  </div>
                </div>
              ) : (
                <label className="mb-1 block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-muted">
                    {payMode === 'CASH' ? 'Amount received' : 'Amount paid'}
                  </span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={amountPaid || ''}
                    onChange={(e) => setAmountPaid(Math.max(0, Number(e.target.value) || 0))}
                    className="h-12 w-full rounded-xl border border-line bg-canvas px-3 text-lg font-semibold tabular-nums text-ink outline-none focus:border-primary-300 focus:ring-2 focus:ring-primary-500/20"
                  />
                </label>
              )}

              {showChangeRow ? (
                <div
                  className={cn(
                    'mt-3 flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm font-semibold sm:text-base',
                    (change ?? 0) > 0
                      ? 'border-success-200 bg-success-50 text-success-900'
                      : 'border-line bg-canvas text-ink-muted',
                  )}
                >
                  <span>Change</span>
                  <span className="tabular-nums">{fmt(change ?? 0)}</span>
                </div>
              ) : null}
            </div>

            <Button
              type="button"
              variant="primary"
              size="lg"
              disabled={!canSubmit}
              onClick={handleSubmitSale}
              className="h-12 w-full gap-2 rounded-xl text-base font-bold shadow-md sm:h-14 sm:text-lg"
            >
              {saleMutation.isPending ? (
                <>
                  <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden />
                  Processing…
                </>
              ) : (
                'Complete sale'
              )}
            </Button>
          </div>
        </aside>
      </div>

      <PosReceiptModal
        sale={receiptSale}
        open={Boolean(receiptSale)}
        onClose={closeReceipt}
        branchName={branchName}
        autoPrintOnOpen={Boolean(settings?.receiptAutoPrint)}
      />
    </div>
  );
}
