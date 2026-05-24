import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { createCustomer, fetchCustomers } from '@/api/customers.api';
import { getApiErrorMessage } from '@/api/client';
import { useAuthStore } from '@/stores/auth-store';
import { useStoreSettings } from '@/hooks/use-store-settings';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/Modal';
import { ErrorBanner } from '@/components/ui/error-banner';
import { Skeleton } from '@/components/ui/skeleton';

const PAGE_SIZE = 20;

export function CustomersPage() {
  const role = useAuthStore((s) => s.user?.role);
  const canManage = role === 'OWNER' || role === 'ADMIN';
  const qc = useQueryClient();
  const { formatMoney: fmt } = useStoreSettings();

  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');

  const listParams = useMemo(() => ({ page, limit: PAGE_SIZE, q: q.trim() || undefined }), [page, q]);

  const listQuery = useQuery({
    queryKey: ['customers', listParams],
    queryFn: () => fetchCustomers(listParams),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createCustomer({
        name: newName.trim(),
        phone: newPhone.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success('Customer created');
      setNewName('');
      setNewPhone('');
      setCreateOpen(false);
      void qc.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Could not create customer'));
    },
  });

  const rows = listQuery.data?.data ?? [];
  const meta = listQuery.data?.meta;
  const totalPages = meta?.totalPages ?? 0;

  return (
    <div className="space-y-8 pb-8">
      <PageHeader
        title="Customers"
        description="Accounts receivable by customer — balances update only through ledger entries."
        actions={
          canManage ? (
            <Button type="button" variant="primary" className="gap-2" onClick={() => setCreateOpen(true)}>
              <UserPlus className="h-4 w-4" aria-hidden />
              New customer
            </Button>
          ) : null
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          placeholder="Search name or phone…"
          className="h-11 w-full max-w-md rounded-xl border border-line bg-canvas px-4 text-sm text-ink outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-500/25 sm:max-w-lg"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
        {listQuery.isLoading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : listQuery.isError ? (
          <div className="p-6">
            <ErrorBanner
              message={getApiErrorMessage(listQuery.error, 'Could not load customers.')}
              onRetry={() => void listQuery.refetch()}
            />
          </div>
        ) : rows.length === 0 ? (
          <p className="px-6 py-14 text-center text-sm text-ink-muted">No customers match your search.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-line bg-canvas text-xs font-semibold uppercase tracking-wide text-ink-faint">
                <tr>
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Phone</th>
                  <th className="px-5 py-3 text-right">Balance owed</th>
                  <th className="px-5 py-3 text-right"> </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((c) => {
                  const bal = Number(c.balance);
                  const debt = bal > 0;
                  return (
                    <tr key={c.id} className="hover:bg-canvas transition-colors">
                      <td className="px-5 py-3.5 font-medium text-ink">{c.name}</td>
                      <td className="px-5 py-3.5 text-ink-muted">{c.phone || '—'}</td>
                      <td
                        className={`px-5 py-3.5 text-right font-semibold tabular-nums ${
                          debt ? 'text-warning-700' : 'text-ink-muted'
                        }`}
                      >
                        {fmt(bal)}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Link
                          to={`/customers/${c.id}`}
                          className="text-sm font-semibold text-primary-600 underline-offset-2 hover:underline"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {meta && meta.totalPages > 1 ? (
          <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-4">
            <p className="text-xs text-ink-muted">
              Page {meta.page} of {meta.totalPages} · {meta.total} customers
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
                Prev
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="gap-1"
              >
                Next
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <Modal
        open={createOpen}
        onClose={() => !createMutation.isPending && setCreateOpen(false)}
        title="New customer"
        description="Phone is optional. Balance always starts at zero until a sale or adjustment posts to the ledger."
        footer={
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setCreateOpen(false)}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={createMutation.isPending || !newName.trim()}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? 'Creating…' : 'Create'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-muted">Name</span>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="h-11 w-full rounded-xl border border-line bg-canvas px-3 text-sm text-ink outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-500/25"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-muted">Phone</span>
            <input
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              className="h-11 w-full rounded-xl border border-line bg-canvas px-3 text-sm text-ink outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-500/25"
            />
          </label>
        </div>
      </Modal>
    </div>
  );
}
