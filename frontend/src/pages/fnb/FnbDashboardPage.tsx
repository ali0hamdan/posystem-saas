import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ShoppingBag, Receipt, ChefHat, LayoutGrid, ArrowRight, UtensilsCrossed } from 'lucide-react';
import { fetchFnbDashboard } from '@/api/fnb-reports.api';
import { getApiErrorMessage } from '@/api/client';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorBanner } from '@/components/ui/error-banner';

const money = (v: number | string) => { const n = typeof v === 'string' ? Number(v) : v; return Number.isFinite(n) ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'; };

function Stat({ icon: Icon, label, value, sub }: { icon: typeof Receipt; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <div className="flex items-center gap-2 text-ink-muted"><Icon className="h-4 w-4 text-primary-500" /><span className="text-sm">{label}</span></div>
      <div className="mt-2 text-2xl font-semibold text-ink">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-ink-faint">{sub}</div>}
    </div>
  );
}

export function FnbDashboardPage() {
  const q = useQuery({ queryKey: ['fnb', 'dashboard'], queryFn: fetchFnbDashboard, refetchInterval: 15000 });
  const d = q.data;

  return (
    <div>
      <PageHeader title="F&B Dashboard" description="Today at a glance across your floor and kitchen." />

      {q.isError && <ErrorBanner message={getApiErrorMessage(q.error, 'Failed to load dashboard')} className="mb-6" />}

      {q.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
      ) : d ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Stat icon={Receipt} label="Today's revenue" value={money(d.todayRevenue)} sub={`${d.todayOrders} completed orders`} />
            <Stat icon={ShoppingBag} label="Open orders" value={String(d.openOrders)} sub="In progress now" />
            <Stat icon={ChefHat} label="Active kitchen tickets" value={String(d.activeTickets)} sub="Queued / preparing / ready" />
            <Stat icon={LayoutGrid} label="Tables occupied" value={`${d.tablesOccupied} / ${d.tablesTotal}`} sub={d.tablesTotal ? `${Math.round((d.tablesOccupied / d.tablesTotal) * 100)}% in use` : 'No tables yet'} />
            <Stat icon={UtensilsCrossed} label="Today's orders" value={String(d.todayOrders)} sub="Settled today" />
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              { to: '/fnb/pos', label: 'Open the POS', icon: UtensilsCrossed },
              { to: '/fnb/kitchen', label: 'Kitchen display', icon: ChefHat },
              { to: '/fnb/reports', label: 'View reports', icon: Receipt },
            ].map((l) => (
              <Link key={l.to} to={l.to} className="group flex items-center justify-between rounded-xl border border-line bg-surface p-4 transition hover:border-primary-300">
                <span className="flex items-center gap-2 text-sm font-medium text-ink"><l.icon className="h-4 w-4 text-primary-500" /> {l.label}</span>
                <ArrowRight className="h-4 w-4 text-ink-muted transition group-hover:translate-x-0.5" />
              </Link>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
