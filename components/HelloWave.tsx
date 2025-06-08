import React from 'react';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
// COMMENTED OUT FOR DEBUGGING: Animation imports
// import Animated, {
//   useSharedValue,
//   useAnimatedStyle,
//   withTiming,
//   withRepeat,
//   withSequence,
// } from 'react-native-reanimated';

import { ThemedText } from '@/components/ThemedText';
import { useResponsiveDimensions } from '@/hooks/useResponsiveDimensions';
import { useTheme } from '@/hooks/useThemeColor';

export function HelloWave() {
  // COMMENTED OUT FOR DEBUGGING: Animation
  // const rotationAnimation = useSharedValue(0);
  const dimensions = useResponsiveDimensions();
  const theme = useTheme();

  // COMMENTED OUT FOR DEBUGGING: Animation effects
  // useEffect(() => {
  //   rotationAnimation.value = withRepeat(
  //     withSequence(withTiming(25, { duration: 150 }), withTiming(0, { duration: 150 })),
  //     4 // Run the animation 4 times
  //   );
  // }, [rotationAnimation]);

  // COMMENTED OUT FOR DEBUGGING: Animation style
  // const animatedStyle = useAnimatedStyle(() => ({
  //   transform: [{ rotate: `${rotationAnimation.value}deg` }],
  // }));

  const dynamicFontSize = Math.max(28 * dimensions.multipliers.font, 24);
  const dynamicLineHeight = dynamicFontSize * 1.14;

  return (
    <View /* COMMENTED OUT FOR DEBUGGING: style={animatedStyle} */>
      <ThemedText style={{
        fontSize: dynamicFontSize,
        lineHeight: dynamicLineHeight,
        marginTop: -theme.spacing.xs,
      }}>👋</ThemedText>
    </View>
  );
}
