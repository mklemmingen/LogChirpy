/**
 * CameraControls.tsx - Android-optimized camera control UI
 * 
 * Material Design 3 controls with proper touch feedback
 */

import React from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Dimensions,
} from 'react-native';
import {
  IconButton,
  Text,
  Surface,
  useTheme,
} from 'react-native-paper';
import { useDetectionStore } from '../store/detectionStore';

interface CameraControlsProps {
  onCapture: () => void;
  onVideoRecord: () => void;
  isRecording: boolean;
  flash: 'off' | 'on' | 'auto';
  zoom: number;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function CameraControls({
  onCapture,
  onVideoRecord,
  isRecording,
  flash,
  zoom,
}: CameraControlsProps) {
  const theme = useTheme();
  const { setCameraFlash, setCameraZoom } = useDetectionStore();

  const handleFlashToggle = () => {
    const nextFlash = flash === 'off' ? 'on' : flash === 'on' ? 'auto' : 'off';
    setCameraFlash(nextFlash);
  };

  const handleZoomIn = () => {
    setCameraZoom(Math.min(zoom + 0.5, 10));
  };

  const handleZoomOut = () => {
    setCameraZoom(Math.max(zoom - 0.5, 1));
  };

  const getFlashIcon = () => {
    switch (flash) {
      case 'on': return 'flash';
      case 'auto': return 'flash-auto';
      default: return 'flash-off';
    }
  };

  return (
    <Surface
      style={[
        styles.container,
        { backgroundColor: theme.colors.surface + 'CC' } // Semi-transparent
      ]}
      elevation={4}
    >
      {/* Top controls */}
      <View style={styles.topControls}>
        {/* Flash control */}
        <IconButton
          icon={getFlashIcon()}
          size={24}
          onPress={handleFlashToggle}
          style={[
            styles.controlButton,
            { backgroundColor: theme.colors.surfaceVariant }
          ]}
          iconColor={theme.colors.onSurfaceVariant}
        />

        {/* Zoom controls */}
        <View style={styles.zoomContainer}>
          <IconButton
            icon="minus"
            size={20}
            onPress={handleZoomOut}
            disabled={zoom <= 1}
            style={[
              styles.zoomButton,
              { backgroundColor: theme.colors.surfaceVariant }
            ]}
            iconColor={theme.colors.onSurfaceVariant}
          />
          
          <Text 
            variant="labelMedium" 
            style={[
              styles.zoomText,
              { color: theme.colors.onSurface }
            ]}
          >
            {zoom.toFixed(1)}x
          </Text>
          
          <IconButton
            icon="plus"
            size={20}
            onPress={handleZoomIn}
            disabled={zoom >= 10}
            style={[
              styles.zoomButton,
              { backgroundColor: theme.colors.surfaceVariant }
            ]}
            iconColor={theme.colors.onSurfaceVariant}
          />
        </View>
      </View>

      {/* Main capture controls */}
      <View style={styles.captureContainer}>
        {/* Photo capture */}
        <Pressable
          style={[
            styles.captureButton,
            { backgroundColor: theme.colors.primary }
          ]}
          onPress={onCapture}
          android_ripple={{ 
            color: theme.colors.onPrimary, 
            radius: 35,
            borderless: true 
          }}
        >
          <View style={[
            styles.captureButtonInner,
            { backgroundColor: theme.colors.onPrimary }
          ]} />
        </Pressable>

        {/* Video record */}
        <Pressable
          style={[
            styles.videoButton,
            { 
              backgroundColor: isRecording ? theme.colors.error : theme.colors.primary,
              borderColor: theme.colors.onPrimary,
            }
          ]}
          onPress={onVideoRecord}
          android_ripple={{ 
            color: theme.colors.onPrimary, 
            radius: 25,
            borderless: true 
          }}
        >
          <View style={[
            styles.videoButtonInner,
            { 
              backgroundColor: isRecording ? theme.colors.onError : theme.colors.onPrimary,
              borderRadius: isRecording ? 4 : 12,
            }
          ]} />
        </Pressable>
      </View>

      {/* Recording indicator */}
      {isRecording && (
        <View style={styles.recordingIndicator}>
          <View style={[
            styles.recordingDot,
            { backgroundColor: theme.colors.error }
          ]} />
          <Text 
            variant="labelMedium" 
            style={[
              styles.recordingText,
              { color: theme.colors.error }
            ]}
          >
            REC
          </Text>
        </View>
      )}
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  controlButton: {
    margin: 0,
  },
  zoomContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  zoomButton: {
    margin: 0,
    width: 32,
    height: 32,
  },
  zoomText: {
    minWidth: 40,
    textAlign: 'center',
    fontWeight: '600',
  },
  captureContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    elevation: 2,
  },
  videoButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  videoButtonInner: {
    width: 24,
    height: 24,
  },
  recordingIndicator: {
    position: 'absolute',
    top: 16,
    left: '50%',
    marginLeft: -30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  recordingText: {
    fontWeight: 'bold',
    fontSize: 12,
  },
});