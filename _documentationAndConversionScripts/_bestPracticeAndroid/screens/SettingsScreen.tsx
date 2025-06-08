/**
 * SettingsScreen.tsx - Android Material Design 3 settings
 */

import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Surface, Text, List, Switch } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDetectionSettings, useDetectionStore } from '../store/detectionStore';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const settings = useDetectionSettings();
  const { updateSettings } = useDetectionStore();

  return (
    <Surface style={[styles.container, { paddingTop: insets.top }]}>
      <Text variant="headlineMedium" style={styles.title}>Settings</Text>
      
      <ScrollView>
        <List.Section>
          <List.Subheader>Detection Settings</List.Subheader>
          
          <List.Item
            title="GPU Acceleration"
            description="Use GPU for faster processing"
            right={() => (
              <Switch
                value={settings.enableGPUAcceleration}
                onValueChange={(value) => updateSettings({ enableGPUAcceleration: value })}
              />
            )}
          />
          
          <List.Item
            title="Frame Throttling"
            description="Limit frame rate to save battery"
            right={() => (
              <Switch
                value={settings.enableFrameThrottling}
                onValueChange={(value) => updateSettings({ enableFrameThrottling: value })}
              />
            )}
          />
        </List.Section>
      </ScrollView>
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { marginBottom: 16 },
});