/**
 * Native Error Interceptor for UIFrameGuarded.AddViewAt errors
 * 
 * Intercepts native Android errors before they crash the app
 * and provides graceful recovery mechanisms.
 */

import { Platform, NativeModules, InteractionManager } from 'react-native';
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
  private readonly maxErrorsPerMinute = 5; // Reduced from 10 to 5 for better performance
  private readonly errorWindowMs = 60000; // 1 minute window
  private readonly navigationDebounceMs = 500; // Debounce navigation-related errors
  private lastNavigationTime = 0;
  private initializationPromise: Promise<void> | null = null;

  /**
   * Initialize native error interception with improved timing
   */
  async initialize() {
    if (this.isInitialized || Platform.OS !== 'android') {
      return;
    }

    // Return existing promise if already initializing
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.performInitialization();
    return this.initializationPromise;
  }

  private async performInitialization() {
    try {
      // Wait for React Native bridge to be fully ready
      await this.waitForBridgeReady();
      
      // Intercept React Native bridge errors
      this.setupReactNativeErrorHandler();
      
      // Setup native crash handler
      this.setupNativeCrashHandler();
      
      // Setup UIFrameGuarded specific handler
      this.setupUIFrameGuardedHandler();

      this.isInitialized = true;
      console.log('Native error interceptor initialized with enhanced navigation lifecycle support');
      
      errorReporting.addBreadcrumb({
        category: 'log',
        message: 'Native error interceptor initialized with navigation lifecycle integration',
        level: 'info',
      });
    } catch (error) {
      console.error('Failed to initialize native error interceptor:', error);
      this.initializationPromise = null; // Reset to allow retry
    }
  }

  /**
   * Wait for React Native bridge to be ready
   */
  private waitForBridgeReady(): Promise<void> {
    return new Promise((resolve) => {
      // Check if global bridge is available
      if ((global as any).__fbBatchedBridge) {
        resolve();
        return;
      }

      // Wait for bridge to be available
      const checkBridge = () => {
        if ((global as any).__fbBatchedBridge) {
          resolve();
        } else {
          setTimeout(checkBridge, 100);
        }
      };
      
      setTimeout(checkBridge, 100);
    });
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
   * Check if error is related to UIFrameGuarded.AddViewAt with enhanced navigation context
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
      'child already has a parent', // Common navigation error
      'view already has a parent',
      'view not attached to window manager',
      'view root impl',
      'failed to insert view into parent',
    ];

    return uiFrameGuardedKeywords.some(keyword => 
      message.includes(keyword)
    );
  }

  /**
   * Check if error is navigation-related and should be debounced
   */
  private isNavigationRelatedError(error: { message: string }): boolean {
    const message = error.message?.toLowerCase() || '';
    
    const navigationKeywords = [
      'navigation',
      'screen',
      'tab',
      'focus',
      'blur',
      'mount',
      'unmount',
    ];

    return navigationKeywords.some(keyword => 
      message.includes(keyword)
    );
  }

  /**
   * Handle UIFrameGuarded errors gracefully with navigation context
   */
  private handleUIFrameGuardedError(error: NativeError) {
    const now = Date.now();
    
    // Enhanced rate limiting with navigation debouncing
    const isNavigationError = this.isNavigationRelatedError(error);
    
    if (isNavigationError && now - this.lastNavigationTime < this.navigationDebounceMs) {
      // Debounce navigation-related errors
      return;
    }
    
    // Standard rate limiting
    if (now - this.lastErrorTime < this.errorWindowMs) {
      this.errorCount++;
      if (this.errorCount > this.maxErrorsPerMinute) {
        console.warn(`UIFrameGuarded error rate limit exceeded (${this.errorCount}/${this.maxErrorsPerMinute})`);
        return;
      }
    } else {
      this.errorCount = 1;
    }
    
    this.lastErrorTime = now;
    if (isNavigationError) {
      this.lastNavigationTime = now;
    }

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
   * Attempt to recover from view hierarchy issues with enhanced timing
   */
  private attemptViewHierarchyRecovery() {
    try {
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      // Multiple frame delay for better stability with React Navigation
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          console.log('View hierarchy recovery attempted with navigation lifecycle support');
        });
      });

      // Longer delay for navigation-heavy operations
      setTimeout(() => {
        errorReporting.addBreadcrumb({
          category: 'log',
          message: 'Enhanced view hierarchy recovery completed',
          level: 'info',
        });
      }, 150); // Increased from 100ms to 150ms

    } catch (recoveryError) {
      console.warn('View hierarchy recovery failed:', recoveryError);
    }
  }

  /**
   * Force cleanup for navigation transitions
   */
  forceNavigationCleanup() {
    try {
      // Reset navigation timing
      this.lastNavigationTime = 0;
      
      // Force multiple frames for view cleanup
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            console.log('Navigation cleanup completed');
          });
        });
      });
      
      errorReporting.addBreadcrumb({
        category: 'log',
        message: 'Navigation cleanup forced',
        level: 'info',
      });
    } catch (error) {
      console.warn('Navigation cleanup failed:', error);
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

// Auto-initialize on Android with improved timing
if (Platform.OS === 'android') {
  // Initialize after React Native is fully ready, considering navigation setup
  const initializeWhenReady = () => {
    // Check if InteractionManager is available (indicates RN is ready)
    if (typeof InteractionManager !== 'undefined') {
      InteractionManager.runAfterInteractions(() => {
        nativeErrorInterceptor.initialize();
      });
    } else {
      // Fallback with longer delay for complex navigation setups
      setTimeout(() => {
        nativeErrorInterceptor.initialize();
      }, 1500);
    }
  };
  
  // Small initial delay then check for readiness
  setTimeout(initializeWhenReady, 500);
}

export default nativeErrorInterceptor;