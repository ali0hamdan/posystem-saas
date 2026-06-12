import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { fetchStockMovements, adjustStock } from '@/api/stock-movements.api';
import { fetchProducts } from '@/api/products.api';
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

const selectClass =
  'w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/25';
const REASONS: ('DAMAGE' | 'EXPIRED')[] = ['DAMAGE', 'EXPIRED'];
const dt = (iso: string) => new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export function FnbWastePage() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const canManage = user?.role === 'OWNER' || user?.role === 'ADMIN';
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ productId: '', quantity: '1', type: 'DAMAGE' as 'DAMAGE' | 'EXPIRED', reason: '' });
  const [err, setErr] = useState<{ product?: string; qty?: string; reason?: string }>({});

  const productsQ = useQuery({ queryKey: ['products', 'all'], queryFn: () => fetchProducts({ limit: 500, page: 1 }) });
  const wasteQ = useQuery({
    queryKey: ['stock', 'waste'],
    queryFn: async () => {
      const [d, e] = await Promise.all([
        fetchStockMovements({ type: 'DAMAGE', limit: 50, page: 1 }),
        fetchStockMovements({ type: 'EXPIRED', limit: 50, page: 1 }),
      ]);
      return [...d.data, ...e.data].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 50);
    },
  });

  const recordM = useMutation({
    mutationFn: () => adjustStock({ productId: form.productId, quantityChange: -Math.abs(Number(form.quantity) || 0), type: form.type, reason: form.reason.trim(), referenceType: 'fnb_waste' }),
    onSuccess: () => {
      toast.success('Waste recorded');
      void qc.invalidateQueries({ queryKey: ['stock', 'waste'] });
      void qc.invalidateQueries({ queryKey: ['products'] });
      setOpen(false);
      setForm({ productId: '', quantity: '1', type: 'DAMAGE', reason: '' });
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Failed to record waste')),
  });

  const products = productsQ.data?.data ?? [];
  const rows = wasteQ.data ?? [];

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: typeof err = {};
    if (!form.productId) next.product = 'Pick an item';
    if (!(Number(form.quantity) > 0)) next.qty = 'Enter a quantity';
    if (!form.reason.trim()) next.reason = 'Add a short reason';
    setErr(next);
    if (Object.keys(next).length === 0) recordM.mutate();
  }

  return (
    <div>
      <PageHeader title="Waste" description="Record spoiled or damaged stock. Deducts from inventory."
        actions={canManage ? <Button variant="primary" size="md" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Record waste</Button> : undefined} />

      {wasteQ.isError && <ErrorBanner message={getApiErrorMessage(wasteQ.error, 'Failed to load waste log')} className="mb-6" />}

      {wasteQ.isPending ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
      ) : rows.length === 0 ? (
        <EmptyState title="No waste recorded" description={canManage ? 'Record damaged or expired stock to keep inventory accurate.' : 'Nothing recorded yet.'} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead className="bg-canvas-raised text-left text-xs uppercase tracking-wide text-ink-faint">
              <tr>
                <th className="px-4 py-2.5 font-semibold">When</th>
                <th className="px-4 py-2.5 font-semibold">Item</th>
                <th className="px-4 py-2.5 font-semibold">Reason</th>
                <th className="px-4 py-2.5 font-semibold text-right">Qty</th>
                <th className="px-4 py-2.5 font-semibold">By</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id} className="border-t border-line">
                  <td className="px-4 py-2.5 text-ink-muted">{dt(m.createdAt)}</td>
                  <td className="px-4 py-2.5 font-medium text-ink">{m.product?.name ?? '—'}</td>
                  <td className="px-4 py-2.5"><Badge variant="muted">{m.type}</Badge> <span className="text-ink-muted">{m.reason}</span></td>
                  <td className="px-4 py-2.5 text-right font-medium text-danger-600">{m.quantityChange}</td>
                  <td className="px-4 py-2.5 text-ink-muted">{m.createdBy?.name ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={open} title="Record waste" onClose={() => setOpen(false)}
        footer={<div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" size="md" onClick={() => setOpen(false)} disabled={recordM.isPending}>Cancel</Button>
          <Button type="submit" form="waste-form" variant="primary" size="md" disabled={recordM.isPending}>{recordM.isPending ? 'Saving…' : 'Record'}</Button>
        </div>}>
        <form id="waste-form" onSubmit={submit} className="space-y-4">
          <div>
            <FieldLabel htmlFor="w-item" required>Item</FieldLabel>
            <select id="w-item" className={selectClass} value={form.productId} onChange={(e) => { setForm((p) => ({ ...p, productId: e.target.value })); setErr((p) => ({ ...p, product: undefined })); }}>
              <option value="">Select an item…</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.quantity} {p.unitType})</option>)}
            </select>
            <FieldError message={err.product} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel htmlFor="w-qty" required>Quantity</FieldLabel>
              <TextInput id="w-qty" type="number" value={form.quantity} error={err.qty} onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))} />
              <FieldError message={err.qty} />
            </div>
            <div>
              <FieldLabel htmlFor="w-type">Type</FieldLabel>
              <select id="w-type" className={selectClass} value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as 'DAMAGE' | 'EXPIRED' }))}>
                {REASONS.map((r) => <option key={r} value={r}>{r.charAt(0) + r.slice(1).toLowerCase()}</option>)}
              </select>
            </div>
          </div>
          <div>
            <FieldLabel htmlFor="w-reason" required>Reason</FieldLabel>
            <TextInput id="w-reason" value={form.reason} error={err.reason} onChange={(e) => { setForm((p) => ({ ...p, reason: e.target.value })); setErr((p) => ({ ...p, reason: undefined })); }} placeholder="e.g. dropped tray, past best-before" />
            <FieldError message={err.reason} />
          </div>
        </form>
      </Modal>
    </div>
  );
}
