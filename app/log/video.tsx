import { View, Text, ActivityIndicator, useColorScheme, StyleSheet, TouchableOpacity } from 'react-native';
import { Stack } from "expo-router";
import { Camera, useCameraDevice, useCameraPermission, useMicrophonePermission } from 'react-native-vision-camera';
import { t } from 'i18next';
import { theme } from '@/constants/theme';
import { useRef, useState } from 'react';

export default function VideoCapture() {
  const { hasPermission: hasCameraPermission } = useCameraPermission()
  const { hasPermission: hasMicPermission } = useMicrophonePermission()

  const cameraRef = useRef<Camera>(null);
  const [isRecording, setIsRecording] = useState(false);

  const colorScheme = useColorScheme() as 'light' | 'dark'
  const currentTheme = theme[colorScheme]

  const device = useCameraDevice('back')


  const startRecording = async () => {
    if (!cameraRef.current) return;
    setIsRecording(true);

    try {
      cameraRef.current.startRecording({
        flash: 'off',
        onRecordingFinished: (video) => {
          console.log('🎥 Recording finished', video);
          setIsRecording(false);
        },
        onRecordingError: (error) => {
          console.error('❌ Recording error', error);
          setIsRecording(false);
        },
      });
    } catch (e) {
      console.error('Recording failed to start', e);
      setIsRecording(false);
    }
  };


  const stopRecording = async () => {
    if (!cameraRef.current) return;
    await cameraRef.current.stopRecording();
  };

  if (!device || !hasCameraPermission || !hasMicPermission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text style={{ color: currentTheme.colors.text.primary, fontSize: 16, marginTop: 10 }}>
          {t('camera.loading_screen')}
        </Text>
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
          isActive={true}
          video={true}
          audio={true}
        />
        <View style={styles.controlBar}>
          <TouchableOpacity
            onPress={isRecording ? stopRecording : startRecording}
            style={[styles.recordButton, isRecording && styles.stopButton]}
          >
            <Text style={styles.buttonText}>
              {isRecording ? '⏹️ Stop' : '🎬 Record'}
            </Text>
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
  recordButton: {
    padding: 14,
    backgroundColor: '#e74c3c',
    borderRadius: 30,
    paddingHorizontal: 24,
  },
  stopButton: {
    backgroundColor: '#34495e',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});