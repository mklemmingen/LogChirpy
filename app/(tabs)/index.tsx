import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    Dimensions,
    ScrollView,
    SafeAreaView,
} from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
    interpolate,
    Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { HelloWave } from '@/components/HelloWave';
import BirdAnimation from '@/components/BirdAnimation';
import { ModernCard } from '@/components/ModernCard';
import {
    useTheme,
    useSemanticColors,
    useColorVariants,
    useTypography,
    useMotionValues
} from '@/hooks/useThemeColor';

const { width, height } = Dimensions.get('window');

// Feature card data
interface FeatureAction {
    id: string;
    title: string;
    description: string;
    icon: string;
    route: string;
    colorScheme: 'primary' | 'accent' | 'neutral' | 'success';
    featured?: boolean;
}

export default function ModernIndex() {
    const { t } = useTranslation();
    const theme = useTheme();
    const semanticColors = useSemanticColors();
    const variants = useColorVariants();
    const typography = useTypography();
    const motion = useMotionValues();

    // Animations
    const pulseAnimation = useSharedValue(1);
    const floatAnimation = useSharedValue(0);

    React.useEffect(() => {
        // Subtle pulse for the main CTA
        pulseAnimation.value = withRepeat(
            withTiming(1.02, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
            -1,
            true
        );

        // Floating animation for cards
        floatAnimation.value = withRepeat(
            withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
            -1,
            true
        );
    }, []);

    const heroAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulseAnimation.value }],
    }));

    const getFloatingStyle = (delay: number) => {
        return useAnimatedStyle(() => ({
            transform: [
                {
                    translateY: interpolate(
                        floatAnimation.value,
                        [0, 1],
                        [0, -8]
                    ) * Math.sin(Date.now() / 1000 + delay),
                },
            ],
        }));
    };

    const features: FeatureAction[] = [
        {
            id: 'detection',
            title: t('buttons.objectCamera'),
            description: 'Real-time AI bird detection and classification',
            icon: 'zap',
            route: '/log/objectIdentCamera',
            colorScheme: 'primary',
            featured: true,
        },
        {
            id: 'photo',
            title: t('buttons.photo'),
            description: 'Capture and identify birds from photos',
            icon: 'camera',
            route: '/log/photo',
            colorScheme: 'accent',
        },
        {
            id: 'audio',
            title: t('buttons.audio'),
            description: 'Record and analyze bird songs',
            icon: 'mic',
            route: '/log/audio',
            colorScheme: 'primary',
        },
        {
            id: 'manual',
            title: t('buttons.manual'),
            description: 'Manual entry for field observations',
            icon: 'edit-3',
            route: '/log/manual',
            colorScheme: 'neutral',
        },
    ];

    const getColorScheme = (scheme: 'primary' | 'accent' | 'neutral' | 'success') => {
        switch (scheme) {
            case 'primary':
                return {
                    background: variants.primarySubtle,
                    icon: semanticColors.primary,
                    border: variants.primaryMuted,
                };
            case 'accent':
                return {
                    background: variants.accentSubtle,
                    icon: semanticColors.accent,
                    border: variants.accentMuted,
                };
            case 'success':
                return {
                    background: semanticColors.successContainer,
                    icon: semanticColors.success,
                    border: semanticColors.success + '40',
                };
            case 'neutral':
            default:
                return {
                    background: semanticColors.backgroundSecondary,
                    icon: semanticColors.textSecondary,
                    border: semanticColors.border,
                };
        }
    };

    const handleFeaturePress = (route: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        router.push(route as any);
    };

    const renderFeatureCard = (feature: FeatureAction, index: number) => {
        const isLarge = feature.featured;
        const cardStyle = isLarge
            ? [styles.featuredCard, getFloatingStyle(index * 0.5)]
            : [styles.regularCard, getFloatingStyle(index * 0.5)];

        const colors = getColorScheme(feature.colorScheme);

        return (
            <Animated.View key={feature.id} style={cardStyle}>
                <ModernCard
                    variant="glass"
                    onPress={() => handleFeaturePress(feature.route)}
                    animateOnPress
                    glowOnHover={feature.featured}
                    style={{
                        ...(isLarge ? styles.featuredCardInner : styles.regularCardInner),
                        borderColor: colors.border,
                    }}
                >
                    <View style={styles.cardContent}>
                        {/* Subtle background color overlay */}
                        <View
                            style={[
                                StyleSheet.absoluteFillObject,
                                {
                                    backgroundColor: colors.background,
                                    opacity: isLarge ? 0.3 : 0.2,
                                    borderRadius: theme.borderRadius.card,
                                }
                            ]}
                        />

                        {/* Icon */}
                        <View style={[
                            styles.iconContainer,
                            isLarge ? styles.featuredIconContainer : styles.regularIconContainer,
                            { backgroundColor: colors.background }
                        ]}>
                            <Feather
                                name={feature.icon as any}
                                size={isLarge ? 32 : 24}
                                color={colors.icon}
                            />
                        </View>

                        {/* Content */}
                        <View style={styles.cardTextContent}>
                            <Text
                                style={[
                                    isLarge ? typography.headlineMedium : typography.headlineSmall,
                                    styles.cardTitle,
                                    { color: semanticColors.text }
                                ]}
                                numberOfLines={isLarge ? 2 : 1}
                            >
                                {feature.title}
                            </Text>
                            <Text
                                style={[
                                    typography.bodySmall,
                                    styles.cardDescription,
                                    { color: semanticColors.textSecondary }
                                ]}
                                numberOfLines={isLarge ? 3 : 2}
                            >
                                {feature.description}
                            </Text>
                        </View>

                        {/* Arrow indicator */}
                        <View style={styles.arrowContainer}>
                            <Feather
                                name="arrow-right"
                                size={isLarge ? 20 : 16}
                                color={semanticColors.textTertiary}
                            />
                        </View>
                    </View>
                </ModernCard>
            </Animated.View>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: semanticColors.background }]}>
            {/* Background animations */}
            <BirdAnimation numberOfBirds={8} />

            {/* Multi-layer background for depth without gradients */}
            <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
                <View style={[
                    styles.backgroundLayer1,
                    { backgroundColor: semanticColors.background }
                ]} />
                <View style={[
                    styles.backgroundLayer2,
                    { backgroundColor: variants.primarySubtle }
                ]} />
                <View style={[
                    styles.backgroundLayer3,
                    { backgroundColor: semanticColors.background }
                ]} />
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Hero Section */}
                <View style={styles.heroSection}>
                    <Animated.View style={[styles.heroContent, heroAnimatedStyle]}>
                        <HelloWave />
                        <Text style={[typography.displayMedium, styles.heroTitle]}>
                            {t('welcome')}
                        </Text>
                        <Text style={[typography.bodyLarge, styles.heroSubtitle, { color: semanticColors.textSecondary }]}>
                            {t('start_logging')}
                        </Text>
                    </Animated.View>

                    {/* Quick stats */}
                    <BlurView
                        intensity={40}
                        tint={semanticColors.background === '#FFFFFF' ? 'light' : 'dark'}
                        style={[styles.statsContainer, { borderColor: variants.primaryMuted }]}
                    >
                        <View style={styles.statItem}>
                            <Text style={[typography.headlineLarge, { color: semanticColors.primary }]}>
                                15K+
                            </Text>
                            <Text style={[typography.labelMedium, { color: semanticColors.textSecondary }]}>
                                Bird Species
                            </Text>
                        </View>
                        <View style={[styles.statDivider, { backgroundColor: variants.primaryMuted }]} />
                        <View style={styles.statItem}>
                            <Text style={[typography.headlineLarge, { color: semanticColors.accent }]}>
                                AI
                            </Text>
                            <Text style={[typography.labelMedium, { color: semanticColors.textSecondary }]}>
                                Recognition
                            </Text>
                        </View>
                        <View style={[styles.statDivider, { backgroundColor: variants.primaryMuted }]} />
                        <View style={styles.statItem}>
                            <Text style={[typography.headlineLarge, { color: semanticColors.primary }]}>
                                5
                            </Text>
                            <Text style={[typography.labelMedium, { color: semanticColors.textSecondary }]}>
                                Languages
                            </Text>
                        </View>
                    </BlurView>
                </View>

                {/* Features Section */}
                <View style={styles.featuresSection}>
                    <Text style={[typography.headlineLarge, styles.sectionTitle]}>
                        Start Birding
                    </Text>
                    <Text style={[typography.bodyMedium, styles.sectionSubtitle, { color: semanticColors.textSecondary }]}>
                        Choose how you'd like to log your bird observations
                    </Text>

                    <View style={styles.featuresGrid}>
                        {features.map((feature, index) => renderFeatureCard(feature, index))}
                    </View>
                </View>

                {/* Quick Access Section */}
                <View style={styles.quickAccessSection}>
                    <Text style={[typography.headlineLarge, styles.sectionTitle]}>
                        Quick Access
                    </Text>

                    <View style={styles.quickAccessGrid}>
                        <Animated.View style={getFloatingStyle(0.8)}>
                            <ModernCard
                                variant="outlined"
                                onPress={() => router.push('/archive')}
                                animateOnPress
                                style={styles.quickAccessCard}
                            >
                                <View style={styles.quickAccessContent}>
                                    <Feather name="archive" size={24} color={semanticColors.primary} />
                                    <Text style={[typography.labelLarge, { color: semanticColors.text }]}>
                                        My Archive
                                    </Text>
                                </View>
                            </ModernCard>
                        </Animated.View>

                        <Animated.View style={getFloatingStyle(1.2)}>
                            <ModernCard
                                variant="outlined"
                                onPress={() => router.push('/birdex')}
                                animateOnPress
                                style={styles.quickAccessCard}
                            >
                                <View style={styles.quickAccessContent}>
                                    <Feather name="book-open" size={24} color={semanticColors.accent} />
                                    <Text style={[typography.labelLarge, { color: semanticColors.text }]}>
                                        Bird Guide
                                    </Text>
                                </View>
                            </ModernCard>
                        </Animated.View>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 100,
    },

    // Background layers for depth
    backgroundLayer1: {
        ...StyleSheet.absoluteFillObject,
        opacity: 1,
    },
    backgroundLayer2: {
        ...StyleSheet.absoluteFillObject,
        opacity: 0.05,
        top: height * 0.1,
    },
    backgroundLayer3: {
        ...StyleSheet.absoluteFillObject,
        opacity: 0.9,
        top: height * 0.7,
    },

    // Hero Section
    heroSection: {
        paddingHorizontal: 24,
        paddingTop: 40,
        paddingBottom: 32,
        alignItems: 'center',
        minHeight: height * 0.4,
        justifyContent: 'center',
    },
    heroContent: {
        alignItems: 'center',
        marginBottom: 32,
    },
    heroTitle: {
        textAlign: 'center',
        marginTop: 16,
        marginBottom: 8,
    },
    heroSubtitle: {
        textAlign: 'center',
        lineHeight: 24,
        maxWidth: width * 0.8,
    },

    // Stats
    statsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 20,
        borderWidth: 1,
        paddingVertical: 20,
        paddingHorizontal: 24,
        marginTop: 16,
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
    },
    statDivider: {
        width: 1,
        height: 40,
        marginHorizontal: 16,
    },

    // Features Section
    featuresSection: {
        paddingHorizontal: 24,
        marginBottom: 48,
    },
    sectionTitle: {
        marginBottom: 8,
    },
    sectionSubtitle: {
        lineHeight: 20,
        marginBottom: 24,
    },
    featuresGrid: {
        gap: 16,
    },

    // Feature Cards
    featuredCard: {
        marginBottom: 8,
    },
    featuredCardInner: {
        minHeight: 140,
        borderWidth: 1,
    },
    regularCard: {
        marginBottom: 8,
    },
    regularCardInner: {
        minHeight: 100,
        borderWidth: 1,
    },

    cardContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        position: 'relative',
    },
    iconContainer: {
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    featuredIconContainer: {
        width: 64,
        height: 64,
    },
    regularIconContainer: {
        width: 48,
        height: 48,
    },
    cardTextContent: {
        flex: 1,
        marginRight: 12,
    },
    cardTitle: {
        marginBottom: 4,
        fontWeight: '600',
    },
    cardDescription: {
        lineHeight: 18,
    },
    arrowContainer: {
        justifyContent: 'center',
    },

    // Quick Access
    quickAccessSection: {
        paddingHorizontal: 24,
        marginBottom: 32,
    },
    quickAccessGrid: {
        flexDirection: 'row',
        gap: 16,
    },
    quickAccessCard: {
        flex: 1,
        minHeight: 80,
    },
    quickAccessContent: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        gap: 8,
    },
});