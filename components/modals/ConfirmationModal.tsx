/**
 * Confirmation Modal Component
 * 
 * Simple confirmation dialog for user actions.
 * Uses centralized modal system for consistency.
 */

import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/ThemedText';
import { ThemedPressable } from '@/components/ThemedPressable';
import { ModernCard } from '@/components/ModernCard';
import type { ConfirmationModalProps } from '@/types/modal';
import { useUnifiedColors } from '@/hooks/useUnifiedColors';
import { useResponsiveDimensions } from '@/hooks/useResponsiveDimensions';

interface ConfirmationModalComponentProps extends ConfirmationModalProps {}

export const ConfirmationModal: React.FC<ConfirmationModalComponentProps> = ({
  title,
  message,
  confirmText,
  cancelText,
  variant = 'default',
  onConfirm,
  onClose,
}) => {
  const { t } = useTranslation();
  const colors = useUnifiedColors();
  const dimensions = useResponsiveDimensions();

  const handleConfirm = () => {
    onConfirm?.();
    onClose();
  };

  return (
    <View style={{
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      paddingHorizontal: dimensions.layout.screenPadding.horizontal,
    }}>
      <ModernCard style={{
        width: '100%',
        maxWidth: 400,
        padding: dimensions.card.padding.lg,
      }}>
        <ThemedText variant="h3" style={{
          marginBottom: dimensions.layout.componentSpacing,
          textAlign: 'center',
        }}>
          {title}
        </ThemedText>

        <ThemedText variant="body" color="secondary" style={{
          marginBottom: dimensions.layout.sectionSpacing,
          textAlign: 'center',
          lineHeight: 22,
        }}>
          {message}
        </ThemedText>

        <View style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          gap: dimensions.layout.componentSpacing,
        }}>
          <ThemedPressable
            variant="secondary"
            onPress={onClose}
            style={{ flex: 1 }}
          >
            <ThemedText variant="button">
              {cancelText || t('common.cancel')}
            </ThemedText>
          </ThemedPressable>
          
          <ThemedPressable
            variant={variant === 'destructive' ? 'secondary' : 'primary'}
            onPress={handleConfirm}
            style={{ flex: 1 }}
          >
            <ThemedText 
              variant="button" 
              color={variant === 'destructive' ? 'error' : 'primary'}
            >
              {confirmText || t('common.confirm')}
            </ThemedText>
          </ThemedPressable>
        </View>
      </ModernCard>
    </View>
  );
};