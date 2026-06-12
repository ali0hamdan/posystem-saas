import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Pencil, Power, Trash2, Tag } from 'lucide-react';
import {
  fetchModifierGroups, createModifierGroup, updateModifierGroup, deleteModifierGroup,
  type ModifierGroup,
} from '@/api/fnb-menu.api';
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

type Row = { name: string; priceDelta: string };
type GroupForm = { name: string; minSelect: string; maxSelect: string; required: boolean; rows: Row[] };

function money(v: number | string) {
  const n = typeof v === 'string' ? Number(v) : v;
  return Number.isFinite(n) ? n.toFixed(2) : '0.00';
}

function GroupModal({ open, initial, loading, onClose, onSubmit }: {
  open: boolean; initial?: ModifierGroup; loading: boolean; onClose: () => void; onSubmit: (v: GroupForm) => void;
}) {
  const [form, setForm] = useState<GroupForm>(initial ? {
    name: initial.name, minSelect: String(initial.minSelect), maxSelect: String(initial.maxSelect),
    required: initial.required,
    rows: initial.modifiers.map((m) => ({ name: m.name, priceDelta: money(m.priceDelta) })),
  } : { name: '', minSelect: '0', maxSelect: '1', required: false, rows: [{ name: '', priceDelta: '0' }] });
  const [err, setErr] = useState<string>('');

  function setRow(i: number, patch: Partial<Row>) {
    setForm((p) => ({ ...p, rows: p.rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) }));
  }
  function addRow() { setForm((p) => ({ ...p, rows: [...p.rows, { name: '', priceDelta: '0' }] })); }
  function removeRow(i: number) { setForm((p) => ({ ...p, rows: p.rows.filter((_, idx) => idx !== i) })); }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setErr('Group name is required'); return; }
    onSubmit(form);
  }

  return (
    <Modal open={open} title={initial ? 'Edit modifier group' : 'New modifier group'} onClose={onClose}
      footer={<div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" size="md" onClick={onClose} disabled={loading}>Cancel</Button>
        <Button type="submit" form="group-form" variant="primary" size="md" disabled={loading}>
          {loading ? 'Saving…' : initial ? 'Save changes' : 'Create group'}
        </Button>
      </div>}>
      <form id="group-form" onSubmit={submit} className="space-y-4">
        <div>
          <FieldLabel htmlFor="g-name" required>Group name</FieldLabel>
          <TextInput id="g-name" value={form.name} autoFocus error={err}
            onChange={(e) => { setForm((p) => ({ ...p, name: e.target.value })); setErr(''); }}
            placeholder="e.g. Size, Add-ons, Cooking" />
          <FieldError message={err} />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <FieldLabel htmlFor="g-min">Min select</FieldLabel>
            <TextInput id="g-min" type="number" value={form.minSelect}
              onChange={(e) => setForm((p) => ({ ...p, minSelect: e.target.value }))} />
          </div>
          <div>
            <FieldLabel htmlFor="g-max">Max select</FieldLabel>
            <TextInput id="g-max" type="number" value={form.maxSelect}
              onChange={(e) => setForm((p) => ({ ...p, maxSelect: e.target.value }))} />
          </div>
          <label className="flex items-end gap-2 pb-2.5 text-sm text-ink-muted">
            <input type="checkbox" checked={form.required}
              onChange={(e) => setForm((p) => ({ ...p, required: e.target.checked }))} />
            Required
          </label>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <FieldLabel htmlFor="g-rows">Options</FieldLabel>
            <button type="button" onClick={addRow} className="text-xs font-medium text-primary-600 hover:underline">+ Add option</button>
          </div>
          <div className="space-y-2">
            {form.rows.map((r, i) => (
              <div key={i} className="flex items-center gap-2">
                <TextInput value={r.name} placeholder="Option name (e.g. Large)" className="flex-1"
                  onChange={(e) => setRow(i, { name: e.target.value })} />
                <TextInput type="number" value={r.priceDelta} placeholder="+0.00" className="w-28"
                  onChange={(e) => setRow(i, { priceDelta: e.target.value })} />
                <button type="button" title="Remove" onClick={() => removeRow(i)}
                  className="rounded-lg p-2 text-ink-muted hover:bg-danger-50 hover:text-danger-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
            {form.rows.length === 0 && <p className="text-xs text-ink-faint">No options yet — add at least one.</p>}
          </div>
        </div>
      </form>
    </Modal>
  );
}

export function FnbModifiersPage() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const canManage = user?.role === 'OWNER' || user?.role === 'ADMIN';

  const [modal, setModal] = useState<{ open: boolean; edit?: ModifierGroup }>({ open: false });
  const [del, setDel] = useState<ModifierGroup | null>(null);

  const q = useQuery({ queryKey: ['fnb', 'modifier-groups'], queryFn: () => fetchModifierGroups() });
  const invalidate = () => void qc.invalidateQueries({ queryKey: ['fnb', 'modifier-groups'] });

  const createM = useMutation({
    mutationFn: createModifierGroup,
    onSuccess: () => { toast.success('Group created'); invalidate(); setModal({ open: false }); },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Failed to create group')),
  });
  const updateM = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => updateModifierGroup(id, body),
    onSuccess: () => { toast.success('Group updated'); invalidate(); setModal({ open: false }); },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Failed to update group')),
  });
  const delM = useMutation({
    mutationFn: (id: string) => deleteModifierGroup(id),
    onSuccess: () => { toast.success('Group removed'); invalidate(); setDel(null); },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Failed to remove group')),
  });

  const groups = q.data ?? [];

  function submit(v: GroupForm) {
    const body = {
      name: v.name.trim(),
      minSelect: Number(v.minSelect) || 0,
      maxSelect: Math.max(1, Number(v.maxSelect) || 1),
      required: v.required,
      modifiers: v.rows.filter((r) => r.name.trim()).map((r, i) => ({
        name: r.name.trim(), priceDelta: Number(r.priceDelta) || 0, sortOrder: i,
      })),
    };
    if (modal.edit) updateM.mutate({ id: modal.edit.id, body });
    else createM.mutate(body);
  }

  return (
    <div>
      <PageHeader
        title="Modifiers"
        description="Reusable option groups (size, add-ons, cooking) you attach to menu items."
        actions={canManage ? (
          <Button variant="primary" size="md" onClick={() => setModal({ open: true })}>
            <Plus className="h-4 w-4" /> New group
          </Button>
        ) : undefined}
      />

      {q.isError && <ErrorBanner message={getApiErrorMessage(q.error, 'Failed to load modifier groups')} className="mb-6" />}

      {q.isPending && (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      )}

      {!q.isPending && groups.length === 0 && (
        <EmptyState
          title="No modifier groups yet"
          description={canManage ? 'Create reusable option groups to attach to menu items.' : 'No modifier groups have been set up.'}
          action={canManage ? (
            <Button variant="primary" size="md" onClick={() => setModal({ open: true })}>
              <Plus className="h-4 w-4" /> New group
            </Button>
          ) : undefined}
        />
      )}

      {!q.isPending && groups.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {groups.map((g) => (
            <div key={g.id} className="group rounded-xl border border-line bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4 shrink-0 text-primary-500" />
                    <p className="truncate font-medium text-ink">{g.name}</p>
                    {g.required && <Badge variant="muted">Required</Badge>}
                  </div>
                  <p className="mt-0.5 text-xs text-ink-faint">Choose {g.minSelect}–{g.maxSelect}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {g.modifiers.map((m) => (
                      <span key={m.id} className="rounded-full border border-line bg-canvas px-2.5 py-0.5 text-xs text-ink-muted">
                        {m.name}{Number(m.priceDelta) ? ` +${money(m.priceDelta)}` : ''}
                      </span>
                    ))}
                    {g.modifiers.length === 0 && <span className="text-xs text-ink-faint">No options</span>}
                  </div>
                </div>
                {canManage && (
                  <div className="flex shrink-0 items-center gap-1 opacity-0 transition group-hover:opacity-100">
                    <button title="Edit" onClick={() => setModal({ open: true, edit: g })}
                      className="rounded-lg p-1.5 text-ink-muted hover:bg-canvas hover:text-ink"><Pencil className="h-4 w-4" /></button>
                    <button title="Remove" onClick={() => setDel(g)}
                      className="rounded-lg p-1.5 text-ink-muted hover:bg-danger-50 hover:text-danger-600"><Power className="h-4 w-4" /></button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal.open && (
        <GroupModal
          open={modal.open}
          initial={modal.edit}
          loading={createM.isPending || updateM.isPending}
          onClose={() => setModal({ open: false })}
          onSubmit={submit}
        />
      )}

      <ConfirmDialog
        open={Boolean(del)}
        title="Remove modifier group"
        description={`"${del?.name}" will be removed and detached from menu items.`}
        confirmLabel="Remove" variant="danger" loading={delM.isPending}
        onConfirm={() => del && delM.mutate(del.id)}
        onCancel={() => setDel(null)}
      />
    </div>
  );
}
