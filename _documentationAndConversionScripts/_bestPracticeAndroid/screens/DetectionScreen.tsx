/**
 * DetectionScreen.tsx - Main bird detection interface
 * 
 * Android-optimized with proper memory management and view hierarchy
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  FlatList,
  RefreshControl,
} from 'react-native';
import {
  Surface,
  Text,
  Button,
  Card,
  useTheme,
  ActivityIndicator,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import {
  useDetectionStore,
  useCurrentDetections,
  useModelState,
  usePerformanceMetrics,
} from '../store/detectionStore';
import { CameraService } from '../services/CameraService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function DetectionScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  const detections = useCurrentDetections();
  const modelState = useModelState();
  const performance = usePerformanceMetrics();
  const { clearCurrentDetections } = useDetectionStore();

  // Handle screen focus for Android memory management
  useFocusEffect(
    useCallback(() => {
      // Start camera service when screen is focused
      const cameraService = CameraService.getInstance();
      cameraService.startCamera();

      return () => {
        // Cleanup when unfocused to free resources
        cameraService.stopCamera();
      };
    }, [])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    clearCurrentDetections();
    // Simulate refresh delay
    setTimeout(() => setRefreshing(false), 1000);
  }, [clearCurrentDetections]);

  const handleStartDetection = () => {
    setShowCameraModal(true);
  };

  const renderDetectionItem = useCallback(({ item, index }: { item: any; index: number }) => (
    <Card
      key={item.id}
      style={[
        styles.detectionCard,
        { backgroundColor: theme.colors.surfaceVariant }
      ]}
      mode="contained"
    >
      <Card.Content>
        <Text variant="titleMedium" style={{ color: theme.colors.onSurfaceVariant }}>
          {item.species.common_name}
        </Text>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, opacity: 0.7 }}>
          {item.species.scientific_name}
        </Text>
        <Text variant="labelSmall" style={{ color: theme.colors.primary, marginTop: 4 }}>
          Confidence: {(item.confidence * 100).toFixed(1)}%
        </Text>
      </Card.Content>
    </Card>
  ), [theme]);

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text variant="headlineSmall" style={{ color: theme.colors.onSurface, textAlign: 'center' }}>
        No detections yet
      </Text>
      <Text variant="bodyMedium" style={{ color: theme.colors.onSurface, opacity: 0.7, textAlign: 'center', marginTop: 8 }}>
        Start detecting to see bird identifications
      </Text>
    </View>
  );

  return (
    <Surface style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text variant="headlineMedium" style={{ color: theme.colors.onSurface }}>
          Bird Detection
        </Text>
        
        {/* Model status indicator */}
        <View style={styles.statusContainer}>
          {modelState.isLoaded ? (
            <View style={styles.statusIndicator}>
              <View style={[styles.statusDot, { backgroundColor: theme.colors.primary }]} />
              <Text variant="labelSmall" style={{ color: theme.colors.onSurface }}>
                Model Ready
              </Text>
            </View>
          ) : (
            <ActivityIndicator size="small" animating={true} />
          )}
        </View>
      </View>

      {/* Performance metrics */}
      {__DEV__ && (
        <Card style={[styles.performanceCard, { backgroundColor: theme.colors.surface }]}>
          <Card.Content>
            <Text variant="labelSmall" style={{ color: theme.colors.onSurface }}>
              FPS: {performance.frameRate.toFixed(1)} | 
              Memory: {performance.memoryUsage.toFixed(1)}MB | 
              Battery: {performance.batteryLevel}%
            </Text>
          </Card.Content>
        </Card>
      )}

      {/* Detection button */}
      <View style={styles.actionContainer}>
        <Button
          mode="contained"
          onPress={handleStartDetection}
          disabled={!modelState.isLoaded}
          style={styles.detectButton}
          contentStyle={styles.detectButtonContent}
        >
          Start Detection
        </Button>
      </View>

      {/* Detections list */}
      <View style={styles.detectionsContainer}>
        <View style={styles.detectionsHeader}>
          <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
            Recent Detections
          </Text>
          {detections.length > 0 && (
            <Button
              mode="text"
              onPress={clearCurrentDetections}
              compact
            >
              Clear
            </Button>
          )}
        </View>

        <FlatList
          data={detections}
          renderItem={renderDetectionItem}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[theme.colors.primary]} // Android refresh indicator color
            />
          }
          // Android FlatList optimizations
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          initialNumToRender={6}
          windowSize={10}
          getItemLayout={(data, index) => ({
            length: 80, // Fixed item height for performance
            offset: 80 * index,
            index,
          })}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
      </View>

      {/* Camera Modal would be rendered here via navigation */}
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  statusContainer: {
    alignItems: 'center',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  performanceCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    elevation: 2,
  },
  actionContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  detectButton: {
    elevation: 4,
  },
  detectButtonContent: {
    paddingVertical: 8,
  },
  detectionsContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  detectionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  detectionCard: {
    marginBottom: 12,
    elevation: 2,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  listContent: {
    paddingBottom: 100, // Space for tab bar
  },
});