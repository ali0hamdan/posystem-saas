import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Search, Package, AlertTriangle, Plus, Pencil, ArrowDownUp } from 'lucide-react';
import { fetchProducts, createProduct, updateProduct } from '@/api/products.api';
import { adjustStock } from '@/api/stock-movements.api';
import { fetchCategories, createCategory } from '@/api/categories.api';
import type { Product } from '@/types/product';
import { getApiErrorMessage } from '@/api/client';
import { useAuthStore } from '@/stores/auth-store';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/Modal';
import { TextInput, FieldLabel, FieldError } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorBanner } from '@/components/ui/error-banner';
import { useDebouncedValue } from '@/features/products/use-debounced-value';

const selectClass =
  'w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/25';
const UNITS = ['PIECE', 'KG', 'G', 'L', 'ML', 'BOTTLE', 'PACK'];
const money = (v: number | string) => { const n = typeof v === 'string' ? Number(v) : v; return Number.isFinite(n) ? n.toFixed(2) : '0.00'; };

async function ensureIngredientCategoryId(): Promise<string> {
  const cats = await fetchCategories({ limit: 200, page: 1 });
  const found = cats.data.find((c) => c.name.trim().toLowerCase() === 'ingredients');
  if (found) return found.id;
  const created = await createCategory({ name: 'Ingredients' });
  return created.id;
}

type NewForm = { name: string; unitType: string; costPrice: string; quantity: string; minStock: string };
type EditForm = { name: string; costPrice: string; minStock: string };

export function FnbIngredientsPage() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const canManage = user?.role === 'OWNER' || user?.role === 'ADMIN';

  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search, 300);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Product | null>(null);
  const [adjustTarget, setAdjustTarget] = useState<Product | null>(null);

  const q = useQuery({
    queryKey: ['products', 'ingredients', debounced],
    queryFn: () => fetchProducts({ q: debounced.trim() || undefined, limit: 200, page: 1 }),
  });
  const items = q.data?.data ?? [];
  const invalidate = () => void qc.invalidateQueries({ queryKey: ['products'] });
  const onErr = (e: unknown) => toast.error(getApiErrorMessage(e, 'Something went wrong'));

  const [nf, setNf] = useState<NewForm>({ name: '', unitType: 'PIECE', costPrice: '', quantity: '0', minStock: '5' });
  const [nfErr, setNfErr] = useState<string>('');
  const createM = useMutation({
    mutationFn: async () => {
      const categoryId = await ensureIngredientCategoryId();
      const cost = Number(nf.costPrice) || 0;
      return createProduct({
        name: nf.name.trim(), categoryId, costPrice: cost, sellingPrice: cost,
        quantity: Number(nf.quantity) || 0, minStock: Number(nf.minStock) || 0, unitType: nf.unitType,
      });
    },
    onSuccess: () => { toast.success('Ingredient added'); invalidate(); setCreateOpen(false); setNf({ name: '', unitType: 'PIECE', costPrice: '', quantity: '0', minStock: '5' }); },
    onError: onErr,
  });

  const [ef, setEf] = useState<EditForm>({ name: '', costPrice: '', minStock: '' });
  const editM = useMutation({
    mutationFn: () => updateProduct(editTarget!.id, { name: ef.name.trim(), costPrice: Number(ef.costPrice) || 0, minStock: Number(ef.minStock) || 0 }),
    onSuccess: () => { toast.success('Ingredient updated'); invalidate(); setEditTarget(null); },
    onError: onErr,
  });

  const [adj, setAdj] = useState({ delta: '', reason: '' });
  const adjustM = useMutation({
    mutationFn: () => adjustStock({ productId: adjustTarget!.id, quantityChange: Number(adj.delta), type: 'ADJUSTMENT', reason: adj.reason.trim() || 'Manual adjustment' }),
    onSuccess: () => { toast.success('Stock updated'); invalidate(); setAdjustTarget(null); setAdj({ delta: '', reason: '' }); },
    onError: onErr,
  });

  function openEdit(p: Product) { setEf({ name: p.name, costPrice: money(p.costPrice), minStock: String(p.minStock) }); setEditTarget(p); }

  return (
    <div>
      <PageHeader title="Ingredients" description="Your stock items. Add ingredients and keep quantities on hand accurate."
        actions={canManage ? <Button variant="primary" size="md" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> New ingredient</Button> : undefined} />

      <div className="mb-6 relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden />
        <TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search ingredients…" className="pl-9" />
      </div>

      {q.isError && <ErrorBanner message={getApiErrorMessage(q.error, 'Failed to load ingredients')} className="mb-6" />}

      {q.isPending ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState title={debounced ? 'No matches' : 'No ingredients yet'}
          description={canManage ? 'Add your first ingredient — flour, tomatoes, cups, etc.' : 'No ingredients added yet.'}
          action={canManage && !debounced ? <Button variant="primary" size="md" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> New ingredient</Button> : undefined} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead className="bg-canvas-raised text-left text-xs uppercase tracking-wide text-ink-faint">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Ingredient</th>
                <th className="px-4 py-2.5 font-semibold text-right">On hand</th>
                <th className="px-4 py-2.5 font-semibold text-right">Cost</th>
                {canManage && <th className="px-4 py-2.5" />}
              </tr>
            </thead>
            <tbody>
              {items.map((p) => {
                const low = p.quantity <= p.minStock;
                return (
                  <tr key={p.id} className="group border-t border-line">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2"><Package className="h-4 w-4 text-primary-500" /><span className="font-medium text-ink">{p.name}</span></div>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="font-medium text-ink">{p.quantity}</span> <span className="text-ink-faint">{p.unitType}</span>
                      {low && <Badge variant="muted" className="ml-2"><AlertTriangle className="mr-1 inline h-3 w-3" />Low</Badge>}
                    </td>
                    <td className="px-4 py-2.5 text-right text-ink-muted">{money(p.costPrice)}</td>
                    {canManage && (
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex justify-end gap-1 opacity-0 transition group-hover:opacity-100">
                          <button title="Adjust stock" onClick={() => { setAdj({ delta: '', reason: '' }); setAdjustTarget(p); }} className="rounded-lg p-1.5 text-ink-muted hover:bg-canvas hover:text-ink"><ArrowDownUp className="h-4 w-4" /></button>
                          <button title="Edit" onClick={() => openEdit(p)} className="rounded-lg p-1.5 text-ink-muted hover:bg-canvas hover:text-ink"><Pencil className="h-4 w-4" /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* New ingredient */}
      <Modal open={createOpen} title="New ingredient" onClose={() => setCreateOpen(false)}
        footer={<div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" size="md" onClick={() => setCreateOpen(false)} disabled={createM.isPending}>Cancel</Button>
          <Button type="submit" form="ing-form" variant="primary" size="md" disabled={createM.isPending}>{createM.isPending ? 'Adding…' : 'Add ingredient'}</Button>
        </div>}>
        <form id="ing-form" onSubmit={(e) => { e.preventDefault(); if (!nf.name.trim()) { setNfErr('Name is required'); return; } createM.mutate(); }} className="space-y-4">
          <div>
            <FieldLabel htmlFor="ing-name" required>Name</FieldLabel>
            <TextInput id="ing-name" value={nf.name} autoFocus error={nfErr} onChange={(e) => { setNf((p) => ({ ...p, name: e.target.value })); setNfErr(''); }} placeholder="e.g. Tomatoes, Flour, Cups" />
            <FieldError message={nfErr} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><FieldLabel htmlFor="ing-unit">Unit</FieldLabel>
              <select id="ing-unit" className={selectClass} value={nf.unitType} onChange={(e) => setNf((p) => ({ ...p, unitType: e.target.value }))}>{UNITS.map((u) => <option key={u} value={u}>{u}</option>)}</select></div>
            <div><FieldLabel htmlFor="ing-cost">Cost per unit</FieldLabel>
              <TextInput id="ing-cost" type="number" value={nf.costPrice} onChange={(e) => setNf((p) => ({ ...p, costPrice: e.target.value }))} placeholder="0.00" /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><FieldLabel htmlFor="ing-qty">Starting quantity</FieldLabel>
              <TextInput id="ing-qty" type="number" value={nf.quantity} onChange={(e) => setNf((p) => ({ ...p, quantity: e.target.value }))} /></div>
            <div><FieldLabel htmlFor="ing-min">Low-stock level</FieldLabel>
              <TextInput id="ing-min" type="number" value={nf.minStock} onChange={(e) => setNf((p) => ({ ...p, minStock: e.target.value }))} /></div>
          </div>
        </form>
      </Modal>

      {/* Edit ingredient */}
      <Modal open={Boolean(editTarget)} title="Edit ingredient" onClose={() => setEditTarget(null)}
        footer={<div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" size="md" onClick={() => setEditTarget(null)} disabled={editM.isPending}>Cancel</Button>
          <Button type="button" variant="primary" size="md" disabled={editM.isPending || !ef.name.trim()} onClick={() => editM.mutate()}>{editM.isPending ? 'Saving…' : 'Save'}</Button>
        </div>}>
        <div className="space-y-4">
          <div><FieldLabel htmlFor="e-name" required>Name</FieldLabel>
            <TextInput id="e-name" value={ef.name} onChange={(e) => setEf((p) => ({ ...p, name: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><FieldLabel htmlFor="e-cost">Cost per unit</FieldLabel>
              <TextInput id="e-cost" type="number" value={ef.costPrice} onChange={(e) => setEf((p) => ({ ...p, costPrice: e.target.value }))} /></div>
            <div><FieldLabel htmlFor="e-min">Low-stock level</FieldLabel>
              <TextInput id="e-min" type="number" value={ef.minStock} onChange={(e) => setEf((p) => ({ ...p, minStock: e.target.value }))} /></div>
          </div>
          <p className="text-xs text-ink-faint">To change quantity on hand, use “Adjust stock”.</p>
        </div>
      </Modal>

      {/* Adjust stock */}
      <Modal open={Boolean(adjustTarget)} title={`Adjust stock — ${adjustTarget?.name ?? ''}`} onClose={() => setAdjustTarget(null)}
        footer={<div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" size="md" onClick={() => setAdjustTarget(null)} disabled={adjustM.isPending}>Cancel</Button>
          <Button type="button" variant="primary" size="md" disabled={adjustM.isPending || !Number(adj.delta)} onClick={() => adjustM.mutate()}>{adjustM.isPending ? 'Saving…' : 'Apply'}</Button>
        </div>}>
        <div className="space-y-4">
          <p className="text-sm text-ink-muted">On hand now: <span className="font-medium text-ink">{adjustTarget?.quantity} {adjustTarget?.unitType}</span></p>
          <div>
            <FieldLabel htmlFor="a-delta" required>Change (use a negative number to subtract)</FieldLabel>
            <TextInput id="a-delta" type="number" value={adj.delta} autoFocus onChange={(e) => setAdj((p) => ({ ...p, delta: e.target.value }))} placeholder="e.g. 20 or -5" />
          </div>
          <div>
            <FieldLabel htmlFor="a-reason">Reason</FieldLabel>
            <TextInput id="a-reason" value={adj.reason} onChange={(e) => setAdj((p) => ({ ...p, reason: e.target.value }))} placeholder="e.g. delivery received, stock count" />
          </div>
        </div>
      </Modal>
    </div>
  );
}
