import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    Dimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
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
    useMotionValues,
} from '@/hooks/useThemeColor';
import { DatabaseStatus } from '@/hooks/useProgressiveDatabase';

const { width } = Dimensions.get('window');
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface EnhancedBackgroundLoadingBannerProps {
    databaseStatus: DatabaseStatus;
}

// Animated loading icon component
function LoadingIcon() {
    const semanticColors = useSemanticColors();
    const variants = useColorVariants();
    const motion = useMotionValues();

    const rotation = useSharedValue(0);
    const scale = useSharedValue(1);

    useEffect(() => {
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
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { rotate: `${rotation.value}deg` },
            { scale: scale.value },
        ],
    }));

    return (
        <Animated.View
            style={[
                {
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: variants.primarySubtle,
                    justifyContent: 'center',
                    alignItems: 'center',
                },
                animatedStyle,
            ]}
        >
            <Feather name="download-cloud" size={14} color={semanticColors.primary} />
        </Animated.View>
    );
}

export default function EnhancedBackgroundLoadingBanner({
                                                            databaseStatus,
                                                        }: EnhancedBackgroundLoadingBannerProps) {
    const { t } = useTranslation();
    const theme = useTheme();
    const semanticColors = useSemanticColors();
    const variants = useColorVariants();
    const typography = useTypography();
    const motion = useMotionValues();

    const [isExpanded, setIsExpanded] = useState(false);
    const [hasInteracted, setHasInteracted] = useState(false);

    const {
        isBackgroundLoading,
        backgroundProgress,
        statusMessage,
        estimatedTimeRemaining,
    } = databaseStatus;

    // Animation values
    const slideAnim = useSharedValue(-100);
    const expandAnim = useSharedValue(0);
    const progressAnim = useSharedValue(0);
    const pulseAnim = useSharedValue(1);

    // Show/hide banner based on loading state
    useEffect(() => {
        if (isBackgroundLoading) {
            slideAnim.value = withSpring(0, { damping: 20, stiffness: 300 });

            // Auto-expand after 2 seconds if user hasn't interacted
            const autoExpandTimer = setTimeout(() => {
                if (!hasInteracted) {
                    setIsExpanded(true);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
            }, 2000);

            return () => clearTimeout(autoExpandTimer);
        } else {
            slideAnim.value = withTiming(-100, { duration: motion.duration.medium });
        }
    }, [isBackgroundLoading, hasInteracted]);

    // Update progress animation
    useEffect(() => {
        progressAnim.value = withTiming(backgroundProgress, {
            duration: motion.duration.medium,
            easing: Easing.out(Easing.exp),
        });
    }, [backgroundProgress]);

    // Expand/collapse animation
    useEffect(() => {
        expandAnim.value = withSpring(isExpanded ? 1 : 0, {
            damping: 18,
            stiffness: 300,
        });

        // Subtle pulse when expanded
        if (isExpanded) {
            pulseAnim.value = withRepeat(
                withTiming(1.02, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
                -1,
                true
            );
        } else {
            pulseAnim.value = withTiming(1, { duration: motion.duration.fast });
        }
    }, [isExpanded]);

    const formatTimeRemaining = (seconds?: number) => {
        if (!seconds || seconds < 1) return '';
        if (seconds < 60) return `${Math.ceil(seconds)}s remaining`;
        return `${Math.ceil(seconds / 60)}m remaining`;
    };

    const handleToggleExpand = () => {
        setHasInteracted(true);
        setIsExpanded(!isExpanded);
        Haptics.selectionAsync();
    };

    // Animated styles
    const containerStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: slideAnim.value }],
    }));

    const expandedContentStyle = useAnimatedStyle(() => ({
        height: interpolate(expandAnim.value, [0, 1], [0, 120]),
        opacity: expandAnim.value,
    }));

    const progressBarStyle = useAnimatedStyle(() => ({
        width: `${progressAnim.value}%`,
    }));

    const cardStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulseAnim.value }],
    }));

    // Don't render if not background loading
    if (!isBackgroundLoading) return null;

    return (
        <Animated.View
            style={[
                styles.container,
                { marginHorizontal: theme.spacing.md },
                containerStyle,
            ]}
        >
            <Animated.View style={cardStyle}>
                <BlurView
                    intensity={80}
                    tint={semanticColors.background === '#FFFFFF' ? 'light' : 'dark'}
                    style={[
                        styles.card,
                        {
                            borderColor: variants.primaryMuted,
                            borderRadius: theme.borderRadius.lg,
                        },
                    ]}
                >
                    {/* Subtle background gradient effect */}
                    <View
                        style={[
                            StyleSheet.absoluteFillObject,
                            {
                                backgroundColor: variants.primarySubtle,
                                opacity: 0.1,
                                borderRadius: theme.borderRadius.lg,
                            },
                        ]}
                    />

                    {/* Main content */}
                    <AnimatedPressable
                        style={[styles.header, { padding: theme.spacing.md }]}
                        onPress={handleToggleExpand}
                        android_ripple={{ color: variants.surfacePressed }}
                    >
                        <View style={styles.headerContent}>
                            <LoadingIcon />

                            <View style={styles.textContainer}>
                                <Text
                                    style={[
                                        typography.labelLarge,
                                        { color: semanticColors.text, fontWeight: '600' },
                                    ]}
                                >
                                    Loading Species Database
                                </Text>
                                <Text
                                    style={[
                                        typography.labelSmall,
                                        { color: semanticColors.textSecondary },
                                    ]}
                                >
                                    {backgroundProgress}% complete
                                    {estimatedTimeRemaining && ` • ${formatTimeRemaining(estimatedTimeRemaining)}`}
                                </Text>
                            </View>

                            <View style={styles.expandButton}>
                                <Feather
                                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                                    size={16}
                                    color={semanticColors.textSecondary}
                                />
                            </View>
                        </View>

                        {/* Compact progress bar */}
                        <View
                            style={[
                                styles.progressTrack,
                                { backgroundColor: variants.primaryMuted },
                            ]}
                        >
                            <Animated.View
                                style={[
                                    styles.progressFill,
                                    { backgroundColor: semanticColors.primary },
                                    progressBarStyle,
                                ]}
                            />
                        </View>
                    </AnimatedPressable>

                    {/* Expanded content */}
                    <Animated.View style={[styles.expandedContent, expandedContentStyle]}>
                        <View style={[styles.expandedInner, { padding: theme.spacing.md }]}>
                            <Text
                                style={[
                                    typography.bodySmall,
                                    {
                                        color: semanticColors.textSecondary,
                                        lineHeight: 18,
                                        marginBottom: theme.spacing.sm,
                                    },
                                ]}
                            >
                                {statusMessage ||
                                    'Building comprehensive database with 15,000+ bird species from around the world'}
                            </Text>

                            {/* Enhanced info section */}
                            <View style={styles.infoRow}>
                                <View style={styles.infoItem}>
                                    <Feather
                                        name="database"
                                        size={14}
                                        color={semanticColors.primary}
                                    />
                                    <Text
                                        style={[
                                            typography.labelSmall,
                                            { color: semanticColors.textSecondary },
                                        ]}
                                    >
                                        App remains fully usable
                                    </Text>
                                </View>

                                <View style={styles.infoItem}>
                                    <Feather
                                        name="globe"
                                        size={14}
                                        color={semanticColors.accent}
                                    />
                                    <Text
                                        style={[
                                            typography.labelSmall,
                                            { color: semanticColors.textSecondary },
                                        ]}
                                    >
                                        Worldwide coverage
                                    </Text>
                                </View>
                            </View>

                            {/* Detailed progress */}
                            <View style={styles.detailedProgress}>
                                <View style={styles.progressHeader}>
                                    <Text
                                        style={[
                                            typography.labelMedium,
                                            { color: semanticColors.primary, fontWeight: '600' },
                                        ]}
                                    >
                                        {backgroundProgress}%
                                    </Text>
                                    <Text
                                        style={[
                                            typography.labelSmall,
                                            { color: semanticColors.textTertiary },
                                        ]}
                                    >
                                        Building database
                                    </Text>
                                </View>

                                <View
                                    style={[
                                        styles.detailedProgressBar,
                                        { backgroundColor: variants.primaryMuted },
                                    ]}
                                >
                                    <Animated.View
                                        style={[
                                            styles.detailedProgressFill,
                                            { backgroundColor: semanticColors.primary },
                                            progressBarStyle,
                                        ]}
                                    />
                                </View>
                            </View>
                        </View>
                    </Animated.View>
                </BlurView>
            </Animated.View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
    },
    card: {
        borderWidth: 1,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },

    // Header
    header: {
        position: 'relative',
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    textContainer: {
        flex: 1,
        marginLeft: 12,
    },
    expandButton: {
        padding: 4,
    },

    // Progress
    progressTrack: {
        height: 3,
        borderRadius: 1.5,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 1.5,
    },

    // Expanded content
    expandedContent: {
        overflow: 'hidden',
    },
    expandedInner: {
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
    },

    // Info section
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    infoItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flex: 1,
    },

    // Detailed progress
    detailedProgress: {
        gap: 8,
    },
    progressHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    detailedProgressBar: {
        height: 6,
        borderRadius: 3,
        overflow: 'hidden',
    },
    detailedProgressFill: {
        height: '100%',
        borderRadius: 3,
    },
});