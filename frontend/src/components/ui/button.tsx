import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const variants = {
  primary:
    'bg-primary-600 text-white shadow-sm hover:bg-primary-500 active:bg-primary-700 focus-visible:ring-primary-500 disabled:bg-primary-300 disabled:text-white',
  secondary:
    'border border-line bg-surface text-ink shadow-card hover:bg-canvas-raised hover:border-line-strong active:bg-canvas focus-visible:ring-line-strong disabled:border-line disabled:bg-surface-muted disabled:text-ink-faint',
  ghost:
    'text-ink-muted hover:bg-canvas-raised hover:text-ink active:bg-canvas focus-visible:ring-line disabled:text-ink-faint disabled:hover:bg-transparent',
  danger:
    'bg-danger-600 text-white shadow-sm hover:bg-danger-500 active:bg-danger-700 focus-visible:ring-danger-500 disabled:bg-danger-300 disabled:text-white',
  outlinePrimary:
    'border border-primary-200 bg-primary-50 text-primary-700 hover:bg-primary-100 hover:border-primary-300 active:bg-primary-100 focus-visible:ring-primary-400 disabled:border-primary-100 disabled:text-primary-400',
  outlineDanger:
    'border border-danger-200 bg-danger-50 text-danger-700 hover:bg-danger-100 hover:border-danger-300 focus-visible:ring-danger-400 disabled:border-danger-100 disabled:text-danger-400',
} as const;

const sizes = {
  xs: 'h-7 px-2.5 text-xs rounded-md gap-1',
  sm: 'h-8 px-3 text-sm rounded-lg gap-1.5',
  md: 'h-9 px-4 text-sm rounded-lg gap-2',
  lg: 'h-10 px-5 text-sm rounded-lg gap-2',
  xl: 'h-11 px-6 text-base rounded-xl gap-2 font-semibold',
} as const;

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex items-center justify-center font-medium transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
        'disabled:cursor-not-allowed disabled:pointer-events-none',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
});
