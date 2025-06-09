import React, {useCallback, useEffect, useState} from 'react';
import {ActivityIndicator, FlatList, StyleSheet, TextInput} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useRouter} from 'expo-router';
import {ThemedIcon} from '@/components/ThemedIcon';
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
import {ThemedSafeAreaView} from '@/components/ThemedSafeAreaView';
import {ThemedView} from '@/components/ThemedView';
import {useColors, useTheme, useTypography} from '@/hooks/useThemeColor';
import {type BirdDexRecord, searchBirdsByName} from '@/services/databaseBirDex';

/**
 * Extended bird record type with search match information
 */
type SmartSearchResult = BirdDexRecord & {
    matchedField: string;
    matchedValue: string;
    confidence: number;
};

/**
 * Enhanced search result card component with animations and confidence indicators
 * Displays bird information with match confidence and multi-language support
 * 
 * @param {Object} props - Component props
 * @param {SmartSearchResult} props.item - Search result with match information
 * @param {number} props.index - Index for staggered animations
 * @param {Function} props.onPress - Callback when card is pressed
 * @returns {JSX.Element} Animated search result card
 */
function SearchResultCard({
                              item,
                              index,
                              onPress
                          }: {
    item: SmartSearchResult;
    index: number;
    onPress: () => void;
}) {
    const theme = useTheme();
    const colors = useColors();
    const typography = useTypography();
    const { t } = useTranslation();
    
    const styles = createStyles(theme);

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
        if (confidence >= 80) return colors.success;
        if (confidence >= 60) return colors.primary;
        return colors.textSecondary;
    };

    const getConfidenceText = (confidence: number) => {
        if (confidence >= 90) return t('smartSearch.exactMatch');
        if (confidence >= 80) return t('smartSearch.veryClose');
        if (confidence >= 60) return t('smartSearch.closeMatch');
        return t('smartSearch.possibleMatch');
    };

    return (
        <Animated.View
            entering={FadeInDown.delay(index * 100).springify()}
            exiting={FadeOutUp.springify()}
            layout={Layout.springify()}
        >
            <Animated.View style={animatedStyle}>
                <ModernCard
                    elevated={true}
                    bordered={false}
                    onPress={onPress}
                    // Remove these lines:
                    // onPressIn={handlePressIn}
                    // onPressOut={handlePressOut}
                    // animateOnPress={false}
                    style={styles.resultCard}
                >
                {/* Header with matched name and confidence */}
                <ThemedView style={styles.resultHeader}>
                    <ThemedView style={styles.matchInfo}>
                        <ThemedText
                            variant="h3"
                            style={[
                                styles.matchedName, 
                                { color: getConfidenceColor(item.confidence) }
                            ]}
                            numberOfLines={1}
                        >
                            {item.matchedValue}
                        </ThemedText>
                        <ThemedText variant="bodySmall" color="secondary">
                            {item.matchedField} • {getConfidenceText(item.confidence)}
                        </ThemedText>
                    </ThemedView>

                    <ThemedView style={[
                        styles.confidenceBadge,
                        { 
                            backgroundColor: colors.backgroundSecondary,
                            borderWidth: 1,
                            borderColor: colors.border
                        }
                    ]}>
                        <ThemedText
                            variant="labelSmall"
                            style={[
                                styles.confidenceText, 
                                { color: colors.text }
                            ]}
                        >
                            {Math.round(item.confidence)}%
                        </ThemedText>
                    </ThemedView>
                </ThemedView>

                {/* All available names */}
                <ThemedView style={styles.allNames}>
                    {item.english_name && (
                        <ThemedView style={styles.nameRow}>
                            <ThemedText variant="labelSmall" style={styles.nameLabel}>🇬🇧</ThemedText>
                            <ThemedText variant="body" numberOfLines={1}>
                                {item.english_name}
                            </ThemedText>
                        </ThemedView>
                    )}
                    {item.scientific_name && (
                        <ThemedView style={styles.nameRow}>
                            <ThemedText variant="labelSmall" style={styles.nameLabel}>🔬</ThemedText>
                            <ThemedText
                                variant="body"
                                color="secondary"
                                style={styles.scientific}
                                numberOfLines={1}
                            >
                                {item.scientific_name}
                            </ThemedText>
                        </ThemedView>
                    )}
                    {item.de_name && (
                        <ThemedView style={styles.nameRow}>
                            <ThemedText variant="labelSmall" style={styles.nameLabel}>🇩🇪</ThemedText>
                            <ThemedText variant="bodySmall" color="secondary" numberOfLines={1}>
                                {item.de_name}
                            </ThemedText>
                        </ThemedView>
                    )}
                    {item.es_name && (
                        <ThemedView style={styles.nameRow}>
                            <ThemedText variant="labelSmall" style={styles.nameLabel}>🇪🇸</ThemedText>
                            <ThemedText variant="bodySmall" color="secondary" numberOfLines={1}>
                                {item.es_name}
                            </ThemedText>
                        </ThemedView>
                    )}
                    {item.ukrainian_name && (
                        <ThemedView style={styles.nameRow}>
                            <ThemedText variant="labelSmall" style={styles.nameLabel}>🇺🇦</ThemedText>
                            <ThemedText variant="bodySmall" color="secondary" numberOfLines={1}>
                                {item.ukrainian_name}
                            </ThemedText>
                        </ThemedView>
                    )}
                    {item.ar_name && (
                        <ThemedView style={styles.nameRow}>
                            <ThemedText variant="labelSmall" style={styles.nameLabel}>🇸🇦</ThemedText>
                            <ThemedText variant="bodySmall" color="secondary" numberOfLines={1}>
                                {item.ar_name}
                            </ThemedText>
                        </ThemedView>
                    )}
                </ThemedView>

                {/* Chevron indicator */}
                <ThemedView style={styles.chevronContainer}>
                    <ThemedIcon name="chevron-right" size={20} color="secondary" />
                </ThemedView>
            </ModernCard>
            </Animated.View>
        </Animated.View>
    );
}

/**
 * Smart Search Component with fuzzy matching and multi-language support
 * Provides intelligent bird search across all language fields with confidence scoring
 * 
 * @returns {JSX.Element} Complete smart search interface with results
 */
export default function SmartSearch() {
    const { t } = useTranslation();
    const router = useRouter();
    const colors = useColors();
    const typography = useTypography();
    const theme = useTheme();
    
    const styles = createStyles(theme);

    const [searchQuery, setSearchQuery] = useState('');
    const [results, setResults] = useState<SmartSearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);

    /**
     * Calculates fuzzy matching score between query and target strings
     * Uses multiple matching strategies for optimal search results
     * 
     * @param {string} query - Search query from user
     * @param {string} target - Target string to match against
     * @returns {number} Confidence score from 0-100
     */
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

    /**
     * Simple Levenshtein distance implementation for typo tolerance
     * Calculates edit distance between two strings
     * 
     * @param {string} str1 - First string
     * @param {string} str2 - Second string
     * @returns {number} Edit distance between strings
     */
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

    /**
     * Performs intelligent search across all bird name fields
     * Scores results by confidence and returns best matches
     * 
     * @param {string} query - Search query to execute
     */
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

    const handleBackPress = useCallback(() => {
        router.back();
    }, [router]);

    const renderSearchResult = useCallback(({ item, index }: { item: SmartSearchResult, index: number }) => (
        <SearchResultCard
            item={item}
            index={index}
            onPress={() => handleResultPress(item)}
        />
    ), [handleResultPress]);

    return (
        <ThemedSafeAreaView style={styles.container}>
            {/* Header */}
            <Animated.View
                entering={FadeInDown.delay(50).springify()}
                style={styles.header}
            >
                <ThemedPressable
                    variant="ghost"
                    size="sm"
                    onPress={handleBackPress}
                    style={styles.backButton}
                >
                    <ThemedIcon name="arrow-left" size={24} color="primary" />
                </ThemedPressable>

                <ThemedView style={styles.headerText}>
                    <ThemedText variant="h2" style={styles.headerTitle}>
                        {t('smartSearch.title')}
                    </ThemedText>
                    <ThemedText variant="bodySmall" color="secondary">
                        {t('smartSearch.subtitle')}
                    </ThemedText>
                </ThemedView>
            </Animated.View>

            {/* Search Input */}
            <Animated.View
                entering={FadeInDown.delay(150).springify()}
                style={styles.searchSection}
            >
                <ModernCard elevated={true} bordered={false} style={styles.searchCard}>
                    <ThemedView style={styles.searchContainer}>
                        <ThemedIcon name="search" size={20} color="secondary" />
                        <TextInput
                            style={[
                                styles.searchInput, 
                                typography.body, 
                                { 
                                    color: colors.text
                                }
                            ]}
                            placeholder={t('smartSearch.placeholder')}
                            placeholderTextColor={colors.textSecondary}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            returnKeyType="search"
                            autoCapitalize="none"
                            autoCorrect={false}
                            selectionColor={colors.primary}
                        />
                        {searchQuery.length > 0 && (
                            <ThemedPressable variant="ghost" size="sm" onPress={() => setSearchQuery('')}>
                                <ThemedIcon name="x" size={20} color="secondary" />
                            </ThemedPressable>
                        )}
                    </ThemedView>
                </ModernCard>
            </Animated.View>

            {/* Content */}
            {!hasSearched ? (
                // Search Tips
                <Animated.View
                    entering={FadeInDown.delay(250).springify()}
                    style={styles.tipsContainer}
                >
                    <ModernCard elevated={false} bordered={true} style={styles.tipsCard}>
                        <ThemedView style={styles.tipsHeader}>
                            <ThemedView style={[
                                styles.tipsIconContainer, 
                                { backgroundColor: colors.backgroundSecondary }
                            ]}>
                                <ThemedIcon name="help-circle" size={16} color="primary" />
                            </ThemedView>
                            <ThemedText variant="label" style={{ color: colors.text }}>
                                Search Tips
                            </ThemedText>
                        </ThemedView>
                        
                        <ThemedView style={styles.tipsGrid}>
                            <ThemedView style={styles.tipItem}>
                                <ThemedIcon name="globe" size={16} color="primary" />
                                <ThemedText variant="bodySmall" style={{ color: colors.textSecondary }}>
                                    {t('smartSearch.tip1')}
                                </ThemedText>
                            </ThemedView>
                            <ThemedView style={styles.tipItem}>
                                <ThemedIcon name="search" size={16} color="primary" />
                                <ThemedText variant="bodySmall" style={{ color: colors.textSecondary }}>
                                    {t('smartSearch.tip2')}
                                </ThemedText>
                            </ThemedView>
                            <ThemedView style={styles.tipItem}>
                                <ThemedIcon name="zap" size={16} color="primary" />
                                <ThemedText variant="bodySmall" style={{ color: colors.textSecondary }}>
                                    {t('smartSearch.tip3')}
                                </ThemedText>
                            </ThemedView>
                        </ThemedView>
                    </ModernCard>
                </Animated.View>
            ) : loading ? (
                // Loading state
                <ThemedView style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <ThemedText variant="bodySmall" color="secondary" style={styles.loadingText}>
                        {t('smartSearch.searching')}
                    </ThemedText>
                </ThemedView>
            ) : (
                // Results
                <FlatList
                    data={results}
                    keyExtractor={item => item.species_code}
                    renderItem={renderSearchResult}
                    contentContainerStyle={styles.resultsContainer}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <ThemedView style={styles.emptyContainer}>
                            <ThemedView style={[
                                styles.emptyIcon, 
                                { backgroundColor: colors.backgroundSecondary }
                            ]}>
                                <ThemedIcon name="search" size={40} color="secondary" />
                            </ThemedView>
                            <ThemedText variant="h3" color="secondary" style={styles.emptyText}>
                                {t('smartSearch.noResults')}
                            </ThemedText>
                            <ThemedText variant="bodySmall" color="secondary" style={styles.emptySubtext}>
                                {t('smartSearch.tryDifferent')}
                            </ThemedText>
                        </ThemedView>
                    }
                />
            )}
        </ThemedSafeAreaView>
    );
}

/**
 * Creates styles for smart search components
 * 
 * @param {Object} theme - Theme object with spacing and typography
 * @returns {Object} StyleSheet with styles
 */
function createStyles(theme: any) {
    return StyleSheet.create({
        container: {
            flex: 1,
        },

        // Header
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 20,
            paddingBottom: 32,
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
            marginBottom: 32,
        },
        searchCard: {
            padding: 0,
        },
        searchContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            height: 48,
            gap: 16,
        },
        searchInput: {
            flex: 1,
        },

        // Tips
        tipsContainer: {
            paddingHorizontal: 20,
            paddingBottom: 16,
        },
        tipsCard: {
            padding: 16,
            gap: 16,
        },
        tipsHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        tipsIconContainer: {
            width: 24,
            height: 24,
            borderRadius: 6,
            justifyContent: 'center',
            alignItems: 'center',
        },
        tipsGrid: {
            gap: 8,
        },
        tipItem: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
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
            paddingBottom: 32,
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
            marginRight: 16,
            gap: 4,
        },
        matchedName: {
            fontWeight: '700',
            fontSize: 18,
        },
        confidenceBadge: {
            paddingHorizontal: 16,
            paddingVertical: 4,
            borderRadius: 12,
            minWidth: 50,
            alignItems: 'center',
        },
        confidenceText: {
            fontWeight: '700',
            textTransform: 'uppercase',
            fontSize: 11,
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
            paddingVertical: 64,
            gap: 32,
        },
        emptyIcon: {
            width: 72,
            height: 72,
            borderRadius: 24,
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
}