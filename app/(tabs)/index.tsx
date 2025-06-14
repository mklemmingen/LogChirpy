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
import { useColors } from '@/hooks/useThemeColor';

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
 * Home screen component
 * Main landing screen providing quick access to core app features
 * 
 * @returns {JSX.Element} Home screen with hero section and feature cards
 */
export default function HomeScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  
  const styles = createStyles();

  // Floating animation
  const floatAnimation = useSharedValue(0);

  React.useEffect(() => {
    floatAnimation.value = withRepeat(
      withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [floatAnimation]);

  /**
   * Creates floating animation style for feature cards
   */
  const floatingStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      transform: [
        {
          translateY: interpolate(
            floatAnimation.value,
            [0, 1],
            [0, -4]
          ),
        },
      ],
    };
  });

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
   * Handles feature card press
   * 
   * @param {string} route - Route to navigate to
   */
  const handleFeaturePress = (route: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(route as any);
  };

  /**
   * Renders individual feature card
   * 
   * @param {FeatureAction} feature - Feature data for the card
   * @param {number} index - Index for staggered animations
   * @returns {JSX.Element} Animated feature card
   */
  const renderFeatureCard = (feature: FeatureAction, index: number) => {
    const isPrimary = feature.primary;

    return (
      <Animated.View key={feature.id} style={floatingStyle}>
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
                  backgroundColor: isPrimary ? colors.backgroundTertiary : colors.backgroundSecondary,
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                }
              ]}
              rounded="lg"
            >
              <ThemedIcon
                name={feature.icon}
                size={24}
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
              size={16}
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
        <BirdAnimation numberOfBirds={7} />

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

const createStyles = () => StyleSheet.create({
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
    paddingBottom: 32,
  },

  // Hero Section
  heroSection: {
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 32,
    alignItems: 'center',
    minHeight: height * 0.3,
    justifyContent: 'center',
  },
  heroContent: {
    alignItems: 'center',
  },
  heroTitle: {
    marginTop: 16,
    marginBottom: 8,
  },
  heroSubtitle: {
    lineHeight: 24,
    maxWidth: width * 0.85,
  },

  // Features Section
  featuresSection: {
    paddingHorizontal: 16,
    gap: 16,
  },

  // Feature Cards
  featureCard: {
    minHeight: 72,
  },
  primaryCard: {
    minHeight: 82,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTextContent: {
    flex: 1,
  },
  cardTitle: {
    marginBottom: 4,
  },
  cardDescription: {
    lineHeight: 18,
  },
});