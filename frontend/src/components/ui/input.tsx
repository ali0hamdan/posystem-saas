import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export type TextInputProps = InputHTMLAttributes<HTMLInputElement> & {
  error?: string;
};

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { className, error, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        'w-full rounded-lg border bg-surface px-3 py-2.5 text-sm text-ink shadow-sm outline-none transition placeholder:text-ink-faint focus:border-primary-400 focus:ring-2 focus:ring-primary-500/25 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-ink-muted',
        error ? 'border-danger-500' : 'border-line',
        className,
      )}
      {...props}
    />
  );
});

export type SelectInputProps = SelectHTMLAttributes<HTMLSelectElement> & {
  error?: string;
};

export const SelectInput = forwardRef<HTMLSelectElement, SelectInputProps>(function SelectInput(
  { className, error, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cn(
        'w-full rounded-lg border bg-surface px-3 py-2.5 text-sm text-ink shadow-sm outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-500/25 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-ink-muted',
        error ? 'border-danger-500' : 'border-line',
        className,
      )}
      {...props}
    />
  );
});

export type FieldLabelProps = {
  htmlFor?: string;
  children: React.ReactNode;
  hint?: string;
  required?: boolean;
};

export function FieldLabel({ htmlFor, children, hint, required }: FieldLabelProps) {
  return (
    <div className="mb-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
        {children}
        {required ? <span className="text-danger-500"> *</span> : null}
      </label>
      {hint ? <p className="mt-0.5 text-xs text-ink-muted">{hint}</p> : null}
    </div>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs font-medium text-danger-600">{message}</p>;
}
