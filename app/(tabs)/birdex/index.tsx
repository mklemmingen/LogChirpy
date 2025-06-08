import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    StyleSheet,
    TextInput,
    View,
    Pressable,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { ThemedIcon } from '@/components/ThemedIcon';
import { Feather } from '@expo/vector-icons';
import SafeBlurView from '@/components/ui/SafeBlurView';
import * as Haptics from 'expo-haptics';
import { SafeViewManager } from '@/components/SafeViewManager';

// Components
import { ThemedView, Card } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedPressable } from '@/components/ThemedPressable';
import { ThemedSafeAreaView } from '@/components/ThemedSafeAreaView';
import { Button } from '@/components/Button';

// Theme hooks
import {
    useColors,
    useTypography,
    useBorderRadius,
    useShadows,
    useSpacing,
    useSemanticColors,
    useColorVariants,
    useTheme
} from '@/hooks/useThemeColor';
import { useUnifiedColors } from '@/hooks/useUnifiedColors';
import { useResponsiveDimensions } from '@/hooks/useResponsiveDimensions';

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
    const colors = useUnifiedColors();
    const typography = useTypography();
    const dimensions = useResponsiveDimensions();
    
    const styles = createBirdCardStyles(dimensions);

    return (
        <View>
            <ThemedPressable
                variant="ghost"
                onPress={onPress}
                style={styles.birdCard}
            >
                <Card style={[styles.birdCardInner, bird.logged && { borderColor: colors.interactive.primary, borderWidth: 2 }]}>
                <View style={styles.cardContent}>
                    {/* Header Row */}
                    <View style={styles.cardHeader}>
                        <View style={styles.birdInfo}>
                            <ThemedText
                                variant="body"
                                style={[
                                    styles.birdName,
                                    { color: bird.logged ? colors.interactive.primary : colors.text.primary }
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
                                    { backgroundColor: colors.interactive.primary }
                                ]}>
                                    <ThemedIcon name="check" size={dimensions.icon.xs} color="primary" />
                                </View>
                            )}
                            <ThemedIcon name="chevron-right" size={dimensions.icon.sm} color="secondary" />
                        </View>
                    </View>

                    {/* Metadata Row */}
                    <View style={styles.cardMetadata}>
                        {bird.family && (
                            <View style={[styles.metaBadge, { backgroundColor: colors.background.secondary }]}>
                                <ThemedIcon name="users" size={dimensions.icon.xs} color="secondary" />
                                <ThemedText variant="caption" color="secondary">
                                    {bird.family}
                                </ThemedText>
                            </View>
                        )}

                        <View style={[styles.metaBadge, { backgroundColor: colors.background.secondary }]}>
                            <ThemedIcon name="tag" size={dimensions.icon.xs} color="primary" />
                            <ThemedText variant="caption" color="primary">
                                {bird.category}
                            </ThemedText>
                        </View>
                    </View>
                </View>
                </Card>
            </ThemedPressable>
        </View>
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
    const colors = useUnifiedColors();
    const semanticColors = useSemanticColors();
    const variants = useColorVariants();
    const theme = useTheme();
    const dimensions = useResponsiveDimensions();
    const styles = createStyles(dimensions);

    const [showSortMenu, setShowSortMenu] = useState(false);
    const [showCategoryMenu, setShowCategoryMenu] = useState(false);

    const sortOptions: Array<{ key: SortOption; label: string; icon: keyof typeof Feather.glyphMap }> = [
        { key: 'name', label: t('birddex.sortByName'), icon: 'type' },
        { key: 'scientific', label: t('birddex.sortByScientific'), icon: 'book' },
        { key: 'family', label: t('birddex.sortByFamily'), icon: 'users' },
        { key: 'logged', label: t('birddex.sortByLogged'), icon: 'check-circle' },
    ];

    const getCategoryIcon = (category: string): keyof typeof Feather.glyphMap => {
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
                <Card style={styles.searchContainer}>
                    <ThemedIcon name="search" size={20} color="secondary" />
                    <TextInput
                        style={[styles.searchInput, { color: colors.text.primary }]}
                        placeholder={t('birddex.searchPlaceholder')}
                        placeholderTextColor={colors.text.tertiary}
                        value={searchQuery}
                        onChangeText={onSearchChange}
                        autoCapitalize="none"
                        autoCorrect={false}
                    />
                    {searchQuery.length > 0 && (
                        <Pressable onPress={() => onSearchChange('')}>
                            <ThemedIcon name="x" size={18} color="secondary" />
                        </Pressable>
                    )}
                </Card>
            </View>

            {/* Filter Controls */}
            <View style={styles.filterRow}>
                {/* Category Filter */}
                <ThemedPressable
                    variant={categoryFilter !== 'all' ? 'primary' : 'secondary'}
                    size="sm"
                    onPress={() => {
                        setShowCategoryMenu(!showCategoryMenu);
                        setShowSortMenu(false);
                        Haptics.selectionAsync();
                    }}
                    style={styles.filterButton}
                >
                    <ThemedIcon
                        name={getCategoryIcon(categoryFilter)}
                        size={16}
                        color={categoryFilter !== 'all' ? 'primary' : 'secondary'}
                    />
                    <ThemedText
                        variant="label"
                        color={categoryFilter !== 'all' ? 'primary' : 'secondary'}
                    >
                        {categoryFilter === 'all' ? t('birddex.categories.all') : categoryFilter}
                    </ThemedText>
                </ThemedPressable>

                {/* Sort Filter */}
                <ThemedPressable
                    variant="secondary"
                    size="sm"
                    onPress={() => {
                        setShowSortMenu(!showSortMenu);
                        setShowCategoryMenu(false);
                        Haptics.selectionAsync();
                    }}
                    style={styles.filterButton}
                >
                    <ThemedIcon name="filter" size={16} color="primary" />
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
                <View style={styles.dropdownMenu}>
                    <Card style={styles.menuContent}>
                        {sortOptions.map((option) => (
                            <Pressable
                                key={option.key}
                                style={[
                                    styles.menuOption,
                                    sortOption === option.key && { backgroundColor: colors.background.secondary }
                                ]}
                                onPress={() => {
                                    onSortChange(option.key);
                                    setShowSortMenu(false);
                                    Haptics.selectionAsync();
                                }}
                            >
                                <ThemedIcon
                                    name={option.icon}
                                    size={16}
                                    color={sortOption === option.key ? 'primary' : 'secondary'}
                                />
                                <ThemedText
                                    variant="body"
                                    color={sortOption === option.key ? 'primary' : 'secondary'}
                                >
                                    {option.label}
                                </ThemedText>
                            </Pressable>
                        ))}
                    </Card>
                </View>
            )}

            {/* Category Dropdown */}
            {showCategoryMenu && (
                <View style={styles.dropdownMenu}>
                    <Card style={styles.menuContent}>
                        {categories.map((category) => (
                            <Pressable
                                key={category.key}
                                style={[
                                    styles.menuOption,
                                    categoryFilter === category.key && { backgroundColor: variants.primary.light }
                                ]}
                                onPress={() => {
                                    onCategoryChange(category.key);
                                    setShowCategoryMenu(false);
                                    Haptics.selectionAsync();
                                }}
                            >
                                <ThemedIcon
                                    name={category.icon}
                                    size={16}
                                    color={categoryFilter === category.key ? 'primary' : 'secondary'}
                                />
                                <ThemedText
                                    variant="body"
                                    color={categoryFilter === category.key ? 'primary' : 'secondary'}
                                    style={styles.categoryLabel}
                                >
                                    {category.label}
                                </ThemedText>
                                <ThemedText
                                    variant="caption"
                                    color="secondary"
                                >
                                    {category.count.toLocaleString()}
                                </ThemedText>
                            </Pressable>
                        ))}
                    </Card>
                </View>
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
    const colors = useUnifiedColors();
    const semanticColors = useSemanticColors();
    const variants = useColorVariants();
    const dimensions = useResponsiveDimensions();
    const styles = createStyles(dimensions);

    return (
        <ThemedView style={styles.errorContainer}>
            <View style={[styles.errorIcon, { backgroundColor: colors.background.secondary }]}>
                <ThemedIcon name="alert-triangle" size={48} color="primary" />
            </View>

            <ThemedText variant="h3" style={styles.errorTitle}>
                {t('birddex.error')}
            </ThemedText>

            <ThemedText variant="body" color="secondary" style={styles.errorMessage}>
                {error || t('birddex.initFailed')}
            </ThemedText>

            <ThemedPressable
                variant="primary"
                onPress={onRetry}
                style={styles.retryButton}
            >
                <ThemedIcon name="refresh-cw" size={18} color="primary" />
                <ThemedText variant="label" color="primary">
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
    const dimensions = useResponsiveDimensions();
    const styles = createStyles(dimensions);

    return (
        <ThemedView style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={semanticColors.primary} />
            <ThemedText variant="body" color="secondary" style={styles.loadingText}>
                {t('birddex.loadingEntries')}
            </ThemedText>
        </ThemedView>
    );
}

// Main Component
export default function ModernBirdDexIndex() {
    const { i18n, t } = useTranslation();
    const router = useRouter();
    const colors = useUnifiedColors();
    const semanticColors = useSemanticColors();
    const variants = useColorVariants();
    const theme = useTheme();
    const dimensions = useResponsiveDimensions();
    const isFocused = useIsFocused();
    const styles = createStyles(dimensions);

    if (!isFocused) {
        return null;
    }

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
            return () => {
                clearTimeout(timeoutId);
                // Cleanup to prevent memory leaks
                setRefreshing(false);
            };
        }
        
        // Additional cleanup for component unmount
        return () => {
            setRefreshing(false);
        };
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
            <ThemedSafeAreaView style={styles.container}>
                <ErrorState error={error} onRetry={retry} />
            </ThemedSafeAreaView>
        );
    }

    // Loading state
    if (isLoading || !isReady) {
        return (
            <ThemedSafeAreaView style={styles.container}>
                <LoadingState />
            </ThemedSafeAreaView>
        );
    }

    return (
        <SafeViewManager enabled={isFocused}>
            <ThemedSafeAreaView style={styles.container}>
            {/* Header */}
            <ThemedView style={styles.header}>
                <ThemedText variant="h2" style={styles.headerTitle}>
                    {t('birddex.title')}
                </ThemedText>
                <ThemedText variant="body" color="secondary">
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
                keyExtractor={(item, index) => `${item.species_code}-${index}`}
                renderItem={renderBird}
                removeClippedSubviews={false}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                refreshing={refreshing}
                onRefresh={handleRefresh}
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.3}
                ListFooterComponent={
                    hasMore ? (
                        <View style={styles.loadingFooter}>
                            <ActivityIndicator size="small" color={colors.interactive.primary} />
                        </View>
                    ) : null
                }
                ListEmptyComponent={
                    <ThemedView style={styles.emptyContainer}>
                        <View style={[styles.emptyIcon, { backgroundColor: colors.background.secondary }]}>
                            <ThemedIcon name="search" size={48} color="primary" />
                        </View>
                        <ThemedText variant="h3" style={styles.emptyTitle}>
                            {searchQuery ? t('birddex.noSearchResults') : t('birddex.noResults')}
                        </ThemedText>
                        <ThemedText variant="body" color="secondary" style={styles.emptyMessage}>
                            {searchQuery ? t('birddex.tryDifferentSearch') : t('birddex.noResultsMessage')}
                        </ThemedText>
                    </ThemedView>
                }
            />
            </ThemedSafeAreaView>
        </SafeViewManager>
    );
}

/**
 * Creates responsive styles for bird card component
 */
function createBirdCardStyles(dimensions: ReturnType<typeof useResponsiveDimensions>) {
    return StyleSheet.create({
        birdCard: {
            marginBottom: dimensions.layout.componentSpacing,
        },
        birdCardInner: {
            overflow: 'hidden',
        },
        cardContent: {
            padding: dimensions.card.padding.sm,
            gap: dimensions.layout.componentSpacing / 2,
        },
        cardHeader: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
        },
        birdInfo: {
            flex: 1,
            marginRight: dimensions.layout.componentSpacing / 2,
        },
        birdName: {
            fontWeight: '600',
            marginBottom: dimensions.layout.componentSpacing / 8,
        },
        scientificName: {
            fontStyle: 'italic',
        },
        cardIndicators: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: dimensions.layout.componentSpacing / 4,
        },
        loggedBadge: {
            width: dimensions.icon.sm,
            height: dimensions.icon.sm,
            borderRadius: dimensions.icon.sm / 2,
            justifyContent: 'center',
            alignItems: 'center',
        },
        cardMetadata: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: dimensions.layout.componentSpacing / 4,
        },
        metaBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: dimensions.layout.componentSpacing / 3,
            paddingVertical: dimensions.layout.componentSpacing / 6,
            borderRadius: dimensions.card.borderRadius.sm,
            gap: dimensions.layout.componentSpacing / 6,
        },
    });
}

function createStyles(dimensions: ReturnType<typeof useResponsiveDimensions>) {
    return StyleSheet.create({
        container: {
            flex: 1,
        },
    // Header
    header: {
        paddingHorizontal: dimensions.layout.screenPadding.horizontal,
        paddingVertical: dimensions.layout.componentSpacing,
    },
    headerTitle: {
        fontWeight: 'bold',
        marginBottom: 4,
    },

    // Search Header
    searchHeader: {
        paddingHorizontal: dimensions.layout.screenPadding.horizontal,
        paddingBottom: dimensions.layout.componentSpacing,
        position: 'relative',
    },
    searchRow: {
        marginBottom: dimensions.layout.componentSpacing / 2,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: dimensions.layout.componentSpacing,
        paddingVertical: dimensions.layout.componentSpacing / 2,
        minHeight: dimensions.button.md.height,
        borderRadius: dimensions.card.borderRadius.xl,
        borderWidth: 1,
        gap: dimensions.layout.componentSpacing / 2,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        lineHeight: 20,
    },
    filterRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: dimensions.layout.componentSpacing / 2,
    },
    filterButton: {
        flexDirection: 'row',
        gap: dimensions.layout.componentSpacing / 4,
    },
    resultCount: {
        marginLeft: 'auto',
    },

    // Dropdown Menus
    dropdownMenu: {
        position: 'absolute',
        top: '100%',
        left: dimensions.layout.screenPadding.horizontal,
        right: dimensions.layout.screenPadding.horizontal,
        zIndex: 10,
        marginTop: dimensions.layout.componentSpacing / 2,
    },
    menuContent: {
        borderRadius: dimensions.card.borderRadius.lg,
        borderWidth: 1,
        overflow: 'hidden',
    },
    menuOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: dimensions.layout.componentSpacing,
        paddingVertical: dimensions.layout.componentSpacing / 2,
        gap: dimensions.layout.componentSpacing / 2,
    },
    categoryLabel: {
        flex: 1,
    },

    // Bird Cards
    listContent: {
        paddingHorizontal: dimensions.layout.screenPadding.horizontal,
        paddingBottom: dimensions.layout.sectionSpacing,
    },
    birdCard: {
        marginBottom: dimensions.layout.componentSpacing / 2,
    },
    birdCardInner: {
        overflow: 'hidden',
    },
    cardContent: {
        padding: dimensions.card.padding.sm,
        gap: dimensions.layout.componentSpacing / 2,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
    },
    birdInfo: {
        flex: 1,
        marginRight: dimensions.layout.componentSpacing / 2,
    },
    birdName: {
        fontWeight: '600',
        marginBottom: dimensions.layout.componentSpacing / 8,
    },
    scientificName: {
        fontStyle: 'italic',
    },
    cardIndicators: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: dimensions.layout.componentSpacing / 4,
    },
    loggedBadge: {
        width: dimensions.icon.sm,
        height: dimensions.icon.sm,
        borderRadius: dimensions.icon.sm / 2,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardMetadata: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: dimensions.layout.componentSpacing / 4,
    },
    metaBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: dimensions.layout.componentSpacing / 3,
        paddingVertical: dimensions.layout.componentSpacing / 6,
        borderRadius: dimensions.card.borderRadius.sm,
        gap: dimensions.layout.componentSpacing / 6,
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
}