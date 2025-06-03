import React, {useCallback, useEffect, useState} from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    Linking,
    Pressable,
    ScrollView,
    Share,
    StyleSheet,
    View
} from 'react-native';
import {Audio} from 'expo-av';
import {useLocalSearchParams, useRouter} from 'expo-router';
import {useTranslation} from 'react-i18next';
import {Feather} from '@expo/vector-icons';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import * as MediaLibrary from 'expo-media-library';
import Animated, {
    FadeInDown,
    FadeInUp,
    Layout,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import {type BirdSpotting, getSpottingById} from '@/services/database';
import {ModernCard} from '@/components/ModernCard';
import {ThemedPressable} from '@/components/ThemedPressable';
import {ThemedText} from '@/components/ThemedText';
import {ThemedView} from '@/components/ThemedView';
import {
    useTheme,
    useSemanticColors,
    useColorVariants,
    useTypography,
    useMotionValues
} from '@/hooks/useThemeColor';

type SpottingDetail = BirdSpotting | null;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Enhanced Header Component
function DetailHeader({
                          entry,
                          onBack,
                          onShare
                      }: {
    entry: BirdSpotting;
    onBack: () => void;
    onShare: () => void;
}) {
    const semanticColors = useSemanticColors();
    const variants = useColorVariants();
    const typography = useTypography();
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const { t } = useTranslation();

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
                    <Feather name="arrow-left" size={20} color={semanticColors.text} />
                </ThemedPressable>
            </Animated.View>

            <ThemedView surface="transparent" style={styles.headerInfo}>
                <ThemedText
                    variant="headlineLarge"
                    style={styles.headerTitle}
                    numberOfLines={2}
                >
                    {entry.birdType || t('archive.unknown_bird')}
                </ThemedText>
                <ThemedText
                    variant="bodyMedium"
                    color="secondary"
                    style={styles.headerDate}
                >
                    {new Date(entry.date).toLocaleDateString()}
                </ThemedText>
            </ThemedView>

            <ThemedPressable
                variant="ghost"
                size="medium"
                onPress={onShare}
                style={styles.shareButton}
            >
                <Feather name="share" size={18} color={semanticColors.text} />
            </ThemedPressable>
        </Animated.View>
    );
}

// Enhanced Media Section
function MediaSection({
                          entry,
                          onImageSave,
                          onAudioPlay,
                          audioLoading,
                          currentSound
                      }: {
    entry: BirdSpotting;
    onImageSave: (uri: string) => void;
    onAudioPlay: (uri: string) => void;
    audioLoading: boolean;
    currentSound: Audio.Sound | null;
}) {
    const semanticColors = useSemanticColors();
    const variants = useColorVariants();
    const { t } = useTranslation();

    if (!entry.imageUri && !entry.videoUri && !entry.audioUri) return null;

    return (
        <Animated.View entering={FadeInDown.delay(100).springify()} layout={Layout.springify()}>
            <ModernCard variant="elevated" style={styles.section}>
                <ThemedView surface="transparent" style={styles.sectionHeader}>
                    <Feather name="camera" size={20} color={semanticColors.primary} />
                    <ThemedText variant="headlineSmall" style={styles.sectionTitle}>
                        {t('archive.media')}
                    </ThemedText>
                </ThemedView>

                <ThemedView surface="transparent" style={styles.mediaContainer}>
                    {/* Image */}
                    {entry.imageUri && (
                        <Pressable
                            style={styles.mediaItem}
                            onLongPress={() => onImageSave(entry.imageUri)}
                            android_ripple={{ color: variants.surfacePressed }}
                        >
                            <Image source={{ uri: entry.imageUri }} style={styles.mediaImage} />
                            <ThemedView surface="overlay" style={styles.mediaOverlay}>
                                <Feather name="maximize-2" size={20} color="white" />
                            </ThemedView>
                        </Pressable>
                    )}

                    {/* Video */}
                    {entry.videoUri && (
                        <Pressable style={styles.mediaItem} android_ripple={null}>
                            <Image source={{ uri: entry.videoUri }} style={styles.mediaImage} />
                            <ThemedView surface="overlay" style={[styles.mediaOverlay, styles.videoOverlay]}>
                                <Feather name="play" size={24} color="white" />
                            </ThemedView>
                        </Pressable>
                    )}

                    {/* Audio */}
                    {entry.audioUri && (
                        <ThemedPressable
                            variant="primary"
                            onPress={() => onAudioPlay(entry.audioUri)}
                            disabled={audioLoading}
                            style={styles.audioButton}
                        >
                            {audioLoading ? (
                                <ActivityIndicator size="small" color={semanticColors.onPrimary} />
                            ) : (
                                <Feather
                                    name={currentSound ? "pause" : "play"}
                                    size={18}
                                    color={semanticColors.onPrimary}
                                />
                            )}
                            <ThemedText variant="labelLarge" style={{ color: semanticColors.onPrimary }}>
                                {t('archive.play_audio')}
                            </ThemedText>
                        </ThemedPressable>
                    )}
                </ThemedView>
            </ModernCard>
        </Animated.View>
    );
}

// Enhanced Info Section
function InfoSection({
                         title,
                         icon,
                         children,
                         delay = 0
                     }: {
    title: string;
    icon: string;
    children: React.ReactNode;
    delay?: number;
}) {
    const semanticColors = useSemanticColors();

    return (
        <Animated.View
            entering={FadeInDown.delay(delay).springify()}
            layout={Layout.springify()}
        >
            <ModernCard variant="elevated" style={styles.section}>
                <ThemedView surface="transparent" style={styles.sectionHeader}>
                    <Feather name={icon as any} size={20} color={semanticColors.primary} />
                    <ThemedText variant="headlineSmall" style={styles.sectionTitle}>
                        {title}
                    </ThemedText>
                </ThemedView>
                <ThemedView surface="transparent" style={styles.sectionContent}>
                    {children}
                </ThemedView>
            </ModernCard>
        </Animated.View>
    );
}

// Info Row Component
function InfoRow({
                     label,
                     value,
                     icon,
                     onPress,
                     style
                 }: {
    label: string;
    value: string;
    icon?: string;
    onPress?: () => void;
    style?: any;
}) {
    const semanticColors = useSemanticColors();
    const variants = useColorVariants();

    const Component = onPress ? Pressable : View;

    return (
        <Component
            style={[styles.infoRow, onPress && styles.pressableRow]}
            onPress={onPress}
            android_ripple={onPress ? { color: variants.surfacePressed } : null}
        >
            <ThemedText variant="labelMedium" color="secondary" style={styles.infoLabel}>
                {label}
            </ThemedText>
            <ThemedView surface="transparent" style={styles.infoValueContainer}>
                {icon && (
                    <Feather name={icon as any} size={14} color={semanticColors.accent} />
                )}
                <ThemedText variant="bodyMedium" style={[styles.infoValue, style]}>
                    {value}
                </ThemedText>
                {onPress && (
                    <Feather name="external-link" size={14} color={semanticColors.textSecondary} />
                )}
            </ThemedView>
        </Component>
    );
}

export default function ModernArchiveDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { t } = useTranslation();
    const router = useRouter();
    const semanticColors = useSemanticColors();
    const variants = useColorVariants();
    const typography = useTypography();
    const theme = useTheme();

    const [entry, setEntry] = useState<SpottingDetail>(null);
    const [loading, setLoading] = useState(true);
    const [audioLoading, setAudioLoading] = useState(false);
    const [currentSound, setCurrentSound] = useState<Audio.Sound | null>(null);

    // Load spotting data
    useEffect(() => {
        const loadSpotting = async () => {
            try {
                setLoading(true);
                const data = getSpottingById(Number(id));
                setEntry(data);
            } catch (e) {
                console.error(e);
                Alert.alert(t('archive.error'), t('archive.load_detail_failed'));
                router.back();
            } finally {
                setLoading(false);
            }
        };

        if (id) {
            loadSpotting();
        }
    }, [id, t, router]);

    // Cleanup audio on unmount
    useEffect(() => {
        return () => {
            if (currentSound) {
                currentSound.unloadAsync();
            }
        };
    }, [currentSound]);

    // Audio playback
    const playAudio = useCallback(async (uri: string) => {
        try {
            setAudioLoading(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

            if (currentSound) {
                await currentSound.unloadAsync();
            }

            const { sound } = await Audio.Sound.createAsync(
                { uri },
                { shouldPlay: true }
            );

            setCurrentSound(sound);

            sound.setOnPlaybackStatusUpdate((status) => {
                if (status.isLoaded && status.didJustFinish) {
                    sound.unloadAsync();
                    setCurrentSound(null);
                }
            });
        } catch (error) {
            console.error('Audio playback error:', error);
            Alert.alert(t('archive.error'), t('archive.audio_play_failed'));
        } finally {
            setAudioLoading(false);
        }
    }, [currentSound, t]);

    // Navigation and actions
    const openLocation = useCallback(() => {
        if (entry?.gpsLat && entry?.gpsLng) {
            const url = `https://maps.google.com/?q=${entry.gpsLat},${entry.gpsLng}`;
            Linking.openURL(url);
        }
    }, [entry]);

    const shareSpotting = useCallback(async () => {
        if (!entry) return;

        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            const message = t('archive.share_message', {
                bird: entry.birdType || t('archive.unknown_bird'),
                date: new Date(entry.date).toLocaleDateString(),
                location: entry.gpsLat && entry.gpsLng
                    ? `${entry.gpsLat.toFixed(6)}, ${entry.gpsLng.toFixed(6)}`
                    : t('archive.location_unknown')
            });

            await Share.share({
                message,
                title: t('archive.share_title')
            });
        } catch (error) {
            console.error('Share error:', error);
        }
    }, [entry, t]);

    const saveImageToLibrary = useCallback(async (uri: string) => {
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            const { status } = await MediaLibrary.requestPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert(t('archive.permission_needed'), t('archive.media_permission_message'));
                return;
            }

            await MediaLibrary.saveToLibraryAsync(uri);
            Alert.alert(t('archive.success'), t('archive.image_saved'));
        } catch (error) {
            console.error('Save image error:', error);
            Alert.alert(t('archive.error'), t('archive.save_failed'));
        }
    }, [t]);

    // Loading state
    if (loading) {
        return (
            <ThemedView surface="primary" style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={semanticColors.primary} />
                <ThemedText variant="bodyMedium" color="secondary" style={styles.loadingText}>
                    {t('archive.loading_detail')}
                </ThemedText>
            </ThemedView>
        );
    }

    // Error state
    if (!entry) {
        return (
            <ThemedView surface="primary" style={styles.loadingContainer}>
                <Feather name="alert-triangle" size={48} color={semanticColors.error} />
                <ThemedText variant="headlineMedium" style={styles.errorText}>
                    {t('archive.not_found')}
                </ThemedText>
            </ThemedView>
        );
    }

    return (
        <ThemedView surface="primary" style={styles.container}>
            {/* Header */}
            <DetailHeader
                entry={entry}
                onBack={() => router.back()}
                onShare={shareSpotting}
            />

            {/* Content */}
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Media Section */}
                <MediaSection
                    entry={entry}
                    onImageSave={saveImageToLibrary}
                    onAudioPlay={playAudio}
                    audioLoading={audioLoading}
                    currentSound={currentSound}
                />

                {/* Basic Information */}
                <InfoSection title={t('archive.details')} icon="info" delay={200}>
                    <InfoRow
                        label={t('archive.species')}
                        value={entry.birdType || t('archive.unknown_bird')}
                    />
                    <InfoRow
                        label={t('archive.date_time')}
                        value={new Date(entry.date).toLocaleString()}
                    />
                    {entry.textNote && (
                        <InfoRow
                            label={t('archive.notes')}
                            value={entry.textNote}
                            style={styles.noteText}
                        />
                    )}
                    {entry.latinBirDex && (
                        <InfoRow
                            label={t('archive.latin_name')}
                            value={entry.latinBirDex}
                            style={[styles.latinText, { color: semanticColors.accent }]}
                        />
                    )}
                </InfoSection>

                {/* Location Section */}
                {(entry.gpsLat && entry.gpsLng) && (
                    <InfoSection title={t('archive.location')} icon="map-pin" delay={300}>
                        <InfoRow
                            label={t('archive.coordinates')}
                            value={`${entry.gpsLat.toFixed(6)}, ${entry.gpsLng.toFixed(6)}`}
                            icon="map-pin"
                            onPress={openLocation}
                            style={styles.coordinatesText}
                        />
                    </InfoSection>
                )}

                {/* AI Predictions */}
                {(entry.imagePrediction || entry.audioPrediction) && (
                    <InfoSection title={t('archive.ai_analysis')} icon="cpu" delay={400}>
                        {entry.imagePrediction && (
                            <InfoRow
                                label={t('archive.image_ai')}
                                value={entry.imagePrediction}
                                icon="camera"
                            />
                        )}
                        {entry.audioPrediction && (
                            <InfoRow
                                label={t('archive.audio_ai')}
                                value={entry.audioPrediction}
                                icon="mic"
                            />
                        )}
                    </InfoSection>
                )}

                {/* Technical Details */}
                <InfoSection title={t('archive.technical')} icon="database" delay={500}>
                    <InfoRow
                        label={t('archive.entry_id')}
                        value={`#${entry.id}`}
                        style={styles.technicalText}
                    />
                    <InfoRow
                        label={t('archive.sync_status')}
                        value={entry.synced ? t('archive.synced') : t('archive.local_only')}
                        icon={entry.synced ? "check-circle" : "upload-cloud"}
                    />
                    <InfoRow
                        label={t('archive.created')}
                        value={new Date(entry.date).toLocaleDateString()}
                        style={styles.technicalText}
                    />
                </InfoSection>
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
    errorText: {
        textAlign: 'center',
        marginTop: 16,
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
    },
    headerTitle: {
        fontWeight: '600',
        lineHeight: 28,
        marginBottom: 4,
    },
    headerDate: {
        opacity: 0.8,
    },
    shareButton: {
        minWidth: 44,
    },

    // Scroll View
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 40,
        gap: 20,
    },

    // Sections
    section: {
        overflow: 'hidden',
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 16,
    },
    sectionTitle: {
        fontWeight: '600',
    },
    sectionContent: {
        gap: 16,
    },

    // Media
    mediaContainer: {
        gap: 16,
    },
    mediaItem: {
        borderRadius: 12,
        overflow: 'hidden',
        position: 'relative',
    },
    mediaImage: {
        width: '100%',
        height: 200,
        resizeMode: 'cover',
    },
    mediaOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
    },
    videoOverlay: {
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    audioButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 16,
    },

    // Info Rows
    infoRow: {
        gap: 8,
        paddingVertical: 8,
    },
    pressableRow: {
        borderRadius: 8,
        marginHorizontal: -8,
        paddingHorizontal: 8,
    },
    infoLabel: {
        textTransform: 'uppercase',
        fontWeight: '600',
        letterSpacing: 0.5,
    },
    infoValueContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
    },
    infoValue: {
        flex: 1,
        lineHeight: 22,
    },
    noteText: {
        lineHeight: 24,
    },
    latinText: {
        fontStyle: 'italic',
    },
    technicalText: {
        fontFamily: 'monospace',
        fontSize: 14,
    },
    coordinatesText: {
        fontFamily: 'monospace',
    },
});