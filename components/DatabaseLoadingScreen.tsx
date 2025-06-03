import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Dimensions,
    SafeAreaView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
    withSpring,
    interpolate,
    Easing,
} from 'react-native-reanimated';

import { ModernCard } from '@/components/ModernCard';
import { ThemedPressable } from '@/components/ThemedPressable';
import { useBirdDexDatabase } from '@/hooks/useBirdDexDatabase';
import {
    useTheme,
    useSemanticColors,
    useColorVariants,
    useTypography,
    useMotionValues
} from '@/hooks/useThemeColor';

const { width, height } = Dimensions.get('window');

// Floating Bird Animation Component
function FloatingBird({ delay = 0, index = 0 }: { delay?: number; index?: number }) {
    const semanticColors = useSemanticColors();
    const floatAnimation = useSharedValue(0);

    React.useEffect(() => {
        floatAnimation.value = withRepeat(
            withTiming(1, { duration: 3000 + (index * 200), easing: Easing.inOut(Easing.ease) }),
            -1,
            true
        );
    }, [index]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            {
                translateY: interpolate(
                    floatAnimation.value,
                    [0, 1],
                    [0, -12]
                ) * Math.sin(Date.now() / 1000 + delay),
            },
        ],
        opacity: interpolate(floatAnimation.value, [0, 1], [0.6, 1]),
    }));

    return (
        <Animated.View style={[styles.floatingBird, animatedStyle]}>
            <Feather name="feather" size={16} color={semanticColors.primary} />
        </Animated.View>
    );
}

// Enhanced Progress Bar Component
function ModernProgressBar({ progress }: { progress: number }) {
    const semanticColors = useSemanticColors();
    const variants = useColorVariants();
    const theme = useTheme();

    const progressAnimation = useSharedValue(0);

    React.useEffect(() => {
        progressAnimation.value = withSpring(progress / 100, {
            damping: 20,
            stiffness: 100,
        });
    }, [progress]);

    const progressStyle = useAnimatedStyle(() => ({
        width: `${progressAnimation.value * 100}%`,
    }));

    return (
        <View style={styles.progressContainer}>
            <View style={[styles.progressTrack, { backgroundColor: variants.primarySubtle }]}>
                <Animated.View
                    style={[
                        styles.progressFill,
                        { backgroundColor: semanticColors.primary },
                        progressStyle,
                    ]}
                />
            </View>
            <View style={styles.progressLabels}>
                <Text style={[styles.progressText, { color: semanticColors.primary }]}>
                    {progress}%
                </Text>
            </View>
        </View>
    );
}

export function DatabaseLoadingScreen({ onReady }: { onReady: () => void }) {
    const { isReady, isLoading, hasError, progress, loadedRecords, totalRecords, error, retry } = useBirdDexDatabase();
    const semanticColors = useSemanticColors();
    const variants = useColorVariants();
    const typography = useTypography();
    const theme = useTheme();
    const motion = useMotionValues();

    // Main animation values
    const fadeAnim = useSharedValue(0);
    const slideAnim = useSharedValue(30);
    const logoAnimation = useSharedValue(1);

    React.useEffect(() => {
        if (isReady) {
            fadeAnim.value = withTiming(0, { duration: motion.duration.medium });
            setTimeout(onReady, motion.duration.medium);
        } else {
            fadeAnim.value = withTiming(1, { duration: motion.duration.medium });
            slideAnim.value = withSpring(0, { damping: 20, stiffness: 300 });
        }
    }, [isReady]);

    React.useEffect(() => {
        logoAnimation.value = withRepeat(
            withTiming(1.05, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
            -1,
            true
        );
    }, []);

    const containerStyle = useAnimatedStyle(() => ({
        opacity: fadeAnim.value,
        transform: [{ translateY: slideAnim.value }],
    }));

    const logoStyle = useAnimatedStyle(() => ({
        transform: [{ scale: logoAnimation.value }],
    }));

    const getStatusMessage = () => {
        if (progress < 20) return "Preparing nest...";
        if (progress < 40) return "Gathering feathers...";
        if (progress < 60) return "Learning bird songs...";
        if (progress < 80) return "Mapping migration routes...";
        return "Almost ready to fly...";
    };

    const getFloatingStyle = (delay: number) => {
        return useAnimatedStyle(() => ({
            transform: [
                {
                    translateY: interpolate(
                        logoAnimation.value,
                        [1, 1.05],
                        [0, -8]
                    ) * Math.sin(Date.now() / 1000 + delay),
                },
            ],
        }));
    };

    if (hasError) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: semanticColors.background }]}>
                <Animated.View style={[styles.content, containerStyle]}>
                    <View style={styles.floatingBirds}>
                        {[...Array(3)].map((_, i) => (
                            <FloatingBird key={i} delay={i * 0.5} index={i} />
                        ))}
                    </View>

                    <Animated.View style={[styles.logoContainer, logoStyle]}>
                        <View style={[styles.logoIcon, { backgroundColor: variants.primarySubtle }]}>
                            <Feather name="alert-triangle" size={48} color={semanticColors.error} />
                        </View>
                    </Animated.View>

                    <Text style={[typography.displayMedium, styles.title]}>
                        Nest Building Failed
                    </Text>

                    <Text style={[typography.bodyLarge, styles.subtitle, { color: semanticColors.textSecondary }]}>
                        We encountered a problem setting up your bird database
                    </Text>

                    <Animated.View style={getFloatingStyle(0.5)}>
                        <ModernCard
                            variant="outlined"
                            style={styles.errorCard}
                        >
                            <View style={styles.errorContent}>
                                <Text style={[typography.bodyMedium, { color: semanticColors.textSecondary }]}>
                                    {error || 'Check your storage space and network connection'}
                                </Text>

                                <ThemedPressable
                                    variant="primary"
                                    size="large"
                                    onPress={retry}
                                    style={styles.retryButton}
                                >
                                    <Feather name="refresh-cw" size={20} color={semanticColors.onPrimary} />
                                    <Text style={[typography.labelLarge, { color: semanticColors.onPrimary }]}>
                                        Try Again
                                    </Text>
                                </ThemedPressable>
                            </View>
                        </ModernCard>
                    </Animated.View>
                </Animated.View>
            </SafeAreaView>
        );
    }

    if (isLoading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: semanticColors.background }]}>
                <Animated.View style={[styles.content, containerStyle]}>
                    {/* Floating Birds */}
                    <View style={styles.floatingBirds}>
                        {[...Array(5)].map((_, i) => (
                            <FloatingBird key={i} delay={i * 0.3} index={i} />
                        ))}
                    </View>

                    {/* Hero Section */}
                    <View style={styles.heroSection}>
                        <Animated.View style={[styles.logoContainer, logoStyle]}>
                            <View style={[styles.logoIcon, { backgroundColor: variants.primarySubtle }]}>
                                <Feather name="feather" size={48} color={semanticColors.primary} />
                            </View>
                        </Animated.View>

                        <Text style={[typography.displayMedium, styles.title]}>
                            LogChirpy
                        </Text>

                        <Text style={[typography.bodyLarge, styles.subtitle, { color: semanticColors.textSecondary }]}>
                            Building your bird database
                        </Text>
                    </View>

                    {/* Progress Section */}
                    <Animated.View style={getFloatingStyle(0.8)}>
                        <ModernCard
                            variant="glass"
                            style={{
                                ...styles.progressCard,
                                borderColor: variants.primaryMuted,
                            }}
                        >
                            <View style={styles.progressContent}>
                                <Text style={[typography.headlineSmall, { color: semanticColors.text }]}>
                                    {getStatusMessage()}
                                </Text>

                                <ModernProgressBar progress={Math.max(5, progress)} />

                                {/* Stats */}
                                <View style={styles.statsContainer}>
                                    <View style={styles.statItem}>
                                        <Text style={[typography.headlineMedium, { color: semanticColors.primary }]}>
                                            {loadedRecords.toLocaleString()}
                                        </Text>
                                        <Text style={[typography.labelMedium, { color: semanticColors.textSecondary }]}>
                                            Species Loaded
                                        </Text>
                                    </View>

                                    {totalRecords > 0 && (
                                        <>
                                            <View style={[styles.statDivider, { backgroundColor: variants.primaryMuted }]} />
                                            <View style={styles.statItem}>
                                                <Text style={[typography.headlineMedium, { color: semanticColors.accent }]}>
                                                    {totalRecords.toLocaleString()}
                                                </Text>
                                                <Text style={[typography.labelMedium, { color: semanticColors.textSecondary }]}>
                                                    Total Species
                                                </Text>
                                            </View>
                                        </>
                                    )}
                                </View>
                            </View>
                        </ModernCard>
                    </Animated.View>

                    {/* Loading Hint */}
                    <Text style={[typography.labelMedium, styles.hint, { color: semanticColors.textTertiary }]}>
                        This may take a moment on first launch
                    </Text>
                </Animated.View>
            </SafeAreaView>
        );
    }

    return null;
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingBottom: 40,
    },

    // Floating Birds
    floatingBirds: {
        position: 'absolute',
        top: 60,
        left: 0,
        right: 0,
        height: 200,
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        opacity: 0.6,
    },
    floatingBird: {
        position: 'absolute',
    },

    // Hero Section
    heroSection: {
        alignItems: 'center',
        marginBottom: 40,
    },
    logoContainer: {
        marginBottom: 24,
    },
    logoIcon: {
        width: 96,
        height: 96,
        borderRadius: 48,
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        textAlign: 'center',
        lineHeight: 24,
        maxWidth: width * 0.8,
    },

    // Progress Section
    progressCard: {
        width: width * 0.9,
        maxWidth: 400,
        borderWidth: 1,
        marginBottom: 24,
    },
    progressContent: {
        padding: 24,
        alignItems: 'center',
        gap: 20,
    },
    progressContainer: {
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
    progressLabels: {
        flexDirection: 'row',
        justifyContent: 'center',
    },
    progressText: {
        fontSize: 16,
        fontWeight: '600',
    },

    // Stats
    statsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        justifyContent: 'center',
    },
    statItem: {
        alignItems: 'center',
        flex: 1,
    },
    statDivider: {
        width: 1,
        height: 40,
        marginHorizontal: 16,
    },

    // Error State
    errorCard: {
        width: width * 0.9,
        maxWidth: 350,
        marginTop: 20,
    },
    errorContent: {
        padding: 24,
        alignItems: 'center',
        gap: 20,
    },
    retryButton: {
        flexDirection: 'row',
        gap: 8,
    },

    // Misc
    hint: {
        textAlign: 'center',
        fontStyle: 'italic',
        maxWidth: 280,
    },
});