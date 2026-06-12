import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Printer } from 'lucide-react';
import { getApiErrorMessage } from '@/api/client';
import { fetchRefundPrintData } from '@/api/refunds.api';
import { PrintableRefundLayout } from '@/features/refunds/PrintableRefundLayout';
import { Button } from '@/components/ui/button';

export function RefundPrintPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const query = useQuery({
    queryKey: ['refund-print', id],
    queryFn: () => fetchRefundPrintData(id!),
    enabled: Boolean(id),
    retry: false,
  });

  useEffect(() => {
    return () => {
      document.documentElement.classList.remove('refund-print-mode');
    };
  }, []);

  function handlePrint() {
    document.documentElement.classList.add('refund-print-mode');
    window.print();
    window.setTimeout(() => {
      document.documentElement.classList.remove('refund-print-mode');
    }, 500);
  }

  if (!id) {
    return <p className="p-6 text-sm text-ink-muted">Missing refund id.</p>;
  }

  return (
    <div className="refund-print-page">
      <div className="refund-print-toolbar no-print mb-4 flex gap-2">
        <Button variant="secondary" onClick={() => navigate('/refunds')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button variant="primary" onClick={handlePrint} disabled={!query.data}>
          <Printer className="mr-2 h-4 w-4" />
          Print
        </Button>
      </div>

      {query.isLoading ? (
        <p className="p-8 text-center text-sm text-ink-muted no-print">Loading refund receipt…</p>
      ) : null}

      {query.isError ? (
        <div className="mx-auto max-w-lg rounded-lg border border-danger-300 bg-danger-50 p-4 text-sm text-danger-700 no-print">
          {getApiErrorMessage(query.error, 'Refund not found or access denied.')}
        </div>
      ) : null}

      {query.data ? <PrintableRefundLayout data={query.data} /> : null}
    </div>
  );
}
