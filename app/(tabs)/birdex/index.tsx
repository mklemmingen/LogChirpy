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
    ScrollView,
    Animated,
    Dimensions
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
    type ProgressData,
    getBirdDexRowCount,
    initBirdDexDB,
    queryBirdDexPage,
    getAvailableCategories,
    isDbReady
} from '@/services/databaseBirDex';
import {hasSpottingForLatin} from '@/services/database';

const PAGE_SIZE = 15;
const MAX_FLYING_BIRDS = 3; // Strict limit to prevent memory leaks

// Enhanced FlyingBird interface with cleanup tracking
interface FlyingBird {
    id: number;
    name: string;
    language: string;
    color: string;
    positionX: Animated.Value;
    positionY: Animated.Value;
    opacity: Animated.Value;
    fontSize: number;
    angle: number;
    speed: number;
    currentY: number;
    // Animation cleanup tracking
    animationRef?: Animated.CompositeAnimation;
    isCleanedUp: boolean;
}

// Available colors for the animation
const BIRD_COLORS = [
    '#E53935', // red
    '#43A047', // green
    '#1E88E5', // blue
    '#FB8C00', // orange
    '#8E24AA', // purple
    '#00ACC1', // teal
    '#FFD600', // yellow
    '#6D4C41', // brown
    '#546E7A', // blue-gray
    '#EC407A', // pink
];

// Language names for animation
const LANGUAGE_NAMES = {
    english_name: 'English',
    german_name: 'Deutsch',
    spanish_name: 'Español',
    ukrainian_name: 'Українська',
    arabic_name: 'العربية',
    scientific_name: 'Scientific'
};

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

    // Database initialization state
    const [dbInitialized, setDbInitialized] = useState(isDbReady());
    const [initProgress, setInitProgress] = useState<ProgressData>({
        loaded: 0,
        total: 100,
        phase: 'parsing',
        message: 'Initialisierung wird vorbereitet...'
    });
    const [initError, setInitError] = useState<string | null>(null);

    // Enhanced flying birds state with cleanup tracking
    const [flyingBirds, setFlyingBirds] = useState<FlyingBird[]>([]);
    const nextBirdId = useRef(1);
    const screenWidth = Dimensions.get('window').width;
    const screenHeight = Dimensions.get('window').height;
    const animationCleanupRefs = useRef<Set<number>>(new Set());

    // Add ref to track pending bird additions
    const pendingBirdsRef = useRef<Array<{bird: ProgressData['currentBird'], animationId?: string}>>([]);

    // Main component state
    const [list, setList] = useState<DisplayRecord[]>([]);
    const [searchText, setSearch] = useState('');
    const [sortKey, setSortKey] = useState<keyof BirdDexRecord>('english_name');
    const [asc, setAsc] = useState(true);
    const [showSortMenu, setShowSortMenu] = useState(false);

    // Category filtering state
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

    // Cleanup function for all animations
    const cleanupAllAnimations = useCallback(() => {
        setFlyingBirds(prevBirds => {
            prevBirds.forEach(bird => {
                if (bird.animationRef && !bird.isCleanedUp) {
                    bird.animationRef.stop();
                    bird.isCleanedUp = true;
                }
            });
            return [];
        });
        animationCleanupRefs.current.clear();
        pendingBirdsRef.current = [];
    }, []);

    // Fix the addFlyingBird function
    const addFlyingBird = useCallback((birdData: ProgressData['currentBird'], animationId?: string) => {
        if (!birdData) return;

        // Prevent duplicate animations
        if (animationId) {
            const animIdNum = parseInt(animationId.split('_')[1]);
            if (animationCleanupRefs.current.has(animIdNum)) {
                return;
            }
            animationCleanupRefs.current.add(animIdNum);
        }

        // Collect all available names in different languages
        const availableNames = Object.entries(birdData)
            .filter(([key, value]) =>
                value &&
                value.trim() !== '' &&
                ['english_name', 'german_name', 'spanish_name', 'ukrainian_name', 'arabic_name', 'scientific_name'].includes(key)
            );

        if (availableNames.length === 0) return;

        // Select random language
        const [selectedKey, selectedName] = availableNames[Math.floor(Math.random() * availableNames.length)];
        const birdId = nextBirdId.current++;

        // Random position, color and movement
        const startX = Math.random() < 0.5 ? -150 : screenWidth + 150;
        const startY = screenHeight * 0.6 + Math.random() * (screenHeight * 0.3);
        const endX = startX < 0 ? screenWidth + 150 : -150;
        const fontSize = 12 + Math.random() * 6;
        const angle = Math.random() * 20 - 10;
        const speed = 4000 + Math.random() * 4000;

        const positionX = new Animated.Value(startX);
        const positionY = new Animated.Value(startY);
        const opacity = new Animated.Value(0);

        const newBird: FlyingBird = {
            id: birdId,
            name: selectedName,
            language: LANGUAGE_NAMES[selectedKey as keyof typeof LANGUAGE_NAMES] || 'Unknown',
            color: BIRD_COLORS[Math.floor(Math.random() * BIRD_COLORS.length)],
            positionX,
            positionY,
            opacity,
            fontSize,
            angle,
            speed,
            currentY: startY,
            isCleanedUp: false
        };

        // Create animation sequence
        const animationSequence = Animated.sequence([
            // Fade in
            Animated.timing(opacity, {
                toValue: 1,
                duration: 800,
                useNativeDriver: true
            }),
            // Fly across screen
            Animated.parallel([
                Animated.timing(positionX, {
                    toValue: endX,
                    duration: speed,
                    useNativeDriver: true
                }),
                // Subtle Y movement
                Animated.sequence([
                    Animated.timing(positionY, {
                        toValue: startY - 20 + Math.random() * 40,
                        duration: speed / 3,
                        useNativeDriver: true
                    }),
                    Animated.timing(positionY, {
                        toValue: startY + 20 - Math.random() * 40,
                        duration: speed / 3,
                        useNativeDriver: true
                    }),
                    Animated.timing(positionY, {
                        toValue: startY,
                        duration: speed / 3,
                        useNativeDriver: true
                    })
                ])
            ]),
            // Fade out
            Animated.timing(opacity, {
                toValue: 0,
                duration: 800,
                useNativeDriver: true
            })
        ]);

        // Store animation reference for cleanup
        newBird.animationRef = animationSequence;

        // Add bird to state - handle max birds limit
        setFlyingBirds(prev => {
            if (prev.length >= MAX_FLYING_BIRDS) {
                // Remove oldest bird
                const [oldestBird, ...restBirds] = prev;
                if (oldestBird && oldestBird.animationRef && !oldestBird.isCleanedUp) {
                    oldestBird.animationRef.stop();
                    oldestBird.isCleanedUp = true;
                }
                return [...restBirds, newBird];
            }
            return [...prev, newBird];
        });

        // Start animation with proper cleanup
        animationSequence.start((finished) => {
            if (finished) {
                setFlyingBirds(prev => prev.filter(bird => bird.id !== birdId));
                if (animationId) {
                    const animIdNum = parseInt(animationId.split('_')[1]);
                    animationCleanupRefs.current.delete(animIdNum);
                }
            }
        });

        // Failsafe cleanup after maximum animation duration plus buffer
        setTimeout(() => {
            setFlyingBirds(prev => {
                const bird = prev.find(b => b.id === birdId);
                if (bird && !bird.isCleanedUp) {
                    if (bird.animationRef) {
                        bird.animationRef.stop();
                    }
                    bird.isCleanedUp = true;
                }
                return prev.filter(b => b.id !== birdId);
            });
            if (animationId) {
                const animIdNum = parseInt(animationId.split('_')[1]);
                animationCleanupRefs.current.delete(animIdNum);
            }
        }, speed + 2000);

    }, [screenWidth, screenHeight]);

    // Process pending birds
    useEffect(() => {
        const processPendingBirds = () => {
            if (pendingBirdsRef.current.length > 0) {
                const pending = pendingBirdsRef.current.shift();
                if (pending) {
                    addFlyingBird(pending.bird!, pending.animationId);
                }
            }
        };

        const interval = setInterval(processPendingBirds, 100);
        return () => clearInterval(interval);
    }, [addFlyingBird]);

    // Initialize database on component mount
    useEffect(() => {
        let isMounted = true;

        const initializeDatabase = async () => {
            if (dbInitialized || !isMounted) return;

            try {
                await initBirdDexDB((progressData: ProgressData) => {
                    if (!isMounted) return;

                    // Update progress state
                    setInitProgress(progressData);

                    // Check if animation should be triggered
                    if (progressData.shouldTriggerAnimation && progressData.currentBird) {
                        // Add to pending birds queue
                        pendingBirdsRef.current.push({
                            bird: progressData.currentBird,
                            animationId: progressData.animationId
                        });
                    }

                    if (progressData.phase === 'complete') {
                        setDbInitialized(true);
                        // Clean up any remaining animations after a delay
                        setTimeout(() => {
                            if (isMounted) {
                                cleanupAllAnimations();
                            }
                        }, 10000);
                    }
                });
            } catch (err) {
                if (isMounted) {
                    setInitError(err instanceof Error ? err.message : 'Unknown database initialization error');
                }
            }
        };

        initializeDatabase();

        return () => {
            isMounted = false;
        };
    }, [dbInitialized, cleanupAllAnimations]);

    // Cleanup on component unmount
    useEffect(() => {
        return () => {
            cleanupAllAnimations();
        };
    }, [cleanupAllAnimations]);

    // Enhanced cleanup when initialization completes or errors
    useEffect(() => {
        if (dbInitialized || initError) {
            // Cleanup animations after a delay to let final animations complete
            const cleanupTimer = setTimeout(() => {
                cleanupAllAnimations();
            }, 3000);

            return () => clearTimeout(cleanupTimer);
        }
    }, [dbInitialized, initError, cleanupAllAnimations]);

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
            case 'subspecies': return 'circle-dot';
            case 'family': return 'users';
            case 'group (polytypic)': return 'layers';
            case 'group (monotypic)': return 'square';
            case 'all': return 'grid';
            default: return 'tag';
        }
    };

    const getPhaseText = (phase: string): string => {
        switch (phase) {
            case 'parsing': return t('birddex.init.parsing');
            case 'inserting': return t('birddex.init.inserting');
            case 'indexing': return t('birddex.init.indexing');
            case 'complete': return t('birddex.init.complete');
            default: return phase;
        }
    };

    // Load page data
    const loadPage = useCallback(async (target: number) => {
        if (!dbInitialized) return;

        setRefresh(true);
        try {
            const searchTerm = searchText.trim();
            const raw = queryBirdDexPage(searchTerm, sortKey, asc, PAGE_SIZE, target, categoryFilter);

            // Updated language column mapping to match CSV structure
            const lang = i18n.language.split('-')[0];
            const colMap: Record<string, keyof BirdDexRecord> = {
                en: 'english_name',
                de: 'de_name',        // Changed from 'german_name'
                es: 'es_name',        // Changed from 'spanish_name'
                uk: 'ukrainian_name', // Unchanged
                ar: 'ar_name',        // Changed from 'arabic_name'
            };

            const langCol = colMap[lang] || 'english_name';

            const rows: DisplayRecord[] = raw.map(r => {
                // Safely convert to string and handle potential null/undefined values
                let displayName = String(r[langCol] || '').trim();

                if (!displayName) {
                    displayName = String(r.english_name || '').trim();
                }

                if (!displayName) {
                    displayName = String(r.scientific_name || '').trim();
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
        }
    }, [searchText, sortKey, asc, categoryFilter, i18n.language, dbInitialized, t]);

    // Load categories when database is ready
    useEffect(() => {
        if (dbInitialized) {
            try {
                const categories = getAvailableCategories();
                setAvailableCategories(categories);
                loadPage(1);
            } catch (e) {
                console.error('Failed to load categories:', e);
            }
        }
    }, [dbInitialized, loadPage]);

    // Reload on search/sort/category change
    useEffect(() => {
        if (dbInitialized) {
            const timeoutId = setTimeout(() => loadPage(1), 300);
            return () => clearTimeout(timeoutId);
        }
    }, [searchText, sortKey, asc, categoryFilter, dbInitialized, loadPage]);

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

    // Enhanced render method for flying birds with better cleanup
    const renderFlyingBirds = () => (
        flyingBirds.map(bird => {
            // Don't render if already cleaned up
            if (bird.isCleanedUp) return null;

            return (
                <Animated.View
                    key={bird.id}
                    style={[
                        styles.flyingBird,
                        {
                            transform: [
                                { translateX: bird.positionX },
                                { translateY: bird.positionY },
                                { rotate: `${bird.angle}deg` }
                            ],
                            opacity: bird.opacity
                        }
                    ]}
                >
                    <Text style={[styles.birdName, { color: bird.color, fontSize: bird.fontSize }]}>
                        {bird.name}
                    </Text>
                    <Text style={[styles.birdLanguage, { color: bird.color }]}>
                        ({bird.language})
                    </Text>
                </Animated.View>
            );
        })
    );

    // Enhanced database initialization screen with controlled animations
    if (!dbInitialized) {
        const percentComplete = Math.round((initProgress.loaded / initProgress.total) * 100);

        return (
            <SafeAreaView style={[styles.initContainer, { backgroundColor: pal.colors.background }]}>
                {/* Controlled flying bird names animation */}
                {renderFlyingBirds()}

                <BirdAnimation numberOfBirds={5} />

                <View style={styles.initContent}>
                    <ActivityIndicator size="large" color={pal.colors.primary} style={styles.loadingSpinner} />

                    <Text style={[styles.initTitle, { color: pal.colors.text.primary }]}>
                        {t('birddex.initializingDb')}
                    </Text>

                    <Text style={[styles.initSubtitle, { color: pal.colors.text.secondary }]}>
                        {t('birddex.preparingBirdData')}
                    </Text>

                    {initError ? (
                        <View style={styles.errorContainer}>
                            <Feather name="alert-circle" size={48} color={pal.colors.error} />
                            <Text style={[styles.errorText, { color: pal.colors.error }]}>
                                {t('birddex.error')}: {initError}
                            </Text>
                            {/* Add retry button */}
                            <Pressable
                                style={[styles.retryButton, { backgroundColor: pal.colors.primary }]}
                                onPress={() => {
                                    setInitError(null);
                                    setDbInitialized(false);
                                    cleanupAllAnimations();
                                    // Reset initialization state if needed
                                }}
                                android_ripple={null}
                            >
                                <Text style={[styles.retryButtonText, { color: pal.colors.text.onPrimary }]}>
                                    {t('birddex.retry')}
                                </Text>
                            </Pressable>
                        </View>
                    ) : (
                        <View style={styles.progressSection}>
                            <View style={[styles.phaseContainer, { backgroundColor: pal.colors.surface }]}>
                                <Text style={[styles.phaseText, { color: pal.colors.text.primary }]}>
                                    {getPhaseText(initProgress.phase)}
                                </Text>
                                {initProgress.message && (
                                    <Text style={[styles.messageText, { color: pal.colors.text.secondary }]}>
                                        {initProgress.message}
                                    </Text>
                                )}
                            </View>

                            <View style={styles.progressContainer}>
                                <Text style={[styles.progressText, { color: pal.colors.text.primary }]}>
                                    {percentComplete}% {t('birddex.complete')}
                                </Text>

                                <View style={[styles.progressBarContainer, { backgroundColor: pal.colors.border }]}>
                                    <View
                                        style={[
                                            styles.progressBar,
                                            {
                                                backgroundColor: pal.colors.primary,
                                                width: `${percentComplete}%`
                                            }
                                        ]}
                                    />
                                </View>
                            </View>

                            {/* Enhanced table progress */}
                            {initProgress.tables && Object.entries(initProgress.tables).length > 0 && (
                                <View style={styles.tablesContainer}>
                                    <Text style={[styles.tablesTitle, { color: pal.colors.text.primary }]}>
                                        {t('birddex.tableProgress')}:
                                    </Text>
                                    {Object.entries(initProgress.tables).map(([tableName, tableProgress]) => {
                                        const tablePercent = Math.round((tableProgress.loaded / tableProgress.total) * 100);
                                        return (
                                            <View key={tableName} style={styles.tableProgressItem}>
                                                <Text style={[styles.tableName, { color: pal.colors.text.secondary }]}>
                                                    {tableName}: {tableProgress.loaded.toLocaleString()}/{tableProgress.total.toLocaleString()} {t('birddex.entries')}
                                                </Text>
                                                <View style={[styles.tableProgressBarContainer, { backgroundColor: pal.colors.border }]}>
                                                    <View
                                                        style={[
                                                            styles.tableProgressBar,
                                                            {
                                                                backgroundColor: pal.colors.accent,
                                                                width: `${tablePercent}%`
                                                            }
                                                        ]}
                                                    />
                                                </View>
                                            </View>
                                        );
                                    })}
                                </View>
                            )}

                            {/* Active flying birds counter */}
                            {flyingBirds.length > 0 && (
                                <View style={styles.animationStatus}>
                                    <Text style={[styles.animationStatusText, { color: pal.colors.text.tertiary }]}>
                                        🦅 {flyingBirds.length} {t('birddex.flyingBirds')}
                                    </Text>
                                </View>
                            )}
                        </View>
                    )}
                </View>
            </SafeAreaView>
        );
    }

    // Main BirdDex interface rendering functions
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

    // Main BirdDex interface
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

    // Database initialization styles
    initContainer: {
        flex: 1,
        position: 'relative',
        overflow: 'hidden',
    },
    initContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: theme.spacing.xl,
    },
    loadingSpinner: {
        marginBottom: theme.spacing.lg,
    },
    initTitle: {
        fontSize: 24,
        fontWeight: '700',
        marginBottom: theme.spacing.sm,
        textAlign: 'center',
    },
    initSubtitle: {
        fontSize: 16,
        marginBottom: theme.spacing.xl,
        textAlign: 'center',
    },
    errorContainer: {
        alignItems: 'center',
        marginTop: theme.spacing.lg,
        gap: theme.spacing.md,
    },
    errorText: {
        fontSize: 16,
        textAlign: 'center',
        paddingHorizontal: theme.spacing.lg,
    },
    progressSection: {
        width: '100%',
        gap: theme.spacing.lg,
    },
    phaseContainer: {
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: theme.spacing.md,
        borderRadius: theme.borderRadius.lg,
        alignItems: 'center',
    },
    phaseText: {
        fontSize: 18,
        fontWeight: '600',
        textAlign: 'center',
    },
    messageText: {
        fontSize: 14,
        textAlign: 'center',
        marginTop: theme.spacing.xs,
    },
    progressContainer: {
        gap: theme.spacing.sm,
    },
    progressText: {
        fontSize: 16,
        fontWeight: '500',
        textAlign: 'center',
    },
    progressBarContainer: {
        height: 8,
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        borderRadius: 4,
    },
    tablesContainer: {
        gap: theme.spacing.sm,
    },
    tablesTitle: {
        fontSize: 16,
        fontWeight: '600',
        textAlign: 'center',
    },
    tableProgressItem: {
        gap: theme.spacing.xs,
    },
    tableName: {
        fontSize: 14,
        textAlign: 'center',
    },
    tableProgressBarContainer: {
        height: 4,
        borderRadius: 2,
        overflow: 'hidden',
    },
    tableProgressBar: {
        height: '100%',
        borderRadius: 2,
    },

    // Flying birds animation styles
    flyingBird: {
        position: 'absolute',
        alignItems: 'center',
        zIndex: 10,
    },
    birdName: {
        fontWeight: '600',
        textShadowColor: 'rgba(0, 0, 0, 0.3)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
    },
    birdLanguage: {
        fontSize: 9,
        opacity: 0.7,
        fontWeight: '500',
    },

    // Main BirdDex interface styles
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
    // Error handling styles
    retryButton: {
        marginTop: theme.spacing.lg,
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: theme.spacing.md,
        borderRadius: theme.borderRadius.lg,
        alignItems: 'center',
    },
    retryButtonText: {
        fontSize: 16,
        fontWeight: '600',
    },

    // Animation status styles
    animationStatus: {
        alignItems: 'center',
        marginTop: theme.spacing.sm,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.xs,
        backgroundColor: 'rgba(0,0,0,0.05)',
        borderRadius: theme.borderRadius.md,
    },
    animationStatusText: {
        fontSize: 12,
        fontWeight: '500',
    },
});