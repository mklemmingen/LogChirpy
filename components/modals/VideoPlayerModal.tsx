/**
 * Video Player Modal Component
 * 
 * Simplified modal for video playback.
 * Uses centralized modal system for better performance.
 */

import React from 'react';
import { View } from 'react-native';
import { VideoView } from 'expo-video';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/ThemedText';
import { ThemedPressable } from '@/components/ThemedPressable';
import { ThemedIcon } from '@/components/ThemedIcon';
import type { VideoPlayerModalProps } from '@/types/modal';
import { useUnifiedColors } from '@/hooks/useUnifiedColors';
import { useResponsiveDimensions } from '@/hooks/useResponsiveDimensions';

interface VideoPlayerModalComponentProps extends VideoPlayerModalProps {}

export const VideoPlayerModal: React.FC<VideoPlayerModalComponentProps> = ({
  videoPlayer,
  onClose,
  onRetake,
}) => {
  const { t } = useTranslation();
  const colors = useUnifiedColors();
  const dimensions = useResponsiveDimensions();

  return (
    <View style={{
      flex: 1,
      backgroundColor: 'black',
      justifyContent: 'center',
      alignItems: 'center',
    }}>
      {videoPlayer && (
        <VideoView
          player={videoPlayer}
          style={{
            width: '100%',
            height: '100%',
          }}
          contentFit="contain"
          nativeControls
        />
      )}

      <View style={{
        position: 'absolute',
        bottom: dimensions.layout.screenPadding.vertical,
        left: dimensions.layout.screenPadding.horizontal,
        right: dimensions.layout.screenPadding.horizontal,
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: dimensions.layout.componentSpacing,
      }}>
        <ThemedPressable
          variant="secondary"
          onPress={onClose}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: dimensions.layout.componentSpacing / 2,
          }}
        >
          <ThemedIcon name="x" size={20} color="primary" />
          <ThemedText variant="button">
            {t('common.close')}
          </ThemedText>
        </ThemedPressable>

        {onRetake && (
          <ThemedPressable
            variant="primary"
            onPress={() => {
              onClose();
              onRetake();
            }}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: dimensions.layout.componentSpacing / 2,
            }}
          >
            <ThemedIcon name="refresh-cw" size={20} color="primary" />
            <ThemedText variant="button" color="primary">
              {t('camera.retake')}
            </ThemedText>
          </ThemedPressable>
        )}
      </View>
    </View>
  );
};