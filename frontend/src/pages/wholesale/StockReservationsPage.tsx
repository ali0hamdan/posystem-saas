import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { listStockReservations, releaseStockReservation } from '@/api/wholesale/stock-reservations.api';
import { getApiErrorMessage } from '@/api/client';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';

export function StockReservationsPage() {
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['wholesale', 'stock-reservations'],
    queryFn: () => listStockReservations({ limit: 100 }),
  });

  const release = useMutation({
    mutationFn: releaseStockReservation,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['wholesale', 'stock-reservations'] }),
    onError: (e) => setError(getApiErrorMessage(e)),
  });

  const rows = data?.data ?? [];

  return (
    <div className="space-y-4 p-4">
      <PageHeader
        title="Stock reservations"
        description="Reserved stock reduces available quantity but does not deduct physical inventory."
      />
      {error && <div className="rounded-lg border border-danger-300 bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</div>}
      {isLoading ? <p className="text-sm text-ink-muted">Loading…</p> : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="min-w-full text-sm">
            <thead className="bg-canvas-raised text-left text-ink-muted">
              <tr>
                <th className="px-3 py-2">Product</th>
                <th className="px-3 py-2">Qty</th>
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Expires</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-line">
                  <td className="px-3 py-2 font-mono text-xs">{r.productId.slice(0, 8)}…</td>
                  <td className="px-3 py-2">{r.quantity}</td>
                  <td className="px-3 py-2">{r.sourceType} · {r.sourceId.slice(0, 8)}…</td>
                  <td className="px-3 py-2"><Badge>{r.status}</Badge></td>
                  <td className="px-3 py-2">{r.expiresAt ? format(new Date(r.expiresAt), 'PP') : '—'}</td>
                  <td className="px-3 py-2">
                    {r.status === 'ACTIVE' && (
                      <Button size="sm" variant="secondary" disabled={release.isPending} onClick={() => release.mutate(r.id)}>
                        Release
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <p className="p-4 text-sm text-ink-muted">No reservations found.</p>}
        </div>
      )}
    </div>
  );
}
