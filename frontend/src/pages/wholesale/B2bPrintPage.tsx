import { useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Printer } from 'lucide-react';
import { getApiErrorMessage } from '@/api/client';
import {
  fetchInvoicePrintData,
  fetchProformaPrintData,
  fetchQuotationPrintData,
} from '@/api/wholesale/b2b-print.api';
import { B2bDocumentPrintView } from '@/features/wholesale/print/B2bDocumentPrintView';
import { Button } from '@/components/ui/button';

type PrintKind = 'quotation' | 'proforma' | 'invoice';

function printKindFromPath(pathname: string): PrintKind {
  if (pathname.includes('/proforma-invoices/')) return 'proforma';
  if (pathname.includes('/invoices/') || pathname.includes('/sales/')) return 'invoice';
  return 'quotation';
}

function fetchPrintData(kind: PrintKind, id: string) {
  if (kind === 'proforma') return fetchProformaPrintData(id);
  if (kind === 'invoice') return fetchInvoicePrintData(id);
  return fetchQuotationPrintData(id);
}

function backPath(kind: PrintKind, wholesale: boolean): string {
  const base = wholesale ? '/wholesale' : '';
  if (kind === 'quotation') return `${base}/quotations`;
  if (kind === 'proforma') return `${base}/proforma-invoices`;
  return wholesale ? `${base}/invoices` : '/sales';
}

export function B2bPrintPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const kind = printKindFromPath(location.pathname);
  const wholesale = location.pathname.includes('/wholesale/');

  const query = useQuery({
    queryKey: ['b2b-print', kind, id],
    queryFn: () => fetchPrintData(kind, id!),
    enabled: Boolean(id),
    retry: false,
  });

  useEffect(() => {
    return () => {
      document.documentElement.classList.remove('b2b-document-print-mode');
    };
  }, []);

  function handlePrint() {
    document.documentElement.classList.add('b2b-document-print-mode');
    window.print();
    window.setTimeout(() => {
      document.documentElement.classList.remove('b2b-document-print-mode');
    }, 500);
  }

  if (!id) {
    return <p className="p-6 text-sm text-ink-muted">Missing document id.</p>;
  }

  return (
    <div className="b2b-print-page">
      <div className="b2b-print-toolbar no-print">
        <Button variant="secondary" onClick={() => navigate(backPath(kind, wholesale))}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button variant="primary" onClick={handlePrint} disabled={!query.data}>
          <Printer className="mr-2 h-4 w-4" />
          Print
        </Button>
      </div>

      {query.isLoading ? (
        <p className="p-8 text-center text-sm text-ink-muted no-print">Loading document…</p>
      ) : null}

      {query.isError ? (
        <div className="mx-auto max-w-lg rounded-lg border border-danger-300 bg-danger-50 p-4 text-sm text-danger-700 no-print">
          {getApiErrorMessage(query.error, 'Document not found or access denied.')}
        </div>
      ) : null}

      {query.data ? <B2bDocumentPrintView data={query.data} /> : null}
    </div>
  );
}
