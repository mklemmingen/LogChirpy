import React, {useCallback, useEffect, useState} from 'react';
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    useColorScheme,
    View
} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useRouter} from 'expo-router';
import {Feather} from '@expo/vector-icons';
import {BlurView} from 'expo-blur';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {theme} from '@/constants/theme';
import {type BirdDexRecord, searchBirdsByName} from '@/services/databaseBirDex';

type SmartSearchResult = BirdDexRecord & {
    matchedField: string;
    matchedValue: string;
    confidence: number;
};

export default function SmartSearch() {
    const { t } = useTranslation();
    const router = useRouter();
    const scheme = useColorScheme() ?? 'light';
    const pal = theme[scheme];
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

    // Simple Levenshtein distance implementation, thanks INF3!
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

    const getConfidenceColor = (confidence: number) => {
        if (confidence >= 80) return pal.colors.primary;
        if (confidence >= 60) return pal.colors.accent;
        return pal.colors.text.secondary;
    };

    const getConfidenceText = (confidence: number) => {
        if (confidence >= 90) return t('smartSearch.exactMatch');
        if (confidence >= 80) return t('smartSearch.veryClose');
        if (confidence >= 60) return t('smartSearch.closeMatch');
        return t('smartSearch.possibleMatch');
    };

    const renderSearchResult = useCallback(({ item }: { item: SmartSearchResult }) => (
        <BlurView
            intensity={60}
            tint={scheme === "dark" ? "dark" : "light"}
            style={[styles.resultCard, { borderColor: pal.colors.border }]}
        >
            <Pressable
                style={styles.resultContent}
                onPress={() => router.push(`/birdex/details/${item.species_code}`)}
                android_ripple={{ color: pal.colors.primary + '20' }}
            >
                <View style={styles.resultHeader}>
                    <View style={styles.matchInfo}>
                        <Text style={[styles.matchedName, { color: getConfidenceColor(item.confidence) }]}>
                            {item.matchedValue}
                        </Text>
                        <Text style={[styles.matchField, { color: pal.colors.text.secondary }]}>
                            {item.matchedField} • {getConfidenceText(item.confidence)}
                        </Text>
                    </View>
                    <View style={[styles.confidenceBadge, { backgroundColor: getConfidenceColor(item.confidence) }]}>
                        <Text style={[styles.confidenceText, { color: pal.colors.text.primary }]}>
                            {Math.round(item.confidence)}%
                        </Text>
                    </View>
                </View>

                <View style={styles.allNames}>
                    {item.english_name && (
                        <Text style={[styles.nameRow, { color: pal.colors.text.primary }]}>
                            <Text style={styles.nameLabel}>🇬🇧 </Text>{item.english_name}
                        </Text>
                    )}
                    {item.scientific_name && (
                        <Text style={[styles.nameRow, styles.scientific, { color: pal.colors.text.secondary }]}>
                            <Text style={styles.nameLabel}>🔬 </Text>{item.scientific_name}
                        </Text>
                    )}
                    {item.de_name && (
                        <Text style={[styles.nameRow, { color: pal.colors.text.secondary }]}>
                            <Text style={styles.nameLabel}>🇩🇪 </Text>{item.de_name}
                        </Text>
                    )}
                    {item.es_name && (
                        <Text style={[styles.nameRow, { color: pal.colors.text.secondary }]}>
                            <Text style={styles.nameLabel}>🇪🇸 </Text>{item.es_name}
                        </Text>
                    )}
                    {item.ukrainian_name && (
                        <Text style={[styles.nameRow, { color: pal.colors.text.secondary }]}>
                            <Text style={styles.nameLabel}>🇺🇦 </Text>{item.ukrainian_name}
                        </Text>
                    )}
                    {item.ar_name && (
                        <Text style={[styles.nameRow, { color: pal.colors.text.secondary }]}>
                            <Text style={styles.nameLabel}>🇸🇦 </Text>{item.ar_name}
                        </Text>
                    )}
                </View>

                <Feather name="chevron-right" size={20} color={pal.colors.text.secondary} style={styles.chevron} />
            </Pressable>
        </BlurView>
    ), [pal.colors, router, scheme, t, getConfidenceColor, getConfidenceText]);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: pal.colors.background }]}>
            {/* Header */}
            <View style={[styles.header, { marginTop: insets.top }]}>
                <Pressable
                    style={styles.backButton}
                    onPress={() => router.back()}
                >
                    <Feather name="arrow-left" size={24} color={pal.colors.text.primary} />
                </Pressable>
                <View style={styles.headerText}>
                    <Text style={[styles.headerTitle, { color: pal.colors.text.primary }]}>
                        {t('smartSearch.title')}
                    </Text>
                    <Text style={[styles.headerSubtitle, { color: pal.colors.text.secondary }]}>
                        {t('smartSearch.subtitle')}
                    </Text>
                </View>
            </View>

            {/* Search Input */}
            <View style={[styles.searchContainer, { borderColor: pal.colors.border }]}>
                <Feather name="search" size={20} color={pal.colors.text.secondary} />
                <TextInput
                    style={[styles.searchInput, { color: pal.colors.text.primary }]}
                    placeholder={t('smartSearch.placeholder')}
                    placeholderTextColor={pal.colors.text.secondary}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                    <Pressable onPress={() => setSearchQuery('')}>
                        <Feather name="x" size={20} color={pal.colors.text.secondary} />
                    </Pressable>
                )}
            </View>

            {/* Search Tips */}
            {!hasSearched && (
                <View style={styles.tipsContainer}>
                    <Text style={[styles.tipsTitle, { color: pal.colors.text.primary }]}>
                        {t('smartSearch.tipsTitle')}
                    </Text>
                    <Text style={[styles.tipText, { color: pal.colors.text.secondary }]}>
                        • {t('smartSearch.tip1')}
                    </Text>
                    <Text style={[styles.tipText, { color: pal.colors.text.secondary }]}>
                        • {t('smartSearch.tip2')}
                    </Text>
                    <Text style={[styles.tipText, { color: pal.colors.text.secondary }]}>
                        • {t('smartSearch.tip3')}
                    </Text>
                </View>
            )}

            {/* Results */}
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={pal.colors.primary} />
                    <Text style={[styles.loadingText, { color: pal.colors.text.secondary }]}>
                        {t('smartSearch.searching')}
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={results}
                    keyExtractor={item => item.species_code}
                    renderItem={renderSearchResult}
                    contentContainerStyle={styles.resultsContainer}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        hasSearched ? (
                            <View style={styles.emptyContainer}>
                                <Feather name="search" size={48} color={pal.colors.text.secondary} />
                                <Text style={[styles.emptyText, { color: pal.colors.text.secondary }]}>
                                    {t('smartSearch.noResults')}
                                </Text>
                                <Text style={[styles.emptySubtext, { color: pal.colors.text.secondary }]}>
                                    {t('smartSearch.tryDifferent')}
                                </Text>
                            </View>
                        ) : null
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
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
        gap: theme.spacing.md,
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerText: {
        flex: 1,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    headerSubtitle: {
        fontSize: 14,
        marginTop: 2,
    },

    // Search
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: theme.spacing.md,
        marginBottom: theme.spacing.md,
        paddingHorizontal: theme.spacing.md,
        height: 56,
        borderWidth: 2,
        borderRadius: theme.borderRadius.lg,
        gap: theme.spacing.sm,
    },
    searchInput: {
        flex: 1,
        fontSize: 18,
    },

    // Tips
    tipsContainer: {
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.lg,
    },
    tipsTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: theme.spacing.sm,
    },
    tipText: {
        fontSize: 14,
        marginBottom: 4,
        lineHeight: 20,
    },

    // Results
    resultsContainer: {
        padding: theme.spacing.md,
    },
    resultCard: {
        marginBottom: theme.spacing.md,
        borderRadius: theme.borderRadius.lg,
        borderWidth: 1,
        overflow: 'hidden',
    },
    resultContent: {
        padding: theme.spacing.md,
    },
    resultHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: theme.spacing.sm,
    },
    matchInfo: {
        flex: 1,
        marginRight: theme.spacing.sm,
    },
    matchedName: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 2,
    },
    matchField: {
        fontSize: 12,
        textTransform: 'uppercase',
    },
    confidenceBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: theme.borderRadius.sm,
    },
    confidenceText: {
        fontSize: 12,
        fontWeight: '600',
    },
    allNames: {
        gap: 4,
    },
    nameRow: {
        fontSize: 14,
        lineHeight: 20,
    },
    nameLabel: {
        fontSize: 12,
    },
    scientific: {
        fontStyle: 'italic',
    },
    chevron: {
        position: 'absolute',
        right: theme.spacing.md,
        top: '50%',
        marginTop: -10,
    },

    // Loading & Empty
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: theme.spacing.xxl,
    },
    loadingText: {
        fontSize: 16,
        marginTop: theme.spacing.md,
    },
    emptyContainer: {
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
});