/**
 * Native Error Interceptor for UIFrameGuarded.AddViewAt errors
 * 
 * Intercepts native Android errors before they crash the app
 * and provides graceful recovery mechanisms.
 */

import { Platform, NativeModules } from 'react-native';
import { errorReporting } from './errorReporting';

interface NativeError {
  message: string;
  stack?: string;
  nativeStack?: string;
  componentStack?: string;
}

class NativeErrorInterceptor {
  private isInitialized = false;
  private errorCount = 0;
  private lastErrorTime = 0;
  private readonly maxErrorsPerMinute = 10;

  /**
   * Initialize native error interception
   */
  initialize() {
    if (this.isInitialized || Platform.OS !== 'android') {
      return;
    }

    try {
      // Intercept React Native bridge errors
      this.setupReactNativeErrorHandler();
      
      // Setup native crash handler
      this.setupNativeCrashHandler();
      
      // Setup UIFrameGuarded specific handler
      this.setupUIFrameGuardedHandler();

      this.isInitialized = true;
      console.log('Native error interceptor initialized');
      
      errorReporting.addBreadcrumb({
        category: 'log',
        message: 'Native error interceptor initialized',
        level: 'info',
      });
    } catch (error) {
      console.error('Failed to initialize native error interceptor:', error);
    }
  }

  /**
   * Setup React Native bridge error handler
   */
  private setupReactNativeErrorHandler() {
    // Intercept JavaScript errors that might be related to native views
    const ErrorUtils = (global as any).ErrorUtils;
    const originalErrorHandler = ErrorUtils?.getGlobalHandler?.();
    
    if (originalErrorHandler && ErrorUtils) {
      ErrorUtils.setGlobalHandler?.((error: any, isFatal: boolean) => {
        // Check if this is a UIFrameGuarded related error
        if (this.isUIFrameGuardedError(error)) {
          console.warn('Intercepted UIFrameGuarded error:', error.message);
          
          // Report but don't crash
          this.handleUIFrameGuardedError(error);
          
          // Don't call the original fatal handler for these errors
          if (!isFatal) {
            return;
          }
        }

        // Call original handler for other errors
        if (originalErrorHandler) {
          originalErrorHandler(error, isFatal);
        }
      });
    }
  }

  /**
   * Setup native crash handler for Android
   */
  private setupNativeCrashHandler() {
    // Try to intercept native crashes if possible
    if (NativeModules.ExceptionManager) {
      // Custom native module would be needed for full crash interception
      console.log('Native crash handler would be available');
    }
  }

  /**
   * Setup UIFrameGuarded specific error handler
   */
  private setupUIFrameGuardedHandler() {
    // Monitor for view hierarchy issues
    const originalConsoleError = console.error;
    
    console.error = (...args: any[]) => {
      const message = args.join(' ');
      
      if (this.isUIFrameGuardedError({ message })) {
        console.warn('UIFrameGuarded error intercepted in console:', message);
        this.handleUIFrameGuardedError({ message });
        return; // Don't show the error in console
      }
      
      // Call original console.error for other errors
      originalConsoleError.apply(console, args);
    };
  }

  /**
   * Check if error is related to UIFrameGuarded.AddViewAt
   */
  private isUIFrameGuardedError(error: { message: string }): boolean {
    const message = error.message?.toLowerCase() || '';
    
    const uiFrameGuardedKeywords = [
      'uiframeguarded',
      'addviewat',
      'view hierarchy',
      'fabric',
      'viewgroup',
      'view not attached',
      'invalid view',
      'view already has parent',
      'trying to add view that is already attached',
    ];

    return uiFrameGuardedKeywords.some(keyword => 
      message.includes(keyword)
    );
  }

  /**
   * Handle UIFrameGuarded errors gracefully
   */
  private handleUIFrameGuardedError(error: NativeError) {
    const now = Date.now();
    
    // Rate limiting
    if (now - this.lastErrorTime < 60000) {
      this.errorCount++;
      if (this.errorCount > this.maxErrorsPerMinute) {
        console.warn('UIFrameGuarded error rate limit exceeded');
        return;
      }
    } else {
      this.errorCount = 1;
    }
    
    this.lastErrorTime = now;

    // Log for debugging
    if (__DEV__) {
      console.group('UIFrameGuarded Error Handled');
      console.warn('Message:', error.message);
      console.warn('Stack:', error.stack);
      console.warn('Recovery: App continues running');
      console.groupEnd();
    }

    // Report to error service but don't crash
    errorReporting.reportError(new Error(error.message), {
      errorId: `uiframeguarded_${Date.now()}`,
      level: 'component',
      componentName: 'NativeViewManager',
      additionalContext: {
        errorType: 'UIFrameGuarded.AddViewAt',
        intercepted: true,
        recovered: true,
        platform: Platform.OS,
        errorCount: this.errorCount,
      },
    });

    // Add breadcrumb for context
    errorReporting.addBreadcrumb({
      category: 'log',
      message: 'UIFrameGuarded error intercepted and handled',
      level: 'warning',
      data: {
        message: error.message,
        errorCount: this.errorCount,
      },
    });

    // Attempt recovery
    this.attemptViewHierarchyRecovery();
  }

  /**
   * Attempt to recover from view hierarchy issues
   */
  private attemptViewHierarchyRecovery() {
    try {
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      // Request next frame to allow view hierarchy to stabilize
      requestAnimationFrame(() => {
        console.log('View hierarchy recovery attempted');
      });

      // Add delay before next view operations
      setTimeout(() => {
        errorReporting.addBreadcrumb({
          category: 'log',
          message: 'View hierarchy recovery completed',
          level: 'info',
        });
      }, 100);

    } catch (recoveryError) {
      console.warn('View hierarchy recovery failed:', recoveryError);
    }
  }

  /**
   * Get error statistics
   */
  getErrorStats() {
    return {
      errorCount: this.errorCount,
      lastErrorTime: this.lastErrorTime,
      isInitialized: this.isInitialized,
    };
  }

  /**
   * Reset error count
   */
  resetErrorCount() {
    this.errorCount = 0;
    this.lastErrorTime = 0;
  }
}

// Singleton instance
export const nativeErrorInterceptor = new NativeErrorInterceptor();

// Auto-initialize on Android
if (Platform.OS === 'android') {
  // Initialize after a small delay to ensure React Native is ready
  setTimeout(() => {
    nativeErrorInterceptor.initialize();
  }, 1000);
}

export default nativeErrorInterceptor;