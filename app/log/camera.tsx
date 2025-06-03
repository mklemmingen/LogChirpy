import React, { useCallback, useRef, useState, useEffect } from 'react';
import {
    View,
    StyleSheet,
    Text,
    TouchableOpacity,
    useColorScheme,
    SafeAreaView,
    Dimensions,
    Alert,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
    Camera,
    useCameraDevice,
    useCameraPermission,
    useCameraFormat,
} from 'react-native-vision-camera';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { theme } from '@/constants/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function ModernCamera() {
    const { t } = useTranslation();
    const colorScheme = useColorScheme() ?? 'light';
    const pal = theme[colorScheme];

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

    useEffect(() => {
        if (!hasPermission) {
            requestPermission();
        }
    }, [hasPermission, requestPermission]);

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
        const flashModes: Array<'off' | 'on' | 'auto'> = ['off', 'auto', 'on'];
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
            <View style={[styles.centered, { backgroundColor: pal.colors.background }]}>
                <Text style={{ color: pal.colors.content.primary }}>
                    {t('camera.requesting_permission')}
                </Text>
            </View>
        );
    }

    if (!device) {
        return (
            <View style={[styles.centered, { backgroundColor: pal.colors.background }]}>
                <Text style={{ color: pal.colors.content.primary }}>
                    {t('camera.no_device')}
                </Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
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
                <TouchableOpacity
                    style={[styles.controlButton, { backgroundColor: 'rgba(0,0,0,0.6)' }]}
                    onPress={() => router.back()}
                >
                    <Feather name="arrow-left" size={24} color="white" />
                </TouchableOpacity>

                <View style={styles.topCenter}>
                    <Text style={styles.photoCount}>
                        {capturedPhotos.length} {t('photo.photos_taken')}
                    </Text>
                </View>

                <TouchableOpacity
                    style={[styles.controlButton, { backgroundColor: 'rgba(0,0,0,0.6)' }]}
                    onPress={toggleFlash}
                >
                    <Feather name={getFlashIcon()} size={24} color="white" />
                </TouchableOpacity>
            </View>

            {/* Bottom Controls */}
            <View style={styles.bottomControls}>
                <TouchableOpacity
                    style={styles.sideButton}
                    onPress={() => router.push('/log/photo-selection')}
                    disabled={capturedPhotos.length === 0}
                >
                    <View style={[
                        styles.thumbnailContainer,
                        { opacity: capturedPhotos.length > 0 ? 1 : 0.3 }
                    ]}>
                        <Feather name="grid" size={24} color="white" />
                        {capturedPhotos.length > 0 && (
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>{capturedPhotos.length}</Text>
                            </View>
                        )}
                    </View>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[
                        styles.captureButton,
                        isCapturing && styles.capturingButton
                    ]}
                    onPress={takePhoto}
                    disabled={isCapturing}
                >
                    <View style={styles.captureInner} />
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.sideButton}
                    onPress={toggleCamera}
                >
                    <Feather name="rotate-ccw" size={24} color="white" />
                </TouchableOpacity>
            </View>

            {/* Continue Button */}
            {capturedPhotos.length > 0 && (
                <TouchableOpacity
                    style={[styles.continueButton, { backgroundColor: pal.colors.primary }]}
                    onPress={proceedToSelection}
                >
                    <Text style={[styles.continueText, { color: pal.colors.content.inverse }]}>
                        {t('photo.continue_with_photos', { count: capturedPhotos.length })}
                    </Text>
                </TouchableOpacity>
            )}
        </SafeAreaView>
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
});
