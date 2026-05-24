import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Printer } from 'lucide-react';
import { toast } from 'sonner';
import { recordCustomerPayment } from '@/api/customers.api';
import { getApiErrorMessage } from '@/api/client';
import { useStoreSettings } from '@/hooks/use-store-settings';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import type { CustomerPaymentResult } from '@/types/customers';

type Props = {
  open: boolean;
  customerId: string;
  customerName: string;
  onClose: () => void;
};

export function CustomerPaymentModal({ open, customerId, customerName, onClose }: Props) {
  const qc = useQueryClient();
  const { formatMoney: fmt } = useStoreSettings();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [receipt, setReceipt] = useState<CustomerPaymentResult | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      recordCustomerPayment(customerId, {
        amount: Number(amount),
        note: note.trim() || undefined,
      }),
    onSuccess: (res) => {
      setReceipt(res);
      void qc.invalidateQueries({ queryKey: ['customers'] });
      void qc.invalidateQueries({ queryKey: ['customer', customerId] });
      void qc.invalidateQueries({ queryKey: ['customer-ledger', customerId] });
      toast.success('Payment recorded');
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Payment failed'));
    },
  });

  function handleClose() {
    setAmount('');
    setNote('');
    setReceipt(null);
    onClose();
  }

  function printReceipt() {
    if (!receipt) return;
    const w = window.open('', '_blank', 'width=420,height=640');
    if (!w) {
      toast.error('Pop-up blocked — allow pop-ups to print.');
      return;
    }
    const paid = fmt(Number(receipt.amountApplied));
    const bal = fmt(Number(receipt.customer.balance));
    w.document.write(`<!DOCTYPE html><html><head><title>Receipt ${receipt.receiptNumber}</title>
      <style>
        body{font-family:system-ui,sans-serif;padding:24px;color:#111}
        h1{font-size:18px;margin:0 0 8px}
        .muted{color:#555;font-size:13px}
        table{width:100%;border-collapse:collapse;margin-top:16px;font-size:14px}
        td{padding:6px 0;border-bottom:1px solid #eee}
        .num{text-align:right;font-variant-numeric:tabular-nums}
      </style></head><body>
      <h1>Payment receipt</h1>
      <p class="muted">${receipt.receiptNumber}</p>
      <p><strong>Customer</strong><br/>${customerName}</p>
      <table>
        <tr><td>Amount received</td><td class="num">${paid}</td></tr>
        <tr><td>Balance after</td><td class="num">${bal}</td></tr>
      </table>
      <p class="muted" style="margin-top:24px">Thank you.</p>
      <script>window.onload=function(){window.print();}</script>
      </body></html>`);
    w.document.close();
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={receipt ? 'Receipt' : 'Record payment'}
      description={receipt ? undefined : `Apply a payment toward the balance for ${customerName}.`}
      footer={
        receipt ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={handleClose}>
              Close
            </Button>
            <Button type="button" variant="primary" className="gap-2" onClick={() => void printReceipt()}>
              <Printer className="h-4 w-4" aria-hidden />
              Print receipt
            </Button>
          </div>
        ) : (
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={mutation.isPending || !amount || Number(amount) <= 0}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? 'Saving…' : 'Record payment'}
            </Button>
          </div>
        )
      }
    >
      {receipt ? (
        <div className="space-y-3 text-sm">
          <p>
            <span className="text-ink-muted">Receipt </span>
            <span className="font-mono font-semibold text-ink">{receipt.receiptNumber}</span>
          </p>
          <p>
            <span className="text-ink-muted">Applied </span>
            <span className="font-semibold tabular-nums text-ink">{fmt(Number(receipt.amountApplied))}</span>
          </p>
          <p>
            <span className="text-ink-muted">New balance </span>
            <span className="font-semibold tabular-nums text-ink">{fmt(Number(receipt.customer.balance))}</span>
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Amount
            </span>
            <input
              type="number"
              min={0.01}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-11 w-full rounded-xl border border-line bg-canvas px-3 text-sm font-medium tabular-nums outline-none focus:border-primary-300 focus:ring-2 focus:ring-primary-500/20"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Note (optional)
            </span>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="h-11 w-full rounded-xl border border-line bg-canvas px-3 text-sm outline-none focus:border-primary-300 focus:ring-2 focus:ring-primary-500/20"
            />
          </label>
        </div>
      )}
    </Modal>
  );
}
