/**
 * Professional Video Recording Screen using react-native-camera-kit
 * 
 * Uses the Camera component with professional video recording controls
 * and custom save paths to gallery.
 */

import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, View, Pressable, Text } from 'react-native';
import { router, Stack } from 'expo-router';
import { Camera, CameraType } from 'react-native-camera-kit';
import { useTranslation } from 'react-i18next';
import * as FileSystem from 'expo-file-system';
import RNFS from 'react-native-fs';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Context
import { useLogDraft } from '@/contexts/LogDraftContext';
import { useSnackbar } from '@/components/ThemedSnackbar';
import { ThemedIcon } from '@/components/ThemedIcon';
import { ThemedText } from '@/components/ThemedText';
import { useColors } from '@/hooks/useThemeColor';

export default function VideoScreen() {
  const { t } = useTranslation();
  const { update } = useLogDraft();
  const { showSuccess, showError } = useSnackbar();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  
  // State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [cameraType, setCameraType] = useState<CameraType>(CameraType.Back);
  const [flashMode, setFlashMode] = useState<'auto' | 'on' | 'off'>('auto');
  
  // Refs
  const cameraRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Ensure gallery directory exists
  const ensureGalleryDirectory = async () => {
    const galleryDir = `${RNFS.DocumentDirectoryPath}/gallery/`;
    try {
      const dirExists = await RNFS.exists(galleryDir);
      if (!dirExists) {
        await RNFS.mkdir(galleryDir);
      }
      return galleryDir;
    } catch (error) {
      console.error('Failed to create gallery directory:', error);
      // Fallback to expo FileSystem
      const expoGalleryDir = `${FileSystem.documentDirectory}gallery/`;
      const dirInfo = await FileSystem.getInfoAsync(expoGalleryDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(expoGalleryDir, { intermediates: true });
      }
      return expoGalleryDir;
    }
  };

  // Start recording
  const startRecording = useCallback(async () => {
    if (!cameraRef.current || isRecording) return;

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      setIsRecording(true);
      setRecordingTime(0);
      
      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      // Start recording
      const result = await cameraRef.current.recordVideo({
        maxDuration: 60, // 60 seconds max
      });

      // Recording finished
      if (result && result.uri) {
        await handleVideoSave(result.uri);
      }
    } catch (error) {
      console.error('Recording failed:', error);
      showError(t('video.recording_failed') || 'Recording failed');
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [isRecording, showError, t]);

  // Stop recording
  const stopRecording = useCallback(async () => {
    if (!cameraRef.current || !isRecording) return;

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      await cameraRef.current.stopRecording();
    } catch (error) {
      console.error('Stop recording failed:', error);
    }
  }, [isRecording]);

  // Handle video save
  const handleVideoSave = useCallback(async (uri: string) => {
    try {
      // Ensure gallery directory exists
      const galleryDir = await ensureGalleryDirectory();
      
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `logchirpy_video_${timestamp}_${Date.now()}.mp4`;
      const destPath = `${galleryDir}${filename}`;

      // Copy video to gallery using RNFS for better reliability
      try {
        await RNFS.copyFile(uri.replace('file://', ''), destPath);
      } catch (rnfsError) {
        // Fallback to Expo FileSystem
        await FileSystem.copyAsync({
          from: uri,
          to: destPath
        });
      }

      // Update context with the new video
      update({ videoUri: destPath });

      // Show success feedback
      showSuccess(t('video.video_saved') || 'Video saved');

      // Navigate to manual entry
      router.push('/log/manual');
    } catch (error) {
      console.error('Video save failed:', error);
      showError(t('video.save_failed') || 'Failed to save video');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [update, showSuccess, showError, t]);

  // Toggle camera
  const toggleCamera = useCallback(() => {
    if (!isRecording) {
      setCameraType(prev => prev === CameraType.Back ? CameraType.Front : CameraType.Back);
      Haptics.selectionAsync();
    }
  }, [isRecording]);

  // Toggle flash
  const toggleFlash = useCallback(() => {
    if (!isRecording) {
      const flashModes: ('auto' | 'on' | 'off')[] = ['off', 'auto', 'on'];
      const currentIndex = flashModes.indexOf(flashMode);
      const nextIndex = (currentIndex + 1) % flashModes.length;
      setFlashMode(flashModes[nextIndex]);
      Haptics.selectionAsync();
    }
  }, [flashMode, isRecording]);

  // Handle toggle recording
  const handleToggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  // Handle cancel/back
  const handleCancel = useCallback(async () => {
    if (isRecording) {
      await stopRecording();
    }
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [isRecording, stopRecording]);

  // Format recording time
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Get flash icon
  const getFlashIcon = () => {
    switch (flashMode) {
      case 'on': return 'zap';
      case 'auto': return 'zap';
      case 'off': return 'zap-off';
      default: return 'zap-off';
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        {/* Camera */}
        <Camera
          ref={cameraRef}
          style={StyleSheet.absoluteFillObject}
          cameraType={cameraType}
          flashMode={flashMode}
          focusMode="on"
          zoomMode="on"
        />

        {/* Recording Indicator */}
        {isRecording && (
          <View style={[styles.recordingIndicator, { top: insets.top + 20 }]}>
            <View style={styles.recordingDot} />
            <ThemedText style={styles.recordingText}>
              REC {formatTime(recordingTime)}
            </ThemedText>
          </View>
        )}

        {/* Top Controls */}
        <View style={[styles.topControls, { paddingTop: insets.top + 12 }]}>
          <Pressable
            style={styles.controlButton}
            onPress={handleCancel}
            disabled={isRecording}
          >
            <ThemedIcon name="x" size={24} color="primary" />
          </Pressable>

          <ThemedText style={styles.modeText}>Video</ThemedText>

          <Pressable
            style={[styles.controlButton, isRecording && styles.disabledButton]}
            onPress={toggleFlash}
            disabled={isRecording}
          >
            <ThemedIcon name={getFlashIcon()} size={24} color="primary" />
          </Pressable>
        </View>

        {/* Bottom Controls */}
        <View style={[styles.bottomControls, { paddingBottom: insets.bottom + 20 }]}>
          <Pressable
            style={[styles.sideButton, isRecording && styles.disabledButton]}
            onPress={() => router.push('/(tabs)/gallery')}
            disabled={isRecording}
          >
            <ThemedIcon name="image" size={24} color="primary" />
          </Pressable>

          {/* Record Button */}
          <Pressable
            style={[
              styles.recordButton,
              isRecording && styles.recordingButton
            ]}
            onPress={handleToggleRecording}
          >
            <View style={[
              styles.recordInner,
              isRecording && styles.recordingInner
            ]} />
          </Pressable>

          <Pressable
            style={[styles.sideButton, isRecording && styles.disabledButton]}
            onPress={toggleCamera}
            disabled={isRecording}
          >
            <ThemedIcon name="rotate-ccw" size={24} color="primary" />
          </Pressable>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  
  // Recording Indicator
  recordingIndicator: {
    position: 'absolute',
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 0, 0, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    zIndex: 10,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'white',
    marginRight: 8,
  },
  recordingText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },

  // Top Controls
  topControls: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    zIndex: 10,
  },
  modeText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  disabledButton: {
    opacity: 0.5,
  },

  // Bottom Controls
  bottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 20,
    zIndex: 10,
  },
  sideButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  recordingButton: {
    backgroundColor: '#FF3B30',
  },
  recordInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FF3B30',
  },
  recordingInner: {
    width: 30,
    height: 30,
    borderRadius: 4,
    backgroundColor: 'white',
  },
});