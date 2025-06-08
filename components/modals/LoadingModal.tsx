/**
 * Loading Modal Component
 * 
 * Simple loading indicator modal with optional progress.
 * Uses centralized modal system for consistency.
 */

import React from 'react';
import { View, ActivityIndicator } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { ModernCard } from '@/components/ModernCard';
import type { LoadingModalProps } from '@/types/modal';
import { useUnifiedColors } from '@/hooks/useUnifiedColors';
import { useResponsiveDimensions } from '@/hooks/useResponsiveDimensions';

interface LoadingModalComponentProps extends LoadingModalProps {}

export const LoadingModal: React.FC<LoadingModalComponentProps> = ({
  message,
  progress,
}) => {
  const colors = useUnifiedColors();
  const dimensions = useResponsiveDimensions();

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
        maxWidth: 300,
        padding: dimensions.card.padding.lg,
        alignItems: 'center',
      }}>
        <ActivityIndicator 
          size="large" 
          color={colors.interactive.primary} 
          style={{
            marginBottom: dimensions.layout.componentSpacing,
          }}
        />

        <ThemedText variant="body" style={{
          textAlign: 'center',
          marginBottom: progress !== undefined ? dimensions.layout.componentSpacing : 0,
        }}>
          {message}
        </ThemedText>

        {progress !== undefined && (
          <View style={{
            width: '100%',
            height: 4,
            backgroundColor: colors.background.tertiary,
            borderRadius: 2,
            overflow: 'hidden',
          }}>
            <View style={{
              width: `${Math.min(100, Math.max(0, progress))}%`,
              height: '100%',
              backgroundColor: colors.interactive.primary,
            }} />
          </View>
        )}
      </ModernCard>
    </View>
  );
};