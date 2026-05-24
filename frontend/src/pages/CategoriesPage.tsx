import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FolderPlus, Pencil, Power, Search } from 'lucide-react';
import { fetchCategories, createCategory, updateCategory, deactivateCategory } from '@/api/categories.api';
import { getApiErrorMessage } from '@/api/client';
import { useAuthStore } from '@/stores/auth-store';
import { useDebouncedValue } from '@/features/products/use-debounced-value';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { TextInput, FieldLabel, FieldError } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorBanner } from '@/components/ui/error-banner';
import type { Category } from '@/types/category';

type FormState = { name: string; description: string };
const EMPTY_FORM: FormState = { name: '', description: '' };

function CategoryFormModal({
  open,
  initial,
  loading,
  onClose,
  onSubmit,
}: {
  open: boolean;
  initial?: Category;
  loading: boolean;
  onClose: () => void;
  onSubmit: (values: FormState) => void;
}) {
  const [form, setForm] = useState<FormState>(
    initial ? { name: initial.name, description: initial.description ?? '' } : EMPTY_FORM,
  );
  const [errors, setErrors] = useState<Partial<FormState>>({});

  function validate(): boolean {
    const next: Partial<FormState> = {};
    if (!form.name.trim()) next.name = 'Name is required';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (validate()) onSubmit(form);
  }

  return (
    <Modal
      open={open}
      title={initial ? 'Edit category' : 'New category'}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" size="md" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" form="category-form" variant="primary" size="md" disabled={loading}>
            {loading ? 'Saving…' : initial ? 'Save changes' : 'Create category'}
          </Button>
        </div>
      }
    >
      <form id="category-form" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <FieldLabel htmlFor="cat-name" required>Name</FieldLabel>
          <TextInput
            id="cat-name"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="e.g. Beverages"
            error={errors.name}
            autoFocus
          />
          <FieldError message={errors.name} />
        </div>
        <div>
          <FieldLabel htmlFor="cat-desc">Description</FieldLabel>
          <TextInput
            id="cat-desc"
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            placeholder="Optional description"
          />
        </div>
      </form>
    </Modal>
  );
}

export function CategoriesPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const canManage = user?.role === 'OWNER' || user?.role === 'ADMIN';

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [showInactive, setShowInactive] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Category | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<Category | null>(null);

  const query = useQuery({
    queryKey: ['categories', 'list', debouncedSearch, showInactive],
    queryFn: () =>
      fetchCategories({
        q: debouncedSearch.trim() || undefined,
        includeInactive: canManage && showInactive ? true : undefined,
        limit: 200,
        page: 1,
      }),
    staleTime: 2 * 60 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: createCategory,
    onSuccess: () => {
      toast.success('Category created');
      void queryClient.invalidateQueries({ queryKey: ['categories'] });
      setCreateOpen(false);
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to create category')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<{ name: string; description: string }> }) =>
      updateCategory(id, body),
    onSuccess: () => {
      toast.success('Category updated');
      void queryClient.invalidateQueries({ queryKey: ['categories'] });
      setEditTarget(null);
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to update category')),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => deactivateCategory(id),
    onSuccess: () => {
      toast.success('Category deactivated');
      void queryClient.invalidateQueries({ queryKey: ['categories'] });
      setDeactivateTarget(null);
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to deactivate category')),
  });

  const categories = query.data?.data ?? [];

  return (
    <div>
      <PageHeader
        title="Categories"
        description="Organise your products into categories."
        actions={
          canManage ? (
            <Button variant="primary" size="md" onClick={() => setCreateOpen(true)}>
              <FolderPlus className="h-4 w-4" />
              New category
            </Button>
          ) : undefined
        }
      />

      {/* Toolbar */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden />
          <TextInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search categories…"
            className="pl-9"
          />
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => setShowInactive((p) => !p)}
            className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
              showInactive
                ? 'border-primary-300 bg-primary-50 text-primary-700'
                : 'border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink'
            }`}
          >
            {showInactive ? 'Hiding inactive' : 'Show inactive'}
          </button>
        )}
      </div>

      {/* Error */}
      {query.isError && (
        <ErrorBanner message={getApiErrorMessage(query.error, 'Failed to load categories')} className="mb-6" />
      )}

      {/* Loading */}
      {query.isPending && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      )}

      {/* Empty */}
      {!query.isPending && !query.isError && categories.length === 0 && (
        <EmptyState
          title={debouncedSearch ? 'No categories match your search' : 'No categories yet'}
          description={
            canManage
              ? 'Create your first category to organise products.'
              : 'No categories have been created for this store.'
          }
          action={
            canManage && !debouncedSearch ? (
              <Button variant="primary" size="md" onClick={() => setCreateOpen(true)}>
                <FolderPlus className="h-4 w-4" />
                New category
              </Button>
            ) : undefined
          }
        />
      )}

      {/* Grid */}
      {!query.isPending && categories.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className={`group flex items-start justify-between gap-3 rounded-xl border bg-surface p-4 transition ${
                cat.isActive ? 'border-line' : 'border-line opacity-60'
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium text-ink">{cat.name}</p>
                  {!cat.isActive && (
                    <Badge variant="muted">Inactive</Badge>
                  )}
                </div>
                {cat.description && (
                  <p className="mt-0.5 truncate text-sm text-ink-muted">{cat.description}</p>
                )}
              </div>
              {canManage && (
                <div className="flex shrink-0 items-center gap-1 opacity-0 transition group-hover:opacity-100">
                  <button
                    type="button"
                    title="Edit"
                    onClick={() => setEditTarget(cat)}
                    className="rounded-lg p-1.5 text-ink-muted hover:bg-canvas hover:text-ink"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  {cat.isActive && (
                    <button
                      type="button"
                      title="Deactivate"
                      onClick={() => setDeactivateTarget(cat)}
                      className="rounded-lg p-1.5 text-ink-muted hover:bg-danger-50 hover:text-danger-600"
                    >
                      <Power className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Summary */}
      {!query.isPending && categories.length > 0 && (
        <p className="mt-4 text-right text-xs text-ink-faint">
          {categories.length} {categories.length === 1 ? 'category' : 'categories'}
        </p>
      )}

      {/* Create modal */}
      {createOpen && (
        <CategoryFormModal
          open={createOpen}
          loading={createMutation.isPending}
          onClose={() => setCreateOpen(false)}
          onSubmit={(values) =>
            createMutation.mutate({
              name: values.name.trim(),
              description: values.description.trim() || undefined,
            })
          }
        />
      )}

      {/* Edit modal */}
      {editTarget && (
        <CategoryFormModal
          open={Boolean(editTarget)}
          initial={editTarget}
          loading={updateMutation.isPending}
          onClose={() => setEditTarget(null)}
          onSubmit={(values) =>
            updateMutation.mutate({
              id: editTarget.id,
              body: {
                name: values.name.trim(),
                description: values.description.trim() || undefined,
              },
            })
          }
        />
      )}

      {/* Deactivate confirm */}
      <ConfirmDialog
        open={Boolean(deactivateTarget)}
        title="Deactivate category"
        description={`"${deactivateTarget?.name}" will be hidden from new products and the POS. Existing products keep their category.`}
        confirmLabel="Deactivate"
        variant="danger"
        loading={deactivateMutation.isPending}
        onConfirm={() => deactivateTarget && deactivateMutation.mutate(deactivateTarget.id)}
        onCancel={() => setDeactivateTarget(null)}
      />
    </div>
  );
}
