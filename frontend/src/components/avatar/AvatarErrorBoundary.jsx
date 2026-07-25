import { Component } from 'react';

// Local, compact error boundary just for the 3D avatar widget -- if WebGL
// is unsupported or the renderer throws, this contains the failure to its
// own card instead of taking down the page (or reusing the full-screen
// global ErrorBoundary fallback, which would look broken nested in a card).
export default class AvatarErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('[AvatarErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-center p-6">
        <span className="text-3xl">🧊</span>
        <p className="text-sub text-sm">Couldn't load the 3D avatar</p>
        <p className="text-dim text-xs">Your browser or device may not support WebGL.</p>
      </div>
    );
  }
}
