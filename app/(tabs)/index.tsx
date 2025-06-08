import React from 'react';
import { Dimensions, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ThemedIcon } from '@/components/ThemedIcon';
import { Feather } from '@expo/vector-icons';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { HelloWave } from '@/components/HelloWave';
import BirdAnimation from '@/components/BirdAnimationJS';
import { ModernCard } from '@/components/ModernCard';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ThemedSafeAreaView } from '@/components/ThemedSafeAreaView';
import { useColors, useTypography, useBorderRadius } from '@/hooks/useThemeColor';
import { useUnifiedColors } from '@/hooks/useUnifiedColors';
import { useResponsiveDimensions } from '@/hooks/useResponsiveDimensions';

const { width, height } = Dimensions.get('window');

/**
 * Interface for feature action cards displayed on home screen
 */
interface FeatureAction {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof Feather.glyphMap;
  route: string;
  primary?: boolean;
}

/**
 * Home Screen Component with responsive design and smooth animations
 * Main landing screen providing quick access to core app features
 * 
 * @returns {JSX.Element} Home screen with hero section and feature cards
 */
export default function HomeScreen() {
  const { t } = useTranslation();
  const colors = useUnifiedColors();
  const typography = useTypography();
  const borderRadius = useBorderRadius();
  const dimensions = useResponsiveDimensions();
  
  const styles = createStyles(dimensions);

  // Subtle floating animation
  const floatAnimation = useSharedValue(0);

  React.useEffect(() => {
    floatAnimation.value = withRepeat(
      withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  /**
   * Creates floating animation style for feature cards
   * 
   * @param {number} delay - Animation delay for staggered effect
   * @returns {Object} Animated style object with transform
   */
  const getFloatingStyle = React.useCallback((delay: number) => {
    return useAnimatedStyle(() => {
      'worklet';
      return {
        transform: [
          {
            translateY: interpolate(
              floatAnimation.value,
              [0, 1],
              [0, -dimensions.screen.isSmall ? 2 : 4]
            ) * Math.sin(floatAnimation.value * 2 + delay),
          },
        ],
      };
    });
  }, [floatAnimation, dimensions.screen.isSmall]);

  const features: FeatureAction[] = [
    {
      id: 'detection',
      title: t('buttons.objectCamera'),
      description: t('home.camera_description'),
      icon: 'zap',
      route: '/log/objectIdentCamera',
      primary: true,
    },
    {
      id: 'photo',
      title: t('buttons.photo'),
      description: t('home.photo_description'),
      icon: 'camera',
      route: '/log/photo',
    },
    {
      id: 'audio',
      title: t('buttons.audio'),
      description: t('home.audio_description'),
      icon: 'mic',
      route: '/log/audio',
    },
    {
      id: 'manual',
      title: t('buttons.manual'),
      description: t('home.manual_description'),
      icon: 'edit-3',
      route: '/log/manual',
    },
  ];

  /**
   * Handles feature card press with haptic feedback and navigation
   * 
   * @param {string} route - Route to navigate to
   */
  const handleFeaturePress = (route: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(route as any);
  };

  /**
   * Renders individual feature card with responsive design and accessibility
   * 
   * @param {FeatureAction} feature - Feature data for the card
   * @param {number} index - Index for staggered animations
   * @returns {JSX.Element} Animated feature card
   */
  const renderFeatureCard = (feature: FeatureAction, index: number) => {
    const isPrimary = feature.primary;

    return (
      <Animated.View key={feature.id} style={getFloatingStyle(index * 0.5)}>
        <ModernCard
          onPress={() => handleFeaturePress(feature.route)}
          elevated={isPrimary}
          bordered={!isPrimary}
        >
          <View style={styles.cardContent}>
            {/* Icon */}
            <ThemedView
              style={[
                styles.iconContainer,
                { 
                  backgroundColor: isPrimary ? colors.background.tertiary : colors.background.secondary,
                  width: dimensions.icon.xxl,
                  height: dimensions.icon.xxl,
                  borderRadius: dimensions.card.borderRadius.md,
                }
              ]}
              rounded="lg"
            >
              <ThemedIcon
                name={feature.icon}
                size={dimensions.icon.lg}
                color="primary"
              />
            </ThemedView>

            {/* Content */}
            <View style={styles.cardTextContent}>
              <ThemedText variant="h3" style={styles.cardTitle}>
                {feature.title}
              </ThemedText>
              <ThemedText 
                variant="bodySmall" 
                color="secondary" 
                style={styles.cardDescription}
              >
                {feature.description}
              </ThemedText>
            </View>

            {/* Arrow */}
            <ThemedIcon
              name="chevron-right"
              size={dimensions.icon.sm}
              color="tertiary"
            />
          </View>
        </ModernCard>
      </Animated.View>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedSafeAreaView style={styles.safeArea}>

        {/* Bird Animation */}
        {/* commented out Bird Animation <BirdAnimation numberOfBirds={3} /> */}

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero Section */}
          <View style={styles.heroSection}>
            <View style={styles.heroContent}>
              <HelloWave />
              <ThemedText variant="h1" center style={styles.heroTitle}>
                {t('welcome')}
              </ThemedText>
              <ThemedText 
                variant="body" 
                color="secondary" 
                center 
                style={styles.heroSubtitle}
              >
                {t('start_logging')}
              </ThemedText>
            </View>
          </View>

          {/* Features Section */}
          <View style={styles.featuresSection}>
            {features.map((feature, index) => renderFeatureCard(feature, index))}
          </View>
        </ScrollView>
      </ThemedSafeAreaView>
    </ThemedView>
  );
}

const createStyles = (dimensions: ReturnType<typeof useResponsiveDimensions>) => StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: dimensions.layout.sectionSpacing,
  },

  // Hero Section
  heroSection: {
    paddingHorizontal: dimensions.layout.screenPadding.horizontal,
    paddingTop: dimensions.screen.isSmall ? 40 : 60,
    paddingBottom: dimensions.layout.sectionSpacing,
    alignItems: 'center',
    minHeight: height * 0.3,
    justifyContent: 'center',
  },
  heroContent: {
    alignItems: 'center',
  },
  heroTitle: {
    marginTop: dimensions.layout.componentSpacing,
    marginBottom: dimensions.layout.componentSpacing / 2,
  },
  heroSubtitle: {
    lineHeight: dimensions.screen.isSmall ? 20 : 24,
    maxWidth: width * 0.85,
  },

  // Features Section
  featuresSection: {
    paddingHorizontal: dimensions.layout.screenPadding.horizontal,
    gap: dimensions.layout.componentSpacing,
  },

  // Feature Cards
  featureCard: {
    minHeight: dimensions.listItem.minHeight,
  },
  primaryCard: {
    minHeight: dimensions.listItem.minHeight + 10,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: dimensions.layout.componentSpacing,
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTextContent: {
    flex: 1,
  },
  cardTitle: {
    marginBottom: dimensions.layout.componentSpacing / 4,
  },
  cardDescription: {
    lineHeight: dimensions.screen.isSmall ? 16 : 18,
  },
});