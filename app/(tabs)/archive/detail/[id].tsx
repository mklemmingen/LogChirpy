import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Linking,
    Pressable,
    ScrollView,
    Share,
    StyleSheet,
    View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import * as MediaLibrary from 'expo-media-library';
import * as Haptics from 'expo-haptics';

import { type BirdSpotting, getSpottingById } from '@/services/database';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ThemedPressable } from '@/components/ThemedPressable';
import { ThemedIcon } from '@/components/ThemedIcon';
import { useColors } from '@/hooks/useThemeColor';

// Safe text rendering helper
const safeText = (value: any, fallback: string = ' '): string => {
    if (value === null || value === undefined) return fallback;
    if (typeof value === 'string' && value.trim() === '') return fallback;
    try {
        const result = String(value);
        return typeof result === 'string' ? result : fallback;
    } catch {
        return fallback;
    }
};

// Safe date formatting
const safeDate = (dateString: any, fallback: string = 'Unknown date'): string => {
    try {
        if (!dateString) return fallback;
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return fallback;
        return date.toLocaleDateString();
    } catch {
        return fallback;
    }
};

// Safe number formatting
const safeNumber = (num: any, decimals: number = 0, fallback: string = '0'): string => {
    try {
        if (num === null || num === undefined || isNaN(Number(num))) return fallback;
        const result = Number(num).toFixed(decimals);
        return result || fallback;
    } catch {
        return fallback;
    }
};

// Safe translation helper
const safeTranslate = (t: any, key: string, fallback: string): string => {
    try {
        const result = t(key);
        if (typeof result === 'string' && result.trim() !== '') {
            return result;
        }
        return fallback;
    } catch {
        return fallback;
    }
};

// Info Row Component with complete null safety
interface InfoRowProps {
    label: string;
    value: any;
    icon?: string;
    onPress?: () => void;
    style?: any;
}

function InfoRow({ label, value, icon, onPress, style }: InfoRowProps) {
    const colors = useColors();
    const displayValue = safeText(value, ' ');
    const displayLabel = safeText(label, ' ');
    
    // Additional safety check
    if (typeof displayValue !== 'string' || typeof displayLabel !== 'string') {
        console.warn('InfoRow received non-string values:', { label, value, displayLabel, displayValue });
        return null;
    }

    const content = (
        <>
            <ThemedText variant="caption" style={[styles.infoLabel, { color: colors.textSecondary }]}>
                {displayLabel}
            </ThemedText>
            <View style={styles.infoValueContainer}>
                {icon && (
                    <ThemedIcon name={icon as any} size={14} color="secondary" style={styles.infoIcon} />
                )}
                <ThemedText variant="body" style={[styles.infoValue, style]}>
                    {displayValue}
                </ThemedText>
                {onPress && (
                    <ThemedIcon name="external-link" size={12} color="tertiary" />
                )}
            </View>
        </>
    );

    if (onPress) {
        return (
            <ThemedPressable
                variant="ghost"
                style={styles.pressableInfoRow}
                onPress={onPress}
            >
                {content}
            </ThemedPressable>
        );
    }

    return <View style={styles.infoRow}>{content}</View>;
}

// Section Component
interface SectionProps {
    title: string;
    icon: string;
    children: React.ReactNode;
}

function Section({ title, icon, children }: SectionProps) {
    const colors = useColors();
    
    // Debug logging for section rendering
    console.log('[Section Debug] Rendering section:', { title, icon, hasChildren: !!children });
    
    const safeTitle = safeText(title, 'Section');
    const safeIcon = safeText(icon, 'info');
    
    // Additional validation
    if (typeof safeTitle !== 'string') {
        console.error('[Section Error] Invalid title:', { title, safeTitle });
        return null;
    }

    return (
        <View style={[styles.section, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
                <ThemedIcon name={safeIcon as any} size={20} color="primary" />
                <ThemedText variant="h3" style={styles.sectionTitle}>
                    {safeTitle}
                </ThemedText>
            </View>
            <View style={styles.sectionContent}>
                {children}
            </View>
        </View>
    );
}

// Media Component
interface MediaSectionProps {
    entry: BirdSpotting;
    onImagePress?: (uri: string) => void;
    onAudioPress?: (uri: string) => void;
}

function MediaSection({ entry, onImagePress, onAudioPress }: MediaSectionProps) {
    const { t } = useTranslation();
    const colors = useColors();
    const [audioLoading, setAudioLoading] = useState(false);

    const handleAudioPlay = useCallback(async () => {
        if (!entry.audioUri || !onAudioPress) return;

        try {
            setAudioLoading(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onAudioPress(entry.audioUri);
        } catch (error) {
            console.error('Audio play error:', error);
            Alert.alert(safeText(t('common.error') || 'Error'), 'Failed to play audio');
        } finally {
            setAudioLoading(false);
        }
    }, [entry.audioUri, onAudioPress, t]);

    const hasMedia = !!(entry.imageUri || entry.videoUri || entry.audioUri);

    if (!hasMedia) return null;

    return (
        <Section title={safeText(t('archive.media') || 'Media')} icon="camera">
            <View style={styles.mediaContainer}>
                {/* Image */}
                {entry.imageUri && (
                    <Pressable
                        style={styles.mediaItem}
                        onPress={() => onImagePress?.(entry.imageUri!)}
                    >
                        <Image
                            source={{ uri: entry.imageUri }}
                            style={styles.mediaImage}
                            resizeMode="cover"
                            onError={(error) => {
                                console.warn('Image load error:', error);
                            }}
                        />
                        <View style={[styles.mediaOverlay, { backgroundColor: 'rgba(0,0,0,0.3)' }]}>
                            <ThemedIcon name="maximize-2" size={20} color="primary" />
                        </View>
                    </Pressable>
                )}

                {/* Video */}
                {entry.videoUri && (
                    <Pressable style={styles.mediaItem}>
                        <Image
                            source={{ uri: entry.videoUri }}
                            style={styles.mediaImage}
                            resizeMode="cover"
                        />
                        <View style={[styles.mediaOverlay, { backgroundColor: 'rgba(0,0,0,0.3)' }]}>
                            <ThemedIcon name="play" size={24} color="primary" />
                        </View>
                    </Pressable>
                )}

                {/* Audio */}
                {entry.audioUri && (
                    <ThemedPressable
                        variant="primary"
                        style={styles.audioButton}
                        onPress={handleAudioPlay}
                        disabled={audioLoading}
                    >
                        {audioLoading ? (
                            <ActivityIndicator size="small" color={colors.textInverse} />
                        ) : (
                            <ThemedIcon name="play" size={18} color="inverse" />
                        )}
                        <ThemedText variant="button" style={{ color: colors.textInverse }}>
                            {safeText(t('archive.play_audio') || 'Play Audio')}
                        </ThemedText>
                    </ThemedPressable>
                )}
            </View>
        </Section>
    );
}

// Main Component
export default function ArchiveDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { t } = useTranslation();
    const router = useRouter();
    const colors = useColors();
    const insets = useSafeAreaInsets();

    const [entry, setEntry] = useState<BirdSpotting | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentSound, setCurrentSound] = useState<Audio.Sound | null>(null);

    // Load spotting data
    useEffect(() => {
        const loadSpotting = async () => {
            try {
                console.log('[Archive Detail] Loading spotting with ID:', id);
                setLoading(true);
                setError(null);

                if (!id) {
                    throw new Error('No ID provided');
                }

                const numericId = parseInt(id, 10);
                if (isNaN(numericId)) {
                    throw new Error('Invalid ID format');
                }

                console.log('[Archive Detail] Fetching data for ID:', numericId);
                const data = getSpottingById(numericId);
                if (!data) {
                    throw new Error('Entry not found');
                }

                console.log('[Archive Detail] Loaded data:', {
                    id: data.id,
                    birdType: data.birdType,
                    hasImageUri: !!data.imageUri,
                    hasAudioUri: !!data.audioUri,
                    hasTextNote: !!data.textNote,
                    date: data.date,
                    gpsLat: data.gpsLat,
                    gpsLng: data.gpsLng,
                    synced: data.synced
                });

                setEntry(data);
            } catch (err) {
                console.error('[Archive Detail] Load spotting error:', err);
                const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
                setError(errorMessage);
            } finally {
                setLoading(false);
            }
        };

        loadSpotting();
    }, [id]);

    // Cleanup audio on unmount
    useEffect(() => {
        return () => {
            if (currentSound) {
                currentSound.unloadAsync().catch(console.warn);
            }
        };
    }, [currentSound]);

    // Navigation and actions
    const handleBack = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.back();
    }, [router]);

    const handleShare = useCallback(async () => {
        if (!entry) return;

        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

            const message = [
                `Bird Spotting: ${safeText(entry.birdType, 'Unknown bird')}`,
                `Date: ${safeDate(entry.date)}`,
                (entry.gpsLat !== null && entry.gpsLat !== undefined && entry.gpsLng !== null && entry.gpsLng !== undefined)
                    ? `Location: ${safeNumber(entry.gpsLat, 6)}, ${safeNumber(entry.gpsLng, 6)}`
                    : null,
                entry.textNote ? `Notes: ${safeText(entry.textNote)}` : null
            ].filter(Boolean).join('\n');

            await Share.share({
                message,
                title: 'Bird Spotting Details'
            });
        } catch (error) {
            console.error('Share error:', error);
            Alert.alert(safeText(t('common.error') || 'Error'), 'Failed to share');
        }
    }, [entry, t]);

    const handleLocationPress = useCallback(() => {
        if (!entry?.gpsLat || !entry?.gpsLng) return;

        const url = `https://maps.google.com/?q=${entry.gpsLat},${entry.gpsLng}`;
        Linking.openURL(url).catch((error) => {
            console.error('Failed to open maps:', error);
        });
    }, [entry]);

    const handleImagePress = useCallback(async (uri: string) => {
        try {
            const { status } = await MediaLibrary.requestPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission needed', 'Permission required to save images');
                return;
            }

            await MediaLibrary.saveToLibraryAsync(uri);
            Alert.alert('Success', 'Image saved to gallery');
        } catch (error) {
            console.error('Save image error:', error);
            Alert.alert('Error', 'Failed to save image');
        }
    }, []);

    const handleAudioPress = useCallback(async (uri: string) => {
        try {
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
                    sound.unloadAsync().catch(console.warn);
                    setCurrentSound(null);
                }
            });
        } catch (error) {
            console.error('Audio playback error:', error);
            Alert.alert('Error', 'Failed to play audio');
        }
    }, [currentSound]);

    // Loading state
    if (loading) {
        return (
            <ThemedView style={styles.centerContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <ThemedText variant="body" style={styles.centerText}>
                    {safeText(t('common.loading') || 'Loading...')}
                </ThemedText>
            </ThemedView>
        );
    }

    // Error state
    if (error || !entry) {
        return (
            <ThemedView style={styles.centerContainer}>
                <ThemedIcon name="alert-triangle" size={48} color="error" />
                <ThemedText variant="h2" style={styles.centerText}>
                    {safeText(error || t('common.error') || 'Entry not found')}
                </ThemedText>
                <ThemedPressable
                    variant="primary"
                    style={styles.backButton}
                    onPress={handleBack}
                >
                    <ThemedText variant="button">
                        {safeText(t('common.back') || 'Back')}
                    </ThemedText>
                </ThemedPressable>
            </ThemedView>
        );
    }

    // Additional validation before rendering
    console.log('[Archive Detail] About to render entry:', entry);
    
    if (!entry) {
        console.error('[Archive Detail] Entry is null/undefined');
        return (
            <ThemedView style={styles.centerContainer}>
                <ThemedIcon name="alert-triangle" size={48} color="error" />
                <ThemedText variant="h2" style={styles.centerText}>
                    Entry not found
                </ThemedText>
                <ThemedPressable
                    variant="primary"
                    style={styles.backButton}
                    onPress={handleBack}
                >
                    <ThemedText variant="button">
                        Back
                    </ThemedText>
                </ThemedPressable>
            </ThemedView>
        );
    }

    return (
        <ThemedView style={styles.container}>
            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
                <ThemedPressable
                    variant="secondary"
                    size="sm"
                    onPress={handleBack}
                    style={styles.headerButton}
                >
                    <ThemedIcon name="arrow-left" size={20} color="primary" />
                </ThemedPressable>

                <View style={styles.headerInfo}>
                    <ThemedText variant="h2" style={styles.headerTitle} numberOfLines={2}>
                        {safeText(entry.birdType, t('archive.unknown_bird') || 'Unknown Bird')}
                    </ThemedText>
                    <ThemedText variant="caption" style={styles.headerDate}>
                        {safeDate(entry.date)}
                    </ThemedText>
                </View>

                <ThemedPressable
                    variant="ghost"
                    size="sm"
                    onPress={handleShare}
                    style={styles.headerButton}
                >
                    <ThemedIcon name="share" size={18} color="primary" />
                </ThemedPressable>
            </View>

            {/* Content */}
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Media Section */}
                <MediaSection
                    entry={entry}
                    onImagePress={handleImagePress}
                    onAudioPress={handleAudioPress}
                />

                {/* Basic Information */}
                <Section title={safeText(t('archive.details') || 'Details')} icon="info">
                    <InfoRow
                        label={safeText(t('archive.species') || 'Species')}
                        value={safeText(entry.birdType, t('archive.unknown_bird') || 'Unknown Bird')}
                    />
                    <InfoRow
                        label={safeText(t('archive.date_time') || 'Date & Time')}
                        value={safeDate(entry.date)}
                    />
                    {entry.textNote && (
                        <InfoRow
                            label={safeText(t('archive.notes') || 'Notes')}
                            value={safeText(entry.textNote)}
                            style={styles.noteText}
                        />
                    )}
                    {entry.latinBirDex && (
                        <InfoRow
                            label={safeText(t('archive.latin_name') || 'Latin Name')}
                            value={safeText(entry.latinBirDex)}
                            style={styles.latinText}
                        />
                    )}
                </Section>

                {/* Location Section */}
                {(entry.gpsLat !== null && entry.gpsLat !== undefined && entry.gpsLng !== null && entry.gpsLng !== undefined) && (
                    <Section title={safeText(t('archive.location') || 'Location')} icon="map-pin">
                        <InfoRow
                            label={safeText(t('archive.coordinates') || 'Coordinates')}
                            value={`${safeNumber(entry.gpsLat, 6)}, ${safeNumber(entry.gpsLng, 6)}`}
                            icon="map-pin"
                            onPress={handleLocationPress}
                            style={styles.coordinatesText}
                        />
                    </Section>
                )}

                {/* AI Predictions */}
                {(entry.imagePrediction || entry.audioPrediction) && (
                    <Section title={safeText(t('archive.ai_analysis') || 'AI Analysis')} icon="cpu">
                        {entry.imagePrediction && (
                            <InfoRow
                                label={safeText(t('archive.image_ai') || 'Image AI')}
                                value={safeText(entry.imagePrediction)}
                                icon="camera"
                            />
                        )}
                        {entry.audioPrediction && (
                            <InfoRow
                                label={safeText(t('archive.audio_ai') || 'Audio AI')}
                                value={safeText(entry.audioPrediction)}
                                icon="mic"
                            />
                        )}
                    </Section>
                )}

                {/* Technical Details */}
                <Section title={safeText(t('archive.technical') || 'Technical')} icon="database">
                    <InfoRow
                        label={safeText(t('archive.entry_id') || 'Entry ID')}
                        value={`#${safeText(entry.id?.toString(), 'unknown')}`}
                        style={styles.technicalText}
                    />
                    <InfoRow
                        label={safeText(t('archive.sync_status') || 'Sync Status')}
                        value={entry.synced ? safeText(t('archive.synced') || 'Synced') : safeText(t('archive.local_only') || 'Local Only')}
                        icon={entry.synced ? "check-circle" : "upload-cloud"}
                    />
                    <InfoRow
                        label={safeText(t('archive.created') || 'Created')}
                        value={safeDate(entry.date)}
                        style={styles.technicalText}
                    />
                </Section>
            </ScrollView>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        gap: 16,
    },
    centerText: {
        textAlign: 'center',
    },
    backButton: {
        marginTop: 16,
    },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingHorizontal: 20,
        paddingBottom: 16,
        gap: 16,
    },
    headerButton: {
        minWidth: 44,
        minHeight: 44,
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
        opacity: 0.7,
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
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
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
        gap: 12,
    },

    // Info Rows
    infoRow: {
        gap: 4,
        paddingVertical: 8,
    },
    pressableInfoRow: {
        gap: 4,
        paddingVertical: 8,
        paddingHorizontal: 8,
        marginHorizontal: -8,
        borderRadius: 8,
    },
    infoLabel: {
        textTransform: 'uppercase',
        fontWeight: '600',
        letterSpacing: 0.5,
        fontSize: 11,
    },
    infoValueContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
    },
    infoIcon: {
        marginRight: 4,
    },
    infoValue: {
        flex: 1,
        lineHeight: 20,
    },
    noteText: {
        lineHeight: 22,
    },
    latinText: {
        fontStyle: 'italic',
        opacity: 0.8,
    },
    technicalText: {
        fontFamily: 'monospace',
        fontSize: 13,
    },
    coordinatesText: {
        fontFamily: 'monospace',
        fontSize: 13,
    },

    // Media
    mediaContainer: {
        gap: 12,
    },
    mediaItem: {
        borderRadius: 8,
        overflow: 'hidden',
        position: 'relative',
    },
    mediaImage: {
        width: '100%',
        height: 200,
        backgroundColor: '#f0f0f0',
    },
    mediaOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
    },
    audioButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        borderRadius: 8,
    },
});