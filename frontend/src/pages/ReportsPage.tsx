import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowLeft,
  Building2,
  CreditCard,
  Download,
  FileSpreadsheet,
  FileText,
  Landmark,
  Layers,
  Package,
  Percent,
  PieChart,
  Printer,
  Receipt,
  RefreshCw,
  ShoppingCart,
  TrendingUp,
  Truck,
  Users,
  Warehouse,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  fetchBranchComparison,
  fetchCustomerDebtReport,
  fetchDiscountsReport,
  fetchGrossProfitByCategory,
  fetchGrossProfitByProduct,
  fetchInventoryMovements,
  fetchPaymentMethodsReport,
  fetchProductsExpiryReport,
  fetchProfitAndLoss,
  fetchSalesSummary,
  fetchShiftClosingReport,
  fetchStockValuationReport,
  fetchSupplierPurchasesReport,
} from '@/api/commercial-reports.api';
import {
  fetchCashierPerformance,
  fetchCustomerPaymentHistory,
  fetchDailySales,
  fetchLowStock,
  fetchRefundsReport,
} from '@/api/reports.api';
import { fetchBranches } from '@/api/branches.api';
import { fetchCategories } from '@/api/categories.api';
import { fetchSaleFilterUsers } from '@/api/sales.api';
import { getApiErrorMessage } from '@/api/client';
import { useAuthStore } from '@/stores/auth-store';
import { useStoreSettings } from '@/hooks/use-store-settings';
import type { SaleFilterUser } from '@/types/sales-history';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { ErrorBanner } from '@/components/ui/error-banner';
import { Skeleton } from '@/components/ui/skeleton';
import {
  exportJsonToExcel,
  exportTableToPdf,
  printHtmlReport,
  tableFromColumns,
} from '@/lib/report-export';

type ReportId =
  | 'hub'
  | 'sales-summary'
  | 'profit-and-loss'
  | 'gross-profit-by-product'
  | 'gross-profit-by-category'
  | 'cashier-performance'
  | 'payment-methods'
  | 'refunds'
  | 'discounts'
  | 'stock-valuation'
  | 'inventory-movements'
  | 'low-stock'
  | 'products-expiry'
  | 'supplier-purchases'
  | 'customer-debt'
  | 'customer-payments'
  | 'shift-closing'
  | 'branch-comparison';

type Filters = {
  fromDate: string;
  toDate: string;
  branchId: string;
  cashierId: string;
  categoryId: string;
  productId: string;
  imPage: number;
};

function defaultDateRange(): Pick<Filters, 'fromDate' | 'toDate'> {
  const to = new Date();
  const from = new Date();
  from.setUTCDate(from.getUTCDate() - 30);
  return { fromDate: from.toISOString().slice(0, 10), toDate: to.toISOString().slice(0, 10) };
}

const REPORT_CARDS: Array<{
  id: Exclude<ReportId, 'hub'>;
  title: string;
  description: string;
  icon: LucideIcon;
  roles?: Array<'OWNER' | 'ADMIN' | 'CASHIER'>;
}> = [
  {
    id: 'sales-summary',
    title: 'Sales summary',
    description: 'Orders, revenue, COGS from sale-time cost, discounts, and tax for the range.',
    icon: TrendingUp,
    roles: ['OWNER', 'ADMIN', 'CASHIER'],
  },
  {
    id: 'profit-and-loss',
    title: 'Profit & loss',
    description: 'Net revenue, COGS at sale, gross profit, and recorded expenses.',
    icon: PieChart,
  },
  {
    id: 'gross-profit-by-product',
    title: 'Gross profit by product',
    description: 'Net units, revenue, and margin using cost captured on each sale line.',
    icon: Package,
  },
  {
    id: 'gross-profit-by-category',
    title: 'Gross profit by category',
    description: 'Category roll-up of net revenue and sale-time COGS.',
    icon: Layers,
  },
  {
    id: 'cashier-performance',
    title: 'Cashier performance',
    description: 'Per-cashier orders, net revenue, and gross profit.',
    icon: Users,
  },
  {
    id: 'payment-methods',
    title: 'Payment methods',
    description: 'Split of tender types for completed sales in range.',
    icon: CreditCard,
  },
  {
    id: 'refunds',
    title: 'Refunds',
    description: 'Refund transactions with user and linked sale.',
    icon: Receipt,
  },
  {
    id: 'discounts',
    title: 'Discounts',
    description: 'Line-level and sale-level discounts by day.',
    icon: Percent,
  },
  {
    id: 'stock-valuation',
    title: 'Stock valuation',
    description: 'On-hand quantity × current unit cost (inventory value, not sale COGS).',
    icon: Warehouse,
  },
  {
    id: 'inventory-movements',
    title: 'Inventory movements',
    description: 'Stock ledger entries with product and reason.',
    icon: RefreshCw,
  },
  {
    id: 'low-stock',
    title: 'Low stock',
    description: 'Products at or below minimum for this branch.',
    icon: Package,
    roles: ['OWNER', 'ADMIN', 'CASHIER'],
  },
  {
    id: 'products-expiry',
    title: 'Expiry & near-expiry',
    description: 'Products with expiry date set and on-hand stock in this branch.',
    icon: Landmark,
  },
  {
    id: 'supplier-purchases',
    title: 'Supplier purchases',
    description: 'Purchase orders by supplier (non-cancelled) in range.',
    icon: Truck,
  },
  {
    id: 'customer-debt',
    title: 'Customer debt',
    description: 'Total AR and ranked customers with positive balance.',
    icon: Landmark,
  },
  {
    id: 'customer-payments',
    title: 'Customer payments',
    description: 'Ledger payment lines with receipt numbers.',
    icon: ShoppingCart,
  },
  {
    id: 'shift-closing',
    title: 'Shift closing',
    description: 'Closed shifts with cash variance and shift-scoped net sales.',
    icon: Building2,
  },
  {
    id: 'branch-comparison',
    title: 'Branch comparison',
    description: 'Net revenue and gross profit by branch (owners, multi-branch).',
    icon: Building2,
    roles: ['OWNER'],
  },
];

async function fetchReport(id: Exclude<ReportId, 'hub'>, f: Filters): Promise<unknown> {
  // Shared date-range + optional filter params (all fields accepted by ReportsDateRangeQueryDto)
  const dateRange = {
    fromDate: f.fromDate,
    toDate: f.toDate,
    branchId: f.branchId || undefined,
    cashierId: f.cashierId || undefined,
    categoryId: f.categoryId || undefined,
    productId: f.productId || undefined,
  };
  // branchId only — for endpoints whose DTO doesn't accept dates or cashier/category filters
  const branchOnly = { branchId: f.branchId || undefined };

  switch (id) {
    case 'sales-summary':
      return fetchSalesSummary(dateRange);
    case 'profit-and-loss':
      return fetchProfitAndLoss(dateRange);
    case 'gross-profit-by-product':
      return fetchGrossProfitByProduct({ ...dateRange, limit: 50 });
    case 'gross-profit-by-category':
      return fetchGrossProfitByCategory(dateRange);
    case 'cashier-performance':
      return fetchCashierPerformance(dateRange);
    case 'payment-methods':
      return fetchPaymentMethodsReport(dateRange);
    case 'refunds':
      // RefundsReportQueryDto accepts: page, limit, branchId, fromDate, toDate, cashierId, shiftId — no categoryId/productId
      return fetchRefundsReport({
        fromDate: f.fromDate,
        toDate: f.toDate,
        branchId: f.branchId || undefined,
        cashierId: f.cashierId || undefined,
        page: 1,
        limit: 50,
      });
    case 'discounts':
      return fetchDiscountsReport(dateRange);
    case 'stock-valuation':
      // ReportsPaginationQueryDto — only page, limit, branchId; no date range
      return fetchStockValuationReport({ ...branchOnly, page: 1, limit: 100 });
    case 'inventory-movements':
      // InventoryMovementsQueryDto accepts: page, limit, branchId, fromDate, toDate, productId, type — no cashierId/categoryId
      return fetchInventoryMovements({
        fromDate: f.fromDate,
        toDate: f.toDate,
        branchId: f.branchId || undefined,
        productId: f.productId || undefined,
        page: f.imPage,
        limit: 50,
      });
    case 'low-stock':
      return fetchLowStock({ page: 1, limit: 50, branchId: f.branchId || undefined });
    case 'products-expiry':
      // ProductExpiryReportQueryDto — only page, limit, branchId, daysAhead; no date range
      return fetchProductsExpiryReport({ ...branchOnly, page: 1, limit: 50, daysAhead: 90 });
    case 'supplier-purchases':
      return fetchSupplierPurchasesReport(dateRange);
    case 'customer-debt':
      return fetchCustomerDebtReport({ page: 1, limit: 50 });
    case 'customer-payments':
      // CustomerPaymentHistoryQueryDto accepts: page, limit, branchId, fromDate, toDate, customerId — no cashierId/categoryId/productId
      return fetchCustomerPaymentHistory({
        fromDate: f.fromDate,
        toDate: f.toDate,
        branchId: f.branchId || undefined,
        page: 1,
        limit: 50,
      });
    case 'shift-closing':
      return fetchShiftClosingReport(dateRange);
    case 'branch-comparison':
      return fetchBranchComparison({ fromDate: f.fromDate, toDate: f.toDate });
    default:
      throw new Error('Unknown report');
  }
}

function extractRows(payload: unknown): Record<string, unknown>[] {
  if (!payload || typeof payload !== 'object') return [];
  const o = payload as Record<string, unknown>;
  if (Array.isArray(o.data)) return o.data as Record<string, unknown>[];
  if (Array.isArray(o)) return o as Record<string, unknown>[];
  return [o];
}

function getCellValue(row: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((cur, key) => {
    if (cur == null || typeof cur !== 'object') return undefined;
    return (cur as Record<string, unknown>)[key];
  }, row);
}

function reportColumns(
  id: Exclude<ReportId, 'hub'>,
): { header: string; dataKey: string }[] | null {
  switch (id) {
    case 'payment-methods':
      return [
        { header: 'Method', dataKey: 'method' },
        { header: 'Count', dataKey: 'paymentCount' },
        { header: 'Amount', dataKey: 'amount' },
        { header: '% share', dataKey: 'shareOfTotal' },
      ];
    case 'gross-profit-by-product':
      return [
        { header: 'Product', dataKey: 'name' },
        { header: 'Units sold', dataKey: 'unitsSold' },
        { header: 'Net revenue', dataKey: 'netRevenue' },
        { header: 'COGS', dataKey: 'costOfGoodsSold' },
        { header: 'Gross profit', dataKey: 'grossProfit' },
      ];
    case 'gross-profit-by-category':
      return [
        { header: 'Category', dataKey: 'name' },
        { header: 'Units sold', dataKey: 'unitsSold' },
        { header: 'Net revenue', dataKey: 'netRevenue' },
        { header: 'COGS', dataKey: 'costOfGoodsSold' },
        { header: 'Gross profit', dataKey: 'grossProfit' },
      ];
    case 'cashier-performance':
      return [
        { header: 'Cashier', dataKey: 'name' },
        { header: 'Orders', dataKey: 'ordersCount' },
        { header: 'Net revenue', dataKey: 'revenue' },
        { header: 'Gross profit', dataKey: 'profit' },
      ];
    case 'supplier-purchases':
      return [
        { header: 'Supplier', dataKey: 'name' },
        { header: 'PO count', dataKey: 'purchaseOrdersCount' },
        { header: 'Total', dataKey: 'totalValue' },
      ];
    case 'customer-debt':
      return [
        { header: 'Customer', dataKey: 'name' },
        { header: 'Phone', dataKey: 'phone' },
        { header: 'Balance', dataKey: 'balance' },
      ];
    case 'low-stock':
      return [
        { header: 'Product', dataKey: 'name' },
        { header: 'SKU', dataKey: 'sku' },
        { header: 'On hand', dataKey: 'quantity' },
        { header: 'Min stock', dataKey: 'minStock' },
      ];
    case 'refunds':
      return [
        { header: 'Date', dataKey: 'createdAt' },
        { header: 'Invoice', dataKey: 'sale.invoiceNumber' },
        { header: 'Refunded by', dataKey: 'user.name' },
        { header: 'Amount', dataKey: 'totalRefunded' },
        { header: 'Reason', dataKey: 'reason' },
      ];
    case 'stock-valuation':
      return [
        { header: 'Product', dataKey: 'name' },
        { header: 'SKU', dataKey: 'sku' },
        { header: 'On hand', dataKey: 'quantity' },
        { header: 'Unit cost', dataKey: 'unitCost' },
        { header: 'Total value', dataKey: 'lineValue' },
      ];
    case 'inventory-movements':
      return [
        { header: 'Date', dataKey: 'createdAt' },
        { header: 'Product', dataKey: 'product.name' },
        { header: 'Type', dataKey: 'type' },
        { header: 'Qty', dataKey: 'quantity' },
        { header: 'User', dataKey: 'createdBy.name' },
        { header: 'Note', dataKey: 'note' },
      ];
    case 'products-expiry':
      return [
        { header: 'Product', dataKey: 'name' },
        { header: 'SKU', dataKey: 'sku' },
        { header: 'On hand', dataKey: 'quantity' },
        { header: 'Expiry date', dataKey: 'expiryDate' },
        { header: 'Status', dataKey: 'status' },
      ];
    case 'customer-payments':
      return [
        { header: 'Date', dataKey: 'createdAt' },
        { header: 'Customer', dataKey: 'customer.name' },
        { header: 'Amount', dataKey: 'amount' },
        { header: 'Received by', dataKey: 'createdBy.name' },
        { header: 'Note', dataKey: 'note' },
      ];
    case 'shift-closing':
      return [
        { header: 'Opened', dataKey: 'openedAt' },
        { header: 'Closed', dataKey: 'closedAt' },
        { header: 'Cashier', dataKey: 'cashier.name' },
        { header: 'Sales', dataKey: 'salesCount' },
        { header: 'Opening cash', dataKey: 'openingCash' },
        { header: 'Variance', dataKey: 'difference' },
        { header: 'Net revenue', dataKey: 'netRevenue' },
      ];
    case 'branch-comparison':
      return [
        { header: 'Branch', dataKey: 'name' },
        { header: 'Code', dataKey: 'code' },
        { header: 'Orders', dataKey: 'ordersCount' },
        { header: 'Net revenue', dataKey: 'netRevenue' },
        { header: 'COGS', dataKey: 'costOfGoodsSold' },
        { header: 'Gross profit', dataKey: 'grossProfit' },
      ];
    default:
      return null;
  }
}

export function ReportsPage() {
  const role = useAuthStore((s) => s.user?.role);
  const isOwner = role === 'OWNER';
  const isAdmin = role === 'ADMIN';
  const canSeeFinancial = isOwner || isAdmin;
  const { formatMoney: fmt } = useStoreSettings();

  const dates = useMemo(() => defaultDateRange(), []);
  const [selected, setSelected] = useState<ReportId>('hub');
  const [filters, setFilters] = useState<Filters>({
    ...dates,
    branchId: '',
    cashierId: '',
    categoryId: '',
    productId: '',
    imPage: 1,
  });

  const branchesQuery = useQuery({
    queryKey: ['branches'],
    queryFn: fetchBranches,
    enabled: Boolean(isOwner || isAdmin),
  });

  const cashiersQuery = useQuery({
    queryKey: ['report-filter-users'],
    queryFn: fetchSaleFilterUsers,
    enabled: canSeeFinancial && selected !== 'hub',
  });

  const categoriesQuery = useQuery({
    queryKey: ['report-categories'],
    queryFn: () => fetchCategories({ limit: 200, page: 1 }),
    enabled: canSeeFinancial && selected === 'gross-profit-by-product',
  });

  const reportQuery = useQuery({
    queryKey: ['report', selected, filters],
    queryFn: () => fetchReport(selected as Exclude<ReportId, 'hub'>, filters),
    enabled: selected !== 'hub',
  });

  const dailyForChart = useQuery({
    queryKey: ['report-chart-daily', filters],
    queryFn: () =>
      fetchDailySales({
        fromDate: filters.fromDate,
        toDate: filters.toDate,
        cashierId: filters.cashierId || undefined,
        branchId: filters.branchId || undefined,
      }),
    enabled: selected === 'sales-summary',
  });

  const visibleCards = useMemo(
    () =>
      REPORT_CARDS.filter((c) => {
        if (!c.roles) return canSeeFinancial || c.id === 'low-stock';
        return c.roles.includes(role as 'OWNER' | 'ADMIN' | 'CASHIER');
      }),
    [canSeeFinancial, role],
  );

  const onExportExcel = useCallback(async () => {
    if (!reportQuery.data || selected === 'hub') return;
    const rows = extractRows(reportQuery.data);
    const cols = reportColumns(selected as Exclude<ReportId, 'hub'>);
    if (cols && rows.length) {
      await exportJsonToExcel(
        `${selected}-${filters.fromDate}-${filters.toDate}`,
        selected,
        rows.map((r) => {
          const o: Record<string, unknown> = {};
          for (const c of cols) o[c.header] = r[c.dataKey];
          return o;
        }),
      );
    } else {
      await exportJsonToExcel(`${selected}-${filters.fromDate}`, selected, rows.length ? rows : [{ payload: reportQuery.data }]);
    }
    toast.success('Excel file downloaded');
  }, [reportQuery.data, selected, filters.fromDate, filters.toDate]);

  const onExportPdf = useCallback(() => {
    if (!reportQuery.data || selected === 'hub') return;
    const rows = extractRows(reportQuery.data);
    const cols = reportColumns(selected as Exclude<ReportId, 'hub'>);
    if (cols && rows.length) {
      exportTableToPdf(
        REPORT_CARDS.find((c) => c.id === selected)?.title ?? selected,
        `${selected}-${filters.fromDate}`,
        cols,
        rows,
      );
      toast.success('PDF downloaded');
    } else {
      toast.message('Use Excel for this report', { description: 'Structured rows work best in spreadsheet format.' });
    }
  }, [reportQuery.data, selected, filters.fromDate]);

  const onPrint = useCallback(() => {
    if (!reportQuery.data || selected === 'hub') return;
    const rows = extractRows(reportQuery.data);
    const cols = reportColumns(selected as Exclude<ReportId, 'hub'>);
    const title = REPORT_CARDS.find((c) => c.id === selected)?.title ?? selected;
    if (cols && rows.length) {
      const html = tableFromColumns(cols, rows);
      if (!printHtmlReport(title, html)) toast.error('Allow pop-ups to print');
    } else {
      if (!printHtmlReport(title, `<pre>${JSON.stringify(reportQuery.data, null, 2)}</pre>`)) {
        toast.error('Allow pop-ups to print');
      }
    }
  }, [reportQuery.data, selected]);

  const paymentChartData = useMemo(() => {
    if (selected !== 'payment-methods' || !reportQuery.data) return [];
    const rows = extractRows(reportQuery.data);
    return rows.map((r) => ({
      name: String(r.method ?? ''),
      amount: Number(r.amount ?? 0),
    }));
  }, [selected, reportQuery.data]);

  const gpProductChart = useMemo(() => {
    if (selected !== 'gross-profit-by-product' || !reportQuery.data) return [];
    return extractRows(reportQuery.data)
      .slice(0, 12)
      .map((r) => ({
        name: String(r.name ?? '').slice(0, 18),
        profit: Number(r.grossProfit ?? 0),
      }));
  }, [selected, reportQuery.data]);

  const discountChartData = useMemo(() => {
    if (selected !== 'discounts' || !reportQuery.data) return [];
    const o = reportQuery.data as { byDay?: { date: string; totalDiscounts: string }[] };
    return (o.byDay ?? []).map((d) => ({
      date: d.date,
      discounts: Number(d.totalDiscounts),
    }));
  }, [selected, reportQuery.data]);

  const dailyChartData = useMemo(() => {
    const d = dailyForChart.data;
    if (!d?.data) return [];
    return d.data.map((pt) => ({
      date: pt.date,
      revenue: Number(pt.revenue),
    }));
  }, [dailyForChart.data]);

  if (selected === 'hub') {
    return (
      <div className="space-y-8 pb-10">
        <PageHeader
          title="Reports"
          description="Commercial POS reporting. Sale gross profit uses cost captured on each line at checkout (costPriceAtSale), not the current product cost."
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visibleCards.map((c) => {
            const Icon = c.icon;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setSelected(c.id);
                  setFilters((s) => ({ ...s, imPage: 1 }));
                }}
                className="flex flex-col rounded-2xl border border-line bg-surface p-5 text-left shadow-card transition hover:border-primary-300 hover:shadow-soft"
              >
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-primary-50 text-primary-700">
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <h2 className="font-display text-lg font-semibold text-ink">{c.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">{c.description}</p>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const title = REPORT_CARDS.find((c) => c.id === selected)?.title ?? selected;

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Button type="button" variant="ghost" size="sm" className="mb-2 gap-1 px-0" onClick={() => setSelected('hub')}>
            <ArrowLeft className="h-4 w-4" aria-hidden />
            All reports
          </Button>
          <PageHeader title={title} description="Filters apply to the next load. Financial metrics use sale-time COGS." />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" size="sm" className="gap-2" onClick={onExportExcel}>
            <FileSpreadsheet className="h-4 w-4" aria-hidden />
            Excel
          </Button>
          <Button type="button" variant="secondary" size="sm" className="gap-2" onClick={onExportPdf}>
            <FileText className="h-4 w-4" aria-hidden />
            PDF
          </Button>
          <Button type="button" variant="secondary" size="sm" className="gap-2" onClick={onPrint}>
            <Printer className="h-4 w-4" aria-hidden />
            Print
          </Button>
          <Button
            type="button"
            variant="outlinePrimary"
            size="sm"
            className="gap-2"
            onClick={() => void reportQuery.refetch()}
          >
            <Download className="h-4 w-4" aria-hidden />
            Refresh
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-5">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-muted">Filters</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          <label className="text-xs font-semibold text-ink-muted">
            From
            <input
              type="date"
              value={filters.fromDate}
              onChange={(e) => setFilters((s) => ({ ...s, fromDate: e.target.value }))}
              className="mt-1 block h-10 w-full rounded-lg border border-line bg-canvas px-2 text-sm"
            />
          </label>
          <label className="text-xs font-semibold text-ink-muted">
            To
            <input
              type="date"
              value={filters.toDate}
              onChange={(e) => setFilters((s) => ({ ...s, toDate: e.target.value }))}
              className="mt-1 block h-10 w-full rounded-lg border border-line bg-canvas px-2 text-sm"
            />
          </label>
          {isOwner ? (
            <label className="text-xs font-semibold text-ink-muted">
              Branch (query)
              <select
                value={filters.branchId}
                onChange={(e) => setFilters((s) => ({ ...s, branchId: e.target.value }))}
                className="mt-1 block h-10 w-full rounded-lg border border-line bg-canvas px-2 text-sm"
              >
                <option value="">Default / header branch</option>
                {(branchesQuery.data ?? []).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {canSeeFinancial && selected !== 'branch-comparison' ? (
            <label className="text-xs font-semibold text-ink-muted">
              Cashier
              <select
                value={filters.cashierId}
                onChange={(e) => setFilters((s) => ({ ...s, cashierId: e.target.value }))}
                className="mt-1 block h-10 w-full rounded-lg border border-line bg-canvas px-2 text-sm"
              >
                <option value="">All</option>
                {(cashiersQuery.data ?? []).map((u: SaleFilterUser) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {selected === 'gross-profit-by-product' ? (
            <label className="text-xs font-semibold text-ink-muted">
              Category
              <select
                value={filters.categoryId}
                onChange={(e) => setFilters((s) => ({ ...s, categoryId: e.target.value }))}
                className="mt-1 block h-10 w-full rounded-lg border border-line bg-canvas px-2 text-sm"
              >
                <option value="">All</option>
                {(categoriesQuery.data?.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <p className="text-xs text-ink-muted">
            Changing dates or filters updates the report automatically. Use Refresh if the server data may have
            changed.
          </p>
        </div>
      </div>

      {reportQuery.isLoading ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : reportQuery.isError ? (
        <ErrorBanner message={getApiErrorMessage(reportQuery.error, 'Report failed')} onRetry={() => void reportQuery.refetch()} />
      ) : (
        <ReportBody
          id={selected}
          data={reportQuery.data}
          fmt={fmt}
          paymentChartData={paymentChartData}
          gpProductChart={gpProductChart}
          discountChartData={discountChartData}
          dailyChartData={dailyChartData}
          summaryExtra={
            selected === 'sales-summary' && reportQuery.data
              ? (reportQuery.data as Record<string, unknown>)
              : null
          }
        />
      )}
    </div>
  );
}

function ReportTable({
  cols,
  rows,
  fmt,
}: {
  cols: { header: string; dataKey: string }[];
  rows: Record<string, unknown>[];
  fmt: (n: string | number) => string;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-line bg-canvas-raised/50 text-xs font-semibold uppercase text-ink-muted">
          <tr>
            {cols.map((c) => (
              <th key={c.dataKey} className="px-4 py-3">
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-primary-50/30">
              {cols.map((c) => (
                <td key={c.dataKey} className="px-4 py-2.5 tabular-nums text-ink">
                  {formatCell(getCellValue(r, c.dataKey), c.dataKey, fmt)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReportBody({
  id,
  data,
  fmt,
  paymentChartData,
  gpProductChart,
  discountChartData,
  dailyChartData,
  summaryExtra,
}: {
  id: ReportId;
  data: unknown;
  fmt: (n: string | number) => string;
  paymentChartData: { name: string; amount: number }[];
  gpProductChart: { name: string; profit: number }[];
  discountChartData: { date: string; discounts: number }[];
  dailyChartData: { date: string; revenue: number }[];
  summaryExtra: Record<string, unknown> | null;
}) {
  if (id === 'hub' || !data) return null;

  // ── Sales summary ──────────────────────────────────────────────────────────
  if (id === 'sales-summary' && summaryExtra) {
    const m = summaryExtra.meta as Record<string, unknown> | undefined;
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Stat label="Orders" value={String(summaryExtra.ordersCount ?? '')} />
          <Stat label="Net revenue" value={fmt(Number(summaryExtra.netRevenue ?? 0))} />
          <Stat label="COGS (sale-time)" value={fmt(Number(summaryExtra.costOfGoodsSold ?? 0))} />
          <Stat label="Gross profit" value={fmt(Number(summaryExtra.grossProfit ?? 0))} />
          <Stat label="Tax collected" value={fmt(Number(summaryExtra.sumTax ?? 0))} />
          <Stat label="Line discounts" value={fmt(Number(summaryExtra.sumLineDiscounts ?? 0))} />
          <Stat label="Sale-level discounts" value={fmt(Number(summaryExtra.sumSaleLevelDiscounts ?? 0))} />
        </div>
        {m ? (
          <p className="text-xs text-ink-muted">
            Range {String(m.fromDate)} → {String(m.toDate)}
          </p>
        ) : null}
        {dailyChartData.length > 0 ? (
          <div className="h-72 rounded-2xl border border-line bg-canvas p-4">
            <h4 className="mb-2 text-sm font-semibold text-ink">Daily net revenue (same filters)</h4>
            <ResponsiveContainer width="100%" height="90%">
              <LineChart data={dailyChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Line type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={2} dot={false} name="Revenue" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : null}
      </div>
    );
  }

  // ── Profit & loss ──────────────────────────────────────────────────────────
  if (id === 'profit-and-loss' && data && typeof data === 'object') {
    const d = data as Record<string, unknown>;
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label="Net revenue" value={fmt(Number(d.netRevenue ?? 0))} />
        <Stat label="COGS (sale-time)" value={fmt(Number(d.costOfGoodsSold ?? 0))} />
        <Stat label="Gross profit" value={fmt(Number(d.grossProfit ?? 0))} />
        <Stat label="Operating expenses" value={fmt(Number(d.operatingExpenses ?? 0))} />
        <Stat label="Net operating income" value={fmt(Number(d.netOperatingIncome ?? 0))} />
      </div>
    );
  }

  // ── Discounts ──────────────────────────────────────────────────────────────
  if (id === 'discounts' && data && typeof data === 'object') {
    const d = data as {
      totalLineDiscounts?: string;
      totalSaleLevelDiscounts?: string;
      totalDiscounts?: string;
      byDay?: { date: string; lineDiscounts: string; saleLevelDiscounts: string; totalDiscounts: string }[];
    };
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Line discounts" value={fmt(Number(d.totalLineDiscounts ?? 0))} />
          <Stat label="Sale-level discounts" value={fmt(Number(d.totalSaleLevelDiscounts ?? 0))} />
          <Stat label="Total discounts" value={fmt(Number(d.totalDiscounts ?? 0))} />
        </div>
        {discountChartData.length > 0 ? (
          <div className="h-72 rounded-2xl border border-line bg-canvas p-4">
            <h4 className="mb-2 text-sm font-semibold text-ink">Daily discount trend</h4>
            <ResponsiveContainer width="100%" height="90%">
              <LineChart data={discountChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Line type="monotone" dataKey="discounts" stroke="#d97706" strokeWidth={2} name="Discounts" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : null}
        {(d.byDay ?? []).length > 0 ? (
          <div className="overflow-x-auto rounded-2xl border border-line">
            <table className="w-full min-w-[500px] text-left text-sm">
              <thead className="border-b border-line bg-canvas-raised/50 text-xs font-semibold uppercase text-ink-muted">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Line discounts</th>
                  <th className="px-4 py-3 text-right">Sale-level discounts</th>
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {(d.byDay ?? []).map((row, i) => (
                  <tr key={i} className="hover:bg-primary-50/30">
                    <td className="px-4 py-2.5 text-ink">{row.date}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-ink">{fmt(Number(row.lineDiscounts))}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-ink">{fmt(Number(row.saleLevelDiscounts))}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-ink">{fmt(Number(row.totalDiscounts))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    );
  }

  // ── Customer debt — summary stats + table ──────────────────────────────────
  if (id === 'customer-debt' && data && typeof data === 'object') {
    const d = data as { summary?: { totalDebt?: string; debtorCount?: number } };
    const rows = extractRows(data);
    const cols = reportColumns('customer-debt')!;
    return (
      <div className="space-y-6">
        {d.summary ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Stat label="Total accounts receivable" value={fmt(Number(d.summary.totalDebt ?? 0))} />
            <Stat label="Customers with balance" value={String(d.summary.debtorCount ?? 0)} />
          </div>
        ) : null}
        {rows.length > 0 ? <ReportTable cols={cols} rows={rows} fmt={fmt} /> : (
          <p className="text-sm text-ink-muted">No customers with outstanding balance.</p>
        )}
      </div>
    );
  }

  // ── Stock valuation — total value stat + table ─────────────────────────────
  if (id === 'stock-valuation' && data && typeof data === 'object') {
    const d = data as { meta?: { totalInventoryValue?: string } };
    const rows = extractRows(data);
    const cols = reportColumns('stock-valuation')!;
    return (
      <div className="space-y-6">
        {d.meta?.totalInventoryValue != null ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Stat label="Total inventory value (on-hand × cost)" value={fmt(Number(d.meta.totalInventoryValue))} />
            <Stat label="Products with stock" value={String(rows.length)} />
          </div>
        ) : null}
        {rows.length > 0 ? <ReportTable cols={cols} rows={rows} fmt={fmt} /> : (
          <p className="text-sm text-ink-muted">No stock found for this branch.</p>
        )}
      </div>
    );
  }

  // ── Branch comparison — availability check + table ─────────────────────────
  if (id === 'branch-comparison') {
    const d = data as { available?: boolean; message?: string };
    if (!d.available) {
      return (
        <div className="rounded-xl border border-line bg-canvas px-5 py-4 text-sm text-ink-muted">
          {d.message ?? 'Branch comparison requires at least two active branches.'}
        </div>
      );
    }
    // available=true: fall through to generic table below
  }

  // ── Generic: optional chart(s) + table ────────────────────────────────────
  const rows = extractRows(data);
  const cols = reportColumns(id as Exclude<ReportId, 'hub'>);

  const chartEl =
    id === 'payment-methods' && paymentChartData.length > 0 ? (
      <div className="h-80 rounded-2xl border border-line bg-canvas p-4">
        <h4 className="mb-2 text-sm font-semibold text-ink">Payment split by amount</h4>
        <ResponsiveContainer width="100%" height="90%">
          <BarChart data={paymentChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip formatter={(v: number) => fmt(v)} />
            <Bar dataKey="amount" fill="#2563eb" name="Amount" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    ) : id === 'gross-profit-by-product' && gpProductChart.length > 0 ? (
      <div className="h-80 rounded-2xl border border-line bg-canvas p-4">
        <h4 className="mb-2 text-sm font-semibold text-ink">Top products by gross profit</h4>
        <ResponsiveContainer width="100%" height="90%">
          <BarChart data={gpProductChart} layout="vertical" margin={{ left: 16, right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis type="number" />
            <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v: number) => fmt(v)} />
            <Bar dataKey="profit" fill="#059669" name="Gross profit" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    ) : null;

  const tableEl = cols && rows.length > 0 ? <ReportTable cols={cols} rows={rows} fmt={fmt} /> : null;

  if (!chartEl && !tableEl) {
    return (
      <p className="text-sm text-ink-muted">No data for the selected filters and date range.</p>
    );
  }

  return (
    <div className="space-y-6">
      {chartEl}
      {tableEl}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-canvas p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="mt-2 text-lg font-semibold tabular-nums text-ink">{value}</p>
    </div>
  );
}

function formatCell(val: unknown, path: string, fmt: (n: string | number) => string): string {
  if (val == null) return '—';

  const parts = path.split('.');
  const key = parts[parts.length - 1] ?? path;

  const isMoneyKey =
    key.includes('revenue') || key.includes('Revenue') ||
    key.includes('profit') || key.includes('Profit') ||
    key.includes('amount') || key.includes('Amount') ||
    key.includes('balance') || key.includes('Balance') ||
    key.includes('cost') || key.includes('Cost') ||
    key.includes('value') || key.includes('Value') ||
    key.includes('Cash') || key === 'difference' ||
    key === 'totalRefunded' || key === 'totalValue' ||
    key === 'netRevenue' || key === 'grossProfit';

  const isDateKey =
    key === 'createdAt' || key === 'updatedAt' ||
    key === 'openedAt' || key === 'closedAt' ||
    key === 'expiryDate' || key === 'expiresAt';

  const isPercentKey = key === 'shareOfTotal' || key.startsWith('share');

  if (typeof val === 'string') {
    if (isDateKey && /^\d{4}-\d{2}-\d{2}/.test(val)) {
      try {
        return new Date(val).toLocaleDateString(undefined, {
          year: 'numeric', month: 'short', day: '2-digit',
        });
      } catch { return val; }
    }
    if (isPercentKey) {
      const n = Number(val);
      return Number.isNaN(n) ? val : `${n.toFixed(1)}%`;
    }
    if (isMoneyKey) {
      const n = Number(val);
      if (!Number.isNaN(n)) return fmt(n);
    }
    return val || '—';
  }

  if (typeof val === 'number') {
    if (isMoneyKey) return fmt(val);
    return String(val);
  }

  if (typeof val === 'object') return '—';
  return String(val);
}
