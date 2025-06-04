import React, { forwardRef } from 'react';
import { Pressable, ViewStyle, PressableProps } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { useColors, useButtonStyles, useBorderRadius, useShadows } from '@/hooks/useThemeColor';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ThemedPressableProps extends Omit<PressableProps, 'style'> {
  children?: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  fullWidth?: boolean;
  haptic?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const ThemedPressable = forwardRef<
  React.ElementRef<typeof Pressable>,
  ThemedPressableProps
>(({
  children,
  style,
  variant = 'ghost',
  size = 'md',
  disabled = false,
  fullWidth = false,
  haptic = true,
  onPressIn,
  onPressOut,
  ...rest
}, ref) => {
  const colors = useColors();
  const buttonStyles = useButtonStyles();
  const borderRadius = useBorderRadius();
  const shadows = useShadows();

  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return {
          paddingHorizontal: 12,
          paddingVertical: 6,
          minHeight: 32,
        };
      case 'md':
        return {
          paddingHorizontal: 16,
          paddingVertical: 10,
          minHeight: 44,
        };
      case 'lg':
        return {
          paddingHorizontal: 24,
          paddingVertical: 14,
          minHeight: 52,
        };
    }
  };

  const getVariantStyles = () => {
    const baseStyle = buttonStyles[variant];
    return {
      backgroundColor: baseStyle.backgroundColor,
      borderColor: baseStyle.borderColor || 'transparent',
      borderWidth: baseStyle.borderWidth || 0,
      ...(variant === 'primary' && shadows.sm),
    };
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handlePressIn = (event: any) => {
    if (haptic) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    scale.value = withSpring(0.98, { damping: 15 });
    onPressIn?.(event);
  };

  const handlePressOut = (event: any) => {
    scale.value = withSpring(1, { damping: 15 });
    onPressOut?.(event);
  };

  return (
    <AnimatedPressable
      ref={ref}
      style={[
        {
          borderRadius: borderRadius.md,
          alignItems: 'center',
          justifyContent: 'center',
          ...(fullWidth && { width: '100%' }),
          ...(disabled && { opacity: 0.5 }),
        },
        getSizeStyles(),
        getVariantStyles(),
        animatedStyle,
        style,
      ]}
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
});

ThemedPressable.displayName = 'ThemedPressable';