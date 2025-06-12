/**
 * Error Reporting Service
 * Handles error tracking and reporting for production applications
 * Provides different reporting strategies for different error types
 */

export interface ErrorReport {
  errorId: string;
  error: Error;
  errorInfo?: string;
  componentName?: string;
  level: 'app' | 'component' | 'feature';
  timestamp: number;
  userId?: string;
  sessionId: string;
  appVersion: string;
  platform: 'android';
  deviceInfo?: {
    model?: string;
    osVersion?: string;
    appBuild?: string;
  };
  breadcrumbs?: ErrorBreadcrumb[];
  additionalContext?: Record<string, any>;
}

export interface ErrorBreadcrumb {
  timestamp: number;
  category: 'navigation' | 'user_action' | 'network' | 'state_change' | 'log';
  message: string;
  level: 'info' | 'warning' | 'error';
  data?: Record<string, any>;
}

interface ErrorReportingConfig {
  enabled: boolean;
  maxBreadcrumbs: number;
  reportingEndpoint?: string;
  apiKey?: string;
  enableLocalStorage: boolean;
  enableCrashAnalytics: boolean;
  minimumLogLevel: 'info' | 'warning' | 'error';
  rateLimiting: {
    maxReportsPerMinute: number;
    maxReportsPerSession: number;
  };
}

class ErrorReportingService {
  private config: ErrorReportingConfig;
  private breadcrumbs: ErrorBreadcrumb[] = [];
  private sessionId: string;
  private reportCount = 0;
  private lastReportTime = 0;
  private reportQueue: ErrorReport[] = [];

  constructor() {
    this.sessionId = this.generateSessionId();
    
    // Default configuration
    this.config = {
      enabled: !__DEV__, // Only enable in production
      maxBreadcrumbs: 50,
      enableLocalStorage: true,
      enableCrashAnalytics: false, // Enable when crash service is configured
      minimumLogLevel: 'warning',
      rateLimiting: {
        maxReportsPerMinute: 10,
        maxReportsPerSession: 100,
      },
    };

    // Initialize breadcrumbs
    this.addBreadcrumb({
      category: 'log',
      message: 'Error reporting service initialized',
      level: 'info',
    });
  }

  /**
   * Configure the error reporting service
   */
  configure(config: Partial<ErrorReportingConfig>) {
    this.config = { ...this.config, ...config };
    
    this.addBreadcrumb({
      category: 'log',
      message: 'Error reporting configured',
      level: 'info',
      data: { enabled: this.config.enabled },
    });
  }

  /**
   * Report an error with context
   */
  async reportError(
    error: Error,
    context: {
      errorId: string;
      level: 'app' | 'component' | 'feature';
      componentName?: string;
      errorInfo?: string;
      additionalContext?: Record<string, any>;
    }
  ): Promise<void> {
    if (!this.config.enabled) {
      if (__DEV__) {
        console.warn('Error reporting disabled in development:', error.message);
      }
      return;
    }

    // Rate limiting
    if (!this.shouldReport()) {
      if (__DEV__) {
        console.warn('Error reporting rate limited');
      }
      return;
    }

    try {
      const report = await this.createErrorReport(error, context);
      
      // Add to breadcrumbs
      this.addBreadcrumb({
        category: 'log',
        message: `Error reported: ${error.message}`,
        level: 'error',
        data: {
          errorId: context.errorId,
          component: context.componentName,
          level: context.level,
        },
      });

      // Store locally if enabled
      if (this.config.enableLocalStorage) {
        await this.storeLocalReport(report);
      }

      // Send to external service
      if (this.config.reportingEndpoint) {
        await this.sendReport(report);
      }

      // Log for development debugging
      if (__DEV__) {
        console.group(`Error Report [${context.level}]`);
        console.error('Error:', error);
        console.log('Report:', report);
        console.groupEnd();
      }

      this.reportCount++;
      this.lastReportTime = Date.now();

    } catch (reportingError) {
      // Don't throw errors from error reporting
      if (__DEV__) {
        console.error('Failed to report error:', reportingError);
      }
    }
  }

  /**
   * Add breadcrumb for error context
   */
  addBreadcrumb(breadcrumb: Omit<ErrorBreadcrumb, 'timestamp'>) {
    if (!this.config.enabled && breadcrumb.level !== 'error') {
      return;
    }

    const fullBreadcrumb: ErrorBreadcrumb = {
      ...breadcrumb,
      timestamp: Date.now(),
    };

    this.breadcrumbs.push(fullBreadcrumb);

    // Limit breadcrumb storage
    if (this.breadcrumbs.length > this.config.maxBreadcrumbs) {
      this.breadcrumbs = this.breadcrumbs.slice(-this.config.maxBreadcrumbs);
    }
  }

  /**
   * Log user actions for error context
   */
  logUserAction(action: string, data?: Record<string, any>) {
    this.addBreadcrumb({
      category: 'user_action',
      message: action,
      level: 'info',
      data,
    });
  }

  /**
   * Log navigation events
   */
  logNavigation(route: string, data?: Record<string, any>) {
    this.addBreadcrumb({
      category: 'navigation',
      message: `Navigated to ${route}`,
      level: 'info',
      data,
    });
  }

  /**
   * Log network requests
   */
  logNetworkRequest(url: string, method: string, status?: number, data?: Record<string, any>) {
    this.addBreadcrumb({
      category: 'network',
      message: `${method.toUpperCase()} ${url} ${status ? `(${status})` : ''}`,
      level: status && status >= 400 ? 'warning' : 'info',
      data: { method, status, ...data },
    });
  }

  /**
   * Log state changes
   */
  logStateChange(change: string, data?: Record<string, any>) {
    this.addBreadcrumb({
      category: 'state_change',
      message: change,
      level: 'info',
      data,
    });
  }

  /**
   * Get recent error reports for debugging
   */
  async getLocalReports(limit = 10): Promise<ErrorReport[]> {
    if (!this.config.enableLocalStorage) {
      return [];
    }

    try {
      const AsyncStorage = await import('@react-native-async-storage/async-storage');
      const stored = await AsyncStorage.default.getItem('error_reports');
      if (!stored) return [];

      const reports: ErrorReport[] = JSON.parse(stored);
      return reports.slice(-limit);
    } catch (error) {
      if (__DEV__) {
        console.warn('Failed to get local error reports:', error);
      }
      return [];
    }
  }

  /**
   * Clear local error reports
   */
  async clearLocalReports(): Promise<void> {
    if (!this.config.enableLocalStorage) {
      return;
    }

    try {
      const AsyncStorage = await import('@react-native-async-storage/async-storage');
      await AsyncStorage.default.removeItem('error_reports');
    } catch (error) {
      if (__DEV__) {
        console.warn('Failed to clear local error reports:', error);
      }
    }
  }

  /**
   * Get current session breadcrumbs
   */
  getBreadcrumbs(): ErrorBreadcrumb[] {
    return [...this.breadcrumbs];
  }

  /**
   * Private helper methods
   */
  private async createErrorReport(
    error: Error,
    context: {
      errorId: string;
      level: 'app' | 'component' | 'feature';
      componentName?: string;
      errorInfo?: string;
      additionalContext?: Record<string, any>;
    }
  ): Promise<ErrorReport> {
    const { Platform } = await import('react-native');
    const deviceInfo = await this.getDeviceInfo();

    return {
      errorId: context.errorId,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } as Error,
      errorInfo: context.errorInfo,
      componentName: context.componentName,
      level: context.level,
      timestamp: Date.now(),
      sessionId: this.sessionId,
      appVersion: '1.0.0', // Get from app config
      platform: 'android',
      deviceInfo,
      breadcrumbs: [...this.breadcrumbs],
      additionalContext: context.additionalContext,
    };
  }

  private async getDeviceInfo() {
    try {
      const { Platform } = await import('react-native');
      
      return {
        model: 'Android Device',
        osVersion: Platform.Version.toString(),
        appBuild: '1', // Get from app config
      };
    } catch {
      return {};
    }
  }

  private shouldReport(): boolean {
    const now = Date.now();
    const oneMinute = 60 * 1000;

    // Check session limit
    if (this.reportCount >= this.config.rateLimiting.maxReportsPerSession) {
      return false;
    }

    // Check rate limiting (simple implementation)
    if (now - this.lastReportTime < oneMinute / this.config.rateLimiting.maxReportsPerMinute) {
      return false;
    }

    return true;
  }

  private async storeLocalReport(report: ErrorReport): Promise<void> {
    try {
      const AsyncStorage = await import('@react-native-async-storage/async-storage');
      const stored = await AsyncStorage.default.getItem('error_reports');
      const reports: ErrorReport[] = stored ? JSON.parse(stored) : [];
      
      reports.push(report);
      
      // Keep only last 50 reports
      if (reports.length > 50) {
        reports.splice(0, reports.length - 50);
      }
      
      await AsyncStorage.default.setItem('error_reports', JSON.stringify(reports));
    } catch (error) {
      if (__DEV__) {
        console.warn('Failed to store error report locally:', error);
      }
    }
  }

  private async sendReport(report: ErrorReport): Promise<void> {
    if (!this.config.reportingEndpoint || !this.config.apiKey) {
      return;
    }

    try {
      const response = await fetch(this.config.reportingEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(report),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      // Queue for retry
      this.reportQueue.push(report);
      
      if (__DEV__) {
        console.warn('Failed to send error report:', error);
      }
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Retry failed reports
   */
  async retryFailedReports(): Promise<void> {
    if (this.reportQueue.length === 0) {
      return;
    }

    const reportsToRetry = [...this.reportQueue];
    this.reportQueue = [];

    for (const report of reportsToRetry) {
      try {
        await this.sendReport(report);
      } catch {
        // Re-queue failed reports (with limit)
        if (this.reportQueue.length < 10) {
          this.reportQueue.push(report);
        }
      }
    }
  }
}

// Singleton instance
export const errorReporting = new ErrorReportingService();

// Convenience functions
export const reportError = (
  error: Error,
  context: {
    errorId: string;
    level: 'app' | 'component' | 'feature';
    componentName?: string;
    errorInfo?: string;
    additionalContext?: Record<string, any>;
  }
) => errorReporting.reportError(error, context);

export const addBreadcrumb = (breadcrumb: Omit<ErrorBreadcrumb, 'timestamp'>) =>
  errorReporting.addBreadcrumb(breadcrumb);

export const logUserAction = (action: string, data?: Record<string, any>) =>
  errorReporting.logUserAction(action, data);

export const logNavigation = (route: string, data?: Record<string, any>) =>
  errorReporting.logNavigation(route, data);

export default errorReporting;