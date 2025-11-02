import React from 'react';
import './ErrorBoundary.css';

/**
 * ErrorBoundary Component
 *
 * Catches JavaScript errors in child components
 * Provides fallback UI and error recovery options
 *
 * Props:
 * - children: React components to wrap
 * - fallback: Custom fallback component (optional)
 * - onError: Custom error handler function (optional)
 * - showErrorDetails: Whether to show technical error details
 */

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    };
  }

  static getDerivedStateFromError(error) {
    // Generate unique error ID for tracking
    const errorId = `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      hasError: true,
      error,
      errorId
    };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error,
      errorInfo
    });

    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo, this.state.errorId);
    }

    // Log to external service in production
    if (process.env.NODE_ENV === 'production') {
      this.logErrorToService(error, errorInfo);
    }
  }

  logErrorToService = (error, errorInfo) => {
    // In a real app, this would send to a service like Sentry, LogRocket, etc.
    // For now, we'll just log to console with structured data
    console.error('Production Error:', {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      errorId: this.state.errorId,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    });
  };

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback({
          error: this.state.error,
          errorInfo: this.state.errorInfo,
          errorId: this.state.errorId,
          retry: this.handleRetry,
          reload: this.handleReload
        });
      }

      // Default fallback UI
      return (
        <div className="error-boundary">
          <div className="error-boundary__container">
            <div className="error-boundary__icon">
              ⚠️
            </div>

            <h2 className="error-boundary__title">
              Oops! Something went wrong
            </h2>

            <p className="error-boundary__message">
              We're sorry, but something unexpected happened. Our team has been notified and is working on a fix.
            </p>

            {process.env.NODE_ENV === 'development' && this.props.showErrorDetails !== false && (
              <details className="error-boundary__details">
                <summary className="error-boundary__details-summary">
                  Error Details (Development Mode)
                </summary>
                <div className="error-boundary__details-content">
                  <div className="error-boundary__error-id">
                    <strong>Error ID:</strong> {this.state.errorId}
                  </div>
                  <div className="error-boundary__error-message">
                    <strong>Error:</strong> {this.state.error?.toString()}
                  </div>
                  {this.state.errorInfo && (
                    <div className="error-boundary__component-stack">
                      <strong>Component Stack:</strong>
                      <pre className="error-boundary__stack">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                  {this.state.error?.stack && (
                    <div className="error-boundary__error-stack">
                      <strong>Error Stack:</strong>
                      <pre className="error-boundary__stack">
                        {this.state.error.stack}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            )}

            <div className="error-boundary__actions">
              <button
                onClick={this.handleRetry}
                className="error-boundary__button error-boundary__button--primary"
              >
                Try Again
              </button>
              <button
                onClick={this.handleReload}
                className="error-boundary__button error-boundary__button--secondary"
              >
                Reload Page
              </button>
            </div>

            <div className="error-boundary__help">
              <p className="error-boundary__help-text">
                If the problem persists, please contact our support team and reference Error ID: <strong>{this.state.errorId}</strong>
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook-based wrapper for functional components
export const useErrorHandler = () => {
  return (error, errorInfo) => {
    console.error('Error caught by error handler:', error, errorInfo);
    // You can add more sophisticated error handling here
    // like sending to analytics, showing toast notifications, etc.
  };
};

// Specific error boundaries for different contexts
export const FlightSearchErrorBoundary = ({ children }) => (
  <ErrorBoundary
    fallback={({ error, retry }) => (
      <div className="flight-search-error">
        <div className="flight-search-error__icon">✈️</div>
        <h3>Flight Search Error</h3>
        <p>We couldn't search for flights right now. Please try again.</p>
        <button onClick={retry} className="btn btn-primary">
          Retry Search
        </button>
      </div>
    )}
  >
    {children}
  </ErrorBoundary>
);

export const SeatBookingErrorBoundary = ({ children }) => (
  <ErrorBoundary
    fallback={({ error, retry }) => (
      <div className="seat-booking-error">
        <div className="seat-booking-error__icon">💺</div>
        <h3>Seat Selection Error</h3>
        <p>There was an issue loading the seat map. Please try again.</p>
        <button onClick={retry} className="btn btn-primary">
          Try Again
        </button>
      </div>
    )}
  >
    {children}
  </ErrorBoundary>
);

export const BookingErrorBoundary = ({ children }) => (
  <ErrorBoundary
    fallback={({ error, retry, reload }) => (
      <div className="booking-error">
        <div className="booking-error__icon">📋</div>
        <h3>Booking Error</h3>
        <p>Something went wrong with your booking. You can try again or start over.</p>
        <div className="booking-error__actions">
          <button onClick={retry} className="btn btn-primary">
            Try Again
          </button>
          <button onClick={reload} className="btn btn-secondary">
            Start Over
          </button>
        </div>
      </div>
    )}
  >
    {children}
  </ErrorBoundary>
);

export default ErrorBoundary;