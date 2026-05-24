import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

const variants = {
  default: 'bg-line/80 text-ink border border-line',
  primary: 'bg-primary-50 text-primary-800 border border-primary-100 dark:bg-primary-500/20 dark:text-primary-200 dark:border-primary-500/30',
  success: 'bg-success-50 text-success-700 border border-success-100 dark:bg-success-500/20 dark:text-success-200 dark:border-success-500/30',
  warning: 'bg-warning-50 text-warning-800 border border-warning-100 dark:bg-warning-500/20 dark:text-warning-100 dark:border-warning-500/30',
  danger: 'bg-danger-50 text-danger-700 border border-danger-100 dark:bg-danger-500/20 dark:text-danger-100 dark:border-danger-500/30',
  muted: 'bg-canvas-raised text-ink-muted border border-line',
} as const;

export type BadgeProps = {
  children: ReactNode;
  variant?: keyof typeof variants;
  className?: string;
};

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold tracking-wide',
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
