/**
 * Simplified Bird Animation Component
 * 
 * Lightweight alternative to the complex BirdAnimation component.
 * Uses optimized patterns to prevent view hierarchy conflicts.
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';

import { useResponsiveDimensions } from '@/hooks/useResponsiveDimensions';
import { Z_LAYERS } from '@/constants/layers';

interface SimpleBirdAnimationProps {
  numberOfBirds?: number;
  enabled?: boolean;
}

interface BirdConfig {
  id: number;
  startDelay: number;
  duration: number;
  amplitude: number;
}

export const SimpleBirdAnimation: React.FC<SimpleBirdAnimationProps> = ({
  numberOfBirds = 3,
  enabled = true,
}) => {
  const dimensions = useResponsiveDimensions();
  const { width: screenWidth, height: screenHeight } = dimensions.screen;

  // Generate bird configurations once
  const birdsConfig = useRef<BirdConfig[]>(
    Array.from({ length: numberOfBirds }, (_, index) => ({
      id: index,
      startDelay: index * 2000, // 2 second stagger
      duration: 8000 + Math.random() * 4000, // 8-12 seconds
      amplitude: 30 + Math.random() * 20, // 30-50px wave amplitude
    }))
  ).current;

  if (!enabled) {
    return null;
  }

  return (
    <View style={styles.container} pointerEvents="none">
      {birdsConfig.map((bird) => (
        <BirdElement
          key={bird.id}
          config={bird}
          screenWidth={screenWidth}
          screenHeight={screenHeight}
        />
      ))}
    </View>
  );
};

interface BirdElementProps {
  config: BirdConfig;
  screenWidth: number;
  screenHeight: number;
}

const BirdElement: React.FC<BirdElementProps> = ({
  config,
  screenWidth,
  screenHeight,
}) => {
  const translateX = useSharedValue(-50);
  const translateY = useSharedValue(screenHeight * 0.3 + Math.random() * screenHeight * 0.4);
  const opacity = useSharedValue(0);

  useEffect(() => {
    // Start animation with delay
    const startAnimation = () => {
      opacity.value = withTiming(1, { duration: 1000 });
      
      translateX.value = withRepeat(
        withDelay(
          config.startDelay,
          withTiming(screenWidth + 50, {
            duration: config.duration,
            easing: Easing.linear,
          })
        ),
        -1, // infinite repeat
        false
      );

      // Add subtle wave motion
      translateY.value = withRepeat(
        withTiming(
          translateY.value + config.amplitude,
          {
            duration: config.duration / 4,
            easing: Easing.inOut(Easing.sin),
          }
        ),
        -1,
        true // reverse
      );
    };

    startAnimation();
  }, [config, screenWidth, screenHeight]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
      ],
      opacity: opacity.value,
    };
  });

  return (
    <Animated.View style={[styles.bird, animatedStyle]}>
      <View style={styles.birdShape} />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: Z_LAYERS.CONTENT,
  },
  bird: {
    position: 'absolute',
    width: 20,
    height: 20,
  },
  birdShape: {
    width: 20,
    height: 20,
    backgroundColor: '#333',
    borderRadius: 10,
    opacity: 0.6,
  },
});

export default SimpleBirdAnimation;