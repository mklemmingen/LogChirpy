import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
    ActivityIndicator,
    Alert,
    BackHandler,
    Dimensions,
    Image,
    Linking,
    Modal,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    TextInput,
    useColorScheme,
    View,
} from 'react-native';
import {router, Stack, useFocusEffect, useLocalSearchParams} from 'expo-router';
import {useTranslation} from 'react-i18next';
import {Audio} from 'expo-av';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import DateTimePicker from '@react-native-community/datetimepicker';
import {Feather} from '@expo/vector-icons';
import {BlurView} from 'expo-blur';

import {useLogDraft} from '../context/LogDraftContext';
import {BirdSpotting, insertBirdSpotting} from '@/services/database';
import {useVideoPlayer, VideoSource, VideoView} from 'expo-video';

// Modern components
import {ThemedView} from '@/components/ThemedView';
import {ThemedText} from '@/components/ThemedText';
import {PrimaryButton, ThemedPressable} from '@/components/ThemedPressable';
import {ModernCard} from '@/components/ModernCard';
import {useSnackbar} from '@/components/ThemedSnackbar';
import {GlassSection} from '@/components/Section';

// Theme hooks
import {useColorVariants, useSemanticColors, useTheme, useTypography,} from '@/hooks/useThemeColor';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ValidationError {
    field: string;
    message: string;
}

export default function EnhancedManual() {
    const params = useLocalSearchParams();
    const { t } = useTranslation();
    const { draft, update, clear } = useLogDraft();
    const colorScheme = useColorScheme() ?? 'light';

    // Theme system
    const theme = useTheme();
    const semanticColors = useSemanticColors();
    const typography = useTypography();
    const variants = useColorVariants();
    const { SnackbarComponent, showSuccess, showError } = useSnackbar();

    // State management
    const [isSaving, setIsSaving] = useState(false);
    const [isLoadingLocation, setIsLoadingLocation] = useState(false);
    const [sound, setSound] = useState<Audio.Sound | null>(null);
    const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

    // Modal states
    const [isVideoModalVisible, setIsVideoModalVisible] = useState(false);
    const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date());

    // Video players
    const previewPlayer = useVideoPlayer((draft.videoUri || '') as VideoSource, (player) => {
        if (draft.videoUri) {
            player.loop = true;
            player.muted = true;
            if (!isVideoModalVisible) {
                player.play();
            }
        }
    });

    const fullscreenPlayer = useVideoPlayer((draft.videoUri || '') as VideoSource, (player) => {
        if (draft.videoUri) {
            player.loop = false;
            player.muted = false;
            if (isVideoModalVisible) {
                player.play();
            }
        }
    });

    // Handle incoming media from navigation params
    useEffect(() => {
        const updates: Partial<BirdSpotting> = {};

        if (params.audioUri && params.audioUri !== draft.audioUri) {
            updates.audioUri = params.audioUri as string;
        }
        if (params.imageUri && params.imageUri !== draft.imageUri) {
            updates.imageUri = params.imageUri as string;
        }
        if (params.videoUri && params.videoUri !== draft.videoUri) {
            updates.videoUri = params.videoUri as string;
        }

        if (Object.keys(updates).length > 0) {
            update(updates);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
    }, [params, draft, update]);

    // Video modal management
    useEffect(() => {
        if (isVideoModalVisible && draft.videoUri) {
            previewPlayer.pause();
            fullscreenPlayer.play();
        } else if (draft.videoUri) {
            fullscreenPlayer.pause();
            previewPlayer.play();
        }
    }, [isVideoModalVisible, draft.videoUri, previewPlayer, fullscreenPlayer]);

    // Navigation guard for unsaved changes
    useFocusEffect(
        useCallback(() => {
            const hasUnsavedChanges = Object.values(draft).some(value =>
                value && (typeof value === 'string' ? value.trim() : true)
            );

            if (!hasUnsavedChanges) return;

            const onBackPress = () => {
                Alert.alert(
                    t('navigation.unsaved_changes'),
                    t('navigation.lose_changes_message'),
                    [
                        { text: t('common.cancel'), style: 'cancel' },
                        {
                            text: t('navigation.discard'),
                            style: 'destructive',
                            onPress: () => {
                                clear();
                                router.back();
                            }
                        },
                    ]
                );
                return true;
            };

            const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
            return () => subscription.remove();
        }, [draft, clear, t])
    );

    // Cleanup audio on unmount
    useEffect(() => {
        return () => {
            if (sound) {
                sound.unloadAsync();
            }
        };
    }, [sound]);

    // Validation logic
    const validateEntry = useCallback((): ValidationError[] => {
        const errors: ValidationError[] = [];

        if (!draft.birdType?.trim()) {
            errors.push({
                field: 'birdType',
                message: t('validation.bird_type_required')
            });
        }

        const hasMedia = draft.imageUri || draft.videoUri || draft.audioUri;
        const hasNotes = draft.textNote?.trim();

        if (!hasMedia && !hasNotes) {
            errors.push({
                field: 'media',
                message: t('validation.media_or_notes_required')
            });
        }

        return errors;
    }, [draft, t]);

    // Progress calculation
    const completionPercentage = useMemo(() => {
        const totalFields: (keyof BirdSpotting)[] = ['birdType', 'textNote', 'imageUri', 'videoUri', 'audioUri'];
        const completedFields = totalFields.filter(field => {
            const value = draft[field as keyof typeof draft];
            return value && (typeof value === 'string' ? value.trim() : true);
        });
        return Math.round((completedFields.length / totalFields.length) * 100);
    }, [draft]);

    // Media handling functions
    const handlePlayAudio = useCallback(async () => {
        if (!draft.audioUri) return;

        try {
            if (sound) {
                await sound.unloadAsync();
                setSound(null);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } else {
                const { sound: newSound } = await Audio.Sound.createAsync(
                    { uri: draft.audioUri },
                    { shouldPlay: true }
                );
                setSound(newSound);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

                newSound.setOnPlaybackStatusUpdate((status) => {
                    if (status.isLoaded && 'didJustFinish' in status && status.didJustFinish) {
                        setSound(null);
                    }
                });
            }
        } catch (error) {
            console.error('Audio playback error:', error);
            showError(t('audio.playback_failed'));
        }
    }, [draft.audioUri, sound, t, showError]);

    const handleGetLocation = useCallback(async () => {
        setIsLoadingLocation(true);

        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert(
                    t('errors.location_permission_title'),
                    t('errors.location_permission_message'),
                    [
                        { text: t('common.cancel') },
                        { text: t('common.settings'), onPress: () => Linking.openSettings() }
                    ]
                );
                return;
            }

            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
                timeInterval: 5000,
            });

            update({
                gpsLat: location.coords.latitude,
                gpsLng: location.coords.longitude,
            });

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            showSuccess(t('location.success'));
        } catch (error) {
            console.error('Location error:', error);
            showError(t('location.failed_to_get'));
        } finally {
            setIsLoadingLocation(false);
        }
    }, [update, t, showSuccess, showError]);

    const handleTextChange = useCallback((key: string, value: string) => {
        update({ [key]: value });
        setValidationErrors(prev => prev.filter(error => error.field !== key));
    }, [update]);

    const handleDateChange = useCallback((event: any, date?: Date) => {
        if (Platform.OS === 'android') {
            setIsDatePickerVisible(false);
        }

        if (date) {
            setSelectedDate(date);
            update({ date: date.toISOString() });
        }
    }, [update]);

    // Navigation handlers
    const handleMediaNavigation = useCallback((route: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push(route as any);
    }, []);

    // Save logic
    const performSave = useCallback(async () => {
        setIsSaving(true);

        try {
            const entryData: Omit<BirdSpotting, 'id' | 'synced'> = {
                imageUri: draft.imageUri || '',
                videoUri: draft.videoUri || '',
                audioUri: draft.audioUri || '',
                textNote: draft.textNote || '',
                gpsLat: draft.gpsLat || 0,
                gpsLng: draft.gpsLng || 0,
                date: draft.date || new Date().toISOString(),
                birdType: draft.birdType || '',
                imagePrediction: draft.imagePrediction || '',
                audioPrediction: draft.audioPrediction || '',
            };

            await insertBirdSpotting(entryData);

            clear();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            showSuccess(t('log.entry_saved_successfully'));

            router.replace('/(tabs)');
        } catch (error) {
            console.error('Save error:', error);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            showError(t('errors.save_failed_message'));
        } finally {
            setIsSaving(false);
        }
    }, [draft, clear, t, showSuccess, showError]);

    const handleSave = useCallback(async () => {
        const errors = validateEntry();
        setValidationErrors(errors);

        if (errors.length > 0) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            showError(errors.map(e => e.message).join('\n'));
            return;
        }

        const completion = completionPercentage;
        const confirmMessage = completion < 60
            ? t('log.save_confirmation_low_completion', { percentage: completion })
            : t('log.save_confirmation_message');

        Alert.alert(
            t('log.confirm_save'),
            confirmMessage,
            [
                { text: t('common.cancel'), style: 'cancel' },
                { text: t('common.save'), onPress: performSave },
            ]
        );
    }, [validateEntry, completionPercentage, performSave, t, showError]);

    // Media Cards Components
    const MediaSection = () => (
        <GlassSection title={t('log.media_section')} spacing="comfortable">
            <View style={styles.mediaGrid}>
                {/* Image Card */}
                <ModernCard
                    variant={draft.imageUri ? "primary" : "outlined"}
                    style={styles.mediaCard}
                    onPress={() => handleMediaNavigation('/log/photo')}
                    glowOnHover={!draft.imageUri}
                >
                    {draft.imageUri ? (
                        <Image source={{ uri: draft.imageUri }} style={styles.mediaPreview} />
                    ) : (
                        <View style={styles.addMediaContent}>
                            <Feather name="camera" size={32} color={semanticColors.primary} />
                            <ThemedText variant="labelLarge" color="primary">
                                {t('log.add_image')}
                            </ThemedText>
                        </View>
                    )}
                </ModernCard>

                {/* Video Card */}
                <ModernCard
                    variant={draft.videoUri ? "primary" : "outlined"}
                    style={styles.mediaCard}
                    onPress={() => draft.videoUri ? setIsVideoModalVisible(true) : handleMediaNavigation('/log/video')}
                    glowOnHover
                >
                    {draft.videoUri ? (
                        <>
                            {previewPlayer && (
                                <VideoView
                                    player={previewPlayer}
                                    style={styles.mediaPreview}
                                    contentFit="cover"
                                />
                            )}
                            <View style={styles.videoOverlay}>
                                <Feather name="play" size={24} color="#fff" />
                            </View>
                        </>
                    ) : (
                        <View style={styles.addMediaContent}>
                            <Feather name="video" size={32} color={semanticColors.primary} />
                            <ThemedText variant="labelLarge" color="primary">
                                {t('log.add_video')}
                            </ThemedText>
                        </View>
                    )}
                </ModernCard>

                {/* Audio Card */}
                <ModernCard
                    variant={draft.audioUri ? "primary" : "outlined"}
                    style={styles.mediaCard}
                    onPress={() => draft.audioUri ? handlePlayAudio() : handleMediaNavigation('/log/audio')}
                    glowOnHover
                >
                    <View style={styles.addMediaContent}>
                        <Feather
                            name={draft.audioUri ? (sound ? "pause" : "play") : "mic"}
                            size={32}
                            color={semanticColors.primary}
                        />
                        <ThemedText variant="labelLarge" color="primary">
                            {draft.audioUri
                                ? (sound ? t('log.playing') : t('log.tap_to_play'))
                                : t('log.add_audio')
                            }
                        </ThemedText>
                    </View>
                </ModernCard>
            </View>
        </GlassSection>
    );

    const DetailsSection = () => (
        <GlassSection title={t('log.details_section')} spacing="comfortable">
            <View style={styles.detailsGrid}>
                {/* Bird Type - Required */}
                <ModernCard
                    variant="filled"
                >
                    <View style={styles.inputContainer}>
                        <ThemedText variant="labelLarge" style={styles.inputLabel}>
                            {t('log.bird_type')} *
                        </ThemedText>
                        <TextInput
                            style={[styles.textInput, { color: semanticColors.text }]}
                            value={draft.birdType || ''}
                            onChangeText={(text) => handleTextChange('birdType', text)}
                            placeholder={t('log.bird_type_placeholder')}
                            placeholderTextColor={semanticColors.textSecondary}
                        />
                    </View>
                </ModernCard>

                {/* Notes */}
                <ModernCard variant="filled" style={styles.notesCard}>
                    <View style={styles.inputContainer}>
                        <ThemedText variant="labelLarge" style={styles.inputLabel}>
                            {t('log.notes')}
                        </ThemedText>
                        <TextInput
                            style={[styles.textInput, styles.notesInput, { color: semanticColors.text }]}
                            value={draft.textNote || ''}
                            onChangeText={(text) => handleTextChange('textNote', text)}
                            placeholder={t('log.notes_placeholder')}
                            placeholderTextColor={semanticColors.textSecondary}
                            multiline
                            textAlignVertical="top"
                        />
                    </View>
                </ModernCard>
            </View>
        </GlassSection>
    );

    const MetadataSection = () => (
        <GlassSection title={t('log.metadata_section')} spacing="comfortable">
            <View style={styles.metadataGrid}>
                {/* Date Card */}
                <ModernCard
                    variant="outlined"
                    style={styles.metadataCard}
                    onPress={() => {
                        setSelectedDate(draft.date ? new Date(draft.date) : new Date());
                        setIsDatePickerVisible(true);
                    }}
                >
                    <View style={styles.metadataContent}>
                        <Feather name="calendar" size={20} color={semanticColors.primary} />
                        <View style={styles.metadataText}>
                            <ThemedText variant="labelMedium" color="secondary">
                                {t('log.date')}
                            </ThemedText>
                            <ThemedText variant="bodyMedium">
                                {draft.date ? new Date(draft.date).toLocaleDateString() : new Date().toLocaleDateString()}
                            </ThemedText>
                        </View>
                    </View>
                </ModernCard>

                {/* Location Card */}
                <ModernCard
                    variant="outlined"
                    style={styles.metadataCard}
                    onPress={handleGetLocation}
                    disabled={isLoadingLocation}
                >
                    <View style={styles.metadataContent}>
                        {isLoadingLocation ? (
                            <ActivityIndicator size="small" color={semanticColors.primary} />
                        ) : (
                            <Feather name="map-pin" size={20} color={semanticColors.primary} />
                        )}
                        <View style={styles.metadataText}>
                            <ThemedText variant="labelMedium" color="secondary">
                                {t('log.location')}
                            </ThemedText>
                            <ThemedText variant="bodySmall" numberOfLines={2}>
                                {draft.gpsLat && draft.gpsLng
                                    ? `${draft.gpsLat.toFixed(6)}, ${draft.gpsLng.toFixed(6)}`
                                    : t('log.no_location')
                                }
                            </ThemedText>
                        </View>
                    </View>
                </ModernCard>
            </View>

            {/* Predictions */}
            {(draft.imagePrediction || draft.audioPrediction) && (
                <View style={styles.predictionsContainer}>
                    <ThemedText variant="labelLarge" style={styles.sectionSubtitle}>
                        {t('log.ai_predictions')}
                    </ThemedText>

                    {draft.imagePrediction && (
                        <ModernCard variant="accent" style={styles.predictionCard}>
                            <View style={styles.predictionContent}>
                                <Feather name="camera" size={16} color={semanticColors.accent} />
                                <ThemedText variant="bodySmall" style={styles.predictionText}>
                                    {draft.imagePrediction}
                                </ThemedText>
                            </View>
                        </ModernCard>
                    )}

                    {draft.audioPrediction && (
                        <ModernCard variant="accent" style={styles.predictionCard}>
                            <View style={styles.predictionContent}>
                                <Feather name="mic" size={16} color={semanticColors.accent} />
                                <ThemedText variant="bodySmall" style={styles.predictionText}>
                                    {draft.audioPrediction}
                                </ThemedText>
                            </View>
                        </ModernCard>
                    )}
                </View>
            )}
        </GlassSection>
    );

    return (
        <ThemedView style={styles.container}>
            <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
            <Stack.Screen options={{ headerShown: false }} />

            {/* Progress Header */}
            <ThemedView surface="elevated" style={styles.header}>
                <ThemedText variant="headlineMedium" style={styles.headerTitle}>
                    {t('log.manual_entry')}
                </ThemedText>

                <View style={styles.progressContainer}>
                    <ThemedText variant="labelMedium" color="secondary">
                        {completionPercentage}% {t('log.complete')}
                    </ThemedText>
                    <View style={[styles.progressBar, { backgroundColor: variants.primarySubtle }]}>
                        <View
                            style={[
                                styles.progressFill,
                                {
                                    backgroundColor: semanticColors.primary,
                                    width: `${completionPercentage}%`
                                }
                            ]}
                        />
                    </View>
                </View>
            </ThemedView>

            {/* Scrollable Content */}
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <MediaSection />
                <DetailsSection />
                <MetadataSection />

                {/* Bottom spacing for save button */}
                <View style={styles.bottomSpacer} />
            </ScrollView>

            {/* Save Button */}
            <ThemedView surface="elevated" style={styles.saveButtonContainer}>
                <PrimaryButton
                    onPress={handleSave}
                    disabled={isSaving}
                    size="large"
                    fullWidth
                    style={styles.saveButton}
                >
                    {isSaving ? (
                        <ActivityIndicator size="small" color={semanticColors.onPrimary} />
                    ) : (
                        <Feather name="save" size={20} color={semanticColors.onPrimary} />
                    )}
                    <ThemedText variant="labelLarge" style={{ color: semanticColors.onPrimary }}>
                        {isSaving ? t('common.saving') : t('common.save')}
                    </ThemedText>
                </PrimaryButton>
            </ThemedView>

            {/* Date Picker Modal */}
            {isDatePickerVisible && (
                <Modal
                    transparent
                    animationType="slide"
                    visible={isDatePickerVisible}
                    onRequestClose={() => setIsDatePickerVisible(false)}
                >
                    <BlurView intensity={80} style={styles.modalContainer}>
                        <ModernCard variant="glass" style={styles.datePickerCard}>
                            <ThemedText variant="headlineSmall" style={styles.modalTitle}>
                                {t('log.select_date')}
                            </ThemedText>
                            <DateTimePicker
                                value={selectedDate}
                                mode="date"
                                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                onChange={handleDateChange}
                                maximumDate={new Date()}
                            />
                            {Platform.OS === 'ios' && (
                                <View style={styles.datePickerButtons}>
                                    <ThemedPressable
                                        variant="secondary"
                                        onPress={() => setIsDatePickerVisible(false)}
                                        style={styles.dateButton}
                                    >
                                        <ThemedText variant="labelLarge">
                                            {t('common.cancel')}
                                        </ThemedText>
                                    </ThemedPressable>
                                    <ThemedPressable
                                        variant="primary"
                                        onPress={() => {
                                            handleDateChange(null, selectedDate);
                                            setIsDatePickerVisible(false);
                                        }}
                                        style={styles.dateButton}
                                    >
                                        <ThemedText variant="labelLarge" style={{ color: semanticColors.onPrimary }}>
                                            {t('common.confirm')}
                                        </ThemedText>
                                    </ThemedPressable>
                                </View>
                            )}
                        </ModernCard>
                    </BlurView>
                </Modal>
            )}

            {/* Video Modal */}
            <Modal
                visible={isVideoModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setIsVideoModalVisible(false)}
            >
                <View style={styles.videoModalContainer}>
                    {fullscreenPlayer && (
                        <VideoView
                            player={fullscreenPlayer}
                            style={styles.fullscreenVideo}
                            contentFit="contain"
                            nativeControls
                        />
                    )}
                    <View style={styles.videoModalControls}>
                        <ThemedPressable
                            variant="secondary"
                            onPress={() => setIsVideoModalVisible(false)}
                            style={styles.videoButton}
                        >
                            <Feather name="x" size={20} color={semanticColors.text} />
                            <ThemedText variant="labelLarge">
                                {t('common.close')}
                            </ThemedText>
                        </ThemedPressable>
                        <ThemedPressable
                            variant="primary"
                            onPress={() => {
                                setIsVideoModalVisible(false);
                                handleMediaNavigation('/log/video');
                            }}
                            style={styles.videoButton}
                        >
                            <Feather name="refresh-cw" size={20} color={semanticColors.onPrimary} />
                            <ThemedText variant="labelLarge" style={{ color: semanticColors.onPrimary }}>
                                {t('camera.retake')}
                            </ThemedText>
                        </ThemedPressable>
                    </View>
                </View>
            </Modal>

            <SnackbarComponent />
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    headerTitle: {
        fontWeight: '700',
        marginBottom: 12,
    },
    progressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    progressBar: {
        flex: 1,
        height: 6,
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 3,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
        gap: 24,
    },
    bottomSpacer: {
        height: 100,
    },

    // Media Section
    mediaGrid: {
        gap: 16,
    },
    mediaCard: {
        height: 120,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    mediaPreview: {
        width: '100%',
        height: '100%',
    },
    addMediaContent: {
        alignItems: 'center',
        gap: 12,
        padding: 20,
    },
    videoOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.3)',
    },

    // Details Section
    detailsGrid: {
        gap: 16,
    },
    inputCard: {
        padding: 0,
        overflow: 'hidden',
    },
    notesCard: {
        padding: 0,
        overflow: 'hidden',
    },
    errorCard: {
        borderColor: 'red',
        borderWidth: 2,
    },
    inputContainer: {
        padding: 16,
    },
    inputLabel: {
        marginBottom: 8,
        fontWeight: '600',
    },
    textInput: {
        fontSize: 16,
        minHeight: 44,
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    notesInput: {
        height: 88,
        textAlignVertical: 'top',
    },

    // Metadata Section
    metadataGrid: {
        flexDirection: 'row',
        gap: 12,
    },
    metadataCard: {
        flex: 1,
        padding: 16,
    },
    metadataContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    metadataText: {
        flex: 1,
        gap: 4,
    },
    sectionSubtitle: {
        marginTop: 16,
        marginBottom: 12,
        fontWeight: '600',
    },
    predictionsContainer: {
        marginTop: 16,
    },
    predictionCard: {
        marginBottom: 8,
        padding: 12,
    },
    predictionContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    predictionText: {
        flex: 1,
        fontStyle: 'italic',
    },

    // Save Button
    saveButtonContainer: {
        padding: 20,
        paddingBottom: 32,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
    },
    saveButton: {
        flexDirection: 'row',
        gap: 8,
    },

    // Modals
    modalContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    datePickerCard: {
        padding: 24,
        alignItems: 'center',
        minWidth: 300,
    },
    modalTitle: {
        marginBottom: 20,
        textAlign: 'center',
    },
    datePickerButtons: {
        flexDirection: 'row',
        gap: 16,
        marginTop: 20,
    },
    dateButton: {
        flex: 1,
    },
    videoModalContainer: {
        flex: 1,
        backgroundColor: '#000',
        justifyContent: 'space-between',
    },
    fullscreenVideo: {
        flex: 1,
    },
    videoModalControls: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        padding: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
    },
    videoButton: {
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: 20,
    },
});