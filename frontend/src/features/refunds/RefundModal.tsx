import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { getApiErrorMessage } from '@/api/client';
import {
  createRefund,
  fetchRefundable,
  type CreateRefundBody,
  type RefundSourceType,
  type RestockAction,
} from '@/api/refunds.api';
import {
  RefundApprovalSection,
  buildRefundApprovalPayload,
  validateRefundApprovalInput,
} from '@/features/refunds/RefundApprovalSection';
import { useStoreSettings } from '@/hooks/use-store-settings';

const RESTOCK_OPTIONS: { value: RestockAction; label: string }[] = [
  { value: 'RESTOCK', label: 'Return to stock' },
  { value: 'DAMAGED', label: 'Damaged' },
  { value: 'DISCARD', label: 'Discard' },
  { value: 'NO_RESTOCK', label: 'No restock' },
];

type RefundModalProps = {
  open: boolean;
  onClose: () => void;
  sourceType: RefundSourceType;
  sourceId: string | null;
  sourceLabel?: string;
};

export function RefundModal({ open, onClose, sourceType, sourceId, sourceLabel }: RefundModalProps) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'full' | 'partial'>('full');
  const [reason, setReason] = useState('');
  const [approvalIdCode, setApprovalIdCode] = useState('');
  const [nfcCardUid, setNfcCardUid] = useState('');
  const [approvalPin, setApprovalPin] = useState('');
  const { settings } = useStoreSettings();
  const approvalMethod = settings?.refundApprovalMethod ?? 'APPROVAL_ID';
  const [partialQty, setPartialQty] = useState<Record<string, number>>({});
  const [restockByItem, setRestockByItem] = useState<Record<string, RestockAction>>({});
  const [lastRefundId, setLastRefundId] = useState<string | null>(null);

  const refundableQuery = useQuery({
    queryKey: ['refundable', sourceType, sourceId],
    queryFn: () => fetchRefundable(sourceType, sourceId!),
    enabled: open && Boolean(sourceId),
  });

  const tx = refundableQuery.data;

  useEffect(() => {
    if (!open || !tx) return;
    setMode('full');
    setReason('');
    setApprovalIdCode('');
    setNfcCardUid('');
    setApprovalPin('');
    setLastRefundId(null);
    const qty: Record<string, number> = {};
    const restock: Record<string, RestockAction> = {};
    for (const it of tx.items) {
      qty[it.sourceItemId] = 0;
      restock[it.sourceItemId] = it.defaultRestockAction ?? (sourceType === 'FNB_ORDER' ? 'NO_RESTOCK' : 'RESTOCK');
    }
    setPartialQty(qty);
    setRestockByItem(restock);
  }, [open, tx, sourceType]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!sourceId || !tx) throw new Error('No transaction');
      const trimmed = reason.trim();
      if (trimmed.length < 3) throw new Error('Please enter a reason (at least 3 characters).');
      const approvalError = validateRefundApprovalInput(approvalMethod, {
        approvalIdCode,
        nfcCardUid,
        approvalPin,
      });
      if (approvalError) throw new Error(approvalError);

      const body: CreateRefundBody = {
        sourceType,
        sourceId,
        reason: trimmed,
        full: mode === 'full',
        ...buildRefundApprovalPayload(approvalMethod, { approvalIdCode, nfcCardUid, approvalPin }),
      };

      if (mode === 'partial') {
        body.items = Object.entries(partialQty)
          .filter(([, q]) => q > 0)
          .map(([sourceItemId, quantity]) => ({
            sourceItemId,
            quantity,
            restockAction: restockByItem[sourceItemId],
          }));
        if (!body.items.length) throw new Error('Select at least one line and quantity.');
      }

      return createRefund(body);
    },
    onSuccess: async (result) => {
      toast.success(`Refund ${result.refundNumber} recorded`);
      setLastRefundId(result.id);
      await queryClient.invalidateQueries({ queryKey: ['refunds'] });
      await queryClient.invalidateQueries({ queryKey: ['refundable', sourceType, sourceId] });
      await queryClient.invalidateQueries({ queryKey: ['sales'] });
      await queryClient.invalidateQueries({ queryKey: ['sale'] });
    },
    onError: (err) => {
      if (err instanceof Error && !('response' in err)) {
        toast.error(err.message);
        return;
      }
      toast.error(getApiErrorMessage(err, 'Refund failed'));
    },
  });

  const anyRemaining = useMemo(
    () => tx?.items.some((i) => i.remainingRefundable > 0) ?? false,
    [tx],
  );

  if (!sourceId) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Process refund"
      description={sourceLabel ?? tx?.sourceNumber ?? 'Refund transaction'}
      size="lg"
    >
      {refundableQuery.isLoading ? (
        <p className="text-sm text-ink-muted">Loading refundable details…</p>
      ) : refundableQuery.isError ? (
        <p className="text-sm text-danger-600">
          {getApiErrorMessage(refundableQuery.error, 'Cannot load transaction for refund.')}
        </p>
      ) : tx ? (
        <div className="space-y-4">
          <div className="grid gap-2 rounded-xl border border-line bg-surface-muted/40 p-3 text-sm sm:grid-cols-2">
            <div>
              <span className="text-ink-muted">Total paid</span>
              <p className="font-medium">{tx.paidAmount}</p>
            </div>
            <div>
              <span className="text-ink-muted">Already refunded</span>
              <p className="font-medium">{tx.totalRefunded}</p>
            </div>
            <div>
              <span className="text-ink-muted">Remaining refundable</span>
              <p className="font-medium">{tx.remainingRefundableAmount}</p>
            </div>
            <div>
              <span className="text-ink-muted">Status</span>
              <p className="font-medium">{tx.status}</p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${mode === 'full' ? 'bg-primary-500 text-white' : 'border border-line'}`}
              onClick={() => setMode('full')}
            >
              Full refund
            </button>
            <button
              type="button"
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${mode === 'partial' ? 'bg-primary-500 text-white' : 'border border-line'}`}
              onClick={() => setMode('partial')}
            >
              Partial refund
            </button>
          </div>

          {mode === 'partial' ? (
            <div className="max-h-64 overflow-auto rounded-xl border border-line">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase text-ink-muted">
                    <th className="px-3 py-2">Item</th>
                    <th className="px-3 py-2">Remaining</th>
                    <th className="px-3 py-2">Qty</th>
                    {sourceType !== 'FNB_ORDER' ? <th className="px-3 py-2">Restock</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {tx.items.map((it) => (
                    <tr key={it.sourceItemId} className="border-b border-line/60">
                      <td className="px-3 py-2">{it.name}</td>
                      <td className="px-3 py-2">{it.remainingRefundable}</td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={0}
                          max={it.remainingRefundable}
                          className="w-16 rounded border border-line px-2 py-1"
                          value={partialQty[it.sourceItemId] ?? 0}
                          onChange={(e) => {
                            const n = Math.min(
                              it.remainingRefundable,
                              Math.max(0, Math.floor(Number(e.target.value) || 0)),
                            );
                            setPartialQty((p) => ({ ...p, [it.sourceItemId]: n }));
                          }}
                        />
                      </td>
                      {sourceType !== 'FNB_ORDER' ? (
                        <td className="px-3 py-2">
                          <select
                            className="rounded border border-line px-2 py-1 text-xs"
                            value={restockByItem[it.sourceItemId] ?? 'RESTOCK'}
                            onChange={(e) =>
                              setRestockByItem((p) => ({
                                ...p,
                                [it.sourceItemId]: e.target.value as RestockAction,
                              }))
                            }
                          >
                            {RESTOCK_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <RefundApprovalSection
            approvalIdCode={approvalIdCode}
            onApprovalIdCodeChange={setApprovalIdCode}
            nfcCardUid={nfcCardUid}
            onNfcCardUidChange={setNfcCardUid}
            approvalPin={approvalPin}
            onApprovalPinChange={setApprovalPin}
            disabled={mutation.isPending}
          />

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-ink-muted">Reason</label>
            <textarea
              className="w-full rounded-xl border border-line px-3 py-2 text-sm"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Customer return, wrong item, etc."
            />
          </div>

          {lastRefundId ? (
            <div className="rounded-xl border border-success-300 bg-success-50 p-4 text-sm dark:border-success-500/30 dark:bg-success-500/10">
              <p className="font-medium text-success-800 dark:text-success-300">Refund completed successfully.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  to={`/refunds/${lastRefundId}/print`}
                  className="inline-flex items-center justify-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-500"
                  onClick={onClose}
                >
                  Print refund receipt
                </Link>
                <Button type="button" variant="secondary" onClick={onClose}>
                  Close
                </Button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-xs text-amber-700">
                Refunds cannot be undone after completion. This refund will be approved using the provided manager
                approval ID. Continue?
              </p>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={!anyRemaining || mutation.isPending}
                  onClick={() => mutation.mutate()}
                >
                  {mutation.isPending ? 'Processing…' : 'Confirm refund'}
                </Button>
              </div>
            </>
          )}
        </div>
      ) : null}
    </Modal>
  );
}
