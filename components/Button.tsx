import React from 'react';
import { ThemedPressable } from './ThemedPressable';
import { ThemedText } from './ThemedText';
import { useColors } from '@/hooks/useThemeColor';

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
  const colors = useColors();

  const getTextColor = () => {
    if (disabled) return colors.textDisabled;
    
    switch (variant) {
      case 'primary': return colors.textInverse;
      case 'secondary': return colors.text;
      case 'ghost': return colors.text;
      default: return colors.text;
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