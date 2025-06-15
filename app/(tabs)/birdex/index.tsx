import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    StyleSheet,
    TextInput,
    View,
    Pressable,
    Image,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { ThemedIcon } from '@/components/ThemedIcon';
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
import { getBirdImageSource } from '@/services/birdImageService';

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

// Bird Card Component
function BirdCard({
                      bird,
                      index,
                      onPress
                  }: {
    bird: DisplayRecord;
    index: number;
    onPress: () => void;
}) {
    const colors = useColors();
    const typography = useTypography();
    
    const styles = createBirdCardStyles();

    return (
        <Animated.View
            entering={FadeInDown.delay(index * 50).springify()}
            layout={Layout.springify()}
        >
            <ThemedPressable
                variant="ghost"
                onPress={onPress}
                style={styles.birdCard}
            >
                <Card style={[styles.birdCardInner, bird.logged && { borderColor: colors.primary, borderWidth: 2 }]}>
                <View style={styles.cardContent}>
                    <View style={styles.cardLayout}>
                        {/* Bird Image */}
                        <View style={styles.birdImageContainer}>
                            {(() => {
                                const imageSource = getBirdImageSource(bird.scientific_name);
                                return imageSource ? (
                                    <Image
                                        source={imageSource}
                                        style={styles.birdImage}
                                        resizeMode="cover"
                                    />
                                ) : (
                                    <View style={[styles.birdImagePlaceholder, { backgroundColor: colors.backgroundSecondary }]}>
                                        <ThemedIcon name="image" size={24} color="secondary" />
                                    </View>
                                );
                            })()}
                        </View>

                        {/* Bird Info */}
                        <View style={styles.birdContentContainer}>
                            {/* Header Row */}
                            <View style={styles.cardHeader}>
                                <View style={styles.birdInfo}>
                                    <ThemedText
                                        variant="body"
                                        style={[
                                            styles.birdName,
                                            { color: bird.logged ? colors.primary : colors.text }
                                        ]}
                                        numberOfLines={1}
                                        ellipsizeMode="tail"
                                    >
                                        {bird.displayName}
                                    </ThemedText>
                                    <ThemedText
                                        variant="bodySmall"
                                        color="secondary"
                                        style={styles.scientificName}
                                        numberOfLines={1}
                                        ellipsizeMode="tail"
                                    >
                                        {bird.scientific_name}
                                    </ThemedText>
                                </View>

                                {/* Status Indicators */}
                                <View style={styles.cardIndicators}>
                                    {bird.logged && (
                                        <View style={[
                                            styles.loggedBadge,
                                            { backgroundColor: colors.primary }
                                        ]}>
                                            <ThemedIcon name="check" size={12} color="primary" />
                                        </View>
                                    )}
                                    <ThemedIcon name="chevron-right" size={16} color="secondary" />
                                </View>
                            </View>
                        </View>
                    </View>

                    {/* Metadata Row */}
                    <View style={styles.cardMetadata}>
                        {bird.family && (
                            <View style={[styles.metaBadge, { backgroundColor: colors.backgroundSecondary }]}>
                                <ThemedIcon name="users" size={12} color="secondary" />
                                <ThemedText variant="caption" color="secondary" numberOfLines={1} ellipsizeMode="tail">
                                    {bird.family}
                                </ThemedText>
                            </View>
                        )}

                        <View style={[styles.metaBadge, { backgroundColor: colors.backgroundSecondary }]}>
                            <ThemedIcon name="tag" size={12} color="primary" />
                            <ThemedText variant="caption" color="primary" numberOfLines={1} ellipsizeMode="tail">
                                {bird.category}
                            </ThemedText>
                        </View>
                    </View>
                </View>
                </Card>
            </ThemedPressable>
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
    const colors = useColors();
    const semanticColors = useSemanticColors();
    const variants = useColorVariants();
    const theme = useTheme();
    const styles = createStyles();

    const [showSortMenu, setShowSortMenu] = useState(false);
    const [showCategoryMenu, setShowCategoryMenu] = useState(false);

    const sortOptions: { key: SortOption; label: string; icon: keyof typeof Feather.glyphMap }[] = [
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
                <View style={[styles.searchContainer, { backgroundColor: colors.backgroundSecondary }]}>
                    <ThemedIcon name="search" size={20} color="secondary" />
                    <TextInput
                        style={[styles.searchInput, { color: colors.text }]}
                        placeholder={t('birddex.searchPlaceholder')}
                        placeholderTextColor={colors.textTertiary}
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
                </View>
            </View>

            {/* Results Count */}
            <View style={styles.statsRow}>
                <ThemedText variant="body" color="secondary">
                    {totalCount.toLocaleString()} {t('birddex.species')}
                </ThemedText>
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
                        color={categoryFilter !== 'all' ? 'inverse' : 'secondary'}
                    />
                    <ThemedText
                        variant="label"
                        color={categoryFilter !== 'all' ? 'inverse' : 'secondary'}
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
            </View>

            {/* Sort Dropdown */}
            {showSortMenu && (
                <Animated.View
                    entering={FadeInDown.duration(200)}
                    style={styles.dropdownMenu}
                >
                    <Card style={styles.menuContent}>
                        {sortOptions.map((option) => (
                            <Pressable
                                key={option.key}
                                style={[
                                    styles.menuOption,
                                    sortOption === option.key && { backgroundColor: colors.backgroundSecondary }
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
                </Animated.View>
            )}

            {/* Category Dropdown */}
            {showCategoryMenu && (
                <Animated.View
                    entering={FadeInDown.duration(200)}
                    style={styles.dropdownMenu}
                >
                    <Card style={styles.menuContent}>
                        {categories.map((category) => (
                            <Pressable
                                key={category.key}
                                style={[
                                    styles.menuOption,
                                    categoryFilter === category.key && { backgroundColor: colors.backgroundSecondary }
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
    const colors = useColors();
    const semanticColors = useSemanticColors();
    const variants = useColorVariants();
    const styles = createStyles();

    return (
        <ThemedView style={styles.errorContainer}>
            <View style={[styles.errorIcon, { backgroundColor: colors.backgroundSecondary }]}>
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
    const styles = createStyles();

    return (
        <ThemedView style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={semanticColors.primary} />
            <ThemedText variant="body" color="secondary" style={styles.loadingText}>
                {t('birddex.loadingEntries')}
            </ThemedText>
        </ThemedView>
    );
}

// Pagination Controls Component
function PaginationControls({
                                 currentPage,
                                 totalPages,
                                 totalCount,
                                 pageSize,
                                 onPreviousPage,
                                 onNextPage,
                                 onPageChange,
                                 isLoading = false
                             }: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    pageSize: number;
    onPreviousPage: () => void;
    onNextPage: () => void;
    onPageChange: (page: number) => void;
    isLoading?: boolean;
}) {
    const { t } = useTranslation();
    const colors = useColors();
    const styles = createStyles();

    // Calculate showing range
    const startItem = Math.min((currentPage - 1) * pageSize + 1, totalCount);
    const endItem = Math.min(currentPage * pageSize, totalCount);

    const canGoPrevious = currentPage > 1 && !isLoading;
    const canGoNext = currentPage < totalPages && !isLoading;

    return (
        <ThemedView style={styles.paginationContainer}>
            {/* Results info */}
            <ThemedText variant="caption" color="secondary" style={styles.paginationInfo}>
                {t('birddex.pagination.showing', { 
                    start: startItem.toLocaleString(), 
                    end: endItem.toLocaleString(), 
                    total: totalCount.toLocaleString() 
                })}
            </ThemedText>

            {/* Pagination controls */}
            <View style={styles.paginationControls}>
                {/* Previous button */}
                <ThemedPressable
                    variant={canGoPrevious ? 'secondary' : 'ghost'}
                    size="sm"
                    onPress={onPreviousPage}
                    disabled={!canGoPrevious}
                    style={[
                        styles.paginationButton,
                        ...(canGoPrevious ? [] : [styles.paginationButtonDisabled])
                    ]}
                >
                    <ThemedIcon 
                        name="chevron-left" 
                        size={16} 
                        color={canGoPrevious ? 'primary' : 'secondary'} 
                    />
                    <ThemedText 
                        variant="label" 
                        color={canGoPrevious ? 'primary' : 'secondary'}
                    >
                        {t('birddex.pagination.previous')}
                    </ThemedText>
                </ThemedPressable>

                {/* Page info */}
                <View style={styles.pageInfo}>
                    <ThemedText variant="body" style={styles.pageText}>
                        {t('birddex.pagination.page')} {currentPage.toLocaleString()} {t('birddex.pagination.of')} {totalPages.toLocaleString()}
                    </ThemedText>
                </View>

                {/* Next button */}
                <ThemedPressable
                    variant={canGoNext ? 'secondary' : 'ghost'}
                    size="sm"
                    onPress={onNextPage}
                    disabled={!canGoNext}
                    style={[
                        styles.paginationButton,  
                        ...(canGoNext ? [] : [styles.paginationButtonDisabled])
                    ]}
                >
                    <ThemedText 
                        variant="label" 
                        color={canGoNext ? 'primary' : 'secondary'}
                    >
                        {t('birddex.pagination.next')}
                    </ThemedText>
                    <ThemedIcon 
                        name="chevron-right" 
                        size={16} 
                        color={canGoNext ? 'primary' : 'secondary'} 
                    />
                </ThemedPressable>
            </View>
        </ThemedView>
    );
}

// Main Component
export default function BirdDexIndex() {
    const { i18n, t } = useTranslation();
    const router = useRouter();
    const colors = useColors();
    const semanticColors = useSemanticColors();
    const variants = useColorVariants();
    const theme = useTheme();
    const styles = createStyles();

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
    const [totalPages, setTotalPages] = useState(0);
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
    const loadData = useCallback(async (pageNum: number = 1) => {
        if (!isReady) return;

        try {
            setRefreshing(true);

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
            setBirds(processedBirds);

            // Update pagination
            const total = getBirdDexRowCount(searchQuery.trim(), categoryFilter);
            setTotalCount(total);
            setTotalPages(Math.ceil(total / PAGE_SIZE));
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
            const timeoutId = setTimeout(() => {
                loadData(1);
                setPage(1); // Reset page when filters change
            }, 300);
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
    }, [searchQuery, sortOption, categoryFilter, isReady, i18n.language, loadData]);

    // Handlers
    const handleBirdPress = useCallback((bird: DisplayRecord) => {
        Haptics.selectionAsync();
        router.push(`/birdex/details/${bird.species_code}`);
    }, [router]);

    const handlePageChange = useCallback((newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages && !refreshing) {
            loadData(newPage);
        }
    }, [totalPages, refreshing, loadData]);

    const handlePreviousPage = useCallback(() => {
        handlePageChange(page - 1);
    }, [page, handlePageChange]);

    const handleNextPage = useCallback(() => {
        handlePageChange(page + 1);
    }, [page, handlePageChange]);

    const handleRefresh = useCallback(() => {
        loadData(1);
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
                ListEmptyComponent={
                    <ThemedView style={styles.emptyContainer}>
                        <View style={[styles.emptyIcon, { backgroundColor: colors.backgroundSecondary }]}>
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

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <PaginationControls
                    currentPage={page}
                    totalPages={totalPages}
                    totalCount={totalCount}
                    pageSize={PAGE_SIZE}
                    onPreviousPage={handlePreviousPage}
                    onNextPage={handleNextPage}
                    onPageChange={handlePageChange}
                    isLoading={refreshing}
                />
            )}
        </ThemedSafeAreaView>
    );
}

/**
 * Creates styles for bird card component
 */
function createBirdCardStyles() {
    return StyleSheet.create({
        birdCard: {
            marginBottom: 16,
            width: '95%',
            minWidth: "95%",
            alignSelf: 'center',
        },
        birdCardInner: {
            overflow: 'hidden',
        },
        cardContent: {
            padding: 12,
            gap: 8,
            width: '100%',
        },
        cardLayout: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 12,
        },
        birdImageContainer: {
            width: 60,
            height: 60,
            borderRadius: 8,
            overflow: 'hidden',
        },
        birdImage: {
            width: '100%',
            height: '100%',
        },
        birdImagePlaceholder: {
            width: '100%',
            height: '100%',
            justifyContent: 'center',
            alignItems: 'center',
            borderRadius: 8,
        },
        birdContentContainer: {
            flex: 1,
            gap: 8,
        },
        cardHeader: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
        },
        birdInfo: {
            flex: 1,
            marginRight: 8,
        },
        birdName: {
            fontWeight: '600',
            marginBottom: 2,
        },
        scientificName: {
            fontStyle: 'italic',
        },
        cardIndicators: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
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
            gap: 4,
            width: '100%',
        },
        metaBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 6,
            paddingVertical: 3,
            borderRadius: 6,
            gap: 3,
            flex: 1,
            minWidth: 0,
        },
    });
}

function createStyles() {
    return StyleSheet.create({
        container: {
            flex: 1,
        },
    // Header
    header: {
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    headerTitle: {
        fontWeight: 'bold',
        marginBottom: 4,
    },

    // Search Header
    searchHeader: {
        paddingHorizontal: 20,
        paddingBottom: 16,
        position: 'relative',
        zIndex: 1000,
        elevation: 1000,
    },
    searchRow: {
        marginBottom: 8,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        minHeight: 48,
        borderRadius: 24,
        borderWidth: 0,
        gap: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        lineHeight: 20,
    },
    statsRow: {
        marginBottom: 12,
        alignItems: 'center',
    },
    filterRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    filterButton: {
        flexDirection: 'row',
        gap: 4,
    },

    // Dropdown Menus
    dropdownMenu: {
        position: 'absolute',
        top: '100%',
        left: 20,
        right: 20,
        zIndex: 9999,
        marginTop: 8,
        elevation: 1000,
    },
    menuContent: {
        borderRadius: 12,
        borderWidth: 1,
        overflow: 'hidden',
        elevation: 1000,
        zIndex: 9999,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 8,
        },
        shadowOpacity: 0.25,
        shadowRadius: 20,
    },
    menuOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        gap: 8,
    },
    categoryLabel: {
        flex: 1,
    },

    // Bird Cards
    listContent: {
        paddingHorizontal: 20,
        paddingBottom: 32,
    },
    birdCard: {
        marginBottom: 8,
    },
    birdCardInner: {
        overflow: 'hidden',
    },
    cardContent: {
        padding: 12,
        gap: 8,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
    },
    birdInfo: {
        flex: 1,
        marginRight: 8,
    },
    birdName: {
        fontWeight: '600',
        marginBottom: 2,
    },
    scientificName: {
        fontStyle: 'italic',
    },
    cardIndicators: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
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
        gap: 4,
    },
    metaBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 6,
        gap: 3,
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

    // Pagination
    paginationContainer: {
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        gap: 12,
    },
    paginationInfo: {
        textAlign: 'center',
    },
    paginationControls: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    paginationButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        minWidth: 80,
    },
    paginationButtonDisabled: {
        opacity: 0.5,
    },
    pageInfo: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    pageText: {
        fontWeight: '500',
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