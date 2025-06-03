import React, { useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    Dimensions,
} from 'react-native';
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
import * as Haptics from 'expo-haptics';

import {
    useTheme,
    useSemanticColors,
    useColorVariants,
    useTypography,
    useMotionValues
} from '@/hooks/useThemeColor';
import { DatabaseStatus } from '@/hooks/useProgressiveDatabase';

const { width } = Dimensions.get('window');

interface EnhancedLoadingSplashProps {
    databaseStatus: DatabaseStatus;
    onContinue: () => void;
}

// Animated Progress Ring Component
function ProgressRing({ progress, size = 120 }: { progress: number; size?: number }) {
    const semanticColors = useSemanticColors();
    const variants = useColorVariants();
    const motion = useMotionValues();

    const rotation = useSharedValue(0);
    const scale = useSharedValue(1);

    useEffect(() => {
        rotation.value = withRepeat(
            withTiming(360, { duration: 3000, easing: Easing.linear }),
            -1,
            false
        );

        scale.value = withRepeat(
            withSpring(1.05, { damping: 15, stiffness: 300 }),
            -1,
            true
        );
    }, []);

    const animatedRingStyle = useAnimatedStyle(() => ({
        transform: [
            { rotate: `${rotation.value}deg` },
            { scale: scale.value }
        ],
    }));

    const progressStyle = useAnimatedStyle(() => ({
        transform: [
            { rotate: `${interpolate(progress, [0, 100], [0, 360])}deg` }
        ],
    }));

    return (
        <View style={[styles.progressRing, { width: size, height: size }]}>
            {/* Background Ring */}
            <View style={[
                styles.progressCircle,
                {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    borderColor: variants.surfaceHover,
                }
            ]} />

            {/* Animated Outer Ring */}
            <Animated.View style={[
                styles.progressCircle,
                {
                    width: size + 8,
                    height: size + 8,
                    borderRadius: (size + 8) / 2,
                    borderColor: variants.primarySubtle,
                    position: 'absolute',
                    top: -4,
                    left: -4,
                },
                animatedRingStyle,
            ]} />

            {/* Progress Ring */}
            <Animated.View style={[
                styles.progressFill,
                {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    borderTopColor: semanticColors.primary,
                    borderRightColor: semanticColors.primary,
                    borderBottomColor: 'transparent',
                    borderLeftColor: 'transparent',
                },
                progressStyle,
            ]} />

            {/* Center Content */}
            <View style={styles.progressCenter}>
                <Text style={[styles.progressText, { color: semanticColors.primary }]}>
                    {progress}%
                </Text>
                <Feather name="feather" size={16} color={semanticColors.primary} />
            </View>
        </View>
    );
}

export default function EnhancedMinimalLoadingSplash({
                                                         databaseStatus,
                                                         onContinue
                                                     }: EnhancedLoadingSplashProps) {
    const theme = useTheme();
    const semanticColors = useSemanticColors();
    const variants = useColorVariants();
    const typography = useTypography();
    const motion = useMotionValues();

    const {
        currentPhase,
        coreProgress,
        statusMessage,
        estimatedTimeRemaining,
        error,
        retryInitialization
    } = databaseStatus;

    // Animation values
    const containerOpacity = useSharedValue(0);
    const contentScale = useSharedValue(0.9);
    const statusOpacity = useSharedValue(0);

    useEffect(() => {
        if (currentPhase === 'complete' || currentPhase === 'core-ready') {
            // Exit animation
            containerOpacity.value = withTiming(0, {
                duration: motion.duration.medium
            });
            contentScale.value = withTiming(0.95, {
                duration: motion.duration.medium
            });

            setTimeout(onContinue, motion.duration.medium);
        } else {
            // Enter animation
            containerOpacity.value = withTiming(1, {
                duration: motion.duration.medium
            });
            contentScale.value = withSpring(1, {
                damping: 20,
                stiffness: 300
            });
            statusOpacity.value = withTiming(1, {
                duration: motion.duration.slow
            });
        }
    }, [currentPhase]);

    const containerStyle = useAnimatedStyle(() => ({
        opacity: containerOpacity.value,
        transform: [{ scale: contentScale.value }],
    }));

    const statusStyle = useAnimatedStyle(() => ({
        opacity: statusOpacity.value,
    }));

    const formatTimeRemaining = (seconds?: number) => {
        if (!seconds || seconds < 1) return null;
        if (seconds < 60) return `~${Math.ceil(seconds)}s remaining`;
        return `~${Math.ceil(seconds / 60)}m remaining`;
    };

    const getPhaseMessage = () => {
        if (error) return "Database initialization failed";

        switch (currentPhase) {
            case 'initializing':
                return "Preparing bird database...";
            case 'core-loading':
                return "Loading essential species...";
            default:
                return statusMessage || "Setting up LogChirpy...";
        }
    };

    const handleRetry = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        retryInitialization();
    };

    // Don't render if complete
    if (currentPhase === 'complete' || currentPhase === 'core-ready') {
        return null;
    }

    return (
        <Animated.View style={[
            styles.container,
            { backgroundColor: semanticColors.background },
            containerStyle
        ]}>
            {/* Background Elements */}
            <View style={styles.backgroundElements}>
                <View style={[
                    styles.backgroundCircle,
                    { backgroundColor: variants.primarySubtle }
                ]} />
                <View style={[
                    styles.backgroundCircle,
                    styles.backgroundCircle2,
                    { backgroundColor: variants.accentSubtle }
                ]} />
            </View>

            <View style={styles.content}>
                {/* Brand Section */}
                <View style={styles.brandSection}>
                    <View style={[
                        styles.logoContainer,
                        { backgroundColor: variants.primarySubtle }
                    ]}>
                        <Feather name="feather" size={48} color={semanticColors.primary} />
                    </View>

                    <Text style={[typography.displayMedium, styles.brandTitle]}>
                        LogChirpy
                    </Text>

                    <Text style={[
                        typography.bodyLarge,
                        styles.brandSubtitle,
                        { color: semanticColors.textSecondary }
                    ]}>
                        Your Digital Birding Companion
                    </Text>
                </View>

                {/* Status Section */}
                <BlurView
                    intensity={60}
                    tint={semanticColors.background === '#FFFFFF' ? 'light' : 'dark'}
                    style={[styles.statusCard, { borderColor: variants.primaryMuted }]}
                >
                    {error ? (
                        // Error State
                        <View style={styles.errorState}>
                            <View style={[
                                styles.errorIcon,
                                { backgroundColor: variants.primarySubtle }
                            ]}>
                                <Feather name="alert-triangle" size={32} color={semanticColors.error} />
                            </View>

                            <Text style={[typography.headlineSmall, { color: semanticColors.text }]}>
                                Initialization Failed
                            </Text>

                            <Text style={[
                                typography.bodyMedium,
                                styles.errorMessage,
                                { color: semanticColors.textSecondary }
                            ]}>
                                {error}
                            </Text>

                            <Pressable
                                style={[styles.retryButton, { backgroundColor: semanticColors.primary }]}
                                onPress={handleRetry}
                                android_ripple={{ color: variants.primaryPressed }}
                            >
                                <Feather name="refresh-cw" size={18} color={semanticColors.onPrimary} />
                                <Text style={[
                                    typography.labelLarge,
                                    { color: semanticColors.onPrimary }
                                ]}>
                                    Try Again
                                </Text>
                            </Pressable>
                        </View>
                    ) : (
                        // Loading State
                        <Animated.View style={[styles.loadingState, statusStyle]}>
                            <Text style={[typography.headlineSmall, { color: semanticColors.text }]}>
                                {getPhaseMessage()}
                            </Text>

                            {/* Progress Ring */}
                            <ProgressRing progress={Math.max(5, coreProgress)} />

                            {/* Progress Details */}
                            <View style={styles.progressDetails}>
                                <Text style={[
                                    typography.labelLarge,
                                    { color: semanticColors.primary }
                                ]}>
                                    {coreProgress}% Complete
                                </Text>

                                {estimatedTimeRemaining && (
                                    <Text style={[
                                        typography.labelMedium,
                                        { color: semanticColors.textTertiary }
                                    ]}>
                                        {formatTimeRemaining(estimatedTimeRemaining)}
                                    </Text>
                                )}
                            </View>

                            <Text style={[
                                typography.bodySmall,
                                styles.progressHint,
                                { color: semanticColors.textTertiary }
                            ]}>
                                Loading essential bird species for quick start
                            </Text>
                        </Animated.View>
                    )}
                </BlurView>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Background
    backgroundElements: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
    },
    backgroundCircle: {
        position: 'absolute',
        width: width * 1.5,
        height: width * 1.5,
        borderRadius: width * 0.75,
        opacity: 0.03,
    },
    backgroundCircle2: {
        width: width * 2,
        height: width * 2,
        borderRadius: width,
        opacity: 0.02,
    },

    // Content
    content: {
        alignItems: 'center',
        maxWidth: 350,
        width: '100%',
        paddingHorizontal: 24,
        gap: 32,
    },

    // Brand Section
    brandSection: {
        alignItems: 'center',
        gap: 16,
    },
    logoContainer: {
        width: 96,
        height: 96,
        borderRadius: 48,
        justifyContent: 'center',
        alignItems: 'center',
    },
    brandTitle: {
        fontWeight: 'bold',
        textAlign: 'center',
    },
    brandSubtitle: {
        textAlign: 'center',
        fontStyle: 'italic',
    },

    // Status Card
    statusCard: {
        width: '100%',
        borderRadius: 24,
        borderWidth: 1,
        padding: 32,
        alignItems: 'center',
        gap: 20,
    },

    // Loading State
    loadingState: {
        alignItems: 'center',
        gap: 20,
        width: '100%',
    },
    progressDetails: {
        alignItems: 'center',
        gap: 4,
    },
    progressHint: {
        textAlign: 'center',
        fontStyle: 'italic',
        marginTop: 8,
    },

    // Error State
    errorState: {
        alignItems: 'center',
        gap: 16,
        width: '100%',
    },
    errorIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    errorMessage: {
        textAlign: 'center',
        lineHeight: 20,
    },
    retryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 16,
        gap: 8,
        marginTop: 8,
    },

    // Progress Ring
    progressRing: {
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    progressCircle: {
        borderWidth: 3,
        borderColor: 'transparent',
        position: 'absolute',
    },
    progressFill: {
        borderWidth: 3,
        position: 'absolute',
    },
    progressCenter: {
        alignItems: 'center',
        gap: 4,
    },
    progressText: {
        fontSize: 18,
        fontWeight: 'bold',
    },
});