import React, { forwardRef } from 'react';
import { Pressable, ViewStyle, PressableProps } from 'react-native';
import * as Haptics from 'expo-haptics';

import { useButtonStyles, useBorderRadius, useShadows } from '@/hooks/useThemeColor';

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
  const buttonStyles = useButtonStyles();
  const borderRadius = useBorderRadius();
  const shadows = useShadows();

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


  const handlePressIn = (event: Parameters<NonNullable<PressableProps['onPressIn']>>[0]) => {
    if (haptic) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPressIn?.(event);
  };

  const handlePressOut = (event: Parameters<NonNullable<PressableProps['onPressOut']>>[0]) => {
    onPressOut?.(event);
  };

  return (
    <Pressable
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
        style,
      ]}
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      {...rest}
    >
      {children}
    </Pressable>
  );
});

ThemedPressable.displayName = 'ThemedPressable';