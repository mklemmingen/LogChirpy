import React, {useCallback, useEffect, useState} from 'react';
import {ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, View} from 'react-native';
import {useLocalSearchParams, useRouter} from 'expo-router';
import {useTranslation} from 'react-i18next';
import {ThemedIcon} from '@/components/ThemedIcon';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Animated, {
    FadeInDown,
    FadeInUp,
    Layout,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import {ThemedView} from '@/components/ThemedView';
import {ThemedText} from '@/components/ThemedText';
import {ThemedPressable} from '@/components/ThemedPressable';
import {ModernCard} from '@/components/ModernCard';
import {useColorVariants, useSemanticColors, useTheme, useTypography} from '@/hooks/useThemeColor';
import {type BirdDexRecord, getBirdBySpeciesCode} from '@/services/databaseBirDex';
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

// Enhanced Header Component
function DetailHeader({
                          bird,
                          onBack,
                          onAddToSpottings
                      }: {
    bird: DetailRecord;
    onBack: () => void;
    onAddToSpottings: () => void;
}) {
    const semanticColors = useSemanticColors();
    const variants = useColorVariants();
    const typography = useTypography();
    const { t, i18n } = useTranslation();
    const insets = useSafeAreaInsets();

    const scale = useSharedValue(1);

    const handleBackPress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        scale.value = withSpring(0.95, { damping: 15, stiffness: 300 }, () => {
            scale.value = withSpring(1, { damping: 15, stiffness: 300 });
        });
        onBack();
    };

    const backButtonStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    // Get localized display name
    const lang = i18n.language.split('-')[0];
    const localizedName = {
        de: bird.de_name,
        es: bird.es_name,
        uk: bird.ukrainian_name,
        ar: bird.ar_name
    }[lang] || '';
    const displayName = localizedName || bird.english_name;

    return (
        <Animated.View
            entering={FadeInUp.springify()}
            style={[styles.header, { marginTop: insets.top }]}
        >
            <Animated.View style={backButtonStyle}>
                <ThemedPressable
                    variant="secondary"
                    size="medium"
                    onPress={handleBackPress}
                    style={styles.backButton}
                >
                    <ThemedIcon name="arrow-left" size={20} color="text" />
                </ThemedPressable>
            </Animated.View>

            <ThemedView surface="transparent" style={styles.headerInfo}>
                <ThemedText
                    variant="headlineLarge"
                    style={styles.headerTitle}
                    numberOfLines={2}
                >
                    {displayName}
                </ThemedText>

                <ThemedText
                    variant="bodyMedium"
                    color="secondary"
                    style={styles.scientificName}
                >
                    {bird.scientific_name}
                </ThemedText>

                {bird.hasBeenLogged === 1 && (
                    <Animated.View
                        entering={FadeInDown.delay(200).springify()}
                        style={[styles.loggedBadge, { backgroundColor: variants.primarySubtle }]}
                    >
                        <ThemedIcon name="check" size={14} color="primary" />
                        <ThemedText
                            variant="labelSmall"
                            color="primary"
                            style={styles.loggedText}
                        >
                            {t('birddex.spotted')}
                        </ThemedText>
                    </Animated.View>
                )}
            </ThemedView>

            {!bird.hasBeenLogged && (
                <ThemedPressable
                    variant="primary"
                    size="medium"
                    onPress={onAddToSpottings}
                    style={styles.addButton}
                    glowOnHover
                >
                    <ThemedIcon name="plus" size={18} color="onPrimary" />
                </ThemedPressable>
            )}
        </Animated.View>
    );
}

// Quick Action Button Component
function QuickActionButton({
                               title,
                               icon,
                               onPress,
                               delay = 0
                           }: {
    title: string;
    icon: string;
    onPress: () => void;
    delay?: number;
}) {
    const semanticColors = useSemanticColors();

    return (
        <Animated.View
            entering={FadeInDown.delay(delay).springify()}
            layout={Layout.springify()}
            style={styles.actionButtonContainer}
        >
            <ThemedPressable
                variant="secondary"
                onPress={onPress}
                style={styles.actionButton}
            >
                <ThemedIcon name={icon as any} size={18} color="text" />
                <ThemedText variant="labelMedium">{title}</ThemedText>
                <ThemedIcon name="external-link" size={14} color="textTertiary" />
            </ThemedPressable>
        </Animated.View>
    );
}

// Name Row Component
function NameRow({ field, index }: { field: NameField; index: number }) {
    const semanticColors = useSemanticColors();
    const typography = useTypography();

    return (
        <Animated.View
            entering={FadeInDown.delay(index * 50).springify()}
            layout={Layout.springify()}
            style={styles.nameRow}
        >
            <ThemedText style={styles.nameFlag}>{field.flag}</ThemedText>
            <ThemedView surface="transparent" style={styles.nameInfo}>
                <ThemedText
                    variant="labelSmall"
                    color="secondary"
                    style={[
                        styles.nameLabel,
                        field.isPrimary && styles.primaryNameLabel
                    ]}
                >
                    {field.label}
                </ThemedText>
                <ThemedText
                    variant="bodyMedium"
                    style={[
                        styles.nameValue,
                        field.label.includes('Scientific') && styles.scientificNameText
                    ]}
                >
                    {field.value}
                </ThemedText>
            </ThemedView>
        </Animated.View>
    );
}

// Classification Item Component
function ClassificationItem({
                                label,
                                value,
                                index
                            }: {
    label: string;
    value: string;
    index: number;
}) {
    return (
        <Animated.View
            entering={FadeInDown.delay(index * 100).springify()}
            layout={Layout.springify()}
            style={styles.classificationItem}
        >
            <ThemedText variant="labelMedium" color="secondary" style={styles.classificationLabel}>
                {label}
            </ThemedText>
            <ThemedText variant="bodyMedium" style={styles.classificationValue}>
                {value}
            </ThemedText>
        </Animated.View>
    );
}

export default function ModernBirdDexDetail() {
    const { code } = useLocalSearchParams<{ code: string }>();
    const { t, i18n } = useTranslation();
    const router = useRouter();

    // Modern theme hooks
    const semanticColors = useSemanticColors();
    const variants = useColorVariants();
    const typography = useTypography();
    const theme = useTheme();

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
                const bird = getBirdBySpeciesCode(code);

                if (bird) {
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
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(rec.scientific_name)}`;
            Linking.openURL(url);
        }
    }, [rec?.scientific_name]);

    const openEBird = useCallback(() => {
        if (rec?.species_code) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            const url = `https://ebird.org/species/${rec.species_code}`;
            Linking.openURL(url);
        }
    }, [rec?.species_code]);

    const openAllAboutBirds = useCallback(() => {
        if (rec?.species_code) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            const url = `https://www.allaboutbirds.org/guide/${rec.species_code}`;
            Linking.openURL(url);
        }
    }, [rec?.species_code]);

    const addToSpottings = useCallback(() => {
        if (rec) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            router.push({
                pathname: '/log/manual',
                params: {
                    prefilledBird: rec.scientific_name || '',
                    prefilledEnglishName: rec.english_name || '',
                }
            });
        }
    }, [rec, router]);

    // Loading state
    if (loading) {
        return (
            <ThemedView surface="primary" style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={semanticColors.primary} />
                <ThemedText variant="bodyMedium" color="secondary" style={styles.loadingText}>
                    {t('birddex.loadingDetail')}
                </ThemedText>
            </ThemedView>
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

    // Prepare name fields for display
    const nameFields: NameField[] = [
        { label: t('birddex.english'), value: rec.english_name, flag: '🇬🇧', isPrimary: true },
        { label: t('birddex.scientific'), value: rec.scientific_name, flag: '🔬', isPrimary: true },
        { label: t('birddex.german'), value: rec.de_name, flag: '🇩🇪' },
        { label: t('birddex.spanish'), value: rec.es_name, flag: '🇪🇸' },
        { label: t('birddex.ukrainian'), value: rec.ukrainian_name, flag: '🇺🇦' },
        { label: t('birddex.arabic'), value: rec.ar_name, flag: '🇸🇦' },
    ].filter(field => field.value && field.value.trim() !== '');

    return (
        <ThemedView surface="primary" style={styles.container}>
            {/* Header */}
            <DetailHeader
                bird={rec}
                onBack={() => router.back()}
                onAddToSpottings={addToSpottings}
            />

            {/* Content */}
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Quick Actions */}
                <Animated.View
                    entering={FadeInDown.delay(100).springify()}
                    style={styles.quickActions}
                >
                    <QuickActionButton
                        title={t('birddex.wikipedia')}
                        icon="book"
                        onPress={openWikipedia}
                        delay={0}
                    />
                    <QuickActionButton
                        title={t('birddex.eBird')}
                        icon="globe"
                        onPress={openEBird}
                        delay={50}
                    />
                    <QuickActionButton
                        title={t('birddex.allAboutBirds')}
                        icon="feather"
                        onPress={openAllAboutBirds}
                        delay={100}
                    />
                </Animated.View>

                {/* Names Section */}
                <Animated.View entering={FadeInDown.delay(200).springify()}>
                    <ModernCard elevated={false} bordered={true} style={styles.section}>
                        <ThemedView style={styles.sectionHeader}>
                            <ThemedIcon name="globe" size={20} color="primary" />
                            <ThemedText variant="headlineSmall" style={styles.sectionTitle}>
                                {t('birddex.names')}
                            </ThemedText>
                        </ThemedView>
                        <ThemedView surface="transparent" style={styles.namesGrid}>
                            {nameFields.map((field, index) => (
                                <NameRow key={index} field={field} index={index} />
                            ))}
                        </ThemedView>
                    </ModernCard>
                </Animated.View>

                {/* Classification Section */}
                <Animated.View entering={FadeInDown.delay(300).springify()}>
                    <ModernCard elevated={false} bordered={true} style={styles.section}>
                        <ThemedView style={styles.sectionHeader}>
                            <ThemedIcon name="layers" size={20} color="primary" />
                            <ThemedText variant="headlineSmall" style={styles.sectionTitle}>
                                {t('birddex.classification')}
                            </ThemedText>
                        </ThemedView>
                        <ThemedView surface="transparent" style={styles.classificationGrid}>
                            {rec.category && (
                                <ClassificationItem
                                    label={t('birddex.category')}
                                    value={rec.category}
                                    index={0}
                                />
                            )}
                            {rec.order_ && (
                                <ClassificationItem
                                    label={t('birddex.order')}
                                    value={rec.order_}
                                    index={1}
                                />
                            )}
                            {rec.family && (
                                <ClassificationItem
                                    label={t('birddex.family')}
                                    value={rec.family}
                                    index={2}
                                />
                            )}
                        </ThemedView>
                    </ModernCard>
                </Animated.View>

                {/* Distribution Section */}
                <Animated.View entering={FadeInDown.delay(400).springify()}>
                    <ModernCard elevated={false} bordered={true} style={styles.section}>
                        <ThemedView style={styles.sectionHeader}>
                            <ThemedIcon name="map-pin" size={20} color="primary" />
                            <ThemedText variant="headlineSmall" style={styles.sectionTitle}>
                                {t('birddex.distribution')}
                            </ThemedText>
                        </ThemedView>
                        <ThemedView surface="transparent" style={styles.distributionContent}>
                            {rec.range && (
                                <Animated.View
                                    entering={FadeInDown.delay(450).springify()}
                                    style={styles.infoItem}
                                >
                                    <ThemedText variant="labelMedium" color="secondary" style={styles.infoLabel}>
                                        {t('birddex.range')}
                                    </ThemedText>
                                    <ThemedText variant="bodyMedium" style={styles.infoValue}>
                                        {rec.range}
                                    </ThemedText>
                                </Animated.View>
                            )}

                            <Animated.View
                                entering={FadeInDown.delay(500).springify()}
                                style={styles.infoItem}
                            >
                                <ThemedText variant="labelMedium" color="secondary" style={styles.infoLabel}>
                                    {t('birddex.conservationStatus')}
                                </ThemedText>
                                <ThemedView surface="transparent" style={styles.statusContainer}>
                                    {rec.extinct === 'yes' ? (
                                        <>
                                            <ThemedIcon name="alert-triangle" size={16} color="error" />
                                            <ThemedText variant="bodyMedium" color="error" style={styles.statusText}>
                                                {t('birddex.extinct')} {rec.extinct_year ? `(${rec.extinct_year})` : ''}
                                            </ThemedText>
                                        </>
                                    ) : (
                                        <>
                                            <ThemedIcon name="check-circle" size={16} color="success" />
                                            <ThemedText variant="bodyMedium" color="success" style={styles.statusText}>
                                                {t('birddex.extant')}
                                            </ThemedText>
                                        </>
                                    )}
                                </ThemedView>
                            </Animated.View>
                        </ThemedView>
                    </ModernCard>
                </Animated.View>

                {/* Metadata Section */}
                <Animated.View entering={FadeInDown.delay(500).springify()}>
                    <ModernCard elevated={false} bordered={true} style={styles.section}>
                        <ThemedView style={styles.sectionHeader}>
                            <ThemedIcon name="database" size={20} color="primary" />
                            <ThemedText variant="headlineSmall" style={styles.sectionTitle}>
                                {t('birddex.metadata')}
                            </ThemedText>
                        </ThemedView>
                        <ThemedView surface="transparent" style={styles.metadataGrid}>
                            <Animated.View
                                entering={FadeInDown.delay(550).springify()}
                                style={styles.metadataItem}
                            >
                                <ThemedText variant="labelSmall" color="secondary" style={styles.metadataLabel}>
                                    {t('birddex.speciesCode')}
                                </ThemedText>
                                <ThemedText variant="bodySmall" style={styles.metadataValue}>
                                    {rec.species_code}
                                </ThemedText>
                            </Animated.View>

                            <Animated.View
                                entering={FadeInDown.delay(600).springify()}
                                style={styles.metadataItem}
                            >
                                <ThemedText variant="labelSmall" color="secondary" style={styles.metadataLabel}>
                                    {t('birddex.clements2024')}
                                </ThemedText>
                                <ThemedText variant="bodySmall" style={styles.metadataValue}>
                                    {rec.clements_v2024b_change || t('birddex.noChanges')}
                                </ThemedText>
                            </Animated.View>
                        </ThemedView>
                    </ModernCard>
                </Animated.View>
            </ScrollView>
        </ThemedView>
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
        gap: 16,
    },
    loadingText: {
        textAlign: 'center',
    },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingHorizontal: 20,
        paddingVertical: 16,
        gap: 16,
    },
    backButton: {
        minWidth: 44,
    },
    headerInfo: {
        flex: 1,
        gap: 4,
    },
    headerTitle: {
        fontWeight: '700',
        lineHeight: 32,
    },
    scientificName: {
        fontStyle: 'italic',
        marginBottom: 8,
    },
    loggedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        gap: 6,
    },
    loggedText: {
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    addButton: {
        minWidth: 44,
    },

    // Sections
    section: {
        overflow: 'hidden',
        padding: 20,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 20,
    },
    sectionTitle: {
        fontWeight: '600',
    },

    // Scroll View
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 40,
        gap: 24,
    },

    // Quick Actions
    quickActions: {
        gap: 12,
    },
    actionButtonContainer: {
        width: '100%',
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 16,
        paddingHorizontal: 20,
        justifyContent: 'space-between',
    },

    // Names Section
    namesGrid: {
        gap: 16,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
    },
    nameFlag: {
        fontSize: 20,
        width: 28,
        textAlign: 'center',
    },
    nameInfo: {
        flex: 1,
        gap: 4,
    },
    nameLabel: {
        textTransform: 'uppercase',
        fontWeight: '600',
        letterSpacing: 0.5,
    },
    primaryNameLabel: {
        fontWeight: '700',
    },
    nameValue: {
        lineHeight: 22,
    },
    scientificNameText: {
        fontStyle: 'italic',
    },

    // Classification Section
    classificationGrid: {
        gap: 16,
    },
    classificationItem: {
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0, 0, 0, 0.1)',
    },
    classificationLabel: {
        textTransform: 'uppercase',
        fontWeight: '600',
        letterSpacing: 0.5,
        marginBottom: 4,
    },
    classificationValue: {
        fontWeight: '500',
    },

    // Distribution Section
    distributionContent: {
        gap: 20,
    },
    infoItem: {
        gap: 8,
    },
    infoLabel: {
        textTransform: 'uppercase',
        fontWeight: '600',
        letterSpacing: 0.5,
    },
    infoValue: {
        lineHeight: 24,
    },
    statusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    statusText: {
        fontWeight: '500',
    },

    // Metadata Section
    metadataGrid: {
        gap: 16,
    },
    metadataItem: {
        gap: 6,
    },
    metadataLabel: {
        textTransform: 'uppercase',
        fontWeight: '600',
        letterSpacing: 0.5,
    },
    metadataValue: {
        fontFamily: 'monospace',
        opacity: 0.8,
    },
});