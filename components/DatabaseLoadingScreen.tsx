import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    Dimensions,
    SafeAreaView,
} from 'react-native';
import { ThemedIcon } from '@/components/ThemedIcon';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
    withSpring,
    interpolate,
    Easing,
} from 'react-native-reanimated';

import { useTranslation } from 'react-i18next';
import { ModernCard } from '@/components/ModernCard';
import { ThemedPressable } from '@/components/ThemedPressable';
import { useBirdDexDatabase } from '@/hooks/useBirdDexDatabase';
import {
    // useTheme,
    useSemanticColors,
    useColorVariants,
    useTypography,
    useMotionValues
} from '@/hooks/useThemeColor';

const { width } = Dimensions.get('window');

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
    }, [index, floatAnimation]);

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
            <ThemedIcon name="feather" size={16} color="primary" />
        </Animated.View>
    );
}

// Enhanced Progress Bar Component
function ModernProgressBar({ progress }: { progress: number }) {
    const semanticColors = useSemanticColors();
    const variants = useColorVariants();
    // const theme = useTheme();

    const progressAnimation = useSharedValue(0);

    React.useEffect(() => {
        progressAnimation.value = withSpring(progress / 100, {
            damping: 20,
            stiffness: 100,
        });
    }, [progress, progressAnimation]);

    const progressStyle = useAnimatedStyle(() => ({
        width: `${progressAnimation.value * 100}%`,
    }));

    return (
        <View style={styles.progressContainer}>
            <View style={[styles.progressTrack, { backgroundColor: variants.primary.light }]}>
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
    const { t } = useTranslation();
    const { isReady, isLoading, hasError, progress, loadedRecords, totalRecords, error, retry } = useBirdDexDatabase();
    const semanticColors = useSemanticColors();
    const variants = useColorVariants();
    const typography = useTypography();
    // const theme = useTheme();
    const motion = useMotionValues();

    // Main animation values
    const fadeAnim = useSharedValue(0);
    const slideAnim = useSharedValue(30);
    const logoAnimation = useSharedValue(1);

    React.useEffect(() => {
        if (isReady) {
            fadeAnim.value = withTiming(0, { duration: 200 });
            setTimeout(onReady, 200);
        } else {
            fadeAnim.value = withTiming(1, { duration: 200 });
            slideAnim.value = withSpring(0, { damping: 20, stiffness: 300 });
        }
    }, [isReady, fadeAnim, onReady, slideAnim]);

    React.useEffect(() => {
        logoAnimation.value = withRepeat(
            withTiming(1.05, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
            -1,
            true
        );
    }, [logoAnimation]);

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
        if (progress < 90) return "Organizing field guides...";
        if (progress < 99) return "Final preparations...";
        return "Ready to fly!";
    };

    // Simplified floating animation
    const floatingStyle = useAnimatedStyle(() => ({
        transform: [
            {
                translateY: interpolate(
                    logoAnimation.value,
                    [1, 1.05],
                    [0, -8]
                ),
            },
        ],
    }));

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
                        <View style={[styles.logoIcon, { backgroundColor: variants.primary.light }]}>
                            <ThemedIcon name="alert-triangle" size={48} color="error" />
                        </View>
                    </Animated.View>

                    <Text style={[typography.h1, styles.title]}>
                        {t('errors.nest_build_failed')} 
                    </Text>

                    <Text style={[typography.body, styles.subtitle, { color: semanticColors.secondary }]}>
                         {t('errors.database_setup_problem')}
                    </Text>

                    <Animated.View style={floatingStyle}>
                        <ModernCard
                            style={styles.errorCard}
                        >
                            <View style={styles.errorContent}>
                                <Text style={[typography.body, { color: semanticColors.secondary }]}>
                                    {error || t('errors.check_storage_network')} 
                                </Text>

                                <ThemedPressable
                                    variant="primary"
                                    size="lg"
                                    onPress={retry}
                                    style={styles.retryButton}
                                >
                                    <ThemedIcon name="refresh-cw" size={20} color="primary" />
                                    <Text style={[typography.label, { color: semanticColors.primary }]}>
                                        {t('buttons.try_again')}
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
                            <View style={[styles.logoIcon, { backgroundColor: variants.primary.light }]}>
                                <ThemedIcon name="feather" size={48} color="primary" />
                            </View>
                        </Animated.View>

                        <Text style={[typography.h1, styles.title]}>
                            LogChirpy
                        </Text>

                        <Text style={[typography.body, styles.subtitle, { color: semanticColors.secondary }]}>
                            {t('loading_messages.building_database2')}
                        </Text>
                    </View>

                    {/* Progress Section */}
                    <Animated.View style={floatingStyle}>
                        <ModernCard
                            style={{
                                ...styles.progressCard,
                                borderColor: variants.primary.light,
                            }}
                        >
                            <View style={styles.progressContent}>
                                <Text style={[typography.h2, { color: semanticColors.primary }]}>
                                    {getStatusMessage()}
                                </Text>

                                <ModernProgressBar progress={Math.max(5, progress)} />

                                {/* Stats */}
                                <View style={styles.statsContainer}>
                                    <View style={styles.statItem}>
                                        <Text style={[typography.h2, { color: semanticColors.primary }]}>
                                            {loadedRecords.toLocaleString()}
                                        </Text>
                                        <Text style={[typography.label, { color: semanticColors.secondary }]}>
                                            {t('loading_messages.species_loaded_label')}
                                        </Text>
                                    </View>

                                    {totalRecords > 0 && (
                                        <>
                                            <View style={[styles.statDivider, { backgroundColor: variants.primary.light }]} />
                                            <View style={styles.statItem}>
                                                <Text style={[typography.h2, { color: semanticColors.primary }]}>
                                                    {totalRecords.toLocaleString()}
                                                </Text>
                                                <Text style={[typography.label, { color: semanticColors.secondary }]}>
                                                     {t('loading_messages.total_species')}
                                                </Text>
                                            </View>
                                        </>
                                    )}
                                </View>
                            </View>
                        </ModernCard>
                    </Animated.View>

                    {/* Loading Hint */}
                    <Text style={[typography.label, styles.hint, { color: semanticColors.secondary }]}>
                        {t('loading_messages.first_launch_hint')}
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