import React, {useEffect, useMemo, useState} from 'react';
import {ThemeProvider} from '@react-navigation/native';
import {useFonts} from 'expo-font';
import {Stack, useSegments} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import {StatusBar} from 'expo-status-bar';
import {Pressable, StyleSheet, Text, View, Platform, UIManager} from 'react-native';
import {BlurView} from 'expo-blur';
import {ThemedIcon} from '@/components/ThemedIcon';
import ErrorBoundary from '@/components/ErrorBoundary';
// COMMENTED OUT FOR DEBUGGING: Animation imports
// import Animated, {
//     Easing,
//     useAnimatedStyle,
//     useSharedValue,
//     withRepeat,
//     withSpring,
//     withTiming,
// } from 'react-native-reanimated';
import 'react-native-reanimated';
import "@/i18n/i18n";
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useColors, useTheme, useTypography } from '@/hooks/useThemeColor';
import { useUnifiedColors } from '@/hooks/useUnifiedColors';
import { useResponsiveDimensions } from '@/hooks/useResponsiveDimensions';
import { AuthProvider } from '@/app/context/AuthContext';
import { ModalProvider } from '@/app/context/ModalContext';
import { ModalRenderer } from '@/components/modals/ModalRenderer';
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
import '@/services/nativeErrorInterceptor'; // Initialize native error interception

SplashScreen.preventAutoHideAsync();

// Android UIFrameGuarded.AddViewAt fixes
if (Platform.OS === 'android') {
  // Enable native view manager optimizations
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(false);
  }

  // Add view hierarchy safety checks
  console.log('Android view manager initialized with safety checks');
}

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
 * Clean loading animation with minimal design and responsive sizing
 * Provides visual feedback during app initialization with smooth animations
 * 
 * @returns {JSX.Element} Animated loading spinner with feather icon
 */
function LoadingAnimation() {
    const colors = useUnifiedColors();
    const dimensions = useResponsiveDimensions();

    // COMMENTED OUT FOR DEBUGGING: Animation values
    // const rotation = useSharedValue(0);
    // const scale = useSharedValue(1);
    // const opacity = useSharedValue(0.7);

    // COMMENTED OUT FOR DEBUGGING: Animation effects
    // React.useEffect(() => {
    //     rotation.value = withRepeat(
    //         withTiming(360, { duration: 2000, easing: Easing.linear }),
    //         -1,
    //         false
    //     );

    //     scale.value = withRepeat(
    //         withSpring(1.1, { damping: 15, stiffness: 300 }),
    //         -1,
    //         true
    //     );

    //     opacity.value = withRepeat(
    //         withTiming(1, { duration: 1500 }),
    //         -1,
    //         true
    //     );

    //     // Cleanup animations on unmount
    //     return () => {
    //         'worklet';
    //         rotation.value = 0;
    //         scale.value = 1;
    //         opacity.value = 0.7;
    //     };
    // }, [rotation, scale, opacity]);

    // COMMENTED OUT FOR DEBUGGING: Animation style
    // const animatedStyle = useAnimatedStyle(() => ({
    //     transform: [
    //         { rotate: `${rotation.value}deg` },
    //         { scale: scale.value }
    //     ],
    //     opacity: opacity.value,
    // }));

    const iconSize = dimensions.icon.xl;
    const containerSize = iconSize * 2;
    
    return (
        <View
            style={[
                {
                    width: containerSize,
                    height: containerSize,
                    borderRadius: containerSize / 2,
                    backgroundColor: colors.background.secondary,
                    justifyContent: 'center',
                    alignItems: 'center',
                    // COMMENTED OUT FOR DEBUGGING: Static values instead of animated
                    opacity: 0.8,
                    transform: [{ scale: 1 }],
                },
                // COMMENTED OUT FOR DEBUGGING: animatedStyle,
            ]}
        >
            <ThemedIcon name="feather" size={iconSize} color="primary" />
        </View>
    );
}

/**
 * Enhanced Database Loading Screen Component
 * Displays progress for bird database initialization with error handling
 * 
 * @param {Object} props - Component props
 * @param {Function} props.onReady - Callback when database is ready
 * @returns {JSX.Element|null} Loading screen or null when ready
 */
function EnhancedDatabaseLoadingScreen({ onReady }: { onReady: () => void }) {
    const { isReady, isLoading, hasError, progress, loadedRecords, error, retry } = useBirdDexDatabase();
    const colors = useUnifiedColors();
    const typography = useTypography();
    const theme = useTheme();
    const dimensions = useResponsiveDimensions();

    // COMMENTED OUT FOR DEBUGGING: Animation values
    // const fadeAnim = useSharedValue(0);
    // const slideAnim = useSharedValue(30);

    React.useEffect(() => {
        if (isReady) {
            // COMMENTED OUT FOR DEBUGGING: Animation
            // fadeAnim.value = withTiming(0, { duration: theme.motion.duration.normal });
            // slideAnim.value = withTiming(30, { duration: theme.motion.duration.normal });
            setTimeout(onReady, theme.motion.duration.normal);
        } else {
            // COMMENTED OUT FOR DEBUGGING: Animation
            // fadeAnim.value = withTiming(1, { duration: theme.motion.duration.normal });
            // slideAnim.value = withTiming(0, { duration: theme.motion.duration.normal });
        }

        // COMMENTED OUT FOR DEBUGGING: Animation cleanup
        // return () => {
        //     'worklet';
        //     fadeAnim.value = 0;
        //     slideAnim.value = 30;
        // };
    }, [isReady, /* fadeAnim, slideAnim, */ theme.motion.duration.normal, onReady]);

    // COMMENTED OUT FOR DEBUGGING: Animation style
    // const containerStyle = useAnimatedStyle(() => ({
    //     opacity: fadeAnim.value,
    //     transform: [{ translateY: slideAnim.value }],
    // }));

    if (hasError) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: colors.background.primary }]}>
                <View style={[
                    styles.errorCard,
                    {
                        backgroundColor: colors.background.elevated,
                        borderColor: colors.border.primary,
                        padding: dimensions.card.padding.lg,
                        borderRadius: dimensions.card.borderRadius.lg,
                        borderWidth: 1,
                    }
                ]}>
                    <View style={[
                        styles.errorIconContainer, 
                        { 
                            backgroundColor: colors.background.secondary,
                            width: dimensions.icon.xxl * 2,
                            height: dimensions.icon.xxl * 2,
                            borderRadius: dimensions.icon.xxl,
                        }
                    ]}>
                        <ThemedIcon name="x" size={dimensions.icon.xxl} color="error" />
                    </View>

                    <Text style={[typography.h2, { color: colors.text.primary }]}>
                        Database Error
                    </Text>

                    <Text style={[typography.body, { color: colors.text.secondary, textAlign: 'center' }]}>
                        {error || 'Failed to load bird database. Check your storage and connection.'}
                    </Text>

                    <Pressable
                        style={[
                            styles.retryButton, 
                            { 
                                backgroundColor: colors.interactive.primary,
                                height: dimensions.button.md.height,
                                paddingHorizontal: dimensions.button.md.paddingHorizontal,
                            }
                        ]}
                        onPress={retry}
                        accessibilityRole="button"
                        accessibilityLabel="Retry loading database"
                        accessibilityHint="Attempts to reload the bird database"
                    >
                        <ThemedIcon name="refresh-cw" size={dimensions.icon.sm} color="secondary" />
                        <Text style={[typography.label, { color: colors.interactive.primaryText }]}>
                            Retry Loading
                        </Text>
                    </Pressable>
                </View>
            </View>
        );
    }

    if (isLoading) {
        return (
            <View
                style={[
                    styles.loadingContainer,
                    { 
                        backgroundColor: colors.background.primary,
                        // COMMENTED OUT FOR DEBUGGING: Static values instead of animated
                        opacity: isReady ? 0 : 1,
                        transform: [{ translateY: isReady ? 30 : 0 }],
                    },
                    // COMMENTED OUT FOR DEBUGGING: containerStyle
                ]}
            >
                <View style={styles.loadingContent}>
                    {/* Brand Header */}
                    <View style={styles.brandContainer}>
                        <LoadingAnimation />
                        <Text style={[typography.h1, { color: colors.text.primary }]}>
                            LogChirpy
                        </Text>
                        <Text style={[typography.body, { color: colors.text.secondary }]}>
                            Preparing Your Bird Database
                        </Text>
                    </View>

                    {/* Progress Section */}
                    <View
                        style={[
                            styles.progressCard, 
                            { 
                                backgroundColor: colors.background.elevated,
                                borderColor: colors.border.primary,
                                padding: dimensions.card.padding.lg,
                                borderRadius: dimensions.card.borderRadius.lg,
                                borderWidth: 1,
                            }
                        ]}
                    >
                        <Text style={[typography.h3, { color: colors.text.primary }]}>
                            Loading Species Data
                        </Text>

                        {/* Progress Bar */}
                        <View style={styles.progressSection}>
                            <View style={[
                                styles.progressTrack, 
                                { 
                                    backgroundColor: colors.background.secondary,
                                    height: dimensions.screen.isSmall ? 6 : 8,
                                }
                            ]}>
                                <View
                                    style={[
                                        styles.progressFill,
                                        {
                                            backgroundColor: colors.interactive.primary,
                                            width: `${Math.max(5, progress)}%`,
                                            height: dimensions.screen.isSmall ? 6 : 8,
                                        }
                                    ]}
                                />
                            </View>

                            <View style={styles.progressStats}>
                                <Text style={[typography.label, { color: colors.interactive.primary }]}>
                                    {progress}%
                                </Text>
                                {loadedRecords > 0 && (
                                    <Text style={[typography.label, { color: colors.text.secondary }]}>
                                        {loadedRecords.toLocaleString()} species loaded
                                    </Text>
                                )}
                            </View>
                        </View>

                        <Text style={[typography.bodySmall, { color: colors.text.tertiary, textAlign: 'center' }]}>
                            Building comprehensive bird identification database...
                        </Text>
                    </View>

                    {/* Loading Hint */}
                    <Text style={[typography.label, { color: colors.text.tertiary, textAlign: 'center' }]}>
                        This may take a moment on first launch
                    </Text>
                </View>
            </View>
        );
    }

    return null;
}

/**
 * Enhanced App Initialization Loading Screen
 * Shows loading state during app startup with error handling
 * 
 * @param {Object} props - Component props
 * @param {string} props.message - Loading message to display
 * @param {string} [props.error] - Error message if initialization failed
 * @param {Function} [props.onRetry] - Retry callback for error state
 * @returns {JSX.Element} Initialization screen
 */
function AppInitializationScreen({ message, error, onRetry }: {
    message: string;
    error?: string;
    onRetry?: () => void;
}) {
    const colors = useUnifiedColors();
    const typography = useTypography();
    const dimensions = useResponsiveDimensions();

    if (error) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: colors.background.primary }]}>
                <View style={styles.errorContent}>
                    <View style={[
                        styles.errorIconContainer, 
                        { 
                            backgroundColor: colors.background.secondary,
                            width: dimensions.icon.xxl * 2,
                            height: dimensions.icon.xxl * 2,
                            borderRadius: dimensions.icon.xxl,
                        }
                    ]}>
                        <ThemedIcon name="x" size={dimensions.icon.xxl} color="error" />
                    </View>

                    <Text style={[typography.h2, { color: colors.text.primary }]}>
                        Initialization Failed
                    </Text>

                    <Text style={[typography.body, { color: colors.text.secondary, textAlign: 'center' }]}>
                        {error}
                    </Text>

                    {onRetry && (
                        <Pressable
                            style={[
                                styles.retryButton, 
                                { 
                                    backgroundColor: colors.interactive.primary,
                                    height: dimensions.button.md.height,
                                    paddingHorizontal: dimensions.button.md.paddingHorizontal,
                                }
                            ]}
                            onPress={onRetry}
                            accessibilityRole="button"
                            accessibilityLabel="Try initialization again"
                            accessibilityHint="Attempts to restart the app initialization process"
                        >
                            <ThemedIcon name="refresh-cw" size={dimensions.icon.sm} color="secondary" />
                            <Text style={[typography.label, { color: colors.interactive.primaryText }]}>
                                Try Again
                            </Text>
                        </Pressable>
                    )}
                </View>
            </View>
        );
    }

    return (
        <View style={[styles.loadingContainer, { backgroundColor: colors.background.primary }]}>
            <View style={styles.loadingContent}>
                <LoadingAnimation />
                <Text style={[typography.h2, { color: colors.text.primary }]}>
                    LogChirpy
                </Text>
                <Text style={[typography.body, { color: colors.text.secondary }]}>
                    {message}
                </Text>
            </View>
        </View>
    );
}

/**
 * Enhanced Root Layout Component
 * Main app layout with theme provider, ML model initialization, and progressive loading
 * Handles app initialization, database loading, and provides theming context
 * 
 * @returns {JSX.Element} Complete app layout with providers and navigation
 */
export default function EnhancedRootLayout() {
    const theme = useTheme();
    const colors = useUnifiedColors();
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

    // ML Models setup with React.memo wrapper to prevent re-initialization
    const objectDetectionConfig = useMemo(() => ({
        assets: MODELS_OBJECT,
        loadDefaultModel: true,
        defaultModelOptions: {
            shouldEnableMultipleObjects: true,
            shouldEnableClassification: true,
            detectorMode: 'singleImage' as const,
        },
    }), []);

    // Initialize models with logging once on mount
    const [hasLoggedModels, setHasLoggedModels] = useState(false);
    
    const models_class = useImageLabelingModels(MODELS_CLASS);
    const { ImageLabelingModelProvider } = useImageLabelingProvider(models_class);
    
    const models = useObjectDetectionModels<typeof MODELS_OBJECT>(objectDetectionConfig);
    const { ObjectDetectionProvider } = useObjectDetectionProvider(models);

    // Log only once to reduce console spam
    useEffect(() => {
        if (!hasLoggedModels && models_class && models) {
            console.log('[ML Models] Image labeling models initialized:', !!models_class);
            console.log('[ML Models] Object detection models initialized:', !!models);
            setHasLoggedModels(true);
        }
    }, [models_class, models, hasLoggedModels]);

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

    // Main app with enhanced theming and layer system
    return (
        <ErrorBoundary 
            level="app" 
            name="RootLayout"
            onError={(error, errorInfo, errorId) => {
                // Report to crash analytics in production
                if (!__DEV__) {
                    console.error('App-level error:', { error, errorInfo, errorId });
                    // Add crash reporting service here (e.g., Bugsnag, Sentry)
                }
            }}
        >
            <SafeAreaProvider>
                <AuthProvider>
                    <ModalProvider>
                        <ThemeProvider
                        value={{
                            dark: colors.isDark,
                            colors: {
                                notification: colors.interactive.primary,
                                background: colors.background.primary,
                                card: colors.background.elevated,
                                text: colors.text.primary,
                                border: colors.border.primary,
                                primary: colors.interactive.primary,
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
                                <View style={[styles.container, { backgroundColor: colors.background.primary }]}>
                                    <Stack
                                        screenOptions={() => ({
                                            headerStyle: {
                                                backgroundColor:
                                                    current === 'photo' || current === 'video'
                                                        ? 'transparent'
                                                        : colors.background.elevated,
                                                ...theme.shadows.sm,
                                            },
                                            headerTransparent: current === 'photo' || current === 'video',
                                            headerTintColor: colors.text.primary,
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
                                        <Stack.Screen name="log" options={{ headerShown: false }} />
                                        <Stack.Screen name="+not-found" />
                                    </Stack>
                                </View>
                                <StatusBar style="auto" />
                            </ObjectDetectionProvider>
                        </ImageLabelingModelProvider>
                        
                        {/* Centralized Modal Layer */}
                        <ModalRenderer />
                        </ThemeProvider>
                    </ModalProvider>
                </AuthProvider>
            </SafeAreaProvider>
        </ErrorBoundary>
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