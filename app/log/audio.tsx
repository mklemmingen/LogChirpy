/**
 * Streamlined Audio Recording Screen
 * 
 * Simple, responsive audio recording with 3-6 second guidance
 * Minimal UI focused on recording experience
 */

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {ActivityIndicator, Alert, StatusBar, StyleSheet} from 'react-native';
import {Audio} from 'expo-av';
import {router, Stack} from 'expo-router';
import {useTranslation} from 'react-i18next';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';

// Components
import {ThemedView} from '@/components/ThemedView';
import {ThemedText} from '@/components/ThemedText';
import {ThemedPressable} from '@/components/ThemedPressable';
import {ThemedIcon} from '@/components/ThemedIcon';
import {ThemedSafeAreaView} from '@/components/ThemedSafeAreaView';
import {BackButton} from '@/components/BackButton';

// Context
import {useLogDraft} from '@/contexts/LogDraftContext';

// Hooks
import {useColors} from '@/hooks/useThemeColor';

type RecordingState = 'idle' | 'recording' | 'stopping' | 'recorded';

// Optimized audio quality settings
const AUDIO_SETTINGS = {
    android: {
        extension: '.m4a',
        outputFormat: Audio.AndroidOutputFormat.MPEG_4,
        audioEncoder: Audio.AndroidAudioEncoder.AAC,
        sampleRate: 44100,
        numberOfChannels: 1,
        bitRate: 128000,
    },
    ios: {
        extension: '.m4a',
        outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
        audioQuality: Audio.IOSAudioQuality.HIGH,
        sampleRate: 44100,
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
    const [duration, setDuration] = useState(0);
    const [recordedUri, setRecordedUri] = useState<string | null>(null);
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);

    // Refs
    const recordingRef = useRef<Audio.Recording | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Check permissions on mount
    useEffect(() => {
        checkPermissions();
        return cleanup;
    }, []);

    const cleanup = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        if (recordingRef.current) {
            recordingRef.current.stopAndUnloadAsync().catch(console.warn);
            recordingRef.current = null;
        }
    }, []);

    const checkPermissions = async () => {
        try {
            const { status } = await Audio.getPermissionsAsync();
            setHasPermission(status === 'granted');
        } catch (error) {
            console.error('Permission check failed:', error);
            setHasPermission(false);
        }
    };

    const requestPermissions = async () => {
        try {
            const { status } = await Audio.requestPermissionsAsync();
            setHasPermission(status === 'granted');
            
            if (status !== 'granted') {
                Alert.alert(
                    'Permission Required',
                    'Microphone access is needed to record bird sounds.',
                    [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Settings', onPress: () => Linking.openSettings() }
                    ]
                );
            }
        } catch (error) {
            console.error('Permission request failed:', error);
            setHasPermission(false);
        }
    };

    const startRecording = async () => {
        if (!hasPermission) {
            await requestPermissions();
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
            Alert.alert('Error', 'Failed to start recording. Please try again.');
        }
    };

    const stopRecording = async () => {
        if (!recordingRef.current || state !== 'recording') return;

        setState('stopping');
        
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
                setRecordedUri(uri);
                setState('recorded');
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } else {
                throw new Error('No recording URI');
            }
        } catch (error) {
            console.error('Stop recording failed:', error);
            setState('idle');
            Alert.alert('Error', 'Failed to save recording. Please try again.');
        }
    };

    const handleRecord = useCallback(() => {
        if (state === 'recording') {
            stopRecording();
        } else if (state === 'idle') {
            startRecording();
        }
        // Do nothing for 'stopping' and 'recorded' states
    }, [state]);

    const handleRetake = useCallback(() => {
        setRecordedUri(null);
        setDuration(0);
        setState('idle');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, []);

    const handleConfirm = useCallback(() => {
        if (recordedUri) {
            update({ audioUri: recordedUri });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            router.back();
        }
    }, [recordedUri, update]);

    const formatTime = (seconds: number): string => {
        return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
    };

    const getDurationColor = () => {
        if (duration < 3) return colors.error;
        if (duration <= 6) return colors.success;
        return colors.warning;
    };

    const getDurationMessage = () => {
        if (duration < 3) return 'Keep recording...';
        if (duration <= 6) return 'Perfect length!';
        return 'Good length';
    };

    // Permission screen
    if (hasPermission === false) {
        return (
            <ThemedSafeAreaView style={styles.container}>
                <StatusBar barStyle="dark-content" />
                <Stack.Screen options={{ headerShown: false }} />
                
                <ThemedView style={styles.header}>
                    <BackButton variant="inline" />
                    <ThemedText variant="h3" style={styles.headerTitle}>
                        Record Audio
                    </ThemedText>
                </ThemedView>

                <ThemedView style={styles.centerContent}>
                    <ThemedView style={styles.permissionContainer}>
                        <ThemedIcon name="mic-off" size={48} color="error" />
                        <ThemedText variant="h2" style={styles.permissionTitle}>
                            Microphone Permission Required
                        </ThemedText>
                        <ThemedText variant="body" color="secondary" style={styles.permissionText}>
                            LogChirpy needs microphone access to record bird sounds for identification.
                        </ThemedText>
                        <ThemedView style={styles.permissionButtons}>
                            <ThemedPressable variant="secondary" onPress={() => router.back()}>
                                <ThemedText>Cancel</ThemedText>
                            </ThemedPressable>
                            <ThemedPressable variant="primary" onPress={requestPermissions}>
                                <ThemedText color="inverse">Grant Permission</ThemedText>
                            </ThemedPressable>
                        </ThemedView>
                    </ThemedView>
                </ThemedView>
            </ThemedSafeAreaView>
        );
    }

    // Processing screen
    if (state === 'stopping') {
        return (
            <ThemedSafeAreaView style={styles.container}>
                <StatusBar barStyle="dark-content" />
                <Stack.Screen options={{ headerShown: false }} />
                
                <ThemedView style={styles.centerContent}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <ThemedText variant="h3" color="secondary" style={styles.processingText}>
                        Processing recording...
                    </ThemedText>
                </ThemedView>
            </ThemedSafeAreaView>
        );
    }

    return (
        <ThemedSafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            <ThemedView style={styles.header}>
                <BackButton variant="inline" />
                <ThemedText variant="h3" style={styles.headerTitle}>
                    Record Audio
                </ThemedText>
            </ThemedView>

            {/* Main Content */}
            <ThemedView style={styles.content}>
                {/* Recording Status */}
                {state === 'recording' && (
                    <ThemedView style={styles.recordingStatus}>
                        <ThemedView style={styles.recordingDot} />
                        <ThemedText variant="label" color="error">
                            RECORDING
                        </ThemedText>
                    </ThemedView>
                )}

                {/* Duration Display */}
                <ThemedView style={styles.durationContainer}>
                    <ThemedText variant="h1" style={[styles.duration, { color: getDurationColor() }]}>
                        {formatTime(duration)}
                    </ThemedText>
                    {state === 'recording' && (
                        <ThemedText variant="body" color="secondary" style={styles.durationMessage}>
                            {getDurationMessage()}
                        </ThemedText>
                    )}
                </ThemedView>

                {/* Record Button */}
                <ThemedView style={styles.buttonContainer}>
                    <ThemedPressable
                        variant="ghost"
                        onPress={handleRecord}
                        disabled={state === 'recorded'}
                        style={[
                            styles.recordButton,
                            {
                                backgroundColor: state === 'recording' ? colors.error : colors.backgroundSecondary,
                                borderColor: state === 'recording' ? colors.error : colors.primary,
                            }
                        ]}
                    >
                        <ThemedIcon
                            name={state === 'recording' ? 'square' : 'mic'}
                            size={state === 'recording' ? 32 : 36}
                            color={state === 'recording' ? 'inverse' : 'primary'}
                        />
                    </ThemedPressable>
                    
                    <ThemedText variant="body" color="secondary" style={styles.buttonText}>
                        {state === 'recording' ? 'Tap to stop' : 'Tap to record'}
                    </ThemedText>
                </ThemedView>

                {/* Instructions */}
                {state === 'idle' && !recordedUri && (
                    <ThemedView style={styles.instructions}>
                        <ThemedText variant="body" color="secondary" style={styles.instructionText}>
                            Record bird sounds for AI identification.
                        </ThemedText>
                        <ThemedView style={styles.tip}>
                            <ThemedIcon name="info" size={16} color="accent" />
                            <ThemedText variant="caption" color="secondary">
                                3-6 seconds is optimal for best results
                            </ThemedText>
                        </ThemedView>
                    </ThemedView>
                )}
            </ThemedView>

            {/* Bottom Controls */}
            {recordedUri && state === 'recorded' && (
                <ThemedView style={styles.bottomControls}>
                    <ThemedPressable variant="secondary" onPress={handleRetake} style={styles.controlButton}>
                        <ThemedIcon name="refresh-cw" size={20} color="primary" />
                        <ThemedText>Retake</ThemedText>
                    </ThemedPressable>
                    
                    <ThemedPressable variant="primary" onPress={handleConfirm} style={styles.controlButton}>
                        <ThemedIcon name="check" size={20} color="inverse" />
                        <ThemedText color="inverse">Use Recording</ThemedText>
                    </ThemedPressable>
                </ThemedView>
            )}
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
        paddingHorizontal: 8,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.1)',
    },
    headerTitle: {
        marginLeft: 8,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
        gap: 32,
    },
    centerContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    
    // Recording Status
    recordingStatus: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderRadius: 20,
    },
    recordingDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#ef4444',
    },

    // Duration
    durationContainer: {
        alignItems: 'center',
        gap: 8,
    },
    duration: {
        fontSize: 48,
        fontWeight: '600',
        fontVariant: ['tabular-nums'],
    },
    durationMessage: {
        textAlign: 'center',
    },

    // Record Button
    buttonContainer: {
        alignItems: 'center',
        gap: 16,
    },
    recordButton: {
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 3,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    buttonText: {
        textAlign: 'center',
        fontWeight: '500',
    },

    // Instructions
    instructions: {
        alignItems: 'center',
        gap: 16,
        maxWidth: 280,
    },
    instructionText: {
        textAlign: 'center',
        lineHeight: 24,
    },
    tip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: 'rgba(0,0,0,0.05)',
        borderRadius: 16,
    },

    // Permission
    permissionContainer: {
        alignItems: 'center',
        gap: 24,
        padding: 32,
        maxWidth: 320,
    },
    permissionTitle: {
        textAlign: 'center',
        fontWeight: '600',
    },
    permissionText: {
        textAlign: 'center',
        lineHeight: 24,
    },
    permissionButtons: {
        flexDirection: 'row',
        gap: 16,
        width: '100%',
    },

    // Processing
    processingText: {
        marginTop: 16,
        textAlign: 'center',
    },

    // Bottom Controls
    bottomControls: {
        flexDirection: 'row',
        gap: 16,
        paddingHorizontal: 24,
        paddingVertical: 20,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.1)',
    },
    controlButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 16,
    },
});