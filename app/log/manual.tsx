/**
 * Manual Bird Spotting Entry Screen
 * 
 * A clean, minimal interface for manually logging bird sightings with the new design system.
 * Supports multiple media types, AI identification, and comprehensive data entry.
 * 
 * Key Features:
 * - Multi-media capture (photo, video, audio)
 * - BirdNet AI identification for audio
 * - GPS location with privacy controls
 * - Real-time validation and progress tracking
 * - Draft auto-save functionality
 * - Accessibility-first design
 * - Haptic feedback integration
 * 
 * Design System:
 * - Uses minimal black/white theme
 * - Clean typography and spacing
 * - Subtle animations and interactions
 * - Consistent component patterns
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
import DateTimePicker from '@react-native-community/datetimepicker';
import {ThemedIcon} from '@/components/ThemedIcon';
import {BlurView} from 'expo-blur';

import {useLogDraft} from '@/contexts/LogDraftContext';
import {BirdSpotting, insertBirdSpotting} from '@/services/database';
import {useVideoPlayer, VideoSource, VideoView} from 'expo-video';
import {AudioIdentificationService, AudioPrediction} from '@/services/audioIdentificationService';
import {ModelType} from '@/services/modelConfig';
import * as FileSystem from 'expo-file-system';

// Modern components
import {ThemedView, Card} from '@/components/ThemedView';
import {ThemedText} from '@/components/ThemedText';
import {ThemedPressable} from '@/components/ThemedPressable';
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

// Enhanced diagnostic collection for manual pipeline
async function collectManualPipelineDiagnostics(): Promise<any> {
    const diagnostics: any = {
        timestamp: new Date().toISOString(),
        device: {
            platform: Platform.OS,
            version: Platform.Version,
            screenWidth: SCREEN_WIDTH
        },
        app: {
            isDevelopment: __DEV__,
        },
        permissions: {},
        storage: {},
        audio: {}
    };

    // Check audio permissions
    try {
        const audioPermission = await Audio.getPermissionsAsync();
        diagnostics.permissions.audio = audioPermission.status;
    } catch (e) {
        diagnostics.permissions.audio = 'check_failed';
    }

    // Check location permissions
    try {
        const locationPermission = await Location.getForegroundPermissionsAsync();
        diagnostics.permissions.location = locationPermission.status;
    } catch (e) {
        diagnostics.permissions.location = 'check_failed';
    }

    // Check storage capabilities
    try {
        if (FileSystem.documentDirectory) {
            const docInfo = await FileSystem.getInfoAsync(FileSystem.documentDirectory);
            diagnostics.storage.documentDirectory = docInfo.exists;
        }
    } catch (e) {
        diagnostics.storage.error = 'check_failed';
    }

    // Check audio capabilities
    try {
        diagnostics.audio.soundSupported = !!Audio.Sound;
        diagnostics.audio.recordingSupported = !!Audio.Recording;
    } catch (e) {
        diagnostics.audio.error = 'check_failed';
    }

    return diagnostics;
}

/**
 * Enhanced Manual Bird Spotting Entry Component
 * 
 * Main component for manually creating comprehensive bird sighting entries.
 * Integrates with the draft context system for auto-save functionality.
 * Supports multiple media types and AI-powered identification.
 */
export default function EnhancedManual() {
    const params = useLocalSearchParams();
    const { t } = useTranslation();
    const { draft, update, clear } = useLogDraft();
    const colorScheme = useColorScheme() ?? 'light';

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
    const [processingStage, setProcessingStage] = useState<string>('');

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

    // Dynamic styles that need access to colors hook
    const dynamicStyles = useMemo(() => StyleSheet.create({
        videoOverlay: {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: colors.background + '4D',
        },
        textInput: {
            fontSize: 16,
            minHeight: 44,
            padding: 12,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: 'transparent',
            backgroundColor: colors.backgroundSecondary + '1A',
        },
        videoModalControls: {
            flexDirection: 'row',
            justifyContent: 'space-around',
            padding: 20,
            backgroundColor: colors.background + 'CC',
        },
        predictionInfo: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 8,
            backgroundColor: colors.backgroundSecondary + '1A',
        },
        modalOverlay: {
            flex: 1,
            backgroundColor: colors.background + '80',
        },
        predictionsModalContainer: {
            backgroundColor: colors.surface + 'F2',
            borderRadius: 16,
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
            borderBottomColor: colors.border + '1A',
        },
        predictionItem: {
            paddingHorizontal: 20,
            paddingVertical: 16,
            borderBottomWidth: 1,
            borderBottomColor: colors.border + '0D',
        },
        predictionsFooter: {
            padding: 20,
            borderTopWidth: 1,
            borderTopColor: colors.border + '1A',
        },
        progressBar: {
            flex: 1,
            height: 6,
            borderRadius: 3,
            overflow: 'hidden',
            backgroundColor: colors.backgroundSecondary,
        },
        progressFill: {
            height: '100%',
            borderRadius: 3,
            backgroundColor: colors.primary,
        },
    }), [colors]);

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
            // Reset image load error when new image is set
            if (updates.imageUri) {
                setImageLoadError(false);
            }
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

    // Cleanup audio and video resources on unmount and navigation
    useEffect(() => {
        return () => {
            // Cleanup audio
            if (sound) {
                sound.unloadAsync();
            }
        };
    }, [sound]);
    
    // Cleanup video players on unmount
    useEffect(() => {
        return () => {
            // Cleanup video players to prevent memory leaks
            if (previewPlayer) {
                previewPlayer.release();
            }
            if (fullscreenPlayer) {
                fullscreenPlayer.release();
            }
        };
    }, [previewPlayer, fullscreenPlayer]);
    
    // Focus effect cleanup for navigation
    useFocusEffect(
        useCallback(() => {
            return () => {
                // Cleanup resources when navigating away
                if (sound) {
                    sound.unloadAsync();
                }
                // Close any open modals
                setIsVideoModalVisible(false);
                setIsDatePickerVisible(false);
                setShowPredictions(false);
            };
        }, [sound])
    );

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

    /**
     * Media Handling Functions
     * 
     * These functions manage audio playback, bird identification,
     * and location services with proper error handling and user feedback.
     */
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
        setProcessingStage('');
        
        // Set up processing timer
        const startTime = Date.now();
        const timerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            setProcessingTimer(elapsed);
        }, 100); // Update every 100ms for smooth timer
        
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            
            // Stage 1: Initialize ML model with GPU acceleration
            setProcessingStage(t('birdnet.stage_initializing', 'Initializing high-accuracy model with GPU...'));
            
            // Initialize with GPU acceleration if not already done
            try {
                await AudioIdentificationService.initialize(ModelType.HIGH_ACCURACY_FP32);
                console.log('[Manual] AudioIdentificationService initialized with GPU acceleration');
            } catch (initError) {
                console.warn('[Manual] GPU initialization failed, using CPU fallback:', initError);
            }
            
            // Add small delay to show stage
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Stage 2: Processing audio
            setProcessingStage(t('birdnet.stage_processing', 'Analyzing audio with FP32 precision...'));
            
            const response = await AudioIdentificationService.identifyBirdFromAudio(
                draft.audioUri,
                {
                    latitude: draft.gpsLat,
                    longitude: draft.gpsLng,
                    minConfidence: 0.1,
                    modelType: ModelType.HIGH_ACCURACY_FP32 // Keep high-accuracy for manual processing
                }
            );

            // Stage 3: Processing results
            setProcessingStage(t('birdnet.stage_results', 'Processing identification results...'));
            await new Promise(resolve => setTimeout(resolve, 100));

            if (response.success && response.predictions.length > 0) {
                setBirdPredictions(response.predictions);
                setShowPredictions(true);
                
                // Auto-fill with the best prediction
                const bestPrediction = AudioIdentificationService.getBestPrediction(response.predictions);
                if (bestPrediction) {
                    update({
                        birdType: bestPrediction.common_name,
                        audioPrediction: `${bestPrediction.common_name} (${AudioIdentificationService.formatConfidenceScore(bestPrediction.confidence)} confidence - ${processingTimer}s)`,
                    });
                }
                
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                showSuccess(t('birdnet.identification_success', `Bird identification completed in ${processingTimer}s!`));
            } else {
                showError(response.error || t('birdnet.no_birds_detected', 'No bird sounds detected with sufficient confidence'));
            }
        } catch (error) {
            // Comprehensive error logging for manual audio pipeline
            const errorContext = {
                timestamp: new Date().toISOString(),
                pipeline: 'manual_audio',
                operation: 'bird_identification',
                modelType: 'HIGH_ACCURACY_FP32',
                audioUri: draft.audioUri,
                audioFileSize: draft.audioUri ? 'checking...' : 'N/A',
                gpsLocation: draft.gpsLat && draft.gpsLng ? `${draft.gpsLat}, ${draft.gpsLng}` : 'none',
                processingTime: `${processingTimer}s`,
                stage: processingStage,
                deviceInfo: {
                    platform: Platform.OS,
                    version: Platform.Version
                }
            };

            // Check audio file size if available
            if (draft.audioUri) {
                try {
                    const fileInfo = await FileSystem.getInfoAsync(draft.audioUri);
                    errorContext.audioFileSize = fileInfo.exists && 'size' in fileInfo 
                        ? `${Math.round(fileInfo.size / 1024)}KB` 
                        : 'unknown';
                } catch (fileCheckError) {
                    errorContext.audioFileSize = 'check_failed';
                }
            }

            // Detailed error analysis
            let errorType = 'unknown';
            let errorMessage = t('birdnet.identification_failed', 'Bird identification failed');
            let debugInfo = '';

            if (error instanceof Error) {
                debugInfo = error.stack || error.toString();
                
                // Categorize error types for better handling
                if (error.message.includes('permission') || error.message.includes('microphone')) {
                    errorType = 'permission';
                    errorMessage = t('birdnet.permission_error', 'Microphone permission required');
                } else if (error.message.includes('internet') || error.message.includes('network')) {
                    errorType = 'network';
                    errorMessage = t('birdnet.network_error', 'Network error. Please check your internet connection.');
                } else if (error.message.includes('not found') || error.message.includes('file')) {
                    errorType = 'file_not_found';
                    errorMessage = t('birdnet.audio_not_found', 'Audio file not found');
                } else if (error.message.includes('model') || error.message.includes('tflite')) {
                    errorType = 'model_error';
                    errorMessage = t('birdnet.model_error', 'AI model error - please try again');
                } else if (error.message.includes('memory') || error.message.includes('out of memory')) {
                    errorType = 'memory_error';
                    errorMessage = t('birdnet.memory_error', 'Insufficient memory - try closing other apps');
                } else if (error.message.includes('timeout')) {
                    errorType = 'timeout';
                    errorMessage = t('birdnet.timeout_error', 'Processing timeout - audio may be too long');
                } else if (error.message.includes('GPU') || error.message.includes('delegate')) {
                    errorType = 'gpu_error';
                    errorMessage = t('birdnet.gpu_error', 'GPU processing failed - using CPU fallback');
                } else {
                    errorType = 'general';
                    errorMessage = error.message;
                }
            }

            // Collect comprehensive diagnostics for the error
            try {
                const diagnostics = await collectManualPipelineDiagnostics();
                
                const fullErrorReport = {
                    errorType,
                    errorMessage,
                    context: errorContext,
                    diagnostics,
                    debugInfo,
                    pipeline: 'manual_audio'
                };

                console.error(`
================================================================================
🚨 COMPREHENSIVE MANUAL AUDIO PIPELINE ERROR
================================================================================
Error Type: ${errorType}
Error Message: ${errorMessage}
Context: ${JSON.stringify(errorContext, null, 2)}
Diagnostics: ${JSON.stringify(diagnostics, null, 2)}
Debug Info: ${debugInfo}
================================================================================
                `.trim());

                // Report to crash service with full diagnostics
                if (typeof (global as any).crashReporter !== 'undefined') {
                    try {
                        (global as any).crashReporter.recordError(error, fullErrorReport);
                    } catch (reportError) {
                        console.warn('[Manual] Failed to report error to crash service:', reportError);
                    }
                }
                
                // Store error for potential user reporting
                try {
                    const errorLogPath = `${FileSystem.documentDirectory}manual_audio_errors.json`;
                    const existingErrors = [];
                    
                    try {
                        const existingData = await FileSystem.readAsStringAsync(errorLogPath);
                        const parsed = JSON.parse(existingData);
                        existingErrors.push(...(Array.isArray(parsed) ? parsed : []));
                    } catch (readError) {
                        // File doesn't exist or is corrupted, start fresh
                    }
                    
                    // Keep only last 10 errors to prevent storage bloat
                    existingErrors.push(fullErrorReport);
                    const recentErrors = existingErrors.slice(-10);
                    
                    await FileSystem.writeAsStringAsync(errorLogPath, JSON.stringify(recentErrors, null, 2));
                    console.log('[Manual] Error logged to local storage for debugging');
                } catch (logError) {
                    console.warn('[Manual] Failed to log error locally:', logError);
                }
                
            } catch (diagError) {
                console.warn('[Manual] Failed to collect diagnostics:', diagError);
                
                // Fallback to basic error logging
                console.error(`
================================================================================
🚨 MANUAL AUDIO PIPELINE ERROR (BASIC)
================================================================================
Error Type: ${errorType}
Error Message: ${errorMessage}
Context: ${JSON.stringify(errorContext, null, 2)}
Debug Info: ${debugInfo}
================================================================================
                `.trim());
            }

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            showError(errorMessage);
        } finally {
            clearInterval(timerInterval);
            setIsIdentifyingBird(false);
            setProcessingStage('');
        }
    }, [draft.audioUri, draft.gpsLat, draft.gpsLng, update, t, showSuccess, showError, processingTimer]);

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

    /**
     * Component Sections
     * 
     * These section components are built with the new minimal design system.
     * They use Card components for consistent styling and spacing.
     */
    /**
     * Media Section Component
     * 
     * Displays interactive cards for photo, video, and audio capture.
     * Includes AI bird identification for audio recordings.
     */
    const MediaSection = () => (
        <Card style={styles.sectionCard}>
            <ThemedText variant="h3" style={styles.sectionTitle}>
                {t('log.media_section')}
            </ThemedText>
            <View style={styles.mediaGrid}>
                {/* Image Card */}
                <ThemedPressable
                    variant="ghost"
                    onPress={() => handleMediaNavigation('/log/photo')}
                    style={styles.mediaCard}
                >
                    <Card style={styles.mediaCardInner}>
                    {draft.imageUri ? (
                        imageLoadError ? (
                            <View style={styles.addMediaContent}>
                                <ThemedIcon name="image" size={32} color="secondary" />
                                <ThemedText variant="label" color="secondary">
                                    Image unavailable
                                </ThemedText>
                            </View>
                        ) : (
                            <Image 
                                source={{ uri: draft.imageUri }} 
                                style={styles.mediaPreview}
                                onError={() => {
                                    console.warn('Failed to load image in manual entry:', draft.imageUri);
                                    setImageLoadError(true);
                                }}
                                onLoad={() => setImageLoadError(false)}
                            />
                        )
                    ) : (
                        <View style={styles.addMediaContent}>
                            <ThemedIcon name="camera" size={32} color="accent" />
                            <ThemedText variant="label" color="primary">
                                {t('log.add_image')}
                            </ThemedText>
                        </View>
                    )}
                    </Card>
                </ThemedPressable>

                {/* Video Card */}
                <ThemedPressable
                    variant="ghost"
                    onPress={() => draft.videoUri ? setIsVideoModalVisible(true) : handleMediaNavigation('/log/video')}
                    style={styles.mediaCard}
                >
                    <Card style={styles.mediaCardInner}>
                    {draft.videoUri ? (
                        <>
                            {previewPlayer && (
                                <VideoView
                                    player={previewPlayer}
                                    style={styles.mediaPreview}
                                    contentFit="cover"
                                />
                            )}
                            <View style={dynamicStyles.videoOverlay}>
                                <ThemedIcon name="play" size={24} color="primary" />
                            </View>
                        </>
                    ) : (
                        <View style={styles.addMediaContent}>
                            <ThemedIcon name="video" size={32} color="accent" />
                            <ThemedText variant="label" color="primary">
                                {t('log.add_video')}
                            </ThemedText>
                        </View>
                    )}
                    </Card>
                </ThemedPressable>

                {/* Audio Card */}
                <ThemedPressable
                    variant="ghost"
                    onPress={() => draft.audioUri ? handlePlayAudio() : handleMediaNavigation('/log/audio')}
                    style={styles.mediaCard}
                >
                    <Card style={styles.mediaCardInner}>
                    <View style={styles.addMediaContent}>
                        <ThemedIcon
                            name={draft.audioUri ? (sound ? "pause" : "play") : "mic"}
                            size={32}
                            color="accent"
                        />
                        <ThemedText variant="label" color="primary">
                            {draft.audioUri
                                ? (sound ? t('log.playing') : t('log.tap_to_play'))
                                : t('log.add_audio')
                            }
                        </ThemedText>
                    </View>
                    </Card>
                </ThemedPressable>
            </View>

            {/* Bird Identification Section */}
            {draft.audioUri && (
                <View style={styles.identificationSection}>
                    <ThemedPressable
                        variant="primary"
                        style={[
                            styles.identifyButton,
                            {
                                opacity: isIdentifyingBird ? 0.7 : 1,
                                backgroundColor: colors.primary,
                            }
                        ]}
                        onPress={handleIdentifyBird}
                        disabled={isIdentifyingBird}
                    >
                        <View style={styles.identifyButtonContent}>
                            {isIdentifyingBird ? (
                                <ActivityIndicator 
                                    size="small" 
                                    color={colors.textInverse}
                                    style={styles.identifyLoader}
                                />
                            ) : (
                                <ThemedIcon 
                                    name="search" 
                                    size={20} 
                                    color="inverse"
                                    style={styles.identifyIcon}
                                />
                            )}
                            <View style={styles.identifyButtonTextContainer}>
                                <ThemedText 
                                    variant="button" 
                                    style={[styles.identifyButtonText, { color: colors.textInverse }]}
                                >
                                    {isIdentifyingBird 
                                        ? t('birdnet.identifying_timer', `Analyzing... ${processingTimer}s`) 
                                        : t('birdnet.identify_button_offline', 'Identify Bird (High Accuracy)')
                                    }
                                </ThemedText>
                                {isIdentifyingBird && processingStage && (
                                    <ThemedText 
                                        variant="bodySmall" 
                                        style={[styles.identifyStageText, { color: colors.textInverse + 'CC' }]}
                                        numberOfLines={1}
                                    >
                                        {processingStage}
                                    </ThemedText>
                                )}
                            </View>
                        </View>
                    </ThemedPressable>

                    {/* Show prediction confidence if available */}
                    {draft.audioPrediction && (
                        <View style={dynamicStyles.predictionInfo}>
                            <ThemedIcon name="check-circle" size={16} color="success" />
                            <ThemedText variant="bodySmall" color="secondary" style={styles.predictionInfoText}>
                                {draft.audioPrediction}
                            </ThemedText>
                        </View>
                    )}
                </View>
            )}
        </Card>
    );

    /**
     * Details Section Component
     * 
     * Form inputs for bird type (required) and optional notes.
     * Includes real-time validation and user feedback.
     */
    const DetailsSection = () => (
        <Card style={styles.sectionCard}>
            <ThemedText variant="h3" style={styles.sectionTitle}>
                {t('log.details_section')}
            </ThemedText>
            <View style={styles.detailsGrid}>
                {/* Bird Type - Required */}
                <Card>
                    <View style={styles.inputContainer}>
                        <ThemedText variant="label" style={styles.inputLabel}>
                            {t('log.bird_type')} *
                        </ThemedText>
                        <TextInput
                            style={[dynamicStyles.textInput, { color: colors.text }]}
                            value={draft.birdType || ''}
                            onChangeText={(text) => handleTextChange('birdType', text)}
                            placeholder={t('log.bird_type_placeholder')}
                            placeholderTextColor={colors.textSecondary}
                        />
                    </View>
                </Card>

                {/* Notes */}
                <Card style={styles.notesCard}>
                    <View style={styles.inputContainer}>
                        <ThemedText variant="label" style={styles.inputLabel}>
                            {t('log.notes')}
                        </ThemedText>
                        <TextInput
                            style={[dynamicStyles.textInput, styles.notesInput, { color: colors.text }]}
                            value={draft.textNote || ''}
                            onChangeText={(text) => handleTextChange('textNote', text)}
                            placeholder={t('log.notes_placeholder')}
                            placeholderTextColor={colors.textSecondary}
                            multiline
                            textAlignVertical="top"
                        />
                    </View>
                </Card>
            </View>
        </Card>
    );

    /**
     * Metadata Section Component
     * 
     * Date and location selection with GPS integration.
     * Shows AI prediction results when available.
     */
    const MetadataSection = () => (
        <Card style={styles.sectionCard}>
            <ThemedText variant="h3" style={styles.sectionTitle}>
                {t('log.metadata_section')}
            </ThemedText>
            <View style={styles.metadataGrid}>
                {/* Date Card */}
                <ThemedPressable
                    variant="ghost"
                    onPress={() => {
                        setSelectedDate(draft.date ? new Date(draft.date) : new Date());
                        setIsDatePickerVisible(true);
                    }}
                    style={styles.metadataCard}
                >
                    <Card style={styles.metadataCardInner}>
                    <View style={styles.metadataContent}>
                        <ThemedIcon name="calendar" size={20} color="accent" />
                        <View style={styles.metadataText}>
                            <ThemedText variant="label" color="secondary">
                                {t('log.date')}
                            </ThemedText>
                            <ThemedText variant="body">
                                {draft.date ? new Date(draft.date).toLocaleDateString() : new Date().toLocaleDateString()}
                            </ThemedText>
                        </View>
                    </View>
                    </Card>
                </ThemedPressable>

                {/* Location Card */}
                <ThemedPressable
                    variant="ghost"
                    onPress={handleGetLocation}
                    disabled={isLoadingLocation}
                    style={styles.metadataCard}
                >
                    <Card style={styles.metadataCardInner}>
                    <View style={styles.metadataContent}>
                        {isLoadingLocation ? (
                            <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                            <ThemedIcon name="map-pin" size={20} color="accent" />
                        )}
                        <View style={styles.metadataText}>
                            <ThemedText variant="label" color="secondary">
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
                    </Card>
                </ThemedPressable>
            </View>

            {/* Predictions */}
            {(draft.imagePrediction || draft.audioPrediction) && (
                <View style={styles.predictionsContainer}>
                    <ThemedText variant="label" style={styles.sectionSubtitle}>
                        {t('log.ai_predictions')}
                    </ThemedText>

                    {draft.imagePrediction && (
                        <Card style={styles.predictionCard}>
                            <View style={styles.predictionContent}>
                                <ThemedIcon name="camera" size={16} color="accent" />
                                <ThemedText variant="bodySmall" style={styles.predictionText}>
                                    {draft.imagePrediction}
                                </ThemedText>
                            </View>
                        </Card>
                    )}

                    {draft.audioPrediction && (
                        <Card style={styles.predictionCard}>
                            <View style={styles.predictionContent}>
                                <ThemedIcon name="mic" size={16} color="accent" />
                                <ThemedText variant="bodySmall" style={styles.predictionText}>
                                    {draft.audioPrediction}
                                </ThemedText>
                            </View>
                        </Card>
                    )}
                </View>
            )}
        </Card>
    );

    /**
     * Main Render
     * 
     * Structured layout with progress tracking, scrollable content sections,
     * and modal dialogs. Uses the new minimal design system throughout.
     */
    return (
        <ThemedView style={styles.container}>
            <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
            <Stack.Screen options={{ headerShown: false }} />

            {/* Progress Header */}
            <ThemedView background="surface" elevated style={styles.header}>
                <ThemedText variant="h2" style={styles.headerTitle}>
                    {t('log.manual_entry')}
                </ThemedText>

                <View style={styles.progressContainer}>
                    <ThemedText variant="label" color="secondary">
                        {completionPercentage}% {t('log.complete')}
                    </ThemedText>
                    <View style={dynamicStyles.progressBar}>
                        <View
                            style={[
                                dynamicStyles.progressFill,
                                {
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
            <ThemedView background="surface" elevated style={styles.saveButtonContainer}>
                <ThemedPressable
                    variant="primary"
                    onPress={handleSave}
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

            {/* Date Picker Modal */}
            {isDatePickerVisible && (
                <Modal
                    transparent
                    animationType="slide"
                    visible={isDatePickerVisible}
                    onRequestClose={() => setIsDatePickerVisible(false)}
                >
                    <BlurView intensity={80} style={styles.modalContainer}>
                        <Card style={styles.datePickerCard}>
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
                                        <ThemedText variant="button">
                                            {t('common.cancel')}
                                        </ThemedText>
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
                        </Card>
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
                    <View style={dynamicStyles.videoModalControls}>
                        <ThemedPressable
                            variant="secondary"
                            onPress={() => setIsVideoModalVisible(false)}
                            style={styles.videoButton}
                        >
                            <ThemedIcon name="x" size={20} color="primary" />
                            <ThemedText variant="button">
                                {t('common.close')}
                            </ThemedText>
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
                <View style={dynamicStyles.modalOverlay}>
                    <BlurView intensity={80} style={styles.modalBlur}>
                        <View style={dynamicStyles.predictionsModalContainer}>
                            <View style={dynamicStyles.predictionsHeader}>
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
                                        style={[dynamicStyles.predictionItem, { backgroundColor: colors.surface }]}
                                        onPress={() => handleSelectPrediction(prediction)}
                                    >
                                        <View style={styles.predictionItemContent}>
                                            <View style={dynamicStyles.predictionInfo}>
                                                <ThemedText variant="body" style={styles.predictionCommonName}>
                                                    {prediction.common_name}
                                                </ThemedText>
                                                <ThemedText variant="bodySmall" color="secondary" style={styles.predictionScientificName}>
                                                    {prediction.scientific_name}
                                                </ThemedText>
                                            </View>
                                            <View style={styles.predictionConfidence}>
                                                <ThemedText variant="label" color="primary">
                                                    {AudioIdentificationService.formatConfidenceScore(prediction.confidence)}
                                                </ThemedText>
                                                <ThemedIcon name="chevron-right" size={20} color="secondary" />
                                            </View>
                                        </View>
                                    </ThemedPressable>
                                ))}
                            </ScrollView>
                            
                            <View style={dynamicStyles.predictionsFooter}>
                                <ThemedText variant="bodySmall" color="secondary" style={styles.predictionsDisclaimer}>
                                    {t('birdnet.disclaimer', 'Tap a prediction to select it. Results are AI-generated and may not be 100% accurate.')}
                                </ThemedText>
                            </View>
                        </View>
                    </BlurView>
                </View>
            </Modal>

            <SnackbarComponent />
        </ThemedView>
    );
}

/**
 * Styles
 * 
 * Minimal, clean styling using the new design system principles.
 * Focuses on consistency, accessibility, and visual hierarchy.
 */
const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'transparent',
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
    sectionCard: {
        marginBottom: 16,
    },
    sectionTitle: {
        marginBottom: 16,
        fontWeight: '600',
    },
    bottomSpacer: {
        height: 100,
    },

    // Media Section
    mediaGrid: {
        gap: 16,
    },
    mediaCard: {
        borderRadius: 12,
        overflow: 'hidden',
    },
    mediaCardInner: {
        height: 120,
        justifyContent: 'center',
        alignItems: 'center',
        margin: 0,
        padding: 0,
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
        borderRadius: 12,
        overflow: 'hidden',
    },
    metadataCardInner: {
        padding: 0,
        margin: 0,
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
        borderTopColor: 'transparent',
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
    videoButton: {
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: 20,
    },

    // Bird Identification Styles
    identificationSection: {
        marginTop: 16,
        gap: 12,
    },
    identifyButton: {
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 60, // Increased height for timer display
    },
    identifyButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    identifyButtonTextContainer: {
        flex: 1,
        alignItems: 'center',
    },
    identifyButtonText: {
        fontWeight: '600',
        textAlign: 'center',
    },
    identifyStageText: {
        fontSize: 12,
        marginTop: 2,
        textAlign: 'center',
        fontStyle: 'italic',
    },
    identifyLoader: {
        marginRight: 4,
    },
    identifyIcon: {
        marginRight: 4,
    },
    predictionInfoText: {
        flex: 1,
    },

    // Predictions Modal Styles
    modalBlur: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalCloseButton: {
        padding: 8,
        borderRadius: 8,
    },
    predictionsScrollView: {
        maxHeight: 300,
    },
    predictionItemContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
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
    predictionsDisclaimer: {
        textAlign: 'center',
        lineHeight: 20,
    },
});