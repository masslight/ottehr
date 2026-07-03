import React from 'react';

interface ErrorBoundaryProps {
  // Receives the thrown Error (with its stack) so the caller can derive a located, trimmed message.
  onError: (error: unknown) => void;
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  failed: boolean;
}

// Contains a crash in the generated component tree: reports the error to the SPA (which drives
// bounded auto-repair) instead of leaving a blank white frame.
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error): void {
    this.props.onError(error);
  }

  render(): React.ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}
