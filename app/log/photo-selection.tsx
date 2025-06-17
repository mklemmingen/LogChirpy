/**
 * Photo Selection Screen
 * 
 * Allows users to select from multiple captured photos or a single gallery photo.
 * Integrates with ML-powered bird identification.
 */

import React, {useCallback, useEffect, useState} from 'react';
import {ActivityIndicator, Dimensions, Image, ScrollView, StyleSheet, TouchableOpacity, View,} from 'react-native';
import {router, Stack, useLocalSearchParams} from 'expo-router';
import {useTranslation} from 'react-i18next';
import {ThemedIcon} from '@/components/ThemedIcon';
import * as Haptics from 'expo-haptics';
import {BlurView} from 'expo-blur';
import {useImageLabeling} from "@infinitered/react-native-mlkit-image-labeling";

// Components
import {ThemedView} from '@/components/ThemedView';
import {ThemedText} from '@/components/ThemedText';
import {ThemedPressable} from '@/components/ThemedPressable';
import {ModernCard} from '@/components/ModernCard';
import {useSnackbar} from '@/components/ThemedSnackbar';
import {BackButton} from '@/components/BackButton';

// Context and Services
import {useLogDraft} from '@/contexts/LogDraftContext';
import {useColors, useTheme} from '@/hooks/useThemeColor';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PHOTO_SIZE = (SCREEN_WIDTH - 48) / 2;

interface BirdPrediction {
    text: string;
    confidence: number;
    index: number;
}

export default function PhotoSelection() {
    const { t } = useTranslation();
    const colors = useColors();
    const theme = useTheme();
    const { update } = useLogDraft();
    const params = useLocalSearchParams();
    const { SnackbarComponent, showSuccess, showError } = useSnackbar();

    const photos: string[] = params.photos ? JSON.parse(params.photos as string) : [];
    const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
    const [isIdentifying, setIsIdentifying] = useState(false);
    const [predictions, setPredictions] = useState<BirdPrediction[]>([]);
    const [showPredictions, setShowPredictions] = useState(false);
    const [processingTime, setProcessingTime] = useState(0);

    // MLKit hooks
    const classifier = useImageLabeling('birdClassifier');
    const mlReady = !!(classifier && typeof classifier.classifyImage === 'function');

    // Auto-select if only one photo
    useEffect(() => {
        if (photos.length === 1 && !selectedPhoto) {
            setSelectedPhoto(photos[0]);
        }
    }, [photos, selectedPhoto]);

    const handlePhotoSelect = (photoUri: string) => {
        setSelectedPhoto(photoUri);
        Haptics.selectionAsync();
    };

    // ML identification
    const handleIdentifyBird = useCallback(async () => {
        if (!mlReady || !selectedPhoto || isIdentifying) return;

        setIsIdentifying(true);
        const startTime = Date.now();

        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            
            const results = await classifier?.classifyImage(selectedPhoto) || [];
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
    }, [mlReady, selectedPhoto, isIdentifying, classifier, showError, t]);

    const handleSelectPrediction = useCallback((prediction: BirdPrediction) => {
        update({ 
            imagePrediction: prediction.text,
            birdType: prediction.text 
        });
        setShowPredictions(false);
        showSuccess(t('photo.bird_identified', 'Bird identified: {{bird}}', { bird: prediction.text }));
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        
        // Auto-confirm after successful identification
        setTimeout(() => handleConfirm(), 500);
    }, [update, showSuccess, t]);

    const handleConfirm = () => {
        if (selectedPhoto) {
            update({ imageUri: selectedPhoto });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            router.push('/log/manual');
        }
    };

    const handleRetakePhotos = () => {
        router.back();
    };

    return (
        <ThemedView style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />
            
            {/* Header */}
            <View style={styles.header}>
                <BackButton variant="floating" />

                <ThemedText variant="h2">
                    {photos.length > 1 ? t('photo.select_best_photo') : t('photo.review_photo')}
                </ThemedText>
                
                <ThemedText variant="bodySmall" color="secondary">
                    {photos.length > 1 ? t('photo.tap_to_select') : t('photo.review_and_identify')}
                </ThemedText>
            </View>

            {/* Photo Grid or Single Photo */}
            <ScrollView style={styles.photoContainer} contentContainerStyle={styles.photoContent}>
                {photos.length > 1 ? (
                    <View style={styles.photoGrid}>
                        {photos.map((photoUri, index) => (
                            <TouchableOpacity
                                key={index}
                                style={[
                                    styles.photoItem,
                                    selectedPhoto === photoUri && {
                                        borderColor: colors.primary,
                                        borderWidth: 3,
                                    }
                                ]}
                                onPress={() => handlePhotoSelect(photoUri)}
                            >
                                <Image source={{ uri: photoUri }} style={styles.photoImage} />
                                {selectedPhoto === photoUri && (
                                    <View style={[styles.selectedOverlay, { backgroundColor: colors.primary }]}>
                                        <ThemedIcon name="check" size={24} color="inverse" />
                                    </View>
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>
                ) : (
                    <View style={styles.singlePhotoContainer}>
                        <Image source={{ uri: photos[0] }} style={styles.singlePhoto} resizeMode="contain" />
                    </View>
                )}
            </ScrollView>

            {/* Actions */}
            <View style={styles.actions}>
                {/* AI Identify Button */}
                {mlReady && selectedPhoto && (
                    <ThemedPressable
                        variant="primary"
                        onPress={handleIdentifyBird}
                        disabled={isIdentifying}
                        style={styles.aiButton}
                    >
                        {isIdentifying ? (
                            <>
                                <ActivityIndicator size="small" color={colors.textInverse} />
                                <ThemedText variant="button" color="inverse">
                                    {t('photo.identifying', 'Identifying...')}
                                </ThemedText>
                            </>
                        ) : (
                            <>
                                <ThemedIcon name="zap" size={20} color="inverse" />
                                <ThemedText variant="button" color="inverse">
                                    {t('photo.identify_bird', 'AI Identify Bird')}
                                </ThemedText>
                            </>
                        )}
                    </ThemedPressable>
                )}

                <View style={styles.bottomActions}>
                    <ThemedPressable
                        variant="secondary"
                        onPress={handleRetakePhotos}
                        style={styles.actionButton}
                    >
                        <ThemedIcon name="camera" size={20} color="primary" />
                        <ThemedText variant="button">
                            {t('photo.take_more', 'Retake')}
                        </ThemedText>
                    </ThemedPressable>

                    <ThemedPressable
                        variant="primary"
                        onPress={handleConfirm}
                        disabled={!selectedPhoto}
                        style={[styles.actionButton, styles.primaryButton]}
                    >
                        <ThemedIcon name="check" size={20} color="inverse" />
                        <ThemedText variant="button" color="inverse">
                            {t('photo.use_this_photo', 'Use Photo')}
                        </ThemedText>
                    </ThemedPressable>
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

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        padding: 24,
        alignItems: 'center',
        gap: 8,
    },
    photoContainer: {
        flex: 1,
    },
    photoContent: {
        paddingHorizontal: 16,
    },
    photoGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
    },
    photoItem: {
        width: PHOTO_SIZE,
        height: PHOTO_SIZE,
        borderRadius: 12,
        overflow: 'hidden',
        position: 'relative',
    },
    photoImage: {
        width: '100%',
        height: '100%',
    },
    selectedOverlay: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    singlePhotoContainer: {
        flex: 1,
        minHeight: 300,
    },
    singlePhoto: {
        width: '100%',
        height: '100%',
    },
    actions: {
        padding: 24,
        gap: 16,
    },
    aiButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
    },
    bottomActions: {
        flexDirection: 'row',
        gap: 16,
    },
    actionButton: {
        flex: 1,
        flexDirection: 'row',
        gap: 8,
        justifyContent: 'center',
    },
    primaryButton: {
        flex: 2,
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