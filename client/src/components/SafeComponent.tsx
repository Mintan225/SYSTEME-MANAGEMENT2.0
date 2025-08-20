import React, { Component, ErrorInfo, ReactNode, useEffect, useRef } from 'react';

interface SafeComponentProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface SafeComponentState {
  hasError: boolean;
  error: Error | null;
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

  static getDerivedStateFromError(error: Error): SafeComponentState {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error
    console.warn('SafeComponent caught an error:', error, errorInfo);
    
    // Call the onError callback if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Special handling for DOM manipulation errors
    if (error.message && error.message.includes('removeChild')) {
      console.warn('DOM manipulation error caught and handled safely:', error.message);
    }
  }

  componentWillUnmount() {
    this.isMounted = false;
  }

  render() {
    if (this.state.hasError) {
      // Render fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="safe-component-error p-4 text-center">
          <div className="text-sm text-gray-500">
            Une erreur s'est produite lors du rendu de ce composant.
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Hook to safely manage component mounted state
 */
export function useSafeMounted() {
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return isMountedRef;
}

/**
 * Safe state setter that only updates if component is still mounted
 */
export function useSafeState<T>(initialState: T | (() => T)) {
  const [state, setState] = React.useState<T>(initialState);
  const isMountedRef = useSafeMounted();

  const setSafeState = React.useCallback((newState: T | ((prevState: T) => T)) => {
    if (isMountedRef.current) {
      setState(newState);
    }
  }, [isMountedRef]);

  return [state, setSafeState] as const;
}

/**
 * Safe DOM manipulation wrapper
 */
export function safeRemoveChild(parent: Node, child: Node): boolean {
  try {
    if (parent && child && parent.contains(child)) {
      parent.removeChild(child);
      return true;
    }
  } catch (error) {
    console.warn('Safe removeChild prevented error:', error);
  }
  return false;
}

/**
 * Safe DOM appendChild wrapper
 */
export function safeAppendChild(parent: Node, child: Node): boolean {
  try {
    if (parent && child && !parent.contains(child)) {
      parent.appendChild(child);
      return true;
    }
  } catch (error) {
    console.warn('Safe appendChild prevented error:', error);
  }
  return false;
}

export default SafeComponent;
