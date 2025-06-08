import React from 'react';
import { ThemedPressable } from './ThemedPressable';
import { ThemedText } from './ThemedText';
import { useUnifiedColors } from '@/hooks/useUnifiedColors';
import { useResponsiveDimensions } from '@/hooks/useResponsiveDimensions';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  fullWidth?: boolean;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  fullWidth = false,
}: ButtonProps) {
  const colors = useUnifiedColors();
  const dimensions = useResponsiveDimensions();

  const getTextColor = () => {
    if (disabled) return colors.interactive.disabledText;
    
    switch (variant) {
      case 'primary': return colors.interactive.primaryText;
      case 'secondary': return colors.interactive.secondaryText;
      case 'ghost': return colors.interactive.ghostText;
      default: return colors.interactive.primaryText;
    }
  };

  return (
    <ThemedPressable
      variant={variant}
      size={size}
      disabled={disabled}
      fullWidth={fullWidth}
      onPress={onPress}
    >
      <ThemedText
        variant="button"
        style={{ color: getTextColor() }}
      >
        {title}
      </ThemedText>
    </ThemedPressable>
  );
}