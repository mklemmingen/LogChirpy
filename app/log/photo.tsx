/**
 * Photo Capture and Selection Screen
 * 
 * Provides a modern interface for capturing or selecting bird photos with
 * ML-powered bird identification using MLKit Image Labeling.
 * Follows the same design patterns as video.tsx and audio.tsx.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    ScrollView,
    StatusBar,
    StyleSheet,
    View,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { launchImageLibrary, ImagePickerResponse, ImageLibraryOptions } from 'react-native-image-picker';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { useImageLabeling } from "@infinitered/react-native-mlkit-image-labeling";
import Animated, {
    Easing,
    interpolate,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
} from 'react-native-reanimated';

// Components
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedPressable } from '@/components/ThemedPressable';
import { ThemedIcon } from '@/components/ThemedIcon';
import { ModernCard } from '@/components/ModernCard';
import { useSnackbar } from '@/components/ThemedSnackbar';
import { BackButton } from '@/components/BackButton';

// Context and Services
import { useLogDraft } from '@/contexts/LogDraftContext';
import { filePathToUri } from '@/services/uriUtils';

// Theme
import { useColors, useTheme, useTypography } from '@/hooks/useThemeColor';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const AnimatedPressable = Animated.createAnimatedComponent(ThemedPressable);

interface BirdPrediction {
    text: string;
    confidence: number;
    index: number;
}

// Photo Options Component
function PhotoOptionsScreen({ onCamera, onGallery }: { onCamera: () => void; onGallery: () => void }) {
    const { t } = useTranslation();
    const theme = useTheme();
    const colors = useColors();
    const typography = useTypography();

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
        <ThemedView style={styles.container}>
            <StatusBar barStyle={colors.isDark ? 'light-content' : 'dark-content'} />
            
            <View style={styles.content}>
                <Animated.View style={[styles.header, containerStyle]}>
                    <View style={[styles.iconContainer, { backgroundColor: theme.colors.primary + '20' }]}>
                        <ThemedIcon name="camera" size={48} color="primary" />
                    </View>

                    <ThemedText variant="h1" style={styles.title}>
                        {t('photo.add_photo', 'Add Photo')}
                    </ThemedText>

                    <ThemedText variant="body" color="secondary" style={styles.subtitle}>
                        {t('photo.capture_description', 'Take a photo or choose from your gallery')}
                    </ThemedText>
                </Animated.View>

                <View style={styles.actions}>
                    <AnimatedPressable
                        variant="primary"
                        size="lg"
                        onPress={onCamera}
                        style={styles.actionButton}
                    >
                        <ThemedIcon name="camera" size={24} color="inverse" />
                        <ThemedText variant="button" color="inverse">
                            {t('photo.take_photos', 'Take Photo')}
                        </ThemedText>
                    </AnimatedPressable>

                    <AnimatedPressable
                        variant="secondary"
                        size="lg"
                        onPress={onGallery}
                        style={styles.actionButton}
                    >
                        <ThemedIcon name="image" size={24} color="primary" />
                        <ThemedText variant="button" color="primary">
                            {t('photo.choose_existing', 'Choose from Gallery')}
                        </ThemedText>
                    </AnimatedPressable>
                </View>
            </View>
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
            
            // Perform ML classification
            const results = await classifier?.classifyImage(photoUri) || [];
            const endTime = Date.now();
            setProcessingTime((endTime - startTime) / 1000);

            if (results && results.length > 0) {
                // Filter and sort predictions
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

    // Select a prediction
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
                <BackButton variant="floating" style={{ position: 'absolute', left: 0, top: 0 }} />
                <ThemedText variant="h3" style={{ color: 'white' }}>
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
                                                {
                                                    backgroundColor: theme.colors.background.secondary,
                                                }
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

export default function PhotoScreen() {
    const { t } = useTranslation();
    const { update } = useLogDraft();
    const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

    const handleGalleryPick = async () => {
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
                    }
                    return;
                }

                if (response.assets && response.assets[0]) {
                    const asset = response.assets[0];
                    if (asset.uri) {
                        const formattedUri = filePathToUri(asset.uri);
                        setSelectedPhoto(formattedUri);
                        Haptics.selectionAsync();
                    }
                }
            });
        } catch (error) {
            console.error('Gallery picker error:', error);
            Alert.alert(t('common.error', 'Error'), t('photo.gallery_error', 'Failed to open gallery'));
        }
    };

    const handleCameraLaunch = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push('/log/camera');
    };

    const handleRetake = () => {
        setSelectedPhoto(null);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const handleConfirm = () => {
        if (selectedPhoto) {
            update({ imageUri: selectedPhoto });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            router.back();
        }
    };

    if (selectedPhoto) {
        return (
            <PhotoPreview
                photoUri={selectedPhoto}
                onRetake={handleRetake}
                onConfirm={handleConfirm}
            />
        );
    }

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <PhotoOptionsScreen
                onCamera={handleCameraLaunch}
                onGallery={handleGalleryPick}
            />
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 24,
        gap: 48,
    },
    header: {
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
    title: {
        textAlign: 'center',
    },
    subtitle: {
        textAlign: 'center',
        lineHeight: 24,
    },
    actions: {
        gap: 16,
    },
    actionButton: {
        flexDirection: 'row',
        gap: 12,
        paddingVertical: 16,
    },

    // Preview styles
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

    // Predictions
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
});