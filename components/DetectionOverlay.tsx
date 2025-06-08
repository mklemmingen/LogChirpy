import React, { useMemo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Text, Card } from 'react-native-paper';

interface Detection {
  class: string;
  confidence: number;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

interface DetectionOverlayProps {
  detections: Detection[];
  isProcessing: boolean;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function DetectionOverlay({ detections, isProcessing }: DetectionOverlayProps) {
  const boundingBoxes = useMemo(() => {
    return detections.map((detection, index) => {
      const { bounds } = detection;
      
      // Convert normalized coordinates to screen coordinates
      const left = bounds.x * screenWidth;
      const top = bounds.y * screenHeight;
      const width = bounds.width * screenWidth;
      const height = bounds.height * screenHeight;

      // Ensure bounds are within screen limits
      const clampedLeft = Math.max(0, Math.min(left, screenWidth - width));
      const clampedTop = Math.max(0, Math.min(top, screenHeight - height));
      const clampedWidth = Math.max(50, Math.min(width, screenWidth - clampedLeft));
      const clampedHeight = Math.max(50, Math.min(height, screenHeight - clampedTop));

      return (
        <View
          key={`detection-${index}-${detection.class}`}
          style={[
            styles.boundingBox,
            {
              left: clampedLeft,
              top: clampedTop,
              width: clampedWidth,
              height: clampedHeight,
            },
          ]}
        >
          <Card style={styles.labelCard} mode="elevated">
            <Card.Content style={styles.labelContent}>
              <Text variant="labelMedium" style={styles.labelText}>
                {detection.class}
              </Text>
              <Text variant="labelSmall" style={styles.confidenceText}>
                {Math.round(detection.confidence * 100)}%
              </Text>
            </Card.Content>
          </Card>
        </View>
      );
    });
  }, [detections]);

  return (
    <View style={styles.overlay} pointerEvents="none">
      {/* Detection bounding boxes */}
      {boundingBoxes}
      
      {/* Processing indicator */}
      {isProcessing && (
        <View style={styles.processingContainer}>
          <Card style={styles.processingCard} mode="elevated">
            <Card.Content style={styles.processingContent}>
              <View style={styles.processingIndicator}>
                <View style={styles.processingDot} />
                <View style={[styles.processingDot, styles.processingDotDelay1]} />
                <View style={[styles.processingDot, styles.processingDotDelay2]} />
              </View>
              <Text variant="bodySmall" style={styles.processingText}>
                Detecting birds...
              </Text>
            </Card.Content>
          </Card>
        </View>
      )}
      
      {/* Detection count indicator */}
      {detections.length > 0 && (
        <View style={styles.countContainer}>
          <Card style={styles.countCard} mode="elevated">
            <Card.Content style={styles.countContent}>
              <Text variant="labelMedium" style={styles.countText}>
                {detections.length} bird{detections.length !== 1 ? 's' : ''} detected
              </Text>
            </Card.Content>
          </Card>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: 'none',
  },
  boundingBox: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#4CAF50',
    backgroundColor: 'transparent',
    borderRadius: 4,
  },
  labelCard: {
    position: 'absolute',
    top: -40,
    left: 0,
    backgroundColor: 'rgba(76, 175, 80, 0.9)',
    minWidth: 80,
  },
  labelContent: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
  },
  labelText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  confidenceText: {
    color: 'white',
    fontSize: 10,
    marginTop: 2,
  },
  processingContainer: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  processingCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  processingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  processingIndicator: {
    flexDirection: 'row',
    marginRight: 12,
  },
  processingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4CAF50',
    marginHorizontal: 2,
    opacity: 0.3,
  },
  processingDotDelay1: {
    opacity: 0.6,
  },
  processingDotDelay2: {
    opacity: 1,
  },
  processingText: {
    color: 'white',
    fontSize: 14,
  },
  countContainer: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  countCard: {
    backgroundColor: 'rgba(76, 175, 80, 0.9)',
  },
  countContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  countText: {
    color: 'white',
    fontWeight: 'bold',
  },
});