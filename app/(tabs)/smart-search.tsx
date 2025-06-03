import React, {useCallback, useEffect, useState} from 'react';
import {ActivityIndicator, FlatList, Pressable, SafeAreaView, StyleSheet, TextInput, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useRouter} from 'expo-router';
import {Feather} from '@expo/vector-icons';
import {BlurView} from 'expo-blur';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Animated, {
    FadeInDown,
    FadeOutUp,
    Layout,
    useAnimatedStyle,
    useSharedValue,
    withSpring
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import {ModernCard} from '@/components/ModernCard';
import {ThemedText} from '@/components/ThemedText';
import {ThemedPressable} from '@/components/ThemedPressable';
import {useColorVariants, useMotionValues, useSemanticColors, useTheme, useTypography} from '@/hooks/useThemeColor';
import {type BirdDexRecord, searchBirdsByName} from '@/services/databaseBirDex';

type SmartSearchResult = BirdDexRecord & {
    matchedField: string;
    matchedValue: string;
    confidence: number;
};

// Enhanced search result card component
function SearchResultCard({
                              item,
                              index,
                              onPress
                          }: {
    item: SmartSearchResult;
    index: number;
    onPress: () => void;
}) {
    const semanticColors = useSemanticColors();
    const variants = useColorVariants();
    const typography = useTypography();
    const { t } = useTranslation();

    const scale = useSharedValue(1);

    const handlePressIn = () => {
        scale.value = withSpring(0.98, { damping: 15, stiffness: 300 });
    };

    const handlePressOut = () => {
        scale.value = withSpring(1, { damping: 15, stiffness: 300 });
    };

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const getConfidenceColor = (confidence: number) => {
        if (confidence >= 80) return semanticColors.success;
        if (confidence >= 60) return semanticColors.primary;
        return semanticColors.textSecondary;
    };

    const getConfidenceText = (confidence: number) => {
        if (confidence >= 90) return t('smartSearch.exactMatch');
        if (confidence >= 80) return t('smartSearch.veryClose');
        if (confidence >= 60) return t('smartSearch.closeMatch');
        return t('smartSearch.possibleMatch');
    };

    return (
        <Animated.View
            entering={FadeInDown.delay(index * 50).springify()}
            exiting={FadeOutUp.springify()}
            layout={Layout.springify()}
            style={animatedStyle}
        >
            <ModernCard
                variant="elevated"
                onPress={onPress}
                // Remove these lines:
                // onPressIn={handlePressIn}
                // onPressOut={handlePressOut}
                // animateOnPress={false}
                style={styles.resultCard}
            >
                {/* Header with matched name and confidence */}
                <View style={styles.resultHeader}>
                    <View style={styles.matchInfo}>
                        <ThemedText
                            variant="headlineSmall"
                            style={[styles.matchedName, { color: getConfidenceColor(item.confidence) }]}
                            numberOfLines={1}
                        >
                            {item.matchedValue}
                        </ThemedText>
                        <ThemedText variant="labelMedium" color="secondary">
                            {item.matchedField} • {getConfidenceText(item.confidence)}
                        </ThemedText>
                    </View>

                    <View style={[
                        styles.confidenceBadge,
                        { backgroundColor: variants.primarySubtle }
                    ]}>
                        <ThemedText
                            variant="labelSmall"
                            style={[styles.confidenceText, { color: semanticColors.primary }]}
                        >
                            {Math.round(item.confidence)}%
                        </ThemedText>
                    </View>
                </View>

                {/* All available names */}
                <View style={styles.allNames}>
                    {item.english_name && (
                        <View style={styles.nameRow}>
                            <ThemedText variant="labelSmall" style={styles.nameLabel}>🇬🇧</ThemedText>
                            <ThemedText variant="bodyMedium" numberOfLines={1}>
                                {item.english_name}
                            </ThemedText>
                        </View>
                    )}
                    {item.scientific_name && (
                        <View style={styles.nameRow}>
                            <ThemedText variant="labelSmall" style={styles.nameLabel}>🔬</ThemedText>
                            <ThemedText
                                variant="bodyMedium"
                                color="secondary"
                                style={styles.scientific}
                                numberOfLines={1}
                            >
                                {item.scientific_name}
                            </ThemedText>
                        </View>
                    )}
                    {item.de_name && (
                        <View style={styles.nameRow}>
                            <ThemedText variant="labelSmall" style={styles.nameLabel}>🇩🇪</ThemedText>
                            <ThemedText variant="bodySmall" color="secondary" numberOfLines={1}>
                                {item.de_name}
                            </ThemedText>
                        </View>
                    )}
                    {item.es_name && (
                        <View style={styles.nameRow}>
                            <ThemedText variant="labelSmall" style={styles.nameLabel}>🇪🇸</ThemedText>
                            <ThemedText variant="bodySmall" color="secondary" numberOfLines={1}>
                                {item.es_name}
                            </ThemedText>
                        </View>
                    )}
                    {item.ukrainian_name && (
                        <View style={styles.nameRow}>
                            <ThemedText variant="labelSmall" style={styles.nameLabel}>🇺🇦</ThemedText>
                            <ThemedText variant="bodySmall" color="secondary" numberOfLines={1}>
                                {item.ukrainian_name}
                            </ThemedText>
                        </View>
                    )}
                    {item.ar_name && (
                        <View style={styles.nameRow}>
                            <ThemedText variant="labelSmall" style={styles.nameLabel}>🇸🇦</ThemedText>
                            <ThemedText variant="bodySmall" color="secondary" numberOfLines={1}>
                                {item.ar_name}
                            </ThemedText>
                        </View>
                    )}
                </View>

                {/* Chevron indicator */}
                <View style={styles.chevronContainer}>
                    <Feather name="chevron-right" size={20} color={semanticColors.textSecondary} />
                </View>
            </ModernCard>
        </Animated.View>
    );
}

export default function SmartSearch() {
    const { t } = useTranslation();
    const router = useRouter();
    const semanticColors = useSemanticColors();
    const variants = useColorVariants();
    const typography = useTypography();
    const theme = useTheme();
    const motion = useMotionValues();
    const insets = useSafeAreaInsets();

    const [searchQuery, setSearchQuery] = useState('');
    const [results, setResults] = useState<SmartSearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);

    // Fuzzy matching function
    const calculateMatchScore = useCallback((query: string, target: string): number => {
        if (!target) return 0;

        const queryLower = query.toLowerCase().trim();
        const targetLower = target.toLowerCase().trim();

        // Exact match
        if (queryLower === targetLower) return 100;

        // Starts with query
        if (targetLower.startsWith(queryLower)) return 90;

        // Contains query
        if (targetLower.includes(queryLower)) return 80;

        // Word boundary matches
        const queryWords = queryLower.split(' ');
        const targetWords = targetLower.split(' ');

        let wordMatches = 0;
        let partialMatches = 0;

        for (const queryWord of queryWords) {
            for (const targetWord of targetWords) {
                if (targetWord === queryWord) {
                    wordMatches++;
                } else if (targetWord.includes(queryWord) || queryWord.includes(targetWord)) {
                    partialMatches++;
                }
            }
        }

        if (wordMatches > 0) return 70 + (wordMatches * 10);
        if (partialMatches > 0) return 50 + (partialMatches * 5);

        // Levenshtein distance for typos
        const distance = levenshteinDistance(queryLower, targetLower);
        const maxLength = Math.max(queryLower.length, targetLower.length);
        const similarity = (maxLength - distance) / maxLength;

        return Math.max(0, similarity * 60);
    }, []);

    // Simple Levenshtein distance implementation
    const levenshteinDistance = (str1: string, str2: string): number => {
        const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

        for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
        for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

        for (let j = 1; j <= str2.length; j++) {
            for (let i = 1; i <= str1.length; i++) {
                const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
                matrix[j][i] = Math.min(
                    matrix[j][i - 1] + 1,     // deletion
                    matrix[j - 1][i] + 1,     // insertion
                    matrix[j - 1][i - 1] + indicator // substitution
                );
            }
        }

        return matrix[str2.length][str1.length];
    };

    const performSmartSearch = useCallback(async (query: string) => {
        if (!query.trim() || query.length < 2) {
            setResults([]);
            setHasSearched(false);
            return;
        }

        setLoading(true);
        setHasSearched(true);

        try {
            // Get broader results from database
            const dbResults = searchBirdsByName(query, 50);

            // Score each result across all name fields
            const scoredResults: SmartSearchResult[] = [];

            dbResults.forEach(bird => {
                const nameFields = [
                    { field: 'english_name', value: bird.english_name, label: t('smartSearch.english') },
                    { field: 'scientific_name', value: bird.scientific_name, label: t('smartSearch.scientific') },
                    { field: 'de_name', value: bird.de_name, label: t('smartSearch.german') },
                    { field: 'es_name', value: bird.es_name, label: t('smartSearch.spanish') },
                    { field: 'ukrainian_name', value: bird.ukrainian_name, label: t('smartSearch.ukrainian') },
                    { field: 'ar_name', value: bird.ar_name, label: t('smartSearch.arabic') }
                ];

                let bestMatch = { score: 0, field: '', value: '', label: '' };

                nameFields.forEach(({ field, value, label }) => {
                    if (value) {
                        const score = calculateMatchScore(query, value);
                        if (score > bestMatch.score) {
                            bestMatch = { score, field, value, label };
                        }
                    }
                });

                if (bestMatch.score > 30) { // Minimum threshold
                    scoredResults.push({
                        ...bird,
                        matchedField: bestMatch.label,
                        matchedValue: bestMatch.value,
                        confidence: bestMatch.score
                    });
                }
            });

            // Sort by confidence score
            scoredResults.sort((a, b) => b.confidence - a.confidence);

            // Take top 20 results
            setResults(scoredResults.slice(0, 20));

        } catch (error) {
            console.error('Smart search error:', error);
            setResults([]);
        } finally {
            setLoading(false);
        }
    }, [calculateMatchScore, t]);

    // Debounced search
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            performSmartSearch(searchQuery);
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [searchQuery, performSmartSearch]);

    const handleResultPress = useCallback((item: SmartSearchResult) => {
        Haptics.selectionAsync();
        router.push(`/birdex/details/${item.species_code}`);
    }, [router]);

    const renderSearchResult = useCallback(({ item, index }: { item: SmartSearchResult, index: number }) => (
        <SearchResultCard
            item={item}
            index={index}
            onPress={() => handleResultPress(item)}
        />
    ), [handleResultPress]);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: semanticColors.background }]}>
            {/* Header */}
            <Animated.View
                entering={FadeInDown.springify()}
                style={[styles.header, { marginTop: insets.top }]}
            >
                <ThemedPressable
                    variant="ghost"
                    size="small"
                    onPress={() => router.back()}
                    style={styles.backButton}
                >
                    <Feather name="arrow-left" size={24} color={semanticColors.text} />
                </ThemedPressable>

                <View style={styles.headerText}>
                    <ThemedText variant="displaySmall" style={styles.headerTitle}>
                        {t('smartSearch.title')}
                    </ThemedText>
                    <ThemedText variant="bodyMedium" color="secondary">
                        {t('smartSearch.subtitle')}
                    </ThemedText>
                </View>
            </Animated.View>

            {/* Search Input */}
            <Animated.View
                entering={FadeInDown.delay(100).springify()}
                style={styles.searchSection}
            >
                <BlurView
                    intensity={60}
                    tint={semanticColors.background === '#FFFFFF' ? 'light' : 'dark'}
                    style={[styles.searchContainer, { borderColor: variants.primaryMuted }]}
                >
                    <Feather name="search" size={20} color={semanticColors.textSecondary} />
                    <TextInput
                        style={[styles.searchInput, typography.bodyLarge, { color: semanticColors.text }]}
                        placeholder={t('smartSearch.placeholder')}
                        placeholderTextColor={semanticColors.textSecondary}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        returnKeyType="search"
                        autoCapitalize="none"
                        autoCorrect={false}
                    />
                    {searchQuery.length > 0 && (
                        <Pressable onPress={() => setSearchQuery('')}>
                            <Feather name="x" size={20} color={semanticColors.textSecondary} />
                        </Pressable>
                    )}
                </BlurView>
            </Animated.View>

            {/* Content */}
            {!hasSearched ? (
                // Search Tips
                <Animated.View
                    entering={FadeInDown.delay(200).springify()}
                    style={styles.tipsContainer}
                >
                    <ModernCard variant="glass" style={styles.tipsCard}>
                        <View style={[styles.tipsIcon, { backgroundColor: variants.primarySubtle }]}>
                            <Feather name="help-circle" size={24} color={semanticColors.primary} />
                        </View>

                        <ThemedText variant="headlineSmall" style={styles.tipsTitle}>
                            {t('smartSearch.tipsTitle')}
                        </ThemedText>

                        <View style={styles.tipsList}>
                            <View style={styles.tipItem}>
                                <Feather name="check" size={16} color={semanticColors.success} />
                                <ThemedText variant="bodyMedium" color="secondary" style={styles.tipText}>
                                    {t('smartSearch.tip1')}
                                </ThemedText>
                            </View>
                            <View style={styles.tipItem}>
                                <Feather name="check" size={16} color={semanticColors.success} />
                                <ThemedText variant="bodyMedium" color="secondary" style={styles.tipText}>
                                    {t('smartSearch.tip2')}
                                </ThemedText>
                            </View>
                            <View style={styles.tipItem}>
                                <Feather name="check" size={16} color={semanticColors.success} />
                                <ThemedText variant="bodyMedium" color="secondary" style={styles.tipText}>
                                    {t('smartSearch.tip3')}
                                </ThemedText>
                            </View>
                        </View>
                    </ModernCard>
                </Animated.View>
            ) : loading ? (
                // Loading state
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={semanticColors.primary} />
                    <ThemedText variant="bodyMedium" color="secondary" style={styles.loadingText}>
                        {t('smartSearch.searching')}
                    </ThemedText>
                </View>
            ) : (
                // Results
                <FlatList
                    data={results}
                    keyExtractor={item => item.species_code}
                    renderItem={renderSearchResult}
                    contentContainerStyle={styles.resultsContainer}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <View style={[styles.emptyIcon, { backgroundColor: variants.surfaceHover }]}>
                                <Feather name="search" size={48} color={semanticColors.textSecondary} />
                            </View>
                            <ThemedText variant="headlineSmall" color="secondary" style={styles.emptyText}>
                                {t('smartSearch.noResults')}
                            </ThemedText>
                            <ThemedText variant="bodyMedium" color="tertiary" style={styles.emptySubtext}>
                                {t('smartSearch.tryDifferent')}
                            </ThemedText>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 20,
        gap: 16,
    },
    backButton: {
        alignSelf: 'flex-start',
    },
    headerText: {
        flex: 1,
        gap: 4,
    },
    headerTitle: {
        fontWeight: 'bold',
    },

    // Search
    searchSection: {
        paddingHorizontal: 20,
        marginBottom: 24,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        height: 56,
        borderWidth: 1,
        borderRadius: 28,
        gap: 12,
        overflow: 'hidden',
    },
    searchInput: {
        flex: 1,
    },

    // Tips
    tipsContainer: {
        paddingHorizontal: 20,
        paddingTop: 40, // Remove flex: 1 and justifyContent: 'center'
        paddingBottom: 20,
    },
    tipsCard: {
        padding: 32,
        alignItems: 'center',
        gap: 24,
        // Remove minHeight: 400
    },
    tipsIcon: {
        width: 80, // Increased from 64
        height: 80, // Increased from 64
        borderRadius: 40, // Adjusted for new size
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8, // Add some separation
    },
    tipsTitle: {
        textAlign: 'center',
        fontWeight: '600',
        marginBottom: 8, // Add separation from subtitle
    },
    tipsList: {
        alignSelf: 'stretch',
        gap: 24, // Increased from 16
        width: '100%', // Ensure full width
        marginTop: 8, // Add top margin
    },
    tipItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 16, // Increased from 12
        paddingVertical: 8, // Add vertical padding for touch targets
    },
    tipText: {
        flex: 1,
        lineHeight: 24, // Increased from 22
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

    // Results
    resultsContainer: {
        paddingHorizontal: 20,
        paddingBottom: 24,
        gap: 16,
    },
    resultCard: {
        position: 'relative',
    },
    resultHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    matchInfo: {
        flex: 1,
        marginRight: 12,
        gap: 4,
    },
    matchedName: {
        fontWeight: '600',
    },
    confidenceBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    confidenceText: {
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    allNames: {
        gap: 8,
        marginBottom: 8,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    nameLabel: {
        minWidth: 20,
    },
    scientific: {
        fontStyle: 'italic',
        flex: 1,
    },
    chevronContainer: {
        position: 'absolute',
        right: 20,
        top: '50%',
        marginTop: -10,
    },

    // Empty state
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: 60,
        gap: 24,
    },
    emptyIcon: {
        width: 96,
        height: 96,
        borderRadius: 48,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyText: {
        textAlign: 'center',
        fontWeight: '500',
    },
    emptySubtext: {
        textAlign: 'center',
        lineHeight: 20,
    },
});