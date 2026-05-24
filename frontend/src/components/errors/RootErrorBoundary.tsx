import { Component, type ErrorInfo, type ReactNode } from 'react';
import { logClientError } from '@/lib/frontend-logger';

type Props = { children: ReactNode };

type State = { hasError: boolean; message: string };

export class RootErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message || 'Something went wrong' };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    logClientError('react-boundary', error, { componentStack: info.componentStack?.slice(0, 2000) });
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-6 text-center text-ink">
          <h1 className="font-display text-2xl font-semibold">This view could not be displayed</h1>
          <p className="mt-3 max-w-md text-sm text-ink-muted">
            A client error occurred. You can try reloading the page. If the problem continues, contact support with the
            approximate time this happened.
          </p>
          <p className="mt-4 rounded-lg border border-line bg-surface px-3 py-2 font-mono text-xs text-warning-700">
            {this.state.message}
          </p>
          <button
            type="button"
            className="mt-8 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-500"
            onClick={() => window.location.reload()}
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
