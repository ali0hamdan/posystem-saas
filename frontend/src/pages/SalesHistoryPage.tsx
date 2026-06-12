import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Eye, Plus, Printer } from 'lucide-react';
import { Link } from 'react-router-dom';
import { fetchSaleFilterUsers, fetchSales } from '@/api/sales.api';
import { getApiErrorMessage } from '@/api/client';
import { useAuthStore } from '@/stores/auth-store';
import { formatMoney } from '@/lib/format-money';
import { SaleDetailModal } from '@/features/sales-history/SaleDetailModal';
import { RefundModal } from '@/features/refunds/RefundModal';
import { roleMatches } from '@/components/auth/RoleRoute';
import type { RefundSourceType } from '@/api/refunds.api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import type { SaleDetail, SaleLifecycleStatus, SaleListRow, SalePaymentStatus } from '@/types/sales-history';
import { b2bPrintPath } from '@/features/wholesale/print/print-paths';

const PAGE_SIZE = 20;

const PAYMENT_STATUSES: SalePaymentStatus[] = ['PAID', 'PARTIAL', 'UNPAID'];
const SALE_STATUSES: SaleLifecycleStatus[] = ['COMPLETED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'CANCELLED'];

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function paymentStatusLabel(s: string): string {
  switch (s) {
    case 'PAID': return 'Paid';
    case 'PARTIAL': return 'Partial';
    case 'UNPAID': return 'Unpaid';
    default: return s;
  }
}

function saleStatusLabel(s: string): string {
  switch (s) {
    case 'COMPLETED': return 'Completed';
    case 'REFUNDED': return 'Refunded';
    case 'PARTIALLY_REFUNDED': return 'Partial refund';
    case 'CANCELLED': return 'Cancelled';
    default: return s;
  }
}

function payBadgeVariant(s: string): 'success' | 'warning' | 'muted' {
  if (s === 'PAID') return 'success';
  if (s === 'PARTIAL') return 'warning';
  return 'muted';
}

function saleBadgeVariant(s: string): 'primary' | 'danger' | 'warning' | 'muted' {
  if (s === 'COMPLETED') return 'primary';
  if (s === 'REFUNDED') return 'danger';
  if (s === 'PARTIALLY_REFUNDED') return 'warning';
  return 'muted';
}

const filterInputClass =
  'w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-500/25';

export function SalesHistoryPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const wholesaleInvoices = location.pathname.includes('/wholesale/invoices');
  const user = useAuthStore((s) => s.user);
  const role = user?.role;
  const canRefund = roleMatches(role, ['OWNER', 'ADMIN', 'MANAGER', 'GENERAL_MANAGER', 'CO_MANAGER']);
  const isAdmin = roleMatches(role, ['OWNER', 'ADMIN', 'MANAGER', 'GENERAL_MANAGER']);

  const [page, setPage] = useState(1);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [cashierId, setCashierId] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'' | SalePaymentStatus>('');
  const [saleStatus, setSaleStatus] = useState<'' | SaleLifecycleStatus>('');

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailSaleId, setDetailSaleId] = useState<string | null>(null);
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundSourceId, setRefundSourceId] = useState<string | null>(null);
  const [refundSourceLabel, setRefundSourceLabel] = useState('');

  useEffect(() => {
    setPage(1);
  }, [fromDate, toDate, cashierId, paymentStatus, saleStatus]);

  const listParams = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
      cashierId: isAdmin && cashierId ? cashierId : undefined,
      paymentStatus: paymentStatus || undefined,
      status: saleStatus || undefined,
    }),
    [page, fromDate, toDate, cashierId, paymentStatus, saleStatus, isAdmin],
  );

  const salesQuery = useQuery({
    queryKey: ['sales', listParams],
    queryFn: () => fetchSales(listParams),
  });

  const cashiersQuery = useQuery({
    queryKey: ['sales', 'filter-users'],
    queryFn: fetchSaleFilterUsers,
    staleTime: 60_000,
    enabled: isAdmin,
  });

  const rows = salesQuery.data?.data ?? [];
  const meta = salesQuery.data?.meta;
  const totalPages = meta?.totalPages ?? 0;

  function openDetail(id: string) {
    setDetailSaleId(id);
    setDetailOpen(true);
  }

  function closeDetail() {
    setDetailOpen(false);
    setDetailSaleId(null);
  }

  function handleRequestRefund(sale: SaleDetail) {
    setRefundSourceId(sale.id);
    setRefundSourceLabel(sale.invoiceNumber);
    setRefundOpen(true);
  }

  function closeRefund() {
    setRefundOpen(false);
    setRefundSourceId(null);
    setRefundSourceLabel('');
  }

  const refundSourceType: RefundSourceType = wholesaleInvoices ? 'WHOLESALE_INVOICE' : 'RETAIL_SALE';

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <PageHeader
        title={wholesaleInvoices ? 'Official invoices' : 'Sales history'}
        description={
          wholesaleInvoices
            ? 'B2B official invoices — stock, revenue, and customer balances are updated on creation.'
            : 'Browse past sales, payments, and refunds.'
        }
        actions={
          wholesaleInvoices ? (
            <Link to="/wholesale/invoices/new">
              <Button variant="primary" className="gap-2">
                <Plus className="h-4 w-4" aria-hidden />
                New invoice
              </Button>
            </Link>
          ) : null
        }
      />

      {/* Filters */}
      <div className="rounded-xl border border-line bg-surface p-4 shadow-card md:p-5">
        <div className="grid gap-4 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-2">
            <label htmlFor="sh-from" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-faint">
              From
            </label>
            <input id="sh-from" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={filterInputClass} />
          </div>
          <div className="lg:col-span-2">
            <label htmlFor="sh-to" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-faint">
              To
            </label>
            <input id="sh-to" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className={filterInputClass} />
          </div>
          {isAdmin ? (
            <div className="lg:col-span-3">
              <label htmlFor="sh-cashier" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-faint">
                Cashier
              </label>
              <select id="sh-cashier" value={cashierId} onChange={(e) => setCashierId(e.target.value)} className={filterInputClass}>
                <option value="">All cashiers</option>
                {(cashiersQuery.data ?? []).map((u) => (
                  <option key={u.id} value={u.id}>{u.name || u.username} ({u.username})</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="hidden lg:col-span-3 lg:block" aria-hidden />
          )}
          <div className="lg:col-span-2">
            <label htmlFor="sh-pay" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-faint">
              Payment
            </label>
            <select id="sh-pay" value={paymentStatus} onChange={(e) => setPaymentStatus((e.target.value as SalePaymentStatus | '') || '')} className={filterInputClass}>
              <option value="">All</option>
              {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{paymentStatusLabel(s)}</option>)}
            </select>
          </div>
          <div className="lg:col-span-2">
            <label htmlFor="sh-sale" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-faint">
              Status
            </label>
            <select id="sh-sale" value={saleStatus} onChange={(e) => setSaleStatus((e.target.value as SaleLifecycleStatus | '') || '')} className={filterInputClass}>
              <option value="">All</option>
              {SALE_STATUSES.map((s) => <option key={s} value={s}>{saleStatusLabel(s)}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
        {salesQuery.isLoading ? (
          <div className="flex min-h-[200px] items-center justify-center text-sm text-ink-muted">Loading sales…</div>
        ) : salesQuery.isError ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm text-danger-700">{getApiErrorMessage(salesQuery.error, 'Could not load sales.')}</p>
            <Button type="button" variant="secondary" size="sm" onClick={() => void salesQuery.refetch()} className="mt-3">
              Retry
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1100px] w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-canvas text-xs font-semibold uppercase tracking-wide text-ink-faint">
                  <th className="whitespace-nowrap px-4 py-3">Invoice</th>
                  <th className="whitespace-nowrap px-4 py-3">Date</th>
                  <th className="px-4 py-3">Cashier</th>
                  <th className="px-4 py-3">Salesman</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right">Total</th>
                  <th className="whitespace-nowrap px-4 py-3">Payment</th>
                  <th className="whitespace-nowrap px-4 py-3">Status</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-sm text-ink-muted">No sales match your filters.</td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <SaleTableRow
                      key={row.id}
                      row={row}
                      onView={() => openDetail(row.id)}
                      onPrint={wholesaleInvoices ? () => navigate(b2bPrintPath('invoice', row.id, true)) : undefined}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {meta && totalPages > 0 ? (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm text-ink-muted sm:flex-row">
            <p>Page {meta.page} of {totalPages} · {meta.total} sales</p>
            <div className="flex items-center gap-2">
              <Button type="button" variant="secondary" size="sm" disabled={page <= 1 || salesQuery.isFetching} onClick={() => setPage((p) => Math.max(1, p - 1))} className="gap-1">
                <ChevronLeft className="h-4 w-4" />Prev
              </Button>
              <Button type="button" variant="secondary" size="sm" disabled={page >= totalPages || salesQuery.isFetching} onClick={() => setPage((p) => p + 1)} className="gap-1">
                Next<ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <SaleDetailModal
        saleId={detailSaleId}
        open={detailOpen}
        onClose={closeDetail}
        canRefund={canRefund}
        onRequestRefund={handleRequestRefund}
        onPrint={
          wholesaleInvoices && detailSaleId
            ? () => navigate(b2bPrintPath('invoice', detailSaleId, true))
            : undefined
        }
      />
      <RefundModal
        open={refundOpen}
        onClose={closeRefund}
        sourceType={refundSourceType}
        sourceId={refundSourceId}
        sourceLabel={refundSourceLabel}
      />
    </div>
  );
}

function SaleTableRow({
  row,
  onView,
  onPrint,
}: {
  row: SaleListRow;
  onView: () => void;
  onPrint?: () => void;
}) {
  return (
    <tr className="border-b border-line transition-colors hover:bg-canvas">
      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-primary-600">{row.invoiceNumber}</td>
      <td className="whitespace-nowrap px-4 py-3 text-ink-muted">{formatDateTime(row.createdAt)}</td>
      <td className="px-4 py-3 text-ink">{row.cashier.name || row.cashier.username}</td>
      <td className="px-4 py-3 text-ink-muted">
        {row.salesman
          ? `${row.salesman.name}${row.salesman.salesmanIdCode ? ` (${row.salesman.salesmanIdCode})` : ''}`
          : '—'}
      </td>
      <td className="max-w-[200px] truncate px-4 py-3 text-ink-muted" title={row.customer?.name ?? ''}>{row.customer?.name ?? '—'}</td>
      <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums text-ink">{formatMoney(row.total)}</td>
      <td className="whitespace-nowrap px-4 py-3">
        <Badge variant={payBadgeVariant(row.paymentStatus)} className="normal-case">{paymentStatusLabel(row.paymentStatus)}</Badge>
      </td>
      <td className="whitespace-nowrap px-4 py-3">
        <Badge variant={saleBadgeVariant(row.status)} className="normal-case">{saleStatusLabel(row.status)}</Badge>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right">
        <div className="flex justify-end gap-1">
          <Button type="button" variant="ghost" size="xs" onClick={onView} className="gap-1">
            <Eye className="h-3.5 w-3.5" aria-hidden />View
          </Button>
          {onPrint ? (
            <Button type="button" variant="ghost" size="xs" onClick={onPrint} className="gap-1">
              <Printer className="h-3.5 w-3.5" aria-hidden />Print
            </Button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
