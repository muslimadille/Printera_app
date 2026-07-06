import { Component, ErrorInfo, ReactNode } from 'react';
import { logInternalError } from '@/lib/errorLogger';

interface Props {
  tabKey: string;
  children: ReactNode;
}
interface State {
  hasError: boolean;
  message: string;
}

/**
 * Per-tab error boundary.
 *
 * Captures render errors per tab, logs them to the internal error log with a
 * full stack trace, React component stack, and a snapshot of any persisted
 * tab state (read from sessionStorage) so root cause can be diagnosed from
 * /__internal/errors without reproducing the crash.
 */
export default class TabErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(err: Error): State {
    return { hasError: true, message: err.message || 'Unknown error' };
  }

  componentDidCatch(err: Error, info: ErrorInfo) {
    try {
      // Snapshot any persisted state for this tab (best-effort).
      const ctx: Record<string, unknown> = {
        tab: this.props.tabKey,
        userAgent: navigator.userAgent,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
      };
      try {
        const keys = ['printCalc_itemCost_state_v1'];
        for (const k of keys) {
          const raw = sessionStorage.getItem(k);
          if (raw) {
            // Cap snapshot to avoid bloating the log.
            ctx[k] = raw.length > 4000 ? raw.slice(0, 4000) + '…(truncated)' : raw;
          }
        }
      } catch {}

      logInternalError({
        type: 'tab-crash',
        message: `[tab:${this.props.tabKey}] ${err.name}: ${err.message}`,
        url: window.location.href,
        source: this.props.tabKey,
        stack: err.stack || '',
        componentStack: info?.componentStack || '',
        context: ctx,
      });
    } catch {}
  }

  reset = () => this.setState({ hasError: false, message: '' });

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 text-center space-y-3" dir="rtl">
          <p className="text-sm text-muted-foreground">
            تعذّر عرض هذا القسم مؤقتاً. بياناتك محفوظة، يمكنك المحاولة مرة أخرى.
          </p>
          <button
            onClick={this.reset}
            className="text-xs px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
          >
            إعادة المحاولة
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
