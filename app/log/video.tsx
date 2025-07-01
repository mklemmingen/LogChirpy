/**
 * Professional Video Recording Screen
 * 
 * Uses expo-camera for consistent API with photo.tsx and reliable video recording.
 * Saves videos to app gallery and device storage.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, StyleSheet, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { CameraType, CameraView, FlashMode, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

// Components
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedPressable } from '@/components/ThemedPressable';
import { ThemedIcon } from '@/components/ThemedIcon';
import { ThemedSafeAreaView } from '@/components/ThemedSafeAreaView';
import { ModernCard } from '@/components/ModernCard';
import { useSnackbar } from '@/components/ThemedSnackbar';
import { BackButton } from '@/components/BackButton';

// Context and Services
import { useLogDraft } from '@/contexts/LogDraftContext';
import { photoStorageService } from '@/services/photoStorageService';
import { filePathToUri } from '@/services/uriUtils';

// Theme
import { useColors, useTheme } from '@/hooks/useThemeColor';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const AnimatedPressable = Animated.createAnimatedComponent(ThemedPressable);

type VideoState = 'camera' | 'recording' | 'processing';

// Professional Video Camera Interface Component
function VideoCameraInterface({
    onVideoCapture,
    onBack
}: {
    onVideoCapture: (videoUri: string) => void;
    onBack: () => void;
}) {
    const { t } = useTranslation();
    const colors = useColors();
    const [permission, requestPermission] = useCameraPermissions();
    const cameraRef = useRef<CameraView>(null);

    const [facing, setFacing] = useState<CameraType>('back');
    const [flash, setFlash] = useState<FlashMode>('auto');
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [zoom, setZoom] = useState(0);
    const [enableTorch, setEnableTorch] = useState(false);

    // Timer ref for recording duration
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Request permissions on mount
    useEffect(() => {
        if (!permission?.granted) {
            requestPermission();
        }
    }, [permission, requestPermission]);

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, []);

    const startRecording = useCallback(async () => {
        if (!cameraRef.current || isRecording) return;

        setIsRecording(true);
        setRecordingTime(0);
        
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

            // Start timer
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);

            const video = await cameraRef.current.recordAsync({
                maxDuration: 60, // 60 seconds max
            });

            if (video && video.uri) {
                onVideoCapture(video.uri);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
        } catch (error) {
            console.error('Video recording failed:', error);
            Alert.alert(t('common.error', 'Error'), t('video.recording_failed', 'Failed to record video'));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            setIsRecording(false);
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        }
    }, [isRecording, onVideoCapture, t]);

    const stopRecording = useCallback(async () => {
        if (!cameraRef.current || !isRecording) return;

        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            await cameraRef.current.stopRecording();
        } catch (error) {
            console.error('Stop recording failed:', error);
        }
    }, [isRecording]);

    const handleToggleRecording = useCallback(() => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    }, [isRecording, startRecording, stopRecording]);

    const toggleCameraFacing = () => {
        setFacing(current => (current === 'back' ? 'front' : 'back'));
        Haptics.selectionAsync();
    };

    const toggleFlash = () => {
        const flashModes: FlashMode[] = ['off', 'auto', 'on'];
        const currentIndex = flashModes.indexOf(flash);
        const nextIndex = (currentIndex + 1) % flashModes.length;
        setFlash(flashModes[nextIndex]);
        Haptics.selectionAsync();
    };

    const toggleTorch = () => {
        setEnableTorch(prev => !prev);
        Haptics.selectionAsync();
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const getFlashIcon = () => {
        switch (flash) {
            case 'on': return 'zap';
            case 'auto': return 'zap';
            case 'off': return 'zap-off';
            default: return 'zap-off';
        }
    };

    if (!permission?.granted) {
        return (
            <ThemedSafeAreaView style={styles.container}>
                <ModernCard elevated={false} bordered={true} style={styles.permissionCard}>
                    <View style={styles.permissionIcon}>
                        <ThemedIcon name="camera-off" size={32} color="primary" />
                    </View>
                    <ThemedText variant="h2" style={styles.permissionTitle}>
                        {t('camera.permission_required', 'Camera Permission Required')}
                    </ThemedText>
                    <ThemedText variant="body" color="secondary" style={styles.permissionMessage}>
                        {t('camera.permission_message', 'LogChirpy needs camera access to record videos')}
                    </ThemedText>
                    <View style={styles.permissionActions}>
                        <ThemedPressable variant="secondary" onPress={onBack} style={styles.permissionButton}>
                            <ThemedText>{t('common.cancel', 'Cancel')}</ThemedText>
                        </ThemedPressable>
                        <ThemedPressable variant="primary" onPress={requestPermission} style={styles.permissionButton}>
                            <ThemedText color="inverse">{t('camera.grant_permission', 'Grant Permission')}</ThemedText>
                        </ThemedPressable>
                    </View>
                </ModernCard>
            </ThemedSafeAreaView>
        );
    }

    return (
        <ThemedView style={styles.container}>
            {/* Camera */}
            <CameraView
                ref={cameraRef}
                style={StyleSheet.absoluteFillObject}
                facing={facing}
                flash={flash}
                enableTorch={enableTorch}
                zoom={zoom}
                autofocus="on"
                mode="video"
            />

            {/* Recording Indicator */}
            {isRecording && (
                <View style={styles.recordingIndicator}>
                    <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFillObject} />
                    <View style={styles.recordingDot} />
                    <ThemedText style={styles.recordingText}>
                        REC {formatTime(recordingTime)}
                    </ThemedText>
                </View>
            )}

            {/* Top Controls */}
            <View style={styles.cameraTopControls}>
                <BackButton variant="floating" onPress={onBack} />

                <ThemedText variant="h3" style={styles.modeText}>
                    {t('video.mode_title', 'Video')}
                </ThemedText>

                <View style={styles.cameraTopRight}>
                    <ThemedPressable
                        variant="ghost"
                        onPress={toggleTorch}
                        disabled={isRecording}
                        style={[
                            styles.cameraControlButton,
                            { backgroundColor: colors.background + 'CC' },
                            ...(isRecording ? [styles.disabledButton] : [])
                        ]}
                    >
                        <ThemedIcon name="zap" size={20} color={enableTorch ? "primary" : "secondary"} />
                    </ThemedPressable>

                    <ThemedPressable
                        variant="ghost"
                        onPress={toggleFlash}
                        disabled={isRecording}
                        style={[
                            styles.cameraControlButton,
                            { backgroundColor: colors.background + 'CC' },
                            ...(isRecording ? [styles.disabledButton] : [])
                        ]}
                    >
                        <ThemedIcon name={getFlashIcon()} size={20} color="primary" />
                    </ThemedPressable>
                </View>
            </View>

            {/* Zoom Slider */}
            <View style={styles.zoomContainer}>
                <ThemedPressable
                    variant="ghost"
                    onPress={() => setZoom(Math.max(0, zoom - 0.1))}
                    disabled={isRecording}
                    style={[
                        styles.zoomButton,
                        { backgroundColor: colors.background + 'CC' },
                        ...(isRecording ? [styles.disabledButton] : [])
                    ]}
                >
                    <ThemedIcon name="minus" size={16} color="primary" />
                </ThemedPressable>

                <View style={[styles.zoomSliderContainer, { backgroundColor: colors.background + 'CC' }]}>
                    <View style={styles.zoomSlider}>
                        <View style={[styles.zoomTrack, { backgroundColor: colors.backgroundSecondary }]} />
                        <View
                            style={[
                                styles.zoomFill,
                                {
                                    backgroundColor: colors.primary,
                                    width: `${zoom * 100}%`
                                }
                            ]}
                        />
                        <ThemedPressable
                            variant="ghost"
                            style={[
                                styles.zoomThumb,
                                {
                                    backgroundColor: colors.primary,
                                    left: `${zoom * 100}%`
                                }
                            ]}
                            onPressIn={() => {
                                Haptics.selectionAsync();
                            }}
                        />
                    </View>
                    <ThemedText variant="caption" style={{ color: 'white', textAlign: 'center', marginTop: 4 }}>
                        {Math.round(zoom * 100)}%
                    </ThemedText>
                </View>

                <ThemedPressable
                    variant="ghost"
                    onPress={() => setZoom(Math.min(1, zoom + 0.1))}
                    disabled={isRecording}
                    style={[
                        styles.zoomButton,
                        { backgroundColor: colors.background + 'CC' },
                        ...(isRecording ? [styles.disabledButton] : [])
                    ]}
                >
                    <ThemedIcon name="plus" size={16} color="primary" />
                </ThemedPressable>
            </View>

            {/* Bottom Controls */}
            <View style={styles.cameraBottomControls}>
                <View style={styles.cameraControlsRow}>
                    {/* Gallery Preview */}
                    <ThemedPressable
                        variant="ghost"
                        onPress={() => router.push('/(tabs)/gallery')}
                        disabled={isRecording}
                        style={[styles.galleryPreview, ...(isRecording ? [styles.disabledButton] : [])]}
                    >
                        <ThemedIcon name="image" size={24} color="secondary" />
                    </ThemedPressable>

                    {/* Record Button */}
                    <ThemedPressable
                        variant="ghost"
                        onPress={handleToggleRecording}
                        style={[
                            styles.recordButton,
                            ...(isRecording ? [styles.recordingButton] : [])
                        ]}
                    >
                        <View style={[
                            styles.recordInner,
                            ...(isRecording ? [styles.recordingInner] : [])
                        ]} />
                    </ThemedPressable>

                    {/* Flip Camera */}
                    <ThemedPressable
                        variant="ghost"
                        onPress={toggleCameraFacing}
                        disabled={isRecording}
                        style={[styles.flipButton, ...(isRecording ? [styles.disabledButton] : [])]}
                    >
                        <ThemedIcon name="rotate-ccw" size={24} color="primary" />
                    </ThemedPressable>
                </View>
            </View>
        </ThemedView>
    );
}

// Main Video Screen Component
export default function VideoScreen() {
    const { t } = useTranslation();
    const { update } = useLogDraft();
    const { SnackbarComponent, showSuccess, showError } = useSnackbar();

    const [state, setState] = useState<VideoState>('camera');
    const [isSaving, setIsSaving] = useState(false);

    // Handle video capture and saving
    const handleVideoCapture = useCallback(async (videoUri: string) => {
        setIsSaving(true);
        setState('processing');

        try {
            const formattedUri = filePathToUri(videoUri);

            // Save video using the storage service (adapted for video)
            const result = await photoStorageService.savePhoto(formattedUri, {
                saveToDevice: true,
                filename: undefined, // Let service generate filename
                addMetadata: true
            });

            if (result.success) {
                // Update draft with the video URI
                update({
                    videoUri: result.appUri
                });

                showSuccess(t('video.saved_successfully', 'Video saved successfully'));
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

                // Navigate back to manual screen
                router.replace('/log/manual');
            } else {
                throw new Error(result.error || 'Save failed');
            }
        } catch (error) {
            console.error('Video save failed:', error);
            showError(t('video.save_failed', 'Failed to save video'));
            setState('camera'); // Return to camera on error
        } finally {
            setIsSaving(false);
        }
    }, [update, showSuccess, showError, t]);

    // Handle back navigation
    const handleBack = useCallback(() => {
        router.back();
    }, []);

    // Render based on current state
    const renderCurrentState = () => {
        switch (state) {
            case 'processing':
                return (
                    <ThemedSafeAreaView style={styles.container}>
                        <View style={styles.processingContainer}>
                            <ActivityIndicator size="large" color="#007AFF" />
                            <ThemedText variant="h3" style={styles.processingText}>
                                {t('video.saving', 'Saving video...')}
                            </ThemedText>
                            <ThemedText variant="body" color="secondary" style={styles.processingSubtext}>
                                {t('video.saving_description', 'Saving to app gallery and device')}
                            </ThemedText>
                        </View>
                    </ThemedSafeAreaView>
                );

            case 'camera':
            default:
                return (
                    <VideoCameraInterface
                        onVideoCapture={handleVideoCapture}
                        onBack={handleBack}
                    />
                );
        }
    };

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            {renderCurrentState()}
            <SnackbarComponent />
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },

    // Permission Screen
    permissionCard: {
        alignItems: 'center',
        padding: 32,
        margin: 24,
        maxWidth: 350,
        alignSelf: 'center',
    },
    permissionIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    permissionTitle: {
        textAlign: 'center',
        marginBottom: 12,
    },
    permissionMessage: {
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 32,
    },
    permissionActions: {
        flexDirection: 'row',
        gap: 16,
        width: '100%',
    },
    permissionButton: {
        flex: 1,
    },

    // Camera Interface
    cameraTopControls: {
        position: 'absolute',
        top: 50,
        left: 20,
        right: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 10,
    },
    modeText: {
        color: 'white',
        fontWeight: '600',
        textAlign: 'center',
    },
    cameraTopRight: {
        flexDirection: 'row',
        gap: 12,
    },
    cameraControlButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    disabledButton: {
        opacity: 0.5,
    },

    // Recording Indicator
    recordingIndicator: {
        position: 'absolute',
        top: 120,
        right: 20,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        zIndex: 10,
        overflow: 'hidden',
    },
    recordingDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#FF3B30',
        marginRight: 8,
    },
    recordingText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 14,
    },

    // Zoom Controls (from photo.tsx)
    zoomContainer: {
        position: 'absolute',
        right: 20,
        top: '50%',
        transform: [{ translateY: -100 }],
        alignItems: 'center',
        gap: 8,
        zIndex: 10,
    },
    zoomButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    zoomSliderContainer: {
        width: 36,
        height: 120,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    zoomSlider: {
        position: 'relative',
        width: 4,
        height: 80,
    },
    zoomTrack: {
        position: 'absolute',
        width: 4,
        height: '100%',
        borderRadius: 2,
    },
    zoomFill: {
        position: 'absolute',
        bottom: 0,
        width: 4,
        borderRadius: 2,
    },
    zoomThumb: {
        position: 'absolute',
        width: 12,
        height: 12,
        borderRadius: 6,
        marginLeft: -4,
        marginTop: -6,
        borderWidth: 2,
        borderColor: 'white',
    },

    // Bottom Controls
    cameraBottomControls: {
        position: 'absolute',
        bottom: 50,
        left: 0,
        right: 0,
        paddingHorizontal: 40,
        zIndex: 10,
    },
    cameraControlsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    galleryPreview: {
        width: 60,
        height: 60,
        borderRadius: 8,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    recordButton: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'white',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 4,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    recordingButton: {
        backgroundColor: '#FF3B30',
    },
    recordInner: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#FF3B30',
    },
    recordingInner: {
        width: 30,
        height: 30,
        borderRadius: 4,
        backgroundColor: 'white',
    },
    flipButton: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Processing Screen
    processingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
        gap: 24,
    },
    processingText: {
        textAlign: 'center',
    },
    processingSubtext: {
        textAlign: 'center',
        lineHeight: 24,
    },
});