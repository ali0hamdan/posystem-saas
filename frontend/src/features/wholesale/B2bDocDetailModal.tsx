import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { format } from 'date-fns';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getApiErrorMessage } from '@/api/client';
import { getQuotation } from '@/api/quotations.api';
import { getProformaInvoice } from '@/api/proforma-invoices.api';
import { b2bPrintPath, type B2bPrintDocKind } from '@/features/wholesale/print/print-paths';

type Props = {
  kind: B2bPrintDocKind;
  docId: string | null;
  open: boolean;
  onClose: () => void;
  wholesale?: boolean;
};

export function B2bDocDetailModal({ kind, docId, open, onClose, wholesale = true }: Props) {
  const navigate = useNavigate();

  const quotationQ = useQuery({
    queryKey: ['quotation', docId],
    queryFn: () => getQuotation(docId!),
    enabled: open && kind === 'quotation' && Boolean(docId),
  });

  const proformaQ = useQuery({
    queryKey: ['proforma', docId],
    queryFn: () => getProformaInvoice(docId!),
    enabled: open && kind === 'proforma' && Boolean(docId),
  });

  const loading = kind === 'quotation' ? quotationQ.isLoading : proformaQ.isLoading;
  const error = kind === 'quotation' ? quotationQ.error : proformaQ.error;
  const q = quotationQ.data;
  const p = proformaQ.data;

  const title = kind === 'quotation' ? 'Quotation details' : 'Proforma details';
  const number = kind === 'quotation' ? q?.quotationNumber : p?.proformaNumber;
  const status = kind === 'quotation' ? q?.status : p?.status;
  const total = kind === 'quotation' ? q?.total : p?.total;
  const validUntil = kind === 'quotation' ? q?.validUntil : p?.validUntil;
  const itemCount = kind === 'quotation' ? q?.items?.length : p?.items?.length;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={number ? `Document ${number}` : undefined}
      footer={
        docId ? (
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>Close</Button>
            <Button
              variant="primary"
              onClick={() => {
                onClose();
                navigate(b2bPrintPath(kind, docId, wholesale));
              }}
            >
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
          </div>
        ) : undefined
      }
    >
      {loading ? <p className="py-8 text-center text-sm text-ink-muted">Loading…</p> : null}
      {error ? (
        <p className="py-6 text-center text-sm text-danger-600">
          {getApiErrorMessage(error, 'Could not load document.')}
        </p>
      ) : null}
      {(q || p) && (
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase text-ink-muted">Status</dt>
            <dd className="mt-1"><Badge>{status?.replace(/_/g, ' ')}</Badge></dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-ink-muted">Total</dt>
            <dd className="mt-1 font-semibold">${total}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-ink-muted">Valid until</dt>
            <dd className="mt-1">{validUntil ? format(new Date(validUntil), 'PP') : '—'}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-ink-muted">Line items</dt>
            <dd className="mt-1">{itemCount ?? 0}</dd>
          </div>
        </dl>
      )}
    </Modal>
  );
}
