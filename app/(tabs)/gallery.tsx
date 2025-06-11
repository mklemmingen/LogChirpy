import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    FlatList,
    Image,
    StyleSheet,
    Alert,
    Pressable,
    Share,
    ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as Haptics from 'expo-haptics';

// Components
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedIcon } from '@/components/ThemedIcon';
import { ThemedPressable } from '@/components/ThemedPressable';
import { ThemedSafeAreaView } from '@/components/ThemedSafeAreaView';
import { ModernCard } from '@/components/ModernCard';

// Hooks
import { useColors } from '@/hooks/useThemeColor';

interface PhotoItem {
    uri: string;
    filename: string;
    size: number;
    modificationTime: number;
    classification?: string;
    confidence?: number;
    detectionType?: 'bird' | 'full';
}

export default function GalleryManagementScreen() {
    const { t } = useTranslation();
    const colors = useColors();
    const styles = createStyles();

    const [photos, setPhotos] = useState<PhotoItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
    const [selectionMode, setSelectionMode] = useState(false);

    // Load photos from document storage gallery directory
    const loadPhotos = useCallback(async () => {
        try {
            setLoading(true);
            const galleryDir = `${FileSystem.documentDirectory}gallery/`;
            
            // Check if gallery directory exists
            const dirInfo = await FileSystem.getInfoAsync(galleryDir);
            if (!dirInfo.exists) {
                setPhotos([]);
                return;
            }

            const files = await FileSystem.readDirectoryAsync(galleryDir);
            const photoFiles = files.filter(filename => 
                (filename.startsWith('bird_') || filename.startsWith('full_')) && filename.endsWith('.jpg')
            );

            const photoItems: PhotoItem[] = await Promise.all(
                photoFiles.map(async (filename) => {
                    const filePath = `${galleryDir}${filename}`;
                    const info = await FileSystem.getInfoAsync(filePath) as FileSystem.FileInfo & { modificationTime?: number };
                    const { classification, confidence, detectionType } = extractDataFromFilename(filename);
                    
                    return {
                        uri: filePath,
                        filename: filename,
                        size: info.exists && 'size' in info ? info.size : 0,
                        modificationTime: info.modificationTime || 0,
                        classification,
                        confidence,
                        detectionType,
                    };
                })
            );

            // Sort by modification time (newest first)
            photoItems.sort((a, b) => b.modificationTime - a.modificationTime);
            setPhotos(photoItems);
        } catch (error) {
            console.error('Failed to load photos:', error);
            Alert.alert(t('gallery.error'), t('gallery.load_failed'));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        loadPhotos();
    }, [loadPhotos]);

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
        const newSelection = new Set(selectedPhotos);
        if (newSelection.has(uri)) {
            newSelection.delete(uri);
        } else {
            newSelection.add(uri);
        }
        setSelectedPhotos(newSelection);
        
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

                    // Create asset
                    const asset = await MediaLibrary.createAssetAsync(uri);
                    
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

    const deletePhotos = async (photoUris: string[]) => {
        Alert.alert(
            t('gallery.delete_confirm'),
            t('gallery.delete_message', { count: photoUris.length }),
            [
                { text: t('buttons.cancel'), style: 'cancel' },
                {
                    text: t('buttons.delete'),
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            for (const uri of photoUris) {
                                const fileInfo = await FileSystem.getInfoAsync(uri);
                                if (fileInfo.exists) {
                                    await FileSystem.deleteAsync(uri);
                                }
                            }
                            setSelectedPhotos(new Set());
                            setSelectionMode(false);
                            await loadPhotos(); // Refresh the list
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        } catch (error) {
                            console.error('Delete failed:', error);
                            Alert.alert(t('gallery.delete_failed'), error instanceof Error ? error.message : String(error));
                        }
                    }
                }
            ]
        );
    };

    const sharePhotos = async (photoUris: string[]) => {
        try {
            await Share.share({
                message: t('gallery.share_title'),
                url: photoUris[0], // Share first photo URL
            });
        } catch (error) {
            console.error('Share failed:', error);
        }
    };

    const renderPhoto = ({ item, index }: { item: PhotoItem; index: number }) => {
        const isSelected = selectedPhotos.has(item.uri);
        
        return (
            <View style={styles.photoContainer}>
                <Pressable
                    onPress={() => {
                        if (selectionMode) {
                            toggleSelection(item.uri);
                        } else {
                            // Single photo actions
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
                    <Image source={{ uri: item.uri }} style={styles.photo} />
                    
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
                
                {/* Photo info */}
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
                    {t('gallery.subtitle', { count: photos.length })}
                </ThemedText>
            </ThemedView>

            {/* Selection Mode Actions */}
            {selectionMode && selectedPhotos.size > 0 && (
                <View style={styles.actionBar}>
                    <ModernCard style={styles.actionCard}>
                        <View style={styles.actionButtons}>
                            <ThemedPressable
                                variant="primary"
                                size="sm"
                                onPress={() => saveToGallery(Array.from(selectedPhotos))}
                                style={styles.actionButton}
                            >
                                <ThemedIcon name="download" size={16} color="primary" />
                                <ThemedText variant="labelMedium" color="primary">
                                    {t('gallery.save_to_gallery')}
                                </ThemedText>
                            </ThemedPressable>

                            <ThemedPressable
                                variant="secondary"
                                size="sm"
                                onPress={() => sharePhotos(Array.from(selectedPhotos))}
                                style={styles.actionButton}
                            >
                                <ThemedIcon name="share" size={16} color="secondary" />
                                <ThemedText variant="labelMedium" color="secondary">
                                    {t('buttons.share')}
                                </ThemedText>
                            </ThemedPressable>

                            <ThemedPressable
                                variant="secondary"
                                size="sm"
                                onPress={() => deletePhotos(Array.from(selectedPhotos))}
                                style={[styles.actionButton, { backgroundColor: 'red' }]}
                            >
                                <ThemedIcon name="trash-2" size={16} color="error" />
                                <ThemedText variant="labelMedium" color="error">
                                    {t('buttons.delete')}
                                </ThemedText>
                            </ThemedPressable>

                            <ThemedPressable
                                variant="ghost"
                                size="sm"
                                onPress={() => {
                                    setSelectionMode(false);
                                    setSelectedPhotos(new Set());
                                }}
                            >
                                <ThemedText variant="labelMedium" color="tertiary">
                                    {t('buttons.cancel')}
                                </ThemedText>
                            </ThemedPressable>
                        </View>
                    </ModernCard>
                </View>
            )}

            {/* Photo Grid */}
            {photos.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <View style={[styles.emptyIcon, { backgroundColor: colors.backgroundSecondary }]}>
                        <ThemedIcon name="camera" size={48} color="primary" />
                    </View>
                    <ThemedText variant="h3" style={styles.emptyTitle}>
                        {t('gallery.no_photos')}
                    </ThemedText>
                    <ThemedText variant="body" color="secondary" style={styles.emptyMessage}>
                        {t('gallery.no_photos_message')}
                    </ThemedText>
                </View>
            ) : (
                <FlatList
                    data={photos}
                    renderItem={renderPhoto}
                    keyExtractor={(item) => item.uri}
                    numColumns={2}
                    contentContainerStyle={styles.gridContent}
                    columnWrapperStyle={styles.gridRow}
                    showsVerticalScrollIndicator={false}
                    onRefresh={loadPhotos}
                    refreshing={loading}
                />
            )}
        </ThemedSafeAreaView>
    );
}

function createStyles() {
    return StyleSheet.create({
        container: {
            flex: 1,
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

        // Photo Grid
        gridContent: {
            paddingHorizontal: 16,
            paddingBottom: 32,
        },
        gridRow: {
            justifyContent: 'space-between',
        },
        
        // Photo Items
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
    });
}