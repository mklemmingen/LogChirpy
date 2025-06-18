import React, {useCallback, useEffect, useRef, useState} from 'react';
import {ActivityIndicator, Alert, BackHandler, StatusBar, StyleSheet, Text, View,} from 'react-native';
import {router, Stack, useFocusEffect, useRouter} from 'expo-router';
import {CameraType, CameraView, useCameraPermissions, useMicrophonePermissions} from 'expo-camera';
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
// import {EnhancedCameraControls} from '@/components/CameraControls';
import {BackButton} from '@/components/BackButton';

// Modern theme hooks
import {useColors, useTheme, useTypography} from '@/hooks/useThemeColor';

// Context
import {useLogDraft} from '@/contexts/LogDraftContext';

type RecordingState = 'idle' | 'recording' | 'stopping' | 'preview';

const AnimatedPressable = Animated.createAnimatedComponent(ThemedPressable);

// Recording Status Indicator Component
function RecordingStatusIndicator({ isRecording, duration }: { isRecording: boolean; duration: number }) {
  const { t } = useTranslation();
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
            {isRecording ? t('video.recording_status_rec') : t('video.recording_status_stopped')} {formatTime(duration)}
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
                onPress={() => router.back()}
            >
              <ThemedText>{t('common.cancel')}</ThemedText>
            </ThemedPressable>

            <ThemedPressable
                variant="primary"
                style={styles.errorButton}
                onPress={onRetry}
            >
              <ThemedText color="inverse">{t('camera.grant_permission')}</ThemedText>
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
              <ThemedIcon name="check" size={20} color="inverse" />
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
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();

  // State
  const [state, setState] = useState<RecordingState>('idle');
  const [recordingTime, setRecordingTime] = useState(0);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [facing, setFacing] = useState<CameraType>('back');
  const [isRecording, setIsRecording] = useState(false);
  const [flash, setFlash] = useState<'off' | 'on' | 'auto'>('off');
  const [zoom, setZoom] = useState(0);

  // Refs
  const cameraRef = useRef<CameraView>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check if we have both permissions
  const hasPermissions = cameraPermission?.granted && micPermission?.granted;

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

  // Memoize permission functions to prevent excessive calls
  const stableRequestCameraPermission = useRef(requestCameraPermission);
  const stableRequestMicPermission = useRef(requestMicPermission);

  // Update refs when functions change
  useEffect(() => {
    stableRequestCameraPermission.current = requestCameraPermission;
    stableRequestMicPermission.current = requestMicPermission;
  }, [requestCameraPermission, requestMicPermission]);

  // Request permissions
  const requestPermissions = useCallback(async () => {
    try {
      await requestCameraPermission();
      await requestMicPermission();
    } catch (error) {
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
    setIsRecording(true);
    setRecordingTime(0);

    // Start timer
    timerRef.current = setInterval(() => {
      setRecordingTime((prev) => prev + 1);
    }, 1000);

    try {
      const video = await cameraRef.current.recordAsync({
        maxDuration: 60, // 60 seconds max
      });

      // Recording finished
      if (video && video.uri) {
        clearInterval(timerRef.current!);
        setState('preview');
        setIsRecording(false);
        setVideoUri(video.uri);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Recording error', error);
      clearInterval(timerRef.current!);
      setState('idle');
      setIsRecording(false);
      Alert.alert(t('common.error'), t('video.recording_failed'));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  // Stop recording
  const stopRecording = useCallback(async () => {
    if (!cameraRef.current || !isRecording) return;

    setState('stopping');
    setIsRecording(false);

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
  }, [isRecording]);

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
      setFacing(prev => prev === 'back' ? 'front' : 'back');
      Haptics.selectionAsync();
    }
  };

  // Toggle flash
  const toggleFlash = () => {
    const flashModes: ('off' | 'on' | 'auto')[] = ['off', 'auto', 'on'];
    const currentIndex = flashModes.indexOf(flash);
    const nextIndex = (currentIndex + 1) % flashModes.length;
    setFlash(flashModes[nextIndex]);
    Haptics.selectionAsync();
  };

  const getFlashIcon = () => {
    switch (flash) {
      case 'on': return 'zap';
      case 'auto': return 'zap';
      case 'off': return 'zap-off';
      default: return 'zap-off';
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
  const handleForceExit = useCallback(async () => {
    await stopRecording();
    router.back();
  }, [stopRecording, router]);

  // Permission check
  if (!hasPermissions) {
    return <PermissionError onRetry={requestPermissions} />;
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
        <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFillObject}
            facing={facing}
            mode="video"
            enableTorch={flash === 'on'}
            zoom={zoom}
        />

        {/* Recording Status */}
        <RecordingStatusIndicator
            isRecording={state === 'recording'}
            duration={recordingTime}
        />

        {/* Top Controls */}
        <View style={styles.topControls}>
          <BackButton 
              variant="floating" 
              disabled={state === 'recording'}
          />
          
          <View style={styles.topRight}>
            <ThemedPressable
                variant="ghost"
                onPress={toggleFlash}
                style={[styles.controlButton, { backgroundColor: colors.background + 'CC' }]}
                disabled={state === 'recording'}
            >
              <ThemedIcon name={getFlashIcon()} size={20} color="primary" />
            </ThemedPressable>
          </View>
        </View>

        {/* Zoom Slider */}
        <View style={styles.zoomContainer}>
          <ThemedPressable
              variant="ghost"
              onPress={() => setZoom(Math.max(0, zoom - 0.1))}
              style={[styles.zoomButton, { backgroundColor: colors.background + 'CC' }]}
              disabled={state === 'recording'}
          >
            <ThemedIcon name="minus" size={16} color="primary" />
          </ThemedPressable>
          
          <View style={[styles.zoomSliderContainer, { backgroundColor: colors.background + 'CC' }]}>
            <View style={styles.zoomSlider}>
              <View style={[styles.zoomTrack, { backgroundColor: colors.backgroundSecondary }]} />
              <View 
                  style={[
                      styles.zoomFill, 
                      { 
                          backgroundColor: colors.primary,
                          width: `${zoom * 100}%` 
                      }
                  ]} 
              />
            </View>
            <ThemedText variant="caption" style={{ color: 'white', textAlign: 'center', marginTop: 4 }}>
              {Math.round(zoom * 100)}%
            </ThemedText>
          </View>
          
          <ThemedPressable
              variant="ghost"
              onPress={() => setZoom(Math.min(1, zoom + 0.1))}
              style={[styles.zoomButton, { backgroundColor: colors.background + 'CC' }]}
              disabled={state === 'recording'}
          >
            <ThemedIcon name="plus" size={16} color="primary" />
          </ThemedPressable>
        </View>

        {/* Bottom Controls */}
        <View style={styles.bottomControls}>
          <View style={styles.controlsRow}>
            {/* Flip Camera */}
            <ThemedPressable
                variant="ghost"
                onPress={flipCamera}
                disabled={state === 'recording'}
                style={styles.sideButton}
            >
              <ThemedIcon name="rotate-ccw" size={24} color="primary" />
            </ThemedPressable>

            {/* Record Button */}
            <ThemedPressable
                variant="ghost"
                onPress={handleCapture}
                disabled={state === 'stopping'}
                style={[
                    styles.recordButton,
                    ...(isRecording ? [styles.recordingButton] : [])
                ]}
            >
              <View style={[
                  styles.recordInner,
                  ...(isRecording ? [styles.recordingInner] : [])
              ]} />
            </ThemedPressable>

            {/* Settings placeholder */}
            <View style={styles.sideButton} />
          </View>
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

  // Top Controls
  topControls: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    zIndex: 10,
  },
  topRight: {
    flexDirection: 'row',
    gap: 12,
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },

  // Zoom Controls
  zoomContainer: {
    position: 'absolute',
    right: 20,
    top: '50%',
    transform: [{ translateY: -100 }],
    alignItems: 'center',
    gap: 8,
    zIndex: 10,
  },
  zoomButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  zoomSliderContainer: {
    width: 36,
    height: 120,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  zoomSlider: {
    position: 'relative',
    width: 4,
    height: 80,
  },
  zoomTrack: {
    position: 'absolute',
    width: 4,
    height: '100%',
    borderRadius: 2,
  },
  zoomFill: {
    position: 'absolute',
    bottom: 0,
    width: 4,
    borderRadius: 2,
  },

  // Bottom Controls
  bottomControls: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    paddingHorizontal: 40,
    zIndex: 10,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    borderColor: 'rgba(255,255,255,0.3)',
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