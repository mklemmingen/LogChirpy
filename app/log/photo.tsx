/**
 * Professional Photo Capture and Selection Screen
 * 
 * Provides a modern interface with professional camera controls and ML-powered 
 * bird identification. Follows the same patterns as audio.tsx and video.tsx.
 * Integrates with app gallery system and device storage.
 */

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {ActivityIndicator, Alert, Dimensions, Image, ScrollView, StatusBar, StyleSheet, View,} from 'react-native';
import {router, Stack} from 'expo-router';
import {useTranslation} from 'react-i18next';
import {ImageLibraryOptions, ImagePickerResponse, launchImageLibrary} from 'react-native-image-picker';
import {CameraType, CameraView, FlashMode, useCameraPermissions} from 'expo-camera';
import * as Haptics from 'expo-haptics';
import {BlurView} from 'expo-blur';
import {useImageLabeling} from "@infinitered/react-native-mlkit-image-labeling";
import Animated, {useAnimatedStyle, useSharedValue, withTiming,} from 'react-native-reanimated';

// Components
import {ThemedView} from '@/components/ThemedView';
import {ThemedText} from '@/components/ThemedText';
import {ThemedPressable} from '@/components/ThemedPressable';
import {ThemedIcon} from '@/components/ThemedIcon';
import {ThemedSafeAreaView} from '@/components/ThemedSafeAreaView';
import {ModernCard} from '@/components/ModernCard';
import {useSnackbar} from '@/components/ThemedSnackbar';
import {BackButton} from '@/components/BackButton';

// Context and Services
import {useLogDraft} from '@/contexts/LogDraftContext';
import {photoStorageService} from '@/services/photoStorageService';
import {filePathToUri} from '@/services/uriUtils';

// Theme
import {useColors, useTheme} from '@/hooks/useThemeColor';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const AnimatedPressable = Animated.createAnimatedComponent(ThemedPressable);

type PhotoState = 'selection' | 'camera' | 'gallery' | 'preview' | 'processing';

interface BirdPrediction {
    text: string;
    confidence: number;
    index: number;
}

// Photo Selection Screen Component
function PhotoSelectionScreen({ 
    onCamera, 
    onGallery, 
    onAppGallery 
}: { 
    onCamera: () => void; 
    onGallery: () => void;
    onAppGallery: () => void;
}) {
    const { t } = useTranslation();
    const theme = useTheme();
    const colors = useColors();

    const scale = useSharedValue(0.95);
    const opacity = useSharedValue(0);

    useEffect(() => {
        scale.value = withTiming(1, { duration: 300 });
        opacity.value = withTiming(1, { duration: 200 });
    }, []);

    const containerStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: opacity.value,
    }));

    return (
        <ThemedSafeAreaView style={styles.container}>
            <StatusBar barStyle={colors.isDark ? 'light-content' : 'dark-content'} />
            
            {/* Header */}
            <ThemedView style={styles.selectionHeader}>
                <BackButton variant="inline" />
                <ThemedText variant="h3" style={{ marginLeft: 8 }}>
                    {t('photo.add_photo', 'Add Photo')}
                </ThemedText>
            </ThemedView>

            <View style={styles.selectionContent}>
                <Animated.View style={[styles.selectionInfo, containerStyle]}>
                    <View style={[styles.iconContainer, { backgroundColor: theme.colors.primary + '20' }]}>
                        <ThemedIcon name="camera" size={48} color="primary" />
                    </View>

                    <ThemedText variant="h2" style={styles.selectionTitle}>
                        {t('photo.capture_or_select', 'Capture or Select')}
                    </ThemedText>

                    <ThemedText variant="body" color="secondary" style={styles.selectionSubtitle}>
                        {t('photo.professional_camera_description', 'Use professional camera controls or select from gallery')}
                    </ThemedText>
                </Animated.View>

                <View style={styles.selectionActions}>
                    <AnimatedPressable
                        variant="primary"
                        size="lg"
                        onPress={onCamera}
                        style={styles.selectionButton}
                    >
                        <ThemedIcon name="camera" size={24} color="inverse" />
                        <ThemedText variant="button" color="inverse">
                            {t('photo.professional_camera', 'Professional Camera')}
                        </ThemedText>
                    </AnimatedPressable>

                    <AnimatedPressable
                        variant="secondary"
                        size="lg"
                        onPress={onGallery}
                        style={styles.selectionButton}
                    >
                        <ThemedIcon name="image" size={24} color="primary" />
                        <ThemedText variant="button" color="primary">
                            {t('photo.device_gallery', 'Device Gallery')}
                        </ThemedText>
                    </AnimatedPressable>

                    <AnimatedPressable
                        variant="ghost"
                        size="lg"
                        onPress={onAppGallery}
                        style={styles.selectionButton}
                    >
                        <ThemedIcon name="folder" size={24} color="primary" />
                        <ThemedText variant="button" color="primary">
                            {t('photo.app_gallery', 'App Gallery')}
                        </ThemedText>
                    </AnimatedPressable>
                </View>
            </View>
        </ThemedSafeAreaView>
    );
}

// Professional Camera Interface Component
function CameraInterface({ 
    onPhotoCapture, 
    onBack 
}: { 
    onPhotoCapture: (photoUri: string) => void; 
    onBack: () => void;
}) {
    const { t } = useTranslation();
    const colors = useColors();
    const [permission, requestPermission] = useCameraPermissions();
    const cameraRef = useRef<CameraView>(null);

    const [facing, setFacing] = useState<CameraType>('back');
    const [flash, setFlash] = useState<FlashMode>('auto');
    const [isCapturing, setIsCapturing] = useState(false);
    const [showGrid, setShowGrid] = useState(false);
    const [zoom, setZoom] = useState(0);
    const [enableTorch, setEnableTorch] = useState(false);

    // Request permissions on mount
    useEffect(() => {
        if (!permission?.granted) {
            requestPermission();
        }
    }, [permission, requestPermission]);

    const handleTakePhoto = useCallback(async () => {
        if (!cameraRef.current || isCapturing) return;

        setIsCapturing(true);
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

            const photo = await cameraRef.current.takePictureAsync({
                quality: 0.8,
                base64: false,
                skipProcessing: false,
            });

            if (photo && photo.uri) {
                onPhotoCapture(photo.uri);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
        } catch (error) {
            console.error('Photo capture failed:', error);
            Alert.alert(t('common.error', 'Error'), t('photo.capture_failed', 'Failed to capture photo'));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            setIsCapturing(false);
        }
    }, [isCapturing, onPhotoCapture, t]);

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
                        {t('camera.permission_message', 'LogChirpy needs camera access to take photos')}
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
            <StatusBar barStyle="light-content" />

            {/* Camera */}
            <CameraView
                ref={cameraRef}
                style={StyleSheet.absoluteFillObject}
                facing={facing}
                flash={flash}
                enableTorch={enableTorch}
                zoom={zoom}
                autofocus="on"
                mode="picture"
            />

            {/* Grid Overlay */}
            {showGrid && (
                <View style={styles.gridOverlay}>
                    <View style={styles.gridLine} />
                    <View style={[styles.gridLine, styles.gridLineVertical]} />
                    <View style={[styles.gridLine, styles.gridLineHorizontal1]} />
                    <View style={[styles.gridLine, styles.gridLineHorizontal2]} />
                </View>
            )}

            {/* Top Controls */}
            <View style={styles.cameraTopControls}>
                <BackButton variant="floating" onPress={onBack} />
                
                <View style={styles.cameraTopRight}>
                    <ThemedPressable
                        variant="ghost"
                        onPress={() => setShowGrid(!showGrid)}
                        style={[styles.cameraControlButton, { backgroundColor: colors.background + 'CC' }]}
                    >
                        <ThemedIcon name="grid" size={20} color={showGrid ? "primary" : "secondary"} />
                    </ThemedPressable>

                    <ThemedPressable
                        variant="ghost"
                        onPress={toggleTorch}
                        style={[styles.cameraControlButton, { backgroundColor: colors.background + 'CC' }]}
                    >
                        <ThemedIcon name="zap" size={20} color={enableTorch ? "primary" : "secondary"} />
                    </ThemedPressable>

                    <ThemedPressable
                        variant="ghost"
                        onPress={toggleFlash}
                        style={[styles.cameraControlButton, { backgroundColor: colors.background + 'CC' }]}
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
                    style={[styles.zoomButton, { backgroundColor: colors.background + 'CC' }]}
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
                                // Touch handler for manual zoom control
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
                    style={[styles.zoomButton, { backgroundColor: colors.background + 'CC' }]}
                >
                    <ThemedIcon name="plus" size={16} color="primary" />
                </ThemedPressable>
            </View>

            {/* Bottom Controls */}
            <View style={styles.cameraBottomControls}>
                <View style={styles.cameraControlsRow}>
                    {/* Gallery Preview */}
                    <View style={styles.galleryPreview}>
                        <ThemedIcon name="image" size={24} color="secondary" />
                    </View>

                    {/* Capture Button */}
                    <ThemedPressable
                        variant="ghost"
                        onPress={handleTakePhoto}
                        disabled={isCapturing}
                        style={[
                            styles.captureButton,
                            ...(isCapturing ? [styles.capturingButton] : [])
                        ]}
                    >
                        <View style={styles.captureInner} />
                    </ThemedPressable>

                    {/* Flip Camera */}
                    <ThemedPressable
                        variant="ghost"
                        onPress={toggleCameraFacing}
                        style={styles.flipButton}
                    >
                        <ThemedIcon name="rotate-ccw" size={24} color="primary" />
                    </ThemedPressable>
                </View>
            </View>

            {/* Capturing Overlay */}
            {isCapturing && (
                <View style={styles.capturingOverlay}>
                    <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFillObject} />
                    <ActivityIndicator size="large" color="white" />
                    <ThemedText variant="body" style={{ color: 'white', marginTop: 16 }}>
                        {t('photo.capturing', 'Capturing...')}
                    </ThemedText>
                </View>
            )}
        </ThemedView>
    );
}

// Photo Preview Component with ML Integration
function PhotoPreview({
    photoUri,
    onRetake,
    onConfirm,
}: {
    photoUri: string;
    onRetake: () => void;
    onConfirm: () => void;
}) {
    const { t } = useTranslation();
    const colors = useColors();
    const theme = useTheme();
    const { update } = useLogDraft();
    const { SnackbarComponent, showSuccess, showError } = useSnackbar();
    
    // ML State
    const [isIdentifying, setIsIdentifying] = useState(false);
    const [predictions, setPredictions] = useState<BirdPrediction[]>([]);
    const [showPredictions, setShowPredictions] = useState(false);
    const [processingTime, setProcessingTime] = useState(0);
    
    // MLKit hooks
    const classifier = useImageLabeling('birdClassifier');
    const mlReady = !!(classifier && typeof classifier.classifyImage === 'function');

    // Process image with MLKit
    const handleIdentifyBird = useCallback(async () => {
        if (!mlReady || isIdentifying) return;

        setIsIdentifying(true);
        const startTime = Date.now();

        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            
            const results = await classifier?.classifyImage(photoUri) || [];
            const endTime = Date.now();
            setProcessingTime((endTime - startTime) / 1000);

            if (results && results.length > 0) {
                const birdPredictions = results
                    .filter((r: BirdPrediction) => r.confidence > 0.1)
                    .sort((a: BirdPrediction, b: BirdPrediction) => b.confidence - a.confidence)
                    .slice(0, 5);
                
                setPredictions(birdPredictions);
                setShowPredictions(true);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } else {
                showError(t('photo.no_bird_detected', 'No bird detected in image'));
            }
        } catch (error) {
            console.error('ML identification error:', error);
            showError(t('photo.identification_failed', 'Failed to identify bird'));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            setIsIdentifying(false);
        }
    }, [mlReady, isIdentifying, classifier, photoUri, showError, t]);

    const handleSelectPrediction = useCallback((prediction: BirdPrediction) => {
        update({ 
            imagePrediction: prediction.text,
            birdType: prediction.text 
        });
        setShowPredictions(false);
        showSuccess(t('photo.bird_identified', 'Bird identified: {{bird}}', { bird: prediction.text }));
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, [update, showSuccess, t]);

    return (
        <ThemedView style={styles.container}>
            <StatusBar barStyle="light-content" />

            {/* Image Preview */}
            <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFillObject} resizeMode="contain" />

            {/* Header */}
            <View style={styles.previewHeader}>
                <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFillObject} />
                <BackButton variant="floating" style={styles.previewBackButton} />
                <ThemedText variant="h3" style={styles.previewTitle}>
                    {t('photo.preview_title', 'Photo Preview')}
                </ThemedText>
            </View>

            {/* AI Identification Button */}
            {mlReady && (
                <View style={styles.aiButtonContainer}>
                    <AnimatedPressable
                        variant="primary"
                        onPress={handleIdentifyBird}
                        disabled={isIdentifying}
                        style={[styles.aiButton, { backgroundColor: colors.primary }]}
                    >
                        {isIdentifying ? (
                            <>
                                <ActivityIndicator size="small" color={colors.textInverse} />
                                <ThemedText variant="button" style={{ color: colors.textInverse }}>
                                    {t('photo.identifying', 'Identifying...')}
                                </ThemedText>
                            </>
                        ) : (
                            <>
                                <ThemedIcon name="zap" size={20} color="inverse" />
                                <ThemedText variant="button" style={{ color: colors.textInverse }}>
                                    {t('photo.identify_bird', 'AI Identify Bird')}
                                </ThemedText>
                            </>
                        )}
                    </AnimatedPressable>
                </View>
            )}

            {/* Controls */}
            <View style={styles.previewControls}>
                <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFillObject} />

                <View style={styles.previewActions}>
                    <AnimatedPressable
                        variant="secondary"
                        style={[styles.previewButton, { backgroundColor: colors.surface + '33' }]}
                        onPress={onRetake}
                    >
                        <ThemedIcon name="refresh-cw" size={20} color="primary" />
                        <ThemedText style={[styles.buttonText, { color: 'white' }]}>
                            {t('camera.retake', 'Retake')}
                        </ThemedText>
                    </AnimatedPressable>

                    <AnimatedPressable
                        variant="primary"
                        style={[styles.previewButton]}
                        onPress={onConfirm}
                    >
                        <ThemedIcon name="check" size={20} color="inverse" />
                        <ThemedText style={[styles.buttonText, { color: colors.textInverse }]}>
                            {t('common.confirm', 'Confirm')}
                        </ThemedText>
                    </AnimatedPressable>
                </View>
            </View>

            {/* Predictions Modal */}
            {showPredictions && (
                <View style={styles.predictionsOverlay}>
                    <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFillObject} />
                    
                    <ModernCard elevated={true} style={styles.predictionsCard}>
                        <View style={styles.predictionsHeader}>
                            <ThemedText variant="h3">
                                {t('photo.bird_predictions', 'Bird Predictions')}
                            </ThemedText>
                            <ThemedText variant="caption" color="secondary">
                                {t('photo.processing_time', 'Processed in {{time}}s', { time: processingTime.toFixed(1) })}
                            </ThemedText>
                        </View>

                        <ScrollView style={styles.predictionsList} showsVerticalScrollIndicator={false}>
                            {predictions.map((prediction, index) => (
                                <ThemedPressable
                                    key={index}
                                    variant="ghost"
                                    onPress={() => handleSelectPrediction(prediction)}
                                    style={styles.predictionItem}
                                >
                                    <View style={styles.predictionContent}>
                                        <ThemedText variant="body">
                                            {prediction.text}
                                        </ThemedText>
                                        <View style={styles.confidenceContainer}>
                                            <View style={[
                                                styles.confidenceBar,
                                                { backgroundColor: theme.colors.background.secondary }
                                            ]}>
                                                <View
                                                    style={[
                                                        styles.confidenceFill,
                                                        {
                                                            backgroundColor: theme.colors.primary,
                                                            width: `${prediction.confidence * 100}%`,
                                                        }
                                                    ]}
                                                />
                                            </View>
                                            <ThemedText variant="caption" color="secondary">
                                                {Math.round(prediction.confidence * 100)}%
                                            </ThemedText>
                                        </View>
                                    </View>
                                </ThemedPressable>
                            ))}
                        </ScrollView>

                        <ThemedPressable
                            variant="secondary"
                            onPress={() => setShowPredictions(false)}
                            style={styles.closeButton}
                        >
                            <ThemedText variant="button">
                                {t('common.close', 'Close')}
                            </ThemedText>
                        </ThemedPressable>
                    </ModernCard>
                </View>
            )}

            <SnackbarComponent />
        </ThemedView>
    );
}

// Main Photo Screen Component
export default function PhotoScreen() {
    const { t } = useTranslation();
    const { update } = useLogDraft();
    const { SnackbarComponent, showSuccess, showError } = useSnackbar();

    const [state, setState] = useState<PhotoState>('selection');
    const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Handle camera capture
    const handleCameraCapture = useCallback((photoUri: string) => {
        setCapturedPhoto(photoUri);
        setState('preview');
    }, []);

    // Handle gallery selection
    const handleGalleryPick = useCallback(async () => {
        try {
            const options: ImageLibraryOptions = {
                mediaType: 'photo',
                maxWidth: 2048,
                maxHeight: 2048,
                includeBase64: false,
                selectionLimit: 1,
            };

            launchImageLibrary(options, (response: ImagePickerResponse) => {
                if (response.didCancel || response.errorMessage) {
                    if (response.errorMessage) {
                        console.error('Image picker error:', response.errorMessage);
                        showError(t('photo.gallery_error', 'Failed to access gallery'));
                    }
                    return;
                }

                if (response.assets && response.assets[0]) {
                    const asset = response.assets[0];
                    if (asset.uri) {
                        const formattedUri = filePathToUri(asset.uri);
                        setCapturedPhoto(formattedUri);
                        setState('preview');
                        Haptics.selectionAsync();
                    }
                }
            });
        } catch (error) {
            console.error('Gallery picker error:', error);
            showError(t('photo.gallery_error', 'Failed to access gallery'));
        }
    }, [showError, t]);

    // Handle app gallery navigation
    const handleAppGallery = useCallback(() => {
        // Navigate to app gallery with selection mode
        router.push('/(tabs)/gallery?selectMode=true');
    }, []);

    // Handle photo confirmation and saving
    const handleConfirm = useCallback(async () => {
        if (!capturedPhoto || isSaving) return;

        setIsSaving(true);
        setState('processing');

        try {
            // Save photo using the storage service
            const result = await photoStorageService.savePhoto(capturedPhoto, {
                saveToDevice: true,
                filename: undefined, // Let service generate filename
                addMetadata: true
            });

            if (result.success) {
                // Update draft with the app directory URI
                update({ imageUri: result.appUri });
                
                showSuccess(t('photo.saved_successfully', 'Photo saved successfully'));
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                
                // Navigate back to manual screen
                router.back();
            } else {
                throw new Error(result.error || 'Save failed');
            }
        } catch (error) {
            console.error('Photo save failed:', error);
            showError(t('photo.save_failed', 'Failed to save photo'));
            setState('preview'); // Return to preview on error
        } finally {
            setIsSaving(false);
        }
    }, [capturedPhoto, isSaving, update, showSuccess, showError, t]);

    // Handle retake
    const handleRetake = useCallback(() => {
        setCapturedPhoto(null);
        setState('selection');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, []);

    // Render based on current state
    const renderCurrentState = () => {
        switch (state) {
            case 'camera':
                return (
                    <CameraInterface
                        onPhotoCapture={handleCameraCapture}
                        onBack={() => setState('selection')}
                    />
                );

            case 'preview':
                return capturedPhoto ? (
                    <PhotoPreview
                        photoUri={capturedPhoto}
                        onRetake={handleRetake}
                        onConfirm={handleConfirm}
                    />
                ) : null;

            case 'processing':
                return (
                    <ThemedSafeAreaView style={styles.container}>
                        <View style={styles.processingContainer}>
                            <ActivityIndicator size="large" color="#007AFF" />
                            <ThemedText variant="h3" style={styles.processingText}>
                                {t('photo.saving', 'Saving photo...')}
                            </ThemedText>
                            <ThemedText variant="body" color="secondary" style={styles.processingSubtext}>
                                {t('photo.saving_description', 'Saving to app gallery and device')}
                            </ThemedText>
                        </View>
                    </ThemedSafeAreaView>
                );

            case 'selection':
            default:
                return (
                    <PhotoSelectionScreen
                        onCamera={() => setState('camera')}
                        onGallery={handleGalleryPick}
                        onAppGallery={handleAppGallery}
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
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
    },

    // Selection Screen
    selectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.1)',
    },
    selectionContent: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 24,
        gap: 48,
    },
    selectionInfo: {
        alignItems: 'center',
        gap: 16,
    },
    iconContainer: {
        width: 96,
        height: 96,
        borderRadius: 48,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    selectionTitle: {
        textAlign: 'center',
        fontWeight: '700',
    },
    selectionSubtitle: {
        textAlign: 'center',
        lineHeight: 24,
    },
    selectionActions: {
        gap: 16,
    },
    selectionButton: {
        flexDirection: 'row',
        gap: 12,
        paddingVertical: 16,
    },

    // Camera Interface
    cameraTopControls: {
        position: 'absolute',
        top: 50,
        left: 20,
        right: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        zIndex: 10,
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
    captureButton: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'white',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 4,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    capturingButton: {
        transform: [{ scale: 0.95 }],
    },
    captureInner: {
        width: 60,
        height: 60,
        borderRadius: 30,
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
    gridOverlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 5,
    },
    gridLine: {
        position: 'absolute',
        backgroundColor: 'rgba(255,255,255,0.3)',
    },
    gridLineVertical: {
        width: 1,
        height: '100%',
        left: '33.33%',
    },
    gridLineHorizontal1: {
        height: 1,
        width: '100%',
        top: '33.33%',
    },
    gridLineHorizontal2: {
        height: 1,
        width: '100%',
        top: '66.66%',
    },
    capturingOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 20,
    },

    // Zoom Controls
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

    // Permission Error
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

    // Preview Screen (reusing existing styles)
    previewHeader: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        paddingTop: 60,
        paddingBottom: 20,
        paddingHorizontal: 24,
        zIndex: 10,
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
    },
    previewBackButton: {
        position: 'absolute',
        left: 0,
        top: 0,
        zIndex: 11,
    },
    previewTitle: {
        color: 'white',
        textAlign: 'center',
    },
    previewControls: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingBottom: 40,
        paddingTop: 20,
        paddingHorizontal: 24,
        overflow: 'hidden',
    },
    previewActions: {
        flexDirection: 'row',
        gap: 16,
    },
    previewButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderRadius: 16,
        gap: 8,
    },
    buttonText: {
        fontSize: 16,
        fontWeight: '600',
    },

    // AI Button
    aiButtonContainer: {
        position: 'absolute',
        top: 120,
        left: 24,
        right: 24,
        zIndex: 10,
    },
    aiButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 12,
    },

    // Predictions (reusing existing styles)
    predictionsOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 20,
    },
    predictionsCard: {
        width: SCREEN_WIDTH - 48,
        maxHeight: '70%',
        padding: 24,
    },
    predictionsHeader: {
        alignItems: 'center',
        marginBottom: 20,
        gap: 4,
    },
    predictionsList: {
        maxHeight: 300,
    },
    predictionItem: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        marginBottom: 8,
    },
    predictionContent: {
        gap: 8,
    },
    confidenceContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    confidenceBar: {
        flex: 1,
        height: 4,
        borderRadius: 2,
        overflow: 'hidden',
    },
    confidenceFill: {
        height: '100%',
        borderRadius: 2,
    },
    closeButton: {
        marginTop: 16,
        alignSelf: 'center',
        paddingHorizontal: 32,
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