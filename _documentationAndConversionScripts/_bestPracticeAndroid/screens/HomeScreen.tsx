/**
 * HomeScreen.tsx - Android-optimized home dashboard
 */

import React from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Dimensions,
} from 'react-native';
import {
  Surface,
  Text,
  Card,
  Button,
  useTheme,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDetectionHistory, usePerformanceMetrics } from '../store/detectionStore';
import { IconSymbol } from '../components/ui/IconSymbol';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function HomeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const detectionHistory = useDetectionHistory();
  const performance = usePerformanceMetrics();

  const recentDetections = detectionHistory.slice(0, 3);
  const todayDetections = detectionHistory.filter(
    d => new Date(d.timestamp).toDateString() === new Date().toDateString()
  );

  return (
    <Surface style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        // Android scroll optimizations
        removeClippedSubviews={true}
        scrollEventThrottle={16}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text variant="headlineLarge" style={{ color: theme.colors.onSurface }}>
            Bird Detection
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurface, opacity: 0.7 }}>
            Welcome back, birder!
          </Text>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsContainer}>
          <Card style={[styles.statCard, { backgroundColor: theme.colors.primaryContainer }]}>
            <Card.Content style={styles.statContent}>
              <IconSymbol name="bird" size={24} color={theme.colors.onPrimaryContainer} />
              <Text variant="headlineMedium" style={{ color: theme.colors.onPrimaryContainer }}>
                {todayDetections.length}
              </Text>
              <Text variant="bodySmall" style={{ color: theme.colors.onPrimaryContainer }}>
                Today's Detections
              </Text>
            </Card.Content>
          </Card>

          <Card style={[styles.statCard, { backgroundColor: theme.colors.secondaryContainer }]}>
            <Card.Content style={styles.statContent}>
              <IconSymbol name="archive" size={24} color={theme.colors.onSecondaryContainer} />
              <Text variant="headlineMedium" style={{ color: theme.colors.onSecondaryContainer }}>
                {detectionHistory.length}
              </Text>
              <Text variant="bodySmall" style={{ color: theme.colors.onSecondaryContainer }}>
                Total Detections
              </Text>
            </Card.Content>
          </Card>
        </View>

        {/* Recent Detections */}
        <Card style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Card.Content>
            <Text variant="titleLarge" style={{ color: theme.colors.onSurface, marginBottom: 16 }}>
              Recent Detections
            </Text>
            
            {recentDetections.length > 0 ? (
              recentDetections.map((detection) => (
                <View key={detection.id} style={styles.detectionItem}>
                  <View style={styles.detectionInfo}>
                    <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
                      {detection.species.common_name}
                    </Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurface, opacity: 0.7 }}>
                      {new Date(detection.timestamp).toLocaleTimeString()}
                    </Text>
                  </View>
                  <Text variant="labelMedium" style={{ color: theme.colors.primary }}>
                    {(detection.confidence * 100).toFixed(0)}%
                  </Text>
                </View>
              ))
            ) : (
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurface, opacity: 0.7 }}>
                No recent detections
              </Text>
            )}
          </Card.Content>
        </Card>

        {/* Quick Actions */}
        <Card style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Card.Content>
            <Text variant="titleLarge" style={{ color: theme.colors.onSurface, marginBottom: 16 }}>
              Quick Actions
            </Text>
            
            <View style={styles.actionsGrid}>
              <Button
                mode="contained"
                onPress={() => {}}
                style={styles.actionButton}
                contentStyle={styles.actionButtonContent}
              >
                Start Detection
              </Button>
              
              <Button
                mode="outlined"
                onPress={() => {}}
                style={styles.actionButton}
                contentStyle={styles.actionButtonContent}
              >
                View Archive
              </Button>
            </View>
          </Card.Content>
        </Card>

        {/* Performance (Dev only) */}
        {__DEV__ && (
          <Card style={[styles.section, { backgroundColor: theme.colors.surfaceVariant }]}>
            <Card.Content>
              <Text variant="titleMedium" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 8 }}>
                Performance Metrics
              </Text>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                Frame Rate: {performance.frameRate.toFixed(1)} FPS
              </Text>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                Memory Usage: {performance.memoryUsage.toFixed(1)} MB
              </Text>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                Battery Level: {performance.batteryLevel}%
              </Text>
            </Card.Content>
          </Card>
        )}
      </ScrollView>
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100, // Space for tab bar
  },
  header: {
    marginBottom: 24,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    elevation: 2,
  },
  statContent: {
    alignItems: 'center',
    gap: 8,
  },
  section: {
    marginBottom: 16,
    elevation: 2,
  },
  detectionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  detectionInfo: {
    flex: 1,
  },
  actionsGrid: {
    gap: 12,
  },
  actionButton: {
    elevation: 2,
  },
  actionButtonContent: {
    paddingVertical: 8,
  },
});