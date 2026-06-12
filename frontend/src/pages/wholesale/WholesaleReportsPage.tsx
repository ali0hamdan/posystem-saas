import { useQuery } from '@tanstack/react-query';
import { fetchB2bProformaReport, fetchB2bQuotationReport } from '@/api/wholesale/b2b-reports.api';
import { PageHeader } from '@/components/ui/page-header';

export function WholesaleReportsPage() {
  const qReport = useQuery({ queryKey: ['b2b', 'quotations-report'], queryFn: () => fetchB2bQuotationReport() });
  const pReport = useQuery({ queryKey: ['b2b', 'proforma-report'], queryFn: () => fetchB2bProformaReport() });

  const q = qReport.data as { total?: number; totalQuotedValue?: string; conversionRate?: number; note?: string } | undefined;
  const p = pReport.data as { total?: number; totalProformaValue?: string; outstandingValue?: string; note?: string } | undefined;

  return (
    <div className="space-y-4 p-4">
      <PageHeader
        title="Wholesale reports"
        description="B2B pipeline analytics. Quotation and proforma values are not revenue."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-xl border border-line bg-surface p-5">
          <h3 className="font-semibold text-ink">Quotations</h3>
          {qReport.isLoading ? <p className="mt-2 text-sm text-ink-muted">Loading…</p> : q ? (
            <dl className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between"><dt>Total documents</dt><dd>{q.total}</dd></div>
              <div className="flex justify-between"><dt>Quoted value</dt><dd>${q.totalQuotedValue}</dd></div>
              <div className="flex justify-between"><dt>Conversion rate</dt><dd>{((q.conversionRate ?? 0) * 100).toFixed(1)}%</dd></div>
            </dl>
          ) : null}
          {q?.note && <p className="mt-3 text-xs text-ink-muted">{q.note}</p>}
        </section>
        <section className="rounded-xl border border-line bg-surface p-5">
          <h3 className="font-semibold text-ink">Proforma invoices</h3>
          {pReport.isLoading ? <p className="mt-2 text-sm text-ink-muted">Loading…</p> : p ? (
            <dl className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between"><dt>Total documents</dt><dd>{p.total}</dd></div>
              <div className="flex justify-between"><dt>Proforma value</dt><dd>${p.totalProformaValue}</dd></div>
              <div className="flex justify-between"><dt>Outstanding</dt><dd>${p.outstandingValue}</dd></div>
            </dl>
          ) : null}
          {p?.note && <p className="mt-3 text-xs text-ink-muted">{p.note}</p>}
        </section>
      </div>
    </div>
  );
}
