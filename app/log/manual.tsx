import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    Modal,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    useColorScheme,
    View,
    StatusBar,
    Linking,
    BackHandler,
} from 'react-native';
import { router, Stack, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Audio } from 'expo-av';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

import { useLogDraft } from '../context/LogDraftContext';
import { BirdSpotting, insertBirdSpotting } from '@/services/database';
import { theme } from '@/constants/theme';
import { useVideoPlayer, VideoSource, VideoView } from 'expo-video';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TILE_PADDING = 16;
const TILE_GAP = 12;
const CONTENT_PADDING = 16;
const TILE_WIDTH = (SCREEN_WIDTH - CONTENT_PADDING * 2 - TILE_GAP) / 2;
const FULL_TILE_WIDTH = SCREEN_WIDTH - CONTENT_PADDING * 2;

type TileType = 'image' | 'video' | 'audio' | 'text' | 'date' | 'location' | 'prediction' | 'add-button';

interface TileConfig {
    id: string;
    type: TileType;
    label: string;
    span: 'half' | 'full';
    required?: boolean;
    editable?: boolean;
    value?: string | number;
    placeholder?: string;
    onPress?: () => void;
    onTextChange?: (text: string) => void;
    icon?: keyof typeof Feather.glyphMap;
    status?: 'empty' | 'filled' | 'loading' | 'error';
}

interface ValidationError {
    field: string;
    message: string;
}

export default function Manual() {
    const params = useLocalSearchParams();
    const { t } = useTranslation();
    const { draft, update, clear } = useLogDraft();
    const colorScheme = useColorScheme() ?? 'light';
    const pal = theme[colorScheme];

    // State management
    const [isSaving, setIsSaving] = useState(false);
    const [isLoadingLocation, setIsLoadingLocation] = useState(false);
    const [sound, setSound] = useState<Audio.Sound | null>(null);
    const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

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

    // Handle incoming media from navigation params
    useEffect(() => {
        const updates: Partial<BirdSpotting> = {};

        if (params.audioUri && params.audioUri !== draft.audioUri) {
            updates.audioUri = params.audioUri as string;
        }
        if (params.imageUri && params.imageUri !== draft.imageUri) {
            updates.imageUri = params.imageUri as string;
        }
        if (params.videoUri && params.videoUri !== draft.videoUri) {
            updates.videoUri = params.videoUri as string;
        }

        if (Object.keys(updates).length > 0) {
            update(updates);
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

    // Navigation guard for unsaved changes (Android back button)
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
                return true; // Prevent default back action
            };

            // Handle Android back button
            const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);

            return () => subscription.remove();
        }, [draft, clear, t])
    );

    // Cleanup audio on unmount
    useEffect(() => {
        return () => {
            if (sound) {
                sound.unloadAsync();
            }
        };
    }, [sound]);

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

    // Media handling functions
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
            Alert.alert(t('common.error'), t('audio.playback_failed'));
        }
    }, [draft.audioUri, sound, t]);

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
        } catch (error) {
            console.error('Location error:', error);
            Alert.alert(t('common.error'), t('location.failed_to_get'));
        } finally {
            setIsLoadingLocation(false);
        }
    }, [update, t]);

    const handleTextChange = useCallback((key: string, value: string) => {
        update({ [key]: value });

        // Clear validation errors for this field
        setValidationErrors(prev => prev.filter(error => error.field !== key));
    }, [update]);

    const handleDateChange = useCallback((event: any, date?: Date) => {
        if (Platform.OS === 'android') {
            setIsDatePickerVisible(false);
        }

        if (date) {
            setSelectedDate(date);
            update({ date: date.toISOString() });
        }
    }, [update]);

    // Video modal handlers
    const openVideoModal = useCallback(() => {
        setIsVideoModalVisible(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, []);

    const closeVideoModal = useCallback(() => {
        setIsVideoModalVisible(false);
        fullscreenPlayer?.pause();
    }, [fullscreenPlayer]);

    const handleVideoRetake = useCallback(() => {
        closeVideoModal();
        router.push('/log/video');
    }, [closeVideoModal]);

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

            // Navigate with success feedback
            router.replace('/(tabs)');

            // Show success message
            setTimeout(() => {
                Alert.alert(
                    t('log.save_success'),
                    t('log.entry_saved_successfully')
                );
            }, 500);

        } catch (error) {
            console.error('Save error:', error);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert(
                t('errors.save_failed_title'),
                t('errors.save_failed_message')
            );
        } finally {
            setIsSaving(false);
        }
    }, [draft, clear, t]);

    const handleSave = useCallback(async () => {
        const errors = validateEntry();
        setValidationErrors(errors);

        if (errors.length > 0) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            Alert.alert(
                t('validation.incomplete_entry'),
                errors.map(e => e.message).join('\n'),
                [{ text: t('common.ok') }]
            );
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
    }, [validateEntry, completionPercentage, performSave, t]);

    // Tile generation
    const tiles = useMemo((): TileConfig[] => {
        const tileList: TileConfig[] = [];

        // Media tiles
        if (draft.imageUri) {
            tileList.push({
                id: 'image',
                type: 'image',
                label: t('log.image'),
                span: 'half',
                status: 'filled',
                onPress: () => handleMediaNavigation('/log/photo'),
            });
        } else {
            tileList.push({
                id: 'add-image',
                type: 'add-button',
                label: t('log.add_image'),
                span: 'half',
                icon: 'camera',
                status: 'empty',
                onPress: () => handleMediaNavigation('/log/photo'),
            });
        }

        if (draft.videoUri) {
            tileList.push({
                id: 'video',
                type: 'video',
                label: t('log.video'),
                span: 'half',
                status: 'filled',
                onPress: openVideoModal,
            });
        } else {
            tileList.push({
                id: 'add-video',
                type: 'add-button',
                label: t('log.add_video'),
                span: 'half',
                icon: 'video',
                status: 'empty',
                onPress: () => handleMediaNavigation('/log/video'),
            });
        }

        if (draft.audioUri) {
            tileList.push({
                id: 'audio',
                type: 'audio',
                label: t('log.audio'),
                span: 'half',
                status: 'filled',
                onPress: handlePlayAudio,
            });
        } else {
            tileList.push({
                id: 'add-audio',
                type: 'add-button',
                label: t('log.add_audio'),
                span: 'half',
                icon: 'mic',
                status: 'empty',
                onPress: () => handleMediaNavigation('/log/audio'),
            });
        }

        // Text input tiles
        tileList.push({
            id: 'birdType',
            type: 'text',
            label: t('log.bird_type'),
            span: 'half',
            required: true,
            editable: true,
            value: draft.birdType || '',
            placeholder: t('log.bird_type_placeholder'),
            onTextChange: (text) => handleTextChange('birdType', text),
            status: draft.birdType?.trim() ? 'filled' : 'empty',
        });

        tileList.push({
            id: 'notes',
            type: 'text',
            label: t('log.notes'),
            span: 'full',
            editable: true,
            value: draft.textNote || '',
            placeholder: t('log.notes_placeholder'),
            onTextChange: (text) => handleTextChange('textNote', text),
            status: draft.textNote?.trim() ? 'filled' : 'empty',
        });

        // Date and location tiles
        tileList.push({
            id: 'date',
            type: 'date',
            label: t('log.date'),
            span: 'half',
            value: draft.date ? new Date(draft.date).toLocaleDateString() : new Date().toLocaleDateString(),
            onPress: () => {
                setSelectedDate(draft.date ? new Date(draft.date) : new Date());
                setIsDatePickerVisible(true);
            },
            status: 'filled',
        });

        const hasLocation = draft.gpsLat && draft.gpsLng;
        tileList.push({
            id: 'location',
            type: 'location',
            label: t('log.location'),
            span: 'half',
            value: hasLocation
                ? `${draft.gpsLat!.toFixed(6)}, ${draft.gpsLng!.toFixed(6)}`
                : t('log.no_location'),
            onPress: handleGetLocation,
            status: isLoadingLocation ? 'loading' : (hasLocation ? 'filled' : 'empty'),
        });

        // Prediction tiles (only show if they exist)
        if (draft.imagePrediction) {
            tileList.push({
                id: 'image-prediction',
                type: 'prediction',
                label: t('log.image_prediction'),
                span: 'half',
                value: draft.imagePrediction,
                status: 'filled',
            });
        }

        if (draft.audioPrediction) {
            tileList.push({
                id: 'audio-prediction',
                type: 'prediction',
                label: t('log.audio_prediction'),
                span: 'half',
                value: draft.audioPrediction,
                status: 'filled',
            });
        }

        return tileList;
    }, [draft, t, handlePlayAudio, handleGetLocation, handleTextChange, openVideoModal, handleMediaNavigation, isLoadingLocation]);

    // Tile rendering
    const renderTile = useCallback((tile: TileConfig) => {
        const isHalfTile = tile.span === 'half';
        const width = isHalfTile ? TILE_WIDTH : FULL_TILE_WIDTH;
        const hasError = validationErrors.some(error => error.field === tile.id);

        const baseTileStyle = [
            styles.tile,
            {
                width,
                backgroundColor: pal.colors.surface,
                borderColor: hasError ? pal.colors.error : 'transparent',
                borderWidth: hasError ? 2 : 0,
            }
        ];

        switch (tile.type) {
            case 'image':
                return (
                    <TouchableOpacity
                        key={tile.id}
                        style={[...baseTileStyle, styles.mediaTile]}
                        onPress={tile.onPress}
                        activeOpacity={0.8}
                    >
                        <Image
                            source={{ uri: draft.imageUri! }}
                            style={styles.mediaPreview}
                            resizeMode="cover"
                        />
                        <View style={styles.mediaOverlay}>
                            <Text style={[styles.mediaLabel, { color: '#fff' }]}>
                                {tile.label}
                            </Text>
                            <Feather name="edit-2" size={16} color="#fff" />
                        </View>
                    </TouchableOpacity>
                );

            case 'video':
                return (
                    <TouchableOpacity
                        key={tile.id}
                        style={[...baseTileStyle, styles.mediaTile]}
                        onPress={tile.onPress}
                        activeOpacity={0.8}
                    >
                        {previewPlayer && (
                            <VideoView
                                player={previewPlayer}
                                style={styles.mediaPreview}
                                contentFit="cover"
                            />
                        )}
                        <View style={styles.mediaOverlay}>
                            <Text style={[styles.mediaLabel, { color: '#fff' }]}>
                                {tile.label}
                            </Text>
                            <Feather name="play" size={16} color="#fff" />
                        </View>
                    </TouchableOpacity>
                );

            case 'audio':
                return (
                    <TouchableOpacity
                        key={tile.id}
                        style={[...baseTileStyle, styles.audioTile]}
                        onPress={tile.onPress}
                        activeOpacity={0.8}
                    >
                        <View style={styles.audioContent}>
                            <View style={[styles.audioIcon, { backgroundColor: pal.colors.primary + '20' }]}>
                                <Feather
                                    name={sound ? 'pause' : 'play'}
                                    size={24}
                                    color={pal.colors.primary}
                                />
                            </View>
                            <Text style={[styles.tileLabel, { color: pal.colors.text.secondary }]}>
                                {tile.label}
                            </Text>
                            <Text style={[styles.audioStatus, { color: pal.colors.text.primary }]}>
                                {sound ? t('log.playing') : t('log.tap_to_play')}
                            </Text>
                        </View>
                    </TouchableOpacity>
                );

            case 'text':
                return (
                    <View key={tile.id} style={baseTileStyle}>
                        <Text style={[styles.tileLabel, { color: pal.colors.text.secondary }]}>
                            {tile.label}
                            {tile.required && <Text style={{ color: pal.colors.error }}>*</Text>}
                        </Text>
                        <TextInput
                            style={[
                                styles.textInput,
                                tile.span === 'full' && styles.multilineInput,
                                {
                                    color: pal.colors.text.primary,
                                    borderColor: pal.colors.border,
                                }
                            ]}
                            value={tile.value as string}
                            onChangeText={tile.onTextChange}
                            multiline={tile.span === 'full'}
                            placeholder={tile.placeholder}
                            placeholderTextColor={pal.colors.text.secondary + '80'}
                            textAlignVertical={tile.span === 'full' ? 'top' : 'center'}
                        />
                    </View>
                );

            case 'date':
            case 'location':
                return (
                    <TouchableOpacity
                        key={tile.id}
                        style={baseTileStyle}
                        onPress={tile.onPress}
                        activeOpacity={0.8}
                    >
                        <View style={styles.infoTileHeader}>
                            <Text style={[styles.tileLabel, { color: pal.colors.text.secondary }]}>
                                {tile.label}
                            </Text>
                            {tile.status === 'loading' && (
                                <ActivityIndicator size="small" color={pal.colors.primary} />
                            )}
                            {tile.status !== 'loading' && (
                                <Feather
                                    name={tile.type === 'date' ? 'calendar' : 'map-pin'}
                                    size={16}
                                    color={pal.colors.primary}
                                />
                            )}
                        </View>
                        <Text style={[styles.infoValue, { color: pal.colors.text.primary }]}>
                            {tile.value as string}
                        </Text>
                    </TouchableOpacity>
                );

            case 'prediction':
                return (
                    <View key={tile.id} style={[...baseTileStyle, styles.predictionTile]}>
                        <View style={styles.predictionHeader}>
                            <Feather name="zap" size={16} color={pal.colors.primary} />
                            <Text style={[styles.tileLabel, { color: pal.colors.text.secondary }]}>
                                {tile.label}
                            </Text>
                        </View>
                        <Text style={[styles.predictionValue, { color: pal.colors.text.primary }]}>
                            {tile.value as string}
                        </Text>
                    </View>
                );

            case 'add-button':
                return (
                    <TouchableOpacity
                        key={tile.id}
                        style={[...baseTileStyle, styles.addButtonTile, { borderColor: pal.colors.primary }]}
                        onPress={tile.onPress}
                        activeOpacity={0.8}
                    >
                        <Feather name={tile.icon!} size={24} color={pal.colors.primary} />
                        <Text style={[styles.addButtonText, { color: pal.colors.primary }]}>
                            {tile.label}
                        </Text>
                    </TouchableOpacity>
                );

            default:
                return null;
        }
    }, [draft, pal, validationErrors, sound, previewPlayer, t]);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: pal.colors.background }]}>
            <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
            <Stack.Screen options={{ headerShown: false }} />

            {/* Progress Header */}
            <View style={[styles.header, { backgroundColor: pal.colors.surface }]}>
                <Text style={[styles.headerTitle, { color: pal.colors.text.primary }]}>
                    {t('log.manual_entry')}
                </Text>
                <View style={styles.progressContainer}>
                    <Text style={[styles.progressText, { color: pal.colors.text.secondary }]}>
                        {completionPercentage}% {t('log.complete')}
                    </Text>
                    <View style={[styles.progressBar, { backgroundColor: pal.colors.border }]}>
                        <View
                            style={[
                                styles.progressFill,
                                {
                                    backgroundColor: pal.colors.primary,
                                    width: `${completionPercentage}%`
                                }
                            ]}
                        />
                    </View>
                </View>
            </View>

            {/* Scrollable Content */}
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.tilesContainer}>
                    {tiles.map(renderTile)}
                </View>

                {/* Bottom spacing for save button */}
                <View style={styles.bottomSpacer} />
            </ScrollView>

            {/* Date Picker Modal */}
            {isDatePickerVisible && (
                <Modal
                    transparent
                    animationType="slide"
                    visible={isDatePickerVisible}
                    onRequestClose={() => setIsDatePickerVisible(false)}
                >
                    <BlurView intensity={80} style={styles.modalContainer}>
                        <View style={[styles.datePickerContainer, { backgroundColor: pal.colors.surface }]}>
                            <Text style={[styles.modalTitle, { color: pal.colors.text.primary }]}>
                                {t('log.select_date')}
                            </Text>
                            <DateTimePicker
                                value={selectedDate}
                                mode="date"
                                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                onChange={handleDateChange}
                                maximumDate={new Date()}
                            />
                            {Platform.OS === 'ios' && (
                                <View style={styles.datePickerButtons}>
                                    <TouchableOpacity
                                        style={[styles.dateButton, { backgroundColor: pal.colors.border }]}
                                        onPress={() => setIsDatePickerVisible(false)}
                                    >
                                        <Text style={[styles.dateButtonText, { color: pal.colors.text.primary }]}>
                                            {t('common.cancel')}
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.dateButton, { backgroundColor: pal.colors.primary }]}
                                        onPress={() => {
                                            handleDateChange(null, selectedDate);
                                            setIsDatePickerVisible(false);
                                        }}
                                    >
                                        <Text style={[styles.dateButtonText, { color: '#fff' }]}>
                                            {t('common.confirm')}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    </BlurView>
                </Modal>
            )}

            {/* Video Modal */}
            <Modal
                visible={isVideoModalVisible}
                transparent
                animationType="fade"
                onRequestClose={closeVideoModal}
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
                    <View style={styles.videoModalControls}>
                        <TouchableOpacity
                            style={[styles.videoButton, { backgroundColor: pal.colors.surface }]}
                            onPress={closeVideoModal}
                        >
                            <Feather name="x" size={20} color={pal.colors.text.primary} />
                            <Text style={[styles.videoButtonText, { color: pal.colors.text.primary }]}>
                                {t('common.close')}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.videoButton, { backgroundColor: pal.colors.primary }]}
                            onPress={handleVideoRetake}
                        >
                            <Feather name="refresh-cw" size={20} color="#fff" />
                            <Text style={[styles.videoButtonText, { color: '#fff' }]}>
                                {t('camera.retake')}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Save Button */}
            <View style={[styles.saveButtonContainer, { backgroundColor: pal.colors.background }]}>
                <TouchableOpacity
                    style={[
                        styles.saveButton,
                        { backgroundColor: pal.colors.primary },
                        (isSaving) && styles.disabledButton
                    ]}
                    onPress={handleSave}
                    disabled={isSaving}
                    activeOpacity={0.8}
                >
                    {isSaving ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <Feather name="save" size={20} color="#fff" />
                    )}
                    <Text style={[styles.saveButtonText, { color: '#fff' }]}>
                        {isSaving ? t('common.saving') : t('common.save')}
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Loading Overlay */}
            {isSaving && (
                <View style={styles.loadingOverlay}>
                    <BlurView intensity={80} style={StyleSheet.absoluteFillObject}>
                        <View style={styles.loadingContent}>
                            <ActivityIndicator size="large" color={pal.colors.primary} />
                            <Text style={[styles.loadingText, { color: pal.colors.text.primary }]}>
                                {t('log.saving_entry')}
                            </Text>
                        </View>
                    </BlurView>
                </View>
            )}
        </SafeAreaView>
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
        padding: 24,
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        textAlign: 'center',
    },
    header: {
        paddingHorizontal: CONTENT_PADDING,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: theme.light.colors.border,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '700',
        marginBottom: 8,
    },
    progressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    progressText: {
        fontSize: 14,
        fontWeight: '500',
        minWidth: 80,
    },
    progressBar: {
        flex: 1,
        height: 4,
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 2,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: CONTENT_PADDING,
    },
    tilesContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: TILE_GAP,
    },
    bottomSpacer: {
        height: 100, // Space for save button
    },
    tile: {
        borderRadius: theme.borderRadius.lg,
        padding: TILE_PADDING,
        marginBottom: TILE_GAP,
        ...theme.shadows.md,
    },
    mediaTile: {
        padding: 0,
        overflow: 'hidden',
    },
    mediaPreview: {
        width: '100%',
        height: 120,
    },
    mediaOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 12,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
    },
    mediaLabel: {
        fontSize: 14,
        fontWeight: '600',
    },
    audioTile: {
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 120,
    },
    audioContent: {
        alignItems: 'center',
        gap: 8,
    },
    audioIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4,
    },
    audioStatus: {
        fontSize: 12,
        textAlign: 'center',
    },
    tileLabel: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
    },
    textInput: {
        borderWidth: 1,
        borderRadius: theme.borderRadius.md,
        padding: 12,
        fontSize: 16,
        minHeight: 44,
    },
    multilineInput: {
        height: 88,
        textAlignVertical: 'top',
    },
    infoTileHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    infoValue: {
        fontSize: 15,
        fontWeight: '500',
    },
    predictionTile: {
        borderLeftWidth: 3,
        borderLeftColor: theme.light.colors.primary,
    },
    predictionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 8,
    },
    predictionValue: {
        fontSize: 15,
        fontWeight: '500',
        fontStyle: 'italic',
    },
    addButtonTile: {
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderStyle: 'dashed',
        minHeight: 120,
        gap: 8,
    },
    addButtonText: {
        fontSize: 14,
        fontWeight: '600',
        textAlign: 'center',
    },
    modalContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    datePickerContainer: {
        margin: 20,
        borderRadius: theme.borderRadius.xl,
        padding: 24,
        alignItems: 'center',
        minWidth: 300,
        ...theme.shadows.md,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 16,
    },
    datePickerButtons: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 16,
    },
    dateButton: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: theme.borderRadius.md,
        alignItems: 'center',
    },
    dateButtonText: {
        fontSize: 16,
        fontWeight: '600',
    },
    videoModalContainer: {
        flex: 1,
        backgroundColor: '#000',
        justifyContent: 'space-between',
    },
    fullscreenVideo: {
        flex: 1,
    },
    videoModalControls: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        padding: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
    },
    videoButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: theme.borderRadius.md,
        gap: 8,
    },
    videoButtonText: {
        fontSize: 16,
        fontWeight: '600',
    },
    saveButtonContainer: {
        paddingHorizontal: CONTENT_PADDING,
        paddingVertical: 16,
        paddingBottom: 32,
        borderTopWidth: 1,
        borderTopColor: theme.light.colors.border,
    },
    saveButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: theme.borderRadius.lg,
        gap: 8,
        ...theme.shadows.md,
    },
    disabledButton: {
        opacity: 0.6,
    },
    saveButtonText: {
        fontSize: 18,
        fontWeight: '700',
    },
    loadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    loadingContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
    },
});