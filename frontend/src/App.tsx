import { AppProviders } from '@/app/providers';
import { AppRouter } from '@/app/router';
import { RootErrorBoundary } from '@/components/errors/RootErrorBoundary';

export default function App() {
  return (
    <RootErrorBoundary>
      <AppProviders>
        <AppRouter />
      </AppProviders>
    </RootErrorBoundary>
  );
}
