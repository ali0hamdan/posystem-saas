import { type LucideIcon } from 'lucide-react';
import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

const iconVariants = {
  default: 'bg-canvas text-primary-600 border-line dark:bg-canvas-raised dark:text-primary-400',
  success: 'bg-success-50 text-success-600 border-success-100 dark:bg-success-500/15 dark:text-success-400 dark:border-success-500/20',
  warning: 'bg-warning-50 text-warning-600 border-warning-100 dark:bg-warning-500/15 dark:text-warning-400 dark:border-warning-500/20',
  danger: 'bg-danger-50 text-danger-600 border-danger-100 dark:bg-danger-500/15 dark:text-danger-400 dark:border-danger-500/20',
  muted: 'bg-canvas text-ink-muted border-line dark:bg-canvas-raised',
} as const;

export type StatCardProps = {
  title: string;
  value: string;
  icon: LucideIcon;
  iconVariant?: keyof typeof iconVariants;
  subtitle?: string;
  className?: string;
  trend?: ReactNode;
};

export function StatCard({
  title,
  value,
  icon: Icon,
  iconVariant = 'default',
  subtitle,
  className,
  trend,
}: StatCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-line bg-surface p-4 shadow-card transition-shadow hover:shadow-soft sm:p-5',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-faint">{title}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-ink">{value}</p>
          {subtitle ? <p className="mt-1 text-xs leading-snug text-ink-muted">{subtitle}</p> : null}
          {trend}
        </div>
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border',
            iconVariants[iconVariant],
          )}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </div>
      </div>
    </div>
  );
}
