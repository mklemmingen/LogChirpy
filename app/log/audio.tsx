import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Alert,
    BackHandler,
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    useColorScheme,
    View,
    StatusBar,
    Linking,
} from 'react-native';
import { Audio } from 'expo-av';
import {router, Stack, useFocusEffect, useRouter} from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';

import { theme } from '@/constants/theme';
import { useLogDraft } from '../context/LogDraftContext';

type RecordingStatus = 'idle' | 'recording' | 'stopping' | 'playback';

interface AudioQuality {
    android: {
        extension: string;
        outputFormat: number;
        audioEncoder: number;
        sampleRate: number;
        numberOfChannels: number;
        bitRate: number;
    };
    ios: {
        extension: string;
        outputFormat: string;
        audioQuality: number;
        sampleRate: number;
        numberOfChannels: number;
        bitRate: number;
        linearPCMBitDepth: number;
        linearPCMIsBigEndian: boolean;
        linearPCMIsFloat: boolean;
    };
}

export default function AudioCapture() {
    const router = useRouter();
    const { t } = useTranslation();
    const { update } = useLogDraft();
    const colorScheme = useColorScheme() ?? 'light';
    const pal = theme[colorScheme];

    // Recording state
    const [status, setStatus] = useState<RecordingStatus>('idle');
    const [duration, setDuration] = useState(0);
    const [recordedUri, setRecordedUri] = useState<string | null>(null);
    const [sound, setSound] = useState<Audio.Sound | null>(null);
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const [isRequestingPermission, setIsRequestingPermission] = useState(false);

    // Refs
    const recordingRef = useRef<Audio.Recording | null>(null);
    const durationInterval = useRef<NodeJS.Timeout | null>(null);
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const waveAnim = useRef(new Animated.Value(0)).current;

    // Custom audio quality for bird recordings
    const audioQuality: AudioQuality = {
        android: {
            extension: '.m4a',
            outputFormat: Audio.AndroidOutputFormat.MPEG_4,
            audioEncoder: Audio.AndroidAudioEncoder.AAC,
            sampleRate: 44100,
            numberOfChannels: 2,
            bitRate: 128000,
        },
        ios: {
            extension: '.m4a',
            outputFormat: Audio.IOSOutputFormat.MPEG4AAC.toString(),
            audioQuality: Audio.IOSAudioQuality.HIGH,
            sampleRate: 44100,
            numberOfChannels: 2,
            bitRate: 128000,
            linearPCMBitDepth: 16,
            linearPCMIsBigEndian: false,
            linearPCMIsFloat: false,
        },
    };

    // Initialize component
    useEffect(() => {
        checkPermissions();
        return cleanup;
    }, []);

    // Handle back button when recording
    useFocusEffect(
        useCallback(() => {
            const onBackPress = () => {
                if (status === 'recording') {
                    Alert.alert(
                        t('audio.stop_recording_title'),
                        t('audio.stop_recording_message'),
                        [
                            { text: t('common.continue'), style: 'cancel' },
                            {
                                text: t('audio.stop_and_exit'),
                                style: 'destructive',
                                onPress: handleForceExit
                            },
                        ]
                    );
                    return true; // Prevent default back
                }
                return false; // Allow normal back
            };

            const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
            return () => subscription.remove();
        }, [status, t])
    );

    // Pulse animation for recording button
    useEffect(() => {
        if (status === 'recording') {
            const pulse = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.15,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                ])
            );
            pulse.start();
            return () => pulse.stop();
        } else {
            pulseAnim.setValue(1);
        }
    }, [status, pulseAnim]);

    // Wave animation for visual feedback
    useEffect(() => {
        if (status === 'recording') {
            const wave = Animated.loop(
                Animated.sequence([
                    Animated.timing(waveAnim, {
                        toValue: 1,
                        duration: 1500,
                        useNativeDriver: false,
                    }),
                    Animated.timing(waveAnim, {
                        toValue: 0,
                        duration: 1500,
                        useNativeDriver: false,
                    }),
                ])
            );
            wave.start();
            return () => wave.stop();
        }
    }, [status, waveAnim]);

    const cleanup = useCallback(() => {
        if (durationInterval.current) {
            clearInterval(durationInterval.current);
        }
        if (sound) {
            sound.unloadAsync();
        }
        if (recordingRef.current) {
            recordingRef.current.stopAndUnloadAsync();
        }
    }, [sound]);

    const checkPermissions = async () => {
        try {
            const { status } = await Audio.requestPermissionsAsync();
            setHasPermission(status === 'granted');

            if (status !== 'granted') {
                Alert.alert(
                    t('audio.permission_required'),
                    t('audio.permission_message'),
                    [
                        { text: t('common.cancel'), onPress: () => router.back() },
                        { text: t('common.settings'), onPress: openAppSettings },
                    ]
                );
            }
        } catch (error) {
            console.error('Permission check failed:', error);
            setHasPermission(false);
        }
    };

    const openAppSettings = useCallback(async () => {
        try {
            await Linking.openSettings();
        } catch (error) {
            console.error('Failed to open settings:', error);
        }
    }, []);

    const requestPermission = async () => {
        setIsRequestingPermission(true);
        try {
            const { status } = await Audio.requestPermissionsAsync();
            setHasPermission(status === 'granted');

            if (status !== 'granted') {
                Alert.alert(
                    t('audio.permission_denied'),
                    t('audio.permission_denied_message'),
                    [
                        { text: t('common.cancel') },
                        { text: t('common.settings'), onPress: openAppSettings },
                    ]
                );
            }
        } catch (error) {
            console.error('Permission request failed:', error);
        } finally {
            setIsRequestingPermission(false);
        }
    };

    const startRecording = async () => {
        if (!hasPermission) {
            await requestPermission();
            return;
        }

        try {
            setStatus('recording');
            setDuration(0);

            // Configure audio mode for recording
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
                shouldDuckAndroid: true,
                playThroughEarpieceAndroid: false,
                staysActiveInBackground: true,
            });

            const recording = new Audio.Recording();
            await recording.prepareToRecordAsync({ ...audioQuality, web: {} } as any);
            await recording.startAsync();
            recordingRef.current = recording;

            // Start duration counter
            durationInterval.current = setInterval(() => {
                setDuration(prev => prev + 1);
            }, 1000);

            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } catch (error) {
            console.error('Recording failed:', error);
            setStatus('idle');
            Alert.alert(
                t('common.error'),
                t('audio.recording_failed'),
                [{ text: t('common.ok') }]
            );
        }
    };

    const stopRecording = async () => {
        if (!recordingRef.current) return;

        setStatus('stopping');

        // Clear duration interval
        if (durationInterval.current) {
            clearInterval(durationInterval.current);
            durationInterval.current = null;
        }

        try {
            await recordingRef.current.stopAndUnloadAsync();
            const uri = recordingRef.current.getURI();

            if (uri) {
                setRecordedUri(uri);
                setStatus('idle');
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } else {
                throw new Error('No recording URI available');
            }
        } catch (error) {
            console.error('Stop recording failed:', error);
            setStatus('idle');
            Alert.alert(
                t('common.error'),
                t('audio.save_failed'),
                [{ text: t('common.ok') }]
            );
        }
    };

    const playRecording = async () => {
        if (!recordedUri) return;

        try {
            if (sound) {
                await sound.unloadAsync();
                setSound(null);
                setStatus('idle');
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } else {
                setStatus('playback');
                const { sound: newSound } = await Audio.Sound.createAsync(
                    { uri: recordedUri },
                    { shouldPlay: true, isLooping: false }
                );
                setSound(newSound);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

                newSound.setOnPlaybackStatusUpdate((playbackStatus) => {
                    if (playbackStatus.isLoaded && 'didJustFinish' in playbackStatus && playbackStatus.didJustFinish) {
                        setSound(null);
                        setStatus('idle');
                    }
                });
            }
        } catch (error) {
            console.error('Playback failed:', error);
            setStatus('idle');
            Alert.alert(
                t('common.error'),
                t('audio.playback_failed'),
                [{ text: t('common.ok') }]
            );
        }
    };

    const confirmRecording = useCallback(() => {
        if (recordedUri) {
            update({ audioUri: recordedUri });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            router.push('/log/manual');
        }
    }, [recordedUri, update]);

    const retakeRecording = useCallback(() => {
        setRecordedUri(null);
        setDuration(0);
        setStatus('idle');

        if (sound) {
            sound.unloadAsync();
            setSound(null);
        }

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, [sound]);

    const handleForceExit = useCallback(async () => {
        await stopRecording();
        router.back();
    }, []);

    const formatDuration = useCallback((seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }, []);

    // Permission denied state
    if (hasPermission === false) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: pal.colors.background }]}>
                <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
                <Stack.Screen options={{ headerShown: false }} />

                <View style={styles.permissionContainer}>
                    <View style={[styles.permissionIcon, { backgroundColor: pal.colors.error + '20' }]}>
                        <Feather name="mic-off" size={48} color={pal.colors.error} />
                    </View>

                    <Text style={[styles.permissionTitle, { color: pal.colors.text.primary }]}>
                        {t('audio.permission_required')}
                    </Text>

                    <Text style={[styles.permissionMessage, { color: pal.colors.text.secondary }]}>
                        {t('audio.permission_explanation')}
                    </Text>

                    <View style={styles.permissionButtons}>
                        <Pressable
                            style={[styles.permissionButton, { backgroundColor: pal.colors.border }]}
                            onPress={() => router.back()}
                        >
                            <Text style={[styles.permissionButtonText, { color: pal.colors.text.primary }]}>
                                {t('common.cancel')}
                            </Text>
                        </Pressable>

                        <Pressable
                            style={[styles.permissionButton, { backgroundColor: pal.colors.primary }]}
                            onPress={isRequestingPermission ? undefined : requestPermission}
                            disabled={isRequestingPermission}
                        >
                            {isRequestingPermission ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Text style={[styles.permissionButtonText, { color: '#fff' }]}>
                                    {t('audio.grant_permission')}
                                </Text>
                            )}
                        </Pressable>
                    </View>
                </View>
            </SafeAreaView>
        );
    }

    // Stopping state
    if (status === 'stopping') {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: pal.colors.background }]}>
                <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
                <Stack.Screen options={{ headerShown: false }} />

                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={pal.colors.primary} />
                    <Text style={[styles.statusText, { color: pal.colors.text.primary }]}>
                        {t('audio.processing')}
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: pal.colors.background }]}>
            <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            <View style={[styles.header, { backgroundColor: pal.colors.surface }]}>
                <Pressable
                    style={styles.backButton}
                    onPress={() => router.back()}
                >
                    <Feather name="arrow-left" size={24} color={pal.colors.text.primary} />
                </Pressable>

                <Text style={[styles.headerTitle, { color: pal.colors.text.primary }]}>
                    {t('audio.record_audio')}
                </Text>

                <View style={styles.headerSpacer} />
            </View>

            {/* Main Content */}
            <View style={styles.mainContent}>
                {/* Duration Display */}
                <View style={styles.durationContainer}>
                    <Text style={[styles.duration, { color: pal.colors.text.primary }]}>
                        {formatDuration(duration)}
                    </Text>

                    {status === 'recording' && (
                        <View style={styles.recordingIndicator}>
                            <View style={[styles.recordingDot, { backgroundColor: pal.colors.error }]} />
                            <Text style={[styles.recordingText, { color: pal.colors.error }]}>
                                {t('audio.recording')}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Visual Wave Effect */}
                {status === 'recording' && (
                    <View style={styles.waveContainer}>
                        {[...Array(5)].map((_, index) => (
                            <Animated.View
                                key={index}
                                style={[
                                    styles.waveBar,
                                    {
                                        backgroundColor: pal.colors.primary,
                                        height: waveAnim.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: [4, 40 + Math.random() * 30],
                                        }),
                                        opacity: waveAnim.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: [0.3, 1],
                                        }),
                                    },
                                ]}
                            />
                        ))}
                    </View>
                )}

                {/* Recording Button */}
                <View style={styles.recordButtonContainer}>
                    <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                        <Pressable
                            style={[
                                styles.recordButton,
                                {
                                    backgroundColor: status === 'recording' ? pal.colors.error : pal.colors.primary,
                                    shadowColor: status === 'recording' ? pal.colors.error : pal.colors.primary,
                                },
                            ]}
                            onPress={status === 'recording' ? stopRecording : startRecording}
                            disabled={status === 'stopping' as RecordingStatus}
                        >
                            <Feather
                                name={status === 'recording' ? 'square' : 'mic'}
                                size={40}
                                color="#fff"
                            />
                        </Pressable>
                    </Animated.View>

                    <Text style={[styles.recordButtonText, { color: pal.colors.text.secondary }]}>
                        {status === 'recording'
                            ? t('audio.tap_to_stop')
                            : t('audio.tap_to_record')
                        }
                    </Text>
                </View>
            </View>

            {/* Controls (when recording exists) */}
            {recordedUri && (
                <BlurView intensity={80} style={styles.controlsContainer}>
                    <View style={styles.controls}>
                        <Pressable
                            style={[styles.controlButton, { backgroundColor: pal.colors.surface }]}
                            onPress={playRecording}
                            disabled={status === 'stopping' as RecordingStatus}
                        >
                            <Feather
                                name={status === 'playback' && sound ? 'pause' : 'play'}
                                size={20}
                                color={pal.colors.primary}
                            />
                            <Text style={[styles.controlText, { color: pal.colors.primary }]}>
                                {status === 'playback' && sound ? t('audio.pause') : t('audio.play')}
                            </Text>
                        </Pressable>

                        <Pressable
                            style={[styles.controlButton, { backgroundColor: pal.colors.border }]}
                            onPress={retakeRecording}
                            disabled={status === 'stopping' as RecordingStatus}
                        >
                            <Feather name="refresh-cw" size={20} color={pal.colors.text.primary} />
                            <Text style={[styles.controlText, { color: pal.colors.text.primary }]}>
                                {t('audio.retake')}
                            </Text>
                        </Pressable>

                        <Pressable
                            style={[styles.controlButton, { backgroundColor: pal.colors.primary }]}
                            onPress={confirmRecording}
                            disabled={status === 'stopping' as RecordingStatus}
                        >
                            <Feather name="check" size={20} color="#fff" />
                            <Text style={[styles.controlText, { color: '#fff' }]}>
                                {t('common.confirm')}
                            </Text>
                        </Pressable>
                    </View>
                </BlurView>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    permissionContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    permissionIcon: {
        width: 96,
        height: 96,
        borderRadius: 48,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    permissionTitle: {
        fontSize: 24,
        fontWeight: '700',
        marginBottom: 12,
        textAlign: 'center',
    },
    permissionMessage: {
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 32,
        paddingHorizontal: 16,
    },
    permissionButtons: {
        flexDirection: 'row',
        gap: 16,
    },
    permissionButton: {
        flex: 1,
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: theme.borderRadius.lg,
        alignItems: 'center',
        ...theme.shadows.md,
    },
    permissionButtonText: {
        fontSize: 16,
        fontWeight: '600',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: theme.light.colors.border,
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginLeft: 16,
    },
    headerSpacer: {
        flex: 1,
    },
    mainContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    durationContainer: {
        alignItems: 'center',
        marginBottom: 40,
    },
    duration: {
        fontSize: 56,
        fontWeight: '200',
        fontVariant: ['tabular-nums'],
        letterSpacing: 2,
    },
    recordingIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        gap: 8,
    },
    recordingDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    recordingText: {
        fontSize: 14,
        fontWeight: '500',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    waveContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        height: 60,
        marginBottom: 40,
    },
    waveBar: {
        width: 4,
        borderRadius: 2,
    },
    recordButtonContainer: {
        alignItems: 'center',
        gap: 16,
    },
    recordButton: {
        width: 140,
        height: 140,
        borderRadius: 70,
        justifyContent: 'center',
        alignItems: 'center',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 8,
    },
    recordButtonText: {
        fontSize: 16,
        textAlign: 'center',
    },
    controlsContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingBottom: 40,
    },
    controls: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    controlButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: theme.borderRadius.lg,
        gap: 8,
        minWidth: 100,
        justifyContent: 'center',
        ...theme.shadows.sm,
    },
    controlText: {
        fontSize: 14,
        fontWeight: '600',
    },
    statusText: {
        fontSize: 18,
        textAlign: 'center',
    },
});