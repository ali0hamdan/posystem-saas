import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bell, PackageSearch, Search, Wifi, WifiOff, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import { formatRoleLabel } from '@/lib/format-user';
import { useAuthStore } from '@/stores/auth-store';
import { useBranchStore } from '@/stores/branch-store';
import { fetchLowStock } from '@/api/reports.api';
import { useConnectivityStore } from '@/stores/connectivity-store';
import { usePublicSyncStatus } from '@/hooks/use-public-sync-status';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

const CLOCK_INTERVAL_MS = 30_000;

function formatNow(): string {
  return new Date().toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type TopbarProps = {
  /** When sidebar is collapsed on desktop, show expand control in topbar */
  onToggleSidebar?: () => void;
  sidebarCollapsed?: boolean;
};

export function Topbar({ onToggleSidebar, sidebarCollapsed }: TopbarProps) {
  const user = useAuthStore((s) => s.user);
  const branches = useBranchStore((s) => s.branches);
  const selectedBranchId = useBranchStore((s) => s.selectedBranchId);
  const selectBranch = useBranchStore((s) => s.selectBranch);
  const currentBranch = branches.find((b) => b.id === selectedBranchId);
  const navigatorOnline = useConnectivityStore((s) => s.navigatorOnline);
  const serverReachable = useConnectivityStore((s) => s.serverReachable);
  const syncStatus = usePublicSyncStatus();
  const [now, setNow] = useState(formatNow);

  const apiLikelyUp = navigatorOnline && serverReachable !== false;

  useEffect(() => {
    const id = window.setInterval(() => setNow(formatNow()), CLOCK_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  const lowStockQuery = useQuery({
    queryKey: ['reports', 'low-stock', 'topbar', 1, 1],
    queryFn: () => fetchLowStock({ page: 1, limit: 1 }),
    staleTime: 60_000,
    enabled: apiLikelyUp,
  });
  const lowStockTotal = lowStockQuery.data?.meta.total ?? 0;

  const syncUi = useMemo(() => {
    switch (syncStatus) {
      case 'offline':
        return {
          label: 'Offline',
          className: 'border-warning-200 bg-warning-50 text-warning-900 dark:border-warning-500/30 dark:bg-warning-500/20 dark:text-warning-100',
          Icon: WifiOff,
        };
      case 'syncing':
        return {
          label: 'Syncing',
          className: 'border-primary-200 bg-primary-50 text-primary-900 dark:border-primary-500/30 dark:bg-primary-500/20 dark:text-primary-100',
          Icon: RefreshCw,
        };
      case 'synced':
        return {
          label: 'Synced',
          className: 'border-success-200 bg-success-50 text-success-900 dark:border-success-500/30 dark:bg-success-500/20 dark:text-success-100',
          Icon: CheckCircle2,
        };
      case 'sync_failed':
        return {
          label: 'Sync failed',
          className: 'border-danger-200 bg-danger-50 text-danger-900 dark:border-danger-500/30 dark:bg-danger-500/20 dark:text-danger-100',
          Icon: AlertTriangle,
        };
      default:
        return {
          label: 'Online',
          className: 'border-line bg-canvas text-ink-muted',
          Icon: Wifi,
        };
    }
  }, [syncStatus]);

  const SyncIcon = syncUi.Icon;

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur sm:h-16 sm:px-6 lg:px-8">
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">
        {onToggleSidebar ? (
          <button
            type="button"
            onClick={onToggleSidebar}
            className="hidden rounded-lg border border-line p-2 text-ink-muted transition hover:bg-canvas hover:text-ink lg:inline-flex"
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={sidebarCollapsed ? 'Expand menu' : 'Collapse menu'}
          >
            <span className="sr-only">Toggle sidebar</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {sidebarCollapsed ? (
                <path d="M9 18l6-6-6-6" />
              ) : (
                <path d="M15 18l-6-6 6-6" />
              )}
            </svg>
          </button>
        ) : null}
        <Link
          to="/pos"
          className="inline-flex items-center gap-2 rounded-xl border border-line bg-canvas px-3 py-1.5 text-sm font-medium text-ink-muted transition hover:border-primary-200 hover:bg-primary-50 hover:text-primary-700 dark:hover:border-primary-500/30 dark:hover:bg-primary-500/20 dark:hover:text-primary-200"
        >
          <Search className="h-4 w-4 shrink-0" aria-hidden />
          <span className="hidden sm:inline">Quick sale</span>
          <kbd className="hidden rounded border border-line bg-surface px-1.5 font-mono text-[10px] text-ink-faint md:inline">
            F2 in POS
          </kbd>
        </Link>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <ThemeToggle compact />
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold sm:text-sm',
            syncUi.className,
          )}
          title="POS offline sync status"
        >
          <SyncIcon
            className={cn('h-3.5 w-3.5 sm:h-4 sm:w-4', syncStatus === 'syncing' && 'animate-spin')}
            aria-hidden
          />
          {syncUi.label}
        </span>
        {lowStockTotal > 0 ? (
          <Link
            to="/products"
            className="relative flex items-center gap-1.5 rounded-full border border-warning-100 bg-warning-50 px-2.5 py-1 text-xs font-semibold text-warning-800 transition hover:bg-warning-100 dark:border-warning-500/30 dark:bg-warning-500/20 dark:text-warning-100 dark:hover:bg-warning-500/25 sm:px-3 sm:text-sm"
            title="Products at or below minimum stock"
          >
            <Bell className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
            <span className="hidden sm:inline">Low stock</span>
            <span className="tabular-nums">{lowStockTotal}</span>
          </Link>
        ) : (
          <span className="hidden items-center gap-1 rounded-full border border-line bg-canvas px-2.5 py-1 text-xs text-ink-muted lg:inline-flex">
            <PackageSearch className="h-3.5 w-3.5" aria-hidden />
            Stock OK
          </span>
        )}
        <time className="hidden text-xs text-ink-muted md:block md:whitespace-nowrap" dateTime={new Date().toISOString()}>
          {now}
        </time>
        <div className="hidden h-8 w-px bg-line sm:block" aria-hidden />
        {user?.role === 'OWNER' || user?.role === 'ADMIN' ? (
          <label className="hidden min-w-0 items-center gap-2 sm:flex">
            <span className="sr-only">Branch</span>
            <select
              className="max-w-[200px] truncate rounded-xl border border-line bg-surface px-2 py-1.5 text-xs font-medium text-ink shadow-sm"
              value={selectedBranchId ?? ''}
              onChange={(e) => selectBranch(e.target.value)}
              title="Active branch for API requests"
            >
              {branches.length === 0 ? (
                <option value="">No branches</option>
              ) : (
                branches
                  .filter((b) => b.isActive)
                  .map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))
              )}
            </select>
          </label>
        ) : (
          <span
            className="hidden max-w-[180px] truncate rounded-xl border border-line bg-canvas px-2.5 py-1 text-xs font-medium text-ink-muted sm:inline-block"
            title="Your assigned branch"
          >
            {currentBranch?.name ?? 'Branch'}
          </span>
        )}
        <div className="hidden h-8 w-px bg-line md:block" aria-hidden />
        <div className="min-w-0 text-right">
          <p className="truncate text-sm font-semibold text-ink">{user?.name ?? '—'}</p>
          <p className="truncate text-xs text-ink-muted">
            {formatRoleLabel(user?.role)}
            <span className="text-ink-faint"> · </span>
            <span className="font-mono text-ink-faint">{user?.username}</span>
          </p>
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-700 ring-2 ring-surface">
          {(user?.name ?? '?').charAt(0).toUpperCase()}
        </div>
      </div>
    </header>
  );
}
