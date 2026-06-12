import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Calculator, Copy, Eye, Pencil, Power, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  createBulkPriceList,
  deleteBulkPriceList,
  duplicateBulkPriceList,
  fetchBulkPricingDashboard,
  listBulkPriceLists,
  previewBulkPrice,
  setBulkPriceListStatus,
  updateBulkPriceList,
  type PriceListRow,
} from '@/api/wholesale/bulk-pricing.api';
import { fetchCustomers } from '@/api/customers.api';
import { customerPickerLabel } from '@/lib/customer-display';
import { fetchProducts } from '@/api/products.api';
import { getApiErrorMessage } from '@/api/client';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { TextInput } from '@/components/ui/input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/badge';
import { PriceListDetailsModal } from '@/features/wholesale/bulk-pricing/PriceListDetailsModal';
import { formatMoney } from '@/lib/format-money';

type ListForm = { name: string; description: string; isActive: boolean };

export function BulkPricingPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [hasCustomers, setHasCustomers] = useState(false);
  const [hasProducts, setHasProducts] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PriceListRow | null>(null);
  const [detailsList, setDetailsList] = useState<PriceListRow | null>(null);
  const [detailsTab, setDetailsTab] = useState<'overview' | 'products' | 'customers'>('overview');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [form, setForm] = useState<ListForm>({ name: '', description: '', isActive: true });
  const [previewCustomerId, setPreviewCustomerId] = useState('');
  const [previewProductId, setPreviewProductId] = useState('');
  const [previewQty, setPreviewQty] = useState('1');
  const [productQ, setProductQ] = useState('');

  const listParams = useMemo(
    () => ({
      q: search || undefined,
      status: statusFilter,
      hasCustomers: hasCustomers || undefined,
      hasProducts: hasProducts || undefined,
    }),
    [search, statusFilter, hasCustomers, hasProducts],
  );

  const dashboardQ = useQuery({
    queryKey: ['bulk-pricing', 'dashboard'],
    queryFn: fetchBulkPricingDashboard,
  });

  const listsQ = useQuery({
    queryKey: ['bulk-pricing', 'lists', listParams],
    queryFn: () => listBulkPriceLists(listParams),
  });

  const customersQ = useQuery({
    queryKey: ['customers', 'preview'],
    queryFn: () => fetchCustomers({ limit: 200 }),
    enabled: previewOpen,
  });

  const productsQ = useQuery({
    queryKey: ['products', 'preview', productQ],
    queryFn: () => fetchProducts({ q: productQ || undefined, limit: 8 }),
    enabled: previewOpen && productQ.length >= 2,
  });

  const previewQ = useQuery({
    queryKey: ['bulk-pricing', 'preview', previewCustomerId, previewProductId, previewQty],
    queryFn: () =>
      previewBulkPrice({
        customerId: previewCustomerId || undefined,
        productId: previewProductId,
        quantity: Math.max(1, Number(previewQty) || 1),
      }),
    enabled: previewOpen && Boolean(previewProductId),
  });

  const saveM = useMutation({
    mutationFn: async () => {
      const body = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        isActive: form.isActive,
      };
      if (editing) return updateBulkPriceList(editing.id, body);
      return createBulkPriceList(body);
    },
    onSuccess: (row) => {
      toast.success(editing ? 'Price list updated' : 'Price list created');
      setModalOpen(false);
      setEditing(null);
      void qc.invalidateQueries({ queryKey: ['bulk-pricing'] });
      if (!editing) {
        setDetailsList(row as PriceListRow);
        setDetailsTab('products');
      }
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const deleteM = useMutation({
    mutationFn: deleteBulkPriceList,
    onSuccess: () => {
      toast.success('Price list deleted');
      void qc.invalidateQueries({ queryKey: ['bulk-pricing'] });
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const duplicateM = useMutation({
    mutationFn: duplicateBulkPriceList,
    onSuccess: () => {
      toast.success('Price list duplicated');
      void qc.invalidateQueries({ queryKey: ['bulk-pricing'] });
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const statusM = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => setBulkPriceListStatus(id, isActive),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['bulk-pricing'] }),
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const dash = dashboardQ.data;
  const rows = listsQ.data ?? [];

  function openCreate() {
    setEditing(null);
    setForm({ name: '', description: '', isActive: true });
    setModalOpen(true);
  }

  function openEdit(row: PriceListRow) {
    setEditing(row);
    setForm({ name: row.name, description: row.description ?? '', isActive: row.isActive });
    setModalOpen(true);
  }

  const cards = [
    { label: 'Total price lists', value: dash?.totalPriceLists ?? 0 },
    { label: 'Active price lists', value: dash?.activePriceLists ?? 0 },
    { label: 'Products with bulk pricing', value: dash?.productsWithBulkPricing ?? 0 },
    { label: 'Customers assigned', value: dash?.customersAssigned ?? 0 },
    { label: 'Avg discount %', value: `${dash?.averageDiscountPercent ?? 0}%` },
  ];

  return (
    <div className="space-y-6 p-4">
      <PageHeader
        title="Bulk pricing"
        description="Create price lists with quantity tiers and assign them to B2B customers."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setPreviewOpen(true)}>
              <Calculator className="mr-2 h-4 w-4" />
              Price preview
            </Button>
            <Button onClick={openCreate}>New price list</Button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-line bg-surface p-4 shadow-card">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{c.label}</p>
            <p className="mt-2 text-2xl font-semibold text-ink">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface p-4">
        <TextInput className="max-w-xs" placeholder="Search by name…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="rounded-lg border border-line bg-canvas px-3 py-2 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={hasCustomers} onChange={(e) => setHasCustomers(e.target.checked)} />
          Has customers
        </label>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={hasProducts} onChange={(e) => setHasProducts(e.target.checked)} />
          Has products
        </label>
      </div>

      {listsQ.isLoading ? (
        <p className="text-sm text-ink-muted">Loading price lists…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-surface px-6 py-14 text-center">
          <h3 className="text-lg font-semibold text-ink">No price lists yet</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
            Create your first wholesale price list and add quantity-based prices for your B2B customers.
          </p>
          <Button className="mt-4" onClick={openCreate}>Create price list</Button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="min-w-full text-sm">
            <thead className="bg-canvas text-left text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Products</th>
                <th className="px-4 py-3">Customers</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Updated</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-canvas/50">
                  <td className="px-4 py-3 font-medium text-ink">{row.name}</td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-ink-muted">{row.description ?? '—'}</td>
                  <td className="px-4 py-3">{row.productCount ?? 0}</td>
                  <td className="px-4 py-3">{row._count?.customers ?? 0}</td>
                  <td className="px-4 py-3">
                    <Badge variant={row.isActive ? 'success' : 'muted'}>{row.isActive ? 'Active' : 'Inactive'}</Badge>
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{format(new Date(row.createdAt), 'yyyy-MM-dd')}</td>
                  <td className="px-4 py-3 text-ink-muted">{format(new Date(row.updatedAt), 'yyyy-MM-dd')}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button size="sm" variant="ghost" title="View" onClick={() => { setDetailsList(row); setDetailsTab('overview'); }}><Eye className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" title="Edit" onClick={() => openEdit(row)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" title="Manage products" onClick={() => { setDetailsList(row); setDetailsTab('products'); }}>Products</Button>
                      <Button size="sm" variant="ghost" title="Assign customers" onClick={() => { setDetailsList(row); setDetailsTab('customers'); }}>Customers</Button>
                      <Button size="sm" variant="ghost" title="Duplicate" onClick={() => duplicateM.mutate(row.id)}><Copy className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" title={row.isActive ? 'Deactivate' : 'Activate'} onClick={() => statusM.mutate({ id: row.id, isActive: !row.isActive })}><Power className="h-4 w-4" /></Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Delete"
                        onClick={() => {
                          if (window.confirm(`Delete price list "${row.name}"?`)) deleteM.mutate(row.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-danger-500" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={modalOpen}
        title={editing ? 'Edit price list' : 'New price list'}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" disabled={!form.name.trim() || saveM.isPending} onClick={() => saveM.mutate()}>Save</Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm text-ink-muted">Name *</label>
            <TextInput value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-ink-muted">Description</label>
            <TextInput value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
            Active
          </label>
        </div>
      </Modal>

      <PriceListDetailsModal
        list={detailsList}
        open={Boolean(detailsList)}
        onClose={() => setDetailsList(null)}
        initialTab={detailsTab}
      />

      <Modal
        open={previewOpen}
        title="Price preview"
        description="Test wholesale pricing for a customer, product, and quantity."
        onClose={() => setPreviewOpen(false)}
        size="lg"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-ink-muted">Customer</label>
            <select className="w-full rounded-lg border border-line px-3 py-2 text-sm" value={previewCustomerId} onChange={(e) => setPreviewCustomerId(e.target.value)}>
              <option value="">No customer</option>
              {(customersQ.data?.data ?? []).map((c) => <option key={c.id} value={c.id}>{customerPickerLabel(c)}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-ink-muted">Quantity</label>
            <TextInput type="number" min={1} value={previewQty} onChange={(e) => setPreviewQty(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm text-ink-muted">Product</label>
            <TextInput value={productQ} onChange={(e) => setProductQ(e.target.value)} placeholder="Search product…" />
            {productsQ.data?.data?.length ? (
              <ul className="mt-2 max-h-32 overflow-auto rounded border border-line text-sm">
                {productsQ.data.data.map((p) => (
                  <li key={p.id}>
                    <button type="button" className="flex w-full justify-between px-3 py-2 hover:bg-canvas" onClick={() => { setPreviewProductId(p.id); setProductQ(p.name); }}>
                      <span>{p.name}</span>
                      <span>{formatMoney(p.sellingPrice)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
        {previewQ.data && (
          <div className="mt-4 rounded-lg border border-line bg-canvas p-4 text-sm">
            {previewQ.data.applied ? (
              <>
                <p className="font-medium text-ink">Bulk price applies</p>
                <dl className="mt-2 space-y-1">
                  <div className="flex justify-between"><dt>Normal unit price</dt><dd>{formatMoney(previewQ.data.normalUnitPrice)}</dd></div>
                  <div className="flex justify-between"><dt>Price list</dt><dd>{previewQ.data.appliedPriceListName}</dd></div>
                  {previewQ.data.appliedTier && (
                    <div className="flex justify-between">
                      <dt>Tier</dt>
                      <dd>
                        {previewQ.data.appliedTier.minQuantity}
                        {previewQ.data.appliedTier.maxQuantity ? ` – ${previewQ.data.appliedTier.maxQuantity}` : '+'}
                        {' @ '}{formatMoney(previewQ.data.appliedTier.unitPrice)}
                      </dd>
                    </div>
                  )}
                  <div className="flex justify-between"><dt>Wholesale unit price</dt><dd className="font-semibold">{formatMoney(previewQ.data.finalUnitPrice)}</dd></div>
                  <div className="flex justify-between"><dt>Total normal</dt><dd>{formatMoney(previewQ.data.normalTotal)}</dd></div>
                  <div className="flex justify-between"><dt>Total wholesale</dt><dd>{formatMoney(previewQ.data.finalTotal)}</dd></div>
                  <div className="flex justify-between text-success-700"><dt>Savings</dt><dd>{formatMoney(previewQ.data.savings)}</dd></div>
                </dl>
              </>
            ) : (
              <p className="text-ink-muted">No bulk price applies. Normal selling price will be used ({formatMoney(previewQ.data.normalUnitPrice)}).</p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
