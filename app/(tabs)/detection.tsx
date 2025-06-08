import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, BackHandler, Alert } from 'react-native';
import { useIsFocused, useFocusEffect } from '@react-navigation/native';
import { Text, FAB, Card } from 'react-native-paper';

import { useMLStore } from '../../services/MLModelService';
import { usePermissions } from '../../services/PermissionService';
import DetectionOverlay from '../../components/DetectionOverlay';

export default function DetectionScreen() {
  const isFocused = useIsFocused();
  const { hasPermission, requestCameraPermission } = usePermissions();
  const { detections, isProcessing, processFrame } = useMLStore();
  const [isActive, setIsActive] = useState(false);
  const cleanupRef = useRef(false);
  const frameCountRef = useRef(0);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (isFocused) {
          setIsActive(false);
          return true;
        }
        return false;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [isFocused])
  );

  useFocusEffect(
    useCallback(() => {
      cleanupRef.current = false;
      
      const timer = setTimeout(() => {
        if (!cleanupRef.current) {
          setIsActive(true);
        }
      }, 300);
      
      return () => {
        clearTimeout(timer);
        cleanupRef.current = true;
        setIsActive(false);
      };
    }, [])
  );

  // Mock frame processing for demo
  const simulateFrameProcessing = useCallback(() => {
    if (!isActive || !isFocused) return;
    
    frameCountRef.current += 1;
    if (frameCountRef.current % 30 === 0) { // Process every 30 frames (~1 second at 30fps)
      processFrame({ mockFrame: true });
    }
  }, [isActive, isFocused, processFrame]);
  
  useEffect(() => {
    if (isActive && isFocused) {
      const interval = setInterval(simulateFrameProcessing, 100);
      return () => clearInterval(interval);
    }
  }, [isActive, isFocused, simulateFrameProcessing]);

  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <Card style={styles.permissionCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.permissionTitle}>
              Camera Permission Required
            </Text>
            <Text variant="bodyMedium" style={styles.permissionText}>
              Please enable camera permission to use bird detection.
            </Text>
            <FAB
              icon="camera"
              label="Grant Permission"
              onPress={requestCameraPermission}
              style={styles.permissionButton}
            />
          </Card.Content>
        </Card>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.cameraPlaceholder}>
        <Text variant="headlineSmall" style={styles.placeholderText}>
          Mock Camera Feed
        </Text>
        <Text variant="bodyMedium" style={styles.placeholderSubtext}>
          {isActive ? 'AI Detection Active' : 'Camera Inactive'}
        </Text>
        
        {detections.length > 0 && (
          <View style={styles.detectionInfo}>
            <Text variant="bodySmall" style={styles.detectionText}>
              {detections.length} bird{detections.length !== 1 ? 's' : ''} detected
            </Text>
          </View>
        )}
      </View>
      
      <DetectionOverlay 
        detections={detections}
        isProcessing={isProcessing}
      />
      
      <FAB
        icon="camera-flip"
        style={styles.fab}
        onPress={() => setIsActive(!isActive)}
        mode="elevated"
        label={isActive ? 'Stop' : 'Start'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  cameraPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  placeholderText: {
    color: 'white',
    textAlign: 'center',
    marginBottom: 10,
  },
  placeholderSubtext: {
    color: '#CCCCCC',
    textAlign: 'center',
  },
  detectionInfo: {
    marginTop: 20,
    padding: 12,
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    borderRadius: 8,
  },
  detectionText: {
    color: '#4CAF50',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  permissionCard: {
    margin: 20,
    padding: 20,
  },
  permissionTitle: {
    marginBottom: 10,
    textAlign: 'center',
  },
  permissionText: {
    marginBottom: 20,
    textAlign: 'center',
  },
  permissionButton: {
    alignSelf: 'center',
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 100,
  },
});