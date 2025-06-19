/**
 * Professional Photo Capture Screen using react-native-camera-kit
 * 
 * Uses the Camera component with professional UI controls
 * and custom save paths to gallery.
 */

import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
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

export default function PhotoScreen() {
  const { t } = useTranslation();
  const { update } = useLogDraft();
  const { showSuccess, showError } = useSnackbar();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  
  // State
  const [cameraType, setCameraType] = useState<CameraType>(CameraType.Back);
  const [flashMode, setFlashMode] = useState<'auto' | 'on' | 'off'>('auto');
  
  // Refs
  const cameraRef = useRef<any>(null);

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

  // Handle photo capture
  const handlePhotoCapture = useCallback(async () => {
    if (!cameraRef.current) return;

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      // Capture photo
      const result = await cameraRef.current.capture({
        quality: 0.8,
      });
      
      if (result && result.uri) {
        // Ensure gallery directory exists
        const galleryDir = await ensureGalleryDirectory();
        
        // Generate filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `logchirpy_photo_${timestamp}_${Date.now()}.jpg`;
        const destPath = `${galleryDir}${filename}`;

        // Copy photo to gallery using RNFS for better reliability
        try {
          await RNFS.copyFile(result.uri.replace('file://', ''), destPath);
        } catch (rnfsError) {
          // Fallback to Expo FileSystem
          await FileSystem.copyAsync({
            from: result.uri,
            to: destPath
          });
        }

        // Update context with the new photo
        update({ imageUri: destPath });

        // Show success feedback
        showSuccess(t('photo.photo_saved') || 'Photo saved');

        // Navigate to manual entry
        router.push('/log/manual');
      }
    } catch (error) {
      console.error('Photo capture failed:', error);
      showError(t('photo.capture_failed') || 'Failed to save photo');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [update, showSuccess, showError, t]);

  // Handle cancel/back
  const handleCancel = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, []);

  // Toggle camera
  const toggleCamera = useCallback(() => {
    setCameraType(prev => prev === CameraType.Back ? CameraType.Front : CameraType.Back);
    Haptics.selectionAsync();
  }, []);

  // Toggle flash
  const toggleFlash = useCallback(() => {
    const flashModes: ('auto' | 'on' | 'off')[] = ['off', 'auto', 'on'];
    const currentIndex = flashModes.indexOf(flashMode);
    const nextIndex = (currentIndex + 1) % flashModes.length;
    setFlashMode(flashModes[nextIndex]);
    Haptics.selectionAsync();
  }, [flashMode]);

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

        {/* Top Controls */}
        <View style={[styles.topControls, { paddingTop: insets.top + 12 }]}>
          <Pressable
            style={styles.controlButton}
            onPress={handleCancel}
          >
            <ThemedIcon name="x" size={24} color="primary" />
          </Pressable>

          <ThemedText style={styles.modeText}>Photo</ThemedText>

          <Pressable
            style={styles.controlButton}
            onPress={toggleFlash}
          >
            <ThemedIcon name={getFlashIcon()} size={24} color="primary" />
          </Pressable>
        </View>

        {/* Bottom Controls */}
        <View style={[styles.bottomControls, { paddingBottom: insets.bottom + 20 }]}>
          <Pressable
            style={styles.sideButton}
            onPress={() => router.push('/(tabs)/gallery')}
          >
            <ThemedIcon name="image" size={24} color="primary" />
          </Pressable>

          {/* Capture Button */}
          <Pressable
            style={styles.captureButton}
            onPress={handlePhotoCapture}
          >
            <View style={styles.captureInner} />
          </Pressable>

          <Pressable
            style={styles.sideButton}
            onPress={toggleCamera}
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
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  captureInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
});