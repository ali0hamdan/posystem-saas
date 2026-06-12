import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Receipt, TrendingUp, CalendarRange } from 'lucide-react';
import { fetchFnbReport } from '@/api/fnb-reports.api';
import { getApiErrorMessage } from '@/api/client';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorBanner } from '@/components/ui/error-banner';
import { EmptyState } from '@/components/ui/empty-state';

const money = (v: number) => Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dStr = (d: Date) => d.toISOString().slice(0, 10);
const TYPE_LABEL: Record<string, string> = { DINE_IN: 'Dine-in', TAKEAWAY: 'Takeaway', DELIVERY: 'Delivery' };
const dateInput = 'rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-primary-500 focus:outline-none';

export function FnbReportsPage() {
  const [from, setFrom] = useState(dStr(new Date(Date.now() - 6 * 86400000)));
  const [to, setTo] = useState(dStr(new Date()));

  const q = useQuery({ queryKey: ['fnb', 'report', from, to], queryFn: () => fetchFnbReport({ from, to }) });
  const r = q.data;
  const maxItem = r ? Math.max(1, ...r.topItems.map((i) => i.quantity)) : 1;

  return (
    <div>
      <PageHeader title="F&B Reports" description="Sales performance for your food & beverage service." />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <CalendarRange className="h-4 w-4 text-ink-faint" />
        <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className={dateInput} />
        <span className="text-ink-faint">→</span>
        <input type="date" value={to} min={from} max={dStr(new Date())} onChange={(e) => setTo(e.target.value)} className={dateInput} />
      </div>

      {q.isError && <ErrorBanner message={getApiErrorMessage(q.error, 'Failed to load report')} className="mb-6" />}

      {q.isPending ? (
        <div className="grid gap-4 sm:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      ) : r ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-line bg-surface p-5">
              <div className="flex items-center gap-2 text-sm text-ink-muted"><Receipt className="h-4 w-4 text-primary-500" /> Revenue</div>
              <div className="mt-2 text-2xl font-semibold text-ink">{money(r.totals.revenue)}</div>
              <div className="mt-0.5 text-xs text-ink-faint">incl. {money(r.totals.tax)} tax</div>
            </div>
            <div className="rounded-xl border border-line bg-surface p-5">
              <div className="flex items-center gap-2 text-sm text-ink-muted"><TrendingUp className="h-4 w-4 text-primary-500" /> Orders</div>
              <div className="mt-2 text-2xl font-semibold text-ink">{r.totals.orders}</div>
              <div className="mt-0.5 text-xs text-ink-faint">completed</div>
            </div>
            <div className="rounded-xl border border-line bg-surface p-5">
              <div className="flex items-center gap-2 text-sm text-ink-muted"><Receipt className="h-4 w-4 text-primary-500" /> Avg. order</div>
              <div className="mt-2 text-2xl font-semibold text-ink">{money(r.totals.avgOrder)}</div>
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-line bg-surface p-5">
              <h2 className="mb-3 text-sm font-semibold text-ink">By order type</h2>
              {r.byType.length === 0 ? <p className="text-sm text-ink-faint">No sales in this range.</p> : (
                <div className="space-y-2">
                  {r.byType.map((t) => (
                    <div key={t.type} className="flex items-center justify-between text-sm">
                      <span className="text-ink-muted">{TYPE_LABEL[t.type] ?? t.type}</span>
                      <span className="text-ink">{t.orders} · <span className="font-medium">{money(t.revenue)}</span></span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-line bg-surface p-5">
              <h2 className="mb-3 text-sm font-semibold text-ink">Top items</h2>
              {r.topItems.length === 0 ? <p className="text-sm text-ink-faint">No items sold in this range.</p> : (
                <div className="space-y-2.5">
                  {r.topItems.map((i) => (
                    <div key={i.name}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="truncate text-ink">{i.name}</span>
                        <span className="ml-2 shrink-0 text-ink-muted">{i.quantity} · {money(i.revenue)}</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-canvas-raised">
                        <div className="h-full rounded-full bg-primary-500" style={{ width: `${(i.quantity / maxItem) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {r.totals.orders === 0 && (
            <div className="mt-6"><EmptyState title="No completed orders in this range" description="Settle some orders in the F&B POS to see them here." /></div>
          )}
        </>
      ) : null}
    </div>
  );
}
