import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    ActivityIndicator,
    Pressable,
    StyleSheet,
    useColorScheme,
    Animated,
    Dimensions
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/constants/theme';
import { useBirdDexDatabase } from '@/hooks/useBirdDexDatabase';

const { width } = Dimensions.get('window');

// Animated Bird Component
function AnimatedBird({ delay = 0 }: { delay?: number }) {
    const translateY = useRef(new Animated.Value(0)).current;
    const opacity = useRef(new Animated.Value(0.7)).current;
    const colorScheme = useColorScheme() ?? 'light';
    const pal = theme[colorScheme];

    useEffect(() => {
        const animateBird = () => {
            Animated.parallel([
                Animated.sequence([
                    Animated.timing(translateY, {
                        toValue: -20,
                        duration: 2000,
                        useNativeDriver: true,
                    }),
                    Animated.timing(translateY, {
                        toValue: 0,
                        duration: 2000,
                        useNativeDriver: true,
                    }),
                ]),
                Animated.sequence([
                    Animated.timing(opacity, {
                        toValue: 1,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                    Animated.timing(opacity, {
                        toValue: 0.7,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                ]),
            ]).start(() => animateBird());
        };

        const timer = setTimeout(animateBird, delay);
        return () => clearTimeout(timer);
    }, [translateY, opacity, delay]);

    return (
        <Animated.View
            style={[
                styles.bird,
                {
                    transform: [{ translateY }],
                    opacity,
                },
            ]}
        >
            <Feather name="feather" size={16} color={pal.colors.primary} />
        </Animated.View>
    );
}

// Progress Ring Component
function ProgressRing({ progress, size = 120 }: { progress: number; size?: number }) {
    const colorScheme = useColorScheme() ?? 'light';
    const pal = theme[colorScheme];
    const strokeWidth = 8;
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const strokeDasharray = circumference;
    const strokeDashoffset = circumference - (progress / 100) * circumference;

    return (
        <View style={[styles.progressRing, { width: size, height: size }]}>
            <View style={styles.progressRingInner}>
                <Text style={[styles.progressPercentage, { color: pal.colors.primary }]}>
                    {progress}%
                </Text>
            </View>
            {/* We'll use a simulated ring with Views since SVG might be complex */}
            <View
                style={[
                    styles.progressCircle,
                    {
                        width: size,
                        height: size,
                        borderRadius: size / 2,
                        borderWidth: strokeWidth,
                        borderColor: pal.colors.border,
                    },
                ]}
            />
            <View
                style={[
                    styles.progressCircleActive,
                    {
                        width: size,
                        height: size,
                        borderRadius: size / 2,
                        borderWidth: strokeWidth,
                        borderColor: pal.colors.primary,
                        transform: [{ rotate: `${(progress / 100) * 360 - 90}deg` }],
                    },
                ]}
            />
        </View>
    );
}

// Main Loading Screen Component
export function DatabaseLoadingScreen({ onReady }: { onReady: () => void }) {
    const { isReady, isLoading, hasError, progress, loadedRecords, totalRecords, error, retry } = useBirdDexDatabase();
    const colorScheme = useColorScheme() ?? 'light';
    const pal = theme[colorScheme];
    const insets = useSafeAreaInsets();

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(50)).current;

    useEffect(() => {
        if (isReady) {
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }).start(() => onReady());
        } else {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 500,
                    useNativeDriver: true,
                }),
                Animated.timing(slideAnim, {
                    toValue: 0,
                    duration: 500,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [isReady, fadeAnim, slideAnim, onReady]);

    const getStatusMessage = () => {
        if (progress < 20) return "Preparing nest...";
        if (progress < 40) return "Gathering feathers...";
        if (progress < 60) return "Learning bird songs...";
        if (progress < 80) return "Mapping migration routes...";
        return "Almost ready to fly...";
    };

    const getSpeciesMessage = () => {
        if (loadedRecords > 0) {
            return `${loadedRecords.toLocaleString()} species ready to explore`;
        }
        return "Building comprehensive species database";
    };

    if (hasError) {
        return (
            <View style={[styles.container, { backgroundColor: pal.colors.background }]}>
                <BlurView
                    intensity={colorScheme === 'dark' ? 80 : 60}
                    tint={colorScheme === 'dark' ? 'dark' : 'light'}
                    style={styles.errorContainer}
                >
                    <View style={styles.errorContent}>
                        {/* Error Icon with Animation */}
                        <View style={[styles.errorIconContainer, { backgroundColor: pal.colors.error + '20' }]}>
                            <Feather name="alert-triangle" size={48} color={pal.colors.error} />
                        </View>

                        <Text style={[styles.errorTitle, { color: pal.colors.text.primary }]}>
                            Nest Building Failed
                        </Text>

                        <Text style={[styles.errorMessage, { color: pal.colors.text.secondary }]}>
                            {error || 'We encountered a problem setting up your bird database. This might be due to insufficient storage or a network issue.'}
                        </Text>

                        <View style={styles.errorActions}>
                            <Pressable
                                style={[styles.retryButton, { backgroundColor: pal.colors.primary }]}
                                onPress={retry}
                                android_ripple={{ color: pal.colors.primary + '20' }}
                            >
                                <Feather name="refresh-cw" size={20} color={pal.colors.text.onPrimary} />
                                <Text style={[styles.retryText, { color: pal.colors.text.onPrimary }]}>
                                    Try Again
                                </Text>
                            </Pressable>

                            <Text style={[styles.troubleshootText, { color: pal.colors.text.tertiary }]}>
                                Make sure you have stable internet and sufficient storage space
                            </Text>
                        </View>
                    </View>
                </BlurView>
            </View>
        );
    }

    if (isLoading) {
        return (
            <Animated.View
                style={[
                    styles.container,
                    {
                        backgroundColor: pal.colors.background,
                        opacity: fadeAnim,
                        transform: [{ translateY: slideAnim }]
                    }
                ]}
            >
                <View style={[styles.loadingContainer, { paddingTop: insets.top + 40 }]}>

                    {/* Animated Birds Background */}
                    <View style={styles.birdsBackground}>
                        <AnimatedBird delay={0} />
                        <AnimatedBird delay={500} />
                        <AnimatedBird delay={1000} />
                    </View>

                    {/* Main Logo and Branding */}
                    <View style={styles.brandingSection}>
                        <View style={[styles.logoContainer, { backgroundColor: pal.colors.primary + '15' }]}>
                            <Feather name="feather" size={64} color={pal.colors.primary} />
                        </View>

                        <Text style={[styles.appTitle, { color: pal.colors.text.primary }]}>
                            LogChirpy
                        </Text>

                        <Text style={[styles.tagline, { color: pal.colors.text.secondary }]}>
                            Your Digital Birding Companion
                        </Text>
                    </View>

                    {/* Progress Section */}
                    <BlurView
                        intensity={colorScheme === 'dark' ? 40 : 60}
                        tint={colorScheme === 'dark' ? 'dark' : 'light'}
                        style={[styles.progressSection, { borderColor: pal.colors.border }]}
                    >
                        <Text style={[styles.progressTitle, { color: pal.colors.text.primary }]}>
                            Building Your Bird Database
                        </Text>

                        <Text style={[styles.statusMessage, { color: pal.colors.primary }]}>
                            {getStatusMessage()}
                        </Text>

                        {/* Progress Ring */}
                        <View style={styles.progressContainer}>
                            <ProgressRing progress={Math.max(5, progress)} />
                        </View>

                        {/* Species Counter */}
                        <View style={styles.statsContainer}>
                            <View style={styles.statItem}>
                                <Text style={[styles.statNumber, { color: pal.colors.primary }]}>
                                    {loadedRecords.toLocaleString()}
                                </Text>
                                <Text style={[styles.statLabel, { color: pal.colors.text.secondary }]}>
                                    Species Loaded
                                </Text>
                            </View>

                            {totalRecords > 0 && (
                                <View style={styles.statItem}>
                                    <Text style={[styles.statNumber, { color: pal.colors.accent }]}>
                                        {totalRecords.toLocaleString()}
                                    </Text>
                                    <Text style={[styles.statLabel, { color: pal.colors.text.secondary }]}>
                                        Total Species
                                    </Text>
                                </View>
                            )}
                        </View>

                        <Text style={[styles.speciesMessage, { color: pal.colors.text.tertiary }]}>
                            {getSpeciesMessage()}
                        </Text>
                    </BlurView>

                    {/* Loading Indicator */}
                    <View style={styles.loadingIndicator}>
                        <ActivityIndicator size="small" color={pal.colors.primary} />
                        <Text style={[styles.loadingText, { color: pal.colors.text.tertiary }]}>
                            This may take a moment on first launch
                        </Text>
                    </View>
                </View>
            </Animated.View>
        );
    }

    return null;
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },

    // Loading State Styles
    loadingContainer: {
        flex: 1,
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: theme.spacing.xl,
        paddingBottom: theme.spacing.xxl,
    },

    // Birds Animation
    birdsBackground: {
        position: 'absolute',
        top: 60,
        left: 0,
        right: 0,
        height: 200,
        justifyContent: 'space-around',
        alignItems: 'center',
        flexDirection: 'row',
        opacity: 0.6,
    },
    bird: {
        position: 'absolute',
    },

    // Branding Section
    brandingSection: {
        alignItems: 'center',
        marginTop: theme.spacing.xxl,
    },
    logoContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: theme.spacing.lg,
        ...theme.shadows.md,
    },
    appTitle: {
        fontSize: 32,
        fontWeight: 'bold',
        marginBottom: theme.spacing.xs,
        letterSpacing: 1,
    },
    tagline: {
        fontSize: 16,
        textAlign: 'center',
        fontStyle: 'italic',
    },

    // Progress Section
    progressSection: {
        width: width * 0.9,
        maxWidth: 400,
        paddingVertical: theme.spacing.xl,
        paddingHorizontal: theme.spacing.lg,
        borderRadius: theme.borderRadius.xl,
        borderWidth: 1,
        alignItems: 'center',
        gap: theme.spacing.md,
        ...theme.shadows.md,
    },
    progressTitle: {
        fontSize: 20,
        fontWeight: '600',
        textAlign: 'center',
    },
    statusMessage: {
        fontSize: 16,
        fontWeight: '500',
        textAlign: 'center',
    },
    progressContainer: {
        marginVertical: theme.spacing.md,
    },

    // Progress Ring
    progressRing: {
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    progressRingInner: {
        position: 'absolute',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 2,
    },
    progressPercentage: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    progressCircle: {
        position: 'absolute',
    },
    progressCircleActive: {
        position: 'absolute',
        borderLeftColor: 'transparent',
        borderBottomColor: 'transparent',
        borderRightColor: 'transparent',
    },

    // Stats
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        width: '100%',
        marginTop: theme.spacing.md,
    },
    statItem: {
        alignItems: 'center',
        flex: 1,
    },
    statNumber: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    statLabel: {
        fontSize: 12,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginTop: 2,
    },
    speciesMessage: {
        fontSize: 14,
        textAlign: 'center',
        marginTop: theme.spacing.sm,
    },

    // Loading Indicator
    loadingIndicator: {
        alignItems: 'center',
        gap: theme.spacing.sm,
    },
    loadingText: {
        fontSize: 12,
        textAlign: 'center',
        fontStyle: 'italic',
    },

    // Error State Styles
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        margin: theme.spacing.lg,
        borderRadius: theme.borderRadius.xl,
    },
    errorContent: {
        alignItems: 'center',
        padding: theme.spacing.xl,
        maxWidth: 350,
    },
    errorIconContainer: {
        width: 96,
        height: 96,
        borderRadius: 48,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: theme.spacing.lg,
    },
    errorTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: theme.spacing.md,
        textAlign: 'center',
    },
    errorMessage: {
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: theme.spacing.xl,
    },
    errorActions: {
        alignItems: 'center',
        width: '100%',
        gap: theme.spacing.md,
    },
    retryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: theme.spacing.md,
        paddingHorizontal: theme.spacing.xl,
        borderRadius: theme.borderRadius.lg,
        gap: theme.spacing.sm,
        minWidth: 140,
        ...theme.shadows.sm,
    },
    retryText: {
        fontSize: 16,
        fontWeight: '600',
    },
    troubleshootText: {
        fontSize: 12,
        textAlign: 'center',
        lineHeight: 18,
        maxWidth: 280,
    },
});