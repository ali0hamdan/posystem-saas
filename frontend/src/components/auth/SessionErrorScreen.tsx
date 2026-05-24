import { AlertCircle, RefreshCw } from 'lucide-react';
import { getApiErrorMessage } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

type SessionErrorScreenProps = {
  error: unknown;
  onRetry: () => void;
  isRetrying: boolean;
};

export function SessionErrorScreen({ error, onRetry, isRetrying }: SessionErrorScreenProps) {
  const message = getApiErrorMessage(error, 'Could not verify your session. Check your connection and try again.');

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-12">
      <Card className="w-full max-w-md shadow-soft">
        <CardContent className="p-8">
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-warning-50 text-warning-600 ring-1 ring-warning-100">
              <AlertCircle className="h-6 w-6" aria-hidden />
            </div>
            <h1 className="font-display text-lg font-semibold text-ink">Connection problem</h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">{message}</p>
            <Button
              type="button"
              variant="primary"
              className="mt-6 gap-2"
              onClick={onRetry}
              disabled={isRetrying}
            >
              <RefreshCw className={`h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`} aria-hidden />
              <span>{isRetrying ? 'Retrying…' : 'Try again'}</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
