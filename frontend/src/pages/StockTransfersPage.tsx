import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  createStockTransfer,
  fetchStockTransfers,
  updateStockTransferStatus,
  type StockTransferRow,
  type StockTransferStatus,
} from '@/api/stock-transfers.api';
import { getApiErrorMessage } from '@/api/client';
import { useBranchStore } from '@/stores/branch-store';
import { Button } from '@/components/ui/button';
import { FieldLabel, TextInput } from '@/components/ui/input';

export function StockTransfersPage() {
  const queryClient = useQueryClient();
  const branches = useBranchStore((s) => s.branches);
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState('1');

  const listQuery = useQuery({
    queryKey: ['stock-transfers'],
    queryFn: () => fetchStockTransfers({ page: 1, limit: 50 }),
  });

  const createMutation = useMutation({
    mutationFn: createStockTransfer,
    onSuccess: () => {
      toast.success('Transfer created (draft)');
      void queryClient.invalidateQueries({ queryKey: ['stock-transfers'] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Could not create transfer')),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: StockTransferStatus }) =>
      updateStockTransferStatus(id, status),
    onSuccess: (_, v) => {
      toast.success(`Status: ${v.status}`);
      void queryClient.invalidateQueries({ queryKey: ['stock-transfers'] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Could not update status')),
  });

  const rows = listQuery.data?.data ?? [];

  const branchOptions = useMemo(
    () => branches.filter((b) => b.isActive).map((b) => ({ id: b.id, label: `${b.name} (${b.code})` })),
    [branches],
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Stock transfers</h1>
        <p className="mt-1 text-sm text-ink-muted">Move inventory between branches (draft → sent → received).</p>
      </div>

      <section className="rounded-2xl border border-line bg-surface p-6 shadow-card">
        <h2 className="text-sm font-semibold text-ink">New transfer (draft)</h2>
        <form
          className="mt-4 grid gap-4 lg:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const q = Number.parseInt(qty, 10);
            if (!fromId || !toId || fromId === toId) {
              toast.error('Pick two different branches');
              return;
            }
            if (!productId.trim() || Number.isNaN(q) || q < 1) {
              toast.error('Valid product and quantity required');
              return;
            }
            createMutation.mutate({
              fromBranchId: fromId,
              toBranchId: toId,
              items: [{ productId: productId.trim(), quantity: q }],
            });
          }}
        >
          <div>
            <FieldLabel>From</FieldLabel>
            <select
              className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm"
              value={fromId}
              onChange={(e) => setFromId(e.target.value)}
            >
              <option value="">Select branch</option>
              {branchOptions.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel>To</FieldLabel>
            <select
              className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm"
              value={toId}
              onChange={(e) => setToId(e.target.value)}
            >
              <option value="">Select branch</option>
              {branchOptions.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel htmlFor="st-product">Product ID</FieldLabel>
            <TextInput id="st-product" value={productId} onChange={(e) => setProductId(e.target.value)} placeholder="UUID" />
          </div>
          <div>
            <FieldLabel htmlFor="st-qty">Quantity</FieldLabel>
            <TextInput id="st-qty" value={qty} onChange={(e) => setQty(e.target.value)} inputMode="numeric" />
          </div>
          <div className="lg:col-span-2">
            <Button type="submit" variant="primary" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Saving…' : 'Create draft'}
            </Button>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
        <div className="border-b border-line px-6 py-4">
          <h2 className="text-sm font-semibold text-ink">Recent transfers</h2>
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
                  <th className="px-6 py-3">When</th>
                  <th className="px-6 py-3">Route</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Lines</th>
                  <th className="px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r: StockTransferRow) => (
                  <tr key={r.id} className="border-t border-line">
                    <td className="px-6 py-3 text-ink-muted">{new Date(r.createdAt).toLocaleString()}</td>
                    <td className="px-6 py-3">
                      <span className="font-medium text-ink">{r.fromBranch.code}</span>
                      <span className="text-ink-faint"> → </span>
                      <span className="font-medium text-ink">{r.toBranch.code}</span>
                    </td>
                    <td className="px-6 py-3 font-mono text-xs">{r.status}</td>
                    <td className="px-6 py-3 text-ink-muted">{r.items.length}</td>
                    <td className="px-6 py-3">
                      <div className="flex flex-wrap gap-2">
                        {r.status === 'DRAFT' ? (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              disabled={statusMutation.isPending}
                              onClick={() => statusMutation.mutate({ id: r.id, status: 'SENT' })}
                            >
                              Mark sent
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={statusMutation.isPending}
                              onClick={() => statusMutation.mutate({ id: r.id, status: 'CANCELLED' })}
                            >
                              Cancel
                            </Button>
                          </>
                        ) : null}
                        {r.status === 'SENT' ? (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              variant="primary"
                              disabled={statusMutation.isPending}
                              onClick={() => statusMutation.mutate({ id: r.id, status: 'RECEIVED' })}
                            >
                              Mark received
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={statusMutation.isPending}
                              onClick={() => statusMutation.mutate({ id: r.id, status: 'CANCELLED' })}
                            >
                              Cancel
                            </Button>
                          </>
                        ) : null}
                      </div>
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
