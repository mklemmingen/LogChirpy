import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Pressable, Share, StyleSheet, View, } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as Haptics from 'expo-haptics';
import { useImageLabeling } from "@infinitered/react-native-mlkit-image-labeling";
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { Audio } from 'expo-av';

// Components
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedIcon } from '@/components/ThemedIcon';
import { ThemedPressable } from '@/components/ThemedPressable';
import { ThemedSafeAreaView } from '@/components/ThemedSafeAreaView';
import { ModernCard } from '@/components/ModernCard';
import { useSnackbar } from '@/components/ThemedSnackbar';

// Context
import { useLogDraft } from '@/contexts/LogDraftContext';

// Hooks
import { useColors } from '@/hooks/useThemeColor';

// URI utilities
import { filePathToUri, uriToFilePath } from '@/services/uriUtils';

// Database utilities
import { searchBirdsByName } from '@/services/databaseBirDex';

interface MediaItem {
    uri: string;
    filename: string;
    size: number;
    modificationTime: number;
    type: 'photo' | 'audio';
    classification?: string;
    confidence?: number;
    detectionType?: 'bird' | 'full';
}

interface BirdPrediction {
    text: string;
    confidence: number;
    index: number;
}

export default function GalleryManagementScreen() {
    const { t } = useTranslation();
    const colors = useColors();
    const styles = createStyles();
    const { selectMode } = useLocalSearchParams();
    const { update } = useLogDraft();
    const { SnackbarComponent, showSuccess, showError } = useSnackbar();

    const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [selectionMode, setSelectionMode] = useState(false);
    const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set());
    const [playingAudio, setPlayingAudio] = useState<string | null>(null);
    const [audioSound, setAudioSound] = useState<Audio.Sound | null>(null);

    // AI Identification state
    const [isIdentifying, setIsIdentifying] = useState(false);
    const [predictions, setPredictions] = useState<BirdPrediction[]>([]);
    const [showPredictions, setShowPredictions] = useState(false);
    const [processingTime, setProcessingTime] = useState(0);

    // MLKit hook
    const classifier = useImageLabeling('birdClassifier');
    const mlReady = !!(classifier && typeof classifier.classifyImage === 'function');

    // Load media files from document storage directories
    const loadMediaFiles = useCallback(async () => {
        try {
            setLoading(true);
            const mediaFiles: MediaItem[] = [];

            // Load photos from gallery directory
            const galleryDir = `${FileSystem.documentDirectory}gallery/`;
            const galleryDirInfo = await FileSystem.getInfoAsync(galleryDir);
            if (galleryDirInfo.exists) {
                const files = await FileSystem.readDirectoryAsync(galleryDir);
                const photoFiles = files.filter(filename =>
                    (filename.startsWith('bird_') || filename.startsWith('full_') || filename.startsWith('logchirpy_photo_')) &&
                    (filename.endsWith('.jpg') || filename.endsWith('.jpeg') || filename.endsWith('.png'))
                );

                const photoItems: MediaItem[] = await Promise.all(
                    photoFiles.map(async (filename) => {
                        const filePath = `${galleryDir}${filename}`;
                        const info = await FileSystem.getInfoAsync(filePath) as FileSystem.FileInfo & { modificationTime?: number };
                        const { classification, confidence, detectionType } = extractDataFromFilename(filename);

                        return {
                            uri: filePathToUri(filePath),
                            filename: filename,
                            size: info.exists && 'size' in info ? info.size : 0,
                            type: 'photo' as const,
                            modificationTime: info.modificationTime || 0,
                            classification,
                            confidence,
                            detectionType,
                        };
                    })
                );
                mediaFiles.push(...photoItems);
            }

            // Load audio files from documents directory
            const docsDir = FileSystem.documentDirectory!;
            const docFiles = await FileSystem.readDirectoryAsync(docsDir);
            const audioFiles = docFiles.filter(filename =>
                filename.startsWith('audio_') && filename.endsWith('.m4a')
            );

            const audioItems: MediaItem[] = await Promise.all(
                audioFiles.map(async (filename) => {
                    const filePath = `${docsDir}${filename}`;
                    const info = await FileSystem.getInfoAsync(filePath) as FileSystem.FileInfo & { modificationTime?: number };

                    return {
                        uri: filePath,
                        filename: filename,
                        size: info.exists && 'size' in info ? info.size : 0,
                        type: 'audio' as const,
                        modificationTime: info.modificationTime || 0,
                    };
                })
            );
            mediaFiles.push(...audioItems);

            // Sort by modification time (newest first)
            mediaFiles.sort((a, b) => b.modificationTime - a.modificationTime);
            setMediaItems(mediaFiles);
        } catch (error) {
            console.error('Failed to load media files:', error);
            Alert.alert(t('gallery.error'), t('gallery.load_failed'));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        loadMediaFiles();
    }, [loadMediaFiles]);

    // Reset selection state when screen is focused
    useFocusEffect(
        useCallback(() => {
            // Always reset selection state when returning to gallery
            setSelectionMode(false);
            setSelectedItems(new Set());
        }, [])
    );

    // Cleanup audio on unmount
    useEffect(() => {
        return () => {
            if (audioSound) {
                audioSound.unloadAsync().catch(() => {});
            }
        };
    }, [audioSound]);

    // Extract classification data from filename patterns like "bird_house_finch_conf085_timestamp_milliseconds.jpg"
    const extractDataFromFilename = (filename: string): {
        classification?: string;
        confidence?: number;
        detectionType?: 'bird' | 'full';
    } => {
        const patterns = [
            /(bird|full)_([^_]+(?:_[^_]+)*)_conf(\d{3})_.*_(\d+)\.jpg/,  // bird_species_name_conf085_timestamp_milliseconds.jpg
        ];

        for (const pattern of patterns) {
            const match = filename.match(pattern);
            if (match) {
                const [, prefix, species, confidence] = match;
                const cleanSpecies = species.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                const confidencePercent = parseInt(confidence);
                return {
                    classification: `${cleanSpecies} (${confidencePercent}%)`,
                    confidence: confidencePercent,
                    detectionType: prefix as 'bird' | 'full',
                };
            }
        }
        return {};
    };

    const toggleSelection = (uri: string) => {
        const newSelection = new Set(selectedItems);
        if (newSelection.has(uri)) {
            newSelection.delete(uri);
        } else {
            newSelection.add(uri);
        }
        setSelectedItems(newSelection);

        if (newSelection.size === 0) {
            setSelectionMode(false);
        }
    };

    const saveToGallery = async (photoUris: string[]) => {
        try {
            let savedCount = 0;
            for (const uri of photoUris) {
                try {
                    // Request permissions
                    const { status } = await MediaLibrary.requestPermissionsAsync();
                    if (status !== 'granted') {
                        Alert.alert(t('gallery.permission_denied'), t('gallery.permission_message'));
                        return;
                    }

                    // Convert URI to file path for MediaLibrary
                    const filePath = uriToFilePath(uri);

                    // Create asset
                    const asset = await MediaLibrary.createAssetAsync(filePath);

                    // Add to LogChirpy album
                    let album = await MediaLibrary.getAlbumAsync("LogChirpy");
                    if (album) {
                        await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
                    } else {
                        await MediaLibrary.createAlbumAsync("LogChirpy", asset, false);
                    }

                    savedCount++;
                } catch (error) {
                    console.error('Failed to save photo:', uri, error);
                }
            }

            if (savedCount > 0) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert(
                    t('gallery.save_success'),
                    t('gallery.saved_count', { count: savedCount })
                );
            } else {
                Alert.alert(t('gallery.save_failed'), t('gallery.no_photos_saved'));
            }
        } catch (error) {
            console.error('Save to gallery failed:', error);
            Alert.alert(t('gallery.save_failed'), error instanceof Error ? error.message : String(error));
        }
    };

    const deleteMediaItems = async (itemUris: string[]) => {
        Alert.alert(
            t('gallery.delete_confirm'),
            t('gallery.delete_message', { count: itemUris.length }),
            [
                { text: t('buttons.cancel'), style: 'cancel' },
                {
                    text: t('buttons.delete'),
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            let deletedCount = 0;
                            let errors = [];

                            for (const uri of itemUris) {
                                const item = mediaItems.find(item => item.uri === uri);
                                if (!item) continue;

                                try {
                                    let filePath: string;
                                    if (item.type === 'photo') {
                                        // Get the file path relative to the app's document directory
                                        const galleryDir = `${FileSystem.documentDirectory}gallery/`;
                                        const filename = uri.split('/').pop(); // Get the filename from the URI
                                        if (!filename) {
                                            throw new Error('Invalid file URI');
                                        }
                                        filePath = `${galleryDir}${filename}`;
                                    } else {
                                        // Audio files are stored directly in documents directory
                                        filePath = uri;
                                    }

                                    console.log('[Gallery] Processing delete:', {
                                        uri,
                                        filePath
                                    });

                                    const fileInfo = await FileSystem.getInfoAsync(filePath);
                                    if (fileInfo.exists) {
                                        await FileSystem.deleteAsync(filePath, { idempotent: true });
                                        deletedCount++;
                                        console.log('[Gallery] Successfully deleted file:', filePath);
                                    } else {
                                        console.warn('[Gallery] File does not exist:', filePath);
                                        errors.push(`File not found: ${item.filename}`);
                                    }
                                } catch (error) {
                                    console.error('[Gallery] Failed to delete file:', uri, error);
                                    errors.push(error instanceof Error ? error.message : String(error));
                                }
                            }

                            // Clear selection and refresh list regardless of errors
                            setSelectedItems(new Set());
                            setSelectionMode(false);
                            await loadMediaFiles(); // Refresh the list

                            // Show appropriate feedback
                            if (deletedCount > 0) {
                                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                showSuccess(t('gallery.delete_success', 'Successfully deleted {{count}} files', { count: deletedCount }));
                            }

                            if (errors.length > 0) {
                                console.error('[Gallery] Deletion errors:', errors);
                                showError(t('gallery.delete_partial_fail', 'Failed to delete some files. Please try again.'));
                            }
                        } catch (error) {
                            console.error('[Gallery] Delete operation failed:', error);
                            showError(t('gallery.delete_failed', 'Failed to delete files'));
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                        }
                    }
                }
            ]
        );
    };

    const shareMediaItems = async (itemUris: string[]) => {
        try {
            await Share.share({
                message: t('gallery.share_title'),
                url: itemUris[0], // Share first item URL
            });
        } catch (error) {
            console.error('Share failed:', error);
        }
    };

    // Use selected media for logging
    const useMediaForLog = useCallback(async () => {
        if (selectedItems.size !== 1) {
            showError('Please select exactly one item to use for logging');
            return;
        }

        const selectedItemUri = Array.from(selectedItems)[0] as string;
        const selectedItem = mediaItems.find(item => item.uri === selectedItemUri);

        if (!selectedItem) return;

        try {
            // Update the LogDraft context with the selected media
            if (selectedItem.type === 'photo') {
                update({ imageUri: selectedItemUri });
                showSuccess('Photo selected for bird log');
            } else if (selectedItem.type === 'audio') {
                update({ audioUri: selectedItemUri });
                showSuccess('Audio selected for bird log');
            }
            
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            // Navigate to the manual entry screen
            router.push('/log/manual');
        } catch (error) {
            console.error('Failed to use media for log:', error);
            showError('Failed to select media for logging');
        }
    }, [selectedItems, mediaItems, update, showSuccess, showError]);

    // AI Identification function (only for photos)
    const handleIdentifyBird = useCallback(async () => {
        if (!mlReady || isIdentifying || selectedItems.size !== 1) return;

        const selectedItemUri = Array.from(selectedItems)[0] as string;
        const selectedItem = mediaItems.find(item => item.uri === selectedItemUri);
        
        if (!selectedItem || selectedItem.type !== 'photo') {
            showError('Please select a photo to identify');
            return;
        }

        setIsIdentifying(true);
        const startTime = Date.now();

        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

            const results = await classifier?.classifyImage(selectedItemUri) || [];
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

                // Auto-hide predictions after 8 seconds
                setTimeout(() => {
                    setShowPredictions(false);
                    setPredictions([]);
                }, 8000);
            } else {
                showError('No bird detected in image');
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            }
        } catch (error) {
            console.error('ML identification error:', error);
            showError('Failed to identify bird');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            setIsIdentifying(false);
        }
    }, [mlReady, isIdentifying, selectedItems, mediaItems, classifier, showError]);

    // Calculate string similarity score (same algorithm as smart-search)
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

    // Levenshtein distance implementation
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

    // Clean ML prediction text (remove class numbers, extra spaces, etc.)
    const cleanBirdName = useCallback((rawName: string): string => {
        // Remove leading numbers and whitespace (e.g., "308 Rainbow Lorikeet" -> "Rainbow Lorikeet")
        const cleaned = rawName.replace(/^\d+\s+/, '').trim();
        console.log(`Cleaned "${rawName}" -> "${cleaned}"`);
        return cleaned;
    }, []);

    // Find best matching bird code using smart-search logic
    const findBestMatchingBirdCode = useCallback((birdName: string): string | null => {
        try {
            // Clean the bird name first
            const cleanedName = cleanBirdName(birdName);
            console.log('Searching database for:', cleanedName);

            // Get search results from database
            const dbResults = searchBirdsByName(cleanedName, 20);
            console.log('Database returned', dbResults.length, 'results:', dbResults.slice(0, 5).map(r => r.english_name));

            if (dbResults.length === 0) {
                console.log('No database results found');
                return null;
            }

            // Score each result across all name fields
            let bestMatch = { score: 0, speciesCode: '', matchedName: '' };

            dbResults.forEach(bird => {
                const nameFields = [
                    { name: bird.english_name, label: 'english' },
                    { name: bird.scientific_name, label: 'scientific' },
                    { name: bird.de_name, label: 'german' },
                    { name: bird.es_name, label: 'spanish' },
                    { name: bird.ukrainian_name, label: 'ukrainian' },
                    { name: bird.ar_name, label: 'arabic' }
                ].filter(field => field.name); // Remove null/undefined values

                nameFields.forEach(field => {
                    if (field.name) {
                        const score = calculateMatchScore(cleanedName, field.name);
                        if (score > bestMatch.score) {
                            bestMatch = { score, speciesCode: bird.species_code, matchedName: field.name };
                            console.log(`New best: "${cleanedName}" vs "${field.name}" (${field.label}): ${score}%`);
                        }
                    }
                });
            });

            console.log('Best match:', bestMatch);

            // Lower threshold to 30% since you said it doesn't have to be 100%
            return bestMatch.score > 30 ? bestMatch.speciesCode : null;
        } catch (error) {
            console.error('Error finding matching bird code:', error);
            return null;
        }
    }, [calculateMatchScore, cleanBirdName]);

    const handleSelectPrediction = useCallback((prediction: BirdPrediction) => {
        console.log('handleSelectPrediction called with:', prediction.text);

        update({
            imagePrediction: prediction.text,
            birdType: prediction.text
        });
        setShowPredictions(false);
        setPredictions([]);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        // Find and navigate to best matching bird code
        console.log('Searching for matching bird code for:', prediction.text);
        const speciesCode = findBestMatchingBirdCode(prediction.text);
        console.log('Found species code:', speciesCode);

        if (speciesCode) {
            console.log('Navigating to:', `/birdex/details/${speciesCode}`);
            // Navigate to bird details page with the matched species code
            router.push(`/birdex/details/${speciesCode}`);
        } else {
            console.log('No matching species code found for:', prediction.text);
            showError(`No bird found in database matching: ${prediction.text}`);
        }
    }, [update, findBestMatchingBirdCode, showError]);

    // Audio playback functions
    const playAudio = async (uri: string) => {
        try {
            // Stop current audio if playing
            if (audioSound) {
                await audioSound.unloadAsync();
                setAudioSound(null);
            }

            if (playingAudio === uri) {
                setPlayingAudio(null);
                return;
            }

            const { sound } = await Audio.Sound.createAsync({ uri });
            setAudioSound(sound);
            setPlayingAudio(uri);
            
            await sound.playAsync();
            
            // Reset when finished
            sound.setOnPlaybackStatusUpdate((status) => {
                if (status.isLoaded && status.didJustFinish) {
                    setPlayingAudio(null);
                    sound.unloadAsync().catch(() => {});
                    setAudioSound(null);
                }
            });
        } catch (error) {
            console.error('Audio playback failed:', error);
            showError('Failed to play audio');
        }
    };

    const renderMediaItem = ({ item }: { item: MediaItem }) => {
        const isSelected = selectedItems.has(item.uri);
        const isBroken = brokenImages.has(item.uri);
        const isPlayingThis = playingAudio === item.uri;

        return (
            <View style={styles.photoContainer}>
                <Pressable
                    onPress={() => {
                        if (selectionMode) {
                            toggleSelection(item.uri);
                        } else if (item.type === 'audio') {
                            playAudio(item.uri);
                        } else {
                            // Single photo view or quick actions could go here
                        }
                    }}
                    onLongPress={() => {
                        setSelectionMode(true);
                        toggleSelection(item.uri);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    }}
                    style={[
                        styles.photoWrapper,
                        isSelected && { borderColor: colors.primary, borderWidth: 3 }
                    ]}
                >
                    {item.type === 'audio' ? (
                        <View style={[styles.photo, styles.audioContainer]}>
                            <ThemedIcon 
                                name={isPlayingThis ? "pause" : "play"} 
                                size={32} 
                                color={isPlayingThis ? "primary" : "secondary"} 
                            />
                            <ThemedText variant="caption" color="secondary" style={styles.audioLabel}>
                                Audio
                            </ThemedText>
                            {isPlayingThis && (
                                <View style={styles.playingIndicator}>
                                    <ActivityIndicator size="small" color={colors.primary} />
                                </View>
                            )}
                        </View>
                    ) : isBroken ? (
                        <View style={[styles.photo, styles.brokenImageContainer]}>
                            <ThemedIcon name="image" size={32} color="secondary" />
                            <ThemedText variant="caption" color="secondary">
                                Image unavailable
                            </ThemedText>
                        </View>
                    ) : (
                        <Image
                            source={{ uri: item.uri }}
                            style={styles.photo}
                            onError={() => {
                                console.warn('Failed to load image:', item.uri);
                                setBrokenImages(prev => new Set(prev).add(item.uri));
                            }}
                        />
                    )}

                    {/* Selection indicator */}
                    {selectionMode && (
                        <View style={[
                            styles.selectionIndicator,
                            { backgroundColor: isSelected ? colors.primary : colors.backgroundSecondary }
                        ]}>
                            {isSelected && (
                                <ThemedIcon name="check" size={16} color="primary" />
                            )}
                        </View>
                    )}

                    {/* Classification label */}
                    {item.classification && (
                        <View style={[styles.classificationBadge, { backgroundColor: colors.backgroundSecondary }]}>
                            <ThemedText variant="caption" color="primary" numberOfLines={1}>
                                {item.classification}
                            </ThemedText>
                        </View>
                    )}
                </Pressable>

                {/* Media info */}
                <View style={styles.photoInfo}>
                    <ThemedText variant="caption" color="secondary" numberOfLines={1}>
                        {item.filename}
                    </ThemedText>
                    <ThemedText variant="caption" color="tertiary">
                        {new Date(item.modificationTime * 1000).toLocaleDateString()}
                    </ThemedText>
                </View>
            </View>
        );
    };

    if (loading) {
        return (
            <ThemedSafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <ThemedText variant="body" color="secondary" style={styles.loadingText}>
                        {t('gallery.loading')}
                    </ThemedText>
                </View>
            </ThemedSafeAreaView>
        );
    }

    return (
        <ThemedSafeAreaView style={styles.container}>
            {/* Header */}
            <ThemedView style={styles.header}>
                <ThemedText variant="h2" style={styles.headerTitle}>
                    {t('gallery.title')}
                </ThemedText>
                <ThemedText variant="body" color="secondary">
                    {t('gallery.subtitle', { count: mediaItems.length })}
                </ThemedText>
            </ThemedView>

            {/* Selection Mode Actions */}
            {(selectionMode && selectedItems.size > 0) && (
                <View style={styles.actionBar}>
                    <ModernCard style={styles.actionCard}>
                        <View style={styles.actionButtons}>
                            {/* Use for Bird Log button - always available when items are selected */}
                            <ThemedPressable
                                variant="primary"
                                size="sm"
                                onPress={useMediaForLog}
                                disabled={selectedItems.size !== 1}
                                style={[
                                    styles.actionButton,
                                    ...(selectedItems.size !== 1 ? [{ opacity: 0.5 }] : [])
                                ]}
                            >
                                <ThemedIcon name="edit" size={16} color="inverse" />
                                <ThemedText variant="labelMedium" color="inverse">
                                    Use for Log
                                </ThemedText>
                            </ThemedPressable>

                            {/* AI Identify button - only when one photo is selected */}
                            {selectedItems.size === 1 && mlReady && (() => {
                                const selectedItem = mediaItems.find(item => item.uri === Array.from(selectedItems)[0]);
                                return selectedItem?.type === 'photo';
                            })() && (
                                <ThemedPressable
                                    variant="secondary"
                                    size="sm"
                                    onPress={handleIdentifyBird}
                                    disabled={isIdentifying}
                                    style={[
                                        styles.actionButton,
                                        ...(isIdentifying ? [{ opacity: 0.5 }] : [])
                                    ]}
                                >
                                    <ThemedIcon name="cpu" size={16} color="primary" />
                                    <ThemedText variant="labelMedium" color="primary">
                                        {isIdentifying ? 'Identifying...' : 'AI Identify'}
                                    </ThemedText>
                                </ThemedPressable>
                            )}

                            {/* Standard gallery actions - save photos only */}
                            <ThemedPressable
                                variant="secondary"
                                size="sm"
                                onPress={() => {
                                    const photoUris = Array.from(selectedItems).filter(uri => {
                                        const item = mediaItems.find(item => item.uri === uri);
                                        return item?.type === 'photo';
                                    });
                                    if (photoUris.length === 0) {
                                        showError('Please select photos to save to gallery');
                                        return;
                                    }
                                    saveToGallery(photoUris);
                                }}
                                style={styles.actionButton}
                            >
                                <ThemedIcon name="download" size={16} color="primary" />
                                <ThemedText variant="labelMedium" color="primary">
                                    Save to Gallery
                                </ThemedText>
                            </ThemedPressable>

                            <ThemedPressable
                                variant="secondary"
                                size="sm"
                                onPress={() => shareMediaItems(Array.from(selectedItems))}
                                style={styles.actionButton}
                            >
                                <ThemedIcon name="share" size={16} color="primary" />
                                <ThemedText variant="labelMedium" color="primary">
                                    Share
                                </ThemedText>
                            </ThemedPressable>

                            <ThemedPressable
                                variant="secondary"
                                size="sm"
                                onPress={() => deleteMediaItems(Array.from(selectedItems))}
                                style={[styles.actionButton, { backgroundColor: '#ef4444' }]}
                            >
                                <ThemedIcon name="trash-2" size={16} color="inverse" />
                                <ThemedText variant="labelMedium" color="inverse">
                                    Delete
                                </ThemedText>
                            </ThemedPressable>

                            <ThemedPressable
                                variant="ghost"
                                size="sm"
                                onPress={() => {
                                    setSelectionMode(false);
                                    setSelectedItems(new Set());
                                }}
                            >
                                <ThemedText variant="labelMedium" color="tertiary">
                                    Cancel
                                </ThemedText>
                            </ThemedPressable>
                        </View>
                    </ModernCard>
                </View>
            )}

            {/* Instructions */}
            {selectedItems.size === 0 && !selectionMode && mediaItems.length > 0 && (
                <View style={styles.actionBar}>
                    <ModernCard style={styles.actionCard}>
                        <View style={styles.instructionContainer}>
                            <ThemedIcon name="info" size={20} color="primary" />
                            <ThemedText variant="body" color="secondary" style={styles.instructionText}>
                                Long press any media to select, then choose an action. Tap audio files to play.
                            </ThemedText>
                        </View>
                    </ModernCard>
                </View>
            )}

            {/* AI Predictions Overlay */}
            {showPredictions && predictions.length > 0 && (
                <Animated.View
                    entering={FadeInDown.duration(300)}
                    exiting={FadeOutUp.duration(250)}
                    style={styles.predictionsOverlay}
                >
                    <ModernCard style={styles.predictionsCard}>
                        <View style={styles.predictionsHeader}>
                            <ThemedIcon name="cpu" size={20} color="primary" />
                            <ThemedText variant="h3" style={styles.predictionsTitle}>
                                AI Bird Identification
                            </ThemedText>
                            <ThemedText variant="caption" color="secondary">
                                Processing time: {processingTime.toFixed(1)}s
                            </ThemedText>
                        </View>

                        <View style={styles.predictionsList}>
                            {predictions.map((prediction, index) => (
                                <ThemedPressable
                                    key={index}
                                    variant="ghost"
                                    style={styles.predictionItem}
                                    onPress={() => handleSelectPrediction(prediction)}
                                >
                                    <View style={styles.predictionContent}>
                                        <ThemedText variant="body" style={styles.predictionText}>
                                            {prediction.text}
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
                        </View>

                        <ThemedText variant="caption" color="tertiary" style={styles.autoHideText}>
                            Tap a result to select, or wait for auto-hide
                        </ThemedText>
                    </ModernCard>
                </Animated.View>
            )}

            {/* Media Grid */}
            {mediaItems.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <View style={[styles.emptyIcon, { backgroundColor: colors.backgroundSecondary }]}>
                        <ThemedIcon name="camera" size={48} color="primary" />
                    </View>
                    <ThemedText variant="h3" style={styles.emptyTitle}>
                        No Media Files
                    </ThemedText>
                    <ThemedText variant="body" color="secondary" style={styles.emptyMessage}>
                        Take photos or record audio to see them here.
                    </ThemedText>
                </View>
            ) : (
                <FlatList
                    data={mediaItems}
                    renderItem={renderMediaItem}
                    keyExtractor={(item) => item.uri}
                    numColumns={2}
                    contentContainerStyle={styles.gridContent}
                    columnWrapperStyle={styles.gridRow}
                    showsVerticalScrollIndicator={false}
                    onRefresh={loadMediaFiles}
                    refreshing={loading}
                />
            )}
            <SnackbarComponent />
        </ThemedSafeAreaView>
    );
}

function createStyles() {
    return StyleSheet.create({
        container: {
            flex: 1,
            paddingTop: 32,
        },

        // Header
        header: {
            paddingHorizontal: 16,
            paddingVertical: 16,
        },
        headerTitle: {
            fontWeight: 'bold',
            marginBottom: 4,
        },

        // Loading
        loadingContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            gap: 16,
        },
        loadingText: {
            textAlign: 'center',
        },

        // Action Bar
        actionBar: {
            paddingHorizontal: 16,
            paddingBottom: 16,
        },
        actionCard: {
            padding: 12,
        },
        actionButtons: {
            flexDirection: 'row',
            gap: 8,
            flexWrap: 'wrap',
        },
        actionButton: {
            flexDirection: 'row',
            gap: 4,
        },
        instructionContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            padding: 4,
        },
        instructionText: {
            flex: 1,
            lineHeight: 20,
        },

        // Media Grid
        gridContent: {
            paddingHorizontal: 16,
            paddingBottom: 32,
        },
        gridRow: {
            justifyContent: 'space-between',
        },

        // Media Items
        photoContainer: {
            width: '48%',
            marginBottom: 16,
        },
        photoWrapper: {
            position: 'relative',
            borderRadius: 12,
            overflow: 'hidden',
            backgroundColor: 'rgba(0,0,0,0.1)',
        },
        photo: {
            width: '100%',
            height: 150,
            resizeMode: 'cover',
        },
        brokenImageContainer: {
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'rgba(0,0,0,0.05)',
            gap: 8,
        },
        audioContainer: {
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'rgba(0,0,0,0.05)',
            gap: 8,
            position: 'relative',
        },
        audioLabel: {
            textAlign: 'center',
            fontSize: 12,
        },
        playingIndicator: {
            position: 'absolute',
            top: 8,
            right: 8,
        },
        selectionIndicator: {
            position: 'absolute',
            top: 8,
            right: 8,
            width: 24,
            height: 24,
            borderRadius: 12,
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: 2,
            borderColor: 'white',
        },
        classificationBadge: {
            position: 'absolute',
            bottom: 8,
            left: 8,
            right: 8,
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 6,
        },
        photoInfo: {
            paddingTop: 8,
            gap: 2,
        },

        // Empty State
        emptyContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 16,
            gap: 16,
        },
        emptyIcon: {
            width: 96,
            height: 96,
            borderRadius: 48,
            justifyContent: 'center',
            alignItems: 'center',
        },
        emptyTitle: {
            textAlign: 'center',
            fontWeight: '600',
        },
        emptyMessage: {
            textAlign: 'center',
            lineHeight: 20,
            maxWidth: 280,
        },

        // AI Predictions Overlay
        predictionsOverlay: {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 20,
            zIndex: 1000,
        },
        predictionsCard: {
            width: '100%',
            maxWidth: 400,
            maxHeight: '70%',
            padding: 20,
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
            gap: 12,
            marginBottom: 16,
        },
        predictionItem: {
            flexDirection: 'row',
            alignItems: 'center',
            padding: 12,
            borderRadius: 8,
            backgroundColor: 'rgba(0, 0, 0, 0.02)',
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
        autoHideText: {
            textAlign: 'center',
            fontStyle: 'italic',
        },
    });
}