import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  createSupplier,
  deleteSupplier,
  fetchSuppliers,
  updateSupplier,
  type CreateSupplierBody,
  type UpdateSupplierBody,
} from '@/api/suppliers.api';
import { getApiErrorMessage } from '@/api/client';
import { Button } from '@/components/ui/button';
import type { Supplier } from '@/types/supplier';

// ── Shared form field style ───────────────────────────────────────────────────
const inputCls =
  'w-full rounded-lg border border-line bg-canvas px-3 py-2.5 text-sm text-ink outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-500/25';
const labelCls = 'mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-muted';

// ── Supplier form (create + edit) ─────────────────────────────────────────────

type SupplierFormState = {
  name: string;
  phone: string;
  email: string;
  address: string;
};

function blankForm(): SupplierFormState {
  return { name: '', phone: '', email: '', address: '' };
}

function supplierToForm(s: Supplier): SupplierFormState {
  return {
    name: s.name,
    phone: s.phone ?? '',
    email: s.email ?? '',
    address: s.address ?? '',
  };
}

type SupplierModalProps = {
  title: string;
  initial: SupplierFormState;
  saving: boolean;
  onSave: (form: SupplierFormState) => void;
  onClose: () => void;
};

function SupplierModal({ title, initial, saving, onSave, onClose }: SupplierModalProps) {
  const [form, setForm] = useState<SupplierFormState>(initial);
  const set = (k: keyof SupplierFormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
        aria-label="Close"
        onClick={() => !saving && onClose()}
      />
      <div className="relative z-[101] w-full max-w-lg rounded-2xl border border-line bg-surface p-6 shadow-panel">
        <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>

        <div className="mt-5 space-y-4">
          <div>
            <label className={labelCls}>Name *</label>
            <input
              className={inputCls}
              value={form.name}
              onChange={set('name')}
              placeholder="Supplier name"
              maxLength={200}
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Phone</label>
              <input
                className={inputCls}
                value={form.phone}
                onChange={set('phone')}
                placeholder="+1 555 000 0000"
                maxLength={50}
              />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input
                type="email"
                className={inputCls}
                value={form.email}
                onChange={set('email')}
                placeholder="supplier@example.com"
                maxLength={200}
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>Address</label>
            <textarea
              className={`${inputCls} resize-none`}
              rows={2}
              value={form.address}
              onChange={set('address')}
              placeholder="Street, city, country…"
              maxLength={500}
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="secondary" disabled={saving} onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={saving || !form.name.trim()}
            onClick={() => onSave(form)}
            className="gap-2"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Deactivate confirm ────────────────────────────────────────────────────────

type DeactivateDialogProps = {
  supplier: Supplier;
  deleting: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

function DeactivateDialog({ supplier, deleting, onConfirm, onClose }: DeactivateDialogProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
        aria-label="Close"
        onClick={() => !deleting && onClose()}
      />
      <div className="relative z-[101] w-full max-w-sm rounded-2xl border border-line bg-surface p-6 shadow-panel">
        <h3 className="font-display text-lg font-semibold text-ink">Remove supplier</h3>
        <p className="mt-2 text-sm text-ink-muted">
          Remove <span className="font-medium text-ink">{supplier.name}</span>? Existing purchase orders will be
          unaffected.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="secondary" disabled={deleting} onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="danger" disabled={deleting} onClick={onConfirm} className="gap-2">
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Remove
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function SuppliersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Supplier | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);

  const suppliersQuery = useQuery({
    queryKey: ['suppliers', search, showInactive],
    queryFn: () =>
      fetchSuppliers({ q: search.trim() || undefined, includeInactive: showInactive, limit: 200 }),
  });

  const createMutation = useMutation({
    mutationFn: (body: CreateSupplierBody) => createSupplier(body),
    onSuccess: () => {
      toast.success('Supplier created');
      void qc.invalidateQueries({ queryKey: ['suppliers'] });
      setCreateOpen(false);
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Could not create supplier')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateSupplierBody }) => updateSupplier(id, body),
    onSuccess: () => {
      toast.success('Supplier updated');
      void qc.invalidateQueries({ queryKey: ['suppliers'] });
      setEditTarget(null);
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Could not update supplier')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSupplier(id),
    onSuccess: () => {
      toast.success('Supplier removed');
      void qc.invalidateQueries({ queryKey: ['suppliers'] });
      setDeleteTarget(null);
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Could not remove supplier')),
  });

  function handleCreate(form: SupplierFormState) {
    createMutation.mutate({
      name: form.name.trim(),
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      address: form.address.trim() || undefined,
    });
  }

  function handleUpdate(form: SupplierFormState) {
    if (!editTarget) return;
    updateMutation.mutate({
      id: editTarget.id,
      body: {
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined,
      },
    });
  }

  const suppliers = suppliersQuery.data?.data ?? [];

  return (
    <div className="mx-auto max-w-[1100px] space-y-6 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink md:text-3xl">Suppliers</h1>
          <p className="mt-1 text-sm text-ink-muted">Manage your product suppliers and contact information.</p>
        </div>
        <Button type="button" variant="primary" onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          New supplier
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-surface p-4 shadow-card">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search suppliers…"
            className="w-full rounded-lg border border-line bg-canvas py-2 pl-10 pr-3 text-sm text-ink outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-500/25"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            className="rounded border-line text-primary-500"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          Show inactive
        </label>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
        {suppliersQuery.isLoading ? (
          <div className="flex items-center justify-center gap-2 p-10 text-ink-muted">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading…
          </div>
        ) : suppliersQuery.isError ? (
          <p className="p-6 text-sm text-danger-700">
            {getApiErrorMessage(suppliersQuery.error, 'Could not load suppliers.')}
          </p>
        ) : !suppliers.length ? (
          <p className="p-6 text-sm text-ink-muted">
            {search ? 'No suppliers match your search.' : 'No suppliers yet. Add your first one above.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead className="border-b border-line bg-canvas text-xs font-semibold uppercase tracking-wide text-ink-faint">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Address</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {suppliers.map((s) => (
                  <tr key={s.id} className="hover:bg-canvas">
                    <td className="px-4 py-3 font-medium text-ink">{s.name}</td>
                    <td className="px-4 py-3 text-ink-muted">{s.phone ?? '—'}</td>
                    <td className="px-4 py-3 text-ink-muted">{s.email ?? '—'}</td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-ink-muted">{s.address ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          s.isActive
                            ? 'bg-success-100 text-success-700'
                            : 'bg-canvas text-ink-faint'
                        }`}
                      >
                        {s.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setEditTarget(s)}
                          className="rounded p-1.5 text-ink-faint hover:bg-surface hover:text-ink"
                          aria-label="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(s)}
                          className="rounded p-1.5 text-ink-faint hover:bg-surface hover:text-danger-600"
                          aria-label="Remove"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {createOpen ? (
        <SupplierModal
          title="New supplier"
          initial={blankForm()}
          saving={createMutation.isPending}
          onSave={handleCreate}
          onClose={() => setCreateOpen(false)}
        />
      ) : null}

      {editTarget ? (
        <SupplierModal
          title="Edit supplier"
          initial={supplierToForm(editTarget)}
          saving={updateMutation.isPending}
          onSave={handleUpdate}
          onClose={() => setEditTarget(null)}
        />
      ) : null}

      {deleteTarget ? (
        <DeactivateDialog
          supplier={deleteTarget}
          deleting={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
          onClose={() => setDeleteTarget(null)}
        />
      ) : null}
    </div>
  );
}
