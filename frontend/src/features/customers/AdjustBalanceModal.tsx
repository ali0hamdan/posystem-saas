import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { adjustCustomerBalance } from '@/api/customers.api';
import { getApiErrorMessage } from '@/api/client';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';

type Props = {
  open: boolean;
  customerId: string;
  customerName: string;
  onClose: () => void;
};

export function AdjustBalanceModal({ open, customerId, customerName, onClose }: Props) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      adjustCustomerBalance(customerId, {
        amount: Number(amount),
        reason: reason.trim(),
        note: note.trim() || undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['customers'] });
      void qc.invalidateQueries({ queryKey: ['customer', customerId] });
      void qc.invalidateQueries({ queryKey: ['customer-ledger', customerId] });
      toast.success('Balance adjusted');
      setAmount('');
      setReason('');
      setNote('');
      onClose();
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Adjustment failed'));
    },
  });

  function handleClose() {
    if (!mutation.isPending) {
      setAmount('');
      setReason('');
      setNote('');
      onClose();
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Adjust balance"
      description={`Signed amount for ${customerName}: positive increases amount owed, negative reduces it. A ledger entry is always created.`}
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={handleClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={
              mutation.isPending ||
              !amount ||
              Number(amount) === 0 ||
              !reason.trim()
            }
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Saving…' : 'Apply adjustment'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Amount (signed)
          </span>
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="h-11 w-full rounded-xl border border-line bg-canvas px-3 text-sm font-medium tabular-nums outline-none focus:border-primary-300 focus:ring-2 focus:ring-primary-500/20"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Reason (required)
          </span>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="h-11 w-full rounded-xl border border-line bg-canvas px-3 text-sm outline-none focus:border-primary-300 focus:ring-2 focus:ring-primary-500/20"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Internal note (optional)
          </span>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="h-11 w-full rounded-xl border border-line bg-canvas px-3 text-sm outline-none focus:border-primary-300 focus:ring-2 focus:ring-primary-500/20"
          />
        </label>
      </div>
    </Modal>
  );
}
