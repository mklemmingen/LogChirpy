import React, {useCallback, useEffect, useRef, useState} from 'react';
import {ActivityIndicator, Alert, BackHandler, StatusBar, StyleSheet, Text, View,} from 'react-native';
import {Stack, useFocusEffect, useRouter} from 'expo-router';
import {Camera, useCameraDevice, useCameraPermission, useMicrophonePermission,} from 'react-native-vision-camera';
import {useVideoPlayer, VideoSource, VideoView} from 'expo-video';
import {useTranslation} from 'react-i18next';
import {ThemedIcon} from '@/components/ThemedIcon';
import * as Haptics from 'expo-haptics';
import {BlurView} from 'expo-blur';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

// Modern components
import {ThemedView} from '@/components/ThemedView';
import {ThemedText} from '@/components/ThemedText';
import {ThemedPressable} from '@/components/ThemedPressable';
import {ModernCard} from '@/components/ModernCard';
import {EnhancedCameraControls} from '@/components/CameraControls';

// Modern theme hooks
import {useTheme, useTypography, useColors} from '@/hooks/useThemeColor';

// Context
import {useLogDraft} from '../context/LogDraftContext';

type RecordingState = 'idle' | 'recording' | 'stopping' | 'preview';

const AnimatedPressable = Animated.createAnimatedComponent(ThemedPressable);

// Recording Status Indicator Component
function RecordingStatusIndicator({ isRecording, duration }: { isRecording: boolean; duration: number }) {
  const typography = useTypography();
  const theme = useTheme();
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (isRecording) {
      pulse.value = withRepeat(
          withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          -1,
          true
      );
    } else {
      pulse.value = withTiming(0);
    }
  }, [isRecording]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.7, 1]),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [0.95, 1.05]) }],
  }));

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (!isRecording && duration === 0) return null;

  return (
      <Animated.View style={[styles.statusIndicator, animatedStyle]}>
        <BlurView
            intensity={80}
            tint="dark"
            style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.statusContent}>
          {isRecording && (
              <View style={[styles.recordingDot, { backgroundColor: theme.colors.text.secondary }]} />
          )}
          <Text style={{ color: 'white', fontWeight: '600' }}>
            {isRecording ? 'REC' : 'STOPPED'} {formatTime(duration)}
          </Text>
        </View>
      </Animated.View>
  );
}

// Permission Error Component
function PermissionError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();

  return (
      <ThemedView style={styles.centered}>
        <ModernCard elevated={false} bordered={true} style={styles.errorCard}>
          <View style={[styles.errorIcon]}>
            <ThemedIcon name="video-off" size={32} color="primary" />
          </View>

          <ThemedText variant="h2" style={styles.errorTitle}>
            {t('camera.permission_required')}
          </ThemedText>

          <ThemedText
              variant="bodyLarge"
              color="secondary"
              style={styles.errorMessage}
          >
            {t('camera.video_permission_message')}
          </ThemedText>

          <View style={styles.errorActions}>
            <ThemedPressable
                variant="secondary"
                style={styles.errorButton}
                onPress={() => useRouter().back()}
            >
              <ThemedText>{t('common.cancel')}</ThemedText>
            </ThemedPressable>

            <ThemedPressable
                variant="primary"
                style={styles.errorButton}
                onPress={onRetry}
            >
              <ThemedText color="primary">{t('camera.grant_permission')}</ThemedText>
            </ThemedPressable>
          </View>
        </ModernCard>
      </ThemedView>
  );
}

// Video Preview Component
function VideoPreview({
                        videoUri,
                        onRetake,
                        onConfirm,
                      }: {
  videoUri: string;
  onRetake: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  const colors = useColors();

  const player = useVideoPlayer(videoUri as VideoSource, (player) => {
    player.loop = true;
    player.play();
  });

  return (
      <ThemedView style={styles.container}>
        <StatusBar barStyle="light-content" />

        {/* Video Player */}
        <VideoView
            player={player}
            style={StyleSheet.absoluteFillObject}
            contentFit="contain"
            nativeControls={false}
        />

        {/* Header */}
        <View style={styles.previewHeader}>
          <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFillObject} />
          <ThemedText variant="h3" color="primary">
            {t('video.preview_title')}
          </ThemedText>
        </View>

        {/* Controls */}
        <View style={styles.previewControls}>
          <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFillObject} />

          <View style={styles.previewActions}>
            <AnimatedPressable
                variant="secondary"
                style={[styles.previewButton, { backgroundColor: colors.surface + '33' }]}
                onPress={onRetake}
            >
              <ThemedIcon name="refresh-cw" size={20} color="primary" />
              <Text style={[styles.buttonText, { color: 'white' }]}>
                {t('camera.retake')}
              </Text>
            </AnimatedPressable>

            <AnimatedPressable
                variant="primary"
                style={[styles.previewButton]}
                onPress={onConfirm}
            >
              <ThemedIcon name="check" size={20} color="primary" />
              <Text style={[styles.buttonText]}>
                {t('common.confirm')}
              </Text>
            </AnimatedPressable>
          </View>
        </View>
      </ThemedView>
  );
}

export default function VideoScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { update } = useLogDraft();
  const colors = useColors();

  // Permissions
  const { hasPermission: hasCameraPermission, requestPermission: requestCameraPermission } = useCameraPermission();
  const { hasPermission: hasMicPermission, requestPermission: requestMicPermission } = useMicrophonePermission();

  // State
  const [state, setState] = useState<RecordingState>('idle');
  const [recordingTime, setRecordingTime] = useState(0);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [cameraPosition, setCameraPosition] = useState<'front' | 'back'>('back');

  // Refs
  const cameraRef = useRef<Camera>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Device
  const device = useCameraDevice(cameraPosition);

  // Handle back button during recording
  useFocusEffect(
      useCallback(() => {
        const onBackPress = () => {
          if (state === 'recording') {
            Alert.alert(
                t('video.stop_recording_title'),
                t('video.stop_recording_message'),
                [
                  { text: t('common.continue'), style: 'cancel' },
                  {
                    text: t('video.stop_and_exit'),
                    style: 'destructive',
                    onPress: handleForceExit
                  },
                ]
            );
            return true;
          }
          return false;
        };

        const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => subscription.remove();
      }, [state, t])
  );

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Request permissions
  const requestPermissions = useCallback(async () => {
    const [cameraResult, micResult] = await Promise.all([
      requestCameraPermission(),
      requestMicPermission(),
    ]);

    if (!cameraResult || !micResult) {
      Alert.alert(
          t('camera.permission_required'),
          t('camera.video_permission_message')
      );
    }
  }, [requestCameraPermission, requestMicPermission, t]);

  // Start recording
  const startRecording = async () => {
    if (!cameraRef.current) return;

    setState('recording');
    setRecordingTime(0);

    // Start timer
    timerRef.current = setInterval(() => {
      setRecordingTime((prev) => prev + 1);
    }, 1000);

    try {
      await cameraRef.current.startRecording({
        flash: 'off',
        onRecordingFinished: (video) => {
          clearInterval(timerRef.current!);
          setState('preview');
          setVideoUri(video.path);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
        onRecordingError: (error) => {
          console.error('Recording error', error);
          clearInterval(timerRef.current!);
          setState('idle');
          Alert.alert(t('common.error'), t('video.recording_failed'));
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        },
      });

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (e) {
      console.error('Recording failed to start', e);
      clearInterval(timerRef.current!);
      setState('idle');
      Alert.alert(t('common.error'), t('video.recording_failed'));
    }
  };

  // Stop recording
  const stopRecording = async () => {
    if (!cameraRef.current) return;

    setState('stopping');

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    try {
      await cameraRef.current.stopRecording();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.error('Failed to stop recording:', error);
      setState('idle');
    }
  };

  // Handle recording toggle
  const handleCapture = () => {
    if (state === 'recording') {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Flip camera
  const flipCamera = () => {
    if (state !== 'recording') {
      setCameraPosition(prev => prev === 'back' ? 'front' : 'back');
      Haptics.selectionAsync();
    }
  };

  // Retake video
  const handleRetake = () => {
    setVideoUri(null);
    setRecordingTime(0);
    setState('idle');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // Confirm video
  const handleConfirm = () => {
    if (videoUri) {
      update({ videoUri });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push('/log/manual');
    }
  };

  // Force exit during recording
  const handleForceExit = async () => {
    await stopRecording();
    router.back();
  };

  // Permission check
  if (!hasCameraPermission || !hasMicPermission) {
    return <PermissionError onRetry={requestPermissions} />;
  }

  // Device check
  if (!device) {
    return (
        <ThemedView style={styles.centered}>
          <ActivityIndicator size="large" />
          <ThemedText variant="bodyLarge" color="secondary" style={{ marginTop: 16 }}>
            {t('camera.loading_screen')}
          </ThemedText>
        </ThemedView>
    );
  }

  // Show preview if video is captured
  if (state === 'preview' && videoUri) {
    return (
        <VideoPreview
            videoUri={videoUri}
            onRetake={handleRetake}
            onConfirm={handleConfirm}
        />
    );
  }

  // Main camera view
  return (
      <ThemedView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar barStyle="light-content" />

        {/* Camera */}
        <Camera
            ref={cameraRef}
            style={StyleSheet.absoluteFillObject}
            device={device}
            isActive={state !== 'preview'}
            video
            audio
        />

        {/* Recording Status */}
        <RecordingStatusIndicator
            isRecording={state === 'recording'}
            duration={recordingTime}
        />

        {/* Back Button */}
        <View style={styles.backButton}>
          <ThemedPressable
              variant="ghost"
              style={[styles.topButton, { backgroundColor: colors.background + '99' }]}
              onPress={() => router.back()}
              disabled={state === 'recording'}
          >
            <ThemedIcon name="arrow-left" size={24} color="primary" />
          </ThemedPressable>
        </View>

        {/* Camera Controls */}
        <View style={styles.controlBar}>
          <EnhancedCameraControls
              onCapture={handleCapture}
              onFlip={flipCamera}
              isRecording={state === 'recording'}
              isFlipDisabled={state === 'recording'}
              variant="glass"
              size="large"
          />
        </View>

        {/* Loading Overlay */}
        {state === 'stopping' && (
            <View style={styles.loadingOverlay}>
              <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFillObject} />
              <ActivityIndicator size="large" color="white" />
              <ThemedText variant="bodyLarge" color="primary" style={{ marginTop: 16 }}>
                {t('video.processing')}
              </ThemedText>
            </View>
        )}
      </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },

  // Status Indicator
  statusIndicator: {
    position: 'absolute',
    top: 60,
    right: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 10,
    overflow: 'hidden',
  },
  statusContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // Permission Error
  errorCard: {
    alignItems: 'center',
    padding: 32,
    maxWidth: 350,
  },
  errorIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  errorTitle: {
    textAlign: 'center',
    marginBottom: 12,
  },
  errorMessage: {
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  errorActions: {
    flexDirection: 'row',
    gap: 16,
    width: '100%',
  },
  errorButton: {
    flex: 1,
  },

  // Navigation
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 10,
  },
  topButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Controls
  controlBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },

  // Preview
  previewHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 24,
    zIndex: 10,
    overflow: 'hidden',
  },
  previewControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 40,
    paddingTop: 20,
    paddingHorizontal: 24,
    overflow: 'hidden',
  },
  previewActions: {
    flexDirection: 'row',
    gap: 16,
  },
  previewButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    gap: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },

  // Loading
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
});