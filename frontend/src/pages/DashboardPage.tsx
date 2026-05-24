import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  DollarSign,
  LineChart,
  Package,
  Receipt,
  ShoppingBag,
  Users,
  Warehouse,
} from 'lucide-react';
import { fetchDailySales, fetchDashboard, fetchLowStock } from '@/api/reports.api';
import { getApiErrorMessage } from '@/api/client';
import { useStoreAuthReady } from '@/hooks/use-store-auth-ready';
import { useAuthStore } from '@/stores/auth-store';
import { useStoreSettings } from '@/hooks/use-store-settings';
import { SimpleSalesChart } from '@/features/dashboard/SimpleSalesChart';
import type { DashboardRecentSale, DailySalesPoint, LowStockProductRow } from '@/types/reports';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { ErrorBanner } from '@/components/ui/error-banner';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { DataTableShell, DataTable, Th, Td } from '@/components/ui/data-table';

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function paymentVariant(s: string): 'success' | 'warning' | 'muted' {
  if (s === 'PAID') return 'success';
  if (s === 'PARTIAL') return 'warning';
  return 'muted';
}

function paymentLabel(s: string): string {
  if (s === 'PAID') return 'Paid';
  if (s === 'PARTIAL') return 'Partial';
  if (s === 'UNPAID') return 'Unpaid';
  return s;
}

export function DashboardPage() {
  const authReady = useStoreAuthReady();
  const user = useAuthStore((s) => s.user);
  const isCashier = user?.role === 'CASHIER';
  const { formatMoney: fmt, currency } = useStoreSettings();

  const dashboardQuery = useQuery({
    queryKey: ['reports', 'dashboard'],
    queryFn: fetchDashboard,
    enabled: authReady,
  });

  const dailySalesQuery = useQuery({
    queryKey: ['reports', 'daily-sales', 'dashboard-chart'],
    queryFn: () => fetchDailySales({}),
    staleTime: 60_000,
    enabled: authReady,
  });

  const lowStockQuery = useQuery({
    queryKey: ['reports', 'low-stock', 'dashboard', 1, 6],
    queryFn: () => fetchLowStock({ page: 1, limit: 6 }),
    staleTime: 60_000,
    enabled: authReady,
  });

  const d = dashboardQuery.data;
  const chartPoints: DailySalesPoint[] = dailySalesQuery.data?.data ?? [];
  const chartRangeLabel = useMemo(() => {
    const m = dailySalesQuery.data?.meta;
    if (!m) return undefined;
    return `${m.fromDate} → ${m.toDate}`;
  }, [dailySalesQuery.data?.meta]);

  const lowStockRows: LowStockProductRow[] = lowStockQuery.data?.data ?? [];
  const showChart = chartPoints.length > 0;

  return (
    <div className="space-y-8 pb-8">
      <PageHeader
        title="Dashboard"
        description={
          isCashier
            ? 'Your sales today and shared store inventory signals.'
            : 'Revenue, fulfilment, and inventory at a glance — built for daily operations.'
        }
      />

      {dashboardQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-line bg-surface p-5 shadow-card">
              <Skeleton className="mb-3 h-3 w-24" />
              <Skeleton className="h-8 w-36" />
            </div>
          ))}
        </div>
      ) : dashboardQuery.isError ? (
        <ErrorBanner
          message={getApiErrorMessage(dashboardQuery.error, 'Could not load dashboard.')}
          onRetry={() => void dashboardQuery.refetch()}
        />
      ) : d ? (
        <>
          <section aria-label="Key metrics">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                title="Today sales"
                value={fmt(d.todaySales)}
                icon={DollarSign}
                iconVariant="success"
                subtitle={isCashier ? 'Your checkout revenue today' : 'Gross revenue today'}
              />
              <StatCard
                title="Today profit"
                value={fmt(d.todayProfit)}
                icon={LineChart}
                iconVariant="success"
                subtitle={isCashier ? 'Margin on your sales today' : 'Revenue minus cost of goods sold'}
              />
              <StatCard
                title="Orders today"
                value={String(d.todayOrdersCount)}
                icon={ShoppingBag}
                iconVariant="default"
                subtitle={isCashier ? 'Your completed orders' : 'Non-cancelled orders closed today'}
              />
              <StatCard
                title="Low stock"
                value={String(d.lowStockCount)}
                icon={AlertTriangle}
                iconVariant={d.lowStockCount > 0 ? 'warning' : 'muted'}
                subtitle="SKUs at or below minimum (with stock)"
              />
              <StatCard
                title="Out of stock"
                value={String(d.outOfStockCount)}
                icon={Warehouse}
                iconVariant={d.outOfStockCount > 0 ? 'danger' : 'muted'}
                subtitle="Active products with zero on hand"
              />
              <StatCard
                title="Unpaid sales"
                value={fmt(d.unpaidSalesTotal)}
                icon={Receipt}
                iconVariant={Number(d.unpaidSalesTotal) > 0 ? 'warning' : 'muted'}
                subtitle={isCashier ? 'Your partial / unpaid tickets' : 'Outstanding on unpaid lines'}
              />
              <StatCard title="Products" value={String(d.totalProducts)} icon={Package} iconVariant="muted" subtitle="Active catalogue" />
              <StatCard title="Customers" value={String(d.totalCustomers)} icon={Users} iconVariant="muted" subtitle="On file" />
            </div>
          </section>

          {showChart && !dailySalesQuery.isError ? (
            <SimpleSalesChart points={chartPoints} rangeLabel={chartRangeLabel} currency={currency} />
          ) : dailySalesQuery.isError ? (
            <p className="text-xs text-ink-muted">
              Chart unavailable: {getApiErrorMessage(dailySalesQuery.error, 'Could not load daily sales.')}
            </p>
          ) : null}

          <div className="grid gap-6 xl:grid-cols-12">
            <section className="xl:col-span-7" aria-label="Recent sales">
              <div className="mb-3 flex items-end justify-between gap-3">
                <h2 className="font-display text-lg font-semibold text-ink">Recent sales</h2>
                <Link
                  to="/sales"
                  className="text-sm font-medium text-primary-600 transition hover:text-primary-700"
                >
                  View all →
                </Link>
              </div>
              <DataTableShell>
                <DataTable>
                  <thead>
                    <tr>
                      <Th>Invoice</Th>
                      <Th>When</Th>
                      <Th>Cashier</Th>
                      <Th>Customer</Th>
                      <Th className="text-right">Total</Th>
                      <Th>Payment</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.recentSales.length === 0 ? (
                      <tr>
                        <Td colSpan={6}>
                          <p className="py-10 text-center text-sm text-ink-muted">No recent sales.</p>
                        </Td>
                      </tr>
                    ) : (
                      d.recentSales.map((row) => <RecentSaleRow key={row.id} row={row} />)
                    )}
                  </tbody>
                </DataTable>
              </DataTableShell>
            </section>

            <div className="space-y-6 xl:col-span-5">
              <section aria-label="Best-selling products">
                <h2 className="mb-1 font-display text-lg font-semibold text-ink">Best sellers</h2>
                <p className="mb-3 text-xs text-ink-muted">Last 30 days by units sold.</p>
                <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
                  <ul className="divide-y divide-line">
                    {d.bestSellingProducts.length === 0 ? (
                      <li className="px-4 py-8 text-center text-sm text-ink-muted">No sales in this period.</li>
                    ) : (
                      d.bestSellingProducts.map((p, i) => (
                        <li key={p.productId} className="flex items-center justify-between gap-3 px-4 py-3.5">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-canvas text-xs font-bold text-ink-muted ring-1 ring-line">
                              {i + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate font-medium text-ink">{p.name}</p>
                              <p className="text-xs text-ink-muted">{p.unitsSold} units</p>
                            </div>
                          </div>
                          <p className="shrink-0 text-sm font-semibold tabular-nums text-ink">{fmt(p.revenue)}</p>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </section>

              <section aria-label="Low-stock products">
                <div className="mb-3 flex items-end justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg font-semibold text-ink">Low stock</h2>
                    <p className="mt-0.5 text-xs text-ink-muted">Lowest on-hand first.</p>
                  </div>
                  <Link to="/products" className="text-sm font-medium text-primary-600 hover:text-primary-700">
                    Products →
                  </Link>
                </div>
                {lowStockQuery.isLoading ? (
                  <div className="rounded-2xl border border-line bg-surface p-8 shadow-card">
                    <Skeleton className="mx-auto h-24 w-full max-w-md" />
                  </div>
                ) : lowStockQuery.isError ? (
                  <p className="text-xs text-ink-muted">{getApiErrorMessage(lowStockQuery.error, 'Could not load low stock.')}</p>
                ) : (
                  <DataTableShell minWidthClass="min-w-[400px]">
                    <DataTable>
                      <thead>
                        <tr>
                          <Th>Product</Th>
                          <Th className="text-right">Qty</Th>
                          <Th className="text-right">Min</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {lowStockRows.length === 0 ? (
                          <tr>
                            <Td colSpan={3}>
                              <p className="py-8 text-center text-sm text-ink-muted">No low-stock items.</p>
                            </Td>
                          </tr>
                        ) : (
                          lowStockRows.map((row) => (
                            <tr
                              key={row.id}
                              className={
                                row.quantity === 0
                                  ? 'bg-danger-50/50'
                                  : 'transition-colors hover:bg-canvas'
                              }
                            >
                              <Td>
                                <p className="truncate font-medium text-ink" title={row.name}>
                                  {row.name}
                                </p>
                                {row.quantity === 0 ? (
                                  <Badge variant="danger" className="mt-1 normal-case">
                                    Out of stock
                                  </Badge>
                                ) : null}
                              </Td>
                              <Td className="text-right tabular-nums font-medium text-ink">{row.quantity}</Td>
                              <Td className="text-right tabular-nums text-ink-muted">{row.minStock}</Td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </DataTable>
                  </DataTableShell>
                )}
              </section>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function RecentSaleRow({ row }: { row: DashboardRecentSale }) {
  const { formatMoney: fmt } = useStoreSettings();
  return (
    <tr className="transition-colors hover:bg-canvas">
      <Td className="whitespace-nowrap font-mono text-xs text-ink-muted">{row.invoiceNumber}</Td>
      <Td className="whitespace-nowrap text-ink-muted">{formatDateTime(row.createdAt)}</Td>
      <Td className="max-w-[140px] truncate text-ink" title={row.cashier.name || row.cashier.username}>
        {row.cashier.name || row.cashier.username}
      </Td>
      <Td className="max-w-[120px] truncate text-ink-muted" title={row.customer?.name ?? ''}>
        {row.customer?.name ?? '—'}
      </Td>
      <Td className="whitespace-nowrap text-right font-semibold tabular-nums text-ink">{fmt(row.total)}</Td>
      <Td className="whitespace-nowrap">
        <Badge variant={paymentVariant(row.paymentStatus)} className="normal-case">
          {paymentLabel(row.paymentStatus)}
        </Badge>
      </Td>
    </tr>
  );
}
