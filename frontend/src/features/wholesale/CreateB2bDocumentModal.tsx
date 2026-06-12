import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { TextInput } from '@/components/ui/input';
import { fetchCustomers } from '@/api/customers.api';
import { fetchProducts } from '@/api/products.api';
import { createQuotation } from '@/api/quotations.api';
import { createProformaInvoice } from '@/api/proforma-invoices.api';
import { previewBulkPrice } from '@/api/wholesale/bulk-pricing.api';
import { getApiErrorMessage } from '@/api/client';
import { formatMoney } from '@/lib/format-money';
import { customerPickerLabel } from '@/lib/customer-display';

type DocType = 'quotation' | 'proforma';

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

type Props = {
  open: boolean;
  type: DocType;
  onClose: () => void;
  onCreated: () => void;
};

export function CreateB2bDocumentModal({ open, type, onClose, onCreated }: Props) {
  const [customerId, setCustomerId] = useState('');
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');
  const [productQ, setProductQ] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [error, setError] = useState('');

  const customersQ = useQuery({
    queryKey: ['customers', 'picker'],
    queryFn: () => fetchCustomers({ limit: 100 }),
    enabled: open,
  });

  const productsQ = useQuery({
    queryKey: ['products', 'picker', productQ],
    queryFn: () => fetchProducts({ q: productQ || undefined, limit: 8, includeInactive: false }),
    enabled: open && productQ.length >= 2,
  });

  const title = type === 'quotation' ? 'New quotation' : 'New proforma invoice';

  const mutation = useMutation({
    mutationFn: async () => {
      const items = lines.map((l) => ({
        productId: l.productId,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
      }));
      if (type === 'quotation') {
        return createQuotation({
          customerId: customerId || undefined,
          items,
          notes: notes || undefined,
          terms: terms || undefined,
        });
      }
      return createProformaInvoice({
        customerId: customerId || undefined,
        items,
        notes: notes || undefined,
        terms: terms || undefined,
      });
    },
    onSuccess: () => {
      setLines([]);
      setCustomerId('');
      setNotes('');
      setTerms('');
      setProductQ('');
      setError('');
      onCreated();
      onClose();
    },
    onError: (e) => setError(getApiErrorMessage(e)),
  });

  const total = useMemo(
    () => lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0),
    [lines],
  );

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
      return {
        unitPrice: normalPrice,
        normalPrice,
        bulkApplied: false,
        bulkPriceListName: null,
      };
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

  return (
    <Modal
      open={open}
      title={title}
      description="This document does not deduct stock or count as revenue until converted to an official invoice."
      onClose={onClose}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={lines.length === 0 || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Saving…' : 'Create'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="rounded-lg border border-danger-300 bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</div>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium text-ink-muted">Customer (optional)</label>
          <select
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
          >
            <option value="">Walk-in / no customer</option>
            {(customersQ.data?.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>{customerPickerLabel(c)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink-muted">Add product</label>
          <TextInput value={productQ} onChange={(e) => setProductQ(e.target.value)} placeholder="Search products…" />
          {productsQ.data?.data?.length ? (
            <ul className="mt-2 max-h-32 overflow-auto rounded-lg border border-line bg-canvas text-sm">
              {productsQ.data.data.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-3 py-2 hover:bg-surface"
                    onClick={() => addProduct(p)}
                  >
                    <span>{p.name}</span>
                    <span className="text-ink-muted">${p.sellingPrice}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {lines.length > 0 && (
          <div className="space-y-2">
            {lines.map((line, idx) => (
              <div key={line.productId} className="flex flex-wrap items-center gap-2 rounded-lg border border-line p-2">
                <span className="min-w-[120px] flex-1 text-sm font-medium">{line.productName}</span>
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
                                ...(l.priceOverridden
                                  ? {}
                                  : {
                                      unitPrice: priced.unitPrice,
                                      bulkApplied: priced.bulkApplied,
                                      bulkPriceListName: priced.bulkPriceListName,
                                    }),
                              }
                            : l,
                        ),
                      );
                    });
                  }}
                />
                <TextInput
                  type="number"
                  className="w-24"
                  value={line.unitPrice}
                  onChange={(e) => {
                    const unitPrice = Math.max(0, Number(e.target.value) || 0);
                    setLines((prev) =>
                      prev.map((l, i) =>
                        i === idx ? { ...l, unitPrice, priceOverridden: true, bulkApplied: false } : l,
                      ),
                    );
                  }}
                />
                <div className="w-full text-xs text-ink-muted sm:w-auto">
                  {line.bulkApplied && !line.priceOverridden ? (
                    <span className="text-primary-600">Bulk price from {line.bulkPriceListName}</span>
                  ) : line.priceOverridden ? (
                    <span>Manual override</span>
                  ) : (
                    <span>Normal price {formatMoney(line.normalPrice)}</span>
                  )}
                </div>
                <button type="button" onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}>
                  <Trash2 className="h-4 w-4 text-danger-500" />
                </button>
              </div>
            ))}
            <p className="text-right text-sm font-semibold text-ink">Total: ${total.toFixed(2)}</p>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-ink-muted">Notes</label>
            <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-ink-muted">Terms</label>
            <TextInput value={terms} onChange={(e) => setTerms(e.target.value)} />
          </div>
        </div>
        {lines.length === 0 && (
          <p className="flex items-center gap-1 text-xs text-ink-muted">
            <Plus className="h-3 w-3" /> Search and add at least one product line.
          </p>
        )}
      </div>
    </Modal>
  );
}
