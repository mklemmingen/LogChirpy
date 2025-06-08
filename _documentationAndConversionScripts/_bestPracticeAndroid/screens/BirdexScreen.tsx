/**
 * BirdexScreen.tsx - Bird encyclopedia with Android optimizations
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Surface, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function BirdexScreen() {
  const insets = useSafeAreaInsets();

  return (
    <Surface style={[styles.container, { paddingTop: insets.top }]}>
      <Text variant="headlineMedium" style={styles.title}>Birdex</Text>
      <Text>Bird encyclopedia coming soon...</Text>
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { marginBottom: 16 },
});