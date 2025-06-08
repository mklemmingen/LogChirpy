import React, { Component, ReactNode } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ThemedView } from './ThemedView';
import { ThemedText } from './ThemedText';
import { ThemedIcon } from './ThemedIcon';
import { Button } from './Button';
import { useUnifiedColors } from '@/hooks/useUnifiedColors';
import { useResponsiveDimensions } from '@/hooks/useResponsiveDimensions';
import { Z_LAYERS } from '@/constants/layers';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: string | null;
  errorId: string;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, errorId: string, retry: () => void) => ReactNode;
  onError?: (error: Error, errorInfo: string, errorId: string) => void;
  level?: 'app' | 'component' | 'feature';
  name?: string;
}

/**
 * Global Error Boundary Component
 * Catches JavaScript errors anywhere in the child component tree and displays fallback UI
 * Prevents crashes from propagating to the entire application
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimeoutId: any = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return {
      hasError: true,
      error,
      errorId,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const errorId = this.state.errorId;
    const errorDetails = `
Component Stack: ${errorInfo.componentStack}
Error Boundary: ${this.props.name || 'Unknown'}
Level: ${this.props.level || 'component'}
Timestamp: ${new Date().toISOString()}
Error ID: ${errorId}
    `.trim();

    this.setState({
      errorInfo: errorDetails,
    });

    // Log error details for development
    if (__DEV__) {
      console.group(`🚨 Error Boundary Caught Error [${this.props.level}]`);
      console.error('Error:', error.message);
      console.error('Stack:', error.stack);
      console.error('Component Stack:', errorInfo.componentStack);
      console.error('Error ID:', errorId);
      console.groupEnd();
    }

    // Report error to external service in production
    if (!__DEV__ && this.props.onError) {
      this.props.onError(error, errorDetails, errorId);
    }

    // Auto-retry for component-level errors after delay
    if (this.props.level === 'component' || this.props.level === 'feature') {
      this.retryTimeoutId = setTimeout(() => {
        this.handleRetry();
      }, 5000);
    }
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  handleRetry = () => {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
    
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
    });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.state.errorId, this.handleRetry);
      }

      // Default fallback UI based on error level
      return (
        <ErrorFallback
          error={this.state.error}
          errorId={this.state.errorId}
          errorInfo={this.state.errorInfo}
          level={this.props.level || 'component'}
          name={this.props.name}
          onRetry={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * Default Error Fallback UI Component
 * Provides different UI based on error level (app, component, feature)
 */
interface ErrorFallbackProps {
  error: Error;
  errorId: string;
  errorInfo: string | null;
  level: 'app' | 'component' | 'feature';
  name?: string;
  onRetry: () => void;
}

function ErrorFallback({ error, errorId, errorInfo, level, name, onRetry }: ErrorFallbackProps) {
  const { t } = useTranslation();
  const colors = useUnifiedColors();
  const dimensions = useResponsiveDimensions();

  const getErrorConfig = () => {
    switch (level) {
      case 'app':
        return {
          title: t('errors.app.title', 'Application Error'),
          message: t('errors.app.message', 'Something went wrong with the application.'),
          icon: 'alert-triangle',
          severity: 'critical' as const,
          showDetails: true,
        };
      case 'feature':
        return {
          title: t('errors.feature.title', 'Feature Unavailable'),
          message: t('errors.feature.message', `The ${name || 'feature'} is temporarily unavailable.`),
          icon: 'alert-circle',
          severity: 'high' as const,
          showDetails: false,
        };
      case 'component':
      default:
        return {
          title: t('errors.component.title', 'Component Error'),
          message: t('errors.component.message', 'This component encountered an error.'),
          icon: 'alert-circle',
          severity: 'medium' as const,
          showDetails: false,
        };
    }
  };

  const config = getErrorConfig();
  const isFullScreen = level === 'app';

  return (
    <ThemedView
      style={{
        flex: isFullScreen ? 1 : undefined,
        minHeight: isFullScreen ? undefined : dimensions.touchTarget.comfortable * 3,
        padding: dimensions.layout.componentSpacing,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.background.primary,
        ...(level === 'app' && {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: Z_LAYERS.ALERTS,
        }),
      }}
    >
      {/* Error Icon */}
      <ThemedView
        style={{
          marginBottom: dimensions.layout.componentSpacing,
          padding: dimensions.layout.componentSpacing,
          borderRadius: dimensions.layout.componentSpacing * 3,
          backgroundColor: colors.status.error + '20',
        }}
      >
        <ThemedIcon
          name={config.icon as any}
          size={dimensions.icon.xl}
          color="error"
        />
      </ThemedView>

      {/* Error Title */}
      <ThemedText
        variant="h2"
        style={{
          textAlign: 'center',
          marginBottom: dimensions.layout.componentSpacing / 2,
          color: colors.text.primary,
        }}
      >
        {config.title}
      </ThemedText>

      {/* Error Message */}
      <ThemedText
        variant="body"
        style={{
          textAlign: 'center',
          marginBottom: dimensions.layout.componentSpacing,
          color: colors.text.secondary,
          maxWidth: 300,
        }}
      >
        {config.message}
      </ThemedText>

      {/* Error ID (for support) */}
      <ThemedText
        variant="caption"
        style={{
          textAlign: 'center',
          marginBottom: dimensions.layout.componentSpacing,
          color: colors.text.tertiary,
          fontFamily: 'monospace',
        }}
      >
        {t('errors.errorId', 'Error ID')}: {errorId.slice(-8)}
      </ThemedText>

      {/* Actions */}
      <View style={{ flexDirection: 'row', gap: dimensions.layout.componentSpacing / 2 }}>
        <Button
          title={t('errors.retry', 'Try Again')}
          onPress={onRetry}
          variant="primary"
          size="md"
        />

        {config.showDetails && __DEV__ && (
          <Button
            title={t('errors.details', 'Details')}
            onPress={() => {
              console.group('Error Details');
              console.error('Error:', error.message);
              console.error('Stack:', error.stack);
              if (errorInfo) console.error('Info:', errorInfo);
              console.groupEnd();
            }}
            variant="ghost"
            size="md"
          />
        )}
      </View>

      {/* Development Info */}
      {__DEV__ && level === 'app' && (
        <ThemedView
          style={{
            marginTop: dimensions.layout.componentSpacing * 2,
            padding: dimensions.layout.componentSpacing,
            backgroundColor: colors.background.elevated,
            borderRadius: dimensions.layout.componentSpacing / 2,
            maxWidth: '90%',
          }}
        >
          <ThemedText
            variant="caption"
            style={{
              color: colors.text.secondary,
              fontFamily: 'monospace',
              fontSize: 12,
            }}
          >
            {error.message}
          </ThemedText>
        </ThemedView>
      )}
    </ThemedView>
  );
}

/**
 * Higher-order component for wrapping components with error boundaries
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  return WrappedComponent;
}

/**
 * Hook for accessing error boundary functionality
 */
export function useErrorHandler() {
  const throwError = React.useCallback((error: Error) => {
    throw error;
  }, []);

  const handleAsyncError = React.useCallback((error: Error) => {
    // Log async errors that can't be caught by error boundaries
    if (__DEV__) {
      console.error('🚨 Async Error:', error);
    }
    
    // In production, report to error tracking service
    // reportError(error);
  }, []);

  return {
    throwError,
    handleAsyncError,
  };
}

export default ErrorBoundary;