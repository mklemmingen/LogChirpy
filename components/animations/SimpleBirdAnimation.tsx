/**
 * Simplified Bird Animation Component
 * 
 * Lightweight alternative using React Native's built-in Animated API.
 * No reanimated dependency - prevents view hierarchy conflicts.
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

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
  const translateX = useRef(new Animated.Value(-50)).current;
  const translateY = useRef(new Animated.Value(screenHeight * 0.3 + Math.random() * screenHeight * 0.4)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Start animation with delay
    const startAnimation = () => {
      // Fade in
      Animated.timing(opacity, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }).start();
      
      // Horizontal movement (infinite loop)
      const moveHorizontal = () => {
        translateX.setValue(-50);
        Animated.timing(translateX, {
          toValue: screenWidth + 50,
          duration: config.duration,
          useNativeDriver: true,
        }).start(() => {
          // Restart animation
          setTimeout(moveHorizontal, config.startDelay);
        });
      };

      // Start horizontal movement after initial delay
      setTimeout(moveHorizontal, config.startDelay);

      // Vertical wave motion
      const waveMotion = () => {
        const currentY = (translateY as any)._value;
        Animated.sequence([
          Animated.timing(translateY, {
            toValue: currentY + config.amplitude,
            duration: config.duration / 4,
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: currentY - config.amplitude,
            duration: config.duration / 4,
            useNativeDriver: true,
          }),
        ]).start(() => waveMotion()); // Loop wave motion
      };

      waveMotion();
    };

    startAnimation();
  }, [config, screenWidth, screenHeight, translateX, translateY, opacity]);

  return (
    <Animated.View 
      style={[
        styles.bird, 
        {
          transform: [
            { translateX },
            { translateY },
          ],
          opacity,
        }
      ]}
    >
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