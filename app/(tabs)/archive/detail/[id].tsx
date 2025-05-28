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
    Text,
    useColorScheme,
    View
} from 'react-native';
import {Audio} from 'expo-av';
import {useLocalSearchParams, useRouter} from 'expo-router';
import {useTranslation} from 'react-i18next';
import {Feather} from '@expo/vector-icons';
import {BlurView} from 'expo-blur';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import * as MediaLibrary from 'expo-media-library';

import {type BirdSpotting, getSpottingById} from '@/services/database';
import {theme} from '@/constants/theme';

type SpottingDetail = BirdSpotting | null;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ArchiveDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { t } = useTranslation();
    const router = useRouter();
    const scheme = useColorScheme() ?? 'light';
    const pal = theme[scheme];
    const insets = useSafeAreaInsets();

    const [entry, setEntry] = useState<SpottingDetail>(null);
    const [loading, setLoading] = useState(true);
    const [audioLoading, setAudioLoading] = useState(false);
    const [currentSound, setCurrentSound] = useState<Audio.Sound | null>(null);

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

    const playAudio = useCallback(async (uri: string) => {
        try {
            setAudioLoading(true);

            // Unload previous sound
            if (currentSound) {
                await currentSound.unloadAsync();
            }

            const { sound } = await Audio.Sound.createAsync(
                { uri },
                { shouldPlay: true }
            );

            setCurrentSound(sound);

            // Auto cleanup when finished
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

    const openLocation = useCallback(() => {
        if (entry?.gpsLat && entry?.gpsLng) {
            const url = `https://maps.google.com/?q=${entry.gpsLat},${entry.gpsLng}`;
            Linking.openURL(url);
        }
    }, [entry]);

    const shareSpotting = useCallback(async () => {
        if (!entry) return;

        try {
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

    const renderMediaSection = () => {
        if (!entry?.imageUri && !entry?.videoUri && !entry?.audioUri) return null;

        return (
            <BlurView
                intensity={60}
                tint={scheme === "dark" ? "dark" : "light"}
                style={[styles.mediaCard, { borderColor: pal.colors.border }]}
            >
                <View style={[styles.cardHeader, { borderBottomColor: pal.colors.border }]}>
                    <Feather name="camera" size={20} color={pal.colors.primary} />
                    <Text style={[styles.cardTitle, { color: pal.colors.text.primary }]}>
                        {t('archive.media')}
                    </Text>
                </View>

                <View style={styles.mediaContainer}>
                    {/* Image */}
                    {entry.imageUri && (
                        <Pressable
                            style={({ pressed }) => [
                                styles.mediaItem,
                                pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] }
                            ]}
                            onLongPress={() => saveImageToLibrary(entry.imageUri)}
                            android_ripple={null}
                        >
                            <Image source={{ uri: entry.imageUri }} style={styles.mediaImage} />
                            <View style={styles.mediaOverlay}>
                                <Feather name="maximize-2" size={20} color="white" />
                            </View>
                        </Pressable>
                    )}

                    {/* Video */}
                    {entry.videoUri && (
                        <Pressable
                            style={({ pressed }) => [
                                styles.mediaItem,
                                pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] }
                            ]}
                            android_ripple={null}
                        >
                            <Image source={{ uri: entry.videoUri }} style={styles.mediaImage} />
                            <View style={[styles.mediaOverlay, styles.videoOverlay]}>
                                <Feather name="play" size={24} color="white" />
                            </View>
                        </Pressable>
                    )}

                    {/* Audio */}
                    {entry.audioUri && (
                        <Pressable
                            style={({ pressed }) => [
                                styles.audioButton,
                                { backgroundColor: pal.colors.primary },
                                pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] }
                            ]}
                            onPress={() => playAudio(entry.audioUri)}
                            disabled={audioLoading}
                            android_ripple={null}
                        >
                            {audioLoading ? (
                                <ActivityIndicator size="small" color={pal.colors.text.primary} />
                            ) : (
                                <Feather
                                    name={currentSound ? "pause" : "play"}
                                    size={20}
                                    color={pal.colors.text.primary}
                                />
                            )}
                            <Text style={[styles.audioButtonText, { color: pal.colors.text.primary }]}>
                                {t('archive.play_audio')}
                            </Text>
                        </Pressable>
                    )}
                </View>
            </BlurView>
        );
    };

    const renderInfoCard = (title: string, icon: string, children: React.ReactNode) => (
        <BlurView
            intensity={60}
            tint={scheme === "dark" ? "dark" : "light"}
            style={[styles.infoCard, { borderColor: pal.colors.border }]}
        >
            <View style={[styles.cardHeader, { borderBottomColor: pal.colors.border }]}>
                <Feather name={icon as any} size={20} color={pal.colors.primary} />
                <Text style={[styles.cardTitle, { color: pal.colors.text.primary }]}>
                    {title}
                </Text>
            </View>
            <View style={styles.cardContent}>
                {children}
            </View>
        </BlurView>
    );

    if (loading) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: pal.colors.background }]}>
                <ActivityIndicator size="large" color={pal.colors.primary} />
                <Text style={[styles.loadingText, { color: pal.colors.text.secondary }]}>
                    {t('archive.loading_detail')}
                </Text>
            </View>
        );
    }

    if (!entry) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: pal.colors.background }]}>
                <Feather name="alert-triangle" size={48} color={pal.colors.error} />
                <Text style={[styles.errorText, { color: pal.colors.text.primary }]}>
                    {t('archive.not_found')}
                </Text>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: pal.colors.background }]}>
            {/* Header */}
            <View style={[styles.header, { marginTop: insets.top }]}>
                <Pressable
                    style={({ pressed }) => [
                        styles.backButton,
                        { backgroundColor: pal.colors.background},
                        pressed && { opacity: 0.8, transform: [{ scale: 0.95 }] }
                    ]}
                    onPress={() => router.back()}
                    android_ripple={null}
                >
                    <Feather name="arrow-left" size={24} color={pal.colors.text.primary} />
                </Pressable>

                <View style={styles.headerInfo}>
                    <Text style={[styles.headerTitle, { color: pal.colors.text.primary }]} numberOfLines={2}>
                        {entry.birdType || t('archive.unknown_bird')}
                    </Text>
                    <Text style={[styles.headerDate, { color: pal.colors.text.secondary }]}>
                        {new Date(entry.date).toLocaleDateString()}
                    </Text>
                </View>

                <Pressable
                    style={({ pressed }) => [
                        styles.shareButton,
                        { backgroundColor: pal.colors.statusBar },
                        pressed && { opacity: 0.8, transform: [{ scale: 0.95 }] }
                    ]}
                    onPress={shareSpotting}
                    android_ripple={null}
                >
                    <Feather name="share" size={20} color={pal.colors.text.primary} />
                </Pressable>
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Media Section */}
                {renderMediaSection()}

                {/* Basic Information */}
                {renderInfoCard(t('archive.details'), 'info', (
                    <View style={styles.infoGrid}>
                        <View style={styles.infoRow}>
                            <Text style={[styles.infoLabel, { color: pal.colors.text.secondary }]}>
                                {t('archive.species')}
                            </Text>
                            <Text style={[styles.infoValue, { color: pal.colors.text.primary }]}>
                                {entry.birdType || t('archive.unknown_bird')}
                            </Text>
                        </View>

                        <View style={styles.infoRow}>
                            <Text style={[styles.infoLabel, { color: pal.colors.text.secondary }]}>
                                {t('archive.date_time')}
                            </Text>
                            <Text style={[styles.infoValue, { color: pal.colors.text.primary }]}>
                                {new Date(entry.date).toLocaleString()}
                            </Text>
                        </View>

                        {entry.textNote && (
                            <View style={styles.infoRow}>
                                <Text style={[styles.infoLabel, { color: pal.colors.text.secondary }]}>
                                    {t('archive.notes')}
                                </Text>
                                <Text style={[styles.infoValue, styles.noteText, { color: pal.colors.text.primary }]}>
                                    {entry.textNote}
                                </Text>
                            </View>
                        )}

                        {entry.latinBirDex && (
                            <View style={styles.infoRow}>
                                <Text style={[styles.infoLabel, { color: pal.colors.text.secondary }]}>
                                    {t('archive.latin_name')}
                                </Text>
                                <Text style={[styles.infoValue, styles.latinText, { color: pal.colors.accent }]}>
                                    {entry.latinBirDex}
                                </Text>
                            </View>
                        )}
                    </View>
                ))}

                {/* Location Section */}
                {(entry.gpsLat && entry.gpsLng) && renderInfoCard(t('archive.location'), 'map-pin', (
                    <View style={styles.locationSection}>
                        <View style={styles.coordinatesContainer}>
                            <Text style={[styles.coordinatesText, { color: pal.colors.text.primary }]}>
                                {entry.gpsLat.toFixed(6)}, {entry.gpsLng.toFixed(6)}
                            </Text>
                            <Pressable
                                style={({ pressed }) => [
                                    styles.mapButton,
                                    { backgroundColor: pal.colors.primary },
                                    theme.shadows.sm,
                                    pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] }
                                ]}
                                onPress={openLocation}
                                android_ripple={null}
                            >
                                <Feather name="external-link" size={16} color={pal.colors.text.primary} />
                                <Text style={[styles.mapButtonText, { color: pal.colors.text.primary }]}>
                                    {t('archive.view_on_map')}
                                </Text>
                            </Pressable>
                        </View>
                    </View>
                ))}

                {/* AI Predictions */}
                {(entry.imagePrediction || entry.audioPrediction) && renderInfoCard(t('archive.ai_analysis'), 'cpu', (
                    <View style={styles.infoGrid}>
                        {entry.imagePrediction && (
                            <View style={styles.infoRow}>
                                <Text style={[styles.infoLabel, { color: pal.colors.text.secondary }]}>
                                    {t('archive.image_ai')}



                                </Text>
                                <View style={styles.predictionContainer}>
                                    <Feather name="camera" size={14} color={pal.colors.accent} />
                                    <Text style={[styles.predictionText, { color: pal.colors.text.primary }]}>
                                        {entry.imagePrediction}
                                    </Text>
                                </View>
                            </View>
                        )}

                        {entry.audioPrediction && (
                            <View style={styles.infoRow}>
                                <Text style={[styles.infoLabel, { color: pal.colors.text.secondary }]}>
                                    {t('archive.audio_ai')}
                                </Text>
                                <View style={styles.predictionContainer}>
                                    <Feather name="mic" size={14} color={pal.colors.accent} />
                                    <Text style={[styles.predictionText, { color: pal.colors.text.primary }]}>
                                        {entry.audioPrediction}
                                    </Text>
                                </View>
                            </View>
                        )}
                    </View>
                ))}

                {/* Technical Details */}
                {renderInfoCard(t('archive.technical'), 'database', (
                    <View style={styles.infoGrid}>
                        <View style={styles.infoRow}>
                            <Text style={[styles.infoLabel, { color: pal.colors.text.secondary }]}>
                                {t('archive.entry_id')}
                            </Text>
                            <Text style={[styles.infoValue, styles.technicalText, { color: pal.colors.text.primary }]}>
                                #{entry.id}
                            </Text>
                        </View>

                        <View style={styles.infoRow}>
                            <Text style={[styles.infoLabel, { color: pal.colors.text.secondary }]}>
                                {t('archive.sync_status')}
                            </Text>
                            <View style={styles.syncStatusContainer}>
                                <Feather
                                    name={entry.synced ? "check-circle" : "upload-cloud"}
                                    size={16}
                                    color={entry.synced ? pal.colors.primary : pal.colors.text.secondary}
                                />
                                <Text style={[styles.infoValue, { color: pal.colors.text.primary }]}>
                                    {entry.synced ? t('archive.synced') : t('archive.local_only')}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.infoRow}>
                            <Text style={[styles.infoLabel, { color: pal.colors.text.secondary }]}>
                                {t('archive.created')}
                            </Text>
                            <Text style={[styles.infoValue, styles.technicalText, { color: pal.colors.text.primary }]}>
                                {new Date(entry.date).toLocaleDateString()}
                            </Text>
                        </View>

                        {(entry.imageUri || entry.videoUri || entry.audioUri) && (
                            <View style={styles.infoRow}>
                                <Text style={[styles.infoLabel, { color: pal.colors.text.secondary }]}>
                                    {t('archive.has_media')}
                                </Text>
                                <View style={styles.mediaIndicators}>
                                    {entry.imageUri && <Feather name="image" size={16} color={pal.colors.primary} />}
                                    {entry.videoUri && <Feather name="video" size={16} color={pal.colors.primary} />}
                                    {entry.audioUri && <Feather name="mic" size={16} color={pal.colors.primary} />}
                                </View>
                            </View>
                        )}
                    </View>
                ))}
            </ScrollView>
        </View>
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
        fontSize: theme.typography.body.fontSize,
        marginTop: theme.spacing.md,
        textAlign: 'center',
    },
    errorText: {
        fontSize: 18,
        fontWeight: '500',
        marginTop: theme.spacing.md,
        textAlign: 'center',
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
        width: 44,
        height: 44,
        borderRadius: theme.borderRadius.md,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 4,
        ...theme.shadows.sm,
    },
    headerInfo: {
        flex: 1,
    },
    headerTitle: {
        fontSize: theme.typography.h2.fontSize,
        fontWeight: theme.typography.h2.fontWeight as any,
        lineHeight: 30,
        marginBottom: 4,
    },
    headerDate: {
        fontSize: theme.typography.small.fontSize,
    },
    shareButton: {
        width: 44,
        height: 44,
        borderRadius: theme.borderRadius.md,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 4,
        ...theme.shadows.sm,
    },

    // Scroll View
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: theme.spacing.md,
        paddingBottom: theme.spacing.xxl,
    },

    // Cards
    mediaCard: {
        marginBottom: theme.spacing.lg,
        borderRadius: theme.borderRadius.lg,
        borderWidth: 1,
        overflow: 'hidden',
        ...theme.shadows.sm,
    },
    infoCard: {
        marginBottom: theme.spacing.lg,
        borderRadius: theme.borderRadius.lg,
        borderWidth: 1,
        overflow: 'hidden',
        ...theme.shadows.sm,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.md,
        gap: theme.spacing.sm,
        borderBottomWidth: 1,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '600',
    },
    cardContent: {
        padding: theme.spacing.md,
    },

    // Media Section
    mediaContainer: {
        padding: theme.spacing.md,
        gap: theme.spacing.md,
    },
    mediaItem: {
        position: 'relative',
        borderRadius: theme.borderRadius.md,
        overflow: 'hidden',
        ...theme.shadows.sm,
    },
    mediaImage: {
        width: '100%',
        height: 200,
        resizeMode: 'cover',
    },
    mediaOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    videoOverlay: {
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    audioButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: theme.spacing.md,
        borderRadius: theme.borderRadius.md,
        gap: theme.spacing.sm,
        ...theme.shadows.sm,
    },
    audioButtonText: {
        fontSize: theme.typography.body.fontSize,
        fontWeight: '600',
    },

    // Info Sections
    infoGrid: {
        gap: theme.spacing.md,
    },
    infoRow: {
        gap: theme.spacing.sm,
    },
    infoLabel: {
        fontSize: theme.typography.small.fontSize,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    infoValue: {
        fontSize: theme.typography.body.fontSize,
        lineHeight: 22,
    },
    noteText: {
        lineHeight: 24,
    },
    technicalText: {
        fontFamily: 'monospace',
        fontSize: theme.typography.small.fontSize,
    },
    latinText: {
        fontStyle: 'italic',
        fontSize: theme.typography.body.fontSize,
    },

    // Location Section
    locationSection: {
        gap: theme.spacing.md,
    },
    coordinatesContainer: {
        gap: theme.spacing.sm,
    },
    coordinatesText: {
        fontSize: theme.typography.body.fontSize,
        fontFamily: 'monospace',
    },
    mapButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.borderRadius.md,
        gap: theme.spacing.sm,
        alignSelf: 'flex-start',
    },
    mapButtonText: {
        fontSize: theme.typography.small.fontSize,
        fontWeight: '600',
    },

    // AI Predictions
    predictionContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
    },
    predictionText: {
        fontSize: theme.typography.body.fontSize,
        flex: 1,
    },

    // Sync Status
    syncStatusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
    },

    // Media Indicators
    mediaIndicators: {
        flexDirection: 'row',
        gap: theme.spacing.sm,
    },
});