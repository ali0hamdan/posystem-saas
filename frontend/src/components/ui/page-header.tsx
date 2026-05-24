import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export type BreadcrumbItem = { label: string; to?: string };

export type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  className?: string;
};

export function PageHeader({ title, description, actions, breadcrumbs, className }: PageHeaderProps) {
  return (
    <header className={cn('mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between', className)}>
      <div className="min-w-0 space-y-2">
        {breadcrumbs?.length ? (
          <nav className="flex flex-wrap items-center gap-1 text-xs text-ink-muted" aria-label="Breadcrumb">
            {breadcrumbs.map((b, i) => (
              <span key={`${b.label}-${i}`} className="flex items-center gap-1">
                {i > 0 ? <ChevronRight className="h-3.5 w-3.5 opacity-60" aria-hidden /> : null}
                {b.to ? (
                  <Link to={b.to} className="hover:text-primary-600">
                    {b.label}
                  </Link>
                ) : (
                  <span className={i === breadcrumbs.length - 1 ? 'font-medium text-ink' : ''}>{b.label}</span>
                )}
              </span>
            ))}
          </nav>
        ) : null}
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink md:text-3xl">{title}</h1>
          {description ? <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-muted">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
