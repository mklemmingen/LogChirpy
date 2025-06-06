import React, {useEffect, useMemo, useState} from 'react';
import {ThemeProvider} from '@react-navigation/native';
import {useFonts} from 'expo-font';
import {Stack, useSegments} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import {StatusBar} from 'expo-status-bar';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {BlurView} from 'expo-blur';
import {ThemedIcon} from '@/components/ThemedIcon';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import 'react-native-reanimated';
import "@/i18n/i18n";
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useColors, useTheme, useTypography } from '@/hooks/useThemeColor';
import { AuthProvider } from '@/app/context/AuthContext';
import {useBirdDexDatabase} from '@/hooks/useBirdDexDatabase';

import {
    ImageLabelingConfig,
    useImageLabelingModels,
    useImageLabelingProvider
} from "@infinitered/react-native-mlkit-image-labeling";

import {
    ObjectDetectionConfig,
    useObjectDetectionModels,
    useObjectDetectionProvider
} from '@infinitered/react-native-mlkit-object-detection';

// Database imports
import {initDB} from '@/services/database';
import {BirdNetService} from '@/services/birdNetService';
import {fastTfliteBirdClassifier} from '@/services/fastTfliteBirdClassifier';

SplashScreen.preventAutoHideAsync();

// ML Models Configuration (same as before)
const MODELS_OBJECT: ObjectDetectionConfig = {
    ssdmobilenetV1: {
        model: require('../assets/models/ssd_mobilenet_v1_metadata.tflite'),
        options: {
            shouldEnableMultipleObjects: true,
            shouldEnableClassification: false,
            classificationConfidenceThreshold: 0.3,
            maxPerObjectLabelCount: 1
        }
    },
};

const MODELS_CLASS: ImageLabelingConfig = {
    birdClassifier: {
        model: require("../assets/models/birds_mobilenetv2/bird_classifier_metadata.tflite"),
        options: {
            confidenceThreshold: 0.5,
            maxResultCount: 5,
        },
    },
};

const FONTS = {
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
};

// Clean loading animation with minimal design
function LoadingAnimation() {
    const colors = useColors();

    const rotation = useSharedValue(0);
    const scale = useSharedValue(1);
    const opacity = useSharedValue(0.7);

    React.useEffect(() => {
        rotation.value = withRepeat(
            withTiming(360, { duration: 2000, easing: Easing.linear }),
            -1,
            false
        );

        scale.value = withRepeat(
            withSpring(1.1, { damping: 15, stiffness: 300 }),
            -1,
            true
        );

        opacity.value = withRepeat(
            withTiming(1, { duration: 1500 }),
            -1,
            true
        );
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { rotate: `${rotation.value}deg` },
            { scale: scale.value }
        ],
        opacity: opacity.value,
    }));

    return (
        <Animated.View
            style={[
                {
                    width: 64,
                    height: 64,
                    borderRadius: 32,
                    backgroundColor: colors.backgroundSecondary,
                    justifyContent: 'center',
                    alignItems: 'center',
                },
                animatedStyle,
            ]}
        >
            <ThemedIcon name="feather" size={32} color="primary" />
        </Animated.View>
    );
}

// Enhanced Database Loading Screen Component
function EnhancedDatabaseLoadingScreen({ onReady }: { onReady: () => void }) {
    const { isReady, isLoading, hasError, progress, loadedRecords, error, retry } = useBirdDexDatabase();
    const colors = useColors();
    const typography = useTypography();
    const theme = useTheme();

    const fadeAnim = useSharedValue(0);
    const slideAnim = useSharedValue(30);

    React.useEffect(() => {
        if (isReady) {
            fadeAnim.value = withTiming(0, { duration: theme.motion.duration.normal });
            slideAnim.value = withTiming(30, { duration: theme.motion.duration.normal });
            setTimeout(onReady, theme.motion.duration.normal);
        } else {
            fadeAnim.value = withTiming(1, { duration: theme.motion.duration.normal });
            slideAnim.value = withTiming(0, { duration: theme.motion.duration.normal });
        }
    }, [isReady]);

    const containerStyle = useAnimatedStyle(() => ({
        opacity: fadeAnim.value,
        transform: [{ translateY: slideAnim.value }],
    }));

    if (hasError) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
                <BlurView
                    intensity={80}
                    tint={colors.background === '#FFFFFF' ? 'light' : 'dark'}
                    style={styles.errorCard}
                >
                    <View style={[styles.errorIconContainer, { backgroundColor: colors.backgroundSecondary }]}>
                        <ThemedIcon name="alert-triangle" size={48} color="error" />
                    </View>

                    <Text style={[typography.h2, { color: colors.text }]}>
                        Database Error
                    </Text>

                    <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center' }]}>
                        {error || 'Failed to load bird database. Check your storage and connection.'}
                    </Text>

                    <Pressable
                        style={[styles.retryButton, { backgroundColor: colors.primary }]}
                        onPress={retry}
                    >
                        <ThemedIcon name="refresh-cw" size={20} color="secondary" />
                        <Text style={[typography.label, { color: colors.textInverse }]}>
                            Retry Loading
                        </Text>
                    </Pressable>
                </BlurView>
            </View>
        );
    }

    if (isLoading) {
        return (
            <Animated.View
                style={[
                    styles.loadingContainer,
                    { backgroundColor: colors.background },
                    containerStyle
                ]}
            >
                <View style={styles.loadingContent}>
                    {/* Brand Header */}
                    <View style={styles.brandContainer}>
                        <LoadingAnimation />
                        <Text style={[typography.h1, { color: colors.text }]}>
                            LogChirpy
                        </Text>
                        <Text style={[typography.body, { color: colors.textSecondary }]}>
                            Preparing Your Bird Database
                        </Text>
                    </View>

                    {/* Progress Section */}
                    <BlurView
                        intensity={60}
                        tint={colors.background === '#FFFFFF' ? 'light' : 'dark'}
                        style={[styles.progressCard, { borderColor: colors.border }]}
                    >
                        <Text style={[typography.h3, { color: colors.text }]}>
                            Loading Species Data
                        </Text>

                        {/* Progress Bar */}
                        <View style={styles.progressSection}>
                            <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
                                <Animated.View
                                    style={[
                                        styles.progressFill,
                                        {
                                            backgroundColor: colors.primary,
                                            width: `${Math.max(5, progress)}%`
                                        }
                                    ]}
                                />
                            </View>

                            <View style={styles.progressStats}>
                                <Text style={[typography.label, { color: colors.primary }]}>
                                    {progress}%
                                </Text>
                                {loadedRecords > 0 && (
                                    <Text style={[typography.label, { color: colors.textSecondary }]}>
                                        {loadedRecords.toLocaleString()} species loaded
                                    </Text>
                                )}
                            </View>
                        </View>

                        <Text style={[typography.bodySmall, { color: colors.textTertiary, textAlign: 'center' }]}>
                            Building comprehensive bird identification database...
                        </Text>
                    </BlurView>

                    {/* Loading Hint */}
                    <Text style={[typography.label, { color: colors.textTertiary, textAlign: 'center' }]}>
                        This may take a moment on first launch
                    </Text>
                </View>
            </Animated.View>
        );
    }

    return null;
}

// Enhanced App Initialization Loading
function AppInitializationScreen({ message, error, onRetry }: {
    message: string;
    error?: string;
    onRetry?: () => void;
}) {
    const colors = useColors();
    const typography = useTypography();

    if (error) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
                <View style={styles.errorContent}>
                    <View style={[styles.errorIconContainer, { backgroundColor: colors.backgroundSecondary }]}>
                        <ThemedIcon name="alert-circle" size={48} color="error" />
                    </View>

                    <Text style={[typography.h2, { color: colors.text }]}>
                        Initialization Failed
                    </Text>

                    <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center' }]}>
                        {error}
                    </Text>

                    {onRetry && (
                        <Pressable
                            style={[styles.retryButton, { backgroundColor: colors.primary }]}
                            onPress={onRetry}
                        >
                            <ThemedIcon name="refresh-cw" size={18} color="error" />
                            <Text style={[typography.label, { color: colors.textInverse }]}>
                                Try Again
                            </Text>
                        </Pressable>
                    )}
                </View>
            </View>
        );
    }

    return (
        <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
            <View style={styles.loadingContent}>
                <LoadingAnimation />
                <Text style={[typography.h2, { color: colors.text }]}>
                    LogChirpy
                </Text>
                <Text style={[typography.body, { color: colors.textSecondary }]}>
                    {message}
                </Text>
            </View>
        </View>
    );
}

export default function EnhancedRootLayout() {
    const theme = useTheme();
    const colors = useColors();
    const typography = useTypography();
    const [loaded] = useFonts(FONTS);
    const segments = useSegments();
    const current = segments[segments.length - 1];

    // Application state
    const [localDbReady, setLocalDbReady] = useState(false);
    const [localDbError, setLocalDbError] = useState<string | null>(null);
    const [birdDexReady, setBirdDexReady] = useState(false);
    const [offlineModelReady, setOfflineModelReady] = useState(false);
    const [retryCount, setRetryCount] = useState(0);

    // ML Models setup (same as before)
    const models_class = useImageLabelingModels(MODELS_CLASS);
    const { ImageLabelingModelProvider } = useImageLabelingProvider(models_class);

    const models = useObjectDetectionModels<typeof MODELS_OBJECT>(useMemo(() => ({
        assets: MODELS_OBJECT,
        loadDefaultModel: true,
        defaultModelOptions: {
            shouldEnableMultipleObjects: true,
            shouldEnableClassification: true,
            detectorMode: 'singleImage',
        },
    }), []));
    const { ObjectDetectionProvider } = useObjectDetectionProvider(models);

    // Initialize local database
    useEffect(() => {
        const initializeLocalDB = async () => {
            try {
                await initDB();
                setLocalDbReady(true);
                setLocalDbError(null);
            } catch (error) {
                console.error('Local DB initialization failed:', error);
                setLocalDbError(error instanceof Error ? error.message : 'Failed to initialize local database');
                setLocalDbReady(true); // Allow app to continue
            }
        };

        initializeLocalDB();
    }, [retryCount]);

    // Initialize offline bird classification model
    useEffect(() => {
        const initializeOfflineModel = async () => {
            try {
                console.log('Initializing offline bird classification model...');
                await BirdNetService.initializeOfflineMode();
                setOfflineModelReady(true);
                console.log('Offline bird classification model initialized successfully');
            } catch (error) {
                console.error('Offline model initialization failed:', error);
                // Continue without offline model - it will fallback to online
                setOfflineModelReady(true);
            }
        };

        // Only initialize after local DB is ready
        if (localDbReady) {
            initializeOfflineModel();
        }
    }, [localDbReady]);

    // Hide splash screen when ready
    useEffect(() => {
        if (loaded && localDbReady && offlineModelReady) {
            SplashScreen.hideAsync();
        }
    }, [loaded, localDbReady, offlineModelReady]);

    const handleRetry = () => {
        setRetryCount(prev => prev + 1);
        setLocalDbError(null);
        setLocalDbReady(false);
    };

    // Show app initialization screen
    if (!loaded || !localDbReady || !offlineModelReady) {
        let message = "Loading application...";
        if (!loaded) {
            message = "Loading fonts and assets...";
        } else if (!localDbReady) {
            message = "Initializing local database...";
        } else if (!offlineModelReady) {
            message = "Loading AI models...";
        }

        return (
            <ImageLabelingModelProvider>
                <ObjectDetectionProvider>
                    <AppInitializationScreen
                        message={message}
                        error={localDbError || undefined}
                        onRetry={localDbError ? handleRetry : undefined}
                    />
                    <StatusBar style="auto" />
                </ObjectDetectionProvider>
            </ImageLabelingModelProvider>
        );
    }

    // Show bird database loading screen
    if (!birdDexReady) {
        return (
            <ImageLabelingModelProvider>
                <ObjectDetectionProvider>
                    <EnhancedDatabaseLoadingScreen onReady={() => setBirdDexReady(true)} />
                    <StatusBar style="auto" />
                </ObjectDetectionProvider>
            </ImageLabelingModelProvider>
        );
    }

    // Main app with enhanced theming
    return (
        <SafeAreaProvider>
            <AuthProvider>
                <ThemeProvider
                    value={{
                        dark: colors.isDark,
                        colors: {
                            notification: colors.primary,
                            background: colors.background,
                            card: colors.surface,
                            text: colors.text,
                            border: colors.border,
                            primary: colors.primary,
                        },
                        fonts: {
                            regular: { fontFamily: 'SpaceMono', fontWeight: 'normal' },
                            medium: { fontFamily: 'SpaceMono', fontWeight: '500' },
                            bold: { fontFamily: 'SpaceMono', fontWeight: 'bold' },
                            heavy: { fontFamily: 'SpaceMono', fontWeight: '800' },
                        },
                    }}
                >
                    <ImageLabelingModelProvider>
                        <ObjectDetectionProvider>
                            <View style={[styles.container, { backgroundColor: colors.background }]}>
                                <Stack
                                    screenOptions={() => ({
                                        headerStyle: {
                                            backgroundColor:
                                                current === 'photo' || current === 'video'
                                                    ? 'transparent'
                                                    : colors.surface,
                                            ...theme.shadows.sm,
                                        },
                                        headerTransparent: current === 'photo' || current === 'video',
                                        headerTintColor: colors.text,
                                        headerTitleStyle: {
                                            ...typography.h2,
                                            fontWeight: '600',
                                        },
                                        headerBackTitleVisible: false,
                                        headerBackImage: () => (
                                            <ThemedIcon name="arrow-left" size={24} color="primary" />
                                        ),
                                    })}
                                >
                                    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                                    <Stack.Screen name="+not-found" />
                                </Stack>
                            </View>
                            <StatusBar style="auto" />
                        </ObjectDetectionProvider>
                    </ImageLabelingModelProvider>
                </ThemeProvider>
            </AuthProvider>
        </SafeAreaProvider>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },

    // Loading States
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    loadingContent: {
        alignItems: 'center',
        maxWidth: 350,
        width: '100%',
        gap: 24,
    },

    // Brand Section
    brandContainer: {
        alignItems: 'center',
        gap: 16,
        marginBottom: 32,
    },

    // Progress Section
    progressCard: {
        width: '100%',
        padding: 24,
        borderRadius: 20,
        borderWidth: 1,
        gap: 16,
        alignItems: 'center',
    },
    progressSection: {
        width: '100%',
        gap: 12,
    },
    progressTrack: {
        width: '100%',
        height: 8,
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 4,
    },
    progressStats: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },

    // Error States
    errorCard: {
        padding: 32,
        borderRadius: 24,
        alignItems: 'center',
        maxWidth: 350,
        width: '100%',
        gap: 20,
    },
    errorContent: {
        alignItems: 'center',
        maxWidth: 320,
        gap: 20,
    },
    errorIconContainer: {
        width: 96,
        height: 96,
        borderRadius: 48,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    retryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 16,
        gap: 8,
        minWidth: 120,
    },
});

export type MyModelsConfig = typeof MODELS_OBJECT;