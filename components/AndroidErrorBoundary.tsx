import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button, Card } from 'react-native-paper';

interface State {
  hasError: boolean;
  errorBoundaryId: number;
  errorCount: number;
}

class AndroidErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = {
      hasError: false,
      errorBoundaryId: Date.now(),
      errorCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> | null {
    const isAndroidViewError = [
      'already has a parent',
      'view hierarchy',
      'ViewManager for tag',
      'IllegalViewOperationException',
      'ConcurrentModificationException',
      'android.view.ViewGroup$InvalidChildViewGroupException',
      'ReactNativeException',
      'ViewHierarchyException'
    ].some(keyword => 
      error.message?.toLowerCase().includes(keyword.toLowerCase()) ||
      error.stack?.toLowerCase().includes(keyword.toLowerCase())
    );

    if (isAndroidViewError) {
      console.warn('Android view hierarchy error caught:', error.message);
      return {
        hasError: true,
        errorBoundaryId: Date.now(),
        errorCount: 1
      };
    }
    
    return null;
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Android error intercepted:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      errorCount: this.state.errorCount
    });
    
    // Progressive recovery timing based on error frequency
    const baseDelay = 1000;
    const maxDelay = 10000;
    const recoveryDelay = Math.min(
      baseDelay + (this.state.errorCount * 1000), 
      maxDelay
    );
    
    console.log(`Scheduling recovery in ${recoveryDelay}ms (attempt ${this.state.errorCount})`);
    
    setTimeout(() => {
      console.log('Attempting automatic recovery...');
      this.setState({
        hasError: false,
        errorBoundaryId: Date.now()
      });
    }, recoveryDelay);
  }

  private handleManualRetry = () => {
    console.log('Manual retry triggered');
    this.setState({ 
      hasError: false, 
      errorBoundaryId: Date.now(),
      errorCount: Math.max(0, this.state.errorCount - 1) // Reduce count on manual retry
    });
  };

  render() {
    if (this.state.hasError) {
      const isFrequentError = this.state.errorCount > 3;
      
      return (
        <View style={styles.container}>
          <Card style={styles.errorCard} mode="elevated">
            <Card.Content style={styles.cardContent}>
              <Text variant="titleLarge" style={styles.title}>
                {isFrequentError ? 'Persistent Android Error' : 'Recovering...'}
              </Text>
              
              <Text variant="bodyMedium" style={styles.message}>
                {isFrequentError 
                  ? 'Multiple Android view errors detected. This may require a restart.'
                  : `Recovering from Android error (attempt ${this.state.errorCount})...`
                }
              </Text>
              
              <View style={styles.buttonContainer}>
                <Button 
                  mode="contained" 
                  onPress={this.handleManualRetry}
                  style={styles.retryButton}
                  icon="refresh"
                >
                  Retry Now
                </Button>
                
                {isFrequentError && (
                  <Button 
                    mode="outlined" 
                    onPress={() => {
                      // Reset error count for fresh start
                      this.setState({ 
                        hasError: false, 
                        errorBoundaryId: Date.now(),
                        errorCount: 0
                      });
                    }}
                    style={styles.resetButton}
                    icon="restart"
                  >
                    Reset
                  </Button>
                )}
              </View>
              
              <Text variant="bodySmall" style={styles.technicalInfo}>
                Error ID: {this.state.errorBoundaryId}
              </Text>
            </Card.Content>
          </Card>
        </View>
      );
    }

    return (
      <React.Fragment key={this.state.errorBoundaryId}>
        {this.props.children}
      </React.Fragment>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F5F5F5',
  },
  errorCard: {
    width: '100%',
    maxWidth: 400,
  },
  cardContent: {
    alignItems: 'center',
    padding: 24,
  },
  title: {
    marginBottom: 16,
    textAlign: 'center',
    color: '#D32F2F',
  },
  message: {
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  retryButton: {
    minWidth: 100,
  },
  resetButton: {
    minWidth: 100,
  },
  technicalInfo: {
    color: '#757575',
    fontSize: 12,
    textAlign: 'center',
  },
});

export default AndroidErrorBoundary;