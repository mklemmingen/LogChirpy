// components/NavigationErrorBoundary.tsx - Critical Error Boundary for Navigation View Hierarchy
import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';

interface Props {
  children: React.ReactNode;
  fallbackComponent?: React.ReactNode;
}

interface State {
  hasError: boolean;
  errorBoundaryId: string;
  errorCount: number;
  error: Error | null;
}

/**
 * Navigation Error Boundary specifically designed for view hierarchy errors
 * Handles UIFrameGuarded.AddViewAt errors with progressive recovery
 */
export class NavigationErrorBoundary extends React.Component<Props, State> {
  private recoveryTimeoutId: number | null = null;
  private maxErrorCount = 5;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      errorBoundaryId: Math.random().toString(36).substr(2, 9),
      errorCount: 0,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> | null {
    // Check for specific view hierarchy errors
    const isViewHierarchyError = [
      'already has a parent',
      'view hierarchy',
      'UIFrameGuarded',
      'ViewManager for tag',
      'IllegalViewOperationException',
      'addViewAt',
      'removeViewAt',
      'ConcurrentModificationException'
    ].some(keyword => error.message?.toLowerCase().includes(keyword.toLowerCase()));

    if (isViewHierarchyError) {
      console.log('[NavigationErrorBoundary] View hierarchy error detected:', error.message);
      return { 
        hasError: true, 
        error,
        errorBoundaryId: Math.random().toString(36).substr(2, 9)
      };
    }

    // Let other errors bubble up to higher level error boundaries
    return null;
  }

  componentDidCatch(error: Error, errorInfo: any) {
    const newErrorCount = this.state.errorCount + 1;
    
    console.error('[NavigationErrorBoundary] Navigation error intercepted:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      errorBoundaryId: this.state.errorBoundaryId,
      errorCount: newErrorCount,
    });

    // Update error count
    this.setState(prevState => ({
      errorCount: newErrorCount
    }));

    // Progressive recovery timing based on error frequency
    if (newErrorCount < this.maxErrorCount) {
      const recoveryDelay = Math.min(2000 + (newErrorCount * 1000), 10000);
      
      console.log(`[NavigationErrorBoundary] Auto-recovery scheduled in ${recoveryDelay}ms (attempt ${newErrorCount}/${this.maxErrorCount})`);
      
      this.recoveryTimeoutId = window.setTimeout(() => {
        console.log('[NavigationErrorBoundary] Attempting auto-recovery...');
        this.setState({ 
          hasError: false, 
          error: null,
          errorBoundaryId: Math.random().toString(36).substr(2, 9) 
        });
      }, recoveryDelay);
    } else {
      console.error('[NavigationErrorBoundary] Max error count reached, stopping auto-recovery');
    }
  }

  componentWillUnmount() {
    if (this.recoveryTimeoutId) {
      clearTimeout(this.recoveryTimeoutId);
    }
  }

  handleManualRetry = () => {
    console.log('[NavigationErrorBoundary] Manual retry triggered');
    this.setState({
      hasError: false,
      error: null,
      errorCount: 0, // Reset error count on manual retry
      errorBoundaryId: Math.random().toString(36).substr(2, 9),
    });
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback component if provided
      if (this.props.fallbackComponent) {
        return this.props.fallbackComponent;
      }

      // Default error UI with recovery status
      const isAutoRecovering = this.state.errorCount < this.maxErrorCount;
      
      return (
        <ThemedView style={styles.errorContainer}>
          <View style={styles.errorContent}>
            <ThemedText variant="h3" style={styles.errorTitle}>
              Navigation System Recovery
            </ThemedText>

            <ThemedText variant="body" color="secondary" style={styles.errorMessage}>
              {isAutoRecovering 
                ? `Recovering from view hierarchy error... (${this.state.errorCount}/${this.maxErrorCount})`
                : 'Navigation system encountered repeated errors. Manual recovery may be needed.'
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
              </View>
            )}

            {!isAutoRecovering && (
              <ThemedText
                variant="button"
                color="primary"
                style={styles.retryButton}
                onPress={this.handleManualRetry}
              >
                Retry Navigation
              </ThemedText>
            )}
          </View>
        </ThemedView>
      );
    }

    // Use unique key to force re-mount on recovery
    return <React.Fragment key={this.state.errorBoundaryId}>{this.props.children}</React.Fragment>;
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
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    textAlign: 'center',
    fontWeight: '600',
  },
});

export default NavigationErrorBoundary;