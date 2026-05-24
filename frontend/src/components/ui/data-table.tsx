import { type ReactNode, type TdHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function DataTableShell({
  children,
  className,
  minWidthClass = 'min-w-[720px]',
}: {
  children: ReactNode;
  className?: string;
  /** Applied to inner scroll wrapper for horizontal scroll on small screens */
  minWidthClass?: string;
}) {
  return (
    <div className={cn('overflow-hidden rounded-2xl border border-line bg-surface shadow-card', className)}>
      <div className="overflow-x-auto">
        <div className={minWidthClass}>{children}</div>
      </div>
    </div>
  );
}

export function DataTable({ children, className }: { children: ReactNode; className?: string }) {
  return <table className={cn('w-full border-collapse text-left text-sm', className)}>{children}</table>;
}

export function Th({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        'border-b border-line bg-canvas px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-muted',
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className, ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn('border-b border-line px-4 py-3 text-ink', className)} {...rest}>
      {children}
    </td>
  );
}
