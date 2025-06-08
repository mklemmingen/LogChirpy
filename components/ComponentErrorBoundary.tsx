import React, { ReactNode } from 'react';
import { View } from 'react-native';
import ErrorBoundary from './ErrorBoundary';
import { ThemedView } from './ThemedView';
import { ThemedText } from './ThemedText';
import { ThemedIcon } from './ThemedIcon';
import { Button } from './Button';
import { useUnifiedColors } from '@/hooks/useUnifiedColors';
import { useResponsiveDimensions } from '@/hooks/useResponsiveDimensions';
import { useTranslation } from 'react-i18next';

interface ComponentErrorBoundaryProps {
  children: ReactNode;
  componentName?: string;
  fallbackComponent?: ReactNode;
  showMinimalError?: boolean;
  onError?: (error: Error, errorId: string) => void;
}

/**
 * Lightweight Error Boundary for Individual Components
 * Provides minimal error UI that doesn't disrupt the overall app experience
 */
export function ComponentErrorBoundary({
  children,
  componentName,
  fallbackComponent,
  showMinimalError = true,
  onError,
}: ComponentErrorBoundaryProps) {
  const { t } = useTranslation();
  const colors = useUnifiedColors();
  const dimensions = useResponsiveDimensions();

  const handleError = (error: Error, errorInfo: string, errorId: string) => {
    // Log component-level errors with context
    if (__DEV__) {
      console.warn(`Component Error [${componentName || 'Unknown'}]:`, error.message);
    }

    // Call custom error handler
    if (onError) {
      onError(error, errorId);
    }
  };

  const renderFallback = (error: Error, errorId: string, retry: () => void) => {
    // Custom fallback if provided
    if (fallbackComponent) {
      return fallbackComponent;
    }

    // Minimal error UI
    if (showMinimalError) {
      return (
        <ThemedView
          style={{
            padding: dimensions.layout.componentSpacing / 2,
            borderRadius: dimensions.layout.componentSpacing / 2,
            backgroundColor: colors.background.elevated,
            borderWidth: 1,
            borderColor: colors.status.error + '40',
            alignItems: 'center',
            minHeight: dimensions.touchTarget.comfortable * 2,
            justifyContent: 'center',
          }}
        >
          <ThemedIcon
            name="alert-circle"
            size={dimensions.icon.sm}
            color="error"
            style={{ marginBottom: dimensions.layout.componentSpacing / 4 }}
          />
          <ThemedText
            variant="caption"
            style={{
              color: colors.text.secondary,
              textAlign: 'center',
              marginBottom: dimensions.layout.componentSpacing / 4,
            }}
          >
            {componentName ? t('errors.componentFailed', `${componentName} unavailable`) : t('errors.componentGeneric', 'Component error')}
          </ThemedText>
          <Button
            title={t('errors.retry', 'Retry')}
            onPress={retry}
            variant="ghost"
            size="sm"
          />
        </ThemedView>
      );
    }

    // No error UI - just return null to hide the component
    return null;
  };

  return (
    <ErrorBoundary
      level="component"
      name={componentName}
      onError={handleError}
      fallback={renderFallback}
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * Feature-Level Error Boundary
 * For larger features that might have multiple components
 */
export function FeatureErrorBoundary({
  children,
  featureName,
  onError,
}: {
  children: ReactNode;
  featureName: string;
  onError?: (error: Error, errorId: string) => void;
}) {
  const { t } = useTranslation();
  const colors = useUnifiedColors();
  const dimensions = useResponsiveDimensions();

  const handleError = (error: Error, errorInfo: string, errorId: string) => {
    if (__DEV__) {
      console.warn(`Feature Error [${featureName}]:`, error.message);
    }

    if (onError) {
      onError(error, errorId);
    }
  };

  const renderFallback = (error: Error, errorId: string, retry: () => void) => (
    <ThemedView
      style={{
        flex: 1,
        padding: dimensions.layout.componentSpacing,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.background.primary,
      }}
    >
      <ThemedView
        style={{
          padding: dimensions.layout.componentSpacing,
          borderRadius: dimensions.layout.componentSpacing,
          backgroundColor: colors.background.elevated,
          alignItems: 'center',
          maxWidth: 300,
        }}
      >
        <ThemedIcon
          name="alert-triangle"
          size={dimensions.icon.lg}
          color="error"
          style={{ marginBottom: dimensions.layout.componentSpacing }}
        />
        
        <ThemedText
          variant="h3"
          style={{
            textAlign: 'center',
            marginBottom: dimensions.layout.componentSpacing / 2,
            color: colors.text.primary,
          }}
        >
          {t('errors.featureUnavailable', 'Feature Unavailable')}
        </ThemedText>

        <ThemedText
          variant="body"
          style={{
            textAlign: 'center',
            marginBottom: dimensions.layout.componentSpacing,
            color: colors.text.secondary,
          }}
        >
          {t('errors.featureTemporary', `${featureName} is temporarily unavailable. Please try again.`)}
        </ThemedText>

        <View style={{ flexDirection: 'row', gap: dimensions.layout.componentSpacing / 2 }}>
          <Button
            title={t('errors.retry', 'Try Again')}
            onPress={retry}
            variant="primary"
            size="md"
          />
        </View>
      </ThemedView>
    </ThemedView>
  );

  return (
    <ErrorBoundary
      level="feature"
      name={featureName}
      onError={handleError}
      fallback={renderFallback}
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * Critical Component Error Boundary
 * For components that are essential to app functionality (camera, auth, etc.)
 */
export function CriticalErrorBoundary({
  children,
  componentName,
  onError,
}: {
  children: ReactNode;
  componentName: string;
  onError?: (error: Error, errorId: string) => void;
}) {
  const { t } = useTranslation();
  const colors = useUnifiedColors();
  const dimensions = useResponsiveDimensions();

  const handleError = (error: Error, errorInfo: string, errorId: string) => {
    if (__DEV__) {
      console.error(`🚨 Critical Component Error [${componentName}]:`, error.message);
    }

    // Always report critical errors
    if (onError) {
      onError(error, errorId);
    }
  };

  const renderFallback = (error: Error, errorId: string, retry: () => void) => (
    <ThemedView
      style={{
        flex: 1,
        padding: dimensions.layout.componentSpacing,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.background.primary,
      }}
    >
      <ThemedView
        style={{
          padding: dimensions.layout.componentSpacing * 1.5,
          borderRadius: dimensions.layout.componentSpacing,
          backgroundColor: colors.status.error + '10',
          borderWidth: 1,
          borderColor: colors.status.error + '30',
          alignItems: 'center',
          maxWidth: 320,
        }}
      >
        <ThemedIcon
          name="alert-triangle"
          size={dimensions.icon.xl}
          color="error"
          style={{ marginBottom: dimensions.layout.componentSpacing }}
        />
        
        <ThemedText
          variant="h2"
          style={{
            textAlign: 'center',
            marginBottom: dimensions.layout.componentSpacing / 2,
            color: colors.status.error,
          }}
        >
          {t('errors.criticalError', 'Critical Error')}
        </ThemedText>

        <ThemedText
          variant="body"
          style={{
            textAlign: 'center',
            marginBottom: dimensions.layout.componentSpacing / 2,
            color: colors.text.primary,
          }}
        >
          {t('errors.criticalMessage', `${componentName} encountered a critical error and cannot continue.`)}
        </ThemedText>

        <ThemedText
          variant="caption"
          style={{
            textAlign: 'center',
            marginBottom: dimensions.layout.componentSpacing,
            color: colors.text.secondary,
          }}
        >
          {t('errors.criticalId', 'Error ID')}: {errorId.slice(-8)}
        </ThemedText>

        <Button
          title={t('errors.restart', 'Restart Component')}
          onPress={retry}
          variant="primary"
          size="lg"
        />
      </ThemedView>
    </ThemedView>
  );

  return (
    <ErrorBoundary
      level="component"
      name={componentName}
      onError={handleError}
      fallback={renderFallback}
    >
      {children}
    </ErrorBoundary>
  );
}

export default ComponentErrorBoundary;