import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import {useTranslation} from 'react-i18next';
import {ThemedIcon} from '@/components/ThemedIcon';
import {BlurView} from 'expo-blur';
import {router} from 'expo-router';
import Animated, {
  FadeInDown,
  FadeOutUp,
  Layout,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import {ThemedView, Card} from '@/components/ThemedView';
import {ThemedPressable} from '@/components/ThemedPressable';
import {ThemedText} from '@/components/ThemedText';
import {Button} from '@/components/Button';
import {useColors, useTypography, useBorderRadius, useShadows, useSpacing} from '@/hooks/useThemeColor';
import {type BirdSpotting, getBirdSpottings} from '@/services/database';
import {syncDatabase} from '@/services/sync_layer';

const { width } = Dimensions.get('window');
const CARD_MARGIN = 16;
const CARDS_PER_ROW = 2;
const CARD_WIDTH = (width - (CARD_MARGIN * 3)) / CARDS_PER_ROW;

// Enhanced empty state component
function EnhancedEmptyState({ onStartLogging }: { onStartLogging: () => void }) {
  const colors = useColors();
  const typography = useTypography();
  const { t } = useTranslation();

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
            style={styles.startButton}
        >
          <ThemedIcon name="plus" size={20} color="primary" />
          <ThemedText variant="label" color="primary">
            {t('archive.start_logging')}
          </ThemedText>
        </ThemedPressable>
      </Animated.View>
  );
}

// Search header component
function SearchHeader({
                        searchQuery,
                        onSearchChange,
                        sortOrder,
                        onSortChange,
                        onSync,
                        isLoading
                      }: {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortOrder: 'newest' | 'oldest' | 'alphabetical';
  onSortChange: (order: 'newest' | 'oldest' | 'alphabetical') => void;
  onSync: () => void;
  isLoading: boolean;
}) {
  const colors = useColors();
  const typography = useTypography();
  const { t } = useTranslation();

  const [showSortMenu, setShowSortMenu] = useState(false);

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
                <ThemedIcon name="x" size={18} color="secondary" />
              </Pressable>
          )}
        </Card>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          {/* Sort Button */}
          <ThemedPressable
              variant="ghost"
              style={styles.actionButton}
              onPress={() => setShowSortMenu(!showSortMenu)}
          >
            <ThemedIcon name={getSortIcon()} size={18} color="primary" />
          </ThemedPressable>

          {/* Sync Button */}
          <ThemedPressable
              variant="ghost"
              style={styles.actionButton}
              onPress={onSync}
              disabled={isLoading}
          >
            <ThemedIcon
                name="refresh-cw"
                size={18}
                color={isLoading ? 'secondary' : 'primary'}
            />
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
                  { key: 'newest', label: t('archive.sort_newest'), icon: 'arrow-down' },
                  { key: 'oldest', label: t('archive.sort_oldest'), icon: 'arrow-up' },
                  { key: 'alphabetical', label: t('archive.sort_alphabetical'), icon: 'a-z' },
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

export default function ArchiveScreen() {
  const {t} = useTranslation();
  const colors = useColors();
  const typography = useTypography();

  // State management
  const [spottings, setSpottings] = useState<BirdSpotting[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'alphabetical'>('newest');
  const [syncing, setSyncing] = useState(false);

  // Load spottings from database
  const loadSpottings = useCallback(async (showRefresh = false) => {
    try {
      if (showRefresh) setRefreshing(true);
      else setLoading(true);

      const data = getBirdSpottings(100, sortOrder === 'oldest' ? 'ASC' : 'DESC');
      setSpottings(data);
    } catch (error) {
      console.error('Failed to load spottings:', error);
      Alert.alert(t('archive.error'), t('archive.load_error'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sortOrder, t]);

  // Filter and sort spottings
  const filteredSpottings = useMemo(() => {
    let filtered = spottings;

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
  }, [spottings, searchQuery, sortOrder]);

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

  // Load data on mount and when sort changes
  useEffect(() => {
    loadSpottings();
  }, [loadSpottings]);

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
  const formatLocation = (lat?: number, lng?: number) => {
    if (!lat || !lng) return undefined;
    return `${lat.toFixed(2)}, ${lng.toFixed(2)}`;
  };

  // Render spotting card
  const renderSpotting = useCallback(({item, index}: { item: BirdSpotting; index: number }) => (
      <Animated.View
          entering={FadeInDown.delay(index * 50).springify()}
          layout={Layout.springify()}
          style={[styles.cardContainer, {width: CARD_WIDTH}]}
      >
        <ThemedPressable
            variant="ghost"
            onPress={() => handleSpottingPress(item)}
            style={styles.spottingCard}
        >
          <Card style={styles.spottingCardInner}>
            {item.imageUri && (
              <Image source={{uri: item.imageUri}} style={styles.spottingImage} />
            )}
            <View style={styles.spottingContent}>
              <ThemedText variant="body" numberOfLines={1} style={styles.birdName}>
                {item.birdType || t('archive.unknown_bird')}
              </ThemedText>
              {item.latinBirDex && (
                <ThemedText variant="bodySmall" color="secondary" numberOfLines={1}>
                  {item.latinBirDex}
                </ThemedText>
              )}
              <ThemedText variant="caption" color="secondary">
                {formatDate(item.date)}
              </ThemedText>
              {formatLocation(item.gpsLat, item.gpsLng) && (
                <ThemedText variant="caption" color="secondary" numberOfLines={1}>
                  {formatLocation(item.gpsLat, item.gpsLng)}
                </ThemedText>
              )}
              <View style={styles.mediaIndicators}>
                {item.audioUri && <ThemedIcon name="mic" size={12} color="primary" />}
                {item.videoUri && <ThemedIcon name="video" size={12} color="primary" />}
              </View>
            </View>
          </Card>
        </ThemedPressable>
      </Animated.View>
  ), [handleSpottingPress, t, colors]);

  // Loading state
  if (loading) {
    return (
        <SafeAreaView style={[styles.container, {backgroundColor: colors.background}]}>
          <View style={styles.loadingContainer}>
            <ThemedIcon name="archive" size={48} color="primary"/>
            <ThemedText variant="body" color="secondary" style={styles.loadingText}>
              {t('archive.loading')}
            </ThemedText>
          </View>
        </SafeAreaView>
    );
  }

  return (
      <SafeAreaView style={[styles.container, {backgroundColor: colors.background}]}>
        {/* Header */}
        <View style={styles.header}>
          <ThemedText variant="h2" style={styles.title}>
            {t('archive.title')}
          </ThemedText>
          <ThemedText variant="body" color="secondary" style={styles.subtitle}>
            {t('archive.subtitle', {count: filteredSpottings.length})}
          </ThemedText>
        </View>

        {/* Search and Actions */}
        <SearchHeader
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            sortOrder={sortOrder}
            onSortChange={setSortOrder}
            onSync={handleSync}
            isLoading={syncing}
        />

        {/* Content */}
        {filteredSpottings.length === 0 ? (
            searchQuery ? (
                <View style={styles.noResultsContainer}>
                  <ThemedIcon name="search" size={48} color="secondary"/>
                  <ThemedText variant="h3" color="secondary">
                    {t('archive.no_search_results')}
                  </ThemedText>
                  <ThemedText variant="body" color="secondary">
                    {t('archive.try_different_search')}
                  </ThemedText>
                </View>
            ) : (
                <EnhancedEmptyState onStartLogging={handleStartLogging}/>
            )
        ) : (
            <FlatList
                data={filteredSpottings}
                renderItem={renderSpotting}
                keyExtractor={(item) => item.id.toString()}
                numColumns={CARDS_PER_ROW}
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
                ItemSeparatorComponent={() => <View style={styles.separator}/>}
            />
        )}
      </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 40,
  },

  // Header
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  title: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    opacity: 0.8,
  },

  // Search Header
  searchHeader: {
    paddingHorizontal: 24,
    marginBottom: 16,
    position: 'relative',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Sort Menu
  sortMenu: {
    position: 'absolute',
    top: '100%',
    right: 0,
    zIndex: 10,
    marginTop: 8,
  },
  sortMenuContent: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    minWidth: 160,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },

  // List
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  row: {
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  cardContainer: {
    marginBottom: 16,
  },
  spottingCard: {
    borderRadius: 12,
  },
  spottingCardInner: {
    overflow: 'hidden',
    padding: 0,
  },
  spottingImage: {
    width: '100%',
    height: 80,
    resizeMode: 'cover',
  },
  spottingContent: {
    padding: 12,
    gap: 4,
  },
  birdName: {
    fontWeight: '600',
  },
  mediaIndicators: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  separator: {
    height: 8,
  },

  // Empty States
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 24,
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

  noResultsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
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