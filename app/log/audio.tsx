import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {ActivityIndicator, Alert, BackHandler, Dimensions, Linking, StatusBar,} from 'react-native';
import {Audio} from 'expo-av';
import {router, Stack, useFocusEffect} from 'expo-router';
import {useTranslation} from 'react-i18next';
import {ThemedIcon} from '@/components/ThemedIcon';
import * as Haptics from 'expo-haptics';
import {BlurView} from 'expo-blur';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSpring,
    withTiming,
} from 'react-native-reanimated';

import {useLogDraft} from '@/contexts/LogDraftContext';
import {ModernCard} from '@/components/ModernCard';
import {ThemedView} from '@/components/ThemedView';
import {ThemedText} from '@/components/ThemedText';
import {ThemedPressable} from '@/components/ThemedPressable';
import {ThemedSafeAreaView} from '@/components/ThemedSafeAreaView';
import {useTheme} from '@/hooks/useThemeColor';
import {BackButton} from '@/components/BackButton';

type RecordingStatus = 'idle' | 'recording' | 'stopping' | 'playback';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const AnimatedPressable = Animated.createAnimatedComponent(ThemedPressable);

// Enhanced Audio Quality Configuration
const AUDIO_QUALITY = {
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
        outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
        audioQuality: Audio.IOSAudioQuality.HIGH,
        sampleRate: 44100,
        numberOfChannels: 2,
        bitRate: 128000,
        linearPCMBitDepth: 16,
        linearPCMIsBigEndian: false,
        linearPCMIsFloat: false,
    },
    web: {
        extension: '.m4a',
        mimeType: 'audio/mp4',
        bitsPerSecond: 128000,
    },
};

// BirdNET-style Static Spectrogram Visualization
function BirdNetSpectrogram({ 
    isRecording, 
    duration = 0
}: { 
    isRecording: boolean;
    duration?: number;
}) {
    const theme = useTheme();

    // Calculate optimal recording zone (3-6 seconds)
    const isInOptimalZone = duration >= 3 && duration <= 6;
    const isMinimumReached = duration >= 3;

    // Simple static visualization bars that build up over time
    const spectrogramBars = useMemo(() => {
        const maxBars = 60; // Maximum bars to show (representing ~60 seconds)
        const currentBars = Math.min(duration, maxBars);
        
        return Array.from({ length: currentBars }, (_, index) => {
            // Create frequency bands (5 bands representing different frequency ranges)
            const bands = Array.from({ length: 5 }, (_, bandIndex) => {
                // Simulate frequency intensity based on time and band
                const baseIntensity = 0.2 + Math.sin((index + bandIndex) * 0.3) * 0.3;
                const randomVariation = Math.random() * 0.3;
                return Math.max(0.1, Math.min(0.9, baseIntensity + randomVariation));
            });
            return bands;
        });
    }, [duration]);

    return (
        <ThemedView style={{ alignItems: 'center', gap: 16 }}>
            {/* BirdNET-style Spectrogram Display */}
            <ThemedView style={{ 
                width: '100%',
                height: 100,
                backgroundColor: theme.colors.background.secondary,
                borderRadius: theme.borderRadius.md,
                padding: 8,
                justifyContent: 'center',
                alignItems: 'center'
            }}>
                {isRecording ? (
                    <ThemedView style={{ 
                        flexDirection: 'row', 
                        alignItems: 'flex-end',
                        height: 80,
                        gap: 1,
                        overflow: 'hidden'
                    }}>
                        {spectrogramBars.map((bands: number[], timeIndex: number) => (
                            <ThemedView key={timeIndex} style={{ 
                                flexDirection: 'column',
                                justifyContent: 'flex-end',
                                height: 80,
                                width: 2,
                                gap: 1
                            }}>
                                {bands.map((intensity: number, bandIndex: number) => (
                                    <ThemedView
                                        key={bandIndex}
                                        style={{
                                            height: Math.max(2, intensity * 15),
                                            backgroundColor: intensity > 0.6 
                                                ? theme.colors.text.primary 
                                                : intensity > 0.3 
                                                    ? theme.colors.text.secondary 
                                                    : theme.colors.text.tertiary,
                                            width: 2,
                                            opacity: 0.8
                                        }}
                                    />
                                ))}
                            </ThemedView>
                        ))}
                        
                        {/* Current recording indicator line */}
                        <ThemedView style={{
                            width: 2,
                            height: 80,
                            backgroundColor: theme.colors.text.primary,
                            opacity: 0.5
                        }} />
                    </ThemedView>
                ) : (
                    <ThemedView style={{ alignItems: 'center', gap: 8 }}>
                        <ThemedIcon name="mic" size={32} color="tertiary" />
                        <ThemedText variant="caption" color="tertiary">
                            Audio visualization will appear here
                        </ThemedText>
                    </ThemedView>
                )}
            </ThemedView>

            {/* Simplified Recording Status */}
            {isRecording && (
                <ThemedView style={{ alignItems: 'center', gap: 8 }}>
                    {/* Duration Status */}
                    <ThemedView style={{ 
                        flexDirection: 'row', 
                        alignItems: 'center', 
                        gap: 8,
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        backgroundColor: isInOptimalZone 
                            ? theme.colors.status.success + '20' 
                            : isMinimumReached 
                                ? theme.colors.status.warning + '20'
                                : theme.colors.status.error + '20',
                        borderRadius: theme.borderRadius.sm,
                    }}>
                        <ThemedIcon 
                            name={isInOptimalZone ? "check-circle" : isMinimumReached ? "clock" : "alert-circle"} 
                            size={14} 
                            color={isInOptimalZone ? "primary" : isMinimumReached ? "secondary" : "error"} 
                        />
                        <ThemedText variant="caption" 
                            color={isInOptimalZone ? "primary" : isMinimumReached ? "secondary" : "error"}
                        >
                            {duration < 3 ? "Keep recording..." : isInOptimalZone ? "Optimal for AI" : "Good length"}
                        </ThemedText>
                    </ThemedView>
                </ThemedView>
            )}
        </ThemedView>
    );
}


// Enhanced Recording Button with Progress Ring
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

    const scale = useSharedValue(1);
    const glowOpacity = useSharedValue(0);
    const progressRotation = useSharedValue(0);

    useEffect(() => {
        if (status === 'recording') {
            scale.value = withRepeat(
                withTiming(1.03, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
                -1,
                true
            );
            glowOpacity.value = withRepeat(
                withTiming(0.4, { duration: 1800 }),
                -1,
                true
            );
        } else {
            scale.value = withSpring(1, { damping: 15, stiffness: 300 });
            glowOpacity.value = withTiming(0, { duration: 300 });
        }
    }, [status]);

    // Progress ring animation - optimized for performance
    useEffect(() => {
        const maxDuration = 60; // 60 seconds max recommended
        const progress = Math.min(duration / maxDuration, 1);
        progressRotation.value = withTiming(progress * 360, { duration: 300 });
    }, [duration]);

    const buttonStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const glowStyle = useAnimatedStyle(() => ({
        opacity: glowOpacity.value,
        transform: [{ scale: scale.value * 1.15 }],
    }));

    const progressStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${progressRotation.value}deg` }],
    }));

    const isRecording = status === 'recording';
    const isInOptimalZone = duration >= 3 && duration <= 6;
    const buttonColor = isRecording ? theme.colors.status.error : theme.colors.background.secondary;
    
    // Progress ring color based on duration
    const progressColor = duration < 3 
        ? theme.colors.status.error 
        : isInOptimalZone 
            ? theme.colors.status.success 
            : theme.colors.status.warning;

    return (
        <ThemedView style={{ alignItems: 'center', gap: 24 }}>
            <ThemedView style={{ position: 'relative', alignItems: 'center' }}>
                {/* Outer Progress Ring */}
                {isRecording && (
                    <ThemedView
                        style={{
                            position: 'absolute',
                            width: 170,
                            height: 170,
                            borderRadius: 85,
                            borderWidth: 4,
                            borderColor: theme.colors.border.secondary + '40',
                        }}
                    />
                )}
                
                {/* Animated Progress Ring */}
                {isRecording && duration > 0 && (
                    <Animated.View
                        style={[
                            {
                                position: 'absolute',
                                width: 170,
                                height: 170,
                                borderRadius: 85,
                                borderWidth: 4,
                                borderTopColor: progressColor,
                                borderRightColor: 'transparent',
                                borderBottomColor: 'transparent',
                                borderLeftColor: 'transparent',
                            },
                            progressStyle,
                        ]}
                    />
                )}

                {/* Glow Effect */}
                {isRecording && (
                    <Animated.View
                        style={[
                            {
                                position: 'absolute',
                                width: 180,
                                height: 180,
                                borderRadius: 90,
                                backgroundColor: progressColor + '20',
                            },
                            glowStyle,
                        ]}
                    />
                )}

                {/* Main Button */}
                <AnimatedPressable
                    variant="ghost"
                    style={[
                        {
                            width: 140,
                            height: 140,
                            borderRadius: 70,
                            backgroundColor: buttonColor,
                            borderWidth: isRecording ? 3 : 2,
                            borderColor: isRecording ? progressColor : theme.colors.border.primary,
                            justifyContent: 'center',
                            alignItems: 'center',
                            ...theme.shadows.lg,
                        },
                        buttonStyle,
                    ]}
                    onPress={onPress}
                    disabled={status === 'stopping'}
                >
                    <ThemedIcon
                        name={isRecording ? 'square' : 'mic'}
                        size={isRecording ? 44 : 48}
                        color={isRecording ? 'error' : 'primary'}
                    />
                </AnimatedPressable>
            </ThemedView>

            {/* Enhanced Status Display */}
            <ThemedView style={{ alignItems: 'center', gap: 12 }}>
                <ThemedText
                    variant="body"
                    color="secondary"
                    style={{ textAlign: 'center', fontWeight: '500' }}
                >
                    {isRecording ? t('audio.tap_to_stop', 'Tap to stop recording') : t('audio.tap_to_start', 'Tap to start recording')}
                </ThemedText>

                {/* Duration Display with Status */}
                {(isRecording || duration > 0) && (
                    <ThemedView style={{ alignItems: 'center', gap: 8 }}>
                        <ThemedView
                            style={{ 
                                paddingHorizontal: 20, 
                                paddingVertical: 8,
                                backgroundColor: theme.colors.background.secondary,
                                borderRadius: theme.borderRadius.lg,
                                borderWidth: 1,
                                borderColor: isRecording ? progressColor + '40' : theme.colors.border.secondary,
                            }}
                        >
                            <ThemedText variant="h2" color="primary" style={{ fontWeight: '600', fontVariant: ['tabular-nums'] }}>
                                {formatDuration(duration)}
                            </ThemedText>
                        </ThemedView>
                        
                        {/* Recording Tips */}
                        {isRecording && (
                            <ThemedText variant="caption" color="tertiary" style={{ textAlign: 'center', maxWidth: 200 }}>
                                {duration < 3 
                                    ? "Keep recording for better AI accuracy" 
                                    : isInOptimalZone 
                                        ? "Perfect length for identification!" 
                                        : "Good recording length"}
                            </ThemedText>
                        )}
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
                                <ThemedText color="inverse">{t('audio.grant_permission', 'Grant Permission')}</ThemedText>
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
        <BlurView
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
                    <ThemedIcon name="check" size={20} color="inverse" />
                    <ThemedText color="inverse">{t('common.confirm', 'Confirm')}</ThemedText>
                </ThemedPressable>
            </ThemedView>
        </BlurView>
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
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
                shouldDuckAndroid: true,
                playThroughEarpieceAndroid: false,
                staysActiveInBackground: true,
            });

            const recording = new Audio.Recording();
            await recording.prepareToRecordAsync(AUDIO_QUALITY as any);
            await recording.startAsync();
            recordingRef.current = recording;

            // Simple duration tracking only
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

        // Status is already set to 'stopping' in handleRecordingToggle

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
    }, [stopRecording]);

    const handleRecordingToggle = useCallback(() => {
        if (status === 'recording') {
            // Immediately set status to stopping to prevent multiple taps
            setStatus('stopping');
            stopRecording();
        } else if (status === 'idle') {
            startRecording();
        }
        // Ignore taps while already stopping or starting
    }, [status]);

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
                    paddingHorizontal: 8,
                    paddingVertical: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: theme.colors.border.primary
                }}
            >
                <BackButton variant="inline" />

                <ThemedText variant="h3" style={{ marginLeft: 8 }}>
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

                    {/* BirdNET-style Spectrogram */}
                    <ThemedView style={{ marginBottom: 32, width: '100%' }}>
                        <BirdNetSpectrogram 
                            isRecording={status === 'recording'}
                            duration={duration}
                        />
                    </ThemedView>

                    {/* Recording Button */}
                    <RecordingButton
                        status={status}
                        onPress={handleRecordingToggle}
                        duration={duration}
                    />

                    {/* Smart Recording Instructions */}
                    {status === 'idle' && !recordedUri && (
                        <ThemedView style={{ marginTop: 32, alignItems: 'center', gap: 16 }}>
                            <ThemedText
                                variant="body"
                                color="secondary"
                                style={{ textAlign: 'center', lineHeight: 24, maxWidth: 300 }}
                            >
                                {t('audio.instructions', 'Record bird sounds for AI identification. For best results, record 3-6 seconds of clear bird calls.')}
                            </ThemedText>
                            
                            {/* Recording Tips */}
                            <ThemedView style={{ alignItems: 'center', gap: 8 }}>
                                <ThemedView style={{ 
                                    flexDirection: 'row', 
                                    alignItems: 'center', 
                                    gap: 8,
                                    paddingHorizontal: 12,
                                    paddingVertical: 6,
                                    backgroundColor: theme.colors.background.secondary,
                                    borderRadius: theme.borderRadius.sm,
                                }}>
                                    <ThemedIcon name="info" size={14} color="accent" />
                                    <ThemedText variant="caption" color="secondary">
                                        Hold device steady, minimize wind noise
                                    </ThemedText>
                                </ThemedView>
                                
                                <ThemedView style={{ 
                                    flexDirection: 'row', 
                                    alignItems: 'center', 
                                    gap: 8,
                                    paddingHorizontal: 12,
                                    paddingVertical: 6,
                                    backgroundColor: theme.colors.status.success + '20',
                                    borderRadius: theme.borderRadius.sm,
                                }}>
                                    <ThemedIcon name="check-circle" size={14} color="primary" />
                                    <ThemedText variant="caption" color="primary">
                                        3-6 seconds optimal for AI identification
                                    </ThemedText>
                                </ThemedView>
                            </ThemedView>
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