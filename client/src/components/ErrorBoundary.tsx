
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { 
      hasError: true, 
      error, 
      errorInfo: null 
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary a attrapé une erreur :", error, errorInfo);
    
    this.setState({
      hasError: true,
      error: error,
      errorInfo: errorInfo,
    });

    // Log specific DOM errors
    if (error.message.includes('removeChild') || error.message.includes('NotFoundError')) {
      console.warn('DOM manipulation error caught - this is likely due to React state updates during unmounting');
    }
  }

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      return (
        <div style={{ 
          padding: '20px', 
          textAlign: 'center', 
          border: '1px solid #e0e0e0', 
          borderRadius: '8px', 
          margin: '20px auto', 
          maxWidth: '600px', 
          backgroundColor: '#f8f8f8' 
        }}>
          <h2 style={{ color: '#e74c3c' }}>Oups ! Quelque chose s'est mal passé.</h2>
          <p style={{ color: '#555' }}>
            Nous sommes désolés pour le désagrément. Veuillez réessayer.
          </p>
          
          <button 
            onClick={this.handleRetry}
            style={{
              padding: '10px 20px',
              backgroundColor: '#3498db',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              margin: '10px'
            }}
          >
            Réessayer
          </button>
          
          <button 
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 20px',
              backgroundColor: '#95a5a6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              margin: '10px'
            }}
          >
            Recharger la page
          </button>

          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details style={{ 
              marginTop: '20px', 
              textAlign: 'left', 
              backgroundColor: '#eee', 
              padding: '10px', 
              borderRadius: '4px' 
            }}>
              <summary style={{ cursor: 'pointer', color: '#3498db' }}>
                Détails de l'erreur (développement)
              </summary>
              <pre style={{ 
                whiteSpace: 'pre-wrap', 
                wordBreak: 'break-word', 
                fontSize: '0.8em', 
                color: '#333' 
              }}>
                {this.state.error.toString()}
                {this.state.errorInfo && (
                  <>
                    <br />
                    {this.state.errorInfo.componentStack}
                  </>
                )}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
