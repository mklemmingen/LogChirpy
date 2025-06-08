import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, FAB } from 'react-native-paper';

import OptimizedBirdList from '../../components/OptimizedBirdList';

interface BirdSighting {
  id: string;
  species: string;
  confidence: number;
  timestamp: Date;
  location?: {
    latitude: number;
    longitude: number;
  };
  image?: string;
}

export default function LogScreen() {
  const [sightings] = useState<BirdSighting[]>([
    {
      id: '1',
      species: 'Northern Cardinal',
      confidence: 0.95,
      timestamp: new Date(),
      location: { latitude: 40.7128, longitude: -74.0060 }
    },
    {
      id: '2',
      species: 'Blue Jay',
      confidence: 0.88,
      timestamp: new Date(Date.now() - 86400000),
      location: { latitude: 40.7580, longitude: -73.9855 }
    }
  ]);

  const handleSightingPress = (sighting: BirdSighting) => {
    console.log('Sighting pressed:', sighting.species);
    // Navigate to detail view or show modal
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.title}>
          Bird Sightings
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          {sightings.length} birds logged
        </Text>
      </View>

      <OptimizedBirdList 
        sightings={sightings}
        onItemPress={handleSightingPress}
      />

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => {}}
        label="Add Sighting"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    padding: 20,
    paddingBottom: 10,
    backgroundColor: '#FFFFFF',
    elevation: 2,
  },
  title: {
    color: '#2E7D32',
    marginBottom: 4,
  },
  subtitle: {
    color: '#757575',
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 16,
  },
});