import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ThemedView } from './ThemedView';
import { ThemedText } from './ThemedText';
import { ThemedIcon } from './ThemedIcon';
import { Button } from './Button';
import { useUnifiedColors } from '@/hooks/useUnifiedColors';
import { useResponsiveDimensions } from '@/hooks/useResponsiveDimensions';

/**
 * Camera Error Fallback Component
 * Specialized fallback for camera-related errors
 */
export function CameraErrorFallback({ 
  error, 
  onRetry, 
  onGoBack 
}: { 
  error: Error; 
  onRetry: () => void;
  onGoBack?: () => void;
}) {
  const { t } = useTranslation();
  const colors = useUnifiedColors();
  const dimensions = useResponsiveDimensions();

  return (
    <ThemedView
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: dimensions.layout.componentSpacing,
        backgroundColor: colors.background.primary,
      }}
    >
      <ThemedView
        style={{
          alignItems: 'center',
          padding: dimensions.layout.componentSpacing * 1.5,
          borderRadius: dimensions.layout.componentSpacing,
          backgroundColor: colors.background.elevated,
          maxWidth: 320,
        }}
      >
        <ThemedIcon
          name="camera-off"
          size={dimensions.icon.xl}
          color="error"
          style={{ marginBottom: dimensions.layout.componentSpacing }}
        />
        
        <ThemedText
          variant="h2"
          style={{
            textAlign: 'center',
            marginBottom: dimensions.layout.componentSpacing / 2,
            color: colors.text.primary,
          }}
        >
          {t('errors.camera.title', 'Camera Error')}
        </ThemedText>

        <ThemedText
          variant="body"
          style={{
            textAlign: 'center',
            marginBottom: dimensions.layout.componentSpacing,
            color: colors.text.secondary,
          }}
        >
          {t('errors.camera.message', 'The camera encountered an error and cannot continue.')}
        </ThemedText>

        <View style={{ 
          flexDirection: 'row', 
          gap: dimensions.layout.componentSpacing / 2,
          flexWrap: 'wrap',
          justifyContent: 'center'
        }}>
          <Button
            title={t('errors.retry', 'Try Again')}
            onPress={onRetry}
            variant="primary"
            size="md"
          />
          
          {onGoBack && (
            <Button
              title={t('errors.goBack', 'Go Back')}
              onPress={onGoBack}
              variant="secondary"
              size="md"
            />
          )}
        </View>

        {__DEV__ && (
          <ThemedText
            variant="caption"
            style={{
              marginTop: dimensions.layout.componentSpacing,
              color: colors.text.tertiary,
              fontFamily: 'monospace',
              fontSize: 12,
            }}
          >
            {error.message}
          </ThemedText>
        )}
      </ThemedView>
    </ThemedView>
  );
}

/**
 * Network Error Fallback Component
 * For network-related errors (API calls, etc.)
 */
export function NetworkErrorFallback({ 
  error, 
  onRetry,
  operation 
}: { 
  error: Error; 
  onRetry: () => void;
  operation?: string;
}) {
  const { t } = useTranslation();
  const colors = useUnifiedColors();
  const dimensions = useResponsiveDimensions();

  return (
    <ThemedView
      style={{
        alignItems: 'center',
        padding: dimensions.layout.componentSpacing,
        borderRadius: dimensions.layout.componentSpacing / 2,
        backgroundColor: colors.background.elevated,
        borderWidth: 1,
        borderColor: colors.border.primary,
      }}
    >
      <ThemedIcon
        name="wifi-off"
        size={dimensions.icon.lg}
        color="error"
        style={{ marginBottom: dimensions.layout.componentSpacing / 2 }}
      />
      
      <ThemedText
        variant="h3"
        style={{
          textAlign: 'center',
          marginBottom: dimensions.layout.componentSpacing / 4,
          color: colors.text.primary,
        }}
      >
        {t('errors.network.title', 'Connection Error')}
      </ThemedText>

      <ThemedText
        variant="body"
        style={{
          textAlign: 'center',
          marginBottom: dimensions.layout.componentSpacing / 2,
          color: colors.text.secondary,
        }}
      >
        {operation 
          ? t('errors.network.operationFailed', `Failed to ${operation}. Check your connection.`)
          : t('errors.network.message', 'Please check your internet connection.')
        }
      </ThemedText>

      <Button
        title={t('errors.retry', 'Try Again')}
        onPress={onRetry}
        variant="ghost"
        size="sm"
      />
    </ThemedView>
  );
}

/**
 * AI/ML Model Error Fallback Component
 * For ML model loading or inference errors
 */
export function MLModelErrorFallback({ 
  error, 
  onRetry,
  modelName,
  fallbackAction 
}: { 
  error: Error; 
  onRetry: () => void;
  modelName?: string;
  fallbackAction?: () => void;
}) {
  const { t } = useTranslation();
  const colors = useUnifiedColors();
  const dimensions = useResponsiveDimensions();

  return (
    <ThemedView
      style={{
        alignItems: 'center',
        padding: dimensions.layout.componentSpacing,
        borderRadius: dimensions.layout.componentSpacing / 2,
        backgroundColor: colors.background.elevated,
        borderWidth: 1,
        borderColor: colors.status.warning + '40',
      }}
    >
      <ThemedIcon
        name="cpu"
        size={dimensions.icon.lg}
        color="error"
        style={{ marginBottom: dimensions.layout.componentSpacing / 2 }}
      />
      
      <ThemedText
        variant="h3"
        style={{
          textAlign: 'center',
          marginBottom: dimensions.layout.componentSpacing / 4,
          color: colors.text.primary,
        }}
      >
        {t('errors.ml.title', 'AI Model Error')}
      </ThemedText>

      <ThemedText
        variant="body"
        style={{
          textAlign: 'center',
          marginBottom: dimensions.layout.componentSpacing / 2,
          color: colors.text.secondary,
        }}
      >
        {modelName 
          ? t('errors.ml.modelFailed', `${modelName} model failed to load.`)
          : t('errors.ml.message', 'AI features are temporarily unavailable.')
        }
      </ThemedText>

      <View style={{ 
        flexDirection: 'row', 
        gap: dimensions.layout.componentSpacing / 2,
        flexWrap: 'wrap',
        justifyContent: 'center'
      }}>
        <Button
          title={t('errors.retry', 'Retry')}
          onPress={onRetry}
          variant="ghost"
          size="sm"
        />
        
        {fallbackAction && (
          <Button
            title={t('errors.continueWithoutAI', 'Continue')}
            onPress={fallbackAction}
            variant="secondary"
            size="sm"
          />
        )}
      </View>
    </ThemedView>
  );
}

/**
 * Data Loading Error Fallback Component
 * For database or data loading errors
 */
export function DataErrorFallback({ 
  error, 
  onRetry,
  dataType 
}: { 
  error: Error; 
  onRetry: () => void;
  dataType?: string;
}) {
  const { t } = useTranslation();
  const colors = useUnifiedColors();
  const dimensions = useResponsiveDimensions();

  return (
    <ThemedView
      style={{
        alignItems: 'center',
        padding: dimensions.layout.componentSpacing,
        borderRadius: dimensions.layout.componentSpacing / 2,
        backgroundColor: colors.background.elevated,
        borderWidth: 1,
        borderColor: colors.border.primary,
      }}
    >
      <ThemedIcon
        name="database"
        size={dimensions.icon.lg}
        color="error"
        style={{ marginBottom: dimensions.layout.componentSpacing / 2 }}
      />
      
      <ThemedText
        variant="h3"
        style={{
          textAlign: 'center',
          marginBottom: dimensions.layout.componentSpacing / 4,
          color: colors.text.primary,
        }}
      >
        {t('errors.data.title', 'Data Error')}
      </ThemedText>

      <ThemedText
        variant="body"
        style={{
          textAlign: 'center',
          marginBottom: dimensions.layout.componentSpacing / 2,
          color: colors.text.secondary,
        }}
      >
        {dataType 
          ? t('errors.data.typeFailed', `Failed to load ${dataType}.`)
          : t('errors.data.message', 'Unable to load data.')
        }
      </ThemedText>

      <Button
        title={t('errors.retry', 'Try Again')}
        onPress={onRetry}
        variant="ghost"
        size="sm"
      />
    </ThemedView>
  );
}

/**
 * Permission Error Fallback Component
 * For permission-related errors
 */
export function PermissionErrorFallback({ 
  error, 
  permission,
  onRequestPermission,
  onSettings 
}: { 
  error: Error; 
  permission: string;
  onRequestPermission?: () => void;
  onSettings?: () => void;
}) {
  const { t } = useTranslation();
  const colors = useUnifiedColors();
  const dimensions = useResponsiveDimensions();

  return (
    <ThemedView
      style={{
        alignItems: 'center',
        padding: dimensions.layout.componentSpacing * 1.5,
        borderRadius: dimensions.layout.componentSpacing,
        backgroundColor: colors.background.elevated,
        borderWidth: 1,
        borderColor: colors.status.warning + '40',
      }}
    >
      <ThemedIcon
        name="shield-off"
        size={dimensions.icon.xl}
        color="error"
        style={{ marginBottom: dimensions.layout.componentSpacing }}
      />
      
      <ThemedText
        variant="h2"
        style={{
          textAlign: 'center',
          marginBottom: dimensions.layout.componentSpacing / 2,
          color: colors.text.primary,
        }}
      >
        {t('errors.permission.title', 'Permission Required')}
      </ThemedText>

      <ThemedText
        variant="body"
        style={{
          textAlign: 'center',
          marginBottom: dimensions.layout.componentSpacing,
          color: colors.text.secondary,
        }}
      >
        {t('errors.permission.message', `${permission} permission is required for this feature.`)}
      </ThemedText>

      <View style={{ 
        flexDirection: 'row', 
        gap: dimensions.layout.componentSpacing / 2,
        flexWrap: 'wrap',
        justifyContent: 'center'
      }}>
        {onRequestPermission && (
          <Button
            title={t('errors.permission.grant', 'Grant Permission')}
            onPress={onRequestPermission}
            variant="primary"
            size="md"
          />
        )}
        
        {onSettings && (
          <Button
            title={t('errors.permission.settings', 'Open Settings')}
            onPress={onSettings}
            variant="secondary"
            size="md"
          />
        )}
      </View>
    </ThemedView>
  );
}

/**
 * Generic Error Fallback Component
 * Minimal fallback for unknown errors
 */
export function GenericErrorFallback({ 
  error, 
  onRetry,
  message 
}: { 
  error: Error; 
  onRetry?: () => void;
  message?: string;
}) {
  const { t } = useTranslation();
  const colors = useUnifiedColors();
  const dimensions = useResponsiveDimensions();

  return (
    <ThemedView
      style={{
        alignItems: 'center',
        padding: dimensions.layout.componentSpacing,
        borderRadius: dimensions.layout.componentSpacing / 2,
        backgroundColor: colors.background.elevated,
        borderWidth: 1,
        borderColor: colors.border.primary,
        minHeight: dimensions.touchTarget.comfortable * 2,
        justifyContent: 'center',
      }}
    >
      <ThemedIcon
        name="alert-circle"
        size={dimensions.icon.md}
        color="error"
        style={{ marginBottom: dimensions.layout.componentSpacing / 2 }}
      />
      
      <ThemedText
        variant="body"
        style={{
          textAlign: 'center',
          marginBottom: onRetry ? dimensions.layout.componentSpacing / 2 : 0,
          color: colors.text.secondary,
        }}
      >
        {message || t('errors.generic.message', 'Something went wrong')}
      </ThemedText>

      {onRetry && (
        <Button
          title={t('errors.retry', 'Try Again')}
          onPress={onRetry}
          variant="ghost"
          size="sm"
        />
      )}
    </ThemedView>
  );
}

export default {
  CameraErrorFallback,
  NetworkErrorFallback,
  MLModelErrorFallback,
  DataErrorFallback,
  PermissionErrorFallback,
  GenericErrorFallback,
};