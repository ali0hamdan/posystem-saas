import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { createBranch, fetchBranches } from '@/api/branches.api';
import { getApiErrorMessage } from '@/api/client';
import { useAuthStore } from '@/stores/auth-store';
import { useBranchStore } from '@/stores/branch-store';
import { Button } from '@/components/ui/button';
import { FieldLabel, FieldError, TextInput } from '@/components/ui/input';

export function BranchesPage() {
  const queryClient = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const isOwner = me?.role === 'OWNER';
  const hydrateBranches = useBranchStore((s) => s.hydrateBranches);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  const listQuery = useQuery({
    queryKey: ['branches'],
    queryFn: fetchBranches,
  });

  const createMutation = useMutation({
    mutationFn: createBranch,
    onSuccess: async () => {
      toast.success('Branch created');
      setName('');
      setCode('');
      await queryClient.invalidateQueries({ queryKey: ['branches'] });
      const next = await fetchBranches();
      hydrateBranches(next);
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Could not create branch'));
    },
  });

  const rows = listQuery.data ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Branches</h1>
        <p className="mt-1 text-sm text-ink-muted">Locations tied to stock, sales, and reporting.</p>
      </div>

      {isOwner ? (
        <section className="rounded-2xl border border-line bg-surface p-6 shadow-card">
          <h2 className="text-sm font-semibold text-ink">Add branch</h2>
          <form
            className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim() || !code.trim()) {
                toast.error('Name and code are required');
                return;
              }
              createMutation.mutate({ name: name.trim(), code: code.trim() });
            }}
          >
            <div>
              <FieldLabel htmlFor="b-name">Name</FieldLabel>
              <TextInput id="b-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Downtown" />
            </div>
            <div>
              <FieldLabel htmlFor="b-code">Code</FieldLabel>
              <TextInput id="b-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="DTN" />
            </div>
            <div className="sm:col-span-2 lg:col-span-2">
              <Button type="submit" variant="primary" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating…' : 'Create branch'}
              </Button>
              <FieldError message={createMutation.isError ? getApiErrorMessage(createMutation.error) : undefined} />
            </div>
          </form>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
        <div className="border-b border-line px-6 py-4">
          <h2 className="text-sm font-semibold text-ink">Your branches</h2>
        </div>
        {listQuery.isLoading ? (
          <p className="px-6 py-10 text-sm text-ink-muted">Loading…</p>
        ) : listQuery.isError ? (
          <p className="px-6 py-10 text-sm text-danger-700">{getApiErrorMessage(listQuery.error)}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-canvas text-xs font-semibold uppercase tracking-wide text-ink-muted">
                <tr>
                  <th className="px-6 py-3">Name</th>
                  <th className="px-6 py-3">Code</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((b) => (
                  <tr key={b.id} className="border-t border-line">
                    <td className="px-6 py-3 font-medium text-ink">{b.name}</td>
                    <td className="px-6 py-3 font-mono text-xs text-ink-muted">{b.code}</td>
                    <td className="px-6 py-3">
                      <span
                        className={
                          b.isActive
                            ? 'rounded-full bg-success-50 px-2 py-0.5 text-xs font-semibold text-success-800'
                            : 'rounded-full bg-ink/5 px-2 py-0.5 text-xs font-semibold text-ink-muted'
                        }
                      >
                        {b.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
