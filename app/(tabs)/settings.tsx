import React, { useState } from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import { Text, Card, Switch, Button, Divider } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

export default function SettingsScreen() {
  const [gpuAcceleration, setGpuAcceleration] = useState(true);
  const [audioRecording, setAudioRecording] = useState(true);
  const [locationTracking, setLocationTracking] = useState(true);
  const [notifications, setNotifications] = useState(false);

  const SettingItem = ({ 
    title, 
    description, 
    icon, 
    value, 
    onValueChange 
  }: {
    title: string;
    description: string;
    icon: string;
    value: boolean;
    onValueChange: (value: boolean) => void;
  }) => (
    <View style={styles.settingItem}>
      <View style={styles.settingLeft}>
        <MaterialCommunityIcons name={icon as any} size={24} color="#4CAF50" />
        <View style={styles.settingText}>
          <Text variant="titleMedium">{title}</Text>
          <Text variant="bodySmall" style={styles.description}>
            {description}
          </Text>
        </View>
      </View>
      <Switch value={value} onValueChange={onValueChange} />
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text variant="headlineMedium" style={styles.title}>
            Settings
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            Configure your bird detection experience
          </Text>
        </View>

        <Card style={styles.section} mode="elevated">
          <Card.Content>
            <Text variant="titleLarge" style={styles.sectionTitle}>
              Performance
            </Text>
            
            <SettingItem
              title="GPU Acceleration"
              description="Use device GPU for faster AI processing"
              icon="rocket"
              value={gpuAcceleration}
              onValueChange={setGpuAcceleration}
            />
            
            <Divider style={styles.divider} />
            
            <SettingItem
              title="Audio Recording"
              description="Enable microphone for bird sound detection"
              icon="microphone"
              value={audioRecording}
              onValueChange={setAudioRecording}
            />
          </Card.Content>
        </Card>

        <Card style={styles.section} mode="elevated">
          <Card.Content>
            <Text variant="titleLarge" style={styles.sectionTitle}>
              Privacy
            </Text>
            
            <SettingItem
              title="Location Tracking"
              description="Save GPS coordinates with sightings"
              icon="map-marker"
              value={locationTracking}
              onValueChange={setLocationTracking}
            />
            
            <Divider style={styles.divider} />
            
            <SettingItem
              title="Notifications"
              description="Get alerts for bird detection events"
              icon="bell"
              value={notifications}
              onValueChange={setNotifications}
            />
          </Card.Content>
        </Card>

        <Card style={styles.section} mode="elevated">
          <Card.Content>
            <Text variant="titleLarge" style={styles.sectionTitle}>
              Data Management
            </Text>
            
            <View style={styles.actionRow}>
              <View style={styles.actionText}>
                <Text variant="titleMedium">Export Data</Text>
                <Text variant="bodySmall" style={styles.description}>
                  Export your bird sightings as CSV
                </Text>
              </View>
              <Button mode="outlined" onPress={() => {}}>
                Export
              </Button>
            </View>
            
            <Divider style={styles.divider} />
            
            <View style={styles.actionRow}>
              <View style={styles.actionText}>
                <Text variant="titleMedium">Clear Cache</Text>
                <Text variant="bodySmall" style={styles.description}>
                  Free up storage space
                </Text>
              </View>
              <Button mode="outlined" onPress={() => {}}>
                Clear
              </Button>
            </View>
          </Card.Content>
        </Card>

        <Card style={styles.section} mode="elevated">
          <Card.Content>
            <Text variant="titleLarge" style={styles.sectionTitle}>
              About
            </Text>
            
            <View style={styles.infoRow}>
              <Text variant="bodyMedium">Version</Text>
              <Text variant="bodyMedium" style={styles.infoValue}>1.0.0</Text>
            </View>
            
            <View style={styles.infoRow}>
              <Text variant="bodyMedium">Build</Text>
              <Text variant="bodyMedium" style={styles.infoValue}>Android 2025</Text>
            </View>
          </Card.Content>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  header: {
    padding: 20,
    paddingBottom: 10,
  },
  title: {
    color: '#2E7D32',
    marginBottom: 4,
  },
  subtitle: {
    color: '#757575',
  },
  section: {
    marginHorizontal: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    marginBottom: 16,
    color: '#2E7D32',
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 16,
  },
  settingText: {
    flex: 1,
  },
  description: {
    color: '#757575',
    marginTop: 2,
  },
  divider: {
    marginVertical: 12,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  actionText: {
    flex: 1,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  infoValue: {
    color: '#757575',
  },
});