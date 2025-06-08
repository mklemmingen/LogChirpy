/**
 * Photo Preview Modal Component
 * 
 * Simplified modal for photo preview with detection overlays.
 * Uses centralized modal system for better performance.
 */

import React from 'react';
import { View, Image, Dimensions } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ThemedPressable } from '@/components/ThemedPressable';
import { ThemedText } from '@/components/ThemedText';
import type { PhotoPreviewModalProps } from '@/types/modal';
import { useUnifiedColors } from '@/hooks/useUnifiedColors';
import { useResponsiveDimensions } from '@/hooks/useResponsiveDimensions';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface PhotoPreviewModalComponentProps extends PhotoPreviewModalProps {}

export const PhotoPreviewModal: React.FC<PhotoPreviewModalComponentProps> = ({
  imageUri,
  detections = [],
  onClose,
}) => {
  const { t } = useTranslation();
  const colors = useUnifiedColors();
  const dimensions = useResponsiveDimensions();

  // Simple confidence-based color for detection boxes
  const getBoxColor = (confidence: number) => {
    const hue = Math.round(confidence * 120); // 0 = red, 120 = green
    return `hsl(${hue}, 100%, 50%)`;
  };

  return (
    <View style={{
      flex: 1,
      backgroundColor: 'black',
      justifyContent: 'center',
      alignItems: 'center',
    }}>
      <Image 
        source={{ uri: imageUri }} 
        style={{
          width: screenWidth,
          height: screenHeight,
          resizeMode: 'contain',
        }}
      />

      {/* Detection Overlays */}
      {detections.length > 0 && (
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: screenWidth,
          height: screenHeight,
        }}>
          {detections.map((detection, index) => {
            const { origin, size } = detection.frame;
            const label = detection.labels[0];
            const confidence = label?.confidence ?? 0;
            const color = getBoxColor(confidence);

            return (
              <View
                key={index}
                style={{
                  position: 'absolute',
                  left: origin.x,
                  top: origin.y,
                  width: size.x,
                  height: size.y,
                  borderWidth: 2,
                  borderColor: color,
                  backgroundColor: `${color}20`, // 20% opacity
                }}
              />
            );
          })}
        </View>
      )}

      {/* Close Button */}
      <View style={{
        position: 'absolute',
        bottom: dimensions.layout.screenPadding.vertical,
        left: dimensions.layout.screenPadding.horizontal,
        right: dimensions.layout.screenPadding.horizontal,
        alignItems: 'center',
      }}>
        <ThemedPressable
          variant="secondary"
          onPress={onClose}
          style={{
            paddingHorizontal: dimensions.card.padding.lg,
            paddingVertical: dimensions.layout.componentSpacing,
          }}
        >
          <ThemedText variant="button">
            {t('common.close')}
          </ThemedText>
        </ThemedPressable>
      </View>
    </View>
  );
};