import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  fetchCoupons, createCoupon, updateCoupon, deleteCoupon,
  type Coupon, type CreateCouponBody,
} from '@/api/coupons.api';
import { getApiErrorMessage } from '@/api/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';

type FormState = CreateCouponBody & { _open: boolean };

const empty: FormState = {
  _open: false,
  code: '',
  type: 'PERCENTAGE',
  value: 10,
  minOrderAmount: undefined,
  maxUses: undefined,
  expiresAt: '',
  isActive: true,
};

const inputClass =
  'w-full rounded-lg border border-line bg-canvas px-3 py-2.5 text-sm text-ink outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-500/25';

const labelClass = 'mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-muted';

export default function CouponsPage() {
  const qc = useQueryClient();
  const [showInactive, setShowInactive] = useState(false);
  const [form, setForm] = useState<FormState>(empty);
  const [error, setError] = useState('');

  const { data: coupons = [], isLoading } = useQuery({
    queryKey: ['coupons', showInactive],
    queryFn: () => fetchCoupons(showInactive),
  });

  const createMut = useMutation({
    mutationFn: createCoupon,
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['coupons'] }); setForm(empty); setError(''); },
    onError: (e) => setError(getApiErrorMessage(e)),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      updateCoupon(id, { isActive }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['coupons'] }),
  });

  const deleteMut = useMutation({
    mutationFn: deleteCoupon,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['coupons'] }),
    onError: (e) => alert(getApiErrorMessage(e)),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const body: CreateCouponBody = {
      code: form.code.trim().toUpperCase(),
      type: form.type,
      value: Number(form.value),
      isActive: form.isActive,
    };
    if (form.minOrderAmount) body.minOrderAmount = Number(form.minOrderAmount);
    if (form.maxUses) body.maxUses = Number(form.maxUses);
    if (form.expiresAt) body.expiresAt = new Date(form.expiresAt).toISOString();
    createMut.mutate(body);
  };

  const statusBadge = (c: Coupon) => {
    if (!c.isActive) return <Badge variant="muted">Inactive</Badge>;
    if (c.expiresAt && new Date(c.expiresAt) < new Date())
      return <Badge variant="danger">Expired</Badge>;
    if (c.maxUses != null && c.usedCount >= c.maxUses)
      return <Badge variant="warning">Exhausted</Badge>;
    return <Badge variant="success">Active</Badge>;
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-10">
      <PageHeader
        title="Coupons & Discounts"
        description="Create and manage discount codes for your store."
        actions={
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-muted">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded border-line text-primary-500"
            />
            Show inactive
          </label>
        }
      />

      {/* Create form */}
      <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
        <button
          type="button"
          onClick={() => setForm((f) => ({ ...f, _open: !f._open }))}
          className="text-sm font-semibold text-primary-600 hover:underline"
        >
          {form._open ? '− Hide' : '+ New Coupon'}
        </button>

        {form._open && (
          <form onSubmit={handleSubmit} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {error && <p className="col-span-full text-sm text-danger-600">{error}</p>}

            <div>
              <label className={labelClass}>Code *</label>
              <input
                className={`${inputClass} font-mono uppercase`}
                placeholder="SUMMER20"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                required
              />
            </div>

            <div>
              <label className={labelClass}>Type *</label>
              <select
                className={inputClass}
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as 'PERCENTAGE' | 'FIXED' }))}
              >
                <option value="PERCENTAGE">Percentage (%)</option>
                <option value="FIXED">Fixed Amount</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>
                Value * {form.type === 'PERCENTAGE' ? '(%)' : '(amount)'}
              </label>
              <input
                type="number"
                min={0}
                max={form.type === 'PERCENTAGE' ? 100 : undefined}
                step="0.01"
                className={inputClass}
                value={form.value}
                onChange={(e) => setForm((f) => ({ ...f, value: Number(e.target.value) }))}
                required
              />
            </div>

            <div>
              <label className={labelClass}>Min Order Amount</label>
              <input
                type="number"
                min={0}
                step="0.01"
                className={inputClass}
                placeholder="Optional"
                value={form.minOrderAmount ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, minOrderAmount: e.target.value ? Number(e.target.value) : undefined }))}
              />
            </div>

            <div>
              <label className={labelClass}>Max Uses</label>
              <input
                type="number"
                min={1}
                className={inputClass}
                placeholder="Unlimited"
                value={form.maxUses ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, maxUses: e.target.value ? Number(e.target.value) : undefined }))}
              />
            </div>

            <div>
              <label className={labelClass}>Expires At</label>
              <input
                type="date"
                className={inputClass}
                value={form.expiresAt ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
              />
            </div>

            <div className="col-span-full flex gap-3">
              <Button type="submit" variant="primary" disabled={createMut.isPending}>
                {createMut.isPending ? 'Creating…' : 'Create Coupon'}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setForm(empty)}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>

      {/* Coupons table */}
      <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
        {isLoading ? (
          <p className="p-6 text-sm text-ink-muted">Loading…</p>
        ) : coupons.length === 0 ? (
          <p className="p-6 text-sm text-ink-muted">No coupons found. Create one above.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-line bg-canvas text-xs font-semibold uppercase tracking-wide text-ink-faint">
                <tr>
                  <th className="px-4 py-3 text-left">Code</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Value</th>
                  <th className="px-4 py-3 text-left">Uses</th>
                  <th className="px-4 py-3 text-left">Expires</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {coupons.map((c) => (
                  <tr key={c.id} className="transition-colors hover:bg-canvas">
                    <td className="px-4 py-3 font-mono font-semibold text-ink">{c.code}</td>
                    <td className="px-4 py-3 text-ink-muted">{c.type === 'PERCENTAGE' ? '%' : 'Fixed'}</td>
                    <td className="px-4 py-3 tabular-nums text-ink">
                      {c.type === 'PERCENTAGE' ? `${c.value}%` : c.value}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-ink-muted">
                      {c.usedCount}{c.maxUses != null ? ` / ${c.maxUses}` : ''}
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {c.expiresAt ? format(new Date(c.expiresAt), 'dd MMM yyyy') : '—'}
                    </td>
                    <td className="px-4 py-3">{statusBadge(c)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => toggleMut.mutate({ id: c.id, isActive: !c.isActive })}
                          disabled={toggleMut.isPending}
                        >
                          {c.isActive ? 'Disable' : 'Enable'}
                        </Button>
                        <Button
                          type="button"
                          variant="danger"
                          size="sm"
                          onClick={() => {
                            if (confirm(`Delete coupon ${c.code}?`)) deleteMut.mutate(c.id);
                          }}
                          disabled={deleteMut.isPending}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
