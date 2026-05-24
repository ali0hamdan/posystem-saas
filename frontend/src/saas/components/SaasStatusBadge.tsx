import { cn } from '@/lib/utils';

const statusStyles: Record<string, string> = {
  ACTIVE: 'bg-success-100 text-success-700 ring-success-500/35',
  LIFETIME: 'bg-primary-50 text-primary-700 ring-primary-500/35',
  SUSPENDED: 'bg-warning-100 text-warning-700 ring-warning-500/35',
  INACTIVE: 'bg-surface text-ink-muted ring-line',
  PENDING_PAYMENT: 'bg-orange-100 text-orange-700 ring-orange-500/35',
  PAST_DUE: 'bg-orange-100 text-orange-700 ring-orange-500/35',
  TRIALING: 'bg-blue-100 text-blue-700 ring-blue-500/35',
  EXPIRED: 'bg-danger-100 text-danger-700 ring-danger-500/35',
  CANCELLED: 'bg-surface text-ink-muted ring-line',
  UNUSED: 'bg-primary-50 text-primary-700 ring-primary-500/35',
  USED: 'bg-surface text-ink-muted ring-line',
  REVOKED: 'bg-danger-100 text-danger-700 ring-danger-500/35',
  PAID: 'bg-success-100 text-success-700 ring-success-500/35',
  PENDING: 'bg-orange-100 text-orange-700 ring-orange-500/35',
  FAILED: 'bg-danger-100 text-danger-700 ring-danger-500/35',
};

export function SaasStatusBadge({ status, className }: { status: string; className?: string }) {
  const style = statusStyles[status] ?? 'bg-surface text-ink-muted ring-line';
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
        style,
        className,
      )}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}

