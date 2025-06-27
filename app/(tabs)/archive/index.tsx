import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  Image,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { ThemedIcon } from '@/components/ThemedIcon';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import Animated, {
  FadeInDown,
  FadeOutUp,
  Layout,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { Card } from '@/components/ThemedView';
import { ThemedPressable } from '@/components/ThemedPressable';
import { ThemedSafeAreaView } from '@/components/ThemedSafeAreaView';
import { ThemedText } from '@/components/ThemedText';
import { useColors, useTypography } from '@/hooks/useThemeColor';
import { type BirdSpotting, getBirdSpottings, randomizeSpottingsInBadenWuerttemberg } from '@/services/database';
import { syncDatabase } from '@/services/sync_layer';

// These will be calculated in the styles function based on responsive dimensions

/**
 * Empty state component with animations
 * Displayed when no bird sightings are found in the archive
 * 
 * @param {Object} props - Component props
 * @param {Function} props.onStartLogging - Callback to start logging birds
 * @returns {JSX.Element} Animated empty state with call-to-action
 */
function EmptyState({ onStartLogging }: { onStartLogging: () => void }) {
  const colors = useColors();
  const typography = useTypography();
  const { t } = useTranslation();

  const styles = createEmptyStateStyles();

  const floatAnimation = useSharedValue(0);

  React.useEffect(() => {
    floatAnimation.value = withSpring(1, { damping: 15, stiffness: 300 });
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (floatAnimation.value - 0.5) * 10 }],
    opacity: floatAnimation.value,
  }));

  return (
    <Animated.View style={[styles.emptyState, animatedStyle]}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.backgroundSecondary }]}>
        <ThemedIcon name="archive" size={48} color="primary" />
      </View>

      <ThemedText variant="h2" style={styles.emptyTitle}>
        {t('archive.empty')}
      </ThemedText>

      <ThemedText
        variant="body"
        color="secondary"
        style={styles.emptyDescription}
      >
        Start your birding journey by logging your first sighting
      </ThemedText>

      <ThemedPressable
        variant="primary"
        size="lg"
        onPress={onStartLogging}
        style={[styles.startButton, { backgroundColor: colors.primary }]}
      >
        <ThemedIcon name="plus" size={20} color="inverse" />
        <ThemedText variant="label" style={{ color: colors.textInverse }}>
          {t('archive.start_logging')}
        </ThemedText>
      </ThemedPressable>
    </Animated.View>
  );
}

/**
 * Search header component with search input, sort options, and sync functionality
 * Provides filtering and organization controls for archive content
 * 
 * @param {Object} props - Component props
 * @returns {JSX.Element} Complete search and control interface
 */
function SearchHeader({
  searchQuery,
  onSearchChange,
  sortOrder,
  onSortChange,
  birdTypeFilter,
  onBirdTypeFilterChange,
  uniqueBirdTypes,
  onSync,
  isLoading
}: {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortOrder: 'newest' | 'oldest' | 'alphabetical';
  onSortChange: (order: 'newest' | 'oldest' | 'alphabetical') => void;
  birdTypeFilter: string;
  onBirdTypeFilterChange: (birdType: string) => void;
  uniqueBirdTypes: string[];
  onSync: () => void;
  isLoading: boolean;
}) {
  const colors = useColors();
  const typography = useTypography();
  const { t } = useTranslation();

  const styles = createSearchStyles();

  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Animation values
  const rotation = useSharedValue(0);
  const scale = useSharedValue(1);

  // Handle sync animation
  useEffect(() => {
    if (isLoading) {
      setShowSuccess(false);
      // Start rotation animation
      rotation.value = withRepeat(
        withTiming(360, {
          duration: 1500,
          easing: Easing.linear
        }),
        -1 // Infinite repeat
      );
    } else {
      // Stop rotation
      cancelAnimation(rotation);
      rotation.value = 0;

      // Show success animation with spring physics (matching app's animation style)
      scale.value = withSequence(
        withSpring(1.15, {
          damping: 12,
          stiffness: 200
        }),
        withSpring(1, {
          damping: 15,
          stiffness: 200
        })
      );

      // Show success icon briefly
      setShowSuccess(true);
      const timer = setTimeout(() => {
        scale.value = withSpring(1);
        setShowSuccess(false);
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${rotation.value}deg` },
      { scale: scale.value }
    ]
  }));

  const getSortIcon = () => {
    switch (sortOrder) {
      case 'newest': return 'arrow-down';
      case 'oldest': return 'arrow-up';
      case 'alphabetical': return 'type';
      default: return 'arrow-down';
    }
  };

  const getSortLabel = () => {
    switch (sortOrder) {
      case 'newest': return t('archive.sort_newest');
      case 'oldest': return t('archive.sort_oldest');
      case 'alphabetical': return t('archive.sort_alphabetical');
      default: return t('archive.sort_newest');
    }
  };

  return (
    <View style={styles.searchHeader}>
      {/* Search Bar */}
      <Card style={styles.searchContainer}>
        <ThemedIcon name="search" size={20} color="secondary" />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder={t('archive.search_placeholder')}
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={onSearchChange}
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => onSearchChange('')}>
            <ThemedIcon name="x" size={16} color="secondary" />
          </Pressable>
        )}
      </Card>

      {/* Bird Type Filter */}
      {uniqueBirdTypes.length > 1 && (
        <Card style={styles.filterContainer}>
          <ThemedIcon name="filter" size={16} color="secondary" />
          <View style={styles.filterButtons}>
            {uniqueBirdTypes.slice(0, 4).map((birdType, index) => (
              <ThemedPressable
                key={index}
                variant={birdTypeFilter === birdType ? "primary" : "ghost"}
                size="sm"
                style={styles.filterButton}
                onPress={() => onBirdTypeFilterChange(birdType)}
              >
                <ThemedText
                  variant="bodySmall"
                  numberOfLines={1}
                  color={birdTypeFilter === birdType ? "inverse" : "primary"}
                >
                  {birdType || 'All Birds'}
                </ThemedText>
              </ThemedPressable>
            ))}
          </View>
        </Card>
      )}

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        {/* Sort Button */}
        <ThemedPressable
          variant="ghost"
          style={styles.actionButton}
          onPress={() => setShowSortMenu(!showSortMenu)}
        >
          <ThemedIcon name={getSortIcon()} size={16} color="primary" />
        </ThemedPressable>

        {/* Sync Button */}
        <ThemedPressable
          variant="ghost"
          style={styles.actionButton}
          onPress={onSync}
          disabled={isLoading}
        >
          <Animated.View style={animatedStyle}>
            <ThemedIcon
              name={showSuccess ? "check-circle" : isLoading ? "loader" : "refresh-cw"}
              size={16}
              color={showSuccess ? 'success' : isLoading ? 'secondary' : 'primary'}
            />
          </Animated.View>
        </ThemedPressable>
      </View>

      {/* Sort Menu */}
      {showSortMenu && (
        <Animated.View
          entering={FadeInDown.duration(200)}
          exiting={FadeOutUp.duration(150)}
          style={styles.sortMenu}
        >
          <Card style={styles.sortMenuContent}>
            {[
              { key: 'newest', label: t('archive.sort_newest'), icon: 'arrow-down' as keyof typeof Feather.glyphMap },
              { key: 'oldest', label: t('archive.sort_oldest'), icon: 'arrow-up' as keyof typeof Feather.glyphMap },
              { key: 'alphabetical', label: t('archive.sort_alphabetical'), icon: 'type' as keyof typeof Feather.glyphMap },
            ].map((option) => (
              <Pressable
                key={option.key}
                style={[
                  styles.sortOption,
                  sortOrder === option.key && { backgroundColor: colors.backgroundSecondary }
                ]}
                onPress={() => {
                  onSortChange(option.key as any);
                  setShowSortMenu(false);
                  Haptics.selectionAsync();
                }}
              >
                <ThemedIcon
                  name={option.icon}
                  size={16}
                  color={sortOrder === option.key ? 'primary' : 'secondary'}
                />
                <ThemedText
                  variant="body"
                  color={sortOrder === option.key ? 'primary' : 'secondary'}
                >
                  {option.label}
                </ThemedText>
              </Pressable>
            ))}
          </Card>
        </Animated.View>
      )}
    </View>
  );
}

/**
 * Archive Screen Component with responsive design and search functionality
 * Displays user's bird sighting history with filtering, sorting, and sync capabilities
 * 
 * @returns {JSX.Element} Complete archive screen with bird sighting grid
 */
export default function ArchiveScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const typography = useTypography();
  const { refresh } = useLocalSearchParams<{ refresh?: string }>();

  const styles = createStyles(colors);

  // State management
  const [spottings, setSpottings] = useState<BirdSpotting[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'alphabetical'>('newest');
  const [birdTypeFilter, setBirdTypeFilter] = useState<string>('');
  const [syncing, setSyncing] = useState(false);

  // Load spottings from database
  const loadSpottings = useCallback(async (showRefresh = false) => {
    try {
      if (showRefresh) setRefreshing(true);
      else setLoading(true);

      const data = getBirdSpottings(100, sortOrder === 'oldest' ? 'ASC' : 'DESC');

      // Debug logging for loaded data
      console.log(`[Archive Debug] Loaded ${data.length} spottings from database`);

      // Check each spotting's media URIs
      for (let i = 0; i < Math.min(data.length, 3); i++) {
        const spotting = data[i];
        console.log(`[Archive Debug] Spotting ${i} (ID: ${spotting.id}):`, {
          birdType: spotting.birdType,
          imageUri: spotting.imageUri,
          videoUri: spotting.videoUri,
          hasImage: !!spotting.imageUri,
          hasVideo: !!spotting.videoUri,
          date: spotting.date
        });

        // Check file existence for images
        if (spotting.imageUri) {
          try {
            const fileInfo = await FileSystem.getInfoAsync(spotting.imageUri);
            console.log(`[Archive Debug] File check for spotting ${spotting.id}:`, {
              uri: spotting.imageUri,
              exists: fileInfo.exists,
              size: fileInfo.exists ? (fileInfo as any).size : 'N/A',
              isDirectory: fileInfo.isDirectory
            });
          } catch (fileError) {
            console.error(`[Archive Debug] File check failed for spotting ${spotting.id}:`, {
              uri: spotting.imageUri,
              error: fileError
            });
          }
        }
      }

      setSpottings(data);
    } catch (error) {
      console.error('Failed to load spottings:', error);
      Alert.alert(t('archive.error'), t('archive.load_error'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sortOrder, t]);

  // Get unique bird types for filter
  const uniqueBirdTypes = useMemo(() => {
    const types = spottings
      .map(spotting => spotting.birdType)
      .filter((type): type is string => Boolean(type))
      .filter((type, index, array) => array.indexOf(type) === index)
      .sort();
    return ['', ...types]; // Empty string for "All birds"
  }, [spottings]);

  // Filter and sort spottings
  const filteredSpottings = useMemo(() => {
    let filtered = spottings;

    // Apply bird type filter
    if (birdTypeFilter.trim()) {
      filtered = filtered.filter(spotting =>
        spotting.birdType?.toLowerCase() === birdTypeFilter.toLowerCase()
      );
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(spotting =>
        spotting.birdType?.toLowerCase().includes(query) ||
        spotting.textNote?.toLowerCase().includes(query) ||
        spotting.date?.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    return filtered.sort((a, b) => {
      switch (sortOrder) {
        case 'alphabetical':
          return (a.birdType || '').localeCompare(b.birdType || '');
        case 'oldest':
          return new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime();
        case 'newest':
        default:
          return new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime();
      }
    });
  }, [spottings, searchQuery, sortOrder, birdTypeFilter]);

  // Sync with cloud
  const handleSync = useCallback(async () => {
    try {
      setSyncing(true);
      await syncDatabase();
      await loadSpottings();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Sync failed:', error);
      Alert.alert(t('archive.sync_failed'), error instanceof Error ? error.message : 'Unknown error');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSyncing(false);
    }
  }, [loadSpottings, t]);

  // Handle spotting press
  const handleSpottingPress = useCallback((spotting: BirdSpotting) => {
    Haptics.selectionAsync();
    router.push(`/archive/detail/${spotting.id}`);
  }, []);

  // Navigation handlers
  const handleStartLogging = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/');
  }, []);

  // Load data on mount, when sort changes, or when refresh parameter changes
  useEffect(() => {
    loadSpottings();

    // Randomize locations when the archive page loads
    randomizeSpottingsInBadenWuerttemberg();

    // Cleanup function to prevent memory leaks
    return () => {
      // Cancel any pending operations if needed
      setLoading(false);
      setRefreshing(false);
      setSyncing(false);
    };
  }, [loadSpottings, refresh]);

  // Format date helper
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  // Format location helper
  const formatLocation = (lat: number | null | undefined, lng: number | null | undefined) => {
    if (lat === null || lat === undefined || lng === null || lng === undefined) return undefined;
    if (lat === 0 && lng === 0) return undefined;
    return `${lat.toFixed(2)}, ${lng.toFixed(2)}`;
  };

  // Render spotting card with Pinterest-like layout
  const renderSpotting = useCallback(({ item, index }: { item: BirdSpotting; index: number }) => {
    const hasMedia = !!(item.imageUri || item.videoUri);

    // Basic debug logging for image handling
    if (index < 2) {
      console.log(`[Archive Debug] Item ${index}:`, {
        id: item.id,
        birdType: item.birdType,
        hasMedia,
        imageUri: item.imageUri ? 'present' : 'none'
      });
    }

    return (
      <Animated.View
        entering={FadeInDown.delay(index * 30).springify()}
        layout={Layout.springify()}
        style={styles.cardContainer}
      >
        <ThemedPressable
          variant="ghost"
          onPress={() => handleSpottingPress(item)}
          style={styles.spottingCard}
        >
          <Card style={styles.spottingCardInner}>
            {/* Media Section - Always present for consistent card heights */}
            {(() => {
              const imageUri = hasMedia ? (item.imageUri || item.videoUri) : null;

              // Calculate responsive dimensions
              const screenWidth = Dimensions.get('window').width;
              const cardMargin = 6;
              const horizontalPadding = 12;
              const cardsPerRow = 2;
              const cardWidth = (screenWidth - (horizontalPadding * 2) - (cardMargin * (cardsPerRow + 1))) / cardsPerRow;
              const imageHeight = cardWidth * 0.85;

              return (
                <View style={styles.mediaSection}>
                  {hasMedia ? (
                    <>
                      <Image
                        source={{ uri: imageUri! }}
                        style={[
                          styles.spottingImage,
                          {
                            // Force explicit dimensions for proper display
                            width: cardWidth,
                            height: imageHeight,
                            alignSelf: 'center'
                          }
                        ]}
                        resizeMode="cover"
                        onError={(error) => {
                          console.error(`[Archive Error] Image load failed for item ${item.id}:`, {
                            uri: item.imageUri || item.videoUri,
                            error: error.nativeEvent,
                            item: item
                          });
                        }}
                        onLoad={(event) => {
                          console.log(`[Archive Success] Image loaded for item ${item.id}:`, {
                            uri: item.imageUri || item.videoUri,
                            source: event.nativeEvent.source,
                            dimensions: `${event.nativeEvent.source.width}x${event.nativeEvent.source.height}`
                          });
                        }}
                        onLoadStart={() => {
                          console.log(`[Archive Loading] Image load started for item ${item.id}:`, item.imageUri || item.videoUri);
                        }}
                        onLoadEnd={() => {
                          console.log(`[Archive LoadEnd] Image load ended for item ${item.id}:`, item.imageUri || item.videoUri);
                        }}
                      />
                      {/* Media overlay indicators */}
                      <View style={styles.mediaOverlay}>
                        {item.videoUri && (
                          <View style={styles.videoIndicator}>
                            <ThemedIcon name="play" size={12} color="inverse" />
                          </View>
                        )}
                        {item.audioUri && (
                          <View style={styles.audioIndicator}>
                            <ThemedIcon name="mic" size={10} color="inverse" />
                          </View>
                        )}
                      </View>
                    </>
                  ) : (
                    // Placeholder for cards without media to maintain consistent height
                    <View
                      style={[
                        styles.spottingImage,
                        {
                          width: cardWidth,
                          height: imageHeight,
                          alignSelf: 'center',
                          backgroundColor: 'transparent',
                          justifyContent: 'center',
                          alignItems: 'center'
                        }
                      ]}
                    >
                      {/* Empty placeholder - could add an icon if desired */}
                    </View>
                  )}
                </View>
              );
            })()}

            {/* Content Section */}
            <View style={[styles.spottingContent, styles.mediaContentPadding]}>
              <ThemedText variant="bodySmall" numberOfLines={2} style={styles.birdName}>
                {item.birdType || t('archive.unknown_bird')}
              </ThemedText>

              {item.latinBirDex && (
                <ThemedText variant="caption" color="secondary" numberOfLines={1} style={styles.latinName}>
                  {item.latinBirDex}
                </ThemedText>
              )}

              <View style={styles.metaInfo}>
                <ThemedText variant="caption" color="tertiary" style={styles.dateText}>
                  {formatDate(item.date)}
                </ThemedText>
                {formatLocation(item.gpsLat, item.gpsLng) && (
                  <View style={styles.locationRow}>
                    <ThemedIcon name="map-pin" size={8} color="tertiary" />
                    <ThemedText variant="caption" color="tertiary" numberOfLines={1} style={styles.locationText}>
                      {formatLocation(item.gpsLat, item.gpsLng)}
                    </ThemedText>
                  </View>
                )}
              </View>

              {/* Text-only cards get audio indicator */}
              {!hasMedia && item.audioUri && (
                <View style={styles.audioOnlyIndicator}>
                  <ThemedIcon name="mic" size={12} color="primary" />
                </View>
              )}
            </View>
          </Card>
        </ThemedPressable>
      </Animated.View>
    );
  }, [handleSpottingPress, t, formatDate, formatLocation]);

  // Loading state
  if (loading) {
    return (
      <ThemedSafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ThemedIcon name="archive" size={48} color="primary" />
          <ThemedText variant="body" color="secondary" style={styles.loadingText}>
            {t('archive.loading')}
          </ThemedText>
        </View>
      </ThemedSafeAreaView>
    );
  }

  return (
    <ThemedSafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerText}>
            <ThemedText variant="h2" style={styles.title}>
              {t('archive.title')}
            </ThemedText>
            <ThemedText variant="body" color="secondary" style={styles.subtitle}>
              {t('archive.subtitle', { count: filteredSpottings.length })}
            </ThemedText>
          </View>
          <View style={styles.actionButtons}>
            <ThemedPressable
              variant="secondary"
              size="sm"
              onPress={() => {
                Haptics.selectionAsync();
                router.push('/(tabs)/gallery');
              }}
              style={styles.actionButton}
            >
              <ThemedIcon name="image" size={16} color="secondary" />
              <ThemedText variant="labelMedium" color="secondary">
                {t('archive.gallery')}
              </ThemedText>
            </ThemedPressable>
            <ThemedPressable
              variant="secondary"
              size="sm"
              onPress={() => {
                Haptics.selectionAsync();
                router.push('/(tabs)/archive/map');
              }}
              style={styles.actionButton}
            >
              <ThemedIcon name="map" size={16} color="secondary" />
              <ThemedText variant="labelMedium" color="secondary">
                {t('archive.map')}
              </ThemedText>
            </ThemedPressable>
          </View>
        </View>
      </View>

      {/* Search and Actions */}
      <SearchHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        sortOrder={sortOrder}
        onSortChange={setSortOrder}
        birdTypeFilter={birdTypeFilter}
        onBirdTypeFilterChange={setBirdTypeFilter}
        uniqueBirdTypes={uniqueBirdTypes}
        onSync={handleSync}
        isLoading={syncing}
      />

      {/* Content */}
      {filteredSpottings.length === 0 ? (
        searchQuery ? (
          <View style={styles.noResultsContainer}>
            <ThemedIcon name="search" size={48} color="secondary" />
            <ThemedText variant="h3" color="secondary">
              {t('archive.no_search_results')}
            </ThemedText>
            <ThemedText variant="body" color="secondary">
              {t('archive.try_different_search')}
            </ThemedText>
          </View>
        ) : (
          <EmptyState onStartLogging={handleStartLogging} />
        )
      ) : (
        <FlatList
          data={filteredSpottings}
          renderItem={renderSpotting}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          numColumns={2}
          removeClippedSubviews={false}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={styles.row}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadSpottings(true)}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        />
      )}
    </ThemedSafeAreaView>
  );
}

/**
 * Creates styles for empty state component
 */
function createEmptyStateStyles() {
  return StyleSheet.create({
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 20,
      gap: 32,
    },
    emptyIcon: {
      width: 120,
      height: 120,
      borderRadius: 60,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 8,
    },
    emptyTitle: {
      textAlign: 'center',
      fontWeight: '600',
    },
    emptyDescription: {
      textAlign: 'center',
      lineHeight: 22,
      maxWidth: 280,
    },
    startButton: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 8,
    },
  });
}

/**
 * Creates styles for search header component
 */
function createSearchStyles() {
  return StyleSheet.create({
    actionIcon: {
      margin: -2
    },
    searchHeader: {
      paddingHorizontal: 20,
      marginBottom: 16,
      position: 'relative',
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      marginBottom: 16,
      gap: 16,
      height: 48,
    },
    searchInput: {
      flex: 1,
      fontSize: 16,
    },
    actionButtons: {
      flexDirection: 'row',
      gap: 25,
      overflow: 'visible',
    },
    actionButton: {
      width: 50,
      height: 50,
      borderRadius: 22,
      justifyContent: 'center',
      alignItems: 'center',
    },
    sortMenu: {
      position: 'absolute',
      top: '100%',
      right: 0,
      zIndex: 10,
      marginTop: 8,
    },
    sortMenuContent: {
      borderRadius: 8,
      borderWidth: 1,
      overflow: 'hidden',
      minWidth: 160,
    },
    sortOption: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 16,
      gap: 16,
      minHeight: 44,
    },
    filterContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
      marginBottom: 8,
      gap: 12,
    },
    filterButtons: {
      flexDirection: 'row',
      flex: 1,
      gap: 8,
    },
    filterButton: {
      flex: 1,
      minHeight: 32,
    },
  });
}

/**
 * Creates styles for main archive screen with Pinterest-like layout
 */
function createStyles(colors?: any) {
  const screenWidth = Dimensions.get('window').width;
  const cardMargin = 6;
  const horizontalPadding = 12;
  const cardsPerRow = 2;
  const cardWidth = (screenWidth - (horizontalPadding * 2) - (cardMargin * (cardsPerRow + 1))) / cardsPerRow;

  // Debug logging for style calculations
  console.log('[Archive Debug] Style calculations:', {
    screenWidth,
    cardMargin,
    horizontalPadding,
    cardsPerRow,
    cardWidth,
    imageHeight: cardWidth * 0.75,
    minHeight: 100,
    maxHeight: cardWidth * 1.2
  });

  return StyleSheet.create({
    container: {
      flex: 1,
      paddingTop: 32,
    },

    // Header
    header: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 24,
    },
    headerContent: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
    },
    headerText: {
      flex: 1,
      marginRight: 16,
    },
    title: {
      fontWeight: 'bold',
      marginBottom: 4,
    },
    subtitle: {
      opacity: 0.8,
    },
    actionButtons: {
      flexDirection: 'row',
      gap: 8,
    },
    actionButton: {
      flexDirection: 'row',
      gap: 4,
    },

    // Pinterest-style List
    listContent: {
      paddingHorizontal: horizontalPadding,
      paddingBottom: 32,
    },
    row: {
      justifyContent: 'space-between',
      gap: cardMargin,
    },

    // Card Containers - Consistent height for all cards
    cardContainer: {
      width: cardWidth,
      marginBottom: cardMargin,
    },

    // Card Structure
    spottingCard: {
      borderRadius: 12,
      overflow: 'hidden',
    },
    spottingCardInner: {
      overflow: 'hidden',
      padding: 0,
      borderRadius: 12,
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
    },

    // Media Section
    mediaSection: {
      position: 'relative',
      width: '100%',
    },
    spottingImage: {
      width: '100%',
      height: cardWidth * 0.85, // Increased height for landscape images
      minHeight: 120,
      maxHeight: cardWidth * 1.4,
      backgroundColor: colors?.backgroundSecondary || '#f0f0f0', // Themed placeholder background
    },
    mediaOverlay: {
      position: 'absolute',
      top: 6,
      right: 6,
      flexDirection: 'row',
      gap: 4,
    },
    videoIndicator: {
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      borderRadius: 10,
      width: 20,
      height: 20,
      justifyContent: 'center',
      alignItems: 'center',
    },
    audioIndicator: {
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      borderRadius: 8,
      width: 16,
      height: 16,
      justifyContent: 'center',
      alignItems: 'center',
    },

    // Content Section
    spottingContent: {
      gap: 3,
    },
    mediaContentPadding: {
      padding: 8,
    },
    textContentPadding: {
      padding: 12,
    },

    // Text Styles
    birdName: {
      fontWeight: '600',
      fontSize: 13,
      lineHeight: 16,
    },
    latinName: {
      fontSize: 11,
      fontStyle: 'italic',
      opacity: 0.8,
    },

    // Meta Information
    metaInfo: {
      marginTop: 4,
      gap: 2,
    },
    dateText: {
      fontSize: 10,
      opacity: 0.7,
    },
    locationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    locationText: {
      fontSize: 10,
      opacity: 0.7,
      flex: 1,
    },

    // Audio-only indicator
    audioOnlyIndicator: {
      position: 'absolute',
      top: 8,
      right: 8,
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      borderRadius: 12,
      width: 24,
      height: 24,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 2,
      elevation: 2,
    },

    // Empty States
    noResultsContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 20,
      gap: 16,
    },

    // Loading
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 16,
    },
    loadingText: {
      textAlign: 'center',
    },
  });
}