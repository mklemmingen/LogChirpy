/**
 * Manual Bird Spotting Entry Screen - Redesigned
 * 
 * Compact, visual interface for manually logging bird sightings.
 * Features: inline editing, horizontal media cards, visual connections, minimal scrolling.
 */

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
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import {ThemedIcon} from '@/components/ThemedIcon';
import {BlurView} from 'expo-blur';

import {useLogDraft} from '@/contexts/LogDraftContext';
import {BirdSpotting, insertBirdSpotting} from '@/services/database';
import {useVideoPlayer, VideoSource, VideoView} from 'expo-video';
import {AudioIdentificationService, AudioPrediction} from '@/services/audioIdentificationService';
import { ConfidenceIndicator } from '@/components/audio/ConfidenceIndicator';
import {ModelType} from '@/services/modelConfig';
import * as FileSystem from 'expo-file-system';

// Modern components
import {ThemedView} from '@/components/ThemedView';
import {ThemedText} from '@/components/ThemedText';
import {ThemedPressable} from '@/components/ThemedPressable';
import {ModernCard} from '@/components/ModernCard';
import {useSnackbar} from '@/components/ThemedSnackbar';

// Theme hooks
import {useColors, useTypography, useBorderRadius, useShadows, useSpacing} from '@/hooks/useThemeColor';

// URI utilities
import { filePathToUri } from '@/services/uriUtils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ValidationError {
    field: string;
    message: string;
}

/**
 * Compact Manual Bird Spotting Entry Component
 */
export default function CompactManual() {
    const params = useLocalSearchParams();
    const { t } = useTranslation();
    const { draft, update, clear } = useLogDraft();
    const colorScheme = useColorScheme() ?? 'light';
    const insets = useSafeAreaInsets();

    // Theme system
    const colors = useColors();
    const typography = useTypography();
    const borderRadius = useBorderRadius();
    const shadows = useShadows();
    const spacing = useSpacing();
    const { SnackbarComponent, showSuccess, showError } = useSnackbar();

    // State management
    const [isSaving, setIsSaving] = useState(false);
    const [isLoadingLocation, setIsLoadingLocation] = useState(false);
    const [sound, setSound] = useState<Audio.Sound | null>(null);
    const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
    const [imageLoadError, setImageLoadError] = useState(false);
    
    // Bird identification state
    const [isIdentifyingBird, setIsIdentifyingBird] = useState(false);
    const [birdPredictions, setBirdPredictions] = useState<AudioPrediction[]>([]);
    const [showPredictions, setShowPredictions] = useState(false);
    const [processingTimer, setProcessingTimer] = useState(0);

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
            updates.audioUri = filePathToUri(params.audioUri as string);
        }
        if (params.imageUri && params.imageUri !== draft.imageUri) {
            updates.imageUri = filePathToUri(params.imageUri as string);
        }
        if (params.videoUri && params.videoUri !== draft.videoUri) {
            updates.videoUri = filePathToUri(params.videoUri as string);
        }

        if (Object.keys(updates).length > 0) {
            update(updates);
            if (updates.imageUri) {
                setImageLoadError(false);
            }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
    }, [params, draft, update]);

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

    // Cleanup resources
    useEffect(() => {
        return () => {
            if (sound) sound.unloadAsync();
            if (previewPlayer) previewPlayer.release();
            if (fullscreenPlayer) fullscreenPlayer.release();
        };
    }, [sound, previewPlayer, fullscreenPlayer]);

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

    // Media handlers
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

    const handleIdentifyBird = useCallback(async () => {
        if (!draft.audioUri) {
            showError(t('birdnet.no_audio_error', 'No audio file available for identification'));
            return;
        }

        setIsIdentifyingBird(true);
        setProcessingTimer(0);
        
        const startTime = Date.now();
        const timerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            setProcessingTimer(elapsed);
        }, 100);
        
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            
            await AudioIdentificationService.initialize(ModelType.HIGH_ACCURACY_FP32);
            
            const response = await AudioIdentificationService.identifyBirdFromAudio(
                draft.audioUri,
                {
                    latitude: draft.gpsLat,
                    longitude: draft.gpsLng,
                    minConfidence: 0.1,
                    modelType: ModelType.HIGH_ACCURACY_FP32
                }
            );

            if (response.success && response.predictions.length > 0) {
                setBirdPredictions(response.predictions);
                setShowPredictions(true);
                
                const bestPrediction = AudioIdentificationService.getBestPrediction(response.predictions);
                if (bestPrediction) {
                    update({
                        birdType: bestPrediction.common_name,
                        audioPrediction: `${bestPrediction.common_name} (${AudioIdentificationService.formatConfidenceScore(bestPrediction.confidence)} confidence)`,
                    });
                }
                
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                showSuccess(t('birdnet.identification_success', `Bird identification completed!`));
            } else {
                showError(response.error || t('birdnet.no_birds_detected', 'No bird sounds detected'));
            }
        } catch (error) {
            console.error('Bird identification error:', error);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            showError(t('birdnet.identification_failed', 'Bird identification failed'));
        } finally {
            clearInterval(timerInterval);
            setIsIdentifyingBird(false);
        }
    }, [draft.audioUri, draft.gpsLat, draft.gpsLng, update, t, showSuccess, showError]);

    const handleSelectPrediction = useCallback((prediction: AudioPrediction) => {
        update({
            birdType: prediction.common_name,
            audioPrediction: `${prediction.common_name} (${AudioIdentificationService.formatConfidenceScore(prediction.confidence)} confidence)`,
        });
        setShowPredictions(false);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        showSuccess(t('birdnet.prediction_selected', 'Prediction selected!'));
    }, [update, t, showSuccess]);

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
        console.log('Text change:', key, value);
        update({ [key]: value });
        setValidationErrors(prev => prev.filter(error => error.field !== key));
    }, [update]);

    const handleDateChange = useCallback((event: { type: string; nativeEvent?: { timestamp?: number } }, date?: Date) => {
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
        console.log('Navigating to:', route);
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

        Alert.alert(
            t('log.confirm_save'),
            t('log.save_confirmation_message'),
            [
                { text: t('common.cancel'), style: 'cancel' },
                { text: t('common.save'), onPress: performSave },
            ]
        );
    }, [validateEntry, performSave, t, showError]);

    /**
     * COMPACT UI COMPONENTS
     */

    // Compact Header with back button and inline progress
    const CompactHeader = () => (
        <ThemedView style={[styles.compactHeader, { paddingTop: insets.top + 8 }]}>
            <View style={styles.headerRow}>
                <ThemedPressable
                    variant="ghost"
                    onPress={() => {
                        console.log('Back button pressed');
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        router.back();
                    }}
                    style={styles.backButton}
                >
                    <ThemedIcon name="arrow-left" size={24} color="primary" />
                </ThemedPressable>
                
                <ThemedText variant="h2" style={styles.headerTitle}>
                    {t('log.manual_entry')}
                </ThemedText>
                
                <View style={styles.progressIndicator}>
                    <ThemedText variant="bodySmall" color="secondary">
                        {completionPercentage}%
                    </ThemedText>
                    <View style={[styles.progressCircle, { borderColor: colors.border }]}>
                        <View 
                            style={[
                                styles.progressFill, 
                                { 
                                    backgroundColor: colors.primary,
                                    height: `${completionPercentage}%`
                                }
                            ]} 
                        />
                    </View>
                </View>
            </View>
        </ThemedView>
    );

    // Horizontal Media Strip
    const MediaStrip = () => (
        <View style={styles.mediaStrip}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mediaScrollView}>
                {/* Photo Card */}
                <ThemedPressable
                    variant="ghost"
                    onPress={() => handleMediaNavigation('/log/photo-selection')}
                    style={styles.mediaItem}
                >
                    <ModernCard style={styles.mediaCard}>
                        {draft.imageUri && !imageLoadError ? (
                            <Image 
                                source={{ uri: draft.imageUri }} 
                                style={styles.mediaThumbnail}
                                onError={() => setImageLoadError(true)}
                                onLoad={() => setImageLoadError(false)}
                            />
                        ) : (
                            <View style={styles.mediaPlaceholder}>
                                <ThemedIcon name="camera" size={20} color="accent" />
                            </View>
                        )}
                        <View style={styles.mediaLabel}>
                            <ThemedIcon name="camera" size={10} color="secondary" />
                            <ThemedText variant="caption" color="secondary">Photo</ThemedText>
                        </View>
                        {draft.imageUri && (
                            <View style={styles.mediaStatus}>
                                <ThemedIcon name="check" size={10} color="success" />
                            </View>
                        )}
                    </ModernCard>
                </ThemedPressable>

                {/* Video Card */}
                <ThemedPressable
                    variant="ghost"
                    onPress={() => draft.videoUri ? setIsVideoModalVisible(true) : handleMediaNavigation('/log/video')}
                    style={styles.mediaItem}
                >
                    <ModernCard style={styles.mediaCard}>
                        {draft.videoUri ? (
                            <>
                                {previewPlayer && (
                                    <VideoView
                                        player={previewPlayer}
                                        style={styles.mediaThumbnail}
                                        contentFit="cover"
                                    />
                                )}
                                <View style={styles.videoOverlay}>
                                    <ThemedIcon name="play" size={12} color="primary" />
                                </View>
                            </>
                        ) : (
                            <View style={styles.mediaPlaceholder}>
                                <ThemedIcon name="video" size={20} color="accent" />
                            </View>
                        )}
                        <View style={styles.mediaLabel}>
                            <ThemedIcon name="video" size={10} color="secondary" />
                            <ThemedText variant="caption" color="secondary">Video</ThemedText>
                        </View>
                        {draft.videoUri && (
                            <View style={styles.mediaStatus}>
                                <ThemedIcon name="check" size={10} color="success" />
                            </View>
                        )}
                    </ModernCard>
                </ThemedPressable>

                {/* Audio Card */}
                <ThemedPressable
                    variant="ghost"
                    onPress={() => draft.audioUri ? handlePlayAudio() : handleMediaNavigation('/log/audio')}
                    style={styles.mediaItem}
                >
                    <ModernCard style={styles.mediaCard}>
                        <View style={styles.mediaPlaceholder}>
                            <ThemedIcon
                                name={draft.audioUri ? (sound ? "pause" : "play") : "mic"}
                                size={20}
                                color="accent"
                            />
                        </View>
                        <View style={styles.mediaLabel}>
                            <ThemedIcon name="mic" size={10} color="secondary" />
                            <ThemedText variant="caption" color="secondary">Audio</ThemedText>
                        </View>
                        {draft.audioUri && (
                            <View style={styles.mediaStatus}>
                                <ThemedIcon name="check" size={10} color="success" />
                            </View>
                        )}
                    </ModernCard>
                </ThemedPressable>

                {/* AI Identification Card */}
                {draft.audioUri && (
                    <ThemedPressable
                        variant="ghost"
                        onPress={handleIdentifyBird}
                        disabled={isIdentifyingBird}
                        style={styles.mediaItem}
                    >
                        <ModernCard style={[styles.mediaCard, styles.aiCard]}>
                            <View style={styles.mediaPlaceholder}>
                                {isIdentifyingBird ? (
                                    <ActivityIndicator size="small" color={colors.primary} />
                                ) : (
                                    <ThemedIcon name="search" size={20} color="primary" />
                                )}
                            </View>
                            <View style={styles.mediaLabel}>
                                <ThemedIcon name="zap" size={10} color="primary" />
                                <ThemedText variant="caption" color="primary">
                                    {isIdentifyingBird ? `${processingTimer}s` : 'AI ID'}
                                </ThemedText>
                            </View>
                            {draft.audioPrediction && (
                                <View style={[styles.mediaStatus, { backgroundColor: colors.success }]}>
                                    <ThemedIcon name="check" size={10} color="inverse" />
                                </View>
                            )}
                        </ModernCard>
                    </ThemedPressable>
                )}
            </ScrollView>
        </View>
    );

    // Inline Form
    const InlineForm = () => (
        <View style={styles.formContainer}>
            {/* Bird Type Input */}
            <ModernCard style={styles.formCard}>
                <View style={styles.inlineField}>
                    <View style={styles.fieldIcon}>
                        <ThemedIcon name="feather" size={18} color="accent" />
                    </View>
                    <View style={styles.fieldContent}>
                        <ThemedText variant="label" color="secondary" style={styles.fieldLabel}>
                            {t('log.bird_type')} *
                        </ThemedText>
                        <TextInput
                            style={[styles.inlineInput, { color: colors.text }]}
                            value={draft.birdType || ''}
                            onChangeText={(text) => handleTextChange('birdType', text)}
                            placeholder={t('log.bird_type_placeholder')}
                            placeholderTextColor={colors.textSecondary}
                        />
                    </View>
                    {draft.audioPrediction && (
                        <View style={styles.predictionBadge}>
                            <ThemedIcon name="zap" size={12} color="success" />
                        </View>
                    )}
                </View>
            </ModernCard>

            {/* Notes Input */}
            <ModernCard style={styles.formCard}>
                <View style={styles.inlineField}>
                    <View style={styles.fieldIcon}>
                        <ThemedIcon name="edit-3" size={18} color="accent" />
                    </View>
                    <View style={styles.fieldContent}>
                        <ThemedText variant="label" color="secondary" style={styles.fieldLabel}>
                            {t('log.notes')}
                        </ThemedText>
                        <TextInput
                            style={[styles.inlineInput, styles.notesInput, { color: colors.text }]}
                            value={draft.textNote || ''}
                            onChangeText={(text) => handleTextChange('textNote', text)}
                            placeholder={t('log.notes_placeholder')}
                            placeholderTextColor={colors.textSecondary}
                            multiline
                            numberOfLines={2}
                        />
                    </View>
                </View>
            </ModernCard>

            {/* Metadata Row */}
            <View style={styles.metadataRow}>
                {/* Date */}
                <ThemedPressable
                    variant="ghost"
                    onPress={() => {
                        console.log('Date picker button pressed');
                        setSelectedDate(draft.date ? new Date(draft.date) : new Date());
                        setIsDatePickerVisible(true);
                    }}
                    style={styles.metadataButton}
                >
                    <ModernCard style={styles.metadataCard}>
                        <View style={styles.metadataContent}>
                            <ThemedIcon name="calendar" size={16} color="accent" />
                            <View style={styles.metadataText}>
                                <ThemedText variant="caption" color="secondary">Date</ThemedText>
                                <ThemedText variant="bodySmall">
                                    {draft.date ? new Date(draft.date).toLocaleDateString() : new Date().toLocaleDateString()}
                                </ThemedText>
                            </View>
                        </View>
                    </ModernCard>
                </ThemedPressable>

                {/* Location */}
                <ThemedPressable
                    variant="ghost"
                    onPress={() => {
                        console.log('Location button pressed');
                        handleGetLocation();
                    }}
                    disabled={isLoadingLocation}
                    style={styles.metadataButton}
                >
                    <ModernCard style={styles.metadataCard}>
                        <View style={styles.metadataContent}>
                            {isLoadingLocation ? (
                                <ActivityIndicator size="small" color={colors.primary} />
                            ) : (
                                <ThemedIcon name="map-pin" size={16} color="accent" />
                            )}
                            <View style={styles.metadataText}>
                                <ThemedText variant="caption" color="secondary">Location</ThemedText>
                                <ThemedText variant="bodySmall" numberOfLines={1}>
                                    {draft.gpsLat && draft.gpsLng
                                        ? `${draft.gpsLat.toFixed(3)}, ${draft.gpsLng.toFixed(3)}`
                                        : t('log.no_location')
                                    }
                                </ThemedText>
                            </View>
                        </View>
                        {draft.gpsLat && draft.gpsLng && (
                            <View style={styles.locationStatus}>
                                <ThemedIcon name="check" size={10} color="success" />
                            </View>
                        )}
                    </ModernCard>
                </ThemedPressable>
            </View>
        </View>
    );

    // Save Button
    const SaveButton = () => (
        <ThemedView style={styles.saveContainer}>
            <ThemedPressable
                variant="primary"
                onPress={() => {
                    console.log('Save button pressed');
                    handleSave();
                }}
                disabled={isSaving}
                size="lg"
                fullWidth
                style={[styles.saveButton, { backgroundColor: colors.primary }]}
            >
                {isSaving ? (
                    <ActivityIndicator size="small" color={colors.textInverse} />
                ) : (
                    <ThemedIcon name="save" size={20} color="inverse" />
                )}
                <ThemedText variant="button" style={{ color: colors.textInverse }}>
                    {isSaving ? t('common.saving') : t('common.save')}
                </ThemedText>
            </ThemedPressable>
        </ThemedView>
    );

    /**
     * Main Render
     */
    return (
        <ThemedView style={styles.container}>
            <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
            <Stack.Screen options={{ headerShown: false }} />

            <CompactHeader />
            
            <ScrollView 
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <MediaStrip />
                <InlineForm />
            </ScrollView>

            <SaveButton />

            {/* Modals */}
            {/* Date Picker Modal */}
            {isDatePickerVisible && (
                <Modal
                    transparent
                    animationType="slide"
                    visible={isDatePickerVisible}
                    onRequestClose={() => setIsDatePickerVisible(false)}
                >
                    <BlurView intensity={80} style={styles.modalContainer}>
                        <ModernCard style={styles.datePickerCard}>
                            <ThemedText variant="h3" style={styles.modalTitle}>
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
                                        <ThemedText variant="button">{t('common.cancel')}</ThemedText>
                                    </ThemedPressable>
                                    <ThemedPressable
                                        variant="primary"
                                        onPress={() => {
                                            handleDateChange({ type: 'set' }, selectedDate);
                                            setIsDatePickerVisible(false);
                                        }}
                                        style={[styles.dateButton, { backgroundColor: colors.primary }]}
                                    >
                                        <ThemedText variant="button" style={{ color: colors.textInverse }}>
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
                            <ThemedIcon name="x" size={20} color="primary" />
                            <ThemedText variant="button">{t('common.close')}</ThemedText>
                        </ThemedPressable>
                        <ThemedPressable
                            variant="primary"
                            onPress={() => {
                                setIsVideoModalVisible(false);
                                handleMediaNavigation('/log/video');
                            }}
                            style={[styles.videoButton, { backgroundColor: colors.primary }]}
                        >
                            <ThemedIcon name="refresh-cw" size={20} color="inverse" />
                            <ThemedText variant="button" style={{ color: colors.textInverse }}>
                                {t('camera.retake')}
                            </ThemedText>
                        </ThemedPressable>
                    </View>
                </View>
            </Modal>

            {/* Bird Predictions Modal */}
            <Modal
                visible={showPredictions}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowPredictions(false)}
            >
                <BlurView intensity={80} style={styles.modalContainer}>
                    <ModernCard style={styles.predictionsModalContainer}>
                        <View style={styles.predictionsHeader}>
                            <ThemedText variant="h3">
                                {t('birdnet.predictions_title', 'Bird Identification Results')}
                            </ThemedText>
                            <ThemedPressable
                                style={styles.modalCloseButton}
                                onPress={() => setShowPredictions(false)}
                            >
                                <ThemedIcon name="x" size={24} color="primary" />
                            </ThemedPressable>
                        </View>
                        
                        <ScrollView style={styles.predictionsScrollView}>
                            {birdPredictions.map((prediction, index) => (
                                <ThemedPressable
                                    key={index}
                                    style={styles.predictionItem}
                                    onPress={() => handleSelectPrediction(prediction)}
                                >
                                    <View style={styles.predictionItemContent}>
                                        <View style={styles.predictionInfo}>
                                            <ThemedText variant="body" style={styles.predictionCommonName}>
                                                {prediction.common_name}
                                            </ThemedText>
                                            <ThemedText variant="bodySmall" color="secondary" style={styles.predictionScientificName}>
                                                {prediction.scientific_name}
                                            </ThemedText>
                                        </View>
                                        <View style={styles.predictionConfidence}>
                                            <ConfidenceIndicator 
                                                confidence={prediction.confidence}
                                                variant="compact"
                                                showIcon={true}
                                                showPercentage={true}
                                            />
                                            <ThemedIcon name="chevron-right" size={20} color="secondary" />
                                        </View>
                                    </View>
                                </ThemedPressable>
                            ))}
                        </ScrollView>
                    </ModernCard>
                </BlurView>
            </Modal>

            <SnackbarComponent />
        </ThemedView>
    );
}

/**
 * Compact Styles
 */
const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    
    // Compact Header
    compactHeader: {
        paddingHorizontal: 20,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    backButton: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 22,
    },
    headerTitle: {
        fontWeight: '700',
        flex: 1,
        textAlign: 'center',
        marginHorizontal: 16,
    },
    progressIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    progressCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 2,
        justifyContent: 'flex-end',
        overflow: 'hidden',
    },
    progressFill: {
        width: '100%',
        borderRadius: 14,
    },

    // Media Strip
    mediaStrip: {
        paddingVertical: 16,
    },
    mediaScrollView: {
        paddingHorizontal: 20,
    },
    mediaItem: {
        marginRight: 12,
    },
    mediaCard: {
        width: 80,
        height: 80,
        position: 'relative',
        overflow: 'hidden',
    },
    mediaThumbnail: {
        width: '100%',
        height: 56,
        borderRadius: 8,
    },
    mediaPlaceholder: {
        width: '100%',
        height: 56,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 8,
        backgroundColor: 'rgba(0,0,0,0.03)',
    },
    mediaLabel: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        justifyContent: 'center',
    },
    mediaStatus: {
        position: 'absolute',
        top: 4,
        right: 4,
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: '#22C55E',
        justifyContent: 'center',
        alignItems: 'center',
    },
    videoOverlay: {
        position: 'absolute',
        top: 20,
        left: 20,
        right: 20,
        bottom: 20,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: 8,
    },
    aiCard: {
        borderWidth: 1,
        borderColor: 'rgba(37, 99, 235, 0.2)',
    },

    // Inline Form
    formContainer: {
        paddingHorizontal: 20,
        gap: 16,
    },
    formCard: {
        padding: 16,
    },
    inlineField: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
    },
    fieldIcon: {
        width: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 2,
    },
    fieldContent: {
        flex: 1,
        gap: 4,
    },
    fieldLabel: {
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    inlineInput: {
        fontSize: 16,
        padding: 0,
        minHeight: 24,
    },
    notesInput: {
        minHeight: 48,
        textAlignVertical: 'top',
    },
    predictionBadge: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#22C55E',
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Metadata Row
    metadataRow: {
        flexDirection: 'row',
        gap: 12,
    },
    metadataButton: {
        flex: 1,
    },
    metadataCard: {
        padding: 12,
        position: 'relative',
    },
    metadataContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    metadataText: {
        flex: 1,
        gap: 2,
    },
    locationStatus: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#22C55E',
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Scroll View
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 16,
    },

    // Save Button
    saveContainer: {
        padding: 20,
        paddingBottom: 32,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.05)',
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
        backgroundColor: 'rgba(0,0,0,0.8)',
    },
    videoButton: {
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: 20,
    },
    predictionsModalContainer: {
        maxHeight: '80%',
        width: '100%',
        maxWidth: 400,
        overflow: 'hidden',
    },
    predictionsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.1)',
    },
    modalCloseButton: {
        padding: 8,
        borderRadius: 8,
    },
    predictionsScrollView: {
        maxHeight: 300,
    },
    predictionItem: {
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    predictionItemContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    predictionInfo: {
        flex: 1,
    },
    predictionCommonName: {
        fontWeight: '600',
        marginBottom: 4,
    },
    predictionScientificName: {
        fontStyle: 'italic',
    },
    predictionConfidence: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
});