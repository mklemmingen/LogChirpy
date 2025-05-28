import React, {useCallback, useEffect, useRef, useState} from 'react';
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
    ScrollView
} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useRouter} from 'expo-router';
import {Feather} from '@expo/vector-icons';
import {BlurView} from 'expo-blur';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import BirdAnimation from '@/components/BirdAnimation';
import {theme, getSemanticColors} from '@/constants/theme';

import {
    type BirdDexRecord,
    type BirdCategory,
    getBirdDexRowCount,
    initBirdDexDB,
    queryBirdDexPage,
    getAvailableCategories
} from '@/services/databaseBirDex';
import {hasSpottingForLatin} from '@/services/database';

const PAGE_SIZE = 15;

type NameKey =
    | 'english_name'
    | 'german_name'
    | 'spanish_name'
    | 'ukrainian_name'
    | 'arabic_name';

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

    const [list, setList] = useState<DisplayRecord[]>([]);
    const [searchText, setSearch] = useState('');
    const [sortKey, setSortKey] = useState<keyof BirdDexRecord>('english_name');
    const [asc, setAsc] = useState(true);
    const [showSortMenu, setShowSortMenu] = useState(false);

    // Category filtering state
    const [categoryFilter, setCategoryFilter] = useState<BirdCategory>('all');
    const [showCategoryMenu, setShowCategoryMenu] = useState(false);
    const [availableCategories, setAvailableCategories] = useState<{ category: string; count: number }[]>([]);

    const [initLoading, setInit] = useState(true);
    const [refreshing, setRefresh] = useState(false);
    const initedRef = useRef(false);

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

    // Category display names
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
            case 'subspecies': return 'circle-dot';
            case 'family': return 'users';
            case 'group (polytypic)': return 'layers';
            case 'group (monotypic)': return 'square';
            case 'all': return 'grid';
            default: return 'tag';
        }
    };

    const loadPage = useCallback(async (target: number) => {
        setRefresh(true);
        try {
            const searchTerm = searchText.trim();
            const raw = queryBirdDexPage(searchTerm, sortKey, asc, PAGE_SIZE, target, categoryFilter);

            // Pick translation column based on locale
            const lang = i18n.language.split('-')[0];
            const colMap: Record<string, NameKey> = {
                en: 'english_name',
                de: 'german_name',
                es: 'spanish_name',
                uk: 'ukrainian_name',
                ar: 'arabic_name',
            };

            const langCol: NameKey = colMap[lang] || 'english_name';

            const rows: DisplayRecord[] = raw.map(r => {
                let displayName = r[langCol];

                if (!displayName || displayName.trim() === '') {
                    displayName = r.english_name;
                }

                if (!displayName || displayName.trim() === '') {
                    displayName = r.scientific_name;
                }

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
            setInit(false);
        }
    }, [searchText, sortKey, asc, categoryFilter, i18n.language]);

    // Initialize DB and load categories
    useEffect(() => {
        (async () => {
            try {
                if (!initedRef.current) {
                    await initBirdDexDB();
                    initedRef.current = true;

                    // Load available categories
                    const categories = getAvailableCategories();
                    setAvailableCategories(categories);
                }
            } catch (e) {
                console.error('DB init error', e);
                Alert.alert(t('birddex.error'), t('birddex.initFailed'));
            } finally {
                loadPage(1);
            }
        })();
    }, []);

    // Reload on search/sort/category change
    useEffect(() => {
        if (initedRef.current) {
            const timeoutId = setTimeout(() => loadPage(1), 300);
            return () => clearTimeout(timeoutId);
        }
    }, [searchText, sortKey, asc, categoryFilter]);

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
            <BlurView
                intensity={80}
                tint={scheme === "dark" ? "dark" : "light"}
                style={[styles.categoryMenu, { borderColor: pal.colors.border }]}
            >
                <ScrollView style={styles.categoryMenuScroll} showsVerticalScrollIndicator={false}>
                    {/* All categories option */}
                    <Pressable
                        style={[
                            styles.categoryOption,
                            { borderBottomColor: pal.colors.border },
                            categoryFilter === 'all' && { backgroundColor: pal.colors.primary + '20' }
                        ]}
                        onPress={() => handleCategoryFilter('all')}
                        android_ripple={null}
                    >
                        <Feather name="grid" size={16} color={pal.colors.text.secondary} />
                        <Text style={[styles.categoryOptionText, { color: pal.colors.text.primary }]}>
                            {getCategoryDisplayName('all')}
                        </Text>
                        <Text style={[styles.categoryCount, { color: pal.colors.text.secondary }]}>
                            {totalCount}
                        </Text>
                        {categoryFilter === 'all' && (
                            <Feather name="check" size={16} color={pal.colors.primary} />
                        )}
                    </Pressable>

                    {/* Individual categories */}
                    {availableCategories.map((cat) => (
                        <Pressable
                            key={cat.category}
                            style={[
                                styles.categoryOption,
                                { borderBottomColor: pal.colors.border },
                                categoryFilter === cat.category && { backgroundColor: pal.colors.primary + '20' }
                            ]}
                            onPress={() => handleCategoryFilter(cat.category as BirdCategory)}
                            android_ripple={null}
                        >
                            <Feather name={getCategoryIcon(cat.category) as any} size={16} color={pal.colors.text.secondary} />
                            <Text style={[styles.categoryOptionText, { color: pal.colors.text.primary }]}>
                                {getCategoryDisplayName(cat.category)}
                            </Text>
                            <Text style={[styles.categoryCount, { color: pal.colors.text.secondary }]}>
                                {cat.count}
                            </Text>
                            {categoryFilter === cat.category && (
                                <Feather name="check" size={16} color={pal.colors.primary} />
                            )}
                        </Pressable>
                    ))}
                </ScrollView>
            </BlurView>
        )
    );

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

    if (initLoading) {
        return (
            <SafeAreaView style={[styles.loadingContainer, { backgroundColor: pal.colors.background }]}>
                <BirdAnimation numberOfBirds={5} />
                <ActivityIndicator size="large" color={pal.colors.primary} style={styles.loadingSpinner} />
                <Text style={[styles.loadingText, { color: pal.colors.text.primary }]}>
                    {t('birddex.initializingDb')}
                </Text>
                <Text style={[styles.loadingSubtext, { color: pal.colors.text.secondary }]}>
                    {t('birddex.preparingBirdData')}
                </Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: pal.colors.background }]}>
            {/* Header */}
            <View style={[styles.header, { marginTop: insets.top }]}>
                <Text style={[styles.headerTitle, { color: pal.colors.text.primary }]}>
                    {t('birddex.title')}
                </Text>
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
        padding: theme.spacing.xl,
    },
    loadingSpinner: {
        marginTop: theme.spacing.lg,
    },
    loadingText: {
        fontSize: 18,
        fontWeight: '600',
        marginTop: theme.spacing.md,
        textAlign: 'center',
    },
    loadingSubtext: {
        fontSize: 14,
        marginTop: theme.spacing.sm,
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
    categoryButton: {
        width: 48,
        height: 48,
        borderRadius: theme.borderRadius.lg,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    smartSearchButton: {
        width: 48,
        height: 48,
        borderRadius: theme.borderRadius.lg,
        justifyContent: 'center',
        alignItems: 'center',
        ...theme.shadows.sm,
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

    // Category Menu
    categoryMenu: {
        position: 'absolute',
        top: 120,
        right: 60,
        zIndex: 1000,
        borderRadius: theme.borderRadius.lg,
        borderWidth: 1,
        overflow: 'hidden',
        minWidth: 220,
        maxHeight: 300,
    },
    categoryMenuScroll: {
        maxHeight: 280,
    },
    categoryOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.md,
        gap: theme.spacing.sm,
        borderBottomWidth: 1,
    },
    categoryOptionText: {
        flex: 1,
        fontSize: 15,
    },
    categoryCount: {
        fontSize: 12,
        marginRight: theme.spacing.sm,
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
});