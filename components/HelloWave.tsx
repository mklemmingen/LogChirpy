import React from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { useResponsiveDimensions } from '@/hooks/useResponsiveDimensions';
import { useTheme } from '@/hooks/useThemeColor';

export function HelloWave() {
  const dimensions = useResponsiveDimensions();
  const theme = useTheme();

  const dynamicFontSize = Math.max(28 * dimensions.multipliers.font, 24);
  const dynamicLineHeight = dynamicFontSize * 1.14;

  return (
    <View>
      <ThemedText style={{
        fontSize: dynamicFontSize,
        lineHeight: dynamicLineHeight,
        marginTop: -theme.spacing.xs,
      }}>👋</ThemedText>
    </View>
  );
}
