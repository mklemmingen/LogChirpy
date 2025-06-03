import React, {useCallback, useEffect, useState} from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Linking,
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    useColorScheme,
    View,
} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useRouter} from 'expo-router';
import {Feather} from '@expo/vector-icons';
import {BlurView} from 'expo-blur';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {getSemanticColors, theme} from '@/constants/theme';
import {useBirdDexDatabase} from '@/hooks/useBirdDexDatabase';

import {
    type BirdCategory,
    type BirdDexRecord,
    getAvailableCategories,
    getBirdDexRowCount,
    queryBirdDexPage,
} from '@/services/databaseBirDex';
import {hasSpottingForLatin} from '@/services/database';

const PAGE_SIZE = 15;

type DisplayRecord = BirdDexRecord & {
    displayName: string;
    logged: boolean;
};

type SortOption = {
    key: keyof BirdDexRecord;
    label: string;
    icon: string;
};

export default function BirdDexIndex() {
    const { i18n, t } = useTranslation();
    const router = useRouter();
    const scheme = useColorScheme() ?? 'light';
    const pal = theme[scheme];
    const semanticColors = getSemanticColors(scheme === 'dark');
    const insets = useSafeAreaInsets();

    // Database status - no need for complex initialization since it's handled at app level
    const { isReady, isLoading, hasError, error, retry } = useBirdDexDatabase();

    // Component state
    const [list, setList] = useState<DisplayRecord[]>([]);
    const [searchText, setSearch] = useState('');
    const [sortKey, setSortKey] = useState<keyof BirdDexRecord>('english_name');
    const [asc, setAsc] = useState(true);
    const [showSortMenu, setShowSortMenu] = useState(false);
    const [categoryFilter, setCategoryFilter] = useState<BirdCategory>('all');
    const [showCategoryMenu, setShowCategoryMenu] = useState(false);
    const [availableCategories, setAvailableCategories] = useState<{ category: string; count: number }[]>([]);
    const [refreshing, setRefresh] = useState(false);
    const [page, setPage] = useState(1);
    const [pageCount, setPageCount] = useState(1);
    const [totalCount, setTotalCount] = useState(0);

    const sortOptions: SortOption[] = [
        { key: 'english_name', label: t('birddex.sortByName'), icon: 'type' },
        { key: 'scientific_name', label: t('birddex.sortByScientific'), icon: 'book' },
        { key: 'family', label: t('birddex.sortByFamily'), icon: 'users' },
        { key: 'category', label: t('birddex.sortByCategory'), icon: 'tag' },
        { key: 'hasBeenLogged', label: t('birddex.sortByLogged'), icon: 'check-circle' }
    ];

    // Category display functions
    const getCategoryDisplayName = (category: string): string => {
        switch (category) {
            case 'species': return t('birddex.categories.species');
            case 'subspecies': return t('birddex.categories.subspecies');
            case 'family': return t('birddex.categories.family');
            case 'group (polytypic)': return t('birddex.categories.groupPolytypic');
            case 'group (monotypic)': return t('birddex.categories.groupMonotypic');
            case 'all': return t('birddex.categories.all');
            default: return category;
        }
    };

    const getCategoryIcon = (category: string): string => {
        switch (category) {
            case 'species': return 'circle';
            case 'subspecies': return 'target'; // Changed from 'circle-dot' to 'target'
            case 'family': return 'users';
            case 'group (polytypic)': return 'layers';
            case 'group (monotypic)': return 'square';
            case 'all': return 'grid';
            default: return 'tag';
        }
    };

    // Load page data
    const loadPage = useCallback(async (target: number) => {
        if (!isReady) {
            console.log('Database not ready yet');
            return;
        }

        setRefresh(true);
        try {
            const searchTerm = searchText.trim();
            const raw = queryBirdDexPage(searchTerm, sortKey, asc, PAGE_SIZE, target, categoryFilter);

            // Language handling logic remains the same...
            const lang = i18n.language.split('-')[0];
            const colMap: Record<string, keyof BirdDexRecord> = {
                en: 'english_name',
                de: 'de_name',
                es: 'es_name',
                uk: 'ukrainian_name',
                ar: 'ar_name',
            };

            const langCol = colMap[lang] || 'english_name';

            const rows: DisplayRecord[] = raw.map(r => {
                let displayName = String(r[langCol] || '').trim();
                if (!displayName) displayName = String(r.english_name || '').trim();
                if (!displayName) displayName = String(r.scientific_name || '').trim();

                return {
                    ...r,
                    displayName: displayName || 'Unknown Bird',
                    logged: hasSpottingForLatin(r.scientific_name),
                };
            });

            const total = getBirdDexRowCount(searchTerm, categoryFilter);
            setTotalCount(total);
            setPageCount(Math.max(1, Math.ceil(total / PAGE_SIZE)));
            setList(rows);
            setPage(target);
        } catch (e) {
            console.error('Load page error:', e);
            Alert.alert(t('birddex.error'), t('birddex.loadPageFailed'));
        } finally {
            setRefresh(false);
        }
    }, [searchText, sortKey, asc, categoryFilter, i18n.language, isReady, t]);

    // Load categories when database is ready
    useEffect(() => {
        if (isReady) {
            try {
                const categories = getAvailableCategories();
                setAvailableCategories(categories);
                loadPage(1);
            } catch (e) {
                console.error('Failed to load categories:', e);
            }
        }
    }, [isReady, loadPage]);

    // Show error state if database failed to initialize
    if (hasError) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: pal.colors.background }]}>
                <View style={styles.errorContainer}>
                    <Feather name="alert-triangle" size={64} color={pal.colors.error} />
                    <Text style={[styles.errorTitle, { color: pal.colors.text.primary }]}>
                        {t('birddex.error')}
                    </Text>
                    <Text style={[styles.errorMessage, { color: pal.colors.text.secondary }]}>
                        {error || t('birddex.initFailed')}
                    </Text>
                    <Pressable
                        style={[styles.retryButton, { backgroundColor: pal.colors.primary }]}
                        onPress={retry}
                    >
                        <Text style={[styles.retryButtonText, { color: pal.colors.text.onPrimary }]}>
                            {t('birddex.reload')}
                        </Text>
                    </Pressable>
                </View>
            </SafeAreaView>
        );
    }

    // Show simple loading state while database initializes
    if (isLoading || !isReady) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: pal.colors.background }]}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={pal.colors.primary} />
                    <Text style={[styles.loadingText, { color: pal.colors.text.secondary }]}>
                        {t('birddex.loadingEntries')}
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    // Reload on search/sort/category change
    useEffect(() => {
        if (isReady) {
            const timeoutId = setTimeout(() => loadPage(1), 300);
            return () => clearTimeout(timeoutId);
        }
    }, [searchText, sortKey, asc, categoryFilter, isReady, loadPage]);

    const handleSort = (key: keyof BirdDexRecord) => {
        if (key === sortKey) {
            setAsc(a => !a);
        } else {
            setSortKey(key);
            setAsc(true);
        }
        setShowSortMenu(false);
    };

    const handleCategoryFilter = (category: BirdCategory) => {
        setCategoryFilter(category);
        setShowCategoryMenu(false);
    };

    const openWikipedia = useCallback((scientificName: string) => {
        const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(scientificName)}`;
        Linking.openURL(url);
    }, []);

    // Render method for bird cards
    const renderBirdCard = useCallback(({ item, index }: { item: DisplayRecord; index: number }) => (
        <BlurView
            intensity={60}
            tint={scheme === "dark" ? "dark" : "light"}
            style={[
                styles.birdCard,
                {
                    borderColor: pal.colors.border,
                    backgroundColor: item.logged ? pal.colors.primary + '15' : 'transparent'
                }
            ]}
        >
            {/* Category badge */}
            <View style={[styles.categoryBadge, { backgroundColor: pal.colors.accent + '20' }]}>
                <Feather name={getCategoryIcon(item.category) as any} size={10} color={pal.colors.accent} />
                <Text style={[styles.categoryText, { color: pal.colors.accent }]}>
                    {item.category}
                </Text>
            </View>

            {/* Logged indicator */}
            {item.logged && (
                <View style={[styles.loggedBadge, { backgroundColor: pal.colors.primary }]}>
                    <Feather name="check" size={12} color={pal.colors.text.onPrimary} />
                </View>
            )}

            <Pressable
                style={styles.cardContent}
                onPress={() => router.push(`/birdex/details/${item.species_code}`)}
                android_ripple={null}
            >
                <View style={styles.birdInfo}>
                    <Text style={[styles.birdName, { color: pal.colors.text.primary }]} numberOfLines={1}>
                        {item.displayName}
                    </Text>
                    <Text style={[styles.scientificName, { color: pal.colors.text.secondary }]} numberOfLines={1}>
                        {item.scientific_name}
                    </Text>
                    {item.family && (
                        <Text style={[styles.familyName, { color: pal.colors.text.tertiary }]} numberOfLines={1}>
                            {item.family}
                        </Text>
                    )}
                </View>

                <View style={styles.cardActions}>
                    <Pressable
                        style={[styles.actionBtn, { backgroundColor: pal.colors.surfaceVariant }]}
                        onPress={(e) => {
                            e.stopPropagation();
                            openWikipedia(item.scientific_name);
                        }}
                        android_ripple={null}
                    >
                        <Feather name="external-link" size={16} color={pal.colors.text.secondary} />
                    </Pressable>

                    <Feather name="chevron-right" size={20} color={pal.colors.text.secondary} />
                </View>
            </Pressable>
        </BlurView>
    ), [pal.colors, router, openWikipedia, scheme]);

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
                            sortKey === option.key && { backgroundColor: pal.colors.primary + '20' }
                        ]}
                        onPress={() => handleSort(option.key)}
                        android_ripple={null}
                    >
                        <Feather name={option.icon as any} size={16} color={pal.colors.text.secondary} />
                        <Text style={[styles.sortOptionText, { color: pal.colors.text.primary }]}>
                            {option.label}
                        </Text>
                        {sortKey === option.key && (
                            <Feather
                                name={asc ? "arrow-up" : "arrow-down"}
                                size={16}
                                color={pal.colors.primary}
                            />
                        )}
                    </Pressable>
                ))}
            </BlurView>
        )
    );

    const renderCategoryMenu = () => (
        showCategoryMenu && (
            <>
                {/* Backdrop overlay for better focus */}
                <Pressable
                    style={styles.menuBackdrop}
                    onPress={() => setShowCategoryMenu(false)}
                    android_ripple={null}
                />

                <View style={[styles.categoryMenu, { backgroundColor: pal.colors.surface }]}>
                    {/* Menu Header */}
                    <View style={[styles.menuHeader, { borderBottomColor: pal.colors.border }]}>
                        <Text style={[styles.menuTitle, { color: pal.colors.text.primary }]}>
                            Filter by Category
                        </Text>
                        <Pressable
                            onPress={() => setShowCategoryMenu(false)}
                            style={styles.closeButton}
                            android_ripple={null}
                        >
                            <Feather name="x" size={20} color={pal.colors.text.secondary} />
                        </Pressable>
                    </View>

                    {/* All categories option */}
                    <Pressable
                        style={[
                            styles.categoryOption,
                            { backgroundColor: categoryFilter === 'all' ? pal.colors.primary + '15' : 'transparent' }
                        ]}
                        onPress={() => handleCategoryFilter('all')}
                        android_ripple={{ color: pal.colors.primary + '20' }}
                    >
                        <View style={styles.categoryOptionContent}>
                            <View style={styles.categoryLeft}>
                                <View style={[
                                    styles.iconContainer,
                                    { backgroundColor: pal.colors.primary + '15' }
                                ]}>
                                    <Feather name="grid" size={16} color={pal.colors.primary} />
                                </View>
                                <View style={styles.categoryTextContainer}>
                                    <Text style={[styles.categoryOptionText, { color: pal.colors.text.primary }]}>
                                        {getCategoryDisplayName('all')}
                                    </Text>
                                    <Text style={[styles.categoryDescription, { color: pal.colors.text.secondary }]}>
                                        Show all species
                                    </Text>
                                </View>
                            </View>
                            <View style={styles.categoryRight}>
                                <Text style={[styles.categoryCount, { color: pal.colors.text.secondary }]}>
                                    {totalCount.toLocaleString()}
                                </Text>
                                {categoryFilter === 'all' && (
                                    <Feather name="check" size={18} color={pal.colors.primary} />
                                )}
                            </View>
                        </View>
                    </Pressable>

                    {/* Individual categories */}
                    {availableCategories.map((cat) => (
                        <Pressable
                            key={cat.category}
                            style={[
                                styles.categoryOption,
                                { backgroundColor: categoryFilter === cat.category ? pal.colors.primary + '15' : 'transparent' }
                            ]}
                            onPress={() => handleCategoryFilter(cat.category as BirdCategory)}
                            android_ripple={{ color: pal.colors.primary + '20' }}
                        >
                            <View style={styles.categoryOptionContent}>
                                <View style={styles.categoryLeft}>
                                    <View style={[
                                        styles.iconContainer,
                                        { backgroundColor: pal.colors.accent + '15' }
                                    ]}>
                                        <Feather name={getCategoryIcon(cat.category) as any} size={16} color={pal.colors.accent} />
                                    </View>
                                    <View style={styles.categoryTextContainer}>
                                        <Text style={[styles.categoryOptionText, { color: pal.colors.text.primary }]}>
                                            {getCategoryDisplayName(cat.category)}
                                        </Text>
                                        <Text style={[styles.categoryDescription, { color: pal.colors.text.secondary }]}>
                                            {getCategoryDescription(cat.category)}
                                        </Text>
                                    </View>
                                </View>
                                <View style={styles.categoryRight}>
                                    <Text style={[styles.categoryCount, { color: pal.colors.text.secondary }]}>
                                        {cat.count.toLocaleString()}
                                    </Text>
                                    {categoryFilter === cat.category && (
                                        <Feather name="check" size={18} color={pal.colors.primary} />
                                    )}
                                </View>
                            </View>
                        </Pressable>
                    ))}
                </View>
            </>
        )
    );

    const getCategoryDescription = (category: string): string => {
        switch (category) {
            case 'species': return 'Distinct species';
            case 'subspecies': return 'Subspecies variants';
            case 'family': return 'Family groups';
            case 'group (polytypic)': return 'Multi-form groups';
            case 'group (monotypic)': return 'Single-form groups';
            default: return '';
        }
    };

    const renderPagination = () => (
        <View style={styles.paginationContainer}>
            <View style={styles.paginationInfo}>
                <Text style={[styles.paginationText, { color: pal.colors.text.secondary }]}>
                    {t('birddex.showingResults', {
                        start: (page - 1) * PAGE_SIZE + 1,
                        end: Math.min(page * PAGE_SIZE, totalCount),
                        total: totalCount
                    })}
                </Text>
            </View>

            <View style={styles.paginationControls}>
                <Pressable
                    disabled={page === 1}
                    onPress={() => loadPage(page - 1)}
                    style={[
                        styles.pageBtn,
                        { backgroundColor: pal.colors.surfaceVariant },
                        page === 1 && styles.disabledBtn
                    ]}
                    android_ripple={null}
                >
                    <Feather name="chevron-left" size={18} color={pal.colors.text.primary} />
                </Pressable>

                <Text style={[styles.pageInfo, { color: pal.colors.text.primary }]}>
                    {page} / {pageCount}
                </Text>

                <Pressable
                    disabled={page === pageCount}
                    onPress={() => loadPage(page + 1)}
                    style={[
                        styles.pageBtn,
                        { backgroundColor: pal.colors.surfaceVariant },
                        page === pageCount && styles.disabledBtn
                    ]}
                    android_ripple={null}
                >
                    <Feather name="chevron-right" size={18} color={pal.colors.text.primary} />
                </Pressable>
            </View>
        </View>
    );

    // Main BirdDex interface
    return (
        <SafeAreaView style={[styles.container, { backgroundColor: pal.colors.background }]}>

            {/* Header */}
            <View style={[styles.header, { marginTop: insets.top }]}>
                <Text style={[styles.headerTitle, { color: pal.colors.text.primary }]}>
                    {t('birddex.title')}
                </Text>
                <View style={styles.headerSubtitleContainer}>
                    <Text style={[styles.headerSubtitle, { color: pal.colors.text.secondary }]}>
                        {categoryFilter === 'all'
                            ? t('birddex.subtitle', { count: totalCount })
                            : t('birddex.subtitleFiltered', {
                                count: totalCount,
                                category: getCategoryDisplayName(categoryFilter)
                            })
                        }
                    </Text>
                </View>
            </View>

            {/* Search and Controls Bar */}
            <View style={styles.controlsContainer}>
                <View style={[styles.searchContainer, { borderColor: pal.colors.border }]}>
                    <Feather name="search" size={18} color={pal.colors.text.secondary} />
                    <TextInput
                        style={[styles.searchInput, { color: pal.colors.text.primary }]}
                        placeholder={t('birddex.searchPlaceholder')}
                        placeholderTextColor={pal.colors.text.secondary}
                        value={searchText}
                        onChangeText={setSearch}
                    />
                    {searchText.length > 0 && (
                        <Pressable onPress={() => setSearch('')} android_ripple={null}>
                            <Feather name="x" size={18} color={pal.colors.text.secondary} />
                        </Pressable>
                    )}
                </View>

                <Pressable
                    style={[
                        styles.categoryButton,
                        {
                            backgroundColor: categoryFilter !== 'all' ? pal.colors.accent : pal.colors.surfaceVariant,
                            borderColor: pal.colors.border
                        }
                    ]}
                    onPress={() => setShowCategoryMenu(!showCategoryMenu)}
                    android_ripple={null}
                >
                    <Feather
                        name={getCategoryIcon(categoryFilter) as any}
                        size={18}
                        color={categoryFilter !== 'all' ? pal.colors.text.onPrimary : pal.colors.text.primary}
                    />
                </Pressable>

                <Pressable
                    style={[styles.sortButton, { backgroundColor: pal.colors.surfaceVariant, borderColor: pal.colors.border }]}
                    onPress={() => setShowSortMenu(!showSortMenu)}
                    android_ripple={null}
                >
                    <Feather name="filter" size={18} color={pal.colors.text.primary} />
                </Pressable>
            </View>

            {/* Active Filter Indicator */}
            {categoryFilter !== 'all' && (
                <View style={styles.activeFilterContainer}>
                    <View style={[styles.activeFilter, { backgroundColor: pal.colors.accent + '20' }]}>
                        <Feather name={getCategoryIcon(categoryFilter) as any} size={14} color={pal.colors.accent} />
                        <Text style={[styles.activeFilterText, { color: pal.colors.accent }]}>
                            {getCategoryDisplayName(categoryFilter)}
                        </Text>
                        <Pressable
                            onPress={() => setCategoryFilter('all')}
                            android_ripple={null}
                        >
                            <Feather name="x" size={14} color={pal.colors.accent} />
                        </Pressable>
                    </View>
                </View>
            )}

            {/* Menus */}
            {renderSortMenu()}
            {renderCategoryMenu()}

            {/* Bird List */}
            <FlatList
                data={list}
                keyExtractor={r => r.species_code}
                renderItem={renderBirdCard}
                refreshing={refreshing}
                onRefresh={() => loadPage(page)}
                contentContainerStyle={styles.listContainer}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                    refreshing ? (
                        <View style={styles.emptyContainer}>
                            <ActivityIndicator size="large" color={pal.colors.primary} />
                        </View>
                    ) : (
                        <View style={styles.emptyContainer}>
                            <Feather name="search" size={48} color={pal.colors.text.secondary} />
                            <Text style={[styles.emptyText, { color: pal.colors.text.secondary }]}>
                                {searchText || categoryFilter !== 'all'
                                    ? t('birddex.noSearchResults')
                                    : t('birddex.noResults')
                                }
                            </Text>
                            {(searchText || categoryFilter !== 'all') && (
                                <Text style={[styles.emptySubtext, { color: pal.colors.text.secondary }]}>
                                    {t('birddex.tryDifferentSearch')}
                                </Text>
                            )}
                        </View>
                    )
                }
                ListFooterComponent={list.length > 0 ? renderPagination : null}
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
        paddingVertical: theme.spacing.xxl,
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
    headerSubtitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 2,
    },
    headerSubtitle: {
        fontSize: 14,
        flex: 1,
    },
    coreModeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: theme.spacing.xs,
        paddingVertical: 2,
        borderRadius: theme.borderRadius.sm,
        gap: 4,
    },
    coreModeText: {
        fontSize: 10,
        fontWeight: '600',
        textTransform: 'uppercase',
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
    categoryButton: {
        width: 48,
        height: 48,
        borderRadius: theme.borderRadius.lg,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Active Filter
    activeFilterContainer: {
        paddingHorizontal: theme.spacing.md,
        paddingBottom: theme.spacing.sm,
    },
    activeFilter: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: theme.spacing.xs,
        borderRadius: theme.borderRadius.md,
        gap: theme.spacing.xs,
        alignSelf: 'flex-start',
    },
    activeFilterText: {
        fontSize: 12,
        fontWeight: '500',
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

    // Bird Cards
    listContainer: {
        padding: theme.spacing.md,
        paddingTop: theme.spacing.sm,
    },
    birdCard: {
        marginBottom: theme.spacing.md,
        borderRadius: theme.borderRadius.lg,
        borderWidth: 1,
        overflow: 'hidden',
        position: 'relative',
    },
    categoryBadge: {
        position: 'absolute',
        top: theme.spacing.sm,
        left: theme.spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: theme.spacing.xs,
        paddingVertical: 2,
        borderRadius: theme.borderRadius.sm,
        gap: 4,
        zIndex: 10,
    },
    categoryText: {
        fontSize: 10,
        fontWeight: '500',
        textTransform: 'uppercase',
    },
    coreIndicator: {
        width: 16,
        height: 16,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 4,
    },
    loggedBadge: {
        position: 'absolute',
        top: theme.spacing.sm,
        right: theme.spacing.sm,
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    cardContent: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: theme.spacing.md,
        paddingTop: theme.spacing.lg, // More space for badges
    },
    birdInfo: {
        flex: 1,
        marginRight: theme.spacing.sm,
    },
    birdName: {
        fontSize: 17,
        fontWeight: '600',
        marginBottom: 2,
    },
    scientificName: {
        fontSize: 14,
        fontStyle: 'italic',
        marginBottom: 2,
    },
    familyName: {
        fontSize: 12,
        opacity: 0.8,
    },
    cardActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
    },
    actionBtn: {
        width: 32,
        height: 32,
        borderRadius: theme.borderRadius.sm,
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Empty State
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: theme.spacing.xxl,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '500',
        marginTop: theme.spacing.md,
        textAlign: 'center',
    },
    emptySubtext: {
        fontSize: 14,
        marginTop: theme.spacing.sm,
        textAlign: 'center',
    },

    // Pagination
    paginationContainer: {
        paddingVertical: theme.spacing.lg,
        gap: theme.spacing.md,
    },
    paginationInfo: {
        alignItems: 'center',
    },
    paginationText: {
        fontSize: 14,
    },
    paginationControls: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: theme.spacing.md,
    },
    pageBtn: {
        width: 40,
        height: 40,
        borderRadius: theme.borderRadius.md,
        justifyContent: 'center',
        alignItems: 'center',
    },
    pageInfo: {
        fontSize: 16,
        fontWeight: '600',
        minWidth: 60,
        textAlign: 'center',
    },
    disabledBtn: {
        opacity: 0.3,
    },

    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: theme.spacing.xl,
    },
    errorTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        marginTop: theme.spacing.lg,
        marginBottom: theme.spacing.sm,
        textAlign: 'center',
    },
    errorMessage: {
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: theme.spacing.xl,
    },
    retryButton: {
        paddingVertical: theme.spacing.md,
        paddingHorizontal: theme.spacing.lg,
        borderRadius: theme.borderRadius.lg,
    },
    retryButtonText: {
        fontSize: 16,
        fontWeight: '600',
    },
    // Menu overlay
    menuBackdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        zIndex: 999,
    },

    // Category Menu
    categoryMenu: {
        position: 'absolute',
        top: 120,
        right: theme.spacing.md,
        left: theme.spacing.md, // Full width instead of min-width
        zIndex: 1000,
        borderRadius: theme.borderRadius.xl,
        maxHeight: 400,
        ...theme.shadows.md,
        // Remove BlurView styling, use solid background
    },

    menuHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: theme.spacing.md,
        borderBottomWidth: 1,
    },

    menuTitle: {
        fontSize: 18,
        fontWeight: '600',
    },

    closeButton: {
        padding: theme.spacing.xs,
    },

    categoryOption: {
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: theme.spacing.md,
        // Remove border styling
    },

    categoryOptionContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },

    categoryLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: theme.spacing.md,
    },

    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },

    categoryTextContainer: {
        flex: 1,
        gap: 2,
    },

    categoryOptionText: {
        fontSize: 16,
        fontWeight: '500',
        lineHeight: 20,
    },

    categoryDescription: {
        fontSize: 12,
        lineHeight: 16,
    },

    categoryRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
    },

    categoryCount: {
        fontSize: 14,
        fontWeight: '500',
        minWidth: 40,
        textAlign: 'right',
    },
});