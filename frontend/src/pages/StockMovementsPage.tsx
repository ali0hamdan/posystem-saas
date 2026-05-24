import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ChevronLeft, ChevronRight, Package } from 'lucide-react';
import { fetchStockMovements } from '@/api/stock-movements.api';
import { fetchProducts } from '@/api/products.api';
import { getApiErrorMessage } from '@/api/client';
import { useAuthStore } from '@/stores/auth-store';
import { CASHIER_CAN_VIEW_STOCK_MOVEMENTS } from '@/lib/env';
import { cn } from '@/lib/utils';
import { AdjustStockModal } from '@/features/stock-movements/AdjustStockModal';
import { PlaceholderPage } from '@/components/common/PlaceholderPage';
import type { StockMovement, StockMovementType } from '@/types/stock-movement';
import { formatMovementTypeLabel, movementTypeBadgeVariant } from '@/features/stock-movements/movement-badge';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FieldLabel, SelectInput, TextInput } from '@/components/ui/input';
import { DataTable, Th, Td } from '@/components/ui/data-table';
import { ErrorBanner } from '@/components/ui/error-banner';
import { EmptyState } from '@/components/ui/empty-state';
import { TableRowSkeleton } from '@/components/ui/skeleton';

const PAGE_SIZE = 20;

const MOVEMENT_TYPES: StockMovementType[] = [
  'SALE',
  'RETURN',
  'PURCHASE',
  'ADJUSTMENT',
  'DAMAGE',
  'EXPIRED',
];

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function StockMovementsPage() {
  const user = useAuthStore((s) => s.user);
  const role = user?.role;
  const canAdjust = role === 'OWNER' || role === 'ADMIN';
  const isCashier = role === 'CASHIER';
  const cashierBlocked = isCashier && !CASHIER_CAN_VIEW_STOCK_MOVEMENTS;

  const [page, setPage] = useState(1);
  const [productId, setProductId] = useState('');
  const [movementType, setMovementType] = useState<'' | StockMovementType>('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [adjustOpen, setAdjustOpen] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [productId, movementType, fromDate, toDate]);

  const listParams = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      productId: productId || undefined,
      type: movementType || undefined,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
    }),
    [page, productId, movementType, fromDate, toDate],
  );

  const movementsQuery = useQuery({
    queryKey: ['stock-movements', listParams],
    queryFn: () => fetchStockMovements(listParams),
    enabled: !cashierBlocked,
  });

  const productsQuery = useQuery({
    queryKey: ['products', 'stock-movements-filter', 300],
    queryFn: () => fetchProducts({ page: 1, limit: 300 }),
    staleTime: 60_000,
    enabled: !cashierBlocked,
  });

  const productOptions = productsQuery.data?.data ?? [];
  const rows = movementsQuery.data?.data ?? [];
  const meta = movementsQuery.data?.meta;
  const totalPages = meta?.totalPages ?? 0;

  if (cashierBlocked) {
    return (
      <PlaceholderPage
        title="Stock movements"
        description="Your role does not include access to stock movement history. Ask an administrator if you need access."
      />
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader
        className="mb-0"
        title="Stock movements"
        description={
          canAdjust ? 'Audit trail and manual adjustments.' : 'Read-only movement history.'
        }
        actions={
          canAdjust ? (
            <Button type="button" variant="primary" className="gap-2" onClick={() => setAdjustOpen(true)}>
              <Package className="h-4 w-4 shrink-0" aria-hidden />
              Manual adjustment
            </Button>
          ) : undefined
        }
      />

      <Card>
        <CardContent className="p-4 md:p-5">
          <div className="grid gap-4 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-4">
              <FieldLabel htmlFor="sm-product">Product</FieldLabel>
              <SelectInput
                id="sm-product"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
              >
                <option value="">All products</option>
                {productOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </SelectInput>
            </div>
            <div className="lg:col-span-3">
              <FieldLabel htmlFor="sm-type">Movement type</FieldLabel>
              <SelectInput
                id="sm-type"
                value={movementType}
                onChange={(e) => setMovementType((e.target.value as '' | StockMovementType) || '')}
              >
                <option value="">All types</option>
                {MOVEMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {formatMovementTypeLabel(t)}
                  </option>
                ))}
              </SelectInput>
            </div>
            <div className="lg:col-span-2">
              <FieldLabel htmlFor="sm-from">From</FieldLabel>
              <TextInput id="sm-from" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div className="lg:col-span-2">
              <FieldLabel htmlFor="sm-to">To</FieldLabel>
              <TextInput id="sm-to" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <div>
        {movementsQuery.isLoading ? (
          <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
            <div className="overflow-x-auto">
              <div className="min-w-[1100px]">
                <DataTable>
                  <thead>
                    <tr>
                      <Th>Date</Th>
                      <Th>Product</Th>
                      <Th>Type</Th>
                      <Th className="text-right">Δ Qty</Th>
                      <Th className="text-right">Before</Th>
                      <Th className="text-right">After</Th>
                      <Th>Reason</Th>
                      <Th>Created by</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 8 }).map((_, i) => (
                      <TableRowSkeleton key={i} cols={8} />
                    ))}
                  </tbody>
                </DataTable>
              </div>
            </div>
          </div>
        ) : movementsQuery.isError ? (
          <ErrorBanner
            message={getApiErrorMessage(movementsQuery.error, 'Could not load stock movements.')}
            onRetry={() => void movementsQuery.refetch()}
          />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No movements found"
            description="Try widening your date range or clearing filters."
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
            <div className="overflow-x-auto">
              <div className="min-w-[1100px]">
                <DataTable>
                  <thead>
                    <tr>
                      <Th>Date</Th>
                      <Th>Product</Th>
                      <Th>Type</Th>
                      <Th className="text-right">Δ Qty</Th>
                      <Th className="text-right">Before</Th>
                      <Th className="text-right">After</Th>
                      <Th>Reason</Th>
                      <Th>Created by</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <MovementRow key={row.id} row={row} />
                    ))}
                  </tbody>
                </DataTable>
              </div>
            </div>
            {meta && totalPages > 0 ? (
              <div className="flex flex-col items-center justify-between gap-3 border-t border-line bg-canvas-raised/40 px-4 py-3 text-sm text-ink-muted sm:flex-row">
                <p>
                  Page {meta.page} of {totalPages} · {meta.total} movements
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={page <= 1 || movementsQuery.isFetching}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="gap-1"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Prev
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={page >= totalPages || movementsQuery.isFetching}
                    onClick={() => setPage((p) => p + 1)}
                    className="gap-1"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {canAdjust ? (
        <AdjustStockModal open={adjustOpen} onClose={() => setAdjustOpen(false)} products={productOptions} />
      ) : null}
    </div>
  );
}

function MovementRow({ row }: { row: StockMovement }) {
  const minStock = row.product?.minStock ?? 0;
  const negative = row.quantityChange < 0;
  const lowAfter = minStock > 0 && row.newQuantity <= minStock;

  return (
    <tr
      className={cn(
        'transition-colors hover:bg-canvas-raised/70',
        negative && 'bg-danger-50/50',
        !negative && lowAfter && 'bg-warning-50/40',
      )}
    >
      <Td className="whitespace-nowrap text-ink-muted">{formatDateTime(row.createdAt)}</Td>
      <Td className="max-w-[220px]">
        <div className="truncate font-medium text-ink" title={row.product?.name}>
          {row.product?.name ?? '—'}
        </div>
        {lowAfter ? (
          <div className="mt-0.5 flex items-center gap-1 text-xs text-warning-800">
            <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />
            Low stock after
          </div>
        ) : null}
      </Td>
      <Td className="whitespace-nowrap">
        <Badge variant={movementTypeBadgeVariant(row.type)}>{formatMovementTypeLabel(row.type)}</Badge>
      </Td>
      <Td
        className={cn(
          'whitespace-nowrap text-right font-mono tabular-nums',
          negative ? 'font-semibold text-danger-600' : row.quantityChange > 0 ? 'text-success-600' : 'text-ink-muted',
        )}
      >
        {row.quantityChange > 0 ? `+${row.quantityChange}` : row.quantityChange}
      </Td>
      <Td className="whitespace-nowrap text-right font-mono tabular-nums text-ink-muted">{row.previousQuantity}</Td>
      <Td className="whitespace-nowrap text-right font-mono tabular-nums font-medium text-ink">{row.newQuantity}</Td>
      <Td className="max-w-[280px] truncate text-ink-muted" title={row.reason ?? ''}>
        {row.reason ?? '—'}
      </Td>
      <Td className="whitespace-nowrap text-ink-muted">
        <span className="font-medium text-ink">{row.createdBy?.name ?? '—'}</span>
        <span className="ml-1 text-xs">({row.createdBy?.username ?? '—'})</span>
      </Td>
    </tr>
  );
}
