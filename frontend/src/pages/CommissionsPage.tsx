import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  approveCommission,
  cancelCommission,
  fetchCommissionSummary,
  fetchCommissions,
  markCommissionPaid,
} from '@/api/commissions.api';
import { fetchUsers } from '@/api/users.api';
import { getApiErrorMessage } from '@/api/client';
import { ErrorBanner } from '@/components/ui/error-banner';
import { Button } from '@/components/ui/button';
import { formatMoney } from '@/lib/format-money';
import { usePermissions } from '@/hooks/use-permissions';
import type { CommissionSourceType, CommissionStatus } from '@/types/commissions';

const PAGE_SIZE = 20;

function formatSourceType(value: CommissionSourceType): string {
  return value === 'WHOLESALE_INVOICE' ? 'Wholesale invoice' : 'Retail sale';
}

export function CommissionsPage() {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const canApprove = can('commissions:approve');
  const canMarkPaid = can('commissions:mark_paid');
  const canViewAll = can('commissions:view');

  const [page, setPage] = useState(1);
  const [salesmanId, setSalesmanId] = useState('');
  const [status, setStatus] = useState<CommissionStatus | ''>('');
  const [sourceType, setSourceType] = useState<CommissionSourceType | ''>('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const listParams = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      salesmanId: salesmanId || undefined,
      status: status || undefined,
      sourceType: sourceType || undefined,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
    }),
    [page, salesmanId, status, sourceType, fromDate, toDate],
  );

  const usersQuery = useQuery({
    queryKey: ['users', 'commission-filter'],
    queryFn: () => fetchUsers({ limit: 200 }),
    enabled: canViewAll,
  });

  const listQuery = useQuery({
    queryKey: ['commissions', listParams],
    queryFn: () => fetchCommissions(listParams),
  });

  const summaryQuery = useQuery({
    queryKey: ['commissions', 'summary', listParams],
    queryFn: () => fetchCommissionSummary(listParams),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['commissions'] });
  };

  const approveM = useMutation({
    mutationFn: approveCommission,
    onSuccess: () => {
      toast.success('Commission approved');
      invalidate();
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Could not approve commission')),
  });

  const paidM = useMutation({
    mutationFn: markCommissionPaid,
    onSuccess: () => {
      toast.success('Commission marked as paid');
      invalidate();
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Could not mark commission paid')),
  });

  const cancelM = useMutation({
    mutationFn: cancelCommission,
    onSuccess: () => {
      toast.success('Commission cancelled');
      invalidate();
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Could not cancel commission')),
  });

  const rows = listQuery.data?.data ?? [];
  const meta = listQuery.data?.meta;
  const summary = summaryQuery.data;
  const salesmen = (usersQuery.data?.data ?? []).filter((u) => u.role === 'SALESMAN');

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink md:text-3xl">Sales commissions</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Track salesman commissions from completed retail sales and wholesale official invoices.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: 'Pending', value: summary?.pending },
          { label: 'Approved', value: summary?.approved },
          { label: 'Paid', value: summary?.paid },
          { label: 'Sales base', value: summary?.totalSalesBase },
          { label: 'Refund adjustments', value: summary?.totalAdjustments },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-line bg-surface p-4 shadow-card">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{card.label}</p>
            <p className="mt-1 text-xl font-semibold text-ink">{formatMoney(card.value ?? 0)}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 rounded-xl border border-line bg-surface p-4 shadow-card md:grid-cols-5">
        {canViewAll ? (
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-muted">Salesman</label>
            <select
              className="h-10 w-full rounded-lg border border-line bg-canvas px-3 text-sm"
              value={salesmanId}
              onChange={(e) => {
                setPage(1);
                setSalesmanId(e.target.value);
              }}
            >
              <option value="">All salesmen</option>
              {salesmen.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-muted">Status</label>
          <select
            className="h-10 w-full rounded-lg border border-line bg-canvas px-3 text-sm"
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value as CommissionStatus | '');
            }}
          >
            <option value="">All</option>
            <option value="PENDING">Pending</option>
            <option value="ADJUSTED">Adjusted</option>
            <option value="APPROVED">Approved</option>
            <option value="PAID">Paid</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-muted">Source</label>
          <select
            className="h-10 w-full rounded-lg border border-line bg-canvas px-3 text-sm"
            value={sourceType}
            onChange={(e) => {
              setPage(1);
              setSourceType(e.target.value as CommissionSourceType | '');
            }}
          >
            <option value="">All</option>
            <option value="RETAIL_SALE">Retail sale</option>
            <option value="WHOLESALE_INVOICE">Wholesale invoice</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-muted">From</label>
          <input
            type="date"
            className="h-10 w-full rounded-lg border border-line bg-canvas px-3 text-sm"
            value={fromDate}
            onChange={(e) => {
              setPage(1);
              setFromDate(e.target.value);
            }}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-muted">To</label>
          <input
            type="date"
            className="h-10 w-full rounded-lg border border-line bg-canvas px-3 text-sm"
            value={toDate}
            onChange={(e) => {
              setPage(1);
              setToDate(e.target.value);
            }}
          />
        </div>
      </div>

      {listQuery.isError ? <ErrorBanner message={getApiErrorMessage(listQuery.error, 'Could not load commissions.')} /> : null}

      <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-card">
        <table className="w-full min-w-[1100px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wide text-ink-muted">
              <th className="px-4 py-3">Salesman</th>
              <th className="px-3 py-3">Source</th>
              <th className="px-3 py-3">Number</th>
              <th className="px-3 py-3">Base</th>
              <th className="px-3 py-3">Rate / type</th>
              <th className="px-3 py-3">Commission</th>
              <th className="px-3 py-3">Adjustment</th>
              <th className="px-3 py-3">Final</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Date</th>
              <th className="px-3 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-8 text-center text-ink-muted">
                  No commissions found.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-line/60 last:border-b-0">
                  <td className="px-4 py-3">{row.salesman?.name ?? row.salesmanId.slice(0, 8)}</td>
                  <td className="px-3 py-3">{formatSourceType(row.sourceType)}</td>
                  <td className="px-3 py-3 font-mono text-xs">{row.sourceNumber}</td>
                  <td className="px-3 py-3">{formatMoney(row.baseAmount)}</td>
                  <td className="px-3 py-3">
                    {row.commissionType === 'PERCENTAGE'
                      ? `${row.commissionRate ?? 0}%`
                      : row.commissionType === 'FIXED_PER_SALE'
                        ? 'Fixed'
                        : '—'}
                  </td>
                  <td className="px-3 py-3">{formatMoney(row.commissionAmount)}</td>
                  <td className="px-3 py-3">{formatMoney(row.adjustedCommissionAmount)}</td>
                  <td className="px-3 py-3 font-medium">{formatMoney(row.finalCommissionAmount)}</td>
                  <td className="px-3 py-3">{row.status}</td>
                  <td className="px-3 py-3 whitespace-nowrap text-ink-muted">
                    {new Date(row.calculatedAt).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-1">
                      {canApprove && row.status !== 'PAID' && row.status !== 'CANCELLED' ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={approveM.isPending}
                          onClick={() => approveM.mutate(row.id)}
                        >
                          Approve
                        </Button>
                      ) : null}
                      {canMarkPaid && row.status !== 'PAID' && row.status !== 'CANCELLED' ? (
                        <Button
                          size="sm"
                          disabled={paidM.isPending}
                          onClick={() => paidM.mutate(row.id)}
                        >
                          Mark paid
                        </Button>
                      ) : null}
                      {canApprove && row.status !== 'PAID' ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={cancelM.isPending}
                          onClick={() => cancelM.mutate(row.id)}
                        >
                          Cancel
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {meta && meta.totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink-muted">
            Page {meta.page} of {meta.totalPages}
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
