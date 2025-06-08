import React from 'react';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/ThemedText';
import { useResponsiveDimensions } from '@/hooks/useResponsiveDimensions';
import { useTheme } from '@/hooks/useThemeColor';

export function HelloWave() {
  const rotationAnimation = useSharedValue(0);
  const dimensions = useResponsiveDimensions();
  const theme = useTheme();

  useEffect(() => {
    rotationAnimation.value = withRepeat(
      withSequence(withTiming(25, { duration: 150 }), withTiming(0, { duration: 150 })),
      4 // Run the animation 4 times
    );
  }, [rotationAnimation]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotationAnimation.value}deg` }],
  }));

  const dynamicFontSize = Math.max(28 * dimensions.multipliers.font, 24);
  const dynamicLineHeight = dynamicFontSize * 1.14;

  return (
    <Animated.View style={animatedStyle}>
      <ThemedText style={{
        fontSize: dynamicFontSize,
        lineHeight: dynamicLineHeight,
        marginTop: -theme.spacing.xs,
      }}>👋</ThemedText>
    </Animated.View>
  );
}
