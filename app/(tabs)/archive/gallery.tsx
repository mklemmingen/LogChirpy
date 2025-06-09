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
import { useUnifiedColors } from '@/hooks/useUnifiedColors';
import { useResponsiveDimensions } from '@/hooks/useResponsiveDimensions';

interface PhotoItem {
    uri: string;
    filename: string;
    size: number;
    modificationTime: number;
    classification?: string;
}

export default function GalleryManagementScreen() {
    const { t } = useTranslation();
    const colors = useUnifiedColors();
    const dimensions = useResponsiveDimensions();
    const styles = createStyles(dimensions);

    const [photos, setPhotos] = useState<PhotoItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
    const [selectionMode, setSelectionMode] = useState(false);

    // Load photos from document storage
    const loadPhotos = useCallback(async () => {
        try {
            setLoading(true);
            const documentDirPath = FileSystem.documentDirectory;
            
            if (!documentDirPath) {
                setPhotos([]);
                return;
            }

            const files = await FileSystem.readDirectoryAsync(documentDirPath);
            const photoFiles = files.filter((fileName: string) => 
                fileName.startsWith('photo_') && fileName.endsWith('.jpg')
            );

            const photoItems: PhotoItem[] = await Promise.all(
                photoFiles.map(async (fileName: string) => {
                    const filePath = `${documentDirPath}${fileName}`;
                    const info = await FileSystem.getInfoAsync(filePath);
                    // Extract classification from filename if present
                    const match = fileName.match(/photo_(\d+)\.jpg/);
                    const classification = extractClassificationFromFilename(fileName);
                    
                    return {
                        uri: filePath,
                        filename: fileName,
                        size: (info as any).size || 0,
                        modificationTime: (info as any).modificationTime || 0,
                        classification,
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

    // Extract classification from filename patterns like "bird_BlackBaza_timestamp.jpg"
    const extractClassificationFromFilename = (filename: string): string | undefined => {
        const patterns = [
            /bird_([^_]+)_\d+\.jpg/,  // bird_SpeciesName_timestamp.jpg
            /full_([^_]+)_\d+\.jpg/,  // full_SpeciesName_timestamp.jpg
        ];

        for (const pattern of patterns) {
            const match = filename.match(pattern);
            if (match) {
                return match[1].replace(/([A-Z])/g, ' $1').trim();
            }
        }
        return undefined;
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
                                const info = await FileSystem.getInfoAsync(uri);
                                if (info.exists) {
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
                        isSelected && { borderColor: colors.interactive.primary, borderWidth: 3 }
                    ]}
                >
                    <Image source={{ uri: item.uri }} style={styles.photo} />
                    
                    {/* Selection indicator */}
                    {selectionMode && (
                        <View style={[
                            styles.selectionIndicator,
                            { backgroundColor: isSelected ? colors.interactive.primary : colors.background.secondary }
                        ]}>
                            {isSelected && (
                                <ThemedIcon name="check" size={16} color="primary" />
                            )}
                        </View>
                    )}
                    
                    {/* Classification label */}
                    {item.classification && (
                        <View style={[styles.classificationBadge, { backgroundColor: colors.background.secondary }]}>
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
                    <ActivityIndicator size="large" color={colors.interactive.primary} />
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
                    <View style={[styles.emptyIcon, { backgroundColor: colors.background.secondary }]}>
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

function createStyles(dimensions: ReturnType<typeof useResponsiveDimensions>) {
    return StyleSheet.create({
        container: {
            flex: 1,
        },
        
        // Header
        header: {
            paddingHorizontal: dimensions.layout.screenPadding.horizontal,
            paddingVertical: dimensions.layout.componentSpacing,
        },
        headerTitle: {
            fontWeight: 'bold',
            marginBottom: dimensions.layout.componentSpacing / 4,
        },

        // Loading
        loadingContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            gap: dimensions.layout.componentSpacing,
        },
        loadingText: {
            textAlign: 'center',
        },

        // Action Bar
        actionBar: {
            paddingHorizontal: dimensions.layout.screenPadding.horizontal,
            paddingBottom: dimensions.layout.componentSpacing,
        },
        actionCard: {
            padding: dimensions.card.padding.sm,
        },
        actionButtons: {
            flexDirection: 'row',
            gap: dimensions.layout.componentSpacing / 2,
            flexWrap: 'wrap',
        },
        actionButton: {
            flexDirection: 'row',
            gap: dimensions.layout.componentSpacing / 4,
        },

        // Photo Grid
        gridContent: {
            paddingHorizontal: dimensions.layout.screenPadding.horizontal,
            paddingBottom: dimensions.layout.sectionSpacing,
        },
        gridRow: {
            justifyContent: 'space-between',
        },
        
        // Photo Items
        photoContainer: {
            width: dimensions.screen.isTablet ? '31%' : dimensions.screen.isSmall ? '100%' : '48%',
            marginBottom: dimensions.layout.componentSpacing,
        },
        photoWrapper: {
            position: 'relative',
            borderRadius: dimensions.card.borderRadius.md,
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
            paddingHorizontal: dimensions.layout.componentSpacing / 2,
            paddingVertical: dimensions.layout.componentSpacing / 4,
            borderRadius: dimensions.card.borderRadius.sm,
        },
        photoInfo: {
            paddingTop: dimensions.layout.componentSpacing / 2,
            gap: dimensions.layout.componentSpacing / 8,
        },

        // Empty State
        emptyContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: dimensions.layout.screenPadding.horizontal,
            gap: dimensions.layout.componentSpacing,
        },
        emptyIcon: {
            width: dimensions.icon.xxl * 2,
            height: dimensions.icon.xxl * 2,
            borderRadius: dimensions.icon.xxl,
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