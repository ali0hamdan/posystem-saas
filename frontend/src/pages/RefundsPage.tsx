import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Printer } from 'lucide-react';
import { fetchRefunds } from '@/api/refunds.api';
import { ErrorBanner } from '@/components/ui/error-banner';
import { getApiErrorMessage } from '@/api/client';
import { usePermissions } from '@/hooks/use-permissions';

export function RefundsPage() {
  const { can } = usePermissions();
  const canPrint = can('refunds:print');

  const query = useQuery({
    queryKey: ['refunds'],
    queryFn: () => fetchRefunds({ limit: 50 }),
  });

  const rows = query.data?.data ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink md:text-3xl">
          Refund history
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          All completed refunds across retail sales, F&B orders, and wholesale invoices.
        </p>
      </div>

      {query.isError ? (
        <ErrorBanner message={getApiErrorMessage(query.error, 'Could not load refunds.')} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-card">
          <table className="w-full min-w-[780px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wide text-ink-muted">
                <th className="px-4 py-3">Refund #</th>
                <th className="px-3 py-3">Source</th>
                <th className="px-3 py-3">Type</th>
                <th className="px-3 py-3">Amount</th>
                <th className="px-3 py-3">Reason</th>
                <th className="px-3 py-3">Created by</th>
                <th className="px-3 py-3">Approved by</th>
                <th className="px-3 py-3">Date</th>
                {canPrint ? <th className="px-3 py-3">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={canPrint ? 9 : 8} className="px-4 py-8 text-center text-ink-muted">
                    No refunds yet.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-b border-line/60 last:border-b-0">
                    <td className="px-4 py-3 font-mono text-xs">{r.refundNumber}</td>
                    <td className="px-3 py-3">
                      {r.sale?.invoiceNumber ?? r.fnbOrder?.orderNumber ?? r.sourceId.slice(0, 8)}
                      <span className="ml-1 text-xs text-ink-muted">({r.sourceType.replace('_', ' ')})</span>
                    </td>
                    <td className="px-3 py-3">{r.refundType}</td>
                    <td className="px-3 py-3 font-medium">{String(r.totalRefunded)}</td>
                    <td className="px-3 py-3 max-w-[200px] truncate">{r.reason}</td>
                    <td className="px-3 py-3">{r.user.name}</td>
                    <td className="px-3 py-3">
                      {r.approvedBy ? (
                        <div>
                          <p>{r.approvedBy.name}</p>
                          {r.approvedByApprovalIdCodeSnapshot ? (
                            <p className="font-mono text-xs text-ink-muted">
                              {r.approvedByApprovalIdCodeSnapshot}
                            </p>
                          ) : null}
                          {r.approvedByNfcUidMaskedSnapshot ? (
                            <p className="text-xs text-ink-muted">{r.approvedByNfcUidMaskedSnapshot}</p>
                          ) : null}
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-ink-muted">
                      {new Date(r.createdAt).toLocaleString()}
                    </td>
                    {canPrint ? (
                      <td className="px-3 py-3">
                        <Link
                          to={`/refunds/${r.id}/print`}
                          className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-500 dark:text-primary-400"
                        >
                          <Printer className="h-4 w-4" />
                          Print
                        </Link>
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
