import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: any) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class SafeComponent extends Component<Props, State> {
  private retryCount = 0;
  private maxRetries = 3;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('SafeComponent caught an error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);

    // Auto-retry for DOM manipulation errors
    if (this.retryCount < this.maxRetries && this.isDOMError(error)) {
      this.retryCount++;
      setTimeout(() => {
        this.setState({ hasError: false, error: undefined });
      }, 1000 * this.retryCount);
    }
  }

  private isDOMError(error: Error): boolean {
    return error.message.includes('removeChild') ||
           error.message.includes('appendChild') ||
           error.message.includes('Node') ||
           error.name === 'NotFoundError';
  }

  private handleRetry = () => {
    this.retryCount = 0;
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="p-4 border border-red-200 rounded-md bg-red-50">
          <h3 className="text-red-800 font-medium mb-2">Une erreur s'est produite</h3>
          <p className="text-red-600 text-sm mb-3">
            {this.state.error?.message || 'Erreur inconnue'}
          </p>
          <button
            onClick={this.handleRetry}
            className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
          >
            Réessayer
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default SafeComponent;