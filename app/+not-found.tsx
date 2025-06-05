import React, {useEffect} from 'react';
import {Dimensions, StyleSheet, View} from 'react-native';
import {Link, Stack} from 'expo-router';
import {useTranslation} from 'react-i18next';
import {ThemedIcon} from '@/components/ThemedIcon';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import {ThemedView} from '@/components/ThemedView';
import {ThemedText} from '@/components/ThemedText';
import {ThemedPressable} from '@/components/ThemedPressable';
import {ModernCard} from '@/components/ModernCard';
import {useColors, useTheme, useTypography} from '@/hooks/useThemeColor';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Animated Bird Icon Component
function LostBirdIcon() {
  const colors = useColors();

  const rotation = useSharedValue(0);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.7);

  useEffect(() => {
    // Gentle swaying motion
    rotation.value = withRepeat(
        withSequence(
            withTiming(-10, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
            withTiming(10, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false
    );

    // Breathing scale animation
    scale.value = withRepeat(
        withTiming(1.1, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
    );

    // Fade in
    opacity.value = withTiming(1, { duration: 1000 });
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${rotation.value}deg` },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  return (
      <Animated.View
          style={[
            {
              width: 120,
              height: 120,
              borderRadius: 60,
              backgroundColor: colors.backgroundSecondary,
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 32,
            },
            animatedStyle,
          ]}
      >
        <ThemedIcon name="help-circle" size={48} color="primary" />
      </Animated.View>
  );
}

// Floating Elements Background
function FloatingElements() {
  const colors = useColors();

  const elements = [
    { icon: 'feather', delay: 0 },
    { icon: 'map-pin', delay: 500 },
    { icon: 'camera', delay: 1000 },
    { icon: 'mic', delay: 1500 },
  ];

  return (
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        {elements.map((element, index) => {
          const FloatingElement = () => {
            const translateY = useSharedValue(50);
            const opacity = useSharedValue(0);
            const scale = useSharedValue(0.8);

            useEffect(() => {
              setTimeout(() => {
                translateY.value = withRepeat(
                    withSequence(
                        withTiming(-20, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
                        withTiming(20, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
                    ),
                    -1,
                    false
                );

                opacity.value = withTiming(0.15, { duration: 1000 });
                scale.value = withTiming(1, { duration: 1000 });
              }, element.delay);
            }, []);

            const animatedStyle = useAnimatedStyle(() => ({
              transform: [
                { translateY: translateY.value },
                { scale: scale.value },
              ],
              opacity: opacity.value,
            }));

            return (
                <Animated.View
                    style={[
                      {
                        position: 'absolute',
                        left: (index % 2 === 0 ? 30 : SCREEN_WIDTH - 80) + (index * 20),
                        top: 100 + (index * 80),
                      },
                      animatedStyle,
                    ]}
                >
                  <View
                      style={{
                        width: 50,
                        height: 50,
                        borderRadius: 25,
                        backgroundColor: colors.backgroundSecondary,
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                  >
                    <ThemedIcon
                        name={element.icon}
                        size={20}
                        color="tertiary"
                    />
                  </View>
                </Animated.View>
            );
          };

          return <FloatingElement key={index} />;
        })}
      </View>
  );
}

export default function NotFoundScreen() {
  const theme = useTheme();
  const colors = useColors();
  const typography = useTypography();
  const { t } = useTranslation();

  // Animation values for the main content
  const contentOpacity = useSharedValue(0);
  const contentTranslateY = useSharedValue(30);

  useEffect(() => {
    // Staggered entrance animation
    setTimeout(() => {
      contentOpacity.value = withTiming(1, {
        duration: theme.motion.duration.normal
      });
      contentTranslateY.value = withSpring(0, {
        damping: 20,
        stiffness: 300,
      });
    }, 200);
  }, []);

  const contentAnimatedStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ translateY: contentTranslateY.value }],
  }));

  return (
      <ThemedView background="primary" style={styles.container}>
        <Stack.Screen options={{
          title: t('not_found.page_title'),
          headerShown: false
        }} />

        {/* Floating background elements */}
        <FloatingElements />

        {/* Main content */}
        <Animated.View style={[styles.content, contentAnimatedStyle]}>
          <ModernCard
              elevated={false}
              bordered={true}
              style={styles.card}
          >
            {/* Lost bird illustration */}
            <View style={styles.illustration}>
              <LostBirdIcon />
            </View>

            {/* Error message */}
            <View style={styles.messageContainer}>
              <ThemedText
                  variant="displayMedium"
                  style={[styles.title, { textAlign: 'center' }]}
              >
                {t('not_found.nest_not_found')}
              </ThemedText>

              <ThemedText
                  variant="bodyLarge"
                  color="secondary"
                  style={[styles.subtitle, { textAlign: 'center' }]}
              >
                {t('not_found.page_description')}
              </ThemedText>
            </View>

            {/* Action buttons */}
            <View style={styles.actions}>
              <Link href="/" asChild>
                <ThemedPressable
                    variant="primary"
                    size="lg"
                    style={styles.primaryAction}
                >
                  <ThemedIcon name="home" size={20} color="inverse" />
                  <ThemedText
                      variant="labelLarge"
                      color="inverse"
                  >
                    {t('not_found.return_to_nest')}
                  </ThemedText>
                </ThemedPressable>
              </Link>

              <Link href="/(tabs)" asChild>
                <ThemedPressable
                    variant="secondary"
                    size="lg"
                    style={styles.secondaryAction}
                >
                  <ThemedIcon name="map" size={20} color="primary" />
                  <ThemedText variant="labelLarge">
                    {t('not_found.explore_birdex')}
                  </ThemedText>
                </ThemedPressable>
              </Link>
            </View>

            {/* Fun fact */}
            <View style={[styles.funFact, { backgroundColor: colors.backgroundSecondary }]}>
              <ThemedIcon name="info" size={16} color="primary" />
              <ThemedText
                  variant="labelMedium"
                  color="primary"
                  style={{ flex: 1, lineHeight: 18 }}
              >
                {t('not_found.fun_fact')}
              </ThemedText>
            </View>
          </ModernCard>
        </Animated.View>
      </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  card: {
    padding: 32,
    alignItems: 'center',
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
  },
  illustration: {
    alignItems: 'center',
    marginBottom: 8,
  },
  messageContainer: {
    alignItems: 'center',
    marginBottom: 32,
    gap: 12,
  },
  title: {
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    lineHeight: 24,
    maxWidth: 300,
  },
  actions: {
    width: '100%',
    gap: 16,
    marginBottom: 24,
  },
  primaryAction: {
    flexDirection: 'row',
    gap: 8,
  },
  secondaryAction: {
    flexDirection: 'row',
    gap: 8,
  },
  funFact: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    width: '100%',
  },
});