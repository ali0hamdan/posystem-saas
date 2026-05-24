import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { fetchCustomer, fetchCustomerLedger, updateCustomer } from '@/api/customers.api';
import { getApiErrorMessage } from '@/api/client';
import { useAuthStore } from '@/stores/auth-store';
import { useStoreSettings } from '@/hooks/use-store-settings';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/ui/stat-card';
import { Modal } from '@/components/ui/Modal';
import { ErrorBanner } from '@/components/ui/error-banner';
import { Skeleton } from '@/components/ui/skeleton';
import { CustomerPaymentModal } from '@/features/customers/CustomerPaymentModal';
import { AdjustBalanceModal } from '@/features/customers/AdjustBalanceModal';
import type { CustomerLedgerType } from '@/types/customers';

const LEDGER_PAGE = 30;

function ledgerTypeLabel(t: CustomerLedgerType): string {
  switch (t) {
    case 'SALE_CREDIT':
      return 'Sale (on account)';
    case 'PAYMENT':
      return 'Payment';
    case 'ADJUSTMENT':
      return 'Adjustment';
    case 'REFUND':
      return 'Refund';
    default:
      return t;
  }
}

function formatDt(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function CustomerDetailPage() {
  const { id = '' } = useParams();
  const role = useAuthStore((s) => s.user?.role);
  const canManage = role === 'OWNER' || role === 'ADMIN';
  const canPay = canManage || role === 'CASHIER';
  const qc = useQueryClient();
  const { formatMoney: fmt } = useStoreSettings();

  const [ledgerPage, setLedgerPage] = useState(1);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [payOpen, setPayOpen] = useState(false);
  const [adjOpen, setAdjOpen] = useState(false);

  const customerQuery = useQuery({
    queryKey: ['customer', id],
    queryFn: () => fetchCustomer(id),
    enabled: Boolean(id),
  });

  const ledgerQuery = useQuery({
    queryKey: ['customer-ledger', id, ledgerPage],
    queryFn: () => fetchCustomerLedger(id, { page: ledgerPage, limit: LEDGER_PAGE }),
    enabled: Boolean(id),
  });

  const balanceNum = customerQuery.data ? Number(customerQuery.data.balance) : 0;

  const updateMutation = useMutation({
    mutationFn: () =>
      updateCustomer(id, {
        name: editName.trim(),
        phone: editPhone.trim() || null,
      }),
    onSuccess: () => {
      toast.success('Customer updated');
      setEditOpen(false);
      void qc.invalidateQueries({ queryKey: ['customer', id] });
      void qc.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Update failed'));
    },
  });

  const ledgerRows = ledgerQuery.data?.data ?? [];
  const ledgerMeta = ledgerQuery.data?.meta;

  const openEdit = useCallback(() => {
    if (customerQuery.data) {
      setEditName(customerQuery.data.name);
      setEditPhone(customerQuery.data.phone ?? '');
      setEditOpen(true);
    }
  }, [customerQuery.data]);

  if (!id) {
    return <p className="text-sm text-ink-muted">Invalid customer.</p>;
  }

  return (
    <div className="space-y-8 pb-8">
      <div>
        <Link
          to="/customers"
          className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-primary-700 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Customers
        </Link>
        {customerQuery.isLoading ? (
          <Skeleton className="h-10 w-64" />
        ) : customerQuery.isError ? (
          <ErrorBanner
            message={getApiErrorMessage(customerQuery.error, 'Could not load customer.')}
            onRetry={() => void customerQuery.refetch()}
          />
        ) : customerQuery.data ? (
          <PageHeader
            title={customerQuery.data.name}
            description={customerQuery.data.phone ?? 'No phone on file'}
            actions={
              canManage ? (
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" size="sm" className="gap-2" onClick={openEdit}>
                    <Pencil className="h-4 w-4" aria-hidden />
                    Edit
                  </Button>
                  <Button type="button" variant="secondary" size="sm" onClick={() => setAdjOpen(true)}>
                    Adjust balance
                  </Button>
                </div>
              ) : null
            }
          />
        ) : null}
      </div>

      {customerQuery.data ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2">
            <StatCard
              title="Balance owed"
              value={fmt(balanceNum)}
              icon={Wallet}
              subtitle={
                balanceNum > 0
                  ? 'Amount this customer currently owes the store.'
                  : balanceNum < 0
                    ? 'Credit balance (customer is ahead).'
                    : 'No open balance.'
              }
            />
            {canPay && balanceNum > 0 ? (
              <div className="flex items-center rounded-2xl border border-line bg-surface p-5 shadow-card">
                <div className="flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Collect payment</p>
                  <p className="mt-2 text-sm text-ink-muted">Record cash or card received against this account.</p>
                </div>
                <Button type="button" variant="primary" onClick={() => setPayOpen(true)}>
                  Add payment
                </Button>
              </div>
            ) : null}
          </section>

          <section aria-label="Ledger">
            <h2 className="mb-3 font-display text-lg font-semibold text-ink">Ledger</h2>
            <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
              {ledgerQuery.isLoading ? (
                <div className="space-y-2 p-6">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : ledgerQuery.isError ? (
                <div className="p-6">
                  <ErrorBanner
                    message={getApiErrorMessage(ledgerQuery.error, 'Could not load ledger.')}
                    onRetry={() => void ledgerQuery.refetch()}
                  />
                </div>
              ) : ledgerRows.length === 0 ? (
                <p className="px-6 py-12 text-center text-sm text-ink-muted">No ledger entries yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead className="border-b border-line bg-canvas-raised/40 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                      <tr>
                        <th className="px-4 py-3">When</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3 text-right">Amount</th>
                        <th className="px-4 py-3 text-right">Balance after</th>
                        <th className="px-4 py-3">Note</th>
                        <th className="px-4 py-3">Receipt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {ledgerRows.map((row) => (
                        <tr key={row.id} className="hover:bg-primary-50/30">
                          <td className="whitespace-nowrap px-4 py-3 text-ink-muted">{formatDt(row.createdAt)}</td>
                          <td className="px-4 py-3 font-medium text-ink">{ledgerTypeLabel(row.type)}</td>
                          <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-ink">
                            {fmt(Number(row.amount))}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-ink">
                            {fmt(Number(row.balanceAfter))}
                          </td>
                          <td className="max-w-[200px] truncate px-4 py-3 text-xs text-ink-muted">
                            {row.note || '—'}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-ink-muted">
                            {row.receiptNumber || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {ledgerMeta && ledgerMeta.totalPages > 1 ? (
                <div className="flex items-center justify-end gap-2 border-t border-line px-4 py-3">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={ledgerPage <= 1}
                    onClick={() => setLedgerPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <span className="text-xs text-ink-muted">
                    {ledgerPage} / {ledgerMeta.totalPages}
                  </span>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={ledgerPage >= ledgerMeta.totalPages}
                    onClick={() => setLedgerPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              ) : null}
            </div>
          </section>
        </>
      ) : null}

      <Modal
        open={editOpen}
        onClose={() => !updateMutation.isPending && setEditOpen(false)}
        title="Edit customer"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setEditOpen(false)} disabled={updateMutation.isPending}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={updateMutation.isPending || !editName.trim()}
              onClick={() => updateMutation.mutate()}
            >
              {updateMutation.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-muted">Name</span>
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="h-11 w-full rounded-xl border border-line bg-canvas px-3 text-sm outline-none focus:border-primary-300 focus:ring-2 focus:ring-primary-500/20"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-muted">Phone</span>
            <input
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value)}
              className="h-11 w-full rounded-xl border border-line bg-canvas px-3 text-sm outline-none focus:border-primary-300 focus:ring-2 focus:ring-primary-500/20"
            />
          </label>
        </div>
      </Modal>

      <CustomerPaymentModal
        open={payOpen}
        customerId={id}
        customerName={customerQuery.data?.name ?? ''}
        onClose={() => setPayOpen(false)}
      />

      {canManage ? (
        <AdjustBalanceModal
          open={adjOpen}
          customerId={id}
          customerName={customerQuery.data?.name ?? ''}
          onClose={() => setAdjOpen(false)}
        />
      ) : null}
    </div>
  );
}
