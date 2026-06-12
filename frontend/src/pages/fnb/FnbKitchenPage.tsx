import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChefHat, Clock, ArrowRight, Check } from 'lucide-react';
import { fetchKitchen, setKitchenStatus, type KitchenTicket, type KitchenStatus } from '@/api/fnb-orders.api';
import { getApiErrorMessage } from '@/api/client';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorBanner } from '@/components/ui/error-banner';

const COLUMNS: { key: KitchenStatus; label: string }[] = [
  { key: 'QUEUED', label: 'Queued' },
  { key: 'PREPARING', label: 'Preparing' },
  { key: 'READY', label: 'Ready' },
];
const NEXT: Partial<Record<KitchenStatus, { to: KitchenStatus; label: string; icon: typeof ArrowRight }>> = {
  QUEUED: { to: 'PREPARING', label: 'Start', icon: ArrowRight },
  PREPARING: { to: 'READY', label: 'Ready', icon: ArrowRight },
  READY: { to: 'BUMPED', label: 'Bump', icon: Check },
};

function minsAgo(iso: string) {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return m === 0 ? 'just now' : `${m}m`;
}

export function FnbKitchenPage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['fnb', 'kitchen'],
    queryFn: () => fetchKitchen('ACTIVE'),
    refetchInterval: 5000,
  });
  const m = useMutation({
    mutationFn: ({ id, status }: { id: string; status: KitchenStatus }) => setKitchenStatus(id, status),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['fnb', 'kitchen'] }),
    onError: (e) => toast.error(getApiErrorMessage(e, 'Failed to update ticket')),
  });

  const tickets = q.data ?? [];
  const byStatus = (s: KitchenStatus) => tickets.filter((t) => t.status === s);

  return (
    <div>
      <PageHeader title="Kitchen display" description="Live tickets sent from the F&B POS. Updates every few seconds." />

      {q.isError && <ErrorBanner message={getApiErrorMessage(q.error, 'Failed to load kitchen tickets')} className="mb-6" />}

      {q.isPending ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      ) : tickets.length === 0 ? (
        <EmptyState title="No active tickets" description="Tickets appear here when orders are sent from the F&B POS." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {COLUMNS.map((col) => {
            const items = byStatus(col.key);
            return (
              <div key={col.key} className="rounded-xl border border-line bg-canvas-raised/40 p-3">
                <div className="mb-3 flex items-center justify-between px-1">
                  <h2 className="text-sm font-semibold text-ink">{col.label}</h2>
                  <span className="rounded-full bg-surface px-2 py-0.5 text-xs text-ink-muted">{items.length}</span>
                </div>
                <div className="space-y-3">
                  {items.map((t: KitchenTicket) => {
                    const next = NEXT[t.status];
                    return (
                      <div key={t.id} className="rounded-xl border border-line bg-surface p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <ChefHat className="h-4 w-4 text-primary-500" />
                            <span className="text-sm font-semibold text-ink">
                              {t.order?.table?.label ?? t.order?.orderNumber ?? t.ticketNumber}
                            </span>
                          </div>
                          <span className="flex items-center gap-1 text-xs text-ink-faint"><Clock className="h-3 w-3" /> {minsAgo(t.createdAt)}</span>
                        </div>
                        <ul className="mt-2 space-y-1">
                          {t.items.map((it) => (
                            <li key={it.id} className="flex items-center justify-between text-sm text-ink-muted">
                              <span className="truncate">{it.name}</span>
                              <span className="ml-2 shrink-0 font-medium text-ink">×{it.quantity}</span>
                            </li>
                          ))}
                        </ul>
                        {next && (
                          <button
                            onClick={() => m.mutate({ id: t.id, status: next.to })}
                            disabled={m.isPending}
                            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary-600 py-2 text-xs font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-60"
                          >
                            <next.icon className="h-3.5 w-3.5" /> {next.label}
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {items.length === 0 && <p className="px-1 py-4 text-center text-xs text-ink-faint">Empty</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
