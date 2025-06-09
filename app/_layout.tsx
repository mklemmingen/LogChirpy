import React, { useEffect, useState } from 'react';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { Platform, UIManager, View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Context and Services
import { AuthProvider } from '@/app/context/AuthContext';
import { CombinedMLProvider } from '@/app/context/CombinedMLProvider';
import { birdDexDB } from '@/services/databaseBirDex';

// Hooks and Utils
import { useBirdDexDatabase } from '@/hooks/useBirdDexDatabase';
import { useUnifiedColors } from '@/hooks/useUnifiedColors';
import { useTheme, useTypography } from '@/hooks/useThemeColor';
import { useResponsiveDimensions } from '@/hooks/useResponsiveDimensions';
import '@/i18n/i18n';
import '@/services/nativeErrorInterceptor';

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

// Android Fragment Lifecycle Optimizations
if (Platform.OS === 'android') {
    if (UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(false);
    }
    console.log('Android lifecycle optimizations enabled');
}

/**
 * Loading Animation Component
 */
function LoadingAnimation() {
    const colors = useUnifiedColors();
    const dimensions = useResponsiveDimensions();

    return (
        <View style={[
            styles.loadingIcon,
            {
                width: dimensions.icon.xxl * 1.5,
                height: dimensions.icon.xxl * 1.5,
                backgroundColor: colors.interactive.primary,
                borderRadius: dimensions.icon.xxl * 0.75,
            }
        ]}>
            <Text style={{ fontSize: 32, color: colors.interactive.primaryText }}>🐦</Text>
        </View>
    );
}

/**
 * Themed Icon Component
 */
function ThemedIcon({ name, size, color }: { name: string; size: number; color: string }) {
    const colors = useUnifiedColors();

    const iconMap: Record<string, string> = {
        'x': '✕',
        'refresh-cw': '↻',
        'alert-circle': '⚠️',
    };

    const colorMap: Record<string, string> = {
        error: colors.text.secondary || '#ef4444',
        secondary: colors.interactive.primaryText,
        primary: colors.text.primary,
    };

    return (
        <Text style={{
            fontSize: size,
            color: colorMap[color] || colors.text.primary,
            textAlign: 'center',
        }}>
            {iconMap[name] || '?'}
        </Text>
    );
}

/**
 * Enhanced Database Loading Screen Component
 */
function EnhancedDatabaseLoadingScreen({
                                           isVisible,
                                           loadingProgress,
                                           loadingStatus,
                                           error,
                                           onRetry
                                       }: {
    isVisible: boolean;
    loadingProgress: number;
    loadingStatus: string;
    error?: string;
    onRetry?: () => void;
}) {
    const colors = useUnifiedColors();
    const typography = useTypography();
    const dimensions = useResponsiveDimensions();
    const [loadedRecords, setLoadedRecords] = useState(0);

    // Extract record count from status
    useEffect(() => {
        const match = loadingStatus.match(/(\d+)\s+species/);
        if (match) {
            setLoadedRecords(parseInt(match[1], 10));
        }
    }, [loadingStatus]);

    if (!isVisible) return null;

    if (error) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: colors.background.primary }]}>
                <View style={[
                    styles.errorCard,
                    {
                        backgroundColor: colors.background.elevated,
                        borderColor: colors.border?.primary || colors.background.secondary,
                        padding: dimensions.card?.padding?.lg || 24,
                        borderRadius: dimensions.card?.borderRadius?.lg || 20,
                        borderWidth: 1,
                    }
                ]}>
                    <View style={[
                        styles.errorIconContainer,
                        {
                            backgroundColor: colors.background.secondary,
                            width: (dimensions.icon?.xxl || 32) * 2,
                            height: (dimensions.icon?.xxl || 32) * 2,
                            borderRadius: dimensions.icon?.xxl || 32,
                        }
                    ]}>
                        <ThemedIcon name="x" size={dimensions.icon?.xxl || 32} color="error" />
                    </View>

                    <Text style={[typography.h2, { color: colors.text.primary }]}>
                        Database Error
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
                                    height: dimensions.button?.md?.height || 48,
                                    paddingHorizontal: dimensions.button?.md?.paddingHorizontal || 24,
                                }
                            ]}
                            onPress={onRetry}
                            accessibilityRole="button"
                            accessibilityLabel="Retry loading database"
                        >
                            <ThemedIcon name="refresh-cw" size={dimensions.icon?.sm || 16} color="secondary" />
                            <Text style={[typography.label, { color: colors.interactive.primaryText }]}>
                                Retry Loading
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
                <View style={[
                    styles.progressCard,
                    {
                        backgroundColor: colors.background.elevated,
                        borderColor: colors.border?.primary || colors.background.secondary,
                        padding: dimensions.card?.padding?.lg || 24,
                        borderRadius: dimensions.card?.borderRadius?.lg || 20,
                        borderWidth: 1,
                    }
                ]}>
                    <Text style={[typography.h3, { color: colors.text.primary }]}>
                        Loading Species Data
                    </Text>

                    {/* Progress Bar */}
                    <View style={styles.progressSection}>
                        <View style={[
                            styles.progressTrack,
                            {
                                backgroundColor: colors.background.secondary,
                                height: dimensions.screen?.isSmall ? 6 : 8,
                            }
                        ]}>
                            <View
                                style={[
                                    styles.progressFill,
                                    {
                                        backgroundColor: colors.interactive.primary,
                                        width: `${Math.max(5, loadingProgress)}%`,
                                        height: dimensions.screen?.isSmall ? 6 : 8,
                                    }
                                ]}
                            />
                        </View>

                        <View style={styles.progressStats}>
                            <Text style={[typography.label, { color: colors.interactive.primary }]}>
                                {Math.round(loadingProgress)}%
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

/**
 * App Initialization Loading Screen
 */
function AppInitializationScreen({
                                     message,
                                     error,
                                     onRetry
                                 }: {
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
                            width: (dimensions.icon?.xxl || 32) * 2,
                            height: (dimensions.icon?.xxl || 32) * 2,
                            borderRadius: dimensions.icon?.xxl || 32,
                        }
                    ]}>
                        <ThemedIcon name="x" size={dimensions.icon?.xxl || 32} color="error" />
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
                                    height: dimensions.button?.md?.height || 48,
                                    paddingHorizontal: dimensions.button?.md?.paddingHorizontal || 24,
                                }
                            ]}
                            onPress={onRetry}
                            accessibilityRole="button"
                        >
                            <ThemedIcon name="refresh-cw" size={dimensions.icon?.sm || 16} color="secondary" />
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
 * Root Layout with Enhanced Loading Screens
 */
export default function RootLayout() {
    const colors = useUnifiedColors();
    const [retryCount, setRetryCount] = useState(0);

    // Font loading
    const [loaded] = useFonts({
        SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    });

    // Database initialization
    const {
        isLoading: isDatabaseLoading,
        error: databaseError,
        progress: databaseProgress,
        loadedRecords
    } = useBirdDexDatabase();

    // Splash screen management
    useEffect(() => {
        if (loaded && !isDatabaseLoading) {
            const timer = setTimeout(() => {
                SplashScreen.hideAsync();
            }, 150);

            return () => clearTimeout(timer);
        }
    }, [loaded, isDatabaseLoading]);

    const handleRetry = () => {
        setRetryCount(prev => prev + 1);
        birdDexDB.initialize();
    };

    // Font loading state
    if (!loaded) {
        return (
            <AppInitializationScreen
                message="Loading fonts and assets..."
            />
        );
    }

    // Database loading state
    if (isDatabaseLoading || databaseError) {
        return (
            <EnhancedDatabaseLoadingScreen
                isVisible={true}
                loadingProgress={databaseProgress || 0}
                loadingStatus={`Loading database... ${loadedRecords || 0} species loaded`}
                error={databaseError || undefined}
                onRetry={databaseError ? handleRetry : undefined}
            />
        );
    }

    // Main app
    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaProvider>
                <AuthProvider>
                    <CombinedMLProvider>
                        <View style={{ flex: 1, backgroundColor: colors.background.primary }}>
                            <StatusBar
                                style={colors.isDark ? 'light' : 'dark'}
                                backgroundColor={colors.background.elevated}
                            />

                            <Stack
                                screenOptions={{
                                    headerShown: false,
                                    animation: 'fade',
                                    gestureEnabled: true,
                                    fullScreenGestureEnabled: false,
                                    freezeOnBlur: true,
                                }}
                            >
                                <Stack.Screen
                                    name="(tabs)"
                                    options={{
                                        title: 'LogChirpy',
                                        headerShown: false,
                                    }}
                                />

                                <Stack.Screen
                                    name="log"
                                    options={{
                                        title: 'Log Bird Sighting',
                                        headerShown: false,
                                        presentation: 'modal',
                                        animation: 'slide_from_bottom',
                                    }}
                                />

                                <Stack.Screen
                                    name="+not-found"
                                    options={{
                                        title: 'Not Found',
                                        headerShown: false,
                                    }}
                                />
                            </Stack>
                        </View>
                    </CombinedMLProvider>
                </AuthProvider>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
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
    loadingIcon: {
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
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