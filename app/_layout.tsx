// app/_layout.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, useColorScheme, View, Text, ActivityIndicator, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import 'react-native-reanimated';
import "@/i18n/i18n";

import { theme } from '@/constants/theme';
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

// ML Models Configuration
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

// Database Loading Screen Component
function DatabaseLoadingScreen({ onReady }: { onReady: () => void }) {
    const { isReady, isLoading, hasError, progress, loadedRecords, error, retry } = useBirdDexDatabase();
    const colorScheme = useColorScheme() ?? 'light';
    const pal = theme[colorScheme];

    React.useEffect(() => {
        if (isReady) {
            onReady();
        }
    }, [isReady, onReady]);

    if (hasError) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: pal.colors.background }]}>
                <View style={styles.errorContainer}>
                    <Feather name="alert-triangle" size={64} color={pal.colors.error} />
                    <Text style={[styles.errorTitle, { color: pal.colors.text.primary }]}>
                        Database Error
                    </Text>
                    <Text style={[styles.errorMessage, { color: pal.colors.text.secondary }]}>
                        {error || 'Failed to load bird database'}
                    </Text>
                    <Pressable
                        style={[styles.retryButton, { backgroundColor: pal.colors.primary }]}
                        onPress={retry}
                    >
                        <Feather name="refresh-cw" size={18} color={pal.colors.text.onPrimary} />
                        <Text style={[styles.retryText, { color: pal.colors.text.onPrimary }]}>
                            Retry
                        </Text>
                    </Pressable>
                </View>
            </View>
        );
    }

    if (isLoading) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: pal.colors.background }]}>
                <View style={styles.loadingContent}>
                    {/* App Logo */}
                    <View style={styles.logoContainer}>
                        <Feather name="feather" size={64} color={pal.colors.primary} />
                    </View>

                    <Text style={[styles.loadingTitle, { color: pal.colors.text.primary }]}>
                        LogChirpy
                    </Text>

                    <Text style={[styles.loadingSubtitle, { color: pal.colors.text.secondary }]}>
                        Loading Bird Database
                    </Text>

                    {/* Progress Indicator */}
                    <View style={styles.progressContainer}>
                        <ActivityIndicator size="large" color={pal.colors.primary} />

                        {loadedRecords > 0 && (
                            <Text style={[styles.progressDetail, { color: pal.colors.text.secondary }]}>
                                {loadedRecords.toLocaleString()} species loaded
                            </Text>
                        )}

                        {/* Progress Bar */}
                        <View style={[styles.progressBar, { backgroundColor: pal.colors.border }]}>
                            <View
                                style={[
                                    styles.progressFill,
                                    {
                                        backgroundColor: pal.colors.primary,
                                        width: `${Math.max(5, progress)}%` // Minimum 5% for visual feedback
                                    }
                                ]}
                            />
                        </View>

                        <Text style={[styles.progressText, { color: pal.colors.text.primary }]}>
                            {progress}%
                        </Text>
                    </View>

                    {/* Helpful Info */}
                    <Text style={[styles.loadingInfo, { color: pal.colors.text.tertiary }]}>
                        Preparing comprehensive bird species database...
                    </Text>
                </View>
            </View>
        );
    }

    return null;
}

export default function RootLayout() {
    const colorScheme = useColorScheme() ?? 'light';
    const currentTheme = theme[colorScheme];
    const [loaded] = useFonts(FONTS);
    const segments = useSegments();
    const current = segments[segments.length - 1];

    // Application state
    const [localDbReady, setLocalDbReady] = useState(false);
    const [localDbError, setLocalDbError] = useState<string | null>(null);
    const [birdDexReady, setBirdDexReady] = useState(false);

    // ML Models setup
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

    // Initialize local database (bird_spottings)
    useEffect(() => {
        const initializeLocalDB = async () => {
            try {
                await initDB();
                setLocalDbReady(true);
            } catch (error) {
                console.error('Local DB initialization failed:', error);
                setLocalDbError(error instanceof Error ? error.message : 'Failed to initialize local database');
                setLocalDbReady(true); // Allow app to continue even if local DB fails
            }
        };

        initializeLocalDB();
    }, []);

    // Hide splash screen when fonts and local database are ready
    useEffect(() => {
        if (loaded && localDbReady) {
            SplashScreen.hideAsync();
        }
    }, [loaded, localDbReady]);

    // Show loading screen while essential components are initializing
    if (!loaded || !localDbReady) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: currentTheme.colors.background }]}>
                <ActivityIndicator size="large" color={currentTheme.colors.primary} />
                <Text style={[styles.initializingText, { color: currentTheme.colors.text.secondary }]}>
                    Initializing LogChirpy...
                </Text>
                {localDbError && (
                    <Text style={[styles.errorText, { color: currentTheme.colors.error }]}>
                        Warning: {localDbError}
                    </Text>
                )}
            </View>
        );
    }

    // Show bird database loading screen
    if (!birdDexReady) {
        return (
            <ImageLabelingModelProvider>
                <ObjectDetectionProvider>
                    <DatabaseLoadingScreen onReady={() => setBirdDexReady(true)} />
                    <StatusBar style="auto" />
                </ObjectDetectionProvider>
            </ImageLabelingModelProvider>
        );
    }

    // Main app is ready
    return (
        <ThemeProvider
            value={{
                dark: colorScheme === 'dark',
                colors: {
                    notification: currentTheme.colors.secondary,
                    background: currentTheme.colors.background,
                    card: currentTheme.colors.accent,
                    text: currentTheme.colors.text.primary,
                    border: currentTheme.colors.border,
                    primary: currentTheme.colors.primary,
                },
                fonts: {
                    regular: {
                        fontFamily: 'SpaceMono',
                        fontWeight: 'normal',
                    },
                    medium: {
                        fontFamily: 'SpaceMono',
                        fontWeight: '500',
                    },
                    bold: {
                        fontFamily: 'SpaceMono',
                        fontWeight: 'bold',
                    },
                    heavy: {
                        fontFamily: 'SpaceMono',
                        fontWeight: '800',
                    },
                },
            }}
        >
            <ImageLabelingModelProvider>
                <ObjectDetectionProvider>
                    <View style={styles.container}>
                        <View style={styles.content}>
                            <Stack
                                screenOptions={() => ({
                                    headerStyle: {
                                        backgroundColor:
                                            current === 'photo' || current === 'video'
                                                ? 'transparent'
                                                : currentTheme.colors.background,
                                    },
                                    headerTransparent: current === 'photo' || current === 'video',
                                    headerTintColor: currentTheme.colors.text.primary,
                                    headerTitleStyle: {
                                        fontWeight: 'bold',
                                    },
                                })}
                            >
                                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                                <Stack.Screen name="+not-found" />
                            </Stack>
                        </View>
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
    content: {
        flex: 1,
        position: 'relative',
    },

    // Loading States
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: theme.spacing.xl,
    },
    loadingContent: {
        alignItems: 'center',
        maxWidth: 320,
        width: '100%',
    },
    logoContainer: {
        marginBottom: theme.spacing.xl,
    },
    loadingTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: theme.spacing.sm,
        textAlign: 'center',
    },
    loadingSubtitle: {
        fontSize: 16,
        textAlign: 'center',
        marginBottom: theme.spacing.xl,
    },
    initializingText: {
        fontSize: 16,
        marginTop: theme.spacing.md,
        textAlign: 'center',
    },

    // Progress Indicators
    progressContainer: {
        alignItems: 'center',
        width: '100%',
        gap: theme.spacing.md,
    },
    progressDetail: {
        fontSize: 14,
        textAlign: 'center',
    },
    progressBar: {
        width: '100%',
        height: 6,
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 3,
    },
    progressText: {
        fontSize: 18,
        fontWeight: '600',
    },
    loadingInfo: {
        fontSize: 12,
        textAlign: 'center',
        marginTop: theme.spacing.lg,
        fontStyle: 'italic',
    },

    // Error States
    errorContainer: {
        alignItems: 'center',
        maxWidth: 320,
    },
    errorTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        marginTop: theme.spacing.lg,
        marginBottom: theme.spacing.sm,
        textAlign: 'center',
    },
    errorMessage: {
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: theme.spacing.xl,
    },
    errorText: {
        fontSize: 14,
        marginTop: theme.spacing.sm,
        textAlign: 'center',
    },
    retryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: theme.spacing.md,
        paddingHorizontal: theme.spacing.lg,
        borderRadius: theme.borderRadius.lg,
        gap: theme.spacing.sm,
    },
    retryText: {
        fontSize: 16,
        fontWeight: '600',
    },
});