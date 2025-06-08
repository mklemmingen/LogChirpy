import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Alert, StyleSheet, useColorScheme, View, InteractionManager, Platform, AppState} from 'react-native';
import {router, Stack, useFocusEffect} from 'expo-router';
import {useTranslation} from 'react-i18next';
import {useIsFocused} from '@react-navigation/native';
import {Camera, useCameraDevice, useCameraFormat, useCameraPermission,} from 'react-native-vision-camera';
import {ThemedIcon} from '@/components/ThemedIcon';
import * as Haptics from 'expo-haptics';
import { CriticalErrorBoundary } from '@/components/ComponentErrorBoundary';
import NavigationErrorBoundary from '@/components/NavigationErrorBoundary';
import { SafeCameraViewManager } from '@/components/SafeViewManager';

import {theme} from '@/constants/theme';
import {ThemedPressable} from '@/components/ThemedPressable';
import {ThemedText} from '@/components/ThemedText';
import {ThemedSafeAreaView} from '@/components/ThemedSafeAreaView';
import {useColors} from '@/hooks/useThemeColor';

// Screen dimensions available if needed
// const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

function ModernCameraComponent() {
    const { t } = useTranslation();
    const colorScheme = useColorScheme() ?? 'light';
    const pal = theme[colorScheme];
    const colors = useColors();

    const camera = useRef<Camera>(null);
    const { hasPermission, requestPermission } = useCameraPermission();

    const [cameraPosition, setCameraPosition] = useState<'back' | 'front'>('back');
    const [isActive, setIsActive] = useState(true);
    const [flash, setFlash] = useState<'off' | 'on' | 'auto'>('auto');
    const [capturedPhotos, setCapturedPhotos] = useState<string[]>([]);
    const [isCapturing, setIsCapturing] = useState(false);
    
    // Focus coordination refs
    const isFocused = useIsFocused();
    const [appState, setAppState] = useState(AppState.currentState);
    const [shouldRenderCamera, setShouldRenderCamera] = useState(false);
    const [cameraReady, setCameraReady] = useState(false);
    const mountedRef = useRef(true);
    const cleanupInProgressRef = useRef(false);
    const cameraCleanupTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const device = useCameraDevice(cameraPosition);
    const format = useCameraFormat(device, [
        { photoResolution: { width: 3024, height: 4032 } },
        { fps: 30 }
    ]);

    // CRITICAL: Multi-condition camera activation with InteractionManager
    const isActiveCameraState = isFocused && appState === "active" && shouldRenderCamera && !cleanupInProgressRef.current;

    useEffect(() => {
        const subscription = AppState.addEventListener('change', nextAppState => {
            setAppState(nextAppState);
        });
        return () => subscription?.remove();
    }, []);

    useEffect(() => {
        if (!hasPermission) {
            requestPermission();
        }
    }, [hasPermission, requestPermission]);

    // Navigation-aware camera mounting with InteractionManager
    useEffect(() => {
        if (isFocused && appState === 'active') {
            cleanupInProgressRef.current = false;
            
            // Clear any pending cleanup
            if (cameraCleanupTimeoutRef.current) {
                clearTimeout(cameraCleanupTimeoutRef.current);
                cameraCleanupTimeoutRef.current = null;
            }
            
            // Use InteractionManager for smooth transitions
            InteractionManager.runAfterInteractions(() => {
                const renderTimer = setTimeout(() => {
                    if (!cleanupInProgressRef.current && isFocused && appState === 'active') {
                        setShouldRenderCamera(true);
                    }
                }, 200); // Android stability delay
                
                return () => clearTimeout(renderTimer);
            });
        } else {
            cleanupInProgressRef.current = true;
            setShouldRenderCamera(false);
            setCameraReady(false);
            setIsActive(false);
            
            // Schedule cleanup with delay to ensure proper resource release
            cameraCleanupTimeoutRef.current = setTimeout(() => {
                console.log('[Camera] Cleanup timeout completed');
            }, 200);
        }
    }, [isFocused, appState]);

    // Comprehensive cleanup on unmount
    useEffect(() => {
        return () => {
            mountedRef.current = false;
            cleanupInProgressRef.current = true;
            setShouldRenderCamera(false);
            setCameraReady(false);
            setIsActive(false);
            
            if (cameraCleanupTimeoutRef.current) {
                clearTimeout(cameraCleanupTimeoutRef.current);
            }
        };
    }, []);

    // Early return for non-focused states (as per refactor plan)
    if (!isFocused) {
        return (
            <ThemedSafeAreaView style={styles.container}>
                <View style={styles.centered}>
                    <ThemedText>Camera paused - tab not focused</ThemedText>
                </View>
            </ThemedSafeAreaView>
        );
    }

    if (!shouldRenderCamera) {
        return (
            <ThemedSafeAreaView style={styles.container}>
                <View style={styles.centered}>
                    <ThemedText>Initializing camera system...</ThemedText>
                </View>
            </ThemedSafeAreaView>
        );
    }

    const handleCameraReady = useCallback(() => {
        // Only activate if tab is focused and component is mounted
        if (isFocused && mountedRef.current && !cleanupInProgressRef.current) {
            setCameraReady(true);
            setIsActive(true);
        }
    }, [isFocused]);

    const handleCameraUnmount = useCallback(() => {
        cleanupInProgressRef.current = true;
        
        setCameraReady(false);
        setIsActive(false);
        
        // Clear captured photos state on unmount to prevent memory leaks
        if (mountedRef.current) {
            setCapturedPhotos([]);
        }
        
        // Reset cleanup flag
        setTimeout(() => {
            cleanupInProgressRef.current = false;
        }, 100);
    }, []);

    // Enhanced focus-based camera management with state coordination
    useFocusEffect(
        useCallback(() => {
            // Reset cleanup flag when gaining focus
            cleanupInProgressRef.current = false;
            
            return () => {
                // Mark cleanup in progress
                cleanupInProgressRef.current = true;
                
                // Ensure cleanup when losing focus
                setIsActive(false);
                setCameraReady(false);
                
                // Clear captured photos on focus loss to prevent state conflicts
                setCapturedPhotos([]);
            };
        }, [])
    );
    
    // Component unmount cleanup
    useEffect(() => {
        return () => {
            mountedRef.current = false;
        };
    }, []);

    const takePhoto = async () => {
        // Enhanced camera operation checks with focus coordination
        if (!camera.current || isCapturing || !isFocused || !isActive || !cameraReady || cleanupInProgressRef.current) {
            return;
        }

        try {
            setIsCapturing(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

            // Check focus state before camera operation
            if (!isFocused || cleanupInProgressRef.current) {
                setIsCapturing(false);
                return;
            }

            const photo = await camera.current.takePhoto({
                flash,
                enableShutterSound: false,
                enableAutoRedEyeReduction: true,
                enableAutoDistortionCorrection: true,
            });

            // Check focus state after photo capture
            if (!isFocused || cleanupInProgressRef.current || !mountedRef.current) {
                setIsCapturing(false);
                return;
            }

            setCapturedPhotos(prev => [...prev, photo.path]);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (error) {
            console.error('Photo capture failed:', error);
            // Only show alert if still focused and mounted
            if (isFocused && mountedRef.current && !cleanupInProgressRef.current) {
                Alert.alert(t('common.error'), t('camera.capture_failed'));
            }
        } finally {
            // Only update state if still focused and mounted
            if (isFocused && mountedRef.current && !cleanupInProgressRef.current) {
                setIsCapturing(false);
            }
        }
    };

    const toggleCamera = () => {
        setCameraPosition(prev => prev === 'back' ? 'front' : 'back');
        Haptics.selectionAsync();
    };

    const toggleFlash = () => {
        const flashModes: ('off' | 'on' | 'auto')[] = ['off', 'auto', 'on'];
        const currentIndex = flashModes.indexOf(flash);
        const nextIndex = (currentIndex + 1) % flashModes.length;
        setFlash(flashModes[nextIndex]);
        Haptics.selectionAsync();
    };

    const proceedToSelection = () => {
        if (capturedPhotos.length === 0) {
            Alert.alert(t('photo.no_photos'), t('photo.take_at_least_one'));
            return;
        }

        router.push({
            pathname: '/log/photo-selection',
            params: { photos: JSON.stringify(capturedPhotos) }
        });
    };

    const getFlashIcon = () => {
        switch (flash) {
            case 'on': return 'zap';
            case 'auto': return 'zap-off';
            case 'off': return 'zap-off';
        }
    };

    if (!hasPermission) {
        return (
            <View style={[styles.centered, { backgroundColor: colors.backgroundSecondary }]}>
                <ThemedText style={{ color: colors.text }}>
                    {t('camera.requesting_permission')}
                </ThemedText>
            </View>
        );
    }

    if (!device) {
        return (
            <View style={[styles.centered, { backgroundColor: colors.backgroundSecondary }]}>
                <ThemedText style={{ color: colors.text }}>
                    {t('camera.no_device')}
                </ThemedText>
            </View>
        );
    }

    return (
        <ThemedSafeAreaView style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />

            <SafeCameraViewManager
                style={StyleSheet.absoluteFillObject}
                isActive={isActiveCameraState}
                onCameraReady={() => setCameraReady(true)}
                onCameraUnmount={() => {
                    setCameraReady(false);
                    cleanupInProgressRef.current = true;
                }}
            >
                <Camera
                    ref={camera}
                    style={StyleSheet.absoluteFillObject}
                    device={device}
                    format={format}
                    isActive={isActiveCameraState}
                    photo={true}
                    enableZoomGesture={true}
                    enableLocation={true}
                />
            </SafeCameraViewManager>

            {/* Top Controls */}
            <View style={styles.topControls}>
                <ThemedPressable
                    style={[styles.controlButton, { backgroundColor: colors.overlay }]}
                    onPress={() => router.back()}
                >
                    <ThemedIcon name="arrow-left" size={24} color="primary" />
                </ThemedPressable>

                <View style={styles.topCenter}>
                    <ThemedText style={styles.photoCount}>
                        {capturedPhotos.length} {t('photo.photos_taken')}
                    </ThemedText>
                </View>

                <ThemedPressable
                    style={[styles.controlButton, { backgroundColor: colors.overlay }]}
                    onPress={toggleFlash}
                >
                    <ThemedIcon name={getFlashIcon()} size={24} color="primary" />
                </ThemedPressable>
            </View>

            {/* Bottom Controls */}
            <View style={styles.bottomControls}>
                <ThemedPressable
                    style={styles.sideButton}
                    onPress={() => router.push('/log/photo-selection')}
                    disabled={capturedPhotos.length === 0}
                >
                    <View style={[
                        styles.thumbnailContainer,
                        { opacity: capturedPhotos.length > 0 ? 1 : 0.3 }
                    ]}>
                        <ThemedIcon name="grid" size={24} color="primary" />
                        {capturedPhotos.length > 0 && (
                            <View style={styles.badge}>
                                <ThemedText style={styles.badgeText}>{capturedPhotos.length}</ThemedText>
                            </View>
                        )}
                    </View>
                </ThemedPressable>

                <ThemedPressable
                    style={[
                        styles.captureButton,
                        ...(isCapturing ? [styles.capturingButton] : [])
                    ]}
                    onPress={takePhoto}
                    disabled={isCapturing}
                >
                    <View style={styles.captureInner} />
                </ThemedPressable>

                <ThemedPressable
                    style={styles.sideButton}
                    onPress={toggleCamera}
                >
                    <ThemedIcon name="rotate-ccw" size={24} color="primary" />
                </ThemedPressable>
            </View>

            {/* Continue Button */}
            <ThemedPressable
                style={[
                    styles.continueButton, 
                    { 
                        backgroundColor: colors.primary,
                        opacity: capturedPhotos.length > 0 ? 1 : 0,
                        pointerEvents: capturedPhotos.length > 0 ? 'auto' : 'none'
                    }
                ]}
                onPress={proceedToSelection}
            >
                <ThemedText style={[styles.continueText, { color: colors.textInverse }]}>
                    {t('photo.continue_with_photos', { count: capturedPhotos.length })}
                </ThemedText>
            </ThemedPressable>
        </ThemedSafeAreaView>
    );
}

export default function ModernCamera() {
    return (
        <NavigationErrorBoundary>
            <CriticalErrorBoundary 
                componentName="Camera"
                onError={(error, errorId) => {
                    console.error('Camera component error:', error, errorId);
                    // Report camera errors for investigation
                }}
            >
                <ModernCameraComponent />
            </CriticalErrorBoundary>
        </NavigationErrorBoundary>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'black',
    },
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
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
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
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
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
        borderColor: 'rgba(255, 255, 255, 0.3)',
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
});
