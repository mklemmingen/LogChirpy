import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  useColorScheme,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useMicrophonePermission,
} from 'react-native-vision-camera';
import { useVideoPlayer, VideoView, VideoSource } from 'expo-video';
import { t } from 'i18next';
import { theme } from '@/constants/theme';
import { CameraControls } from '@/components/CameraControls';
import { Feather } from '@expo/vector-icons';

export default function VideoCapture() {
  const router = useRouter();
  const { hasPermission: hasCameraPermission } = useCameraPermission();
  const { hasPermission: hasMicPermission } = useMicrophonePermission();

  const cameraRef = useRef<Camera>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [cameraPosition, setCameraPosition] = useState<'front' | 'back'>('back');
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const player = useVideoPlayer((videoUri || '') as VideoSource, (player) => {
    if (videoUri) {
      player.loop = false;
      player.play();
    }
  });

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const colorScheme = useColorScheme() as 'light' | 'dark';
  const currentTheme = theme[colorScheme];
  const device = useCameraDevice(cameraPosition);

  const flipCamera = () => {
    if (!isRecording) {
      setCameraPosition(prev => prev === 'back' ? 'front' : 'back');
    }
  };

  const startRecording = async () => {
    if (!cameraRef.current) return;
    setIsRecording(true);
    setRecordingTime(0);
    timerRef.current = setInterval(() => {
      setRecordingTime((prev) => prev + 1);
    }, 1000);

    try {
      await cameraRef.current.startRecording({
        flash: 'off',
        onRecordingFinished: (video) => {
          clearInterval(timerRef.current!);
          setIsRecording(false);
          setVideoUri(video.path);
        },
        onRecordingError: (error) => {
          console.error('Recording error', error);
          clearInterval(timerRef.current!);
          setIsRecording(false);
        },
      });
    } catch (e) {
      console.error('Recording failed to start', e);
      clearInterval(timerRef.current!);
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    if (!cameraRef.current) return;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
    await cameraRef.current.stopRecording();
  };

  const handleRetake = () => {
    setVideoUri(null);
    setRecordingTime(0);
    player.pause();
  };

  const handleConfirm = () => {
    if (videoUri) {
      router.push({
        pathname: '/log/manual',
        params: { videoUri },
      });
    }
  };

  if (!device || !hasCameraPermission || !hasMicPermission) {
    return (
      <View style={[styles.centered, { backgroundColor: currentTheme.colors.background }]}>
        <ActivityIndicator size="large" color={currentTheme.colors.primary} />
        <Text
          style={{
            color: currentTheme.colors.text.primary,
            fontSize: theme.typography.body.fontSize,
            marginTop: theme.spacing.sm,
          }}
        >
          {t('camera.loading_screen')}
        </Text>
      </View>
    );
  }

  if (videoUri) {
    return (
      <View style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
        <View style={styles.videoContainer}>
          <VideoView
            player={player}
            style={styles.preview}
            nativeControls
            contentFit="contain"
          />
        </View>
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            onPress={handleRetake}
            style={[styles.button, { backgroundColor: currentTheme.colors.primary }]}
          >
            <Text style={[styles.buttonText, { color: currentTheme.colors.buttonText }]}>
              {t('camera.retake')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleConfirm}
            style={[styles.button, { backgroundColor: currentTheme.colors.primary }]}
          >
            <Text style={[styles.buttonText, { color: currentTheme.colors.buttonText }]}>
              {t('common.confirm')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={StyleSheet.absoluteFillObject}>
        <Camera
          ref={cameraRef}
          style={StyleSheet.absoluteFillObject}
          device={device}
          isActive={!videoUri}
          video
          audio
        />
        {isRecording && (
          <View style={styles.timerContainer}>
            <Text style={[styles.recordingTime, { color: currentTheme.colors.error }]}>
              {formatTime(recordingTime)}
            </Text>
          </View>
        )}
        <View style={styles.controlBar}>
          <CameraControls
            onCapture={isRecording ? stopRecording : startRecording}
            onFlip={flipCamera}
            isRecording={isRecording}
            isFlipDisabled={isRecording}
          />
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  timerContainer: {
    position: 'absolute',
    top: theme.spacing.xxl,
    right: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
  },
  recordingTime: {
    fontSize: theme.typography.body.fontSize,
    fontWeight: 'bold',
    marginBottom: theme.spacing.md,
  },
  container: {
    flex: 1,
  },
  videoContainer: {
    flex: 1,
    marginBottom: theme.spacing.md,
  },
  preview: {
    flex: 1,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingBottom: theme.spacing.xl,
    paddingHorizontal: theme.spacing.md,
  },
  button: {
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    minWidth: 120,
    alignItems: 'center',
    ...theme.shadows.sm,
  },
  buttonText: {
    fontSize: theme.typography.body.fontSize,
    fontWeight: 'bold',
  },
});
