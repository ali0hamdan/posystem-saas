import { Loader2 } from 'lucide-react';

type AuthLoadingScreenProps = {
  message?: string;
};

export function AuthLoadingScreen({ message = 'Loading…' }: AuthLoadingScreenProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas px-6">
      <Loader2 className="h-9 w-9 animate-spin text-primary-600" aria-hidden />
      <p className="text-center text-sm text-ink-muted">{message}</p>
    </div>
  );
}
