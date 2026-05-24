import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

type ErrorBannerProps = {
  message: string;
  onRetry?: () => void;
  className?: string;
};

export function ErrorBanner({ message, onRetry, className }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className={`flex flex-col items-center justify-center gap-3 rounded-2xl border border-danger-100 bg-danger-50 px-5 py-8 text-center sm:flex-row sm:text-left ${className ?? ''}`}
    >
      <AlertTriangle className="h-8 w-8 shrink-0 text-danger-500" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-danger-800">{message}</p>
      </div>
      {onRetry ? (
        <Button type="button" variant="secondary" size="sm" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}
