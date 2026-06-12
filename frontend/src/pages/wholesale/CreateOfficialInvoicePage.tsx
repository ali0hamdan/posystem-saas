import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { createSale } from '@/api/sales.api';
import { fetchCustomers } from '@/api/customers.api';
import { fetchProducts } from '@/api/products.api';
import { previewBulkPrice } from '@/api/wholesale/bulk-pricing.api';
import { getApiErrorMessage } from '@/api/client';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { TextInput } from '@/components/ui/input';
import { ErrorBanner } from '@/components/ui/error-banner';
import { customerPickerLabel } from '@/lib/customer-display';
import { SalesmanAssignmentField } from '@/features/commissions/SalesmanSelector';
import { useAuthStore } from '@/stores/auth-store';
import { formatMoney } from '@/lib/format-money';
import type { SalePaymentRow } from '@/types/sales';

type Line = {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  normalPrice: number;
  bulkApplied: boolean;
  bulkPriceListName: string | null;
  priceOverridden: boolean;
};

export function CreateOfficialInvoicePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [customerId, setCustomerId] = useState('');
  const [productQ, setProductQ] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'UNPAID' | 'CASH' | 'CARD' | 'CREDIT' | 'PARTIAL'>('UNPAID');
  const [amountPaid, setAmountPaid] = useState('');
  const [globalDiscount, setGlobalDiscount] = useState('');
  const [salesmanIdCode, setSalesmanIdCode] = useState('');
  const me = useAuthStore((s) => s.user);
  const [error, setError] = useState('');

  const customersQ = useQuery({
    queryKey: ['customers', 'invoice-new'],
    queryFn: () => fetchCustomers({ limit: 200 }),
  });

  const productsQ = useQuery({
    queryKey: ['products', 'invoice-new', productQ],
    queryFn: () => fetchProducts({ q: productQ || undefined, limit: 8, includeInactive: false }),
    enabled: productQ.length >= 2,
  });

  const subtotal = useMemo(
    () => lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0),
    [lines],
  );
  const discount = Math.max(0, Number(globalDiscount) || 0);
  const total = Math.max(0, subtotal - discount);

  async function resolveLinePrice(productId: string, quantity: number, normalPrice: number) {
    try {
      const result = await previewBulkPrice({
        customerId: customerId || undefined,
        productId,
        quantity,
      });
      return {
        unitPrice: Number(result.finalUnitPrice) || normalPrice,
        normalPrice: Number(result.normalUnitPrice) || normalPrice,
        bulkApplied: result.applied,
        bulkPriceListName: result.appliedPriceListName,
      };
    } catch {
      return { unitPrice: normalPrice, normalPrice, bulkApplied: false, bulkPriceListName: null };
    }
  }

  async function addProduct(p: { id: string; name: string; sellingPrice: string | number }) {
    if (lines.some((l) => l.productId === p.id)) return;
    const normalPrice = Number(p.sellingPrice) || 0;
    const priced = await resolveLinePrice(p.id, 1, normalPrice);
    setLines((prev) => [
      ...prev,
      {
        productId: p.id,
        productName: p.name,
        quantity: 1,
        unitPrice: priced.unitPrice,
        normalPrice: priced.normalPrice,
        bulkApplied: priced.bulkApplied,
        bulkPriceListName: priced.bulkPriceListName,
        priceOverridden: false,
      },
    ]);
    setProductQ('');
  }

  useEffect(() => {
    if (!customerId || lines.length === 0) return;
    let cancelled = false;
    void (async () => {
      const next = await Promise.all(
        lines.map(async (line) => {
          if (line.priceOverridden) return line;
          const priced = await resolveLinePrice(line.productId, line.quantity, line.normalPrice);
          return { ...line, ...priced, priceOverridden: false };
        }),
      );
      if (!cancelled) setLines(next);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  const createM = useMutation({
    mutationFn: async () => {
      const payments: SalePaymentRow[] = [];
      const paid = Math.max(0, Number(amountPaid) || 0);
      if (paymentMethod === 'CASH') payments.push({ method: 'CASH', amount: paid > 0 ? paid : total });
      if (paymentMethod === 'CARD') payments.push({ method: 'CARD', amount: paid > 0 ? paid : total });
      if (paymentMethod === 'CREDIT') payments.push({ method: 'CREDIT', amount: total });
      if (paymentMethod === 'PARTIAL' && paid > 0) payments.push({ method: 'CASH', amount: paid });
      if (paymentMethod === 'UNPAID') {
        /* no payments — sale becomes UNPAID, requires customer */
      }
      return createSale({
        customerId: customerId || undefined,
        items: lines.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
        })),
        payments: payments.length ? payments : undefined,
        globalDiscount: discount > 0 ? discount : undefined,
        ...(salesmanIdCode.trim() ? { salesmanIdCode: salesmanIdCode.trim().toUpperCase() } : {}),
      });
    },
    onSuccess: (sale) => {
      toast.success(`Invoice ${sale.invoiceNumber} created`);
      void qc.invalidateQueries({ queryKey: ['sales'] });
      void qc.invalidateQueries({ queryKey: ['wholesale', 'dashboard'] });
      navigate(`/wholesale/invoices`);
    },
    onError: (e) => setError(getApiErrorMessage(e, 'Could not create invoice')),
  });

  function handleSubmit() {
    setError('');
    if (lines.length === 0) {
      setError('Add at least one product line.');
      return;
    }
    const needsCustomer =
      paymentMethod === 'CREDIT' ||
      paymentMethod === 'UNPAID' ||
      (paymentMethod === 'PARTIAL' && (Number(amountPaid) || 0) < total - 0.01);
    if (needsCustomer && !customerId) {
      setError('Select a customer for credit or unpaid invoices.');
      return;
    }
    if (me?.role === 'CASHIER' && !salesmanIdCode.trim()) {
      setError('Salesman ID is required.');
      return;
    }
    createM.mutate();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-10">
      <PageHeader
        title="New official invoice"
        description="Creates a B2B invoice — stock is deducted, revenue recorded, and customer debt updated if unpaid."
        actions={
          <Link to="/wholesale/invoices" className="inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:underline">
            <ArrowLeft className="h-4 w-4" /> Back to invoices
          </Link>
        }
      />

      {error ? <ErrorBanner message={error} /> : null}

      <section className="rounded-xl border border-line bg-surface p-5 shadow-card space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-muted">Customer</label>
          <select
            className="h-11 w-full rounded-xl border border-line bg-canvas px-3 text-sm"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
          >
            <option value="">Walk-in / no customer</option>
            {(customersQ.data?.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>{customerPickerLabel(c)}</option>
            ))}
          </select>
        </div>

        <SalesmanAssignmentField
          salesmanIdCode={salesmanIdCode}
          onSalesmanIdCodeChange={setSalesmanIdCode}
        />

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-muted">Add product</label>
          <TextInput value={productQ} onChange={(e) => setProductQ(e.target.value)} placeholder="Search by name, SKU, barcode…" />
          {productsQ.data?.data?.length ? (
            <ul className="mt-2 max-h-40 overflow-auto rounded-lg border border-line bg-canvas text-sm">
              {productsQ.data.data.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-3 py-2 hover:bg-surface"
                    onClick={() => addProduct(p)}
                  >
                    <span>{p.name}</span>
                    <span className="text-ink-muted">{formatMoney(Number(p.sellingPrice))}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {lines.length > 0 ? (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-ink">Line items</h3>
            {lines.map((line, idx) => (
              <div key={line.productId} className="flex flex-wrap items-center gap-2 rounded-lg border border-line p-3">
                <span className="min-w-[140px] flex-1 text-sm font-medium">{line.productName}</span>
                <TextInput
                  type="number"
                  className="w-20"
                  value={line.quantity}
                  onChange={(e) => {
                    const quantity = Math.max(1, Number(e.target.value) || 1);
                    void resolveLinePrice(line.productId, quantity, line.normalPrice).then((priced) => {
                      setLines((prev) =>
                        prev.map((l, i) =>
                          i === idx
                            ? {
                                ...l,
                                quantity,
                                ...(l.priceOverridden ? {} : { unitPrice: priced.unitPrice, bulkApplied: priced.bulkApplied, bulkPriceListName: priced.bulkPriceListName }),
                              }
                            : l,
                        ),
                      );
                    });
                  }}
                />
                <TextInput
                  type="number"
                  className="w-28"
                  value={line.unitPrice}
                  onChange={(e) => {
                    const unitPrice = Math.max(0, Number(e.target.value) || 0);
                    setLines((prev) =>
                      prev.map((l, i) => (i === idx ? { ...l, unitPrice, priceOverridden: true, bulkApplied: false } : l)),
                    );
                  }}
                />
                <span className="text-xs text-ink-muted">
                  {line.bulkApplied && !line.priceOverridden
                    ? `Bulk · ${line.bulkPriceListName}`
                    : line.priceOverridden
                      ? 'Manual price'
                      : `Retail ${formatMoney(line.normalPrice)}`}
                </span>
                <button type="button" aria-label="Remove line" onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}>
                  <Trash2 className="h-4 w-4 text-danger-500" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="flex items-center gap-1 text-sm text-ink-muted">
            <Plus className="h-4 w-4" /> Search and add products to build the invoice.
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-muted">Invoice discount</span>
            <TextInput type="number" min={0} value={globalDiscount} onChange={(e) => setGlobalDiscount(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-muted">Payment</span>
            <select
              className="h-11 w-full rounded-xl border border-line bg-canvas px-3 text-sm"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as typeof paymentMethod)}
            >
              <option value="UNPAID">Unpaid (on account)</option>
              <option value="CASH">Paid — cash</option>
              <option value="CARD">Paid — card</option>
              <option value="CREDIT">On credit (full)</option>
              <option value="PARTIAL">Partial payment</option>
            </select>
          </label>
          {paymentMethod === 'PARTIAL' || paymentMethod === 'CASH' || paymentMethod === 'CARD' ? (
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-muted">Amount paid</span>
              <TextInput type="number" min={0} step="0.01" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} />
            </label>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <p className="text-lg font-semibold text-ink">Total: {formatMoney(total)}</p>
          <Button variant="primary" disabled={createM.isPending || lines.length === 0} onClick={handleSubmit}>
            {createM.isPending ? 'Creating…' : 'Create official invoice'}
          </Button>
        </div>
      </section>
    </div>
  );
}
