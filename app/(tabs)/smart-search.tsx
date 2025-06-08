import React, {useCallback, useEffect, useRef, useState} from 'react';
import {ActivityIndicator, FlatList, StyleSheet, TextInput, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useRouter} from 'expo-router';
import {useIsFocused} from '@react-navigation/native';
import {ThemedIcon} from '@/components/ThemedIcon';
import * as Haptics from 'expo-haptics';
import {SafeViewManager} from '@/components/SafeViewManager';

import {ModernCard} from '@/components/ModernCard';
import {ThemedText} from '@/components/ThemedText';
import {ThemedPressable} from '@/components/ThemedPressable';
import {ThemedSafeAreaView} from '@/components/ThemedSafeAreaView';
import {ThemedView} from '@/components/ThemedView';
import {useColors, useTheme, useTypography} from '@/hooks/useThemeColor';
import { useUnifiedColors } from '@/hooks/useUnifiedColors';
import { useResponsiveDimensions } from '@/hooks/useResponsiveDimensions';
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
    const colors = useUnifiedColors();
    const typography = useTypography();
    const dimensions = useResponsiveDimensions();
    const { t } = useTranslation();
    
    const styles = createStyles(theme, dimensions);


    const getConfidenceColor = (confidence: number) => {
        if (confidence >= 80) return colors.status.success;
        if (confidence >= 60) return colors.interactive.primary;
        return colors.text.secondary;
    };

    const getConfidenceText = (confidence: number) => {
        if (confidence >= 90) return t('smartSearch.exactMatch');
        if (confidence >= 80) return t('smartSearch.veryClose');
        if (confidence >= 60) return t('smartSearch.closeMatch');
        return t('smartSearch.possibleMatch');
    };

    return (
        <ModernCard
            elevated={true}
            bordered={false}
            onPress={onPress}
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
                            backgroundColor: colors.background.secondary,
                            borderWidth: 1,
                            borderColor: colors.border.primary
                        }
                    ]}>
                        <ThemedText
                            variant="labelSmall"
                            style={[
                                styles.confidenceText, 
                                { color: colors.text.primary }
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
    const colors = useUnifiedColors();
    const typography = useTypography();
    const theme = useTheme();
    const dimensions = useResponsiveDimensions();
    const isFocused = useIsFocused();
    
    const styles = createStyles(theme, dimensions);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            mountedRef.current = false;
            
            // Clear search timeout
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, []);
    
    if (!isFocused) {
        return null;
    }

    const [searchQuery, setSearchQuery] = useState('');
    const [results, setResults] = useState<SmartSearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    
    // Memory leak prevention refs
    const mountedRef = useRef(true);
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
            if (mountedRef.current) {
                setResults([]);
                setHasSearched(false);
            }
            return;
        }

        if (mountedRef.current) {
            setLoading(true);
            setHasSearched(true);
        }

        try {
            // Get broader results from database
            const dbResults = searchBirdsByName(query, 50);

            // Check if still mounted before processing
            if (!mountedRef.current) return;

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

            // Check if still mounted before sorting and setting results
            if (!mountedRef.current) return;

            // Sort by confidence score
            scoredResults.sort((a, b) => b.confidence - a.confidence);

            // Take top 20 results
            setResults(scoredResults.slice(0, 20));

        } catch (error) {
            console.error('Smart search error:', error);
            if (mountedRef.current) {
                setResults([]);
            }
        } finally {
            if (mountedRef.current) {
                setLoading(false);
            }
        }
    }, [calculateMatchScore, t]);

    // Enhanced search with memory leak prevention
    useEffect(() => {
        // Clear previous timeout
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }
        
        const timeoutId = setTimeout(() => {
            // Only perform search if component is still mounted
            if (mountedRef.current) {
                performSmartSearch(searchQuery);
            }
        }, 300);
        
        searchTimeoutRef.current = timeoutId;

        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
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
        <SafeViewManager enabled={isFocused}>
            <ThemedSafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
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
            </View>

            {/* Search Input */}
            <View style={styles.searchSection}>
                <ModernCard elevated={true} bordered={false} style={styles.searchCard}>
                    <ThemedView style={styles.searchContainer}>
                        <ThemedIcon name="search" size={20} color="secondary" />
                        <TextInput
                            style={[
                                styles.searchInput, 
                                typography.body, 
                                { 
                                    color: colors.text.primary
                                }
                            ]}
                            placeholder={t('smartSearch.placeholder')}
                            placeholderTextColor={colors.text.secondary}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            returnKeyType="search"
                            autoCapitalize="none"
                            autoCorrect={false}
                            selectionColor={colors.interactive.primary}
                        />
                        {searchQuery.length > 0 && (
                            <ThemedPressable variant="ghost" size="sm" onPress={() => setSearchQuery('')}>
                                <ThemedIcon name="x" size={20} color="secondary" />
                            </ThemedPressable>
                        )}
                    </ThemedView>
                </ModernCard>
            </View>

            {/* Content */}
            {!hasSearched ? (
                // Search Tips
                <View style={styles.tipsContainer}>
                    <ModernCard elevated={false} bordered={true} style={styles.tipsCard}>
                        <ThemedView style={styles.tipsHeader}>
                            <ThemedView style={[
                                styles.tipsIconContainer, 
                                { backgroundColor: colors.background.secondary }
                            ]}>
                                <ThemedIcon name="help-circle" size={16} color="primary" />
                            </ThemedView>
                            <ThemedText variant="label" style={{ color: colors.text.primary }}>
                                Search Tips
                            </ThemedText>
                        </ThemedView>
                        
                        <ThemedView style={styles.tipsGrid}>
                            <ThemedView style={styles.tipItem}>
                                <ThemedIcon name="globe" size={16} color="primary" />
                                <ThemedText variant="bodySmall" style={{ color: colors.text.secondary }}>
                                    {t('smartSearch.tip1')}
                                </ThemedText>
                            </ThemedView>
                            <ThemedView style={styles.tipItem}>
                                <ThemedIcon name="search" size={16} color="primary" />
                                <ThemedText variant="bodySmall" style={{ color: colors.text.secondary }}>
                                    {t('smartSearch.tip2')}
                                </ThemedText>
                            </ThemedView>
                            <ThemedView style={styles.tipItem}>
                                <ThemedIcon name="zap" size={16} color="primary" />
                                <ThemedText variant="bodySmall" style={{ color: colors.text.secondary }}>
                                    {t('smartSearch.tip3')}
                                </ThemedText>
                            </ThemedView>
                        </ThemedView>
                    </ModernCard>
                </View>
            ) : loading ? (
                // Loading state
                <ThemedView style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.interactive.primary} />
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
                                { backgroundColor: colors.background.secondary }
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
        </SafeViewManager>
    );
}

/**
 * Creates responsive styles for smart search components
 * 
 * @param {Object} theme - Theme object with spacing and typography
 * @param {Object} dimensions - Responsive dimensions object
 * @returns {Object} StyleSheet with responsive styles
 */
function createStyles(theme: any, dimensions: ReturnType<typeof useResponsiveDimensions>) {
    return StyleSheet.create({
        container: {
            flex: 1,
        },

        // Header
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: dimensions.layout.screenPadding.horizontal,
            paddingBottom: dimensions.layout.sectionSpacing,
            gap: dimensions.layout.componentSpacing,
        },
        backButton: {
            alignSelf: 'flex-start',
        },
        headerText: {
            flex: 1,
            gap: dimensions.layout.componentSpacing / 4,
        },
        headerTitle: {
            fontWeight: 'bold',
        },

        // Search
        searchSection: {
            paddingHorizontal: dimensions.layout.screenPadding.horizontal,
            marginBottom: dimensions.layout.sectionSpacing,
        },
        searchCard: {
            padding: 0,
        },
        searchContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: dimensions.layout.componentSpacing,
            height: dimensions.input.md.height,
            gap: dimensions.layout.componentSpacing,
        },
        searchInput: {
            flex: 1,
        },

        // Tips
        tipsContainer: {
            paddingHorizontal: dimensions.layout.screenPadding.horizontal,
            paddingBottom: dimensions.layout.componentSpacing,
        },
        tipsCard: {
            padding: dimensions.card.padding.md,
            gap: dimensions.layout.componentSpacing,
        },
        tipsHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: dimensions.layout.componentSpacing / 2,
        },
        tipsIconContainer: {
            width: dimensions.icon.lg,
            height: dimensions.icon.lg,
            borderRadius: dimensions.card.borderRadius.sm,
            justifyContent: 'center',
            alignItems: 'center',
        },
        tipsGrid: {
            gap: dimensions.layout.componentSpacing / 2,
        },
        tipItem: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: dimensions.layout.componentSpacing / 2,
        },

        // Loading
        loadingContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            gap: dimensions.layout.componentSpacing,
        },
        loadingText: {
            textAlign: 'center',
        },

        // Results
        resultsContainer: {
            paddingHorizontal: dimensions.layout.screenPadding.horizontal,
            paddingBottom: dimensions.layout.sectionSpacing,
            gap: dimensions.layout.componentSpacing,
        },
        resultCard: {
            position: 'relative',
        },
        resultHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: dimensions.layout.componentSpacing,
        },
        matchInfo: {
            flex: 1,
            marginRight: dimensions.layout.componentSpacing,
            gap: dimensions.layout.componentSpacing / 4,
        },
        matchedName: {
            fontWeight: '700',
            fontSize: Math.max(18 * dimensions.multipliers.font, 16),
        },
        confidenceBadge: {
            paddingHorizontal: dimensions.layout.componentSpacing,
            paddingVertical: dimensions.layout.componentSpacing / 4,
            borderRadius: dimensions.card.borderRadius.lg,
            minWidth: dimensions.screen.isTablet ? 80 : dimensions.screen.isSmall ? 40 : 60,
            alignItems: 'center',
        },
        confidenceText: {
            fontWeight: '700',
            textTransform: 'uppercase',
            fontSize: Math.max(11 * dimensions.multipliers.font, 10),
        },
        allNames: {
            gap: dimensions.layout.componentSpacing / 2,
            marginBottom: dimensions.layout.componentSpacing / 2,
        },
        nameRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: dimensions.layout.componentSpacing / 2,
        },
        nameLabel: {
            minWidth: dimensions.icon.md,
        },
        scientific: {
            fontStyle: 'italic',
            flex: 1,
        },
        chevronContainer: {
            position: 'absolute',
            right: dimensions.layout.screenPadding.horizontal,
            top: '50%',
            marginTop: -10,
        },

        // Empty state
        emptyContainer: {
            alignItems: 'center',
            paddingVertical: dimensions.layout.sectionSpacing * 2,
            gap: dimensions.layout.sectionSpacing,
        },
        emptyIcon: {
            width: dimensions.icon.xxl * 1.5,
            height: dimensions.icon.xxl * 1.5,
            borderRadius: dimensions.card.borderRadius.xl,
            justifyContent: 'center',
            alignItems: 'center',
        },
        emptyText: {
            textAlign: 'center',
            fontWeight: '500',
        },
        emptySubtext: {
            textAlign: 'center',
            lineHeight: dimensions.screen.isSmall ? 18 : 20,
        },
    });
}