import { Component } from 'react';

export default class ErrorBoundary extends Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[70vh] p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-danger-bg text-danger-fg flex items-center justify-center mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h1 className="text-heading-1 mb-2">Errore dell'applicazione</h1>
          <p className="text-content-secondary mb-5 max-w-md text-sm">
            {this.state.error?.message || 'Si e\' verificato un errore inatteso.'}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => window.history.back()}
              className="h-9 px-4 rounded-md border border-border bg-surface text-content-primary text-sm font-medium hover:bg-surface-2 transition-colors"
            >
              Torna indietro
            </button>
            <button
              onClick={() => window.location.reload()}
              className="h-9 px-4 rounded-md bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition-colors"
            >
              Ricarica pagina
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
