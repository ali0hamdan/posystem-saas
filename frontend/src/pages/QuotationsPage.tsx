import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Eye, Printer } from 'lucide-react';
import { getApiErrorMessage } from '@/api/client';
import {
  acceptQuotation,
  cancelQuotation,
  convertQuotationToInvoice,
  convertQuotationToProforma,
  listQuotations,
  rejectQuotation,
  type Quotation,
  type QuotationStatus,
} from '@/api/quotations.api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { CreateB2bDocumentModal } from '@/features/wholesale/CreateB2bDocumentModal';
import { B2bDocDetailModal } from '@/features/wholesale/B2bDocDetailModal';
import { b2bPrintPath } from '@/features/wholesale/print/print-paths';

const STATUS_FILTERS: { label: string; value: QuotationStatus | '' }[] = [
  { label: 'All', value: '' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Sent', value: 'SENT' },
  { label: 'Accepted', value: 'ACCEPTED' },
  { label: 'Rejected', value: 'REJECTED' },
  { label: 'Converted', value: 'CONVERTED_TO_INVOICE' },
  { label: 'Cancelled', value: 'CANCELLED' },
];

function statusVariant(s: QuotationStatus): 'default' | 'success' | 'warning' | 'danger' | 'primary' {
  if (s === 'ACCEPTED' || s === 'CONVERTED_TO_INVOICE' || s === 'CONVERTED_TO_PROFORMA') return 'success';
  if (s === 'REJECTED' || s === 'CANCELLED') return 'danger';
  if (s === 'EXPIRED') return 'warning';
  if (s === 'SENT') return 'primary';
  return 'default';
}

export function QuotationsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<QuotationStatus | ''>('');
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const wholesale = location.pathname.includes('/wholesale/');

  const { data, isLoading } = useQuery({
    queryKey: ['quotations', status, q],
    queryFn: () => listQuotations({ status: status || undefined, q: q || undefined, limit: 50 }),
  });

  const accept = useMutation({
    mutationFn: acceptQuotation,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['quotations'] }),
    onError: (e) => setError(getApiErrorMessage(e)),
  });
  const reject = useMutation({
    mutationFn: rejectQuotation,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['quotations'] }),
    onError: (e) => setError(getApiErrorMessage(e)),
  });
  const toProforma = useMutation({
    mutationFn: convertQuotationToProforma,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['quotations'] }),
    onError: (e) => setError(getApiErrorMessage(e)),
  });
  const toInvoice = useMutation({
    mutationFn: (id: string) => convertQuotationToInvoice(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['quotations'] }),
    onError: (e) => setError(getApiErrorMessage(e)),
  });
  const cancel = useMutation({
    mutationFn: cancelQuotation,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['quotations'] }),
    onError: (e) => setError(getApiErrorMessage(e)),
  });

  const items: Quotation[] = data?.data ?? [];

  return (
    <div className="space-y-4 p-4">
      <PageHeader
        title="Quotations"
        description="Quotation is an offer, not a sale. It does not deduct stock and is not counted as revenue."
        actions={<Button onClick={() => setCreateOpen(true)}>New quotation</Button>}
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
              <th className="w-32 px-4 py-3 text-right">Total</th>
              <th className="w-40 px-4 py-3">Valid until</th>
              <th className="w-72 px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-ink-muted">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-ink-muted">
                  No quotations yet.
                </td>
              </tr>
            )}
            {items.map((row) => (
              <tr key={row.id} className="hover:bg-canvas/60">
                <td className="px-4 py-3 font-mono text-xs">{row.quotationNumber}</td>
                <td className="px-4 py-3">{row.customerId ?? <span className="text-ink-muted">—</span>}</td>
                <td className="px-4 py-3">
                  <Badge variant={statusVariant(row.status)}>{row.status.replace(/_/g, ' ')}</Badge>
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
                    <Button size="sm" variant="ghost" onClick={() => navigate(b2bPrintPath('quotation', row.id, wholesale))}>
                      <Printer className="h-3.5 w-3.5" />
                    </Button>
                    {row.status === 'DRAFT' || row.status === 'SENT' ? (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => accept.mutate(row.id)}>Accept</Button>
                        <Button size="sm" variant="ghost" onClick={() => reject.mutate(row.id)}>Reject</Button>
                      </>
                    ) : null}
                    {row.status === 'ACCEPTED' && (
                      <>
                        <Button size="sm" onClick={() => toProforma.mutate(row.id)}>To proforma</Button>
                        <Button size="sm" variant="ghost" onClick={() => toInvoice.mutate(row.id)}>
                          To invoice
                        </Button>
                      </>
                    )}
                    {row.status !== 'CANCELLED' && row.status !== 'CONVERTED_TO_INVOICE' && row.status !== 'CONVERTED_TO_PROFORMA' && (
                      <Button size="sm" variant="ghost" onClick={() => cancel.mutate(row.id)}>
                        Cancel
                      </Button>
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
        type="quotation"
        onClose={() => setCreateOpen(false)}
        onCreated={() => void qc.invalidateQueries({ queryKey: ['quotations'] })}
      />
      <B2bDocDetailModal
        kind="quotation"
        docId={detailId}
        open={Boolean(detailId)}
        onClose={() => setDetailId(null)}
        wholesale={wholesale}
      />
    </div>
  );
}
