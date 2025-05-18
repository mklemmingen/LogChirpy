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

export default function VideoCapture() {
  const router = useRouter();
  const { hasPermission: hasCameraPermission } = useCameraPermission();
  const { hasPermission: hasMicPermission } = useMicrophonePermission();

  const cameraRef = useRef<Camera>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Prepare an expo-video player, source is videoUri or empty string
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
  const device = useCameraDevice('back');

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
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text
          style={{
            color: currentTheme.colors.text.primary,
            fontSize: 16,
            marginTop: 10,
          }}
        >
          {t('camera.loading_screen')}
        </Text>
      </View>
    );
  }

  if (videoUri) {
    return (
      <View style={styles.container}>
        <View style={styles.videoContainer}>
          <VideoView
            player={player}
            style={styles.preview}
            nativeControls
            contentFit="contain"
          />
        </View>
        <View style={styles.buttonContainer}>
          <TouchableOpacity onPress={handleRetake} style={styles.button}>
            <Text style={styles.buttonText}>{t('camera.retake')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleConfirm} style={styles.button}>
            <Text style={styles.buttonText}>{t('common.confirm')}</Text>
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
            <Text style={styles.recordingTime}>
              {formatTime(recordingTime)}
            </Text>
          </View>
        )}
        <View style={styles.controlBar}>
          <TouchableOpacity
            onPress={isRecording ? stopRecording : startRecording}
            style={styles.outerCircle}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.innerCircle,
                isRecording && styles.innerSquare,
              ]}
            />
          </TouchableOpacity>
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
    bottom: 40,
    width: '100%',
    alignItems: 'center',
  },
  timerContainer: {
    position: 'absolute',
    right: 20,
    paddingTop: 8,
    borderRadius: 6,
  },
  recordingTime: {
    color: 'red',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  outerCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  innerCircle: {
    width: 60,
    height: 60,
    backgroundColor: '#e74c3c',
    borderRadius: 30,
  },
  innerSquare: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: '#e74c3c',
  },
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  videoContainer: {
    flex: 1,
    marginBottom: 20,
  },
  preview: {
    flex: 1,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  button: {
    backgroundColor: '#2196F3',
    padding: 15,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
