import React, {useEffect, useMemo, useState} from 'react';
import {ThemeProvider} from '@react-navigation/native';
import {useFonts} from 'expo-font';
import {Stack, useSegments} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import {StatusBar} from 'expo-status-bar';
import {StyleSheet, useColorScheme, View, Alert} from 'react-native';
import 'react-native-reanimated';
import "@/i18n/i18n";
import {theme} from '@/constants/theme';
import DatabaseLoadingSplash from '@/components/DatabaseLoadingSplash';
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

SplashScreen.preventAutoHideAsync();

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
export type MyModelsConfig = typeof MODELS_OBJECT;

const MODELS_CLASS: ImageLabelingConfig = {
    birdClassifier: {
        model: require("../assets/models/birds_mobilenetv2/bird_classifier_metadata.tflite"),
        options: {
            confidenceThreshold: 0.5,
            maxResultCount: 5,
        },
    },
};
export type ClassModelsConfig = typeof MODELS_CLASS;

const FONTS = {
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
};

export default function RootLayout() {
    const colorScheme = useColorScheme() ?? 'light';
    const currentTheme = theme[colorScheme];
    const [loaded] = useFonts(FONTS);

    const segments = useSegments()
    const current = segments[segments.length - 1]

    // Database states
    const [isDbReady, setIsDbReady] = useState(false);
    const [isBirdDexReady, setIsBirdDexReady] = useState(false);
    const [showDatabaseLoading, setShowDatabaseLoading] = useState(true);
    const [dbError, setDbError] = useState<string | null>(null);

    // Image Labeling
    const models_class = useImageLabelingModels(MODELS_CLASS);
    const { ImageLabelingModelProvider } = useImageLabelingProvider(models_class);

    // Object Detection
    const models = useObjectDetectionModels<MyModelsConfig>(useMemo(() => ({
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
        (async () => {
            try {
                await initDB();
                setIsDbReady(true);
            } catch (e) {
                console.error('Local DB init error', e);
                setDbError('Failed to initialize local database');
            }
        })();
    }, []);

    // Handle database loading completion
    const handleDatabaseLoadingComplete = () => {
        setIsBirdDexReady(true);
        setShowDatabaseLoading(false);
    };

    // Handle database loading error
    const handleDatabaseLoadingError = (error: string) => {
        setDbError(error);
        setShowDatabaseLoading(false);
        Alert.alert(
            'Database Error',
            error,
            [
                { text: 'Retry', onPress: () => setShowDatabaseLoading(true) },
                { text: 'Continue', onPress: () => setIsBirdDexReady(true) }
            ]
        );
    };

    // Hide splash screen when everything is ready
    useEffect(() => {
        if (loaded && isDbReady && !showDatabaseLoading) {
            SplashScreen.hideAsync();
        }
    }, [loaded, isDbReady, showDatabaseLoading]);

    // Show loading screens
    if (!loaded || !isDbReady || showDatabaseLoading) {
        return (
            <DatabaseLoadingSplash
                onComplete={handleDatabaseLoadingComplete}
                onError={handleDatabaseLoadingError}
            />
        );
    }

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
});