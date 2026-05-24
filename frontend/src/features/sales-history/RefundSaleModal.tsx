import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import { getApiErrorMessage } from '@/api/client';
import { refundSale } from '@/api/sales.api';
import { remainingItemQty } from '@/lib/sale-refund-helpers';
import type { SaleDetail } from '@/types/sales-history';

type RefundMode = 'full' | 'partial';

type RefundSaleModalProps = {
  sale: SaleDetail | null;
  open: boolean;
  onClose: () => void;
};

export function RefundSaleModal({ sale, open, onClose }: RefundSaleModalProps) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<RefundMode>('full');
  const [reason, setReason] = useState('');
  const [partialQty, setPartialQty] = useState<Record<string, number>>({});

  const remaining = useMemo(() => (sale ? remainingItemQty(sale) : new Map<string, number>()), [sale]);

  useEffect(() => {
    if (!open || !sale) return;
    setMode('full');
    setReason('');
    const init: Record<string, number> = {};
    for (const it of sale.items) {
      init[it.id] = 0;
    }
    setPartialQty(init);
  }, [open, sale]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!sale) throw new Error('No sale');
      const trimmed = reason.trim();
      if (trimmed.length < 3) {
        throw new Error('Please enter a reason (at least 3 characters).');
      }
      if (mode === 'full') {
        return refundSale(sale.id, { reason: trimmed, full: true });
      }
      const items = Object.entries(partialQty)
        .map(([saleItemId, quantity]) => ({ saleItemId, quantity }))
        .filter((x) => x.quantity > 0);
      if (items.length === 0) {
        throw new Error('Select at least one line and quantity for a partial refund.');
      }
      return refundSale(sale.id, { reason: trimmed, items });
    },
    onSuccess: async () => {
      toast.success('Refund recorded');
      if (sale) {
        await queryClient.invalidateQueries({ queryKey: ['sale', sale.id] });
      }
      await queryClient.invalidateQueries({ queryKey: ['sales'] });
      onClose();
    },
    onError: (err) => {
      if (err instanceof Error && !('response' in err)) {
        toast.error(err.message);
        return;
      }
      toast.error(getApiErrorMessage(err, 'Refund failed'));
    },
  });

  if (!sale) return null;

  const anyRemaining = [...remaining.values()].some((q) => q > 0);
  const busy = mutation.isPending;

  function updateLineQty(saleItemId: string, raw: string) {
    const max = remaining.get(saleItemId) ?? 0;
    const n = raw === '' ? 0 : Math.floor(Number(raw));
    if (!Number.isFinite(n) || n < 0) {
      setPartialQty((p) => ({ ...p, [saleItemId]: 0 }));
      return;
    }
    setPartialQty((p) => ({ ...p, [saleItemId]: Math.min(max, n) }));
  }

  function onSubmit() {
    void mutation.mutateAsync();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Refund sale"
      description={`Invoice ${sale.invoiceNumber}`}
      size="lg"
      footer={
        <div className="flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-line px-4 py-2 text-sm text-ink hover:bg-canvas disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void onSubmit()}
            disabled={busy || !anyRemaining}
            className="rounded-lg bg-danger-600 px-4 py-2 text-sm font-semibold text-white hover:bg-danger-500 disabled:opacity-50"
          >
            {busy ? 'Submitting…' : 'Submit refund'}
          </button>
        </div>
      }
    >
      {!anyRemaining ? (
        <p className="text-sm text-ink-muted">There is nothing left to refund on this sale.</p>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
              <input
                type="radio"
                name="refund-mode"
                checked={mode === 'full'}
                onChange={() => setMode('full')}
                className="border-line text-primary-500"
              />
              Full refund (all remaining quantities)
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
              <input
                type="radio"
                name="refund-mode"
                checked={mode === 'partial'}
                onChange={() => setMode('partial')}
                className="border-line text-primary-500"
              />
              Partial refund by line
            </label>
          </div>

          {mode === 'partial' ? (
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full min-w-[520px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-line bg-canvas text-xs font-semibold uppercase tracking-wide text-ink-faint">
                    <th className="px-3 py-2">Product</th>
                    <th className="px-3 py-2 text-right">Remaining</th>
                    <th className="px-3 py-2 text-right">Refund qty</th>
                  </tr>
                </thead>
                <tbody>
                  {sale.items.map((it) => {
                    const max = remaining.get(it.id) ?? 0;
                    if (max <= 0) {
                      return (
                        <tr key={it.id} className="border-b border-line text-ink-faint">
                          <td className="px-3 py-2">{it.product.name}</td>
                          <td className="px-3 py-2 text-right tabular-nums">0</td>
                          <td className="px-3 py-2 text-right">—</td>
                        </tr>
                      );
                    }
                    return (
                      <tr key={it.id} className="border-b border-line">
                        <td className="px-3 py-2 text-ink">{it.product.name}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-ink-muted">{max}</td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            min={0}
                            max={max}
                            value={partialQty[it.id] ?? 0}
                            onChange={(e) => updateLineQty(it.id, e.target.value)}
                            className="w-24 rounded-lg border border-line bg-canvas px-2 py-1 text-right text-sm text-ink outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-500/25"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}

          <div>
            <label htmlFor="refund-reason" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Reason <span className="text-danger-500">*</span>
            </label>
            <textarea
              id="refund-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe why this refund is being issued"
              className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-500/25"
            />
            <p className="mt-1 text-xs text-ink-faint">Minimum 3 characters.</p>
          </div>

          <p className="text-xs text-ink-faint">
            Totals are calculated on the server based on original line pricing. Stock will be returned for the quantities
            refunded.
          </p>
        </div>
      )}
    </Modal>
  );
}
