/**
 * Video Recording Screen
 * 
 * Minimal video recorder using native camera API.
 * Simple interface with just a record button that launches the phone's built-in camera.
 */

import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { launchCamera, MediaType, ImagePickerResponse } from 'react-native-image-picker';
import * as Haptics from 'expo-haptics';

// Components
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedPressable } from '@/components/ThemedPressable';
import { ThemedIcon } from '@/components/ThemedIcon';
import { ThemedSafeAreaView } from '@/components/ThemedSafeAreaView';
import { useSnackbar } from '@/components/ThemedSnackbar';

// Context and Services
import { useLogDraft } from '@/contexts/LogDraftContext';
import { photoStorageService } from '@/services/photoStorageService';
import { filePathToUri } from '@/services/uriUtils';

// Theme
import { useColors } from '@/hooks/useThemeColor';

export default function VideoScreen() {
  const { t } = useTranslation();
  const { update } = useLogDraft();
  const { SnackbarComponent, showSuccess, showError } = useSnackbar();
  const colors = useColors();
  
  const [isProcessing, setIsProcessing] = useState(false);

  const handleVideoSave = useCallback(async (videoUri: string) => {
    setIsProcessing(true);
    
    try {
      const formattedUri = filePathToUri(videoUri);
      const result = await photoStorageService.savePhoto(formattedUri, {
        saveToDevice: true,
        addMetadata: true
      });

      if (result.success) {
        update({ videoUri: result.appUri });
        showSuccess(t('video.saved_successfully', 'Video saved successfully'));
        // Auto-navigate to manual entry after successful save
        setTimeout(() => {
          const router = require('expo-router').router;
          router.replace('/log/manual');
        }, 1000);
      } else {
        throw new Error(result.error || 'Save failed');
      }
    } catch (error) {
      console.error('Video save failed:', error);
      showError(t('video.save_failed', 'Failed to save video'));
    } finally {
      setIsProcessing(false);
    }
  }, [update, showSuccess, showError, t]);

  const handleRecord = useCallback(async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const options = {
        mediaType: 'video' as MediaType,
        videoQuality: 'high' as const,
        durationLimit: 60, // 60 seconds max
        saveToPhotos: false, // We'll save it ourselves
        includeBase64: false,
        includeExtra: false,
      };

      launchCamera(options, (response: ImagePickerResponse) => {
        if (response.didCancel) {
          console.log('User cancelled video recording');
          return;
        }

        if (response.errorMessage) {
          console.error('Video recording error:', response.errorMessage);
          showError(t('video.recording_failed', 'Failed to record video'));
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          return;
        }

        if (response.assets && response.assets[0]?.uri) {
          handleVideoSave(response.assets[0].uri);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          showError(t('video.no_video_captured', 'No video was captured'));
        }
      });
    } catch (error) {
      console.error('Launch camera failed:', error);
      showError(t('video.camera_launch_failed', 'Failed to launch camera'));
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [showError, showSuccess, t, handleVideoSave]);

  // Processing screen
  if (isProcessing) {
    return (
      <ThemedSafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.processingContainer}>
          <ThemedIcon name="video" size={64} color="primary" />
          <ThemedText variant="h3" style={styles.processingText}>
            {t('video.saving', 'Saving video...')}
          </ThemedText>
        </View>
      </ThemedSafeAreaView>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ThemedView style={styles.container}>
        
        {/* Main content */}
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <ThemedIcon name="video" size={120} color="primary" />
          </View>
          
          <ThemedText variant="h2" style={styles.title}>
            {t('video.record_title', 'Record Video')}
          </ThemedText>
          
          <ThemedText variant="body" color="secondary" style={styles.description}>
            {t('video.record_description', 'Tap the button below to record a video using your camera')}
          </ThemedText>
        </View>

        {/* Record button */}
        <View style={styles.buttonContainer}>
          <ThemedPressable
            variant="primary"
            onPress={handleRecord}
            disabled={isProcessing}
            style={[
              styles.recordButton,
              { backgroundColor: colors.primary }
            ]}
          >
            <ThemedIcon name="video" size={32} color="inverse" />
            <ThemedText variant="h3" color="inverse" style={styles.recordText}>
              {t('video.record_button', 'Record Video')}
            </ThemedText>
          </ThemedPressable>
        </View>

        <SnackbarComponent />
      </ThemedView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  iconContainer: {
    marginBottom: 32,
  },
  title: {
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 280,
  },
  buttonContainer: {
    padding: 32,
    paddingBottom: 50,
  },
  recordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 32,
    borderRadius: 16,
    gap: 12,
  },
  recordText: {
    fontWeight: '600',
  },
  
  // Processing screen
  processingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
  },
  processingText: {
    textAlign: 'center',
  },
});