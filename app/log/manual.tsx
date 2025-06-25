/**
 * Manual Bird Spotting Entry Screen - Clean Modern Design
 * 
 * A streamlined, intuitive interface for manually logging bird sightings.
 * Focus on essential functionality with a clean, accessible design.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Pressable,
    ScrollView,
    StatusBar,
    StyleSheet,
    TextInput,
    useColorScheme,
    View,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Audio } from 'expo-av';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system';
import { useImageLabeling } from "@infinitered/react-native-mlkit-image-labeling";
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';

// Context and Services
import { useLogDraft } from '@/contexts/LogDraftContext';
import { BirdSpotting, insertBirdSpotting } from '@/services/database';
import { classifyBirdAudio } from '@/services/ultraSimpleBirdClassifier';
import { validateImageUri } from '@/services/uriUtils';
import { searchBirdsByName } from '@/services/databaseBirDex';

// Components
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedPressable } from '@/components/ThemedPressable';
import { ThemedIcon } from '@/components/ThemedIcon';
import { useSnackbar } from '@/components/ThemedSnackbar';
import { ModernCard } from '@/components/ModernCard';

// Theme
import { useColors, useSpacing } from '@/hooks/useThemeColor';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface MediaItem {
    type: 'photo' | 'video' | 'audio';
    uri?: string;
    hasContent: boolean;
    route: string;
    icon: string;
    label: string;
}

interface BirdPrediction {
    text: string;
    confidence: number;
    index: number;
}

export default function ManualBirdEntry() {
    const { t } = useTranslation();
    const { draft, update, clear, isLoading: draftLoading } = useLogDraft();
    const colorScheme = useColorScheme() ?? 'light';
    const insets = useSafeAreaInsets();
    const colors = useColors();
    const spacing = useSpacing();
    const { SnackbarComponent, showSuccess, showError } = useSnackbar();

    // Refs for form inputs
    const birdTypeRef = useRef<TextInput>(null);
    const notesRef = useRef<TextInput>(null);
    const scientificNameRef = useRef<TextInput>(null);

    // State
    const [isSaving, setIsSaving] = useState(false);
    const [isLoadingLocation, setIsLoadingLocation] = useState(false);
    const [sound, setSound] = useState<Audio.Sound | null>(null);
    const [isIdentifying, setIsIdentifying] = useState(false);

    // Image AI state
    const [isIdentifyingImage, setIsIdentifyingImage] = useState(false);
    const [imagePredictions, setImagePredictions] = useState<BirdPrediction[]>([]);
    const [showImagePredictions, setShowImagePredictions] = useState(false);
    const [processingTime, setProcessingTime] = useState(0);

    // MLKit hook
    const classifier = useImageLabeling('birdClassifier');
    const mlReady = !!(classifier && typeof classifier.classifyImage === 'function');

    // Media items configuration
    const mediaItems: MediaItem[] = [
        {
            type: 'photo',
            uri: draft.imageUri,
            hasContent: !!draft.imageUri,
            route: '/log/photo',
            icon: 'camera',
            label: draft.imageUri ? 'Photo Added' : 'Add Photo'
        },
        {
            type: 'video',
            uri: draft.videoUri,
            hasContent: !!draft.videoUri,
            route: '/log/video',
            icon: 'video',
            label: draft.videoUri ? 'Video Added' : 'Add Video'
        },
        {
            type: 'audio',
            uri: draft.audioUri,
            hasContent: !!draft.audioUri,
            route: '/log/audio',
            icon: 'mic',
            label: draft.audioUri ? 'Audio Added' : 'Record Audio'
        }
    ];

    // Auto-identify bird from audio
    const handleAudioIdentification = useCallback(async () => {
        if (!draft.audioUri || isIdentifying) return;

        console.log('🤖 [Audio ID] Starting audio identification...');
        console.log('🤖 [Audio ID] Audio URI:', draft.audioUri);
        setIsIdentifying(true);
        try {
            const result = await classifyBirdAudio(draft.audioUri);
            const predictions = result.success ? result.predictions.map(pred => ({
                common_name: pred.commonName,
                scientific_name: pred.scientificName,
                confidence: pred.confidence
            })) : [];
            console.log('🤖 [Audio ID] Predictions received:', predictions);

            if (predictions && predictions.length > 0) {
                const topPrediction = predictions[0];
                console.log('🤖 [Audio ID] Top prediction:', topPrediction);
                update({
                    audioPrediction: topPrediction.common_name,
                    birdType: topPrediction.common_name
                });
                console.log('[Audio ID] Successfully identified bird');
                showSuccess(`Bird identified: ${topPrediction.common_name}`);
            } else {
                console.log('[Audio ID] No predictions found');
                showError('Could not identify bird from audio');
            }
        } catch (error) {
            console.error('[Audio ID] Identification error:', error);
            console.error('[Audio ID] Error details:', {
                message: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined
            });
            showError(`Failed to identify bird: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsIdentifying(false);
            console.log('[Audio ID] Audio identification completed');
        }
    }, [draft.audioUri, isIdentifying, update, showSuccess, showError]);

    // Get current location
    const handleGetLocation = useCallback(async () => {
        if (isLoadingLocation) return;

        console.log('[Location] Starting location request...');
        setIsLoadingLocation(true);
        try {
            console.log('[Location] Requesting permissions...');
            const { status } = await Location.requestForegroundPermissionsAsync();
            console.log('[Location] Permission status:', status);

            if (status !== 'granted') {
                console.log('[Location] Permission denied');
                showError('Location permission denied');
                return;
            }

            console.log('[Location] Getting current position...');
            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.High,
                timeInterval: 10000,
            });

            console.log('[Location] Location received:', location.coords);
            update({
                gpsLat: location.coords.latitude,
                gpsLng: location.coords.longitude
            });
            console.log('[Location] Location updated in draft');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            showSuccess('Location added');
        } catch (error) {
            console.error('[Location] Location error:', error);
            console.error('[Location] Error details:', {
                message: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined
            });
            showError(`Failed to get location: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsLoadingLocation(false);
            console.log('[Location] Location request completed');
        }
    }, [isLoadingLocation, update, showSuccess, showError]);

    // Play audio
    const handlePlayAudio = useCallback(async () => {
        if (!draft.audioUri) return;

        try {
            if (sound) {
                await sound.unloadAsync();
                setSound(null);
                return;
            }

            const { sound: newSound } = await Audio.Sound.createAsync(
                { uri: draft.audioUri },
                { shouldPlay: true }
            );

            setSound(newSound);
            newSound.setOnPlaybackStatusUpdate((status) => {
                if (status.isLoaded && status.didJustFinish) {
                    setSound(null);
                }
            });
        } catch (error) {
            console.error('[Audio Playback] Error:', error);
            showError('Failed to play audio');
        }
    }, [draft.audioUri, sound, showError]);

    // String matching functions (same as gallery.tsx smart-search logic)
    const calculateMatchScore = useCallback((query: string, target: string): number => {
        if (!target) return 0;

        const queryLower = query.toLowerCase().trim();
        const targetLower = target.toLowerCase().trim();

        // Exact match
        if (queryLower === targetLower) return 100;

        // Starts with query
        if (targetLower.startsWith(queryLower)) return 90;

        // Contains query
        if (targetLower.includes(queryLower)) return 80;

        // Word boundary matches
        const queryWords = queryLower.split(' ');
        const targetWords = targetLower.split(' ');

        let wordMatches = 0;
        let partialMatches = 0;

        for (const queryWord of queryWords) {
            for (const targetWord of targetWords) {
                if (targetWord === queryWord) {
                    wordMatches++;
                } else if (targetWord.includes(queryWord) || queryWord.includes(targetWord)) {
                    partialMatches++;
                }
            }
        }

        if (wordMatches > 0) return 70 + (wordMatches * 10);
        if (partialMatches > 0) return 50 + (partialMatches * 5);

        // Levenshtein distance for typos
        const distance = levenshteinDistance(queryLower, targetLower);
        const maxLength = Math.max(queryLower.length, targetLower.length);
        const similarity = (maxLength - distance) / maxLength;

        return Math.max(0, similarity * 60);
    }, []);

    const levenshteinDistance = (str1: string, str2: string): number => {
        const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

        for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
        for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

        for (let j = 1; j <= str2.length; j++) {
            for (let i = 1; i <= str1.length; i++) {
                const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
                matrix[j][i] = Math.min(
                    matrix[j][i - 1] + 1,     // deletion
                    matrix[j - 1][i] + 1,     // insertion
                    matrix[j - 1][i - 1] + indicator // substitution
                );
            }
        }

        return matrix[str2.length][str1.length];
    };

    const cleanBirdName = useCallback((rawName: string): string => {
        // Remove leading numbers and whitespace (e.g., "308 Rainbow Lorikeet" -> "Rainbow Lorikeet")
        const cleaned = rawName.replace(/^\d+\s+/, '').trim();
        return cleaned;
    }, []);

    const findBestMatchingBirdCode = useCallback((birdName: string): string | null => {
        try {
            const cleanedName = cleanBirdName(birdName);
            const dbResults = searchBirdsByName(cleanedName, 20);

            if (dbResults.length === 0) return null;

            let bestMatch = { score: 0, speciesCode: '', matchedName: '' };

            dbResults.forEach(bird => {
                const nameFields = [
                    { name: bird.english_name, label: 'english' },
                    { name: bird.scientific_name, label: 'scientific' },
                    { name: bird.de_name, label: 'german' },
                    { name: bird.es_name, label: 'spanish' },
                    { name: bird.ukrainian_name, label: 'ukrainian' },
                    { name: bird.ar_name, label: 'arabic' }
                ].filter(field => field.name);

                nameFields.forEach(field => {
                    if (field.name) {
                        const score = calculateMatchScore(cleanedName, field.name);
                        if (score > bestMatch.score) {
                            bestMatch = { score, speciesCode: bird.species_code, matchedName: field.name };
                        }
                    }
                });
            });

            // Return species code if confidence is above 30%
            return bestMatch.score > 30 ? bestMatch.speciesCode : null;
        } catch (error) {
            console.error('Error finding matching bird code:', error);
            return null;
        }
    }, [calculateMatchScore, cleanBirdName]);

    // Image AI identification
    const handleImageIdentification = useCallback(async () => {
        if (!mlReady || isIdentifyingImage || !draft.imageUri) return;

        setIsIdentifyingImage(true);
        const startTime = Date.now();

        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

            const results = await classifier?.classifyImage(draft.imageUri) || [];
            const endTime = Date.now();
            setProcessingTime((endTime - startTime) / 1000);

            if (results && results.length > 0) {
                const birdPredictions = results
                    .filter((r: BirdPrediction) => r.confidence > 0.1)
                    .sort((a: BirdPrediction, b: BirdPrediction) => b.confidence - a.confidence)
                    .slice(0, 5);

                setImagePredictions(birdPredictions);
                setShowImagePredictions(true);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

                // Auto-hide predictions after 15 seconds (longer than gallery since this is manual entry)
                setTimeout(() => {
                    setShowImagePredictions(false);
                    setImagePredictions([]);
                }, 15000);
            } else {
                showError('No bird detected in image');
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            }
        } catch (error) {
            console.error('ML identification error:', error);
            showError('Failed to identify bird');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            setIsIdentifyingImage(false);
        }
    }, [mlReady, isIdentifyingImage, draft.imageUri, classifier, showError]);

    const handleSelectImagePrediction = useCallback((prediction: BirdPrediction) => {
        const cleanedName = cleanBirdName(prediction.text);

        // Find matching bird in database to get scientific name
        const speciesCode = findBestMatchingBirdCode(prediction.text);
        let scientificName = '';

        if (speciesCode) {
            try {
                const dbResults = searchBirdsByName(cleanedName, 20);
                const matchedBird = dbResults.find(bird => bird.species_code === speciesCode);
                if (matchedBird) {
                    scientificName = matchedBird.scientific_name || '';
                }
            } catch (error) {
                console.error('Error getting scientific name:', error);
            }
        }

        // Create AI identification note
        const confidencePercent = (prediction.confidence * 100).toFixed(1);
        const aiNote = `AI Image Identification: ${cleanedName} (${confidencePercent}% confidence)`;

        // Append to existing notes
        const existingNotes = draft.textNote?.trim() || '';
        const updatedNotes = existingNotes
            ? `${existingNotes}\n\n${aiNote}`
            : aiNote;

        // Update form fields
        update({
            imagePrediction: prediction.text,
            birdType: cleanedName,
            latinBirDex: scientificName, // Fill scientific name field
            textNote: updatedNotes // Add AI identification info to notes
        });

        setShowImagePredictions(false);
        setImagePredictions([]);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        // Don't navigate - let user complete the manual entry form
    }, [update, findBestMatchingBirdCode, cleanBirdName, draft.textNote]);

    // Save entry
    const handleSave = useCallback(async () => {
        if (isSaving) return;

        console.log('🐦 [Manual Save] Starting save process...');
        console.log('🐦 [Manual Save] Current draft:', JSON.stringify(draft, null, 2));

        // Validation - at least one field must be present
        const hasBirdType = !!draft.birdType?.trim();
        const hasNotes = !!draft.textNote?.trim();
        const hasMedia = !!(draft.imageUri || draft.videoUri || draft.audioUri);

        const hasContent = hasBirdType || hasNotes || hasMedia;

        console.log('[Manual Save] Content check:', {
            hasBirdType,
            hasNotes,
            hasMedia,
            hasContent
        });

        if (!hasContent) {
            console.log('[Manual Save] Validation failed: No content at all');
            showError('Please add at least bird name, notes, or media content');
            birdTypeRef.current?.focus();
            return;
        }

        console.log('[Manual Save] Validation passed - has content');

        // Validate media URIs exist
        console.log('[Manual Save] Validating media files...');
        const mediaValidation = [];

        if (draft.imageUri) {
            console.log('[Manual Save] Checking image URI:', draft.imageUri);
            try {
                // Skip validation for AI pipeline and gallery images
                const isAIPipelineImage = draft.imageUri.includes('/gallery/bird_') ||
                    draft.imageUri.includes('/gallery/full_') ||
                    draft.imageUri.includes('_conf');
                const isGalleryImage = draft.imageUri.includes('/gallery/logchirpy_photo_');

                if (isAIPipelineImage || isGalleryImage) {
                    console.log('[Manual Save] Skipping validation for AI pipeline/gallery image');
                } else {
                    // Only validate manually captured images
                    const imageExists = await validateImageUri(draft.imageUri);
                    console.log('[Manual Save] Image exists:', imageExists);
                    if (!imageExists) {
                        mediaValidation.push('Image file not found - please retake or select a new photo');
                    }
                }
            } catch (error) {
                console.error('[Manual Save] Image validation error:', error);
                mediaValidation.push('Image validation failed - please try selecting the photo again');
            }
        }

        if (draft.videoUri) {
            console.log('[Manual Save] Checking video URI:', draft.videoUri);
            try {
                const videoInfo = await FileSystem.getInfoAsync(draft.videoUri);
                console.log('[Manual Save] Video info:', videoInfo);
                if (!videoInfo.exists) {
                    mediaValidation.push('Video file not found');
                }
            } catch (error) {
                console.error('[Manual Save] Video validation error:', error);
                mediaValidation.push('Video validation failed');
            }
        }

        if (draft.audioUri) {
            console.log('[Manual Save] Checking audio URI:', draft.audioUri);
            try {
                const audioInfo = await FileSystem.getInfoAsync(draft.audioUri);
                console.log('[Manual Save] Audio info:', audioInfo);
                if (!audioInfo.exists) {
                    mediaValidation.push('Audio file not found');
                }
            } catch (error) {
                console.error('[Manual Save] Audio validation error:', error);
                mediaValidation.push('Audio validation failed');
            }
        }

        if (mediaValidation.length > 0) {
            console.log('[Manual Save] Media validation failed:', mediaValidation);
            showError(`Media validation failed: ${mediaValidation.join(', ')}`);
            return;
        }

        setIsSaving(true);
        try {
            const spotting: Omit<BirdSpotting, 'id' | 'synced'> = {
                imageUri: draft.imageUri || '',
                videoUri: draft.videoUri || '',
                audioUri: draft.audioUri || '',
                textNote: draft.textNote || '',
                gpsLat: draft.gpsLat !== null && draft.gpsLat !== undefined ? draft.gpsLat : null,
                gpsLng: draft.gpsLng !== null && draft.gpsLng !== undefined ? draft.gpsLng : null,
                date: draft.date || new Date().toISOString(),
                birdType: draft.birdType || '',
                imagePrediction: draft.imagePrediction || '',
                audioPrediction: draft.audioPrediction || '',
                latinBirDex: draft.latinBirDex || null,
            };

            console.log('[Manual Save] Prepared spotting object:', JSON.stringify(spotting, null, 2));
            console.log('[Manual Save] Calling insertBirdSpotting...');

            const result = await insertBirdSpotting(spotting);
            console.log('[Manual Save] Insert result:', result);

            console.log('[Manual Save] Clearing draft...');
            clear();

            console.log('[Manual Save] Save completed successfully!');
            showSuccess('Bird spotting saved successfully!');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            router.replace('/(tabs)/archive');
        } catch (error) {
            console.error('[Manual Save] Save error:', error);
            console.error('[Manual Save] Error details:', {
                message: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined,
                name: error instanceof Error ? error.name : undefined
            });
            showError(`Failed to save bird spotting: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsSaving(false);
            console.log('[Manual Save] Save process completed');
        }
    }, [draft, isSaving, clear, showSuccess, showError]);

    // Cleanup audio on unmount
    useEffect(() => {
        return () => {
            if (sound) sound.unloadAsync();
        };
    }, [sound]);

    // Calculate completion percentage
    const completionFields = [
        draft.birdType,
        draft.imageUri || draft.videoUri || draft.audioUri,
        draft.gpsLat && draft.gpsLng,
        draft.date
    ];
    const completionPercentage = Math.round(
        (completionFields.filter(Boolean).length / completionFields.length) * 100
    );

    // Loading screen
    if (draftLoading) {
        return (
            <ThemedView style={styles.loadingContainer}>
                <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
                <Stack.Screen options={{ headerShown: false }} />
                <ActivityIndicator size="large" color={colors.primary} />
                <ThemedText variant="body" color="secondary" style={styles.loadingText}>
                    {t('log.loading_draft', 'Loading draft...')}
                </ThemedText>
            </ThemedView>
        );
    }

    return (
        <ThemedView style={styles.container}>
            <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
                <ThemedPressable
                    variant="secondary"
                    size="md"
                    onPress={() => router.back()}
                    style={styles.backButton}
                >
                    <ThemedIcon name="arrow-left" size={20} color="primary" />
                </ThemedPressable>

                <View style={styles.headerContent}>
                    <ThemedText variant="h2" style={styles.headerTitle}>
                        {t('log.manual_entry', 'New Bird Spotting')}
                    </ThemedText>
                    <View style={styles.headerActions}>
                        <View style={styles.completionBadge}>
                            <ThemedText variant="caption" color="secondary">
                                {completionPercentage}% complete
                            </ThemedText>
                        </View>
                        <ThemedPressable
                            variant="ghost"
                            size="sm"
                            onPress={clear}
                            style={styles.clearButton}
                        >
                            <ThemedIcon name="x" size={16} color="secondary" />
                            <ThemedText variant="caption" color="secondary">
                                Clear
                            </ThemedText>
                        </ThemedPressable>
                    </View>
                </View>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Media Section */}
                <View style={styles.section}>
                    <ThemedText variant="h3" style={styles.sectionTitle}>
                        Media
                    </ThemedText>
                    <View style={styles.mediaGrid}>
                        {mediaItems.map((item) => (
                            <ThemedPressable
                                key={item.type}
                                variant="ghost"
                                onPress={() => router.push(item.route as any)}
                                style={[
                                    styles.mediaCard,
                                    ...(item.hasContent ? [styles.mediaCardActive] : [])
                                ]}
                            >
                                <View style={[
                                    styles.mediaIcon,
                                    ...(item.hasContent ? [styles.mediaIconActive] : [])
                                ]}>
                                    <ThemedIcon
                                        name={item.icon as any}
                                        size={32}
                                        color={item.hasContent ? "inverse" : "secondary"}
                                    />
                                </View>
                                <ThemedText
                                    variant="caption"
                                    color={item.hasContent ? "primary" : "secondary"}
                                    style={styles.mediaLabel}
                                >
                                    {item.label}
                                </ThemedText>
                                {item.hasContent && (
                                    <View style={styles.mediaStatus}>
                                        <ThemedIcon name="check" size={16} color="success" />
                                    </View>
                                )}
                            </ThemedPressable>
                        ))}
                    </View>

                    {/* AI Identification */}
                    <View style={styles.aiButtonsContainer}>
                        {draft.audioUri && (
                            <ThemedPressable
                                variant="secondary"
                                onPress={handleAudioIdentification}
                                disabled={isIdentifying}
                                style={styles.aiButton}
                            >
                                {isIdentifying ? (
                                    <ActivityIndicator size="small" color={colors.primary} />
                                ) : (
                                    <ThemedIcon name="mic" size={20} color="primary" />
                                )}
                                <ThemedText variant="button" color="primary">
                                    {isIdentifying ? 'Identifying...' : 'AI Audio ID'}
                                </ThemedText>
                            </ThemedPressable>
                        )}

                        {draft.imageUri && mlReady && (
                            <ThemedPressable
                                variant="secondary"
                                onPress={handleImageIdentification}
                                disabled={isIdentifyingImage}
                                style={styles.aiButton}
                            >
                                {isIdentifyingImage ? (
                                    <ActivityIndicator size="small" color={colors.primary} />
                                ) : (
                                    <ThemedIcon name="camera" size={20} color="primary" />
                                )}
                                <ThemedText variant="button" color="primary">
                                    {isIdentifyingImage ? 'Identifying...' : 'AI Image ID'}
                                </ThemedText>
                            </ThemedPressable>
                        )}
                    </View>

                    {/* Audio Preview */}
                    {draft.audioUri && (
                        <View style={styles.audioPreview}>
                            <ThemedText variant="bodySmall" color="secondary" style={styles.inputLabel}>
                                Audio Recording
                            </ThemedText>
                            <ThemedPressable
                                variant="ghost"
                                onPress={handlePlayAudio}
                                style={styles.audioPlayButton}
                            >
                                <ThemedIcon 
                                    name={sound ? "pause" : "play"} 
                                    size={24} 
                                    color="primary" 
                                />
                                <ThemedText variant="body" color="primary">
                                    {sound ? "Pause Audio" : "Play Audio"}
                                </ThemedText>
                            </ThemedPressable>
                        </View>
                    )}
                </View>

                {/* Bird Information */}
                <View style={styles.section}>
                    <ThemedText variant="h3" style={styles.sectionTitle}>
                        Bird Information
                    </ThemedText>

                    {/* Bird Type */}
                    <View style={styles.inputContainer}>
                        <ThemedText variant="bodySmall" color="secondary" style={styles.inputLabel}>
                            Bird Type *
                        </ThemedText>
                        <TextInput
                            ref={birdTypeRef}
                            style={[styles.textInput, { color: colors.text }]}
                            value={draft.birdType || ''}
                            onChangeText={(text) => update({ birdType: text })}
                            placeholder="e.g., Robin, Sparrow, Eagle"
                            placeholderTextColor={colors.textTertiary}
                            returnKeyType="next"
                            onSubmitEditing={() => scientificNameRef.current?.focus()}
                        />
                    </View>

                    {/* Scientific Name */}
                    <View style={styles.inputContainer}>
                        <ThemedText variant="bodySmall" color="secondary" style={styles.inputLabel}>
                            Scientific Name
                        </ThemedText>
                        <TextInput
                            ref={scientificNameRef}
                            style={[styles.textInput, { color: colors.text }]}
                            value={draft.latinBirDex || ''}
                            onChangeText={(text) => update({ latinBirDex: text })}
                            placeholder="e.g., Turdus migratorius"
                            placeholderTextColor={colors.textTertiary}
                            returnKeyType="next"
                            onSubmitEditing={() => notesRef.current?.focus()}
                        />
                    </View>

                    {/* Notes */}
                    <View style={styles.inputContainer}>
                        <ThemedText variant="bodySmall" color="secondary" style={styles.inputLabel}>
                            Notes
                        </ThemedText>
                        <TextInput
                            ref={notesRef}
                            style={[styles.textAreaInput, { color: colors.text }]}
                            value={draft.textNote || ''}
                            onChangeText={(text) => update({ textNote: text })}
                            placeholder="Behavior, habitat, distinguishing features..."
                            placeholderTextColor={colors.textTertiary}
                            multiline
                            numberOfLines={4}
                            textAlignVertical="top"
                        />
                    </View>
                </View>

                {/* Location & Time */}
                <View style={styles.section}>
                    <ThemedText variant="h3" style={styles.sectionTitle}>
                        Location & Time
                    </ThemedText>

                    {/* Location */}
                    <ThemedPressable
                        variant="ghost"
                        onPress={handleGetLocation}
                        disabled={isLoadingLocation}
                        style={styles.metadataCard}
                    >
                        <View style={styles.metadataContent}>
                            {isLoadingLocation ? (
                                <ActivityIndicator size="small" color={colors.primary} />
                            ) : (
                                <ThemedIcon name="map-pin" size={24} color="primary" />
                            )}
                            <View style={styles.metadataText}>
                                <ThemedText variant="bodySmall" color="secondary">
                                    Location
                                </ThemedText>
                                <ThemedText variant="body">
                                    {draft.gpsLat && draft.gpsLng
                                        ? `${draft.gpsLat.toFixed(4)}, ${draft.gpsLng.toFixed(4)}`
                                        : 'Tap to add location'
                                    }
                                </ThemedText>
                            </View>
                            {draft.gpsLat && draft.gpsLng && (
                                <ThemedIcon name="check" size={20} color="success" />
                            )}
                        </View>
                    </ThemedPressable>

                    {/* Date */}
                    <View style={styles.metadataCard}>
                        <View style={styles.metadataContent}>
                            <ThemedIcon name="calendar" size={24} color="primary" />
                            <View style={styles.metadataText}>
                                <ThemedText variant="bodySmall" color="secondary">
                                    Date & Time
                                </ThemedText>
                                <ThemedText variant="body">
                                    {draft.date
                                        ? new Date(draft.date).toLocaleString()
                                        : new Date().toLocaleString()
                                    }
                                </ThemedText>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Bottom spacing for save button */}
                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Image AI Predictions Overlay */}
            {showImagePredictions && imagePredictions.length > 0 && (
                <Animated.View
                    entering={FadeInDown.duration(300)}
                    exiting={FadeOutUp.duration(250)}
                    style={styles.predictionsOverlay}
                >
                    {/* Touchable background that closes modal */}
                    <Pressable
                        style={styles.overlayBackground}
                        onPress={() => {
                            setShowImagePredictions(false);
                            setImagePredictions([]);
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                    >
                        {/* Modal card that prevents event bubbling */}
                        <Pressable onPress={(e) => e.stopPropagation()}>
                            <ModernCard style={styles.predictionsCard}>
                                <View style={styles.predictionsHeader}>
                                    <ThemedIcon name="camera" size={20} color="primary" />
                                    <ThemedText variant="h3" style={styles.predictionsTitle}>
                                        AI Image Identification
                                    </ThemedText>
                                    <ThemedText variant="caption" color="secondary">
                                        Processing time: {processingTime.toFixed(1)}s
                                    </ThemedText>
                                </View>

                                <ThemedText variant="caption" color="tertiary" style={styles.helpText}>
                                    Tap a result to auto-fill, or tap outside to close
                                </ThemedText>

                                <ScrollView
                                    style={styles.predictionsList}
                                    showsVerticalScrollIndicator={false}
                                    bounces={false}
                                >
                                    {imagePredictions.map((prediction, index) => (
                                        <ThemedPressable
                                            key={index}
                                            variant="ghost"
                                            style={styles.predictionItem}
                                            onPress={() => handleSelectImagePrediction(prediction)}
                                        >
                                            <View style={styles.predictionContent}>
                                                <ThemedText variant="body" style={styles.predictionText}>
                                                    {cleanBirdName(prediction.text)}
                                                </ThemedText>
                                                <View style={styles.confidenceContainer}>
                                                    <View style={[
                                                        styles.confidenceBar,
                                                        { width: `${prediction.confidence * 100}%`, backgroundColor: colors.primary }
                                                    ]} />
                                                </View>
                                                <ThemedText variant="caption" color="secondary">
                                                    {(prediction.confidence * 100).toFixed(1)}% confidence
                                                </ThemedText>
                                            </View>
                                            <ThemedIcon name="chevron-right" size={16} color="tertiary" />
                                        </ThemedPressable>
                                    ))}
                                </ScrollView>
                            </ModernCard>
                        </Pressable>
                    </Pressable>
                </Animated.View>
            )}

            {/* Save Button */}
            <View style={[styles.saveContainer, { paddingBottom: insets.bottom + spacing.md }]}>
                <ThemedPressable
                    variant="primary"
                    onPress={handleSave}
                    disabled={isSaving || !draft.birdType?.trim()}
                    style={[
                        styles.saveButton,
                        ...(!draft.birdType?.trim() ? [styles.saveButtonDisabled] : [])
                    ]}
                >
                    {isSaving ? (
                        <ActivityIndicator size="small" color={colors.textInverse} />
                    ) : (
                        <ThemedIcon name="save" size={24} color="inverse" />
                    )}
                    <ThemedText variant="button" style={{ color: colors.textInverse }}>
                        {isSaving ? 'Saving...' : 'Save Bird Spotting'}
                    </ThemedText>
                </ThemedPressable>
            </View>

            <SnackbarComponent />
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

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingHorizontal: 20,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
        gap: 16,
    },
    backButton: {
        minWidth: 44,
    },
    headerContent: {
        flex: 1,
        gap: 4,
    },
    headerTitle: {
        fontWeight: '700',
        textAlign: 'center',
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
    },
    completionBadge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        borderRadius: 12,
    },
    clearButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },

    // Content
    content: {
        flex: 1,
    },
    section: {
        padding: 20,
        gap: 16,
    },
    sectionTitle: {
        fontWeight: '600',
        marginBottom: 4,
    },

    // Media Grid
    mediaGrid: {
        flexDirection: 'row',
        gap: 12,
    },
    mediaCard: {
        flex: 1,
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: 'rgba(0,0,0,0.05)',
        backgroundColor: 'rgba(0,0,0,0.01)',
        position: 'relative',
    },
    mediaCardActive: {
        borderColor: 'rgba(34, 197, 94, 0.3)',
        backgroundColor: 'rgba(34, 197, 94, 0.05)',
    },
    mediaIcon: {
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.05)',
        marginBottom: 8,
    },
    mediaIconActive: {
        backgroundColor: 'rgba(34, 197, 94, 1)',
    },
    mediaLabel: {
        textAlign: 'center',
        fontWeight: '500',
    },
    mediaStatus: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'white',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },

    // AI Buttons
    aiButtonsContainer: {
        gap: 8,
        marginTop: 8,
    },
    aiButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
    },

    // Audio Preview
    audioPreview: {
        marginTop: 16,
        gap: 8,
    },
    audioPlayButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        paddingVertical: 16,
        paddingHorizontal: 16,
        backgroundColor: 'rgba(0,0,0,0.02)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.1)',
    },

    // Form Inputs
    inputContainer: {
        gap: 8,
    },
    inputLabel: {
        fontWeight: '500',
    },
    textInput: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.1)',
        backgroundColor: 'rgba(0,0,0,0.02)',
        fontSize: 16,
    },
    textAreaInput: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.1)',
        backgroundColor: 'rgba(0,0,0,0.02)',
        fontSize: 16,
        minHeight: 100,
    },

    // Metadata Cards
    metadataCard: {
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
        backgroundColor: 'rgba(0,0,0,0.01)',
    },
    metadataContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    metadataText: {
        flex: 1,
        gap: 4,
    },

    // Save Button
    saveContainer: {
        paddingHorizontal: 20,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.05)',
    },
    saveButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        paddingVertical: 16,
        borderRadius: 16,
    },
    saveButtonDisabled: {
        opacity: 0.5,
    },

    // Predictions Overlay
    predictionsOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
    },
    overlayBackground: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    predictionsCard: {
        width: '100%',
        maxWidth: 400,
        maxHeight: '75%',
        padding: 20,
        alignSelf: 'center',
    },
    predictionsHeader: {
        alignItems: 'center',
        marginBottom: 20,
        gap: 8,
    },
    predictionsTitle: {
        fontWeight: '600',
        textAlign: 'center',
    },
    predictionsList: {
        flexGrow: 0,
        flexShrink: 1,
        marginBottom: 16,
        maxHeight: 350,
        minHeight: 200,
    },
    predictionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 8,
        backgroundColor: 'rgba(0, 0, 0, 0.02)',
        marginBottom: 12,
    },
    predictionContent: {
        flex: 1,
        gap: 4,
    },
    predictionText: {
        fontWeight: '500',
    },
    confidenceContainer: {
        height: 4,
        backgroundColor: 'rgba(0, 0, 0, 0.1)',
        borderRadius: 2,
        overflow: 'hidden',
    },
    confidenceBar: {
        height: '100%',
        borderRadius: 2,
    },
    helpText: {
        textAlign: 'center',
        fontStyle: 'italic',
        marginBottom: 16,
        paddingHorizontal: 8,
    },
});