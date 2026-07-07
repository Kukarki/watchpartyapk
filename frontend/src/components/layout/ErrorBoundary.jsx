import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // In production you'd send this to Sentry / LogRocket etc.
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen bg-void flex items-center justify-center px-4">
        <div className="text-center space-y-4 max-w-sm animate-fade-in">
          <div className="text-5xl">💥</div>
          <h1 className="font-display font-bold text-xl text-bright">
            Something went wrong
          </h1>
          <p className="text-sub text-sm leading-relaxed">
            An unexpected error occurred. Try refreshing the page — if it keeps
            happening, check your connection or clear your browser cache.
          </p>
          {this.state.error?.message && (
            <p className="text-dim text-xs font-mono bg-raised border border-border
                           rounded-lg px-4 py-2 text-left break-all">
              {this.state.error.message}
            </p>
          )}
          <div className="flex gap-3 justify-center pt-2">
            <button
              onClick={() => window.location.reload()}
              className="btn-primary"
            >
              Refresh page
            </button>
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); }}
              className="btn-ghost border border-border"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }
}
