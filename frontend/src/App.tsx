import { AppProviders } from '@/app/providers';
import { AppRouter } from '@/app/router';
import { DesktopActivationGate } from '@/components/electron/DesktopActivationGate';
import { RootErrorBoundary } from '@/components/errors/RootErrorBoundary';

export default function App() {
  return (
    <RootErrorBoundary>
      <AppProviders>
        <DesktopActivationGate>
          <AppRouter />
        </DesktopActivationGate>
      </AppProviders>
    </RootErrorBoundary>
  );
}
