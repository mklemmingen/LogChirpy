/**
 * CameraModal.tsx - Android-optimized camera modal
 * 
 * Uses react-native-modal to prevent view hierarchy conflicts
 * Implements Vision Camera v4 with frame processors
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  StatusBar,
  BackHandler,
  Pressable,
} from 'react-native';
import Modal from 'react-native-modal';
import { Camera } from 'react-native-vision-camera';
import { useTheme, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCameraService } from '../../services/CameraService';
import { useCameraState, useCurrentDetections } from '../../store/detectionStore';
import DetectionOverlay from '../../components/DetectionOverlay';
import CameraControls from '../../components/CameraControls';

interface CameraModalProps {
  isVisible: boolean;
  onClose: () => void;
  onCapture?: (result: any) => void;
}

export default function CameraModal({ isVisible, onClose, onCapture }: CameraModalProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<Camera>(null);
  
  const { hasPermission, device, startCamera, stopCamera, frameProcessor, cameraConfig } = useCameraService();
  const cameraState = useCameraState();
  const detections = useCurrentDetections();
  
  const [isReady, setIsReady] = useState(false);

  // Handle Android back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isVisible) {
        onClose();
        return true;
      }
      return false;
    });

    return () => backHandler.remove();
  }, [isVisible, onClose]);

  // Camera lifecycle management
  useEffect(() => {
    if (isVisible && hasPermission && device) {
      startCamera().then(() => {
        setIsReady(true);
      });
    } else if (!isVisible) {
      stopCamera();
      setIsReady(false);
    }
  }, [isVisible, hasPermission, device]);

  const handleCapture = async () => {
    if (!cameraRef.current || !isReady) return;

    try {
      const photo = await cameraRef.current.takePhoto({
        qualityPrioritization: 'speed', // Better for Android performance
        enableAutoStabilization: true,
        enableAutoRedEyeReduction: false, // Disable for better performance
        flash: cameraState.flash,
      });

      onCapture?.(photo);
      onClose();
    } catch (error) {
      console.error('Failed to capture photo:', error);
    }
  };

  const handleVideoRecord = async () => {
    if (!cameraRef.current || !isReady) return;

    try {
      if (cameraState.isRecording) {
        await cameraRef.current.stopRecording();
      } else {
        cameraRef.current.startRecording({
          flash: cameraState.flash,
          onRecordingFinished: (video) => {
            onCapture?.(video);
          },
          onRecordingError: (error) => {
            console.error('Recording error:', error);
          },
        });
      }
    } catch (error) {
      console.error('Failed to record video:', error);
    }
  };

  if (!device || !hasPermission) {
    return null;
  }

  return (
    <Modal
      isVisible={isVisible}
      onBackdropPress={onClose}
      onSwipeComplete={onClose}
      swipeDirection="down"
      useNativeDriverForBackdrop={true}
      hideModalContentWhileAnimating={true}
      deviceHeight={Dimensions.get('screen').height}
      statusBarTranslucent={true}
      style={styles.modal}
      animationIn="slideInUp"
      animationOut="slideOutDown"
      animationInTiming={300}
      animationOutTiming={200}
      backdropTransitionInTiming={300}
      backdropTransitionOutTiming={200}
      // Android-specific props
      supportedOrientations={['portrait']}
      onModalWillShow={() => StatusBar.setHidden(true, 'slide')}
      onModalWillHide={() => StatusBar.setHidden(false, 'slide')}
    >
      <View style={styles.container} collapsable={false}>
        {/* Camera view with frame processor */}
        <Camera
          ref={cameraRef}
          device={device}
          isActive={isVisible && isReady}
          style={StyleSheet.absoluteFill}
          frameProcessor={frameProcessor}
          {...cameraConfig}
          // Android optimizations
          enableZoomGesture={true}
          enableFpsGraph={__DEV__}
          photo={true}
          video={true}
          audio={false} // Disable audio for better performance
        />

        {/* Detection overlay */}
        {detections.length > 0 && (
          <DetectionOverlay detections={detections} />
        )}

        {/* Header with close button */}
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <Pressable
            style={styles.closeButton}
            onPress={onClose}
            android_ripple={{ color: theme.colors.onSurface, radius: 24 }}
          >
            <View style={[styles.closeButtonInner, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.closeButtonText, { color: theme.colors.onSurface }]}>×</Text>
            </View>
          </Pressable>
        </View>

        {/* Camera controls */}
        <View style={[styles.controls, { paddingBottom: insets.bottom }]}>
          <CameraControls
            onCapture={handleCapture}
            onVideoRecord={handleVideoRecord}
            isRecording={cameraState.isRecording}
            flash={cameraState.flash}
            zoom={cameraState.zoom}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: {
    margin: 0,
    zIndex: 1000,
  },
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  closeButton: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  closeButtonInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  closeButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
    lineHeight: 24,
  },
  controls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
});

