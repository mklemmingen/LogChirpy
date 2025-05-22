import React, { useEffect, useMemo, useState } from 'react';
import { ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme, View, StyleSheet } from 'react-native';
import 'react-native-reanimated';
import "@/i18n/i18n";
import { theme } from '@/constants/theme';
import {
    useImageLabeling,
    useImageLabelingProvider,
    useImageLabelingModels,
    ImageLabelingConfig,
    ClassificationResult
} from "@infinitered/react-native-mlkit-image-labeling";

import {
    useObjectDetectionModels,
    useObjectDetectionProvider,
    ObjectDetectionConfig
} from '@infinitered/react-native-mlkit-object-detection';

// BirDex Database loaded at startup
import { initDB, insertTestSpotting } from '@/services/database';
import { initBirdDexDB } from '@/services/databaseBirDex';

SplashScreen.preventAutoHideAsync();

const MODELS_OBJECT: ObjectDetectionConfig = {
    ssdmobilenetV1: {
        model: require('../assets/models/ssd_mobilenet_v1_metadata.tflite'),
        options: {
            shouldEnableMultipleObjects: true,
            shouldEnableClassification: false,       // turn on labels
            classificationConfidenceThreshold: 0.3, // only show labels over 30%
            maxPerObjectLabelCount: 1
        }
    },
    efficientNetlite0int8: {
        model: require('../assets/models/efficientnet-lite0-int8.tflite'),
        options: {
            shouldEnableMultipleObjects: true,
            shouldEnableClassification: false,       // turn on labels
            classificationConfidenceThreshold: 0.3, // only show labels over 30%
            maxPerObjectLabelCount: 1
        }
    },
};
export type MyModelsConfig = typeof MODELS_OBJECT;

const MODELS_CLASS: ImageLabelingConfig = {
    birdClassifier: {
        model: require("../assets/models/birds_mobilenetv2/bird_classifier_metadata.tflite"),
        // labels: require("../assets/models/birds_mobilenetv2/labels.txt"),
        options: {
            confidenceThreshold: 0.5, // filter out low-score guesses
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
    // last segment is e.g. 'photo', 'video', 'manual', etc.
    const current = segments[segments.length - 1]

    // Image Labeling
    const models_class = useImageLabelingModels(MODELS_CLASS);
    const { ImageLabelingModelProvider } = useImageLabelingProvider(models_class);

    // Database BirDex
    const [isDbReady, setIsDbReady] = useState(false);

    // Object Detection
    const models = useObjectDetectionModels<MyModelsConfig>(useMemo(() => ({
        assets: MODELS_OBJECT,
        loadDefaultModel: true, // loads "mobilenetFloat"
        defaultModelOptions: {
            shouldEnableMultipleObjects: true,
            shouldEnableClassification: true,
            detectorMode: 'singleImage',
        },
    }), []));
    const { ObjectDetectionProvider } = useObjectDetectionProvider(models);

    // 1) Initialize both DBs on mount
    useEffect(() => {
        (async () => {
            try {
                initDB();              // creates bird_spottings table
                insertTestSpotting(); // TODO REMOVE BEFORE PRODUCTION
                await initBirdDexDB(); // upserts birddex table
            } catch (e) {
                console.error('DB init error', e);
            } finally {
                setIsDbReady(true);
            }
        })();
    }, []);

    // 2) Once fonts _and_ DB are ready, hide the splash
    useEffect(() => {
        if (loaded && isDbReady) {
            SplashScreen.hideAsync();
        }
    }, [loaded, isDbReady]);

    // 3) Show nothing until both ready
    if (!loaded || !isDbReady) {
        return null;
    }

    return (
        <ThemeProvider
            value={{
                dark: colorScheme === 'dark',
                light: colorScheme === 'light',
                colors: {
                    notification: currentTheme.colors.active,
                    background: currentTheme.colors.background,
                    card: currentTheme.colors.accent,
                    text: currentTheme.colors.text.primary,
                    border: currentTheme.colors.border,
                    primary: currentTheme.colors.primary,
                },
                fonts: {
                    regular: 'SpaceMono',
                    medium: 'SpaceMono',
                    light: 'SpaceMono',
                    thin: 'SpaceMono',
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
    birdAnimation: {
        ...StyleSheet.absoluteFillObject,
        zIndex: -1,
    },
});
