import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { TextInput } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { getApiErrorMessage } from '@/api/client';
import { fetchCustomers } from '@/api/customers.api';
import { customerPickerLabel } from '@/lib/customer-display';
import { fetchProducts } from '@/api/products.api';
import {
  addBulkPriceListProduct,
  assignBulkPriceListCustomer,
  listBulkPriceListCustomers,
  listBulkPriceListProducts,
  removeBulkPriceListProduct,
  unassignBulkPriceListCustomer,
  upsertBulkProductTiers,
  type PriceListProductGroup,
  type PriceListRow,
} from '@/api/wholesale/bulk-pricing.api';
import { formatMoney } from '@/lib/format-money';

type TierDraft = {
  minQuantity: string;
  maxQuantity: string;
  unitPrice: string;
  notes: string;
};

type Props = {
  list: PriceListRow | null;
  open: boolean;
  onClose: () => void;
  initialTab?: 'overview' | 'products' | 'customers';
};

const emptyTier = (): TierDraft => ({ minQuantity: '1', maxQuantity: '', unitPrice: '0', notes: '' });

export function PriceListDetailsModal({ list, open, onClose, initialTab = 'overview' }: Props) {
  const qc = useQueryClient();
  const [tab, setTab] = useState(initialTab);
  const [productQ, setProductQ] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [tierDrafts, setTierDrafts] = useState<TierDraft[]>([emptyTier()]);
  const [customerQ, setCustomerQ] = useState('');
  const [editingProduct, setEditingProduct] = useState<PriceListProductGroup | null>(null);

  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab, list?.id]);

  const productsQ = useQuery({
    queryKey: ['bulk-pricing', 'products', list?.id],
    queryFn: () => listBulkPriceListProducts(list!.id),
    enabled: open && Boolean(list?.id),
  });

  const customersQ = useQuery({
    queryKey: ['bulk-pricing', 'customers', list?.id],
    queryFn: () => listBulkPriceListCustomers(list!.id),
    enabled: open && Boolean(list?.id) && tab === 'customers',
  });

  const searchProductsQ = useQuery({
    queryKey: ['products', 'bulk-add', productQ],
    queryFn: () => fetchProducts({ q: productQ || undefined, limit: 8 }),
    enabled: open && productQ.length >= 2,
  });

  const searchCustomersQ = useQuery({
    queryKey: ['customers', 'bulk-assign', customerQ],
    queryFn: () => fetchCustomers({ q: customerQ || undefined, limit: 8 }),
    enabled: open && customerQ.length >= 1,
  });

  const saveTiersM = useMutation({
    mutationFn: async () => {
      if (!list || !selectedProductId) return;
      const tiers = tierDrafts.map((t) => ({
        minQuantity: Math.max(1, Number(t.minQuantity) || 1),
        maxQuantity: t.maxQuantity.trim() ? Number(t.maxQuantity) : null,
        unitPrice: Math.max(0, Number(t.unitPrice) || 0),
        notes: t.notes.trim() || undefined,
      }));
      if (editingProduct) {
        return upsertBulkProductTiers(list.id, editingProduct.productId, tiers);
      }
      return addBulkPriceListProduct(list.id, { productId: selectedProductId, tiers });
    },
    onSuccess: () => {
      toast.success('Product tiers saved');
      setSelectedProductId('');
      setEditingProduct(null);
      setTierDrafts([emptyTier()]);
      setProductQ('');
      void qc.invalidateQueries({ queryKey: ['bulk-pricing'] });
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const removeProductM = useMutation({
    mutationFn: (productId: string) => removeBulkPriceListProduct(list!.id, productId),
    onSuccess: () => {
      toast.success('Product removed');
      void qc.invalidateQueries({ queryKey: ['bulk-pricing'] });
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const assignCustomerM = useMutation({
    mutationFn: ({ customerId, replace }: { customerId: string; replace?: boolean }) =>
      assignBulkPriceListCustomer(list!.id, customerId, replace),
    onSuccess: () => {
      toast.success('Customer assigned');
      setCustomerQ('');
      void qc.invalidateQueries({ queryKey: ['bulk-pricing'] });
    },
    onError: (e, variables) => {
      const msg = getApiErrorMessage(e);
      if (msg.toLowerCase().includes('already assigned') && !variables.replace) {
        if (window.confirm(`${msg}\n\nReplace existing assignment?`)) {
          assignCustomerM.mutate({ customerId: variables.customerId, replace: true });
        }
        return;
      }
      toast.error(msg);
    },
  });

  const unassignM = useMutation({
    mutationFn: (customerId: string) => unassignBulkPriceListCustomer(list!.id, customerId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['bulk-pricing'] }),
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  if (!list) return null;

  const products = productsQ.data ?? [];
  const customers = customersQ.data ?? [];

  function startEditProduct(group: PriceListProductGroup) {
    setEditingProduct(group);
    setSelectedProductId(group.productId);
    setTierDrafts(
      group.tiers.map((t) => ({
        minQuantity: String(t.minQuantity),
        maxQuantity: t.maxQuantity != null ? String(t.maxQuantity) : '',
        unitPrice: String(t.unitPrice),
        notes: t.notes ?? '',
      })),
    );
    setTab('products');
  }

  return (
    <Modal open={open} onClose={onClose} title={list.name} description="Manage products, tiers, and customer assignments" size="xl">
      <div className="mb-4 flex flex-wrap gap-2">
        {(['overview', 'products', 'customers'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
              tab === t ? 'bg-primary-100 text-primary-700' : 'bg-canvas text-ink-muted'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-ink-muted">Status</dt><dd><Badge variant={list.isActive ? 'success' : 'muted'}>{list.isActive ? 'Active' : 'Inactive'}</Badge></dd></div>
          <div><dt className="text-ink-muted">Products</dt><dd>{list.productCount ?? 0}</dd></div>
          <div><dt className="text-ink-muted">Customers</dt><dd>{list._count?.customers ?? 0}</dd></div>
          <div><dt className="text-ink-muted">Tier rows</dt><dd>{list._count?.items ?? 0}</dd></div>
          <div className="sm:col-span-2"><dt className="text-ink-muted">Description</dt><dd>{list.description || '—'}</dd></div>
          <div><dt className="text-ink-muted">Created</dt><dd>{new Date(list.createdAt).toLocaleString()}</dd></div>
          <div><dt className="text-ink-muted">Updated</dt><dd>{new Date(list.updatedAt).toLocaleString()}</dd></div>
        </dl>
      )}

      {tab === 'products' && (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="min-w-full text-sm">
              <thead className="bg-canvas text-left text-xs uppercase text-ink-muted">
                <tr>
                  <th className="px-3 py-2">Product</th>
                  <th className="px-3 py-2">SKU</th>
                  <th className="px-3 py-2">Normal</th>
                  <th className="px-3 py-2">Tiers</th>
                  <th className="px-3 py-2">Lowest</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {products.map((g) => (
                  <tr key={g.productId} className="border-t border-line">
                    <td className="px-3 py-2">{g.product?.name ?? g.productId}</td>
                    <td className="px-3 py-2">{g.product?.sku ?? '—'}</td>
                    <td className="px-3 py-2">{formatMoney(g.normalSellingPrice)}</td>
                    <td className="px-3 py-2">{g.tierCount}</td>
                    <td className="px-3 py-2">{formatMoney(g.lowestWholesalePrice)}</td>
                    <td className="px-3 py-2">
                      <Button size="sm" variant="ghost" onClick={() => startEditProduct(g)}>Edit tiers</Button>
                      <Button size="sm" variant="ghost" onClick={() => removeProductM.mutate(g.productId)}>Remove</Button>
                    </td>
                  </tr>
                ))}
                {products.length === 0 && (
                  <tr><td colSpan={6} className="px-3 py-6 text-center text-ink-muted">No products in this list yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="rounded-lg border border-line bg-canvas p-4">
            <h4 className="mb-2 text-sm font-semibold">{editingProduct ? 'Edit tiers' : 'Add product & tiers'}</h4>
            {!editingProduct && (
              <>
                <TextInput value={productQ} onChange={(e) => setProductQ(e.target.value)} placeholder="Search product…" />
                {searchProductsQ.data?.data?.length ? (
                  <ul className="mt-2 max-h-28 overflow-auto rounded border border-line bg-surface text-sm">
                    {searchProductsQ.data.data.map((p) => (
                      <li key={p.id}>
                        <button type="button" className="flex w-full justify-between px-3 py-2 hover:bg-canvas" onClick={() => { setSelectedProductId(p.id); setProductQ(p.name); }}>
                          <span>{p.name}</span>
                          <span className="text-ink-muted">{formatMoney(p.sellingPrice)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            )}
            {(selectedProductId || editingProduct) && (
              <div className="mt-3 space-y-2">
                {tierDrafts.map((tier, idx) => (
                  <div key={idx} className="flex flex-wrap items-end gap-2">
                    <div>
                      <label className="text-xs text-ink-muted">Min qty</label>
                      <TextInput className="w-20" value={tier.minQuantity} onChange={(e) => setTierDrafts((d) => d.map((t, i) => i === idx ? { ...t, minQuantity: e.target.value } : t))} />
                    </div>
                    <div>
                      <label className="text-xs text-ink-muted">Max qty</label>
                      <TextInput className="w-20" placeholder="∞" value={tier.maxQuantity} onChange={(e) => setTierDrafts((d) => d.map((t, i) => i === idx ? { ...t, maxQuantity: e.target.value } : t))} />
                    </div>
                    <div>
                      <label className="text-xs text-ink-muted">Unit price</label>
                      <TextInput className="w-24" value={tier.unitPrice} onChange={(e) => setTierDrafts((d) => d.map((t, i) => i === idx ? { ...t, unitPrice: e.target.value } : t))} />
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => setTierDrafts((d) => d.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setTierDrafts((d) => [...d, emptyTier()])}><Plus className="mr-1 h-3 w-3" />Add tier</Button>
                  <Button size="sm" variant="primary" disabled={saveTiersM.isPending} onClick={() => saveTiersM.mutate()}>Save tiers</Button>
                  {editingProduct ? (
                    <Button size="sm" variant="ghost" onClick={() => { setEditingProduct(null); setTierDrafts([emptyTier()]); setSelectedProductId(''); }}>Cancel edit</Button>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'customers' && (
        <div className="space-y-4">
          <TextInput value={customerQ} onChange={(e) => setCustomerQ(e.target.value)} placeholder="Search customer to assign…" />
          {searchCustomersQ.data?.data?.length ? (
            <ul className="rounded border border-line bg-surface text-sm">
              {searchCustomersQ.data.data.map((c) => (
                <li key={c.id}>
                  <button type="button" className="flex w-full justify-between px-3 py-2 hover:bg-canvas" onClick={() => assignCustomerM.mutate({ customerId: c.id })}>
                    <span>{customerPickerLabel(c)}</span>
                    <span className="text-xs text-ink-muted">Assign</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <table className="min-w-full text-sm">
            <thead className="bg-canvas text-left text-xs uppercase text-ink-muted">
              <tr>
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Phone</th>
                <th className="px-3 py-2">Balance</th>
                <th className="px-3 py-2">Assigned</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {customers.map((row: { customerId: string; assignedAt: string; customer: { name: string; phone: string | null; balance: string } }) => (
                <tr key={row.customerId} className="border-t border-line">
                  <td className="px-3 py-2">{row.customer.name}</td>
                  <td className="px-3 py-2">{row.customer.phone ?? '—'}</td>
                  <td className="px-3 py-2">{formatMoney(row.customer.balance)}</td>
                  <td className="px-3 py-2">{new Date(row.assignedAt).toLocaleDateString()}</td>
                  <td className="px-3 py-2">
                    <Button size="sm" variant="ghost" onClick={() => unassignM.mutate(row.customerId)}>Remove</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
