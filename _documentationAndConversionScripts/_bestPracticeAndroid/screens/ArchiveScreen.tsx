/**
 * ArchiveScreen.tsx - Android-optimized archive with FlatList performance
 */

import React from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { Surface, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDetectionHistory } from '../store/detectionStore';

export default function ArchiveScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const detectionHistory = useDetectionHistory();

  return (
    <Surface style={[styles.container, { paddingTop: insets.top }]}>
      <Text variant="headlineMedium" style={styles.title}>Archive</Text>
      <FlatList
        data={detectionHistory}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <Text>{item.species.common_name}</Text>
          </View>
        )}
        // Android FlatList optimizations
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        initialNumToRender={6}
        windowSize={10}
      />
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { marginBottom: 16 },
  item: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
});