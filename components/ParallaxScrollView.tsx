import React from 'react';
import type { PropsWithChildren, ReactElement } from 'react';
import {StyleSheet, useColorScheme, ScrollView, View} from 'react-native';

import { ThemedView } from '@/components/ThemedView';
import { useBottomTabOverflow } from '@/components/ui/TabBarBackground';
import { useResponsiveDimensions } from '@/hooks/useResponsiveDimensions';
import { useTheme } from '@/hooks/useThemeColor';

type Props = PropsWithChildren<{
  headerImage: ReactElement;
  headerBackgroundColor: { dark: string; light: string };
}>;

export default function ParallaxScrollView({
  children,
  headerImage,
  headerBackgroundColor,
}: Props) {
  const colorScheme = useColorScheme() ?? 'light';
  const bottom = useBottomTabOverflow();
  const dimensions = useResponsiveDimensions();
  const theme = useTheme();
  
  const HEADER_HEIGHT = dimensions.screen.isTablet ? 350 : dimensions.screen.isSmall ? 200 : 250;
  const styles = createStyles(dimensions, HEADER_HEIGHT);

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        scrollEventThrottle={16}
        scrollIndicatorInsets={{ bottom }}
        contentContainerStyle={{ paddingBottom: bottom }}>
        <View
          style={[
            styles.header,
            { backgroundColor: headerBackgroundColor[colorScheme] },
          ]}>
          {headerImage}
        </View>
        <ThemedView style={styles.content}>{children}</ThemedView>
      </ScrollView>
    </ThemedView>
  );
}

const createStyles = (dimensions: ReturnType<typeof useResponsiveDimensions>, headerHeight: number) => StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: headerHeight,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    padding: dimensions.layout.screenPadding.horizontal,
    gap: dimensions.layout.componentSpacing,
    overflow: 'hidden',
  },
});
