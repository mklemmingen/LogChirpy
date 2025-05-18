import { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    ScrollView,
    StyleSheet,
    Dimensions,
    SafeAreaView,
    ActivityIndicator,
    Image,
    TouchableOpacity,
    useColorScheme,
    Alert,
    Modal,
    Button,
    Platform, // Import für Plattformprüfung
} from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Audio } from 'expo-av';
import * as Location from 'expo-location';
import { useLogDraft } from '../context/LogDraftContext';
import { insertBirdSpotting } from '@/services/database';
import { theme } from '@/constants/theme';
import { useVideoPlayer, VideoView, VideoSource } from 'expo-video';

// Konstanten für das Layout
const COL_GAP = 12;
const SCREEN_W = Dimensions.get('window').width;
const HALF_W = (SCREEN_W - COL_GAP * 3) / 2;
const FULL_W = SCREEN_W - COL_GAP * 2;

// Kacheltypen und -struktur
type TileType = 'image' | 'video' | 'audio' | 'text' | 'date' | 'gps' | 'button';

type TileConfig = {
    type: TileType;
    key: string;
    label: string;
    span: 'half' | 'full';
    editable?: boolean;
    action?: () => void;
    value?: string;
};

export default function Manual() {
    const params = useLocalSearchParams();
    const { t } = useTranslation();
    const { draft, update, clear } = useLogDraft();
    const [busy, setBusy] = useState(false);
    const [tiles, setTiles] = useState<TileConfig[]>([]);
    const [sound, setSound] = useState<Audio.Sound | null>(null);
    const colorScheme = useColorScheme() ?? 'light';
    const pal = theme[colorScheme];
    const [isVideoModalVisible, setIsVideoModalVisible] = useState(false);

    // Datumsauswahl-Modal
    const [dateModalVisible, setDateModalVisible] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date());

    // Create preview video player at the top level
    const previewPlayer = useVideoPlayer((draft.videoUri || '') as VideoSource, (player) => {
        if (draft.videoUri) {
            player.loop = true;
            player.muted = true;
            player.play();
        }
    });

    // Create full screen video player
    const fullscreenPlayer = useVideoPlayer((draft.videoUri || '') as VideoSource, (player) => {
        if (draft.videoUri && isVideoModalVisible) {
            player.loop = false;
            player.muted = false;
            player.play();
        }
    });

    const openDateModal = () => {
        setSelectedDate(draft.date ? new Date(draft.date) : new Date());
        setDateModalVisible(true);
    };

    // Handle video modal
    const openVideoModal = () => {
        setIsVideoModalVisible(true);
    };

    const closeVideoModal = () => {
        setIsVideoModalVisible(false);
        fullscreenPlayer.pause();
    };

    const handleVideoRetake = () => {
        closeVideoModal();
        router.push('/log/video');
    };

    // Parameter aus der Navigation verarbeiten
    useEffect(() => {
        if (params.audioUri) {
            update({ audioUri: params.audioUri as string });
        }
        if (params.imageUri) {
            update({ imageUri: params.imageUri as string });
        }
        if (params.videoUri) {
            update({ videoUri: params.videoUri as string });
        }
    }, [params]);

    // Kacheln aktualisieren, wenn sich der Draft ändert
    useEffect(() => {
        const generateTiles = () => {
            const newTiles: TileConfig[] = [];

            // Bild-Kachel
            if (draft.imageUri) {
                newTiles.push({
                    type: 'image',
                    key: 'imageUri',
                    label: t('log.image'),
                    span: 'half',
                    action: () => router.push('/log/photo'),
                });
            } else {
                newTiles.push({
                    type: 'button',
                    key: 'addImage',
                    label: t('log.add_image'),
                    span: 'half',
                    action: () => router.push('/log/photo'),
                });
            }

            // Video-Kachel
            if (draft.videoUri) {
                newTiles.push({
                    type: 'video',
                    key: 'videoUri',
                    label: t('log.video'),
                    span: 'half',
                    action: () => openVideoModal(),
                });
            } else {
                newTiles.push({
                    type: 'button',
                    key: 'addVideo',
                    label: t('log.add_video'),
                    span: 'half',
                    action: () => router.push('/log/video'),
                });
            }

            // Audio-Kachel
            if (draft.audioUri) {
                newTiles.push({
                    type: 'audio',
                    key: 'audioUri',
                    label: t('log.audio'),
                    span: 'half',
                    action: () => playAudio(draft.audioUri || ''),
                });
            } else {
                newTiles.push({
                    type: 'button',
                    key: 'addAudio',
                    label: t('log.add_audio'),
                    span: 'half',
                    action: () => router.push('/log/audio'),
                });
            }

            // Vogelart-Kachel
            newTiles.push({
                type: 'text',
                key: 'birdType',
                label: t('log.bird_type'),
                span: 'half',
                editable: true,
                value: draft.birdType || '',
            });

            // Notiz-Kachel
            newTiles.push({
                type: 'text',
                key: 'textNote',
                label: t('log.notes'),
                span: 'full',
                editable: true,
                value: draft.textNote || '',
            });

            // Datum-Kachel
            newTiles.push({
                type: 'date',
                key: 'date',
                label: t('log.date'),
                span: 'half',
                value: draft.date ? new Date(draft.date).toLocaleDateString() : new Date().toLocaleDateString(),
                action: () => openDateModal(),
            });

            // GPS-Kachel
            const gpsValue = draft.gpsLat && draft.gpsLng
                ? `${draft.gpsLat.toFixed(6)}, ${draft.gpsLng.toFixed(6)}`
                : t('log.no_location');

            newTiles.push({
                type: 'gps',
                key: 'gps',
                label: t('log.location'),
                span: 'half',
                value: gpsValue,
                action: () => getLocation(),
            });

            // KI-Vorhersage-Kacheln (werden nur angezeigt, wenn vorhanden)
            if (draft.imagePrediction) {
                newTiles.push({
                    type: 'text',
                    key: 'imagePrediction',
                    label: t('log.image_prediction'),
                    span: 'half',
                    value: draft.imagePrediction || '',
                });
            }

            if (draft.audioPrediction) {
                newTiles.push({
                    type: 'text',
                    key: 'audioPrediction',
                    label: t('log.audio_prediction'),
                    span: 'half',
                    value: draft.audioPrediction || '',
                });
            }

            setTiles(newTiles);
        };

        generateTiles();
    }, [draft, t]);

    // Audio-Wiedergabe
    const playAudio = async (uri: string) => {
        try {
            if (sound) {
                await sound.unloadAsync();
                setSound(null);
            } else {
                const { sound: newSound } = await Audio.Sound.createAsync(
                    { uri },
                    { shouldPlay: true }
                );
                setSound(newSound);

                newSound.setOnPlaybackStatusUpdate((status) => {
                    if (status.isLoaded && 'didJustFinish' in status && status.didJustFinish) {
                        setSound(null);
                    }
                });
            }
        } catch (error) {
            console.error('Fehler bei der Audio-Wiedergabe:', error);
        }
    };

    // Standort abrufen
    const getLocation = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert(
                    t('errors.location_permission_title'),
                    t('errors.location_permission_message')
                );
                return;
            }

            const location = await Location.getCurrentPositionAsync({});
            update({
                gpsLat: location.coords.latitude,
                gpsLng: location.coords.longitude,
            });
        } catch (error) {
            console.error('Fehler beim Abrufen des Standorts:', error);
        }
    };

    // Textinput-Änderungen
    const handleTextChange = (key: string, value: string) => {
        update({ [key]: value });
    };

    // KI-Bildanalyse durchführen
    const analyzeImage = async () => {
        if (!draft.imageUri) return;

        try {

        } catch (error) {
            console.error('Bilderkennung fehlgeschlagen:', error);
        } finally {
            setBusy(false);
        }
    };

    // Speichern
    const onSave = async () => {
        setBusy(true);

        try {
            // KI-Bildanalyse nur ausführen, wenn ein Bild vorhanden ist und keine Vorhersage existiert
            if (draft.imageUri && !draft.imagePrediction) {
                await analyzeImage();
            }

            const now = new Date();
            await insertBirdSpotting({
                imageUri: draft.imageUri || '',
                videoUri: draft.videoUri || '',
                audioUri: draft.audioUri || '',
                textNote: draft.textNote || '',
                gpsLat: draft.gpsLat || 0,
                gpsLng: draft.gpsLng || 0,
                date: draft.date || now.toISOString(),
                birdType: draft.birdType || '',
                imagePrediction: draft.imagePrediction || '',
                audioPrediction: draft.audioPrediction || '',
            });

            // LogDraft zurücksetzen und Benutzer weiterleiten
            clear();
            router.replace('/(tabs)');
        } catch (error) {
            console.error('Fehler beim Speichern:', error);
            Alert.alert(
                t('errors.save_failed_title'),
                t('errors.save_failed_message')
            );
        } finally {
            setBusy(false);
        }
    };

    // Kachel-Rendering
    const renderTile = (tile: TileConfig) => {
        const tileStyles = [
            styles.tile,
            {
                width: tile.span === 'full' ? FULL_W : HALF_W,
                backgroundColor: pal.colors.card,
            }
        ];

        // Bild-Kachel
        if (tile.type === 'image' && draft.imageUri) {
            return (
                <TouchableOpacity
                    key={tile.key}
                    style={[...tileStyles, styles.mediaTile]}
                    onPress={tile.action}
                >
                    <Image
                        source={{ uri: draft.imageUri }}
                        style={styles.mediaPreview}
                        resizeMode="cover"
                    />
                    <View style={styles.tileOverlay}>
                        <Text style={[styles.tileLabel, { color: pal.colors.text.light }]}>
                            {tile.label}
                        </Text>
                    </View>
                </TouchableOpacity>
            );
        }

        // Video-Kachel
        if (tile.type === 'video' && draft.videoUri) {
            return (
                <>
                    <TouchableOpacity
                        key={tile.key}
                        style={[...tileStyles, styles.mediaTile]}
                        onPress={openVideoModal}
                    >
                        <VideoView
                            player={previewPlayer}
                            style={styles.mediaPreview}
                            contentFit="cover"
                        />
                        <View style={styles.tileOverlay}>
                            <Text style={[styles.tileLabel, { color: pal.colors.text.light }]}>
                                {tile.label}
                            </Text>
                        </View>
                    </TouchableOpacity>

                    <Modal
                        visible={isVideoModalVisible}
                        transparent={true}
                        animationType="fade"
                        onRequestClose={closeVideoModal}
                    >
                        <View style={styles.videoModalContainer}>
                            <VideoView
                                player={fullscreenPlayer}
                                style={styles.fullscreenVideo}
                                contentFit="contain"
                                nativeControls
                            />
                            <View style={styles.videoModalControls}>
                                <TouchableOpacity
                                    style={[styles.button, { backgroundColor: pal.colors.primary }]}
                                    onPress={closeVideoModal}
                                >
                                    <Text style={styles.buttonText}>{t('select.back')}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.button, { backgroundColor: pal.colors.primary }]}
                                    onPress={handleVideoRetake}
                                >
                                    <Text style={styles.buttonText}>{t('camera.retake')}</Text>
                                </TouchableOpacity>

                            </View>
                        </View>
                    </Modal>
                </>
            );
        }

        // Audio-Kachel
        if (tile.type === 'audio') {
            return (
                <TouchableOpacity
                    key={tile.key}
                    style={[...tileStyles, { justifyContent: 'center', alignItems: 'center' }]}
                    onPress={tile.action}
                >
                    <Text style={[styles.audioIcon, { color: pal.colors.primary }]}>
                        {sound ? '■' : '▶'}
                    </Text>
                    <Text style={{ color: pal.colors.text.primary }}>
                        {sound ? t('log.stop_audio') : t('log.play_audio')}
                    </Text>
                </TouchableOpacity>
            );
        }

        // Text-Kachel (editierbar)
        if (tile.type === 'text' && tile.editable) {
            return (
                <View key={tile.key} style={tileStyles}>
                    <Text style={[styles.tileLabel, { color: pal.colors.text.secondary }]}>
                        {tile.label}
                    </Text>
                    <TextInput
                        style={[
                            styles.input,
                            tile.span === 'full' && styles.multilineInput,
                            { color: pal.colors.text.primary }
                        ]}
                        value={tile.value}
                        onChangeText={(text) => handleTextChange(tile.key, text)}
                        multiline={tile.span === 'full'}
                        placeholder={`${tile.label}...`}
                        placeholderTextColor={pal.colors.text.secondary + '80'}
                    />
                </View>
            );
        }

        // Text-Kachel (nicht editierbar)
        if (tile.type === 'text' && !tile.editable) {
            return (
                <View key={tile.key} style={tileStyles}>
                    <Text style={[styles.tileLabel, { color: pal.colors.text.secondary }]}>
                        {tile.label}
                    </Text>
                    <Text style={{ color: pal.colors.text.primary }}>{tile.value}</Text>
                </View>
            );
        }

        // Datum-Kachel
        if (tile.type === 'date') {
            return (
                <TouchableOpacity
                    key={tile.key}
                    style={tileStyles}
                    onPress={tile.action}
                >
                    <Text style={[styles.tileLabel, { color: pal.colors.text.secondary }]}>
                        {tile.label}
                    </Text>
                    <Text style={{ color: pal.colors.text.primary }}>
                        {tile.value}
                    </Text>
                </TouchableOpacity>
            );
        }

        // GPS-Kachel
        if (tile.type === 'gps') {
            return (
                <TouchableOpacity
                    key={tile.key}
                    style={tileStyles}
                    onPress={tile.action}
                >
                    <Text style={[styles.tileLabel, { color: pal.colors.text.secondary }]}>
                        {tile.label}
                    </Text>
                    <Text style={{ color: pal.colors.text.primary }}>
                        {tile.value}
                    </Text>
                </TouchableOpacity>
            );
        }

        // Button-Kachel (für "Hinzufügen")
        if (tile.type === 'button') {
            return (
                <TouchableOpacity
                    key={tile.key}
                    style={[...tileStyles, styles.addButtonTile]}
                    onPress={tile.action}
                >
                    <Text style={{ color: pal.colors.primary, fontWeight: '600' }}>
                        + {tile.label}
                    </Text>
                </TouchableOpacity>
            );
        }

        return null;
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: pal.colors.background }]}>
            <Stack.Screen options={{ headerShown: false }} />
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.masonry}>
                    {tiles.map(renderTile)}
                </View>
            </ScrollView>

            {/* Datumsauswahl-Modal */}
            <Modal
                visible={dateModalVisible}
                transparent={true}
                animationType="slide"
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>{t('log.select_date')}</Text>
                        {Platform.OS === 'ios' ? (
                            <View>
                                <TextInput
                                    style={styles.input}
                                    value={selectedDate.toDateString()}
                                    editable={false}
                                />
                                <Button
                                    title={t('buttons.confirm')}
                                    onPress={() => {
                                        update({ date: selectedDate.toISOString() });
                                        setDateModalVisible(false);
                                    }}
                                />
                            </View>
                        ) : (
                            <View>
                                <Button
                                    title={t('buttons.confirm')}
                                    onPress={() => {
                                        update({ date: selectedDate.toISOString() });
                                        setDateModalVisible(false);
                                    }}
                                />
                            </View>
                        )}
                        <Button
                            title={t('buttons.cancel')}
                            onPress={() => setDateModalVisible(false)}
                        />
                    </View>
                </View>
            </Modal>

            {/* Speichern-Button */}
            <TouchableOpacity
                style={[
                    styles.saveBtn,
                    { backgroundColor: pal.colors.primary },
                    busy && styles.disabledBtn
                ]}
                onPress={onSave}
            >
                <Text style={styles.saveText}>{t('buttons.save')}</Text>
            </TouchableOpacity>

            {busy && (
                <View style={styles.busyOverlay}>
                    <ActivityIndicator size="large" color={pal.colors.primary} />
                </View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        padding: COL_GAP,
    },
    masonry: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    tile: {
        marginBottom: COL_GAP,
        padding: 12,
        borderRadius: theme.borderRadius.md,
    },
    mediaTile: {
        padding: 0,
        overflow: 'hidden',
    },
    mediaPreview: {
        width: '100%',
        height: 120,
    },
    videoPreview: {
        width: '100%',
        height: 120,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#000',
    },
    playIcon: {
        fontSize: 32,
        color: '#fff',
    },
    tileOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 8,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    tileLabel: {
        fontSize: 14,
        fontWeight: '600',
    },
    input: {
        borderWidth: 1,
        borderColor: theme.light.colors.border,
        borderRadius: theme.borderRadius.sm,
        padding: 8,
        fontSize: 14,
    },
    multilineInput: {
        height: 80,
        textAlignVertical: 'top',
    },
    addButtonTile: {
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: theme.light.colors.primary,
    },
    saveBtn: {
        position: 'absolute',
        bottom: 16,
        left: 16,
        right: 16,
        padding: 16,
        borderRadius: theme.borderRadius.md,
        alignItems: 'center',
    },
    saveText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    disabledBtn: {
        opacity: 0.5,
    },
    modalContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalContent: {
        width: '80%',
        backgroundColor: '#fff',
        borderRadius: theme.borderRadius.md,
        padding: 20,
        alignItems: 'center',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    audioIcon: {
        fontSize: 32,
    },
    busyOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    videoModalContainer: {
        flex: 1,
        backgroundColor: 'black',
        justifyContent: 'space-between',
    },
    fullscreenVideo: {
        flex: 1,
        width: '100%',
    },
    videoModalControls: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        padding: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    button: {
        padding: 12,
        borderRadius: theme.borderRadius.sm,
        borderWidth: 1,
        borderColor: theme.light.colors.primary,
    },
    buttonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
});
