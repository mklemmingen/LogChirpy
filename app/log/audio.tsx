import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { Audio } from 'expo-av';
import { router, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system';

import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedPressable } from '@/components/ThemedPressable';
import { ThemedIcon } from '@/components/ThemedIcon';
import { ThemedSafeAreaView } from '@/components/ThemedSafeAreaView';
import { BackButton } from '@/components/BackButton';

import { useLogDraft } from '@/contexts/LogDraftContext';

import { useColors } from '@/hooks/useThemeColor';

type RecordingState = 'idle' | 'recording' | 'recorded';
type PlaybackState = 'idle' | 'playing' | 'paused';

const AUDIO_SETTINGS = {
    android: {
        extension: '.m4a',
        outputFormat: Audio.AndroidOutputFormat.MPEG_4,
        audioEncoder: Audio.AndroidAudioEncoder.AAC,
        sampleRate: 48000,
        numberOfChannels: 1,
        bitRate: 128000,
    },
    ios: {
        extension: '.m4a',
        outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
        audioQuality: Audio.IOSAudioQuality.HIGH,
        sampleRate: 48000,
        numberOfChannels: 1,
        bitRate: 128000,
    },
};

export default function AudioScreen() {
    const { t } = useTranslation();
    const { update } = useLogDraft();
    const colors = useColors();

    // State
    const [state, setState] = useState<RecordingState>('idle');
    const [playbackState, setPlaybackState] = useState<PlaybackState>('idle');
    const [duration, setDuration] = useState(0);
    const [playbackPosition, setPlaybackPosition] = useState(0);
    const [playbackDuration, setPlaybackDuration] = useState(0);
    const [recordedUri, setRecordedUri] = useState<string | null>(null);
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);

    // Refs
    const recordingRef = useRef<Audio.Recording | null>(null);
    const soundRef = useRef<Audio.Sound | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const playbackTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
            if (playbackTimerRef.current) {
                clearInterval(playbackTimerRef.current);
            }
            if (recordingRef.current) {
                recordingRef.current.stopAndUnloadAsync().catch(() => {});
            }
            if (soundRef.current) {
                soundRef.current.unloadAsync().catch(() => {});
            }
        };
    }, []);

    // Check permissions on mount
    useEffect(() => {
        checkPermissions();
    }, []);

    const checkPermissions = async () => {
        try {
            const { status } = await Audio.getPermissionsAsync();
            if (status === 'granted') {
                setHasPermission(true);
            } else {
                const { status: newStatus } = await Audio.requestPermissionsAsync();
                setHasPermission(newStatus === 'granted');
            }
        } catch (error) {
            console.error('Permission error:', error);
            setHasPermission(false);
        }
    };

    const startRecording = async () => {
        if (!hasPermission) {
            Alert.alert('Permission Required', 'Microphone access is needed to record audio.');
            return;
        }

        try {
            setState('recording');
            setDuration(0);

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
                shouldDuckAndroid: true,
                playThroughEarpieceAndroid: false,
                staysActiveInBackground: false,
            });

            const recording = new Audio.Recording();
            await recording.prepareToRecordAsync(AUDIO_SETTINGS as any);
            await recording.startAsync();
            recordingRef.current = recording;

            // Start timer
            timerRef.current = setInterval(() => {
                setDuration(prev => prev + 1);
            }, 1000);

            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } catch (error) {
            console.error('Recording failed:', error);
            setState('idle');
            Alert.alert('Error', 'Failed to start recording.');
        }
    };

    const stopRecording = async () => {
        if (!recordingRef.current) return;

        // Clear timer
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        try {
            await recordingRef.current.stopAndUnloadAsync();
            const uri = recordingRef.current.getURI();
            recordingRef.current = null;

            if (uri) {
                // Save to app documents directory
                const timestamp = Date.now();
                const fileName = `audio_${timestamp}.m4a`;
                const documentsDir = FileSystem.documentDirectory;
                const newUri = `${documentsDir}${fileName}`;
                
                await FileSystem.copyAsync({
                    from: uri,
                    to: newUri
                });

                setRecordedUri(newUri);
                setState('recorded');
                
                // Get audio duration for playback
                try {
                    const { sound } = await Audio.Sound.createAsync({ uri: newUri });
                    const status = await sound.getStatusAsync();
                    if (status.isLoaded && status.durationMillis) {
                        setPlaybackDuration(Math.floor(status.durationMillis / 1000));
                    }
                    await sound.unloadAsync();
                } catch (error) {
                    console.warn('Failed to get audio duration:', error);
                }
                
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
        } catch (error) {
            console.error('Stop recording failed:', error);
            setState('idle');
            Alert.alert('Error', 'Failed to save recording.');
        }
    };

    const handleRecord = () => {
        if (state === 'recording') {
            stopRecording();
        } else if (state === 'idle') {
            startRecording();
        }
    };

    const handleRetake = async () => {
        // Stop playback if active
        await stopPlayback();
        setRecordedUri(null);
        setDuration(0);
        setPlaybackPosition(0);
        setPlaybackDuration(0);
        setState('idle');
    };

    const startPlayback = async () => {
        if (!recordedUri) return;

        try {
            // Stop any existing playback
            if (soundRef.current) {
                await soundRef.current.unloadAsync();
            }

            // Set audio mode for playback
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
                playsInSilentModeIOS: true,
                shouldDuckAndroid: true,
                playThroughEarpieceAndroid: false,
                staysActiveInBackground: false,
            });

            // Load and play the audio
            const { sound } = await Audio.Sound.createAsync(
                { uri: recordedUri },
                { shouldPlay: true, isLooping: true }
            );
            soundRef.current = sound;

            // Get duration
            const status = await sound.getStatusAsync();
            if (status.isLoaded && status.durationMillis) {
                setPlaybackDuration(Math.floor(status.durationMillis / 1000));
            }

            setPlaybackState('playing');
            setPlaybackPosition(0);

            // Set up playback position tracking
            playbackTimerRef.current = setInterval(async () => {
                if (soundRef.current) {
                    const status = await soundRef.current.getStatusAsync();
                    if (status.isLoaded) {
                        if (status.positionMillis !== undefined && status.durationMillis !== undefined) {
                            const currentPosition = Math.floor(status.positionMillis / 1000);
                            const duration = Math.floor(status.durationMillis / 1000);
                            
                            // Handle looping - reset position when it reaches the end
                            if (currentPosition >= duration) {
                                setPlaybackPosition(0);
                            } else {
                                setPlaybackPosition(currentPosition);
                            }
                        }
                        // Note: With looping enabled, didJustFinish won't trigger
                        // The audio will continue playing automatically
                    }
                }
            }, 100);

            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch (error) {
            console.error('Playback failed:', error);
            setPlaybackState('idle');
            Alert.alert('Error', 'Failed to play audio.');
        }
    };

    const pausePlayback = async () => {
        if (soundRef.current) {
            try {
                await soundRef.current.pauseAsync();
                setPlaybackState('paused');
                if (playbackTimerRef.current) {
                    clearInterval(playbackTimerRef.current);
                    playbackTimerRef.current = null;
                }
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } catch (error) {
                console.error('Pause failed:', error);
            }
        }
    };

    const resumePlayback = async () => {
        if (soundRef.current) {
            try {
                await soundRef.current.playAsync();
                setPlaybackState('playing');
                
                // Resume position tracking
                playbackTimerRef.current = setInterval(async () => {
                    if (soundRef.current) {
                        const status = await soundRef.current.getStatusAsync();
                        if (status.isLoaded) {
                            if (status.positionMillis !== undefined && status.durationMillis !== undefined) {
                                const currentPosition = Math.floor(status.positionMillis / 1000);
                                const duration = Math.floor(status.durationMillis / 1000);
                                
                                // Handle looping - reset position when it reaches the end
                                if (currentPosition >= duration) {
                                    setPlaybackPosition(0);
                                } else {
                                    setPlaybackPosition(currentPosition);
                                }
                            }
                            // Note: With looping enabled, didJustFinish won't trigger
                            // The audio will continue playing automatically
                        }
                    }
                }, 100);

                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } catch (error) {
                console.error('Resume failed:', error);
            }
        }
    };

    const stopPlayback = async () => {
        if (soundRef.current) {
            try {
                await soundRef.current.stopAsync();
                await soundRef.current.unloadAsync();
                soundRef.current = null;
            } catch (error) {
                console.error('Stop playback failed:', error);
            }
        }
        
        setPlaybackState('idle');
        setPlaybackPosition(0);
        
        if (playbackTimerRef.current) {
            clearInterval(playbackTimerRef.current);
            playbackTimerRef.current = null;
        }
    };

    const handlePlayPause = () => {
        if (playbackState === 'idle') {
            startPlayback();
        } else if (playbackState === 'playing') {
            pausePlayback();
        } else if (playbackState === 'paused') {
            resumePlayback();
        }
    };

    const handleSave = () => {
        if (recordedUri) {
            update({ audioUri: recordedUri });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            router.back();
        }
    };

    const formatTime = (seconds: number): string => {
        return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
    };

    // Permission loading
    if (hasPermission === null) {
        return (
            <ThemedSafeAreaView style={styles.container}>
                <ActivityIndicator size="large" color={colors.primary} />
            </ThemedSafeAreaView>
        );
    }

    // Permission denied
    if (hasPermission === false) {
        return (
            <ThemedSafeAreaView style={styles.container}>
                <Stack.Screen options={{ headerShown: false }} />
                <BackButton />
                <View style={styles.centerContent}>
                    <ThemedIcon name="mic-off" size={64} color="error" />
                    <ThemedText variant="h2" style={styles.title}>
                        Microphone Access Required
                    </ThemedText>
                    <ThemedText variant="body" color="secondary" style={styles.subtitle}>
                        Please enable microphone access in settings to record audio.
                    </ThemedText>
                    <ThemedPressable variant="primary" onPress={checkPermissions}>
                        <ThemedText variant="button" color="inverse">Try Again</ThemedText>
                    </ThemedPressable>
                </View>
            </ThemedSafeAreaView>
        );
    }

    return (
        <ThemedSafeAreaView style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />
            
            {/* Header */}
            <View style={styles.header}>
                <BackButton variant="inline" />
                <ThemedText variant="h2">Record Audio</ThemedText>
            </View>

            {/* Main Content */}
            <View style={styles.content}>
                {/* Record Button */}
                <View style={styles.recordSection}>
                    <ThemedPressable
                        variant={state === 'recording' ? 'secondary' : 'primary'}
                        onPress={handleRecord}
                        style={[
                            styles.recordButton,
                            ...(state === 'recording' ? [styles.recordingButton] : [])
                        ]}
                        disabled={state === 'recorded'}
                    >
                        <ThemedIcon
                            name={state === 'recording' ? 'square' : 'mic'}
                            size={32}
                            color="inverse"
                        />
                    </ThemedPressable>

                    {/* Status */}
                    <ThemedText variant="h3" style={styles.statusText}>
                        {state === 'idle' && 'Tap to Record'}
                        {state === 'recording' && 'Recording...'}
                        {state === 'recorded' && 'Recording Complete'}
                    </ThemedText>

                    {/* Duration */}
                    {(state === 'recording' || state === 'recorded') && (
                        <ThemedText variant="h1" style={styles.duration}>
                            {formatTime(duration)}
                        </ThemedText>
                    )}

                    {/* Recording guidance */}
                    {state === 'recording' && (
                        <ThemedText variant="body" color="secondary" style={styles.guidance}>
                            Record for 3-6 seconds for best results
                        </ThemedText>
                    )}
                </View>

                {/* Playback Section */}
                {state === 'recorded' && recordedUri && (
                    <View style={styles.playbackSection}>
                        <ThemedText variant="h3" style={styles.playbackTitle}>
                            Preview Recording
                        </ThemedText>
                        
                        {/* Playback Controls */}
                        <View style={styles.playbackControls}>
                            <ThemedPressable
                                variant="secondary"
                                onPress={handlePlayPause}
                                style={[styles.playButton, styles.playButtonWithOffset]}
                            >
                                <ThemedIcon
                                    name={
                                        playbackState === 'playing' ? 'pause' :
                                        playbackState === 'paused' ? 'play' : 'play'
                                    }
                                    size={24}
                                    color="primary"
                                />
                            </ThemedPressable>

                            {/* Progress Bar */}
                            <View style={styles.progressContainer}>
                                <View style={styles.progressBar}>
                                    <View 
                                        style={[
                                            styles.progressFill,
                                            { 
                                                width: playbackDuration > 0 
                                                    ? `${(playbackPosition / playbackDuration) * 100}%` 
                                                    : '0%'
                                            }
                                        ]} 
                                    />
                                </View>
                                <View style={styles.timeContainer}>
                                    <ThemedText variant="caption" color="secondary">
                                        {formatTime(playbackPosition)}
                                    </ThemedText>
                                    <ThemedText variant="caption" color="secondary">
                                        {formatTime(playbackDuration)}
                                    </ThemedText>
                                </View>
                            </View>

                            {playbackState !== 'idle' && (
                                <ThemedPressable
                                    variant="ghost"
                                    onPress={stopPlayback}
                                    style={styles.stopButton}
                                >
                                    <ThemedIcon name="square" size={20} color="secondary" />
                                </ThemedPressable>
                            )}
                        </View>

                        {/* Playback Status */}
                        <ThemedText variant="caption" color="secondary" style={styles.playbackStatus}>
                            {playbackState === 'playing' && 'Playing...'}
                            {playbackState === 'paused' && 'Paused'}
                            {playbackState === 'idle' && 'Ready to play'}
                        </ThemedText>
                    </View>
                )}

                {/* Action Buttons */}
                {state === 'recorded' && (
                    <View style={styles.actionButtons}>
                        <ThemedPressable variant="secondary" onPress={handleRetake}>
                            <ThemedIcon name="rotate-ccw" size={20} color="primary" />
                            <ThemedText variant="button" color="primary">Retake</ThemedText>
                        </ThemedPressable>

                        <ThemedPressable variant="primary" onPress={handleSave}>
                            <ThemedIcon name="check" size={20} color="inverse" />
                            <ThemedText variant="button" color="inverse">Save Audio</ThemedText>
                        </ThemedPressable>
                    </View>
                )}
            </View>
        </ThemedSafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        gap: 12,
        minHeight: 56,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        padding: 24,
    },
    centerContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
        gap: 16,
    },
    title: {
        textAlign: 'center',
    },
    subtitle: {
        textAlign: 'center',
    },
    recordSection: {
        alignItems: 'center',
        gap: 24,
        marginBottom: 48,
    },
    recordButton: {
        width: 120,
        height: 120,
        borderRadius: 60,
        justifyContent: 'center',
        alignItems: 'center',
    },
    recordingButton: {
        transform: [{ scale: 1.1 }],
    },
    statusText: {
        textAlign: 'center',
    },
    duration: {
        textAlign: 'center',
        fontVariant: ['tabular-nums'],
    },
    guidance: {
        textAlign: 'center',
    },
    actionButtons: {
        flexDirection: 'row',
        gap: 16,
        justifyContent: 'center',
    },
    playbackSection: {
        alignItems: 'center',
        gap: 16,
        marginBottom: 32,
        paddingHorizontal: 16,
    },
    playbackTitle: {
        textAlign: 'center',
        marginBottom: 8,
    },
    playbackControls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        width: '100%',
    },
    playButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    playButtonWithOffset: {
        paddingLeft: 0.5, // Very subtle offset for both play and pause icons
    },
    stopButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    progressContainer: {
        flex: 1,
        gap: 8,
    },
    progressBar: {
        height: 4,
        backgroundColor: 'rgba(128, 128, 128, 0.3)',
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#007AFF',
        borderRadius: 2,
    },
    timeContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    playbackStatus: {
        textAlign: 'center',
    },
});