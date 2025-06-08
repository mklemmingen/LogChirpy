import React, {useEffect} from 'react';
import {Dimensions, StyleSheet, View} from 'react-native';
import {Link, Stack} from 'expo-router';
import {useTranslation} from 'react-i18next';
import { Feather } from '@expo/vector-icons';
import {ThemedIcon} from '@/components/ThemedIcon';

import {ThemedView} from '@/components/ThemedView';
import {ThemedText} from '@/components/ThemedText';
import {ThemedPressable} from '@/components/ThemedPressable';
import {ModernCard} from '@/components/ModernCard';
import {useColors, useTheme, useTypography} from '@/hooks/useThemeColor';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Static Bird Icon Component
function LostBirdIcon() {
  const colors = useColors();

  return (
      <View
          style={{
            width: 120,
            height: 120,
            borderRadius: 60,
            backgroundColor: colors.backgroundSecondary,
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 32,
          }}
      >
        <ThemedIcon name="help-circle" size={48} color="primary" />
      </View>
  );
}

// Static Floating Elements Background
function FloatingElements() {
  const colors = useColors();

  const elements: Array<{ icon: keyof typeof Feather.glyphMap; delay: number }> = [
    { icon: 'feather', delay: 0 },
    { icon: 'map-pin', delay: 500 },
    { icon: 'camera', delay: 1000 },
    { icon: 'mic', delay: 1500 },
  ];

  return (
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        {elements.map((element, index) => (
          <View
              key={index}
              style={{
                position: 'absolute',
                left: (index % 2 === 0 ? 30 : SCREEN_WIDTH - 80) + (index * 20),
                top: 100 + (index * 80),
              }}
          >
            <View
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 25,
                  backgroundColor: colors.backgroundSecondary,
                  justifyContent: 'center',
                  alignItems: 'center',
                  opacity: 0.15,
                }}
            >
              <ThemedIcon
                  name={element.icon}
                  size={20}
                  color="tertiary"
              />
            </View>
          </View>
        ))}
      </View>
  );
}

export default function NotFoundScreen() {
  const theme = useTheme();
  const colors = useColors();
  const typography = useTypography();
  const { t } = useTranslation();

  return (
      <ThemedView background="primary" style={styles.container}>
        <Stack.Screen options={{
          title: t('not_found.page_title'),
          headerShown: false
        }} />

        {/* Floating background elements */}
        <FloatingElements />

        {/* Main content */}
        <View style={styles.content}>
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
                  <ThemedIcon name="home" size={20} color="primary" />
                  <ThemedText
                      variant="labelLarge"
                      color="primary"
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
        </View>
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