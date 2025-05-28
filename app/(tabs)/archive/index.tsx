import {useCallback, useEffect, useState} from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from "react-native";
import NetInfo from "@react-native-community/netinfo";
import {useTranslation} from "react-i18next";
import {router} from "expo-router";
import {Feather} from "@expo/vector-icons";
import * as MediaLibrary from "expo-media-library";
import {BlurView} from "expo-blur";
import {useSafeAreaInsets} from "react-native-safe-area-context";

import {theme} from "@/constants/theme";
import {type BirdSpotting, getBirdSpottings} from "@/services/database";
import {auth} from "@/firebase/config";
import {ThemedSnackbar} from "@/components/ThemedSnackbar";
import {syncDatabase} from "@/services/sync_layer";

// Use the BirdSpotting type from your database service
type Spotting = BirdSpotting;

type SortOption = 'newest' | 'oldest' | 'alphabetical';

export default function ArchiveScreen() {
  const { t } = useTranslation();
  const scheme = useColorScheme() ?? "light";
  const pal = theme[scheme];
  const insets = useSafeAreaInsets();

  const [rows, setRows] = useState<Spotting[]>([]);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [showSortMenu, setShowSortMenu] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [online, setOnline] = useState(false);
  const [snackbar, setSnackbar] = useState(false);

  const snackbarMsg = t("archive.not_logged_in");

  const sortOptions: { key: SortOption; label: string; icon: string }[] = [
    { key: 'newest', label: t('archive.sort_newest'), icon: 'arrow-down' },
    { key: 'oldest', label: t('archive.sort_oldest'), icon: 'arrow-up' },
    { key: 'alphabetical', label: t('archive.sort_alphabetical'), icon: 'type' },
  ];

  // Network connection monitoring
  useEffect(() => {
    const unsub = NetInfo.addEventListener((s) =>
        setOnline(s.isConnected ?? false)
    );
    return () => unsub();
  }, []);

  // Media permissions
  useEffect(() => {
    (async () => {
      const { status } = await MediaLibrary.getPermissionsAsync();
      if (status !== "granted") {
        await MediaLibrary.requestPermissionsAsync(true);
      }
    })();
  }, []);

  // Load and filter data
  const loadData = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      setStatus(t("archive.loading"));

      // Get sort direction based on selection
      const sortDirection = sortBy === 'oldest' ? 'ASC' : 'DESC';
      let data = getBirdSpottings(100, sortDirection);

      // Apply search filter - using correct camelCase property names
      if (query.trim()) {
        const q = query.trim().toLowerCase();
        data = data.filter(
            (r) =>
                r.birdType?.toLowerCase().includes(q) ||
                r.date?.toLowerCase().includes(q) ||
                r.textNote?.toLowerCase().includes(q)
        );
      }

      // Apply alphabetical sort if selected - using correct camelCase property name
      if (sortBy === 'alphabetical') {
        data = data.sort((a, b) =>
            (a.birdType || '').localeCompare(b.birdType || '')
        );
      }

      setRows(data);
      setStatus("");
    } catch (e) {
      console.error(e);
      setStatus(t("archive.load_error"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [query, sortBy, t]);

  // Initial load and reload on dependencies change
  useEffect(() => {
    const timeoutId = setTimeout(() => loadData(), 300); // Debounce search
    return () => clearTimeout(timeoutId);
  }, [loadData]);

  // Sync database
  const handleSync = async () => {
    if (!online) return;
    if (!auth.currentUser) {
      setSnackbar(true);
      return;
    }
    try {
      setStatus(t("archive.syncing"));
      await syncDatabase();
      setStatus(t("archive.sync_ok"));
      await loadData(false);
    } catch (e) {
      console.error(e);
      setStatus(t("archive.sync_failed"));
    }
  };

  // Refresh handler
  const handleRefresh = () => {
    setRefreshing(true);
    loadData(false);
  };

  // Sort handler
  const handleSort = (option: SortOption) => {
    setSortBy(option);
    setShowSortMenu(false);
  };

  // Render spotting card
  const renderSpottingCard = useCallback(
      ({ item }: { item: Spotting }) => (
          <BlurView
              intensity={60}
              tint={scheme === "dark" ? "dark" : "light"}
              style={[styles.spottingCard, { borderColor: pal.colors.border }]}
          >
            <Pressable
                style={styles.cardContent}
                onPress={() =>
                    router.push({
                      pathname: "/archive/detail/[id]",
                      params: { id: item.id },
                    })
                }
                android_ripple={{ color: pal.colors.primary + '20' }}
            >
              {/* Image - using correct camelCase property name */}
              {item.imageUri ? (
                  <Image source={{ uri: item.imageUri }} style={styles.cardImage} />
              ) : (
                  <View style={[styles.cardImagePlaceholder, { backgroundColor: pal.colors.statusBar }]}>
                    <Feather name="camera" size={24} color={pal.colors.text.secondary} />
                  </View>
              )}

              {/* Content */}
              <View style={styles.cardInfo}>
                <View style={styles.cardHeader}>
                  <Text style={[styles.cardTitle, { color: pal.colors.text.primary }]} numberOfLines={1}>
                    {item.birdType || t("archive.unknown_bird")}
                  </Text>
                  <Text style={[styles.cardDate, { color: pal.colors.text.secondary }]}>
                    {new Date(item.date).toLocaleDateString()}
                  </Text>
                </View>

                {item.textNote && (
                    <Text
                        style={[styles.cardNote, { color: pal.colors.text.secondary }]}
                        numberOfLines={2}
                    >
                      {item.textNote}
                    </Text>
                )}

                {/* Location indicator - using correct camelCase property names */}
                {item.gpsLat && item.gpsLng && (
                    <View style={styles.locationContainer}>
                      <Feather name="map-pin" size={12} color={pal.colors.text.secondary} />
                      <Text style={[styles.locationText, { color: pal.colors.text.secondary }]}>
                        {t('archive.hasLocation')}
                      </Text>
                    </View>
                )}

                {/* Media indicators - using correct camelCase property names */}
                <View style={styles.mediaIndicators}>
                  {item.imageUri && <Feather name="image" size={14} color={pal.colors.primary} />}
                  {item.videoUri && <Feather name="video" size={14} color={pal.colors.primary} />}
                  {item.audioUri && <Feather name="mic" size={14} color={pal.colors.primary} />}
                </View>
              </View>

              {/* Chevron */}
              <Feather name="chevron-right" size={20} color={pal.colors.text.secondary} />
            </Pressable>
          </BlurView>
      ),
      [pal, t, scheme]
  );

  // Render sort menu
  const renderSortMenu = () => (
      showSortMenu && (
          <BlurView
              intensity={80}
              tint={scheme === "dark" ? "dark" : "light"}
              style={[styles.sortMenu, { borderColor: pal.colors.border }]}
          >
            {sortOptions.map((option) => (
                <Pressable
                    key={option.key}
                    style={[
                      styles.sortOption,
                      { borderBottomColor: pal.colors.border },
                      sortBy === option.key && { backgroundColor: pal.colors.primary + '20' }
                    ]}
                    onPress={() => handleSort(option.key)}
                >
                  <Feather name={option.icon as any} size={16} color={pal.colors.text.secondary} />
                  <Text style={[styles.sortOptionText, { color: pal.colors.text.primary }]}>
                    {option.label}
                  </Text>
                  {sortBy === option.key && (
                      <Feather name="check" size={16} color={pal.colors.primary} />
                  )}
                </Pressable>
            ))}
          </BlurView>
      )
  );

  // Loading state
  if (loading) {
    return (
        <SafeAreaView style={[styles.loadingContainer, { backgroundColor: pal.colors.background }]}>
          <ActivityIndicator size="large" color={pal.colors.primary} />
          {status && (
              <Text style={[styles.loadingText, { color: pal.colors.text.secondary }]}>
                {status}
              </Text>
          )}
        </SafeAreaView>
    );
  }

  return (
      <SafeAreaView style={[styles.container, { backgroundColor: pal.colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { marginTop: insets.top }]}>
          <Text style={[styles.headerTitle, { color: pal.colors.text.primary }]}>
            {t('archive.title')}
          </Text>
          <Text style={[styles.headerSubtitle, { color: pal.colors.text.secondary }]}>
            {t('archive.subtitle', { count: rows.length })}
          </Text>
        </View>

        {/* Search and controls */}
        <View style={styles.controlsContainer}>
          <View style={[styles.searchContainer, { borderColor: pal.colors.border }]}>
            <Feather name="search" size={18} color={pal.colors.text.secondary} />
            <TextInput
                style={[styles.searchInput, { color: pal.colors.text.primary }]}
                placeholder={t("archive.search_placeholder")}
                placeholderTextColor={pal.colors.text.secondary}
                value={query}
                onChangeText={setQuery}
            />
            {query.length > 0 && (
                <Pressable onPress={() => setQuery('')}>
                  <Feather name="x" size={18} color={pal.colors.text.secondary} />
                </Pressable>
            )}
          </View>

          <Pressable
              style={[styles.sortButton, { backgroundColor: pal.colors.statusBar, borderColor: pal.colors.border }]}
              onPress={() => setShowSortMenu(!showSortMenu)}
          >
            <Feather name="filter" size={18} color={pal.colors.text.primary} />
          </Pressable>

          {online && (
              <Pressable
                  style={[styles.syncButton, { backgroundColor: pal.colors.primary }]}
                  onPress={handleSync}
              >
                <Feather name="refresh-cw" size={18} color={pal.colors.text.primary} />
              </Pressable>
          )}
        </View>

        {/* Sort Menu */}
        {renderSortMenu()}

        {/* Status */}
        {status && (
            <Text style={[styles.statusText, { color: pal.colors.text.secondary }]}>
              {status}
            </Text>
        )}

        {/* Spottings List */}
        <FlatList
            data={rows}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderSpottingCard}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Feather name="eye" size={48} color={pal.colors.text.secondary} />
                <Text style={[styles.emptyText, { color: pal.colors.text.secondary }]}>
                  {query ? t('archive.no_search_results') : t('archive.empty')}
                </Text>
                {query && (
                    <Text style={[styles.emptySubtext, { color: pal.colors.text.secondary }]}>
                      {t('archive.try_different_search')}
                    </Text>
                )}
                {!query && (
                    <Pressable
                        style={[styles.emptyAction, { backgroundColor: pal.colors.primary }]}
                        onPress={() => router.push('/log/manual')}
                    >
                      <Text style={[styles.emptyActionText, { color: pal.colors.text.primary }]}>
                        {t('archive.start_logging')}
                      </Text>
                    </Pressable>
                )}
              </View>
            }
        />

        {/* Snackbar */}
        <ThemedSnackbar
            visible={snackbar}
            message={snackbarMsg}
            onHide={() => setSnackbar(false)}
        />
      </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  loadingText: {
    fontSize: 16,
    marginTop: theme.spacing.md,
    textAlign: 'center',
  },

  // Header
  header: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },

  // Controls
  controlsContainer: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing.md,
    height: 48,
    gap: theme.spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  sortButton: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  syncButton: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.sm,
  },

  // Sort Menu
  sortMenu: {
    position: 'absolute',
    top: 120,
    right: theme.spacing.md,
    zIndex: 1000,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    minWidth: 200,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.sm,
    borderBottomWidth: 1,
  },
  sortOptionText: {
    flex: 1,
    fontSize: 15,
  },

  // Status
  statusText: {
    textAlign: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    fontSize: 14,
  },

  // List
  listContainer: {
    padding: theme.spacing.md,
    paddingTop: theme.spacing.sm,
  },
  spottingCard: {
    marginBottom: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    gap: theme.spacing.md,
  },
  cardImage: {
    width: 80,
    height: 80,
    borderRadius: theme.borderRadius.md,
    backgroundColor: '#ccc',
  },
  cardImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: theme.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardInfo: {
    flex: 1,
    gap: theme.spacing.sm,
  },
  cardHeader: {
    gap: 2,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  cardDate: {
    fontSize: 14,
  },
  cardNote: {
    fontSize: 14,
    lineHeight: 20,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    fontSize: 12,
  },

  // Media Indicators
  mediaIndicators: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.spacing.xxl,
    gap: theme.spacing.md,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '500',
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  emptyAction: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    marginTop: theme.spacing.sm,
  },
  emptyActionText: {
    fontSize: 16,
    fontWeight: '600',
  },
});