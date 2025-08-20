import React, { Component, ErrorInfo, ReactNode, useEffect, useRef, useState } from 'react';

interface SafeComponentProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface SafeComponentState {
  hasError: boolean;
  error: Error | null;
}

// Hook personnalisé pour éviter les mises à jour d'état après démontage
export function useSafeState<T>(initialState: T) {
  const [state, setState] = React.useState<T>(initialState);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const setSafeState = React.useCallback((newState: T | ((prevState: T) => T)) => {
    if (isMountedRef.current) {
      setState(newState);
    }
  }, []);

  return [state, setSafeState] as const;
}

// Hook pour éviter les fuites mémoire dans les requêtes async
export function useAbortController() {
  const controllerRef = useRef<AbortController>();

  useEffect(() => {
    controllerRef.current = new AbortController();

    return () => {
      if (controllerRef.current && !controllerRef.current.signal.aborted) {
        controllerRef.current.abort();
      }
    };
  }, []);

  return controllerRef.current;
}

/**
 * Safe Component wrapper that catches DOM manipulation errors
 * and prevents crashes from removeChild and similar DOM errors
 */
class SafeComponent extends Component<SafeComponentProps, SafeComponentState> {
  private isMounted = true;

  constructor(props: SafeComponentProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  componentDidMount() {
    this.isMounted = true;
  }

  componentWillUnmount() {
    this.isMounted = false;
  }

  static getDerivedStateFromError(error: Error): SafeComponentState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn('SafeComponent caught error:', error.message);

    // Handle specific DOM errors that don't need to crash the app
    if (error.message.includes('removeChild') ||
        error.message.includes('NotFoundError') ||
        error.name === 'NotFoundError') {
      console.warn('DOM error caught and handled safely');
      // For DOM errors, we can often recover by just re-rendering
      setTimeout(() => {
        if (this.isMounted) {
          this.setState({ hasError: false, error: null });
        }
      }, 100);
      return;
    }

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError && this.props.fallback) {
      return this.props.fallback;
    }

    if (this.state.hasError) {
      return (
        <div style={{
          padding: '10px',
          border: '1px solid #ffeaa7',
          backgroundColor: '#fff3cd',
          borderRadius: '4px',
          margin: '10px 0'
        }}>
          <p style={{ color: '#856404', margin: 0 }}>
            Une erreur temporaire s'est produite. Rechargement en cours...
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}

export default SafeComponent;