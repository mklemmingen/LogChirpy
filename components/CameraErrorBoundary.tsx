// components/CameraErrorBoundary.tsx - Critical Error Boundary for Camera View Hierarchy Errors
import React, { Component, ReactNode } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { ThemedIcon } from '@/components/ThemedIcon';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ThemedPressable } from '@/components/ThemedPressable';

interface Props {
  children: ReactNode;
  onCameraError?: () => void;
  fallbackComponent?: ReactNode;
  resetKeys?: Array<string | number>;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorBoundaryId: string;
  retryCount: number;
}

/**
 * Critical Error Boundary specifically designed for camera view hierarchy errors
 * Handles UIFrameGuarded.AddViewAt errors and provides recovery mechanisms
 */
export class CameraErrorBoundary extends Component<Props, State> {
  private resetTimeoutId: number | null = null;
  private maxRetries = 3;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorBoundaryId: Math.random().toString(36).substr(2, 9),
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> | null {
    // Check for specific view hierarchy errors
    const isViewHierarchyError = 
      error.message.includes('already has a parent') ||
      error.message.includes('UIFrameGuarded') ||
      error.message.includes('addViewAt') ||
      error.message.includes('ViewManager') ||
      error.message.includes('IllegalViewOperationException') ||
      error.message.includes('ViewHolder');

    if (isViewHierarchyError) {
      console.log('[CameraErrorBoundary] Detected view hierarchy error:', error.message);
      return { 
        hasError: true, 
        error,
        errorBoundaryId: Math.random().toString(36).substr(2, 9)
      };
    }

    // Let other errors bubble up
    return null;
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('[CameraErrorBoundary] Camera view error caught:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      errorBoundaryId: this.state.errorBoundaryId,
      retryCount: this.state.retryCount,
    });

    // Notify parent component of camera error
    this.props.onCameraError?.();

    // Auto-retry for view hierarchy errors (up to max retries)
    if (this.state.retryCount < this.maxRetries) {
      console.log(`[CameraErrorBoundary] Auto-retry attempt ${this.state.retryCount + 1}/${this.maxRetries}`);
      
      this.resetTimeoutId = setTimeout(() => {
        this.setState(prevState => ({
          hasError: false,
          error: null,
          retryCount: prevState.retryCount + 1,
          errorBoundaryId: Math.random().toString(36).substr(2, 9),
        }));
      }, 1000); // 1 second delay for view hierarchy to stabilize
    }
  }

  componentDidUpdate(prevProps: Props) {
    // Reset error state if resetKeys change
    const prevResetKeys = prevProps.resetKeys || [];
    const currentResetKeys = this.props.resetKeys || [];
    
    if (prevResetKeys.length !== currentResetKeys.length ||
        prevResetKeys.some((key, index) => key !== currentResetKeys[index])) {
      this.setState({
        hasError: false,
        error: null,
        retryCount: 0,
        errorBoundaryId: Math.random().toString(36).substr(2, 9),
      });
    }
  }

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
  }

  handleManualRetry = () => {
    console.log('[CameraErrorBoundary] Manual retry triggered');
    this.setState({
      hasError: false,
      error: null,
      retryCount: 0,
      errorBoundaryId: Math.random().toString(36).substr(2, 9),
    });
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback component if provided
      if (this.props.fallbackComponent) {
        return this.props.fallbackComponent;
      }

      // Default error UI
      return (
        <ThemedView style={styles.errorContainer}>
          <View style={styles.errorContent}>
            <View style={styles.errorIconContainer}>
              <ThemedIcon name="camera-off" size={48} color="error" />
            </View>

            <ThemedText variant="h3" style={styles.errorTitle}>
              Camera Initialization Error
            </ThemedText>

            <ThemedText variant="body" color="secondary" style={styles.errorMessage}>
              {this.state.retryCount >= this.maxRetries 
                ? 'Camera failed to initialize after multiple attempts. This may be due to view hierarchy conflicts.'
                : 'Camera view hierarchy error detected. Attempting automatic recovery...'
              }
            </ThemedText>

            {this.state.error && __DEV__ && (
              <View style={styles.debugInfo}>
                <ThemedText variant="caption" color="tertiary" style={styles.debugText}>
                  Error: {this.state.error.message}
                </ThemedText>
                <ThemedText variant="caption" color="tertiary" style={styles.debugText}>
                  Boundary ID: {this.state.errorBoundaryId}
                </ThemedText>
                <ThemedText variant="caption" color="tertiary" style={styles.debugText}>
                  Retry Count: {this.state.retryCount}/{this.maxRetries}
                </ThemedText>
              </View>
            )}

            <View style={styles.errorActions}>
              <ThemedPressable
                variant="primary"
                size="md"
                onPress={this.handleManualRetry}
                style={styles.retryButton}
              >
                <ThemedIcon name="refresh-cw" size={18} color="primary" />
                <ThemedText variant="button" style={styles.retryButtonText}>
                  Retry Camera
                </ThemedText>
              </ThemedPressable>

              {this.state.retryCount >= this.maxRetries && (
                <ThemedText variant="caption" color="secondary" style={styles.restartHint}>
                  If the problem persists, try restarting the app
                </ThemedText>
              )}
            </View>
          </View>
        </ThemedView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorContent: {
    alignItems: 'center',
    maxWidth: 320,
    gap: 16,
  },
  errorIconContainer: {
    marginBottom: 8,
  },
  errorTitle: {
    textAlign: 'center',
    fontWeight: '600',
  },
  errorMessage: {
    textAlign: 'center',
    lineHeight: 20,
  },
  debugInfo: {
    marginTop: 16,
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    alignSelf: 'stretch',
  },
  debugText: {
    textAlign: 'center',
    fontSize: 10,
    lineHeight: 14,
  },
  errorActions: {
    marginTop: 24,
    alignItems: 'center',
    gap: 12,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  retryButtonText: {
    fontWeight: '600',
  },
  restartHint: {
    textAlign: 'center',
    lineHeight: 16,
    fontStyle: 'italic',
  },
});

// Convenience wrapper for common camera error scenarios
export function withCameraErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  onError?: () => void
) {
  return function CameraWrappedComponent(props: P) {
    return (
      <CameraErrorBoundary onCameraError={onError}>
        <WrappedComponent {...props} />
      </CameraErrorBoundary>
    );
  };
}

export default CameraErrorBoundary;