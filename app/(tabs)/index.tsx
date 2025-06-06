import React from 'react';
import { Dimensions, SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
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
import { useColors, useTypography, useBorderRadius } from '@/hooks/useThemeColor';

const { width, height } = Dimensions.get('window');

interface FeatureAction {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof Feather.glyphMap;
  route: string;
  primary?: boolean;
}

export default function HomeScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const typography = useTypography();
  const borderRadius = useBorderRadius();

  // Subtle floating animation
  const floatAnimation = useSharedValue(0);

  React.useEffect(() => {
    floatAnimation.value = withRepeat(
      withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  const getFloatingStyle = (delay: number) => {
    return useAnimatedStyle(() => ({
      transform: [
        {
          translateY: interpolate(
            floatAnimation.value,
            [0, 1],
            [0, -4]
          ) * Math.sin(Date.now() / 1000 + delay),
        },
      ],
    }));
  };

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

  const handleFeaturePress = (route: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(route as any);
  };

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
                { backgroundColor: isPrimary ? colors.backgroundTertiary : colors.backgroundSecondary }
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
              name="arrow-right"
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
      {/* Background animations */}
      <BirdAnimation numberOfBirds={6} />

      <SafeAreaView style={styles.safeArea}>
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
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },

  // Hero Section
  heroSection: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
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
    maxWidth: width * 0.8,
  },

  // Features Section
  featuresSection: {
    paddingHorizontal: 24,
    gap: 16,
  },

  // Feature Cards
  featureCard: {
    minHeight: 80,
  },
  primaryCard: {
    minHeight: 90,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconContainer: {
    width: 48,
    height: 48,
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