/**
 * DetectionOverlay.tsx - Real-time detection overlay for camera
 * 
 * Android-optimized with proper view hierarchy and performance
 */

import React from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Text, Surface } from 'react-native-paper';
import { BirdDetection } from '../store/detectionStore';

interface DetectionOverlayProps {
  detections: BirdDetection[];
  frameWidth?: number;
  frameHeight?: number;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function DetectionOverlay({ 
  detections, 
  frameWidth = SCREEN_WIDTH, 
  frameHeight = SCREEN_HEIGHT 
}: DetectionOverlayProps) {
  
  const renderBoundingBox = (detection: BirdDetection, index: number) => {
    const { boundingBox, species, confidence } = detection;
    
    // Convert normalized coordinates to screen coordinates
    const left = boundingBox.x * frameWidth;
    const top = boundingBox.y * frameHeight;
    const width = boundingBox.width * frameWidth;
    const height = boundingBox.height * frameHeight;
    
    return (
      <View
        key={detection.id}
        style={[
          styles.boundingBox,
          {
            left,
            top,
            width,
            height,
          },
        ]}
        collapsable={false} // Prevent Android view hierarchy issues
      >
        {/* Bounding box border */}
        <View style={styles.boxBorder} />
        
        {/* Label */}
        <Surface
          style={[
            styles.label,
            {
              backgroundColor: `hsla(${(index * 60) % 360}, 70%, 50%, 0.9)`, // Unique color per detection
            },
          ]}
          elevation={2}
        >
          <Text
            variant="labelSmall"
            style={styles.labelText}
            numberOfLines={1}
          >
            {species.common_name}
          </Text>
          <Text
            variant="labelSmall"
            style={styles.confidenceText}
            numberOfLines={1}
          >
            {(confidence * 100).toFixed(0)}%
          </Text>
        </Surface>
      </View>
    );
  };

  if (!detections || detections.length === 0) {
    return null;
  }

  return (
    <View style={styles.overlay} pointerEvents="none">
      {detections.map(renderBoundingBox)}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
  },
  boundingBox: {
    position: 'absolute',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  boxBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 2,
    borderColor: '#00FF00',
    borderRadius: 4,
  },
  label: {
    position: 'absolute',
    top: -32,
    left: 0,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: 200,
  },
  labelText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  confidenceText: {
    color: '#FFFFFF',
    fontSize: 10,
    opacity: 0.9,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
});