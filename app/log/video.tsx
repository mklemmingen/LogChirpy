/**
 * Video Recording Screen
 * 
 * Clean, memory-efficient video recorder with only essential features:
 * - Record button
 * - Camera flip button  
 * - Pinch-to-zoom (native camera feature)
 * - Recording timer
 */

import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { CameraType, CameraView, useCameraPermissions } from 'expo-camera';
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
  const [permission, requestPermission] = useCameraPermissions();
  const colors = useColors();
  
  const cameraRef = useRef<CameraView>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Minimal state - only what's essential
  const [facing, setFacing] = useState<CameraType>('back');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
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
        router.replace('/log/manual');
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
    if (!cameraRef.current) return;

    if (isRecording) {
      // Stop recording
      try {
        await cameraRef.current.stopRecording();
      } catch (error) {
        console.error('Stop recording failed:', error);
      }
    } else {
      // Start recording
      setIsRecording(true);
      setRecordingTime(0);
      
      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        const video = await cameraRef.current.recordAsync({
          maxDuration: 60, // 60 seconds max
        });

        if (video?.uri) {
          await handleVideoSave(video.uri);
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } catch (error) {
        console.error('Recording failed:', error);
        showError(t('video.recording_failed', 'Failed to record video'));
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } finally {
        setIsRecording(false);
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      }
    }
  }, [isRecording, showError, t, handleVideoSave]);

  const toggleCamera = useCallback(() => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
    Haptics.selectionAsync();
  }, []);

  const handleBack = useCallback(() => {
    // Clean up timer if running
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    router.back();
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Permission screen
  if (!permission?.granted) {
    return (
      <ThemedSafeAreaView style={styles.container}>
        <View style={styles.permissionContainer}>
          <ThemedIcon name="camera-off" size={48} color="primary" />
          <ThemedText variant="h2" style={styles.permissionTitle}>
            {t('camera.permission_required', 'Camera Permission Required')}
          </ThemedText>
          <ThemedText variant="body" color="secondary" style={styles.permissionMessage}>
            {t('camera.permission_message', 'LogChirpy needs camera access to record videos')}
          </ThemedText>
          <View style={styles.permissionActions}>
            <ThemedPressable variant="secondary" onPress={handleBack} style={styles.button}>
              <ThemedText>{t('common.cancel', 'Cancel')}</ThemedText>
            </ThemedPressable>
            <ThemedPressable variant="primary" onPress={requestPermission} style={styles.button}>
              <ThemedText color="inverse">{t('camera.grant_permission', 'Grant Permission')}</ThemedText>
            </ThemedPressable>
          </View>
        </View>
      </ThemedSafeAreaView>
    );
  }

  // Processing screen
  if (isProcessing) {
    return (
      <ThemedSafeAreaView style={styles.container}>
        <View style={styles.processingContainer}>
          <ThemedText variant="h3">{t('video.saving', 'Saving video...')}</ThemedText>
        </View>
      </ThemedSafeAreaView>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ThemedView style={styles.container}>
        {/* Camera with pinch-to-zoom enabled by default */}
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={facing}
          mode="video"
        />

        {/* Back button */}
        <ThemedPressable
          variant="ghost"
          onPress={handleBack}
          style={[styles.backButton, { backgroundColor: colors.background + 'CC' }]}
        >
          <ThemedIcon name="arrow-left" size={24} color="inverse" />
        </ThemedPressable>

        {/* Recording indicator */}
        {isRecording && (
          <View style={[styles.recordingIndicator, { backgroundColor: colors.background + 'DD' }]}>
            <View style={styles.recordingDot} />
            <ThemedText style={[styles.recordingText, { color: colors.text }]}>
              REC {formatTime(recordingTime)}
            </ThemedText>
          </View>
        )}

        {/* Bottom controls */}
        <View style={styles.controls}>
          {/* Camera flip button */}
          <ThemedPressable
            variant="ghost"
            onPress={toggleCamera}
            disabled={isRecording}
            style={[
              styles.controlButton, 
              { backgroundColor: colors.background + 'CC' },
              ...(isRecording ? [styles.disabled] : [])
            ]}
          >
            <ThemedIcon name="rotate-ccw" size={24} color="inverse" />
          </ThemedPressable>

          {/* Record button */}
          <ThemedPressable
            variant="ghost"
            onPress={handleRecord}
            style={[
              styles.recordButton,
              { 
                backgroundColor: colors.background,
                borderColor: colors.border + '80'
              },
              ...(isRecording ? [{ backgroundColor: '#FF3B30' }] : [])
            ]}
          >
            <View style={[
              styles.recordInner,
              { backgroundColor: isRecording ? colors.background : '#FF3B30' },
              ...(isRecording ? [styles.recordingInner] : [])
            ]} />
          </ThemedPressable>

          {/* Spacer for symmetry */}
          <View style={[styles.controlButton, { backgroundColor: 'transparent' }]} />
        </View>
      </ThemedView>
      <SnackbarComponent />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },

  // Permission screen
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 24,
  },
  permissionTitle: {
    textAlign: 'center',
  },
  permissionMessage: {
    textAlign: 'center',
    lineHeight: 24,
  },
  permissionActions: {
    flexDirection: 'row',
    gap: 16,
    width: '100%',
    maxWidth: 300,
  },

  // Processing screen
  processingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Camera controls - theme colors applied dynamically
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },

  recordingIndicator: {
    position: 'absolute',
    top: 60,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 10,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B30', // Keep red for recording indicator
    marginRight: 8,
  },
  recordingText: {
    fontWeight: '600',
    fontSize: 14,
  },

  controls: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 40,
    zIndex: 10,
  },

  controlButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },

  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
  },
  recordInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  recordingInner: {
    width: 30,
    height: 30,
    borderRadius: 4,
  },

  button: {
    flex: 1,
  },
  disabled: {
    opacity: 0.5,
  },
});