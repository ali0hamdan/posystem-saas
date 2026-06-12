import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Eye, Printer } from 'lucide-react';
import { getApiErrorMessage } from '@/api/client';
import {
  approveProforma,
  cancelProforma,
  convertProformaToInvoice,
  listProformaInvoices,
  releaseProformaReservation,
  reserveProformaStock,
  type ProformaInvoice,
  type ProformaInvoiceStatus,
} from '@/api/proforma-invoices.api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { CreateB2bDocumentModal } from '@/features/wholesale/CreateB2bDocumentModal';
import { B2bDocDetailModal } from '@/features/wholesale/B2bDocDetailModal';
import { b2bPrintPath } from '@/features/wholesale/print/print-paths';

const STATUS_FILTERS: { label: string; value: ProformaInvoiceStatus | '' }[] = [
  { label: 'All', value: '' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Sent', value: 'SENT' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Converted', value: 'CONVERTED_TO_INVOICE' },
  { label: 'Cancelled', value: 'CANCELLED' },
];

function statusVariant(s: ProformaInvoiceStatus): 'default' | 'success' | 'warning' | 'danger' | 'primary' {
  if (s === 'APPROVED') return 'success';
  if (s === 'CONVERTED_TO_INVOICE') return 'success';
  if (s === 'CANCELLED') return 'danger';
  if (s === 'SENT') return 'primary';
  return 'default';
}

export function ProformaInvoicesPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<ProformaInvoiceStatus | ''>('');
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const wholesale = location.pathname.includes('/wholesale/');

  const { data, isLoading } = useQuery({
    queryKey: ['proforma-invoices', status, q],
    queryFn: () => listProformaInvoices({ status: status || undefined, q: q || undefined, limit: 50 }),
  });

  const approve = useMutation({
    mutationFn: approveProforma,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['proforma-invoices'] }),
    onError: (e) => setError(getApiErrorMessage(e)),
  });
  const cancel = useMutation({
    mutationFn: cancelProforma,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['proforma-invoices'] }),
    onError: (e) => setError(getApiErrorMessage(e)),
  });
  const reserve = useMutation({
    mutationFn: reserveProformaStock,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['proforma-invoices'] }),
    onError: (e) => setError(getApiErrorMessage(e)),
  });
  const release = useMutation({
    mutationFn: releaseProformaReservation,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['proforma-invoices'] }),
    onError: (e) => setError(getApiErrorMessage(e)),
  });
  const convert = useMutation({
    mutationFn: (id: string) => convertProformaToInvoice(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['proforma-invoices'] }),
    onError: (e) => setError(getApiErrorMessage(e)),
  });

  const items: ProformaInvoice[] = data?.data ?? [];

  return (
    <div className="space-y-4 p-4">
      <PageHeader
        title="Proforma invoices"
        description="A proforma is a preliminary invoice. It does not deduct stock or count as revenue unless converted to an official invoice."
        actions={<Button onClick={() => setCreateOpen(true)}>New proforma</Button>}
      />

      {error && (
        <div className="rounded-lg border border-danger-300 bg-danger-50 px-3 py-2 text-sm text-danger-700">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value || 'all'}
            onClick={() => setStatus(f.value)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              status === f.value
                ? 'border-primary-500 bg-primary-50 text-primary-700'
                : 'border-line bg-surface text-ink-muted hover:border-primary-300'
            }`}
          >
            {f.label}
          </button>
        ))}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search number / notes…"
          className="ml-auto w-64 rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-primary-400"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        <table className="w-full table-fixed text-sm">
          <thead className="bg-canvas text-left text-xs uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="w-40 px-4 py-3">Number</th>
              <th className="px-4 py-3">Customer</th>
              <th className="w-36 px-4 py-3">Status</th>
              <th className="w-28 px-4 py-3">Reserved</th>
              <th className="w-32 px-4 py-3 text-right">Total</th>
              <th className="w-40 px-4 py-3">Valid until</th>
              <th className="w-80 px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {isLoading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-ink-muted">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-ink-muted">
                  No proforma invoices yet.
                </td>
              </tr>
            )}
            {items.map((row) => (
              <tr key={row.id} className="hover:bg-canvas/60">
                <td className="px-4 py-3 font-mono text-xs">{row.proformaNumber}</td>
                <td className="px-4 py-3">{row.customerId ?? <span className="text-ink-muted">—</span>}</td>
                <td className="px-4 py-3">
                  <Badge variant={statusVariant(row.status)}>{row.status.replace(/_/g, ' ')}</Badge>
                </td>
                <td className="px-4 py-3">
                  {row.reserveStock ? <Badge variant="warning">Yes</Badge> : <span className="text-ink-muted">No</span>}
                </td>
                <td className="px-4 py-3 text-right font-semibold">{row.total}</td>
                <td className="px-4 py-3 text-xs text-ink-muted">
                  {row.validUntil ? format(new Date(row.validUntil), 'yyyy-MM-dd') : '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap justify-end gap-1.5">
                    <Button size="sm" variant="ghost" onClick={() => setDetailId(row.id)}>
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => navigate(b2bPrintPath('proforma', row.id, wholesale))}>
                      <Printer className="h-3.5 w-3.5" />
                    </Button>
                    {(row.status === 'DRAFT' || row.status === 'SENT') && (
                      <Button size="sm" variant="ghost" onClick={() => approve.mutate(row.id)}>
                        Approve
                      </Button>
                    )}
                    {row.status !== 'CANCELLED' && row.status !== 'CONVERTED_TO_INVOICE' && (
                      <>
                        {!row.reserveStock ? (
                          <Button size="sm" variant="ghost" onClick={() => reserve.mutate(row.id)}>
                            Reserve
                          </Button>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={() => release.mutate(row.id)}>
                            Release
                          </Button>
                        )}
                        <Button size="sm" onClick={() => convert.mutate(row.id)}>
                          To invoice
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => cancel.mutate(row.id)}>
                          Cancel
                        </Button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <CreateB2bDocumentModal
        open={createOpen}
        type="proforma"
        onClose={() => setCreateOpen(false)}
        onCreated={() => void qc.invalidateQueries({ queryKey: ['proforma-invoices'] })}
      />
      <B2bDocDetailModal
        kind="proforma"
        docId={detailId}
        open={Boolean(detailId)}
        onClose={() => setDetailId(null)}
        wholesale={wholesale}
      />
    </div>
  );
}
