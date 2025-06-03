import React, { useState } from 'react';
import {
    View,
    StyleSheet,
    ScrollView,
    Image,
    TouchableOpacity,
    useColorScheme,
    Text,
    Dimensions,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedPressable } from '@/components/ThemedPressable';
import { theme } from '@/constants/theme';
import { useLogDraft } from '../context/LogDraftContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PHOTO_SIZE = (SCREEN_WIDTH - 48) / 2;

export default function PhotoSelection() {
    const { t } = useTranslation();
    const colorScheme = useColorScheme() ?? 'light';
    const pal = theme[colorScheme];
    const { update } = useLogDraft();
    const params = useLocalSearchParams();

    const photos: string[] = params.photos ? JSON.parse(params.photos as string) : [];
    const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

    const handlePhotoSelect = (photoUri: string) => {
        setSelectedPhoto(photoUri);
        Haptics.selectionAsync();
    };

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
        <ThemedView style={[styles.container, { backgroundColor: pal.colors.background }]}>
            <View style={styles.header}>
                <ThemedText variant="headlineLarge">
                    {t('photo.select_best_photo')}
                </ThemedText>
                <ThemedText variant="bodyMedium" color="secondary">
                    {t('photo.tap_to_select')}
                </ThemedText>
            </View>

            <ScrollView style={styles.photoGrid} contentContainerStyle={styles.gridContent}>
                {photos.map((photoUri, index) => (
                    <TouchableOpacity
                        key={index}
                        style={[
                            styles.photoItem,
                            selectedPhoto === photoUri && {
                                borderColor: pal.colors.primary,
                                borderWidth: 3,
                            }
                        ]}
                        onPress={() => handlePhotoSelect(photoUri)}
                    >
                        <Image source={{ uri: photoUri }} style={styles.photoImage} />
                        {selectedPhoto === photoUri && (
                            <View style={[styles.selectedOverlay, { backgroundColor: pal.colors.primary }]}>
                                <Feather name="check" size={24} color="white" />
                            </View>
                        )}
                    </TouchableOpacity>
                ))}
            </ScrollView>

            <View style={styles.actions}>
                <ThemedPressable
                    variant="secondary"
                    onPress={handleRetakePhotos}
                    style={styles.actionButton}
                >
                    <Feather name="camera" size={20} color={pal.colors.content.primary} />
                    <ThemedText variant="labelLarge">
                        {t('photo.take_more')}
                    </ThemedText>
                </ThemedPressable>

                <ThemedPressable
                    variant="primary"
                    onPress={handleConfirm}
                    disabled={!selectedPhoto}
                    style={[styles.actionButton, styles.primaryButton]}
                >
                    <Feather name="check" size={20} color={pal.colors.content.inverse} />
                    <ThemedText variant="labelLarge" style={{ color: pal.colors.content.inverse }}>
                        {t('photo.use_this_photo')}
                    </ThemedText>
                </ThemedPressable>
            </View>
        </ThemedView>
    );
}

const photoSelectionStyles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        padding: 24,
        alignItems: 'center',
        gap: 8,
    },
    photoGrid: {
        flex: 1,
        paddingHorizontal: 16,
    },
    gridContent: {
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
    actions: {
        flexDirection: 'row',
        padding: 24,
        gap: 16,
    },
    actionButton: {
        flex: 1,
        flexDirection: 'row',
        gap: 8,
    },
    primaryButton: {
        flex: 2,
    },
});

const styles = StyleSheet.create({
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    topControls: {
        position: 'absolute',
        top: 50,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        zIndex: 10,
    },
    topCenter: {
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    photoCount: {
        color: 'white',
        fontSize: 14,
        fontWeight: '600',
    },
    controlButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    bottomControls: {
        position: 'absolute',
        bottom: 80,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 40,
        zIndex: 10,
    },
    sideButton: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    thumbnailContainer: {
        position: 'relative',
    },
    badge: {
        position: 'absolute',
        top: -8,
        right: -8,
        backgroundColor: '#FF3B30',
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    badgeText: {
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold',
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
    continueButton: {
        position: 'absolute',
        bottom: 20,
        left: 20,
        right: 20,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        zIndex: 10,
    },
    continueText: {
        fontSize: 16,
        fontWeight: '600',
    },
    ...photoSelectionStyles,
});
