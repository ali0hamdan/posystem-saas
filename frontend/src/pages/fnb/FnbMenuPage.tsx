import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Pencil, Power, Search, UtensilsCrossed } from 'lucide-react';
import {
  fetchMenuItems, createMenuItem, updateMenuItem, deleteMenuItem,
  fetchModifierGroups, type MenuItem, type ModifierGroup,
} from '@/api/fnb-menu.api';
import { fetchCategories } from '@/api/categories.api';
import { getApiErrorMessage } from '@/api/client';
import { useAuthStore } from '@/stores/auth-store';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { TextInput, FieldLabel, FieldError } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorBanner } from '@/components/ui/error-banner';

const selectClass =
  'w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/25';
const STATIONS = ['KITCHEN', 'BAR'];

function money(v: number | string) {
  const n = typeof v === 'string' ? Number(v) : v;
  return Number.isFinite(n) ? n.toFixed(2) : '0.00';
}

type ItemForm = {
  name: string; price: string; description: string; categoryId: string;
  prepStation: string; isAvailable: boolean; modifierGroupIds: string[];
};

function ItemModal({ open, initial, categories, groups, loading, onClose, onSubmit }: {
  open: boolean; initial?: MenuItem; categories: { id: string; name: string }[];
  groups: ModifierGroup[]; loading: boolean; onClose: () => void; onSubmit: (v: ItemForm) => void;
}) {
  const [form, setForm] = useState<ItemForm>(initial ? {
    name: initial.name, price: money(initial.price), description: initial.description ?? '',
    categoryId: initial.categoryId ?? '', prepStation: initial.prepStation ?? 'KITCHEN',
    isAvailable: initial.isAvailable, modifierGroupIds: initial.modifierGroups?.map((g) => g.modifierGroupId) ?? [],
  } : { name: '', price: '', description: '', categoryId: '', prepStation: 'KITCHEN', isAvailable: true, modifierGroupIds: [] });
  const [err, setErr] = useState<{ name?: string; price?: string }>({});

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: typeof err = {};
    if (!form.name.trim()) next.name = 'Name is required';
    if (form.price === '' || Number(form.price) < 0 || Number.isNaN(Number(form.price))) next.price = 'Enter a valid price';
    setErr(next);
    if (Object.keys(next).length === 0) onSubmit(form);
  }
  function toggleGroup(id: string) {
    setForm((p) => ({
      ...p,
      modifierGroupIds: p.modifierGroupIds.includes(id)
        ? p.modifierGroupIds.filter((g) => g !== id)
        : [...p.modifierGroupIds, id],
    }));
  }

  return (
    <Modal open={open} title={initial ? 'Edit menu item' : 'New menu item'} onClose={onClose}
      footer={<div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" size="md" onClick={onClose} disabled={loading}>Cancel</Button>
        <Button type="submit" form="item-form" variant="primary" size="md" disabled={loading}>
          {loading ? 'Saving…' : initial ? 'Save changes' : 'Create item'}
        </Button>
      </div>}>
      <form id="item-form" onSubmit={submit} className="space-y-4">
        <div>
          <FieldLabel htmlFor="mi-name" required>Name</FieldLabel>
          <TextInput id="mi-name" value={form.name} autoFocus error={err.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Margherita pizza" />
          <FieldError message={err.name} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <FieldLabel htmlFor="mi-price" required>Price</FieldLabel>
            <TextInput id="mi-price" type="number" value={form.price} error={err.price}
              onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))} placeholder="0.00" />
            <FieldError message={err.price} />
          </div>
          <div>
            <FieldLabel htmlFor="mi-station">Prep station</FieldLabel>
            <select id="mi-station" className={selectClass} value={form.prepStation}
              onChange={(e) => setForm((p) => ({ ...p, prepStation: e.target.value }))}>
              {STATIONS.map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
            </select>
          </div>
        </div>
        <div>
          <FieldLabel htmlFor="mi-cat">Category</FieldLabel>
          <select id="mi-cat" className={selectClass} value={form.categoryId}
            onChange={(e) => setForm((p) => ({ ...p, categoryId: e.target.value }))}>
            <option value="">No category</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <FieldLabel htmlFor="mi-desc">Description</FieldLabel>
          <TextInput id="mi-desc" value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Optional" />
        </div>
        <label className="flex items-center gap-2 text-sm text-ink-muted">
          <input type="checkbox" checked={form.isAvailable}
            onChange={(e) => setForm((p) => ({ ...p, isAvailable: e.target.checked }))} />
          Available on the menu
        </label>
        {groups.length > 0 && (
          <div>
            <FieldLabel htmlFor="mi-mods">Modifier groups</FieldLabel>
            <div className="mt-1 flex flex-wrap gap-2">
              {groups.map((g) => {
                const on = form.modifierGroupIds.includes(g.id);
                return (
                  <button type="button" key={g.id} onClick={() => toggleGroup(g.id)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                      on ? 'border-primary-300 bg-primary-50 text-primary-700' : 'border-line bg-surface text-ink-muted hover:border-line-strong'
                    }`}>
                    {g.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}

export function FnbMenuPage() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const canManage = user?.role === 'OWNER' || user?.role === 'ADMIN';

  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<{ open: boolean; edit?: MenuItem }>({ open: false });
  const [del, setDel] = useState<MenuItem | null>(null);

  const itemsQ = useQuery({ queryKey: ['fnb', 'menu', search], queryFn: () => fetchMenuItems({ q: search.trim() || undefined }) });
  const catsQ = useQuery({ queryKey: ['categories', 'all'], queryFn: () => fetchCategories({ limit: 200 }) });
  const groupsQ = useQuery({ queryKey: ['fnb', 'modifier-groups'], queryFn: () => fetchModifierGroups() });

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['fnb', 'menu'] });

  const createM = useMutation({
    mutationFn: createMenuItem,
    onSuccess: () => { toast.success('Menu item created'); invalidate(); setModal({ open: false }); },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Failed to create item')),
  });
  const updateM = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => updateMenuItem(id, body),
    onSuccess: () => { toast.success('Menu item updated'); invalidate(); setModal({ open: false }); },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Failed to update item')),
  });
  const delM = useMutation({
    mutationFn: (id: string) => deleteMenuItem(id),
    onSuccess: () => { toast.success('Menu item removed'); invalidate(); setDel(null); },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Failed to remove item')),
  });

  const items = itemsQ.data ?? [];
  const categories = catsQ.data?.data ?? [];
  const groups = groupsQ.data ?? [];

  function submit(v: ItemForm) {
    const body = {
      name: v.name.trim(), price: Number(v.price), description: v.description.trim() || undefined,
      categoryId: v.categoryId || null, prepStation: v.prepStation, isAvailable: v.isAvailable,
      modifierGroupIds: v.modifierGroupIds,
    };
    if (modal.edit) updateM.mutate({ id: modal.edit.id, body });
    else createM.mutate(body);
  }

  return (
    <div>
      <PageHeader
        title="Menu"
        description="Build the menu your F&B POS sells from."
        actions={canManage ? (
          <Button variant="primary" size="md" onClick={() => setModal({ open: true })}>
            <Plus className="h-4 w-4" /> New item
          </Button>
        ) : undefined}
      />

      <div className="mb-6 relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden />
        <TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search menu…" className="pl-9" />
      </div>

      {itemsQ.isError && <ErrorBanner message={getApiErrorMessage(itemsQ.error, 'Failed to load menu')} className="mb-6" />}

      {itemsQ.isPending && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      )}

      {!itemsQ.isPending && items.length === 0 && (
        <EmptyState
          title={search ? 'No items match your search' : 'No menu items yet'}
          description={canManage ? 'Create your first dish or drink to sell from the F&B POS.' : 'No menu has been set up.'}
          action={canManage && !search ? (
            <Button variant="primary" size="md" onClick={() => setModal({ open: true })}>
              <Plus className="h-4 w-4" /> New item
            </Button>
          ) : undefined}
        />
      )}

      {!itemsQ.isPending && items.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => (
            <div key={it.id} className="group rounded-xl border border-line bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <UtensilsCrossed className="h-4 w-4 shrink-0 text-primary-500" />
                    <p className="truncate font-medium text-ink">{it.name}</p>
                  </div>
                  {it.description && <p className="mt-0.5 truncate text-sm text-ink-muted">{it.description}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-ink">{money(it.price)}</span>
                    <Badge variant="muted">{it.prepStation ?? 'KITCHEN'}</Badge>
                    {!it.isAvailable && <Badge variant="muted">Unavailable</Badge>}
                    {it.modifierGroups && it.modifierGroups.length > 0 && (
                      <span className="text-xs text-ink-faint">{it.modifierGroups.length} modifier group(s)</span>
                    )}
                  </div>
                </div>
                {canManage && (
                  <div className="flex shrink-0 items-center gap-1 opacity-0 transition group-hover:opacity-100">
                    <button title="Edit" onClick={() => setModal({ open: true, edit: it })}
                      className="rounded-lg p-1.5 text-ink-muted hover:bg-canvas hover:text-ink"><Pencil className="h-4 w-4" /></button>
                    <button title="Remove" onClick={() => setDel(it)}
                      className="rounded-lg p-1.5 text-ink-muted hover:bg-danger-50 hover:text-danger-600"><Power className="h-4 w-4" /></button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal.open && (
        <ItemModal
          open={modal.open}
          initial={modal.edit}
          categories={categories}
          groups={groups}
          loading={createM.isPending || updateM.isPending}
          onClose={() => setModal({ open: false })}
          onSubmit={submit}
        />
      )}

      <ConfirmDialog
        open={Boolean(del)}
        title="Remove menu item"
        description={`"${del?.name}" will be hidden from the menu and POS.`}
        confirmLabel="Remove" variant="danger" loading={delM.isPending}
        onConfirm={() => del && delM.mutate(del.id)}
        onCancel={() => setDel(null)}
      />
    </div>
  );
}
