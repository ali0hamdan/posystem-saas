import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, FolderTree, Pencil } from 'lucide-react';
import { fetchMenuItems, type MenuItem } from '@/api/fnb-menu.api';
import { fetchRecipes, getRecipe, upsertRecipe, deleteRecipe } from '@/api/fnb-recipes.api';
import { fetchProducts } from '@/api/products.api';
import type { Product } from '@/types/product';
import { getApiErrorMessage } from '@/api/client';
import { useAuthStore } from '@/stores/auth-store';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/Modal';
import { TextInput, FieldLabel } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorBanner } from '@/components/ui/error-banner';

const selectClass =
  'rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/25';
type Row = { productId: string; quantity: string; unit: string };

function RecipeModal({ menuItem, products, canManage, onClose, onSaved }: {
  menuItem: MenuItem; products: Product[]; canManage: boolean; onClose: () => void; onSaved: () => void;
}) {
  const recipeQ = useQuery({ queryKey: ['fnb', 'recipe', menuItem.id], queryFn: () => getRecipe(menuItem.id) });
  const [yieldQty, setYieldQty] = useState('1');
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (loaded || !recipeQ.data) return;
    const r = recipeQ.data.recipe;
    if (r) {
      setYieldQty(String(r.yieldQty));
      setNotes(r.notes ?? '');
      setRows(r.ingredients.map((i) => ({ productId: i.productId, quantity: String(i.quantity), unit: i.unit ?? '' })));
    } else {
      setRows([{ productId: '', quantity: '1', unit: '' }]);
    }
    setLoaded(true);
  }, [recipeQ.data, loaded]);

  const saveM = useMutation({
    mutationFn: () => upsertRecipe(menuItem.id, {
      yieldQty: Number(yieldQty) || 1,
      notes: notes.trim() || undefined,
      ingredients: rows.filter((r) => r.productId && Number(r.quantity) > 0)
        .map((r) => ({ productId: r.productId, quantity: Number(r.quantity), unit: r.unit.trim() || undefined })),
    }),
    onSuccess: () => { toast.success('Recipe saved'); onSaved(); },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Failed to save recipe')),
  });
  const delM = useMutation({
    mutationFn: () => deleteRecipe(menuItem.id),
    onSuccess: () => { toast.success('Recipe removed'); onSaved(); },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Failed to remove recipe')),
  });

  const setRow = (i: number, patch: Partial<Row>) => setRows((p) => p.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const hasRecipe = Boolean(recipeQ.data?.recipe);

  return (
    <Modal open title={`Recipe — ${menuItem.name}`} onClose={onClose}
      footer={<div className="flex items-center justify-between gap-2">
        {hasRecipe && canManage
          ? <Button type="button" variant="secondary" size="md" onClick={() => delM.mutate()} disabled={delM.isPending}>
              <Trash2 className="h-4 w-4" /> Remove
            </Button>
          : <span />}
        <div className="flex gap-2">
          <Button type="button" variant="secondary" size="md" onClick={onClose}>Close</Button>
          {canManage && <Button type="button" variant="primary" size="md" onClick={() => saveM.mutate()} disabled={saveM.isPending}>{saveM.isPending ? 'Saving…' : 'Save recipe'}</Button>}
        </div>
      </div>}>
      {recipeQ.isPending ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)}</div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel htmlFor="r-yield">Yields (portions)</FieldLabel>
              <TextInput id="r-yield" type="number" value={yieldQty} onChange={(e) => setYieldQty(e.target.value)} disabled={!canManage} />
            </div>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <FieldLabel htmlFor="r-ing">Ingredients</FieldLabel>
              {canManage && <button type="button" onClick={() => setRows((p) => [...p, { productId: '', quantity: '1', unit: '' }])} className="text-xs font-medium text-primary-600 hover:underline">+ Add ingredient</button>}
            </div>
            <div className="space-y-2">
              {rows.map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select className={`${selectClass} flex-1`} value={r.productId} disabled={!canManage} onChange={(e) => setRow(i, { productId: e.target.value })}>
                    <option value="">Select ingredient…</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <TextInput type="number" value={r.quantity} placeholder="Qty" className="w-20" onChange={(e) => setRow(i, { quantity: e.target.value })} disabled={!canManage} />
                  <TextInput value={r.unit} placeholder="unit" className="w-20" onChange={(e) => setRow(i, { unit: e.target.value })} disabled={!canManage} />
                  {canManage && <button type="button" onClick={() => setRows((p) => p.filter((_, idx) => idx !== i))} className="rounded-lg p-2 text-ink-muted hover:bg-danger-50 hover:text-danger-600"><Trash2 className="h-4 w-4" /></button>}
                </div>
              ))}
              {rows.length === 0 && <p className="text-xs text-ink-faint">No ingredients yet.</p>}
            </div>
          </div>
          <div>
            <FieldLabel htmlFor="r-notes">Notes</FieldLabel>
            <TextInput id="r-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Prep notes (optional)" disabled={!canManage} />
          </div>
        </div>
      )}
    </Modal>
  );
}

export function FnbRecipesPage() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const canManage = user?.role === 'OWNER' || user?.role === 'ADMIN';
  const [editItem, setEditItem] = useState<MenuItem | null>(null);

  const menuQ = useQuery({ queryKey: ['fnb', 'menu', 'recipes'], queryFn: () => fetchMenuItems() });
  const recipesQ = useQuery({ queryKey: ['fnb', 'recipes'], queryFn: () => fetchRecipes() });
  const productsQ = useQuery({ queryKey: ['products', 'all'], queryFn: () => fetchProducts({ limit: 500, page: 1 }) });

  const menu = menuQ.data ?? [];
  const recipes = recipesQ.data ?? [];
  const products = productsQ.data?.data ?? [];
  const countByItem = new Map(recipes.map((r) => [r.menuItemId, r._count.ingredients]));

  function onSaved() {
    void qc.invalidateQueries({ queryKey: ['fnb', 'recipes'] });
    void qc.invalidateQueries({ queryKey: ['fnb', 'recipe'] });
    setEditItem(null);
  }

  return (
    <div>
      <PageHeader title="Recipes" description="Link each menu item to the ingredients it uses." />

      {menuQ.isError && <ErrorBanner message={getApiErrorMessage(menuQ.error, 'Failed to load menu')} className="mb-6" />}

      {menuQ.isPending ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      ) : menu.length === 0 ? (
        <EmptyState title="No menu items yet" description="Add menu items first, then attach recipes to them." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {menu.map((m) => {
            const count = countByItem.get(m.id) ?? 0;
            return (
              <button key={m.id} onClick={() => setEditItem(m)} className="group flex items-center justify-between rounded-xl border border-line bg-surface p-4 text-left transition hover:border-primary-300">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <FolderTree className="h-4 w-4 shrink-0 text-primary-500" />
                    <span className="truncate font-medium text-ink">{m.name}</span>
                  </div>
                  <div className="mt-1">
                    {count > 0 ? <Badge variant="muted">{count} ingredient{count === 1 ? '' : 's'}</Badge> : <span className="text-xs text-ink-faint">No recipe yet</span>}
                  </div>
                </div>
                <span className="text-ink-muted opacity-0 transition group-hover:opacity-100">{count > 0 ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}</span>
              </button>
            );
          })}
        </div>
      )}

      {editItem && (
        <RecipeModal menuItem={editItem} products={products} canManage={canManage} onClose={() => setEditItem(null)} onSaved={onSaved} />
      )}
    </div>
  );
}
