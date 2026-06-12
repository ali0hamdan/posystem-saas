import { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TextInput, type TextInputProps } from '@/components/ui/input';

export type PasswordInputProps = Omit<TextInputProps, 'type'> & {
  wrapperClassName?: string;
};

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(function PasswordInput(
  { className, wrapperClassName, disabled, ...props },
  ref,
) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className={cn('relative', wrapperClassName)}>
      <TextInput
        ref={ref}
        {...props}
        disabled={disabled}
        type={showPassword ? 'text' : 'password'}
        className={cn('pr-11', className)}
      />
      <button
        type="button"
        disabled={disabled}
        aria-label={showPassword ? 'Hide password' : 'Show password'}
        onClick={() => setShowPassword((prev) => !prev)}
        className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-ink-faint transition hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {showPassword ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
      </button>
    </div>
  );
});
