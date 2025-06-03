import React, {useCallback, useEffect, useState} from 'react';
import {
    ActivityIndicator,
    Alert,
    Linking,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    useColorScheme,
    View
} from 'react-native';
import {useLocalSearchParams, useRouter} from 'expo-router';
import {useTranslation} from 'react-i18next';
import {Feather} from '@expo/vector-icons';
import {BlurView} from 'expo-blur';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {theme} from '@/constants/theme';
import {getBirdBySpeciesCode, type BirdDexRecord} from '@/services/databaseBirDex';
import {hasSpottingForLatin} from '@/services/database';

type DetailRecord = BirdDexRecord & {
    hasBeenLogged: 0 | 1;
};

type NameField = {
    label: string;
    value: string;
    flag: string;
    isPrimary?: boolean;
};

export default function BirdDexDetail() {
    const { code } = useLocalSearchParams<{ code: string }>();
    const { t, i18n } = useTranslation();
    const router = useRouter();
    const scheme = useColorScheme() ?? 'light';
    const pal = theme[scheme];
    const insets = useSafeAreaInsets();

    const [rec, setRec] = useState<DetailRecord | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadBirdDetail = async () => {
            if (!code) {
                Alert.alert(t('birddex.error'), 'No species code provided');
                router.back();
                return;
            }

            try {
                setLoading(true);

                // Use the service function instead of direct DB access
                const bird = getBirdBySpeciesCode(code);

                if (bird) {
                    // Add logging status
                    const detailRecord: DetailRecord = {
                        ...bird,
                        hasBeenLogged: hasSpottingForLatin(bird.scientific_name) ? 1 : 0
                    };
                    setRec(detailRecord);
                } else {
                    Alert.alert(t('birddex.error'), 'Bird not found');
                    router.back();
                }
            } catch (e) {
                console.error('Load bird detail error:', e);
                Alert.alert(t('birddex.error'), 'Failed to load bird details');
                router.back();
            } finally {
                setLoading(false);
            }
        };

        loadBirdDetail();
    }, [code, t, router]);

    const openWikipedia = useCallback(() => {
        if (rec?.scientific_name) {
            const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(rec.scientific_name)}`;
            Linking.openURL(url);
        }
    }, [rec?.scientific_name]);

    const openEBird = useCallback(() => {
        if (rec?.species_code) {
            const url = `https://ebird.org/species/${rec.species_code}`;
            Linking.openURL(url);
        }
    }, [rec?.species_code]);

    const openAllAboutBirds = useCallback(() => {
        if (rec?.species_code) {
            const url = `https://www.allaboutbirds.org/guide/${rec.species_code}`;
            Linking.openURL(url);
        }
    }, [rec?.species_code]);

    const addToSpottings = useCallback(() => {
        // Navigate to the logging screen with pre-filled data
        router.push({
            pathname: '/log/manual',
            params: {
                prefilledBird: rec?.scientific_name || '',
                prefilledEnglishName: rec?.english_name || '',
            }
        });
    }, [rec, router]);

    if (loading) {
        return (
            <SafeAreaView style={[styles.loadingContainer, { backgroundColor: pal.colors.background }]}>
                <ActivityIndicator size="large" color={pal.colors.primary} />
                <Text style={[styles.loadingText, { color: pal.colors.text.secondary }]}>
                    {t('birddex.loadingDetail')}
                </Text>
            </SafeAreaView>
        );
    }

    if (!rec) return null;

    // Get localized display name
    const lang = i18n.language.split('-')[0];
    const localizedName = {
        de: rec.de_name,
        es: rec.es_name,
        uk: rec.ukrainian_name,
        ar: rec.ar_name
    }[lang] || '';
    const displayName = localizedName || rec.english_name;

    // Prepare name fields for display
    const nameFields: NameField[] = [
        { label: t('birddex.english'), value: rec.english_name, flag: '🇬🇧', isPrimary: true },
        { label: t('birddex.scientific'), value: rec.scientific_name, flag: '🔬', isPrimary: true },
        { label: t('birddex.german'), value: rec.de_name, flag: '🇩🇪' },
        { label: t('birddex.spanish'), value: rec.es_name, flag: '🇪🇸' },
        { label: t('birddex.ukrainian'), value: rec.ukrainian_name, flag: '🇺🇦' },
        { label: t('birddex.arabic'), value: rec.ar_name, flag: '🇸🇦' },
    ].filter(field => field.value && field.value.trim() !== '');


    const renderInfoCard = (title: string, children: React.ReactNode, icon?: string) => (
        <BlurView
            intensity={60}
            tint={scheme === "dark" ? "dark" : "light"}
            style={[styles.infoCard, { borderColor: pal.colors.border }]}
        >
            <View style={styles.cardHeader}>
                {icon && <Feather name={icon as any} size={20} color={pal.colors.primary} />}
                <Text style={[styles.cardTitle, { color: pal.colors.text.primary }]}>
                    {title}
                </Text>
            </View>
            <View style={styles.cardContent}>
                {children}
            </View>
        </BlurView>
    );

    const renderActionButton = (title: string, icon: string, onPress: () => void, variant: 'primary' | 'secondary' = 'secondary') => (
        <Pressable
            style={[
                styles.actionButton,
                variant === 'primary'
                    ? { backgroundColor: pal.colors.primary }
                    : { backgroundColor: pal.colors.statusBar, borderColor: pal.colors.border, borderWidth: 1 }
            ]}
            onPress={onPress}
            android_ripple={{ color: pal.colors.primary + '20' }}
        >
            <Feather
                name={icon as any}
                size={18}
                color={variant === 'primary' ? pal.colors.text.primary : pal.colors.text.primary}
            />
            <Text style={[
                styles.actionButtonText,
                { color: variant === 'primary' ? pal.colors.text.primary : pal.colors.text.primary }
            ]}>
                {title}
            </Text>
        </Pressable>
    );

    if (loading) {
        return (
            <SafeAreaView style={[styles.loadingContainer, { backgroundColor: pal.colors.background }]}>
                <ActivityIndicator size="large" color={pal.colors.primary} />
                <Text style={[styles.loadingText, { color: pal.colors.text.secondary }]}>
                    {t('birddex.loadingDetail')}
                </Text>
            </SafeAreaView>
        );
    }

    if (!rec) return null;

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

                <View style={styles.headerInfo}>
                    <Text style={[styles.headerTitle, { color: pal.colors.text.primary }]} numberOfLines={2}>
                        {displayName}
                    </Text>
                    {rec.hasBeenLogged === 1 && (
                        <View style={[styles.loggedBadge, { backgroundColor: pal.colors.primary }]}>
                            <Feather name="check" size={14} color={pal.colors.text.primary} />
                            <Text style={[styles.loggedText, { color: pal.colors.text.primary }]}>
                                {t('birddex.spotted')}
                            </Text>
                        </View>
                    )}
                </View>
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Action Buttons */}
                <View style={styles.actionsContainer}>
                    {!rec.hasBeenLogged && renderActionButton(
                        t('birddex.addToSpottings'),
                        'plus-circle',
                        addToSpottings,
                        'primary'
                    )}
                    {renderActionButton(t('birddex.wikipedia'), 'external-link', openWikipedia)}
                    {renderActionButton(t('birddex.eBird'), 'globe', openEBird)}
                    {renderActionButton(t('birddex.allAboutBirds'), 'book-open', openAllAboutBirds)}
                </View>

                {/* Names Section */}
                {renderInfoCard(t('birddex.names'), (
                    <View style={styles.namesGrid}>
                        {nameFields.map((field, index) => (
                            <View key={index} style={styles.nameRow}>
                                <Text style={styles.nameFlag}>{field.flag}</Text>
                                <View style={styles.nameInfo}>
                                    <Text style={[
                                        styles.nameLabel,
                                        { color: pal.colors.text.secondary },
                                        field.isPrimary && styles.primaryNameLabel
                                    ]}>
                                        {field.label}
                                    </Text>
                                    <Text style={[
                                        styles.nameValue,
                                        { color: pal.colors.text.primary },
                                        field.label === t('birddex.scientific') && styles.scientificName
                                    ]}>
                                        {field.value}
                                    </Text>
                                </View>
                            </View>
                        ))}
                    </View>
                ), 'globe')}

                {/* Classification Section */}
                {renderInfoCard(t('birddex.classification'), (
                    <View style={styles.classificationGrid}>
                        {rec.category && (
                            <View style={styles.classificationItem}>
                                <Text style={[styles.classificationLabel, { color: pal.colors.text.secondary }]}>
                                    {t('birddex.category')}
                                </Text>
                                <Text style={[styles.classificationValue, { color: pal.colors.text.primary }]}>
                                    {rec.category}
                                </Text>
                            </View>
                        )}
                        {rec.order_ && (
                            <View style={styles.classificationItem}>
                                <Text style={[styles.classificationLabel, { color: pal.colors.text.secondary }]}>
                                    {t('birddex.order')}
                                </Text>
                                <Text style={[styles.classificationValue, { color: pal.colors.text.primary }]}>
                                    {rec.order_}
                                </Text>
                            </View>
                        )}
                        {rec.family && (
                            <View style={styles.classificationItem}>
                                <Text style={[styles.classificationLabel, { color: pal.colors.text.secondary }]}>
                                    {t('birddex.family')}
                                </Text>
                                <Text style={[styles.classificationValue, { color: pal.colors.text.primary }]}>
                                    {rec.family}
                                </Text>
                            </View>
                        )}
                    </View>
                ), 'layers')}

                {/* Range & Status Section */}
                {renderInfoCard(t('birddex.distribution'), (
                    <View style={styles.infoSection}>
                        {rec.range && (
                            <View style={styles.infoItem}>
                                <Text style={[styles.infoLabel, { color: pal.colors.text.secondary }]}>
                                    {t('birddex.range')}
                                </Text>
                                <Text style={[styles.infoValue, { color: pal.colors.text.primary }]}>
                                    {rec.range}
                                </Text>
                            </View>
                        )}

                        <View style={styles.infoItem}>
                            <Text style={[styles.infoLabel, { color: pal.colors.text.secondary }]}>
                                {t('birddex.conservationStatus')}
                            </Text>
                            <View style={styles.statusContainer}>
                                {rec.extinct === 'yes' ? (
                                    <>
                                        <Feather name="alert-triangle" size={16} color={pal.colors.error} />
                                        <Text style={[styles.statusText, { color: pal.colors.error }]}>
                                            {t('birddex.extinct')} {rec.extinct_year ? `(${rec.extinct_year})` : ''}
                                        </Text>
                                    </>
                                ) : (
                                    <>
                                        <Feather name="check-circle" size={16} color={pal.colors.primary} />
                                        <Text style={[styles.statusText, { color: pal.colors.primary }]}>
                                            {t('birddex.extant')}
                                        </Text>
                                    </>
                                )}
                            </View>
                        </View>
                    </View>
                ), 'map-pin')}

                {/* Metadata Section */}
                {renderInfoCard(t('birddex.metadata'), (
                    <View style={styles.metadataGrid}>
                        <View style={styles.metadataItem}>
                            <Text style={[styles.metadataLabel, { color: pal.colors.text.secondary }]}>
                                {t('birddex.speciesCode')}
                            </Text>
                            <Text style={[styles.metadataValue, { color: pal.colors.text.primary }]}>
                                {rec.species_code}
                            </Text>
                        </View>
                        <View style={styles.metadataItem}>
                            <Text style={[styles.metadataLabel, { color: pal.colors.text.secondary }]}>
                                {t('birddex.clements2024')}
                            </Text>
                            <Text style={[styles.metadataValue, { color: pal.colors.text.primary }]}>
                                {rec.clements_v2024b_change || t('birddex.noChanges')}
                            </Text>
                        </View>
                    </View>
                ), 'database')}
            </ScrollView>
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
    loadingText: {
        fontSize: 16,
        marginTop: theme.spacing.md,
    },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
        gap: theme.spacing.md,
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 4,
    },
    headerInfo: {
        flex: 1,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        lineHeight: 34,
        marginBottom: theme.spacing.sm,
    },
    loggedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: 4,
        borderRadius: theme.borderRadius.md,
        gap: 4,
    },
    loggedText: {
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
    },

    // Scroll View
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: theme.spacing.md,
        paddingBottom: theme.spacing.xxl,
    },

    // Action Buttons
    actionsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: theme.spacing.sm,
        marginBottom: theme.spacing.lg,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
        borderRadius: theme.borderRadius.lg,
        gap: theme.spacing.sm,
        minWidth: 0,
        flex: 1,
        justifyContent: 'center',
    },
    actionButtonText: {
        fontSize: 14,
        fontWeight: '600',
    },

    // Info Cards
    infoCard: {
        marginBottom: theme.spacing.lg,
        borderRadius: theme.borderRadius.lg,
        borderWidth: 1,
        overflow: 'hidden',
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.md,
        gap: theme.spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(128, 128, 128, 0.2)',
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '600',
    },
    cardContent: {
        padding: theme.spacing.md,
    },

    // Names Section
    namesGrid: {
        gap: theme.spacing.md,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: theme.spacing.sm,
    },
    nameFlag: {
        fontSize: 20,
        width: 28,
    },
    nameInfo: {
        flex: 1,
    },
    nameLabel: {
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
        marginBottom: 2,
    },
    primaryNameLabel: {
        fontWeight: '700',
    },
    nameValue: {
        fontSize: 16,
        lineHeight: 22,
    },
    scientificName: {
        fontStyle: 'italic',
    },

    // Classification Section
    classificationGrid: {
        gap: theme.spacing.md,
    },
    classificationItem: {
        paddingBottom: theme.spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(128, 128, 128, 0.1)',
    },
    classificationLabel: {
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    classificationValue: {
        fontSize: 16,
        fontWeight: '500',
    },

    // Info Section
    infoSection: {
        gap: theme.spacing.lg,
    },
    infoItem: {
        gap: theme.spacing.sm,
    },
    infoLabel: {
        fontSize: 14,
        fontWeight: '600',
    },
    infoValue: {
        fontSize: 16,
        lineHeight: 24,
    },
    statusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
    },
    statusText: {
        fontSize: 16,
        fontWeight: '500',
    },

    // Metadata Section
    metadataGrid: {
        gap: theme.spacing.md,
    },
    metadataItem: {
        gap: 4,
    },
    metadataLabel: {
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    metadataValue: {
        fontSize: 14,
        fontFamily: 'monospace',
    },
});