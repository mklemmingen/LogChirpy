import React, {useCallback, useEffect, useRef, useState} from 'react';
import {ActivityIndicator, Alert, BackHandler, Dimensions, Linking, StatusBar, View, Pressable} from 'react-native';
import {Audio} from 'expo-av';
import {router, Stack, useFocusEffect} from 'expo-router';
import {useTranslation} from 'react-i18next';
import {ThemedIcon} from '@/components/ThemedIcon';
import * as Haptics from 'expo-haptics';
import SafeBlurView from '@/components/ui/SafeBlurView';

import {useLogDraft} from '../context/LogDraftContext';
import {ModernCard} from '@/components/ModernCard';
import {ThemedView} from '@/components/ThemedView';
import {ThemedText} from '@/components/ThemedText';
import {ThemedPressable} from '@/components/ThemedPressable';
import {ThemedSafeAreaView} from '@/components/ThemedSafeAreaView';
import {useTheme} from '@/hooks/useThemeColor';

type RecordingStatus = 'idle' | 'recording' | 'stopping' | 'playback';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Android Audio Quality Configuration
const AUDIO_QUALITY = {
    extension: '.m4a',
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 44100,
    numberOfChannels: 2,
    bitRate: 128000,
};

function WaveVisualizer({ isRecording }: { isRecording: boolean }) {
    const theme = useTheme();

    return (
        <ThemedView style={{ 
            flexDirection: 'row', 
            alignItems: 'center', 
            justifyContent: 'center',
            gap: 4, 
            height: 60,
            paddingVertical: 16 
        }}>
            {[...Array(7)].map((_, index) => {

                return (
                    <View
                        key={index}
                        style={[
                            {
                                width: 4,
                                backgroundColor: theme.colors.text.primary,
                                borderRadius: 2,
                                minHeight: 4,
                                height: isRecording ? 20 + Math.sin(index * 0.4) * 10 : 4,
                                opacity: isRecording ? 1 : 0.3,
                            },
                        ]}
                    />
                );
            })}
        </ThemedView>
    );
}

// Recording Button Component
function RecordingButton({
    status,
    onPress,
    duration,
}: {
    status: RecordingStatus;
    onPress: () => void;
    duration: number;
}) {
    const theme = useTheme();
    const { t } = useTranslation();

    const isRecording = status === 'recording';
    const buttonColor = isRecording ? theme.colors.status.error : theme.colors.background.secondary;

    return (
        <ThemedView style={{ alignItems: 'center', gap: 20 }}>
            <ThemedView style={{ position: 'relative', alignItems: 'center' }}>
                {/* Glow Effect */}
                {isRecording && (
                    <View
                        style={[
                            {
                                position: 'absolute',
                                width: 160,
                                height: 160,
                                borderRadius: 80,
                                backgroundColor: theme.colors.status.error,
                                opacity: 0.3,
                            },
                        ]}
                    />
                )}

                {/* Main Button */}
                <ThemedPressable
                    variant="ghost"
                    style={[
                        {
                            width: 140,
                            height: 140,
                            borderRadius: 70,
                            backgroundColor: buttonColor,
                            borderWidth: isRecording ? 4 : 2,
                            borderColor: isRecording ? theme.colors.status.error : theme.colors.border.primary,
                            justifyContent: 'center',
                            alignItems: 'center',
                            ...theme.shadows.lg,
                            transform: [{ scale: isRecording ? 1.02 : 1 }],
                        },
                    ]}
                    onPress={onPress}
                    disabled={status === 'stopping'}
                >
                    <ThemedIcon
                        name={isRecording ? 'square' : 'mic'}
                        size={48}
                        color={isRecording ? 'error' : 'primary'}
                    />
                </ThemedPressable>
            </ThemedView>

            {/* Status Text */}
            <ThemedView style={{ alignItems: 'center', gap: 8 }}>
                <ThemedText
                    variant="body"
                    color="secondary"
                    style={{ textAlign: 'center' }}
                >
                    {isRecording ? t('audio.tap_to_stop') : t('audio.tap_to_start')}
                </ThemedText>

                {/* Duration Display */}
                {(isRecording || duration > 0) && (
                    <ThemedView
                        style={{ 
                            paddingHorizontal: 16, 
                            paddingVertical: 6,
                            backgroundColor: theme.colors.background.secondary,
                            borderRadius: theme.borderRadius.md,
                        }}
                    >
                        <ThemedText variant="h3" color="primary">
                            {formatDuration(duration)}
                        </ThemedText>
                    </ThemedView>
                )}
            </ThemedView>
        </ThemedView>
    );
}

// Permission Error Component
function PermissionError({
    onRetry,
    onSettings,
    isRequesting,
}: {
    onRetry: () => void;
    onSettings: () => void;
    isRequesting: boolean;
}) {
    const { t } = useTranslation();
    const theme = useTheme();

    return (
        <ThemedSafeAreaView style={{ flex: 1 }}>
            <ThemedView style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
                <ModernCard elevated={true} bordered={false} style={{ alignItems: 'center', padding: 32 }}>
                    <ThemedView
                        style={{
                            width: 80,
                            height: 80,
                            borderRadius: 40,
                            backgroundColor: theme.colors.background.secondary,
                            justifyContent: 'center',
                            alignItems: 'center',
                            marginBottom: 24,
                        }}
                    >
                        <ThemedIcon name="mic-off" size={32} color="error" />
                    </ThemedView>

                    <ThemedText variant="h2" style={{ textAlign: 'center', marginBottom: 12 }}>
                        {t('audio.permission_required', 'Microphone Permission Required')}
                    </ThemedText>

                    <ThemedText
                        variant="body"
                        color="secondary"
                        style={{ textAlign: 'center', marginBottom: 32, lineHeight: 24 }}
                    >
                        {t('audio.permission_explanation', 'LogChirpy needs access to your microphone to record bird sounds for identification.')}
                    </ThemedText>

                    <ThemedView style={{ flexDirection: 'row', gap: 16, width: '100%' }}>
                        <ThemedPressable
                            variant="secondary"
                            style={{ flex: 1 }}
                            onPress={() => router.back()}
                        >
                            <ThemedText>{t('common.cancel', 'Cancel')}</ThemedText>
                        </ThemedPressable>

                        <ThemedPressable
                            variant="primary"
                            style={{ flex: 1 }}
                            onPress={onRetry}
                            disabled={isRequesting}
                        >
                            {isRequesting ? (
                                <ActivityIndicator size="small" color={theme.colors.text.inverse} />
                            ) : (
                                <ThemedText color="primary">{t('audio.grant_permission', 'Grant Permission')}</ThemedText>
                            )}
                        </ThemedPressable>
                    </ThemedView>

                    <ThemedPressable
                        variant="ghost"
                        onPress={onSettings}
                        style={{ marginTop: 16 }}
                    >
                        <ThemedText color="accent">{t('common.settings', 'Open Settings')}</ThemedText>
                    </ThemedPressable>
                </ModernCard>
            </ThemedView>
        </ThemedSafeAreaView>
    );
}

// Playback Controls Component
function PlaybackControls({
    isPlaying,
    onPlay,
    onRetake,
    onConfirm,
}: {
    isPlaying: boolean;
    onPlay: () => void;
    onRetake: () => void;
    onConfirm: () => void;
}) {
    const { t } = useTranslation();
    const theme = useTheme();

    return (
        <SafeBlurView
            intensity={80}
            tint={theme.colors.background.primary === '#FFFFFF' ? 'light' : 'dark'}
            style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                paddingBottom: 40,
                paddingTop: 20,
                paddingHorizontal: 24,
            }}
        >
            <ThemedView style={{ flexDirection: 'row', gap: 16 }}>
                <ThemedPressable
                    variant="secondary"
                    style={{ flex: 1, flexDirection: 'row', gap: 8, justifyContent: 'center' }}
                    onPress={onPlay}
                >
                    <ThemedIcon name={isPlaying ? 'pause' : 'play'} size={20} color="primary" />
                    <ThemedText>{isPlaying ? t('audio.pause', 'Pause') : t('audio.play', 'Play')}</ThemedText>
                </ThemedPressable>

                <ThemedPressable
                    variant="secondary"
                    style={{ paddingHorizontal: 20 }}
                    onPress={onRetake}
                >
                    <ThemedIcon name="refresh-cw" size={20} color="primary" />
                </ThemedPressable>

                <ThemedPressable
                    variant="primary"
                    style={{ flex: 1, flexDirection: 'row', gap: 8, justifyContent: 'center' }}
                    onPress={onConfirm}
                >
                    <ThemedIcon name="check" size={20} color="primary" />
                    <ThemedText color="primary">{t('common.confirm', 'Confirm')}</ThemedText>
                </ThemedPressable>
            </ThemedView>
        </SafeBlurView>
    );
}

// Helper function
const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export default function AudioScreen() {
    const { t } = useTranslation();
    const { update } = useLogDraft();
    const theme = useTheme();

    // State management
    const [status, setStatus] = useState<RecordingStatus>('idle');
    const [duration, setDuration] = useState(0);
    const [recordedUri, setRecordedUri] = useState<string | null>(null);
    const [sound, setSound] = useState<Audio.Sound | null>(null);
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const [isRequestingPermission, setIsRequestingPermission] = useState(false);

    // Refs
    const recordingRef = useRef<Audio.Recording | null>(null);
    const durationInterval = useRef<ReturnType<typeof setInterval> | null>(null);

    // Initialize permissions
    useEffect(() => {
        checkPermissions();
        return cleanup;
    }, []);

    // Handle back button during recording
    useFocusEffect(
        useCallback(() => {
            const onBackPress = () => {
                if (status === 'recording') {
                    Alert.alert(
                        t('audio.stop_recording_title', 'Stop Recording?'),
                        t('audio.stop_recording_message', 'Are you sure you want to stop the current recording?'),
                        [
                            { text: t('common.continue', 'Continue'), style: 'cancel' },
                            {
                                text: t('audio.stop_and_exit', 'Stop & Exit'),
                                style: 'destructive',
                                onPress: handleForceExit
                            },
                        ]
                    );
                    return true;
                }
                return false;
            };

            const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
            return () => subscription.remove();
        }, [status, t])
    );

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
                    t('audio.permission_denied', 'Permission Denied'),
                    t('audio.permission_denied_message', 'Please enable microphone access in Settings to record audio.'),
                    [
                        { text: t('common.cancel', 'Cancel') },
                        { text: t('common.settings', 'Settings'), onPress: openAppSettings },
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

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true, // Kept for compatibility
                playsInSilentModeIOS: true, // Kept for compatibility
                shouldDuckAndroid: true,
                playThroughEarpieceAndroid: false,
                staysActiveInBackground: true,
            });

            const recording = new Audio.Recording();
            await recording.prepareToRecordAsync(AUDIO_QUALITY as any);
            await recording.startAsync();
            recordingRef.current = recording;

            durationInterval.current = setInterval(() => {
                setDuration(prev => prev + 1);
            }, 1000);

            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } catch (error) {
            console.error('Recording failed:', error);
            setStatus('idle');
            Alert.alert(
                t('common.error', 'Error'), 
                t('audio.recording_failed', 'Failed to start recording. Please try again.')
            );
        }
    };

    const stopRecording = async () => {
        if (!recordingRef.current) return;

        setStatus('stopping');

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
                t('common.error', 'Error'), 
                t('audio.save_failed', 'Failed to save recording. Please try again.')
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
                t('common.error', 'Error'), 
                t('audio.playback_failed', 'Failed to play recording. Please try again.')
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

    const handleRecordingToggle = () => {
        if (status === 'recording') {
            stopRecording();
        } else {
            startRecording();
        }
    };

    // Permission denied state
    if (hasPermission === false) {
        return (
            <>
                <StatusBar barStyle="dark-content" />
                <Stack.Screen options={{ headerShown: false }} />
                <PermissionError
                    onRetry={requestPermission}
                    onSettings={openAppSettings}
                    isRequesting={isRequestingPermission}
                />
            </>
        );
    }

    // Processing state
    if (status === 'stopping') {
        return (
            <ThemedSafeAreaView style={{ flex: 1 }}>
                <StatusBar barStyle="dark-content" />
                <Stack.Screen options={{ headerShown: false }} />

                <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ThemedView style={{ alignItems: 'center', gap: 24 }}>
                        <ActivityIndicator size="large" color={theme.colors.text.primary} />
                        <ThemedText variant="h3" color="secondary">
                            {t('audio.processing', 'Processing recording...')}
                        </ThemedText>
                    </ThemedView>
                </ThemedView>
            </ThemedSafeAreaView>
        );
    }

    return (
        <ThemedSafeAreaView style={{ flex: 1 }}>
            <StatusBar barStyle="dark-content" />
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            <ThemedView
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: theme.colors.border.primary
                }}
            >
                <ThemedPressable
                    variant="ghost"
                    style={{ padding: 8 }}
                    onPress={() => router.back()}
                >
                    <ThemedIcon name="arrow-left" size={24} color="primary" />
                </ThemedPressable>

                <ThemedText variant="h3" style={{ marginLeft: 16 }}>
                    {t('audio.record_audio', 'Record Audio')}
                </ThemedText>
            </ThemedView>

            {/* Main Content */}
            <ThemedView style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
                <ModernCard
                    elevated={true}
                    bordered={false}
                    style={{
                        alignItems: 'center',
                        padding: 40,
                        maxWidth: SCREEN_WIDTH - 48,
                        alignSelf: 'center',
                    }}
                >
                    {/* Recording Status Indicator */}
                    {status === 'recording' && (
                        <ThemedView style={{ alignItems: 'center', marginBottom: 32 }}>
                            <ThemedView
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 8,
                                    paddingHorizontal: 16,
                                    paddingVertical: 8,
                                    backgroundColor: theme.colors.status.error + '20',
                                    borderRadius: theme.borderRadius.sm,
                                }}
                            >
                                <ThemedView
                                    style={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: 4,
                                        backgroundColor: theme.colors.status.error,
                                    }}
                                />
                                <ThemedText variant="label" color="error">
                                    {t('audio.recording', 'RECORDING').toUpperCase()}
                                </ThemedText>
                            </ThemedView>
                        </ThemedView>
                    )}

                    {/* Wave Visualization */}
                    <ThemedView style={{ marginBottom: 32 }}>
                        <WaveVisualizer isRecording={status === 'recording'} />
                    </ThemedView>

                    {/* Recording Button */}
                    <RecordingButton
                        status={status}
                        onPress={handleRecordingToggle}
                        duration={duration}
                    />

                    {/* Instructions */}
                    {status === 'idle' && !recordedUri && (
                        <ThemedView style={{ marginTop: 32, alignItems: 'center' }}>
                            <ThemedText
                                variant="body"
                                color="secondary"
                                style={{ textAlign: 'center', lineHeight: 24 }}
                            >
                                {t('audio.instructions', 'Record bird sounds for identification and logging. Keep the device steady and minimize background noise.')}
                            </ThemedText>
                        </ThemedView>
                    )}
                </ModernCard>
            </ThemedView>

            {/* Playback Controls */}
            {recordedUri && (
                <PlaybackControls
                    isPlaying={status === 'playback' && !!sound}
                    onPlay={playRecording}
                    onRetake={retakeRecording}
                    onConfirm={confirmRecording}
                />
            )}
        </ThemedSafeAreaView>
    );
}