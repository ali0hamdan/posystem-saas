import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, ChevronLeft, ChevronRight, PackagePlus, Pencil, Power, Search, Tag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { fetchProducts, fetchLowStockProducts, updateProduct } from '@/api/products.api';
import { fetchCategories } from '@/api/categories.api';
import { fetchSuppliers } from '@/api/suppliers.api';
import { getApiErrorMessage } from '@/api/client';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/lib/format-money';
import { useDebouncedValue } from '@/features/products/use-debounced-value';
import { categoryLabel, isLowStock } from '@/features/products/product-utils';
import { ProductFormModal } from '@/features/products/ProductFormModal';
import { DeactivateProductDialog } from '@/features/products/DeactivateProductDialog';
import { toLabelFields } from '@/features/product-labels/label-utils';
import { Button } from '@/components/ui/button';
import type { Product } from '@/types/product';

const PAGE_SIZE = 20;

export function ProductsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const canManage = user?.role === 'OWNER' || user?.role === 'ADMIN';

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 400);
  const [categoryId, setCategoryId] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [deactivateProduct, setDeactivateProduct] = useState<Product | null>(null);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, categoryId, lowStockOnly, showInactive]);

  const categoriesQuery = useQuery({
    queryKey: ['categories', 'options'],
    queryFn: () => fetchCategories({ limit: 200, page: 1 }),
    staleTime: 5 * 60 * 1000,
  });

  const suppliersQuery = useQuery({
    queryKey: ['suppliers', 'options'],
    queryFn: () => fetchSuppliers({ limit: 100, page: 1 }),
    enabled: canManage && (createOpen || Boolean(editProduct)),
    staleTime: 5 * 60 * 1000,
  });

  const listParams = useMemo(() => {
    const q = debouncedSearch.trim();
    if (lowStockOnly) {
      return { mode: 'low' as const, page, limit: PAGE_SIZE };
    }
    return {
      mode: 'all' as const,
      page,
      limit: PAGE_SIZE,
      q: q.length > 0 ? q : undefined,
      categoryId: categoryId.length > 0 ? categoryId : undefined,
      includeInactive: canManage && showInactive ? true : undefined,
    };
  }, [debouncedSearch, categoryId, lowStockOnly, showInactive, page, canManage]);

  const productsQuery = useQuery({
    queryKey: ['products', 'list', listParams],
    queryFn: () =>
      listParams.mode === 'low'
        ? fetchLowStockProducts({ page: listParams.page, limit: listParams.limit })
        : fetchProducts({
            page: listParams.page,
            limit: listParams.limit,
            q: listParams.q,
            categoryId: listParams.categoryId,
            includeInactive: listParams.includeInactive,
          }),
  });

  const categoryLookup = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categoriesQuery.data?.data ?? []) {
      map.set(c.id, c.name);
    }
    return map;
  }, [categoriesQuery.data]);

  const activateMutation = useMutation({
    mutationFn: ({ id }: { id: string }) => updateProduct(id, { isActive: true }),
    onSuccess: () => {
      toast.success('Product reactivated');
      void queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Could not reactivate product'));
    },
  });

  const items = productsQuery.data?.data ?? [];
  const meta = productsQuery.data?.meta;
  const totalPages = meta?.totalPages ?? 0;

  const categoryOptions = categoriesQuery.data?.data ?? [];
  const supplierOptions = suppliersQuery.data?.data ?? [];

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink md:text-3xl">Products</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {canManage ? 'Manage catalog, pricing, and availability.' : 'View catalog and stock levels.'}
          </p>
        </div>
        {canManage ? (
          <div className="flex flex-wrap items-center gap-2 self-start">
            <Link
              to="/product-labels"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-canvas-raised"
            >
              <Tag className="h-4 w-4" aria-hidden />
              Product labels
            </Link>
            <Button
              type="button"
              onClick={() => setCreateOpen(true)}
            >
              <PackagePlus className="h-4 w-4" aria-hidden />
              New product
            </Button>
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-line bg-surface p-4 shadow-panel md:p-5">
        <div className="grid gap-4 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-4">
            <label htmlFor="product-search" className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-ink-muted">
              Search
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
              <input
                id="product-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                disabled={lowStockOnly}
                placeholder="Name, barcode, or SKU"
                className={cn(
                  'w-full rounded-lg border bg-surface py-2.5 pl-10 pr-3 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20',
                  lowStockOnly ? 'cursor-not-allowed bg-surface-muted text-ink-muted' : 'border-line',
                )}
              />
            </div>
          </div>
          <div className="lg:col-span-3">
            <label htmlFor="product-category" className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-ink-muted">
              Category
            </label>
            <select
              id="product-category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              disabled={lowStockOnly}
              className={cn(
                'w-full rounded-lg border bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20',
                lowStockOnly ? 'cursor-not-allowed bg-surface-muted text-ink-muted' : 'border-line',
              )}
            >
              <option value="">All categories</option>
              {categoryOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:col-span-5">
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-canvas px-3 py-2.5 text-sm text-ink">
              <input
                type="checkbox"
                checked={lowStockOnly}
                onChange={(e) => setLowStockOnly(e.target.checked)}
                className="h-4 w-4 rounded border-line-strong"
              />
              Low stock only
            </label>
            {canManage ? (
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-canvas px-3 py-2.5 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                  className="h-4 w-4 rounded border-line-strong"
                />
                Show inactive
              </label>
            ) : null}
          </div>
        </div>
        {lowStockOnly ? (
          <p className="mt-3 flex items-start gap-2 text-xs text-warning-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-700" aria-hidden />
            Low-stock view uses the server list for at or below minimum. Search and category filters are disabled for this mode.
          </p>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-panel">
        {productsQuery.isLoading ? (
          <div className="flex min-h-[240px] items-center justify-center px-4 py-16 text-sm text-ink-muted">
            Loading products…
          </div>
        ) : productsQuery.isError ? (
          <div className="px-4 py-10 text-center text-sm text-danger-700">
            {getApiErrorMessage(productsQuery.error, 'Could not load products.')}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => void productsQuery.refetch()}
              className="mt-3 block w-full sm:mx-auto sm:w-auto sm:px-6"
            >
              Retry
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[960px] w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-canvas text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Barcode</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3 text-right">Cost</th>
                  <th className="px-4 py-3 text-right">Sell</th>
                  <th className="px-4 py-3 text-right">Qty</th>
                  <th className="px-4 py-3 text-right">Min</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-ink-muted">
                      No products match your filters.
                    </td>
                  </tr>
                ) : (
                  items.map((row) => {
                    const low = isLowStock(row);
                    return (
                      <tr
                        key={row.id}
                        className={cn(
                          'border-b border-line transition-colors hover:bg-canvas-raised/60',
                          low && 'bg-warning-50',
                        )}
                      >
                        <td className="max-w-[220px] px-4 py-3">
                          <div className="truncate font-medium text-ink" title={row.name}>
                            {row.name}
                          </div>
                          {low ? (
                            <div className="mt-0.5 flex items-center gap-1 text-xs text-warning-700">
                              <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                              Low stock
                            </div>
                          ) : null}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-ink-muted">{row.barcode ?? '—'}</td>
                        <td className="max-w-[160px] truncate px-4 py-3 text-ink-muted" title={categoryLabel(row, categoryLookup)}>
                          {categoryLabel(row, categoryLookup)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-ink">
                          {formatMoney(row.costPrice)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-ink">
                          {formatMoney(row.sellingPrice)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-ink">{row.quantity}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-ink-muted">{row.minStock}</td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <Badge variant={row.isActive ? 'success' : 'muted'}>
                            {row.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          {canManage ? (
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setEditProduct(row)}
                                className="h-9 w-9 p-0"
                                aria-label={`Edit ${row.name}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              {row.isActive ? (
                                <Button
                                  type="button"
                                  variant="danger"
                                  size="sm"
                                  onClick={() => setDeactivateProduct(row)}
                                  className="h-9 px-2"
                                >
                                  Deactivate
                                </Button>
                              ) : (
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  disabled={
                                    activateMutation.isPending && activateMutation.variables?.id === row.id
                                  }
                                  onClick={() => activateMutation.mutate({ id: row.id })}
                                  className="h-9 px-2"
                                >
                                  <Power className="h-3.5 w-3.5" aria-hidden />
                                  Activate
                                </Button>
                              )}
                            </div>
                          ) : (
                            <span className="text-ink-muted">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {meta && totalPages > 0 ? (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm text-ink-muted sm:flex-row">
            <p>
              Page {meta.page} of {totalPages} · {meta.total} products
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1 || productsQuery.isFetching}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages || productsQuery.isFetching}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      {canManage ? (
        <>
          <ProductFormModal
            mode="create"
            open={createOpen}
            onClose={() => setCreateOpen(false)}
            product={null}
            categories={categoryOptions}
            suppliers={supplierOptions}
            onCreateSuccess={(product, opts) => {
              if (opts.printLabels) {
                navigate('/product-labels', {
                  state: { initialRows: [{ product: toLabelFields(product), quantity: 1 }] },
                });
              }
            }}
          />
          <ProductFormModal
            mode="edit"
            open={Boolean(editProduct)}
            onClose={() => setEditProduct(null)}
            product={editProduct}
            categories={categoryOptions}
            suppliers={supplierOptions}
          />
          <DeactivateProductDialog
            product={deactivateProduct}
            open={Boolean(deactivateProduct)}
            onClose={() => setDeactivateProduct(null)}
          />
        </>
      ) : null}
    </div>
  );
}
