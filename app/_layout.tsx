import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View, Platform } from 'react-native';
import { ThemedIcon } from '@/components/ThemedIcon';
import { useTranslation } from 'react-i18next';
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
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useColors, useTheme, useTypography, useShadows } from '@/hooks/useThemeColor';
import { AuthProvider } from '@/contexts/AuthContext';
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
import { AudioIdentificationService } from '@/services/audioIdentificationService';

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
    efficientNetlite0int8: {
        model: require('../assets/models/efficientnet-lite0-int8.tflite'),
        options: {
            shouldEnableMultipleObjects: true,
            shouldEnableClassification: true,
            classificationConfidenceThreshold: 0.3,
            maxPerObjectLabelCount: 3
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


/**
 * Loading animation with feather icon
 */
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

        // Cleanup animations on unmount
        return () => {
            'worklet';
            rotation.value = 0;
            scale.value = 1;
            opacity.value = 0.7;
        };
    }, [rotation, scale, opacity]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { rotate: `${rotation.value}deg` },
            { scale: scale.value }
        ],
        opacity: opacity.value,
    }));

    const iconSize = 32;
    const containerSize = iconSize * 2;

    return (
        <Animated.View
            style={[
                {
                    width: containerSize,
                    height: containerSize,
                    borderRadius: containerSize / 2,
                    backgroundColor: colors.backgroundSecondary,
                    justifyContent: 'center',
                    alignItems: 'center',
                },
                animatedStyle,
            ]}
        >
            <ThemedIcon name="feather" size={iconSize} color="primary" />
        </Animated.View>
    );
}

/**
 * Database loading screen with progress display
 * 
 * @param props.onReady - Callback when database is ready
 * @param props.localDbReady - Whether the local database is ready
 */
function DatabaseLoadingScreen({ onReady, localDbReady }: { onReady: () => void; localDbReady: boolean }) {
    const { t } = useTranslation();
    const { isReady, isLoading, hasError, progress, loadedRecords, error, retry } = useBirdDexDatabase(localDbReady);
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

        // Cleanup animations on unmount
        return () => {
            'worklet';
            fadeAnim.value = 0;
            slideAnim.value = 30;
        };
    }, [isReady, fadeAnim, slideAnim, theme.motion.duration.normal, onReady]);

    const containerStyle = useAnimatedStyle(() => ({
        opacity: fadeAnim.value,
        transform: [{ translateY: slideAnim.value }],
    }));

    if (hasError) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
                <View style={[
                    styles.errorCard,
                    {
                        backgroundColor: colors.backgroundSecondary,
                        borderColor: colors.border,
                        padding: 24,
                        borderRadius: 20,
                        borderWidth: 1,
                    }
                ]}>
                    <View style={[
                        styles.errorIconContainer,
                        {
                            backgroundColor: colors.backgroundSecondary,
                            width: 96,
                            height: 96,
                            borderRadius: 48,
                        }
                    ]}>
                        <ThemedIcon name="x" size={48} color="error" />
                    </View>

                    <Text style={[typography.h2, { color: colors.text }]}>
                       {t('errors.database_error_title')}
                    </Text>

                    <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center' }]}>
                        {error || t('errors.bird_db_load_failed')}
                    </Text>

                    <Pressable
                        style={[
                            styles.retryButton,
                            {
                                backgroundColor: colors.primary,
                                height: 48,
                                paddingHorizontal: 24,
                            }
                        ]}
                        onPress={retry}
                        accessibilityRole="button"
                        accessibilityLabel="Retry loading database"
                        accessibilityHint="Attempts to reload the bird database"
                    >
                        <ThemedIcon name="refresh-cw" size={16} color="secondary" />
                        <Text style={[typography.label, { color: colors.textInverse }]}>
                             {t('common.retry_loading')}
                        </Text>
                    </Pressable>
                </View>
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
                            {t('loading_messages.preparing_bird_database')}
                        </Text>
                    </View>

                    {/* Progress Section */}
                    <View
                        style={[
                            styles.progressCard,
                            {
                                backgroundColor: colors.backgroundSecondary,
                                borderColor: colors.border,
                                padding: 24,
                                borderRadius: 20,
                                borderWidth: 1,
                            }
                        ]}
                    >
                        <Text style={[typography.h3, { color: colors.text }]}>
                            {t('loading_messages.loading_species_data')}
                        </Text>

                        {/* Progress Bar */}
                        <View style={styles.progressSection}>
                            <View style={[
                                styles.progressTrack,
                                {
                                    backgroundColor: colors.backgroundSecondary,
                                    height: 8,
                                }
                            ]}>
                                <Animated.View
                                    style={[
                                        styles.progressFill,
                                        {
                                            backgroundColor: colors.primary,
                                            width: `${Math.max(5, progress)}%`,
                                            height: 8,
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
                                        {t('loading_messages.species_loaded', {count: loadedRecords})}
                                    </Text>
                                )}
                            </View>
                        </View>

                        <Text style={[typography.bodySmall, { color: colors.textTertiary, textAlign: 'center' }]}>
                            {t('loading_messages.building_database')}
                        </Text>
                    </View>

                    {/* Loading Hint */}
                    <Text style={[typography.label, { color: colors.textTertiary, textAlign: 'center' }]}>
                        {t('loading_messages.first_launch_hint')}
                    </Text>
                </View>
            </Animated.View>
        );
    }

    return null;
}

/**
 * App initialization loading screen
 * 
 * @param props.message - Loading message to display
 * @param props.error - Error message if initialization failed
 * @param props.onRetry - Retry callback for error state
 */
function AppInitializationScreen({ message, error, onRetry }: {
    message: string;
    error?: string;
    onRetry?: () => void;
}) {
    const { t } = useTranslation();
    const colors = useColors();
    const typography = useTypography();

    if (error) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
                <View style={styles.errorContent}>
                    <View style={[
                        styles.errorIconContainer,
                        {
                            backgroundColor: colors.backgroundSecondary,
                            width: 96,
                            height: 96,
                            borderRadius: 48,
                        }
                    ]}>
                        <ThemedIcon name="x" size={48} color="error" />
                    </View>

                    <Text style={[typography.h2, { color: colors.text }]}>
                        {t('loading_messages.init_failed')}
                    </Text>

                    <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center' }]}>
                        {error}
                    </Text>

                    {onRetry && (
                        <Pressable
                            style={[
                                styles.retryButton,
                                {
                                    backgroundColor: colors.primary,
                                    height: 48,
                                    paddingHorizontal: 24,
                                }
                            ]}
                            onPress={onRetry}
                            accessibilityRole="button"
                            accessibilityLabel="Try initialization again"
                            accessibilityHint="Attempts to restart the app initialization process"
                        >
                            <ThemedIcon name="refresh-cw" size={16} color="secondary" />
                            <Text style={[typography.label, { color: colors.textInverse }]}>
                                {t('buttons.try_again')}
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

/**
 * Root layout component with theme provider and ML model initialization
 */
export default function RootLayout() {
    const { t } = useTranslation();
    const theme = useTheme();
    const colors = useColors();
    const typography = useTypography();
    const shadows = useShadows();
    const [loaded] = useFonts(FONTS);
    // Remove segments for now cause the cause the navigation resets
    // const segments = useSegments();
    // const router = useRouter();

    // Application state
    const [localDbReady, setLocalDbReady] = useState(false);
    const [localDbError, setLocalDbError] = useState<string | null>(null);
    const [birdDexReady, setBirdDexReady] = useState(false);
    const [offlineModelReady, setOfflineModelReady] = useState(false);
    const [retryCount, setRetryCount] = useState(0);

    // Static screen options to prevent navigation resets
    const getScreenOptions = useCallback((): NativeStackNavigationOptions => ({
        headerStyle: {
            backgroundColor: colors.backgroundSecondary,
            ...shadows.sm,
        },
        headerTransparent: false,
        headerTintColor: colors.text,
        headerTitleStyle: {
            fontSize: typography.h2.fontSize,
            fontWeight: '600' as const,
            color: colors.text,
        },
        headerBackTitleVisible: false,
        headerLeft: () => (
            <ThemedIcon name="arrow-left" size={24} color="primary" />
        ),
    }), [colors, shadows, typography]);

    // ML Models setup with useMemo to prevent recreation
    const objectDetectionConfig = useMemo(() => ({
        assets: MODELS_OBJECT,
        loadDefaultModel: true,
        defaultModelOptions: {
            shouldEnableMultipleObjects: true,
            shouldEnableClassification: true,
            detectorMode: 'singleImage' as const,
        },
    }), []);

    // Initialize models with memoization
    const models_class = useImageLabelingModels(MODELS_CLASS);
    const { ImageLabelingModelProvider } = useImageLabelingProvider(models_class);

    const models = useObjectDetectionModels<typeof MODELS_OBJECT>(objectDetectionConfig);
    const { ObjectDetectionProvider } = useObjectDetectionProvider(models);

    // Log initialization only once
    useEffect(() => {
        if (models_class && models) {
            console.log('[ML Models] Image labeling models initialized:', !!models_class);
            console.log('[ML Models] Object detection models initialized:', !!models);
        }
    }, [models_class, models]);

    // Initialize local database
    useEffect(() => {
        const initializeLocalDB = async () => {
            try {
                console.log('[Database] Starting local database initialization...');
                await initDB();
                console.log('[Database] Local database initialized successfully (bird_spottings table created)');
                
                // Add a small delay for Android to ensure database is fully ready
                if (Platform.OS === 'android') {
                    console.log('[Database] Android detected - adding 100ms delay for database stability');
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
                
                setLocalDbReady(true);
                setLocalDbError(null);
            } catch (error) {
                console.error('[Database] Local DB initialization failed:', error);
                if (error instanceof Error) {
                    console.error('[Database] Error details:', {
                        name: error.name,
                        message: error.message,
                        stack: error.stack,
                    });
                }
                setLocalDbError(error instanceof Error ? error.message : t('loading_messages.failed_initialize_local_database'));
                
                // On Android, retry once after a delay
                if (Platform.OS === 'android' && retryCount === 0) {
                    console.log('[Database] Android: Retrying database initialization in 500ms...');
                    setTimeout(() => setRetryCount(1), 500);
                } else {
                    setLocalDbReady(true); // Allow app to continue even with error
                }
            }
        };

        initializeLocalDB();
    }, [retryCount]);

    // Initialize offline bird classification model
    useEffect(() => {
        const initializeOfflineModel = async () => {
            try {
                console.log('Initializing offline bird classification model...');
                await AudioIdentificationService.initialize();
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
        let message = t('loading_messages.loading_application');
        if (!loaded) {
            message = t('loading_messages.loading_fonts_assets');
        } else if (!localDbReady) {
            message = t('loading_messages.initializing_local_db');
        } else if (!offlineModelReady) {
            message = t('loading_messages.loading_ai_models');
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

    // Show bird database loading screen (only after local DB is ready)
    if (!birdDexReady) {
        return (
            <ImageLabelingModelProvider>
                <ObjectDetectionProvider>
                    <DatabaseLoadingScreen 
                        onReady={() => setBirdDexReady(true)} 
                        localDbReady={localDbReady}
                    />
                    <StatusBar style="auto" />
                </ObjectDetectionProvider>
            </ImageLabelingModelProvider>
        );
    }

    // Main app with enhanced theming
    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaProvider>
                <AuthProvider>
                    <ThemeProvider
                        value={{
                            dark: colors.isDark,
                            colors: {
                                notification: colors.primary,
                                background: colors.background,
                                card: colors.backgroundSecondary,
                                text: colors.text,
                                border: colors.border,
                                primary: colors.primary,
                            },
                        }}
                    >
                        <ImageLabelingModelProvider>
                            <ObjectDetectionProvider>
                                <View style={[styles.container, { backgroundColor: colors.background }]}>
                                    <Stack screenOptions={getScreenOptions}>
                                        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                                        <Stack.Screen name="log" options={{ headerShown: false }} />
                                        <Stack.Screen name="+not-found" />
                                    </Stack>
                                </View>
                                <StatusBar style="auto" />
                            </ObjectDetectionProvider>
                        </ImageLabelingModelProvider>
                    </ThemeProvider>
                </AuthProvider>
            </SafeAreaProvider>
        </GestureHandlerRootView>
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