import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    SafeAreaView,
    StyleSheet,
    TextInput,
    View,
    Pressable,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import Animated, {
    FadeInDown,
    Layout,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

// Modern components
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedPressable } from '@/components/ThemedPressable';
import { ModernCard } from '@/components/ModernCard';

// Modern theme hooks
import {
    useColorVariants,
    useSemanticColors,
    useTheme,
    useTypography,
} from '@/hooks/useThemeColor';

// Services
import { useBirdDexDatabase } from '@/hooks/useBirdDexDatabase';
import {
    type BirdCategory,
    type BirdDexRecord,
    getAvailableCategories,
    getBirdDexRowCount,
    queryBirdDexPage,
} from '@/services/databaseBirDex';
import { hasSpottingForLatin } from '@/services/database';

// Types
type DisplayRecord = BirdDexRecord & {
    displayName: string;
    logged: boolean;
};

type SortOption = 'name' | 'scientific' | 'family' | 'logged';

interface CategoryOption {
    key: BirdCategory;
    label: string;
    icon: keyof typeof Feather.glyphMap;
    count: number;
}

const PAGE_SIZE = 20;

// Enhanced Bird Card Component
function BirdCard({
                      bird,
                      index,
                      onPress
                  }: {
    bird: DisplayRecord;
    index: number;
    onPress: () => void;
}) {
    const semanticColors = useSemanticColors();
    const variants = useColorVariants();
    const theme = useTheme();

    return (
        <Animated.View
            entering={FadeInDown.delay(index * 50).springify()}
            layout={Layout.springify()}
        >
            <ModernCard
                variant={bird.logged ? "primary" : "outlined"}
                onPress={onPress}
                style={styles.birdCard}
                glowOnHover={!bird.logged}
            >
                <View style={styles.cardContent}>
                    {/* Header Row */}
                    <View style={styles.cardHeader}>
                        <View style={styles.birdInfo}>
                            <ThemedText
                                variant="bodyLarge"
                                style={[
                                    styles.birdName,
                                    { color: bird.logged ? semanticColors.primary : semanticColors.text }
                                ]}
                                numberOfLines={1}
                            >
                                {bird.displayName}
                            </ThemedText>
                            <ThemedText
                                variant="bodySmall"
                                color="secondary"
                                style={styles.scientificName}
                                numberOfLines={1}
                            >
                                {bird.scientific_name}
                            </ThemedText>
                        </View>

                        {/* Status Indicators */}
                        <View style={styles.cardIndicators}>
                            {bird.logged && (
                                <View style={[
                                    styles.loggedBadge,
                                    { backgroundColor: semanticColors.primary }
                                ]}>
                                    <Feather name="check" size={12} color={semanticColors.onPrimary} />
                                </View>
                            )}
                            <Feather name="chevron-right" size={16} color={semanticColors.textTertiary} />
                        </View>
                    </View>

                    {/* Metadata Row */}
                    <View style={styles.cardMetadata}>
                        {bird.family && (
                            <View style={[styles.metaBadge, { backgroundColor: variants.accentSubtle }]}>
                                <Feather name="users" size={10} color={semanticColors.accent} />
                                <ThemedText variant="labelSmall" color="accent">
                                    {bird.family}
                                </ThemedText>
                            </View>
                        )}

                        <View style={[styles.metaBadge, { backgroundColor: variants.primarySubtle }]}>
                            <Feather name="tag" size={10} color={semanticColors.primary} />
                            <ThemedText variant="labelSmall" color="primary">
                                {bird.category}
                            </ThemedText>
                        </View>
                    </View>
                </View>
            </ModernCard>
        </Animated.View>
    );
}

// Search and Filter Header Component
function SearchHeader({
                          searchQuery,
                          onSearchChange,
                          sortOption,
                          onSortChange,
                          categoryFilter,
                          onCategoryChange,
                          categories,
                          totalCount,
                      }: {
    searchQuery: string;
    onSearchChange: (query: string) => void;
    sortOption: SortOption;
    onSortChange: (option: SortOption) => void;
    categoryFilter: BirdCategory;
    onCategoryChange: (category: BirdCategory) => void;
    categories: CategoryOption[];
    totalCount: number;
}) {
    const { t } = useTranslation();
    const semanticColors = useSemanticColors();
    const variants = useColorVariants();
    const theme = useTheme();

    const [showSortMenu, setShowSortMenu] = useState(false);
    const [showCategoryMenu, setShowCategoryMenu] = useState(false);

    const sortOptions: Array<{ key: SortOption; label: string; icon: string }> = [
        { key: 'name', label: t('birddex.sortByName'), icon: 'type' },
        { key: 'scientific', label: t('birddex.sortByScientific'), icon: 'book' },
        { key: 'family', label: t('birddex.sortByFamily'), icon: 'users' },
        { key: 'logged', label: t('birddex.sortByLogged'), icon: 'check-circle' },
    ];

    const getCategoryIcon = (category: string) => {
        switch (category) {
            case 'species': return 'circle';
            case 'subspecies': return 'disc';
            case 'family': return 'users';
            case 'group (polytypic)': return 'copy';
            case 'group (monotypic)': return 'stop-circle';
            case 'all': return 'grid';
            default: return 'tag';
        }
    };

    return (
        <ThemedView style={styles.searchHeader}>
            {/* Search Bar */}
            <View style={styles.searchRow}>
                <BlurView
                    intensity={60}
                    tint={semanticColors.background === '#FFFFFF' ? 'light' : 'dark'}
                    style={[styles.searchContainer, { borderColor: variants.primaryMuted }]}
                >
                    <Feather name="search" size={20} color={semanticColors.textSecondary} />
                    <TextInput
                        style={[styles.searchInput, { color: semanticColors.text }]}
                        placeholder={t('birddex.searchPlaceholder')}
                        placeholderTextColor={semanticColors.textTertiary}
                        value={searchQuery}
                        onChangeText={onSearchChange}
                        autoCapitalize="none"
                        autoCorrect={false}
                    />
                    {searchQuery.length > 0 && (
                        <Pressable onPress={() => onSearchChange('')}>
                            <Feather name="x" size={18} color={semanticColors.textSecondary} />
                        </Pressable>
                    )}
                </BlurView>
            </View>

            {/* Filter Controls */}
            <View style={styles.filterRow}>
                {/* Category Filter */}
                <ThemedPressable
                    variant={categoryFilter !== 'all' ? 'primary' : 'outline'}
                    size="small"
                    onPress={() => {
                        setShowCategoryMenu(!showCategoryMenu);
                        setShowSortMenu(false);
                        Haptics.selectionAsync();
                    }}
                    style={styles.filterButton}
                >
                    <Feather
                        name={getCategoryIcon(categoryFilter)}
                        size={16}
                        color={categoryFilter !== 'all' ? semanticColors.onPrimary : semanticColors.text}
                    />
                    <ThemedText
                        variant="labelMedium"
                        color={categoryFilter !== 'all' ? 'inverse' : 'primary'}
                    >
                        {categoryFilter === 'all' ? t('birddex.categories.all') : categoryFilter}
                    </ThemedText>
                </ThemedPressable>

                {/* Sort Filter */}
                <ThemedPressable
                    variant="outline"
                    size="small"
                    onPress={() => {
                        setShowSortMenu(!showSortMenu);
                        setShowCategoryMenu(false);
                        Haptics.selectionAsync();
                    }}
                    style={styles.filterButton}
                >
                    <Feather name="filter" size={16} color={semanticColors.text} />
                    <ThemedText variant="labelMedium">
                        {sortOptions.find(opt => opt.key === sortOption)?.label || 'Sort'}
                    </ThemedText>
                </ThemedPressable>

                {/* Results Count */}
                <ThemedText variant="labelMedium" color="secondary" style={styles.resultCount}>
                    {totalCount.toLocaleString()} {t('birddex.species')}
                </ThemedText>
            </View>

            {/* Sort Dropdown */}
            {showSortMenu && (
                <Animated.View
                    entering={FadeInDown.duration(200)}
                    style={styles.dropdownMenu}
                >
                    <BlurView
                        intensity={80}
                        tint={semanticColors.background === '#FFFFFF' ? 'light' : 'dark'}
                        style={[styles.menuContent, { borderColor: variants.primaryMuted }]}
                    >
                        {sortOptions.map((option) => (
                            <Pressable
                                key={option.key}
                                style={[
                                    styles.menuOption,
                                    sortOption === option.key && { backgroundColor: variants.primarySubtle }
                                ]}
                                onPress={() => {
                                    onSortChange(option.key);
                                    setShowSortMenu(false);
                                    Haptics.selectionAsync();
                                }}
                            >
                                <Feather
                                    name={option.icon as any}
                                    size={16}
                                    color={sortOption === option.key ? semanticColors.primary : semanticColors.textSecondary}
                                />
                                <ThemedText
                                    variant="bodyMedium"
                                    color={sortOption === option.key ? 'primary' : 'secondary'}
                                >
                                    {option.label}
                                </ThemedText>
                            </Pressable>
                        ))}
                    </BlurView>
                </Animated.View>
            )}

            {/* Category Dropdown */}
            {showCategoryMenu && (
                <Animated.View
                    entering={FadeInDown.duration(200)}
                    style={styles.dropdownMenu}
                >
                    <BlurView
                        intensity={80}
                        tint={semanticColors.background === '#FFFFFF' ? 'light' : 'dark'}
                        style={[styles.menuContent, { borderColor: variants.primaryMuted }]}
                    >
                        {categories.map((category) => (
                            <Pressable
                                key={category.key}
                                style={[
                                    styles.menuOption,
                                    categoryFilter === category.key && { backgroundColor: variants.primarySubtle }
                                ]}
                                onPress={() => {
                                    onCategoryChange(category.key);
                                    setShowCategoryMenu(false);
                                    Haptics.selectionAsync();
                                }}
                            >
                                <Feather
                                    name={category.icon as any}
                                    size={16}
                                    color={categoryFilter === category.key ? semanticColors.primary : semanticColors.textSecondary}
                                />
                                <ThemedText
                                    variant="bodyMedium"
                                    color={categoryFilter === category.key ? 'primary' : 'secondary'}
                                    style={styles.categoryLabel}
                                >
                                    {category.label}
                                </ThemedText>
                                <ThemedText
                                    variant="labelSmall"
                                    color="tertiary"
                                >
                                    {category.count.toLocaleString()}
                                </ThemedText>
                            </Pressable>
                        ))}
                    </BlurView>
                </Animated.View>
            )}
        </ThemedView>
    );
}

// Error State Component
function ErrorState({
                        error,
                        onRetry
                    }: {
    error: string | undefined;
    onRetry: () => void;
}) {
    const { t } = useTranslation();
    const semanticColors = useSemanticColors();
    const variants = useColorVariants();

    return (
        <ThemedView style={styles.errorContainer}>
            <View style={[styles.errorIcon, { backgroundColor: variants.primarySubtle }]}>
                <Feather name="alert-triangle" size={48} color={semanticColors.error} />
            </View>

            <ThemedText variant="headlineSmall" style={styles.errorTitle}>
                {t('birddex.error')}
            </ThemedText>

            <ThemedText variant="bodyMedium" color="secondary" style={styles.errorMessage}>
                {error || t('birddex.initFailed')}
            </ThemedText>

            <ThemedPressable
                variant="primary"
                onPress={onRetry}
                style={styles.retryButton}
            >
                <Feather name="refresh-cw" size={18} color={semanticColors.onPrimary} />
                <ThemedText variant="labelLarge" color="inverse">
                    {t('birddex.reload')}
                </ThemedText>
            </ThemedPressable>
        </ThemedView>
    );
}

// Loading State Component
function LoadingState() {
    const { t } = useTranslation();
    const semanticColors = useSemanticColors();

    return (
        <ThemedView style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={semanticColors.primary} />
            <ThemedText variant="bodyMedium" color="secondary" style={styles.loadingText}>
                {t('birddex.loadingEntries')}
            </ThemedText>
        </ThemedView>
    );
}

// Main Component
export default function ModernBirdDexIndex() {
    const { i18n, t } = useTranslation();
    const router = useRouter();
    const semanticColors = useSemanticColors();
    const variants = useColorVariants();
    const theme = useTheme();

    // Database status
    const { isReady, isLoading, hasError, error, retry } = useBirdDexDatabase();

    // State
    const [birds, setBirds] = useState<DisplayRecord[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOption, setSortOption] = useState<SortOption>('name');
    const [categoryFilter, setCategoryFilter] = useState<BirdCategory>('all');
    const [refreshing, setRefreshing] = useState(false);
    const [page, setPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [categories, setCategories] = useState<CategoryOption[]>([]);

    // Helper function for category icons
    const getCategoryIcon = (category: string): keyof typeof Feather.glyphMap => {
        switch (category) {
            case 'species': return 'circle';
            case 'subspecies': return 'target';
            case 'family': return 'users';
            case 'group (polytypic)': return 'layers';
            case 'group (monotypic)': return 'square';
            default: return 'tag';
        }
    };

    // Load categories when database is ready
    useEffect(() => {
        if (isReady) {
            try {
                const availableCategories = getAvailableCategories();
                const transformedCategories: CategoryOption[] = availableCategories.map(cat => ({
                    key: cat.category as BirdCategory,
                    label: cat.category,
                    icon: getCategoryIcon(cat.category),
                    count: cat.count,
                }));
                setCategories(transformedCategories);
            } catch (e) {
                console.error('Failed to load categories:', e);
            }
        }
    }, [isReady]);

    // Memoized category options
    const categoryOptions = useMemo(() => {
        const allCategories: CategoryOption[] = [
            { key: 'all', label: t('birddex.categories.all'), icon: 'grid', count: totalCount },
            ...categories
        ];
        return allCategories;
    }, [categories, totalCount, t]);

    // Load data function
    const loadData = useCallback(async (pageNum: number = 1, append: boolean = false) => {
        if (!isReady) return;

        try {
            if (!append) setRefreshing(true);

            // Get language-specific name field
            const lang = i18n.language.split('-')[0];
            const nameField = lang === 'de' ? 'de_name' :
                lang === 'es' ? 'es_name' :
                    lang === 'uk' ? 'ukrainian_name' :
                        lang === 'ar' ? 'ar_name' : 'english_name';

            // Map sort option to database field
            const sortField = sortOption === 'name' ? 'english_name' :
                sortOption === 'scientific' ? 'scientific_name' :
                    sortOption === 'family' ? 'family' :
                        sortOption === 'logged' ? 'english_name' : 'english_name';

            // Query database
            const rawBirds = queryBirdDexPage(
                searchQuery.trim(),
                sortField,
                true, // ascending
                PAGE_SIZE,
                pageNum,
                categoryFilter
            );

            // Process results
            const processedBirds: DisplayRecord[] = rawBirds.map(bird => {
                const displayName = bird[nameField as keyof BirdDexRecord] as string ||
                    bird.english_name ||
                    bird.scientific_name ||
                    'Unknown Bird';

                return {
                    ...bird,
                    displayName,
                    logged: hasSpottingForLatin(bird.scientific_name),
                };
            });

            // Sort by logged status if needed
            if (sortOption === 'logged') {
                processedBirds.sort((a, b) => {
                    if (a.logged === b.logged) return 0;
                    return a.logged ? -1 : 1;
                });
            }

            // Update state
            if (append) {
                setBirds(prev => [...prev, ...processedBirds]);
            } else {
                setBirds(processedBirds);
            }

            // Update pagination
            const total = getBirdDexRowCount(searchQuery.trim(), categoryFilter);
            setTotalCount(total);
            setHasMore(pageNum * PAGE_SIZE < total);
            setPage(pageNum);

        } catch (error) {
            console.error('Load data error:', error);
            Alert.alert(t('birddex.error'), t('birddex.loadPageFailed'));
        } finally {
            setRefreshing(false);
        }
    }, [isReady, searchQuery, sortOption, categoryFilter, i18n.language, t]);

    // Load data when dependencies change
    useEffect(() => {
        if (isReady) {
            const timeoutId = setTimeout(() => loadData(1, false), 300);
            return () => clearTimeout(timeoutId);
        }
    }, [loadData]);

    // Handlers
    const handleBirdPress = useCallback((bird: DisplayRecord) => {
        Haptics.selectionAsync();
        router.push(`/birdex/details/${bird.species_code}`);
    }, [router]);

    const handleLoadMore = useCallback(() => {
        if (!refreshing && hasMore) {
            loadData(page + 1, true);
        }
    }, [refreshing, hasMore, page, loadData]);

    const handleRefresh = useCallback(() => {
        loadData(1, false);
    }, [loadData]);

    // Render item
    const renderBird = useCallback(({ item, index }: { item: DisplayRecord, index: number }) => (
        <BirdCard
            bird={item}
            index={index}
            onPress={() => handleBirdPress(item)}
        />
    ), [handleBirdPress]);

    // Error state
    if (hasError) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: semanticColors.background }]}>
                <ErrorState error={error} onRetry={retry} />
            </SafeAreaView>
        );
    }

    // Loading state
    if (isLoading || !isReady) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: semanticColors.background }]}>
                <LoadingState />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: semanticColors.background }]}>
            {/* Header */}
            <ThemedView style={styles.header}>
                <ThemedText variant="displaySmall" style={styles.headerTitle}>
                    {t('birddex.title')}
                </ThemedText>
                <ThemedText variant="bodyMedium" color="secondary">
                    {t('birddex.subtitle', { count: totalCount })}
                </ThemedText>
            </ThemedView>

            {/* Search and Filters */}
            <SearchHeader
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                sortOption={sortOption}
                onSortChange={setSortOption}
                categoryFilter={categoryFilter}
                onCategoryChange={setCategoryFilter}
                categories={categoryOptions}
                totalCount={totalCount}
            />

            {/* Bird List */}
            <FlatList
                data={birds}
                keyExtractor={(item) => item.species_code}
                renderItem={renderBird}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                refreshing={refreshing}
                onRefresh={handleRefresh}
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.3}
                ListFooterComponent={
                    hasMore ? (
                        <View style={styles.loadingFooter}>
                            <ActivityIndicator size="small" color={semanticColors.primary} />
                        </View>
                    ) : null
                }
                ListEmptyComponent={
                    <ThemedView style={styles.emptyContainer}>
                        <View style={[styles.emptyIcon, { backgroundColor: variants.primarySubtle }]}>
                            <Feather name="search" size={48} color={semanticColors.primary} />
                        </View>
                        <ThemedText variant="headlineSmall" style={styles.emptyTitle}>
                            {searchQuery ? t('birddex.noSearchResults') : t('birddex.noResults')}
                        </ThemedText>
                        <ThemedText variant="bodyMedium" color="secondary" style={styles.emptyMessage}>
                            {searchQuery ? t('birddex.tryDifferentSearch') : t('birddex.noResultsMessage')}
                        </ThemedText>
                    </ThemedView>
                }
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        overflow: 'hidden',
    },

    // Header
    header: {
        paddingHorizontal: 24,
        paddingVertical: 16,
    },
    headerTitle: {
        fontWeight: 'bold',
        marginBottom: 4,
    },

    // Search Header
    searchHeader: {
        paddingHorizontal: 24,
        paddingBottom: 16,
        position: 'relative',
        overflow: 'hidden',
    },
    searchRow: {
        marginBottom: 12,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        height: 48,
        borderRadius: 24,
        borderWidth: 1,
        gap: 12,
        overflow: 'hidden',
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        overflow: 'hidden',
    },
    filterRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    filterButton: {
        flexDirection: 'row',
        gap: 6,
    },
    resultCount: {
        marginLeft: 'auto',
    },

    // Dropdown Menus
    dropdownMenu: {
        position: 'absolute',
        top: '100%',
        left: 24,
        right: 24,
        zIndex: 10,
        marginTop: 8,
    },
    menuContent: {
        borderRadius: 12,
        borderWidth: 1,
        overflow: 'hidden',
    },
    menuOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 12,
    },
    categoryLabel: {
        flex: 1,
    },

    // Bird Cards
    listContent: {
        paddingHorizontal: 24,
        paddingBottom: 24,
    },
    birdCard: {
        marginBottom: 12,
    },
    cardContent: {
        padding: 16,
        gap: 12,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
    },
    birdInfo: {
        flex: 1,
        marginRight: 12,
    },
    birdName: {
        fontWeight: '600',
        marginBottom: 4,
    },
    scientificName: {
        fontStyle: 'italic',
    },
    cardIndicators: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    loggedBadge: {
        width: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardMetadata: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    metaBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },

    // Loading States
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
    },
    loadingText: {
        textAlign: 'center',
    },
    loadingFooter: {
        paddingVertical: 20,
        alignItems: 'center',
    },

    // Error State
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
        gap: 24,
    },
    errorIcon: {
        width: 96,
        height: 96,
        borderRadius: 48,
        justifyContent: 'center',
        alignItems: 'center',
    },
    errorTitle: {
        textAlign: 'center',
        fontWeight: '600',
    },
    errorMessage: {
        textAlign: 'center',
        lineHeight: 22,
        maxWidth: 280,
    },
    retryButton: {
        flexDirection: 'row',
        gap: 8,
    },

    // Empty State
    emptyContainer: {
        paddingVertical: 60,
        alignItems: 'center',
        gap: 20,
    },
    emptyIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyTitle: {
        textAlign: 'center',
        fontWeight: '500',
    },
    emptyMessage: {
        textAlign: 'center',
        lineHeight: 20,
        maxWidth: 280,
    },
});