import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Alert, StyleSheet, useColorScheme, View,} from 'react-native';
import {router, Stack, useFocusEffect} from 'expo-router';
import {useTranslation} from 'react-i18next';
import {Camera, useCameraDevice, useCameraFormat, useCameraPermission,} from 'react-native-vision-camera';
import {ThemedIcon} from '@/components/ThemedIcon';
import * as Haptics from 'expo-haptics';

import {theme} from '@/constants/theme';
import {ThemedPressable} from '@/components/ThemedPressable';
import {ThemedText} from '@/components/ThemedText';
import {ThemedSafeAreaView} from '@/components/ThemedSafeAreaView';
import {useColors} from '@/hooks/useThemeColor';

// Screen dimensions available if needed
// const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function CameraScreen() {
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

    const device = useCameraDevice(cameraPosition);
    const format = useCameraFormat(device, [
        { photoResolution: { width: 3024, height: 4032 } },
        { fps: 30 }
    ]);

    const [permissionRequested, setPermissionRequested] = useState(false);

    useEffect(() => {
        if (!hasPermission && !permissionRequested) {
            setPermissionRequested(true);
            requestPermission();
        }
    }, [hasPermission, permissionRequested, requestPermission]);

    // Proper camera lifecycle management
    useEffect(() => {
        return () => {
            // Cleanup camera when component unmounts
            setIsActive(false);
        };
    }, []);

    // Focus-based camera management to prevent view conflicts
    useFocusEffect(
        useCallback(() => {
            // Component is focused - activate camera
            setIsActive(true);
            
            return () => {
                // Component losing focus - deactivate camera to prevent conflicts
                setIsActive(false);
            };
        }, [])
    );

    const takePhoto = async () => {
        if (!camera.current || isCapturing) return;

        try {
            setIsCapturing(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

            const photo = await camera.current.takePhoto({
                flash,
                enableShutterSound: false,
                enableAutoRedEyeReduction: true,
                enableAutoDistortionCorrection: true,
            });

            setCapturedPhotos(prev => [...prev, photo.path]);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (error) {
            console.error('Photo capture failed:', error);
            Alert.alert(t('common.error'), t('camera.capture_failed'));
        } finally {
            setIsCapturing(false);
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

            <Camera
                ref={camera}
                style={StyleSheet.absoluteFillObject}
                device={device}
                format={format}
                isActive={isActive}
                photo={true}
                enableZoomGesture={true}
                enableLocation={true}
            />

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
