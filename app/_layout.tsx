// app/_layout.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, Text, Pressable } from 'react-native';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
    withRepeat,
    interpolate,
    Easing,
} from 'react-native-reanimated';
import 'react-native-reanimated';
import "@/i18n/i18n";

import {
    useTheme,
    useSemanticColors,
    useColorVariants,
    useTypography,
    useMotionValues
} from '@/hooks/useThemeColor';
import { useBirdDexDatabase } from '@/hooks/useBirdDexDatabase';

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
import { initDB } from '@/services/database';

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

// Enhanced Loading Animation Component
function LoadingAnimation() {
    const semanticColors = useSemanticColors();
    const variants = useColorVariants();
    const motion = useMotionValues();

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
                    backgroundColor: variants.primarySubtle,
                    justifyContent: 'center',
                    alignItems: 'center',
                },
                animatedStyle,
            ]}
        >
            <Feather name="feather" size={32} color={semanticColors.primary} />
        </Animated.View>
    );
}

// Enhanced Database Loading Screen Component
function EnhancedDatabaseLoadingScreen({ onReady }: { onReady: () => void }) {
    const { isReady, isLoading, hasError, progress, loadedRecords, error, retry } = useBirdDexDatabase();
    const semanticColors = useSemanticColors();
    const variants = useColorVariants();
    const typography = useTypography();
    const theme = useTheme();
    const motion = useMotionValues();

    const fadeAnim = useSharedValue(0);
    const slideAnim = useSharedValue(30);

    React.useEffect(() => {
        if (isReady) {
            fadeAnim.value = withTiming(0, { duration: motion.duration.medium });
            slideAnim.value = withTiming(30, { duration: motion.duration.medium });
            setTimeout(onReady, motion.duration.medium);
        } else {
            fadeAnim.value = withTiming(1, { duration: motion.duration.medium });
            slideAnim.value = withTiming(0, { duration: motion.duration.medium });
        }
    }, [isReady]);

    const containerStyle = useAnimatedStyle(() => ({
        opacity: fadeAnim.value,
        transform: [{ translateY: slideAnim.value }],
    }));

    if (hasError) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: semanticColors.background }]}>
                <BlurView
                    intensity={80}
                    tint={semanticColors.background === '#FFFFFF' ? 'light' : 'dark'}
                    style={styles.errorCard}
                >
                    <View style={[styles.errorIconContainer, { backgroundColor: variants.primaryHover }]}>
                        <Feather name="alert-triangle" size={48} color={semanticColors.error} />
                    </View>

                    <Text style={[typography.headlineMedium, { color: semanticColors.text }]}>
                        Database Error
                    </Text>

                    <Text style={[typography.bodyMedium, { color: semanticColors.textSecondary, textAlign: 'center' }]}>
                        {error || 'Failed to load bird database. Check your storage and connection.'}
                    </Text>

                    <Pressable
                        style={[styles.retryButton, { backgroundColor: semanticColors.primary }]}
                        onPress={retry}
                    >
                        <Feather name="refresh-cw" size={20} color={semanticColors.onPrimary} />
                        <Text style={[typography.labelLarge, { color: semanticColors.onPrimary }]}>
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
                    { backgroundColor: semanticColors.background },
                    containerStyle
                ]}
            >
                <View style={styles.loadingContent}>
                    {/* Brand Header */}
                    <View style={styles.brandContainer}>
                        <LoadingAnimation />
                        <Text style={[typography.displayMedium, { color: semanticColors.text }]}>
                            LogChirpy
                        </Text>
                        <Text style={[typography.bodyLarge, { color: semanticColors.textSecondary }]}>
                            Preparing Your Bird Database
                        </Text>
                    </View>

                    {/* Progress Section */}
                    <BlurView
                        intensity={60}
                        tint={semanticColors.background === '#FFFFFF' ? 'light' : 'dark'}
                        style={[styles.progressCard, { borderColor: variants.primaryMuted }]}
                    >
                        <Text style={[typography.headlineSmall, { color: semanticColors.text }]}>
                            Loading Species Data
                        </Text>

                        {/* Progress Bar */}
                        <View style={styles.progressSection}>
                            <View style={[styles.progressTrack, { backgroundColor: semanticColors.border }]}>
                                <Animated.View
                                    style={[
                                        styles.progressFill,
                                        {
                                            backgroundColor: semanticColors.primary,
                                            width: `${Math.max(5, progress)}%`
                                        }
                                    ]}
                                />
                            </View>

                            <View style={styles.progressStats}>
                                <Text style={[typography.labelLarge, { color: semanticColors.primary }]}>
                                    {progress}%
                                </Text>
                                {loadedRecords > 0 && (
                                    <Text style={[typography.labelMedium, { color: semanticColors.textSecondary }]}>
                                        {loadedRecords.toLocaleString()} species loaded
                                    </Text>
                                )}
                            </View>
                        </View>

                        <Text style={[typography.bodySmall, { color: semanticColors.textTertiary, textAlign: 'center' }]}>
                            Building comprehensive bird identification database...
                        </Text>
                    </BlurView>

                    {/* Loading Hint */}
                    <Text style={[typography.labelMedium, { color: semanticColors.textTertiary, textAlign: 'center' }]}>
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
    const semanticColors = useSemanticColors();
    const typography = useTypography();
    const variants = useColorVariants();

    if (error) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: semanticColors.background }]}>
                <View style={styles.errorContent}>
                    <View style={[styles.errorIconContainer, { backgroundColor: variants.primaryHover }]}>
                        <Feather name="alert-circle" size={48} color={semanticColors.error} />
                    </View>

                    <Text style={[typography.headlineMedium, { color: semanticColors.text }]}>
                        Initialization Failed
                    </Text>

                    <Text style={[typography.bodyMedium, { color: semanticColors.textSecondary, textAlign: 'center' }]}>
                        {error}
                    </Text>

                    {onRetry && (
                        <Pressable
                            style={[styles.retryButton, { backgroundColor: semanticColors.primary }]}
                            onPress={onRetry}
                        >
                            <Feather name="refresh-cw" size={18} color={semanticColors.onPrimary} />
                            <Text style={[typography.labelLarge, { color: semanticColors.onPrimary }]}>
                                Try Again
                            </Text>
                        </Pressable>
                    )}
                </View>
            </View>
        );
    }

    return (
        <View style={[styles.loadingContainer, { backgroundColor: semanticColors.background }]}>
            <View style={styles.loadingContent}>
                <LoadingAnimation />
                <Text style={[typography.headlineMedium, { color: semanticColors.text }]}>
                    LogChirpy
                </Text>
                <Text style={[typography.bodyMedium, { color: semanticColors.textSecondary }]}>
                    {message}
                </Text>
            </View>
        </View>
    );
}

export default function EnhancedRootLayout() {
    const theme = useTheme();
    const semanticColors = useSemanticColors();
    const typography = useTypography();
    const [loaded] = useFonts(FONTS);
    const segments = useSegments();
    const current = segments[segments.length - 1];

    // Application state
    const [localDbReady, setLocalDbReady] = useState(false);
    const [localDbError, setLocalDbError] = useState<string | null>(null);
    const [birdDexReady, setBirdDexReady] = useState(false);
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

    // Hide splash screen when ready
    useEffect(() => {
        if (loaded && localDbReady) {
            SplashScreen.hideAsync();
        }
    }, [loaded, localDbReady]);

    const handleRetry = () => {
        setRetryCount(prev => prev + 1);
        setLocalDbError(null);
        setLocalDbReady(false);
    };

    // Show app initialization screen
    if (!loaded || !localDbReady) {
        return (
            <AppInitializationScreen
                message={!loaded ? "Loading fonts and assets..." : "Initializing local database..."}
                error={localDbError || undefined}
                onRetry={localDbError ? handleRetry : undefined}
            />
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
        <ThemeProvider
            value={{
                dark: theme === theme,
                colors: {
                    notification: semanticColors.accent,
                    background: semanticColors.background,
                    card: semanticColors.backgroundElevated,
                    text: semanticColors.text,
                    border: semanticColors.border,
                    primary: semanticColors.primary,
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
                    <View style={[styles.container, { backgroundColor: semanticColors.background }]}>
                        <Stack
                            screenOptions={() => ({
                                headerStyle: {
                                    backgroundColor:
                                        current === 'photo' || current === 'video'
                                            ? 'transparent'
                                            : semanticColors.backgroundElevated,
                                    ...theme.shadows.sm,
                                },
                                headerTransparent: current === 'photo' || current === 'video',
                                headerTintColor: semanticColors.text,
                                headerTitleStyle: {
                                    ...typography.headlineMedium,
                                    fontWeight: '600',
                                },
                                headerBackTitleVisible: false,
                                headerBackImage: () => (
                                    <Feather name="arrow-left" size={24} color={semanticColors.text} />
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