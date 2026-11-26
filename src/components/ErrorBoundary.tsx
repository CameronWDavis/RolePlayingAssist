// Catches crashes while rendering so one broken page shows a message instead of a blank screen.
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** When this value changes (e.g. the URL), the boundary clears its error and tries again. */
  resetKey?: string;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Grimoire crashed while rendering:', error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    // Pages load on demand. If a new version was deployed while this tab was open, the old
    // page files are gone and the download fails. Reloading picks up the new version.
    if (/dynamically imported module|Importing a module script failed|Loading chunk|error loading dynamically/i.test(error.message)) {
      return (
        <div className="page empty-state crash" role="alert">
          <h2>Grimoire has been updated</h2>
          <p className="muted">A new version came out while this tab was open. Reload to get it. Your saved data is safe.</p>
          <div className="actions center">
            <button className="btn primary" onClick={() => window.location.reload()}>Reload</button>
          </div>
        </div>
      );
    }
    return (
      <div className="page empty-state crash" role="alert">
        <h2>Something went wrong on this page</h2>
        <p className="muted">
          Your characters and homebrew are still saved. Try again, or head back to the home page.
        </p>
        <div className="actions center">
          <button className="btn primary" onClick={() => this.setState({ error: null })}>Try again</button>
          <a className="btn" href="#/">Go to home</a>
        </div>
        <details className="crash-details">
          <summary>Technical details</summary>
          <pre>{error.message}</pre>
        </details>
      </div>
    );
  }
}
