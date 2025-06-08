import React from 'react';
import type { PropsWithChildren, ReactElement } from 'react';
import {StyleSheet, useColorScheme} from 'react-native';
import Animated, {
  interpolate,
  useAnimatedRef,
  useAnimatedStyle,
  useScrollViewOffset,
} from 'react-native-reanimated';

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
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollOffset = useScrollViewOffset(scrollRef);
  const bottom = useBottomTabOverflow();
  const dimensions = useResponsiveDimensions();
  const theme = useTheme();
  
  const HEADER_HEIGHT = dimensions.screen.isTablet ? 350 : dimensions.screen.isSmall ? 200 : 250;
  const styles = createStyles(dimensions, HEADER_HEIGHT);
  
  const headerAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY: interpolate(
            scrollOffset.value,
            [-HEADER_HEIGHT, 0, HEADER_HEIGHT],
            [-HEADER_HEIGHT / 2, 0, HEADER_HEIGHT * 0.75]
          ),
        },
        {
          scale: interpolate(scrollOffset.value, [-HEADER_HEIGHT, 0, HEADER_HEIGHT], [2, 1, 1]),
        },
      ],
    };
  });

  return (
    <ThemedView style={styles.container}>
      <Animated.ScrollView
        ref={scrollRef}
        scrollEventThrottle={16}
        scrollIndicatorInsets={{ bottom }}
        contentContainerStyle={{ paddingBottom: bottom }}>
        <Animated.View
          style={[
            styles.header,
            { backgroundColor: headerBackgroundColor[colorScheme] },
            headerAnimatedStyle,
          ]}>
          {headerImage}
        </Animated.View>
        <ThemedView style={styles.content}>{children}</ThemedView>
      </Animated.ScrollView>
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
