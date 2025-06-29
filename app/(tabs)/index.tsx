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
import { ThemedPressable } from '@/components/ThemedPressable';
import { useColors, useShadows } from '@/hooks/useThemeColor';

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
  const shadows = useShadows();

  const styles = createStyles(colors, shadows);

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

  const mlModeFeatures: FeatureAction[] = [
    {
      id: 'ml-both',
      title: t('home.ml_modes.image_audio_title', 'Image+Audio'),
      description: t('home.ml_modes.image_audio_description', 'Full ML detection with both image and audio analysis'),
      icon: 'zap',
      route: '/log/objectIdentCamera',
      primary: true,
    },
    {
      id: 'ml-image',
      title: t('home.ml_modes.image_only_title', 'Image Only'),
      description: t('home.ml_modes.image_only_description', 'Visual bird detection and classification'),
      icon: 'eye',
      route: '/log/objectIdentCamera?enableAudio=false',
    },
    {
      id: 'ml-audio',
      title: t('home.ml_modes.audio_only_title', 'Audio Only'),
      description: t('home.ml_modes.audio_only_description', 'Bird sound recognition and identification'),
      icon: 'headphones',
      route: '/log/objectIdentCamera?enableImage=false',
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
          bordered={!isPrimary || colors.isDark}
        >
          <View style={styles.cardContent}>
            {/* Icon */}
            <ThemedView
              style={[
                styles.iconContainer,
                {
                  backgroundColor: isPrimary ? colors.backgroundTertiary : colors.backgroundSecondary,
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                }
              ]}
              rounded="lg"
            >
              <ThemedIcon
                name={feature.icon}
                size={20}
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

  /**
   * Renders compact horizontal ML mode button
   * 
   * @param {FeatureAction} feature - ML mode feature data
   * @returns {JSX.Element} Compact horizontal button
   */
  const renderMLModeButton = (feature: FeatureAction) => {
    const isPrimary = feature.primary;

    return (
      <Animated.View key={feature.id} style={[floatingStyle, styles.mlButtonContainer]}>
        <ModernCard
          onPress={() => handleFeaturePress(feature.route)}
          elevated={isPrimary}
          bordered={!isPrimary || colors.isDark}
        >
          <View style={styles.mlButtonContent}>
            {/* Icon */}
            <ThemedView
              style={[
                styles.mlIconContainer,
                {
                  backgroundColor: isPrimary ? colors.backgroundTertiary : colors.backgroundSecondary,
                }
              ]}
              rounded="lg"
            >
              <ThemedIcon
                name={feature.icon}
                size={14}
                color="primary"
              />
            </ThemedView>

            {/* Content */}
            <View style={styles.mlButtonTextContent}>
              <ThemedText variant="bodySmall" style={styles.mlButtonTitle}>
                {feature.title}
              </ThemedText>
              <ThemedText
                variant="caption"
                color="secondary"
                style={styles.mlButtonDescription}
                numberOfLines={2}
              >
                {feature.description}
              </ThemedText>
            </View>
          </View>
        </ModernCard>
      </Animated.View>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedSafeAreaView style={styles.safeArea}>

        {/* Tutorial Button - Fixed Position */}
        <ThemedPressable
          onPress={() => router.push('/tutorial')}
          style={styles.tutorialButton}
        >
          <ThemedIcon name="book-open" size={20} color="secondary" />
          <ThemedText variant="caption" color="secondary" style={styles.tutorialText}>
            {t('settings.tutorial.title', 'Tutorial')}
          </ThemedText>
        </ThemedPressable>

        {/* Bird Animation */}
        <BirdAnimation numberOfBirds={5} />

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

          {/* ML Detection Modes Section */}
          <View style={styles.mlModesSection}>
            <ThemedText variant="h3" style={styles.sectionTitle}>
              {t('home.sections.ai_detection_modes', 'AI Detection Modes')}
            </ThemedText>
            <View style={styles.mlButtonsContainer}>
              {mlModeFeatures.map((feature) => renderMLModeButton(feature))}
            </View>
          </View>

          {/* Other Features Section */}
          <View style={styles.featuresSection}>
            <ThemedText variant="h3" style={styles.sectionTitle}>
              {t('home.sections.logging_options', 'Logging Options')}
            </ThemedText>
            {features.map((feature, index) => renderFeatureCard(feature, index))}
          </View>
        </ScrollView>
      </ThemedSafeAreaView>
    </ThemedView>
  );
}

const createStyles = (colors: any, shadows: any) => StyleSheet.create({
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

  // ML Modes Section
  mlModesSection: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  mlButtonsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  mlButtonContainer: {
    flex: 1,
  },
  mlButtonContent: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    minHeight: 60,
  },
  mlIconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 24,
    height: 24,
    borderRadius: 6,
    marginBottom: 4,
  },
  mlButtonTextContent: {
    alignItems: 'center',
    flex: 1,
  },
  mlButtonTitle: {
    marginBottom: 2,
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 11,
  },
  mlButtonDescription: {
    lineHeight: 12,
    textAlign: 'center',
    fontSize: 10,
  },

  // Section Titles
  sectionTitle: {
    marginBottom: 4,
    fontWeight: '600',
  },

  // Features Section
  featuresSection: {
    paddingHorizontal: 16,
    gap: 8,
  },

  // Feature Cards
  featureCard: {
    minHeight: 60,
  },
  primaryCard: {
    minHeight: 65,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTextContent: {
    flex: 1,
  },
  cardTitle: {
    marginBottom: 2,
  },
  cardDescription: {
    lineHeight: 16,
  },

  // Tutorial Button
  tutorialButton: {
    position: 'absolute',
    top: 60,
    left: 16,
    zIndex: 1000,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.backgroundSecondary,
    ...shadows.sm,
  },
  tutorialText: {
    fontSize: 12,
    fontWeight: '600',
  },
});