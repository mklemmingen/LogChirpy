import React from 'react';
import {Dimensions, SafeAreaView, ScrollView, StyleSheet, Text, View,} from 'react-native';
import {router} from 'expo-router';
import {useTranslation} from 'react-i18next';
import {Feather} from '@expo/vector-icons';
import Animated, {
    Easing,
    interpolate,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import {HelloWave} from '@/components/HelloWave';
import BirdAnimation from '@/components/BirdAnimationJS';
import {ModernCard} from '@/components/ModernCard';
import {useColorVariants, useMotionValues, useSemanticColors, useTheme, useTypography} from '@/hooks/useThemeColor';

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
                    background: variants.primarySubtle,
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
                    background: variants.primarySubtle,
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
                </View>

                {/* Features Section */}
                <View style={styles.featuresSection}>
                    <View style={styles.featuresGrid}>
                        {features.map((feature, index) => renderFeatureCard(feature, index))}
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

    },

    // Hero Section
    heroSection: {
        paddingHorizontal: 24,
        paddingTop: 80,
        paddingBottom: 2,
        alignItems: 'center',
        minHeight: height * 0.4,
        justifyContent: 'center',
    },
    heroContent: {
        alignItems: 'center',
        marginBottom: 12,
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

    // Features Section
    featuresSection: {
        paddingHorizontal: 24,
    },
    sectionTitle: {
        marginBottom: 3,
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
        minHeight: 70,
        borderWidth: 1,
    },
    regularCard: {
        marginBottom: 8,
    },
    regularCardInner: {
        minHeight: 60,
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
});