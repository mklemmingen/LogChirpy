/**
 * Bird Predictions Modal Component
 * 
 * Simplified modal for displaying bird identification results.
 * Uses centralized modal system for better view hierarchy management.
 */

import React from 'react';
import { View, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/ThemedText';
import { ThemedPressable } from '@/components/ThemedPressable';
import { ThemedIcon } from '@/components/ThemedIcon';
import { ModernCard } from '@/components/ModernCard';
import type { BirdPredictionsModalProps } from '@/types/modal';
import { useUnifiedColors } from '@/hooks/useUnifiedColors';
import { useResponsiveDimensions } from '@/hooks/useResponsiveDimensions';
import { BirdNetService } from '@/services/birdNetService';

interface BirdPredictionsModalComponentProps extends BirdPredictionsModalProps {}

export const BirdPredictionsModal: React.FC<BirdPredictionsModalComponentProps> = ({
  predictions,
  onSelectPrediction,
  onClose,
}) => {
  const { t } = useTranslation();
  const colors = useUnifiedColors();
  const dimensions = useResponsiveDimensions();

  const handleSelectPrediction = (prediction: any) => {
    onSelectPrediction(prediction);
    onClose();
  };

  return (
    <View style={{
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: dimensions.layout.screenPadding.horizontal,
      paddingVertical: dimensions.layout.screenPadding.vertical,
    }}>
      <ModernCard style={{
        width: '100%',
        maxWidth: 500,
        maxHeight: '80%',
        padding: dimensions.card.padding.lg,
      }}>
        {/* Header */}
        <View style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: dimensions.layout.componentSpacing,
        }}>
          <ThemedText variant="h3">
            {t('birdnet.predictions_title', 'Bird Identification Results')}
          </ThemedText>
          
          <ThemedPressable
            onPress={onClose}
            style={{
              padding: dimensions.layout.componentSpacing / 2,
              borderRadius: dimensions.card.borderRadius.sm,
            }}
          >
            <ThemedIcon name="x" size={24} color="primary" />
          </ThemedPressable>
        </View>

        {/* Predictions List */}
        <ScrollView 
          style={{ 
            flex: 1,
            marginHorizontal: -dimensions.layout.componentSpacing / 2,
          }}
          showsVerticalScrollIndicator={false}
        >
          {predictions.map((prediction, index) => (
            <ThemedPressable
              key={index}
              style={{
                backgroundColor: colors.background.tertiary,
                borderRadius: dimensions.card.borderRadius.md,
                padding: dimensions.layout.componentSpacing,
                marginBottom: dimensions.layout.componentSpacing / 2,
                marginHorizontal: dimensions.layout.componentSpacing / 2,
              }}
              onPress={() => handleSelectPrediction(prediction)}
            >
              <View style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <View style={{ flex: 1 }}>
                  <ThemedText variant="body" style={{
                    marginBottom: dimensions.layout.componentSpacing / 4,
                  }}>
                    {prediction.common_name}
                  </ThemedText>
                  <ThemedText variant="bodySmall" color="secondary">
                    {prediction.scientific_name}
                  </ThemedText>
                </View>
                
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: dimensions.layout.componentSpacing / 2,
                }}>
                  <ThemedText variant="label" color="primary">
                    {BirdNetService.formatConfidenceScore(prediction.confidence)}
                  </ThemedText>
                  <ThemedIcon name="chevron-right" size={20} color="secondary" />
                </View>
              </View>
            </ThemedPressable>
          ))}
        </ScrollView>

        {/* Footer */}
        <View style={{
          marginTop: dimensions.layout.componentSpacing,
          paddingTop: dimensions.layout.componentSpacing,
          borderTopWidth: 1,
          borderTopColor: colors.border.primary,
        }}>
          <ThemedText variant="bodySmall" color="secondary" style={{
            textAlign: 'center',
            lineHeight: 18,
          }}>
            {t('birdnet.disclaimer', 'Tap a prediction to select it. Results are AI-generated and may not be 100% accurate.')}
          </ThemedText>
        </View>
      </ModernCard>
    </View>
  );
};