import React, { useMemo, useCallback } from 'react';
import { View, StyleSheet, Dimensions, Platform } from 'react-native';
import { Card, Text, Chip } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { RecyclerListView, DataProvider, LayoutProvider } from 'recyclerlistview';

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

interface OptimizedBirdListProps {
  sightings: BirdSighting[];
  onItemPress?: (sighting: BirdSighting) => void;
}

const { width: screenWidth } = Dimensions.get('window');
const ITEM_HEIGHT = 120;
const VIEW_TYPES = {
  BIRD_ITEM: 0,
};

export default function OptimizedBirdList({ sightings, onItemPress }: OptimizedBirdListProps) {
  
  // RecyclerListView DataProvider for memory optimization
  const dataProvider = useMemo(
    () => new DataProvider((r1, r2) => r1.id !== r2.id).cloneWithRows(sightings),
    [sightings]
  );

  // LayoutProvider for RecyclerListView with Android optimizations
  const layoutProvider = useMemo(
    () => new LayoutProvider(
      (index) => VIEW_TYPES.BIRD_ITEM,
      (type, dim) => {
        switch (type) {
          case VIEW_TYPES.BIRD_ITEM:
            dim.width = screenWidth;
            dim.height = ITEM_HEIGHT;
            break;
          default:
            dim.width = 0;
            dim.height = 0;
        }
      }
    ),
    [screenWidth]
  );
  
  const renderItem = useCallback((type: string | number, item: BirdSighting) => {
    return (
      <View 
        style={styles.itemContainer}
      >
        <Card 
          style={styles.card}
          onPress={() => onItemPress?.(item)}
          mode="elevated"
        >
          <Card.Content style={styles.cardContent}>
            <View style={styles.header}>
              <Text variant="titleMedium" style={styles.species}>
                {item.species}
              </Text>
              <Chip 
                compact 
                mode="outlined"
                textStyle={styles.chipText}
                style={styles.chip}
              >
                {Math.round(item.confidence * 100)}%
              </Chip>
            </View>
            
            <View style={styles.metadataRow}>
              <MaterialCommunityIcons 
                name="clock-outline" 
                size={14} 
                color="#757575" 
                style={styles.icon}
              />
              <Text variant="bodySmall" style={styles.timestamp}>
                {item.timestamp.toLocaleDateString()} at {item.timestamp.toLocaleTimeString()}
              </Text>
            </View>
            
            {item.location && (
              <View style={styles.metadataRow}>
                <MaterialCommunityIcons 
                  name="map-marker-outline" 
                  size={14} 
                  color="#757575" 
                  style={styles.icon}
                />
                <Text variant="bodySmall" style={styles.location}>
                  {item.location.latitude.toFixed(4)}, {item.location.longitude.toFixed(4)}
                </Text>
              </View>
            )}
          </Card.Content>
        </Card>
      </View>
    );
  }, [onItemPress]);

  if (sightings.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <MaterialCommunityIcons 
          name="binoculars" 
          size={64} 
          color="#BDBDBD" 
          style={styles.emptyIcon}
        />
        <Text variant="titleMedium" style={styles.emptyTitle}>
          No bird sightings yet
        </Text>
        <Text variant="bodyMedium" style={styles.emptySubtitle}>
          Start detecting to see your sightings here
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      <RecyclerListView
        style={styles.recyclerList}
        dataProvider={dataProvider}
        layoutProvider={layoutProvider}
        rowRenderer={renderItem}
        // Android ViewGroup optimizations
        {...(Platform.OS === 'android' && {
          forceNonDeterministicRendering: false,
          disableRecycling: false,
          renderAheadOffset: 250,
          optimizeForInsertDeleteAnimations: true,
        })}
        // Performance optimizations
        canChangeSize={true}
        scrollViewProps={{
          showsVerticalScrollIndicator: false,
          bounces: false,
          overScrollMode: 'never',
          removeClippedSubviews: true,
          // Android-specific optimizations
          ...(Platform.OS === 'android' && {
            persistentScrollbar: false,
            fadingEdgeLength: 0,
            nestedScrollEnabled: false,
          }),
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  recyclerList: {
    flex: 1,
    minHeight: 1,
    minWidth: 1,
  },
  itemContainer: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  card: {
    marginBottom: 12,
    elevation: 2,
  },
  cardContent: {
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  species: {
    flex: 1,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginRight: 12,
  },
  chip: {
    backgroundColor: '#E8F5E8',
    borderColor: '#4CAF50',
  },
  chipText: {
    color: '#2E7D32',
    fontSize: 12,
    fontWeight: 'bold',
  },
  metadataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  icon: {
    marginRight: 6,
    width: 16,
  },
  timestamp: {
    color: '#757575',
    flex: 1,
  },
  location: {
    color: '#757575',
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#F5F5F5',
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyTitle: {
    marginBottom: 8,
    textAlign: 'center',
    color: '#424242',
  },
  emptySubtitle: {
    textAlign: 'center',
    color: '#757575',
    maxWidth: 250,
  },
});