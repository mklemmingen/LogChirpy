import React, { useEffect } from 'react';
import { ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme, View, StyleSheet } from 'react-native';
import 'react-native-reanimated';
import "@/i18n/i18n";
import { theme } from '@/constants/theme';

import {
    useObjectDetectionModels,
    useObjectDetectionProvider,
    ObjectDetectionConfig
} from '@infinitered/react-native-mlkit-object-detection';

SplashScreen.preventAutoHideAsync();

const MODELS: ObjectDetectionConfig = {
    mobilenetFloat: {
        model: require('../assets/models/mobilenet_float_v1_224.tflite'),
    },
    mobilenetQuant: {
        model: require('../assets/models/mobilenet_quant_v1_224.tflite'),
    },
    mobilenetV2Quant: {
        model: require('../assets/models/mobilenet_v2_1.0_224_quant.tflite'),
    },
};
export type MyModelsConfig = typeof MODELS;

export default function RootLayout() {
    const colorScheme = useColorScheme() ?? 'light';
    const currentTheme = theme[colorScheme];

    // Load custom fonts
    const [loaded] = useFonts({
        SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    });

    useEffect(() => {
        if (loaded) {
            SplashScreen.hideAsync();
        }
    }, [loaded]);

    if (!loaded) {
        return null;
    }

    const models = useObjectDetectionModels<MyModelsConfig>({
        assets: MODELS,
        loadDefaultModel: true,
        defaultModelOptions: {
            shouldEnableMultipleObjects: true,
            shouldEnableClassification: true,
            detectorMode: 'stream',
        },
    });
    const { ObjectDetectionProvider } = useObjectDetectionProvider(models);

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
            <ObjectDetectionProvider>
                <View style={styles.container}>
                    <View style={styles.content}>
                        <Stack
                            screenOptions={{
                                headerStyle: {
                                    backgroundColor: currentTheme.colors.background,
                                },
                                headerTintColor: currentTheme.colors.text.primary,
                                headerTitleStyle: {
                                    fontWeight: 'bold',
                                },
                            }}
                        >
                            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                            <Stack.Screen name="+not-found" />
                        </Stack>
                    </View>
                </View>
                <StatusBar style="auto" />
            </ObjectDetectionProvider>
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
