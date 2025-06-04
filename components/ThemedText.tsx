import React from 'react';
import { Text, TextProps } from 'react-native';
import { useTypography, useColors } from '@/hooks/useThemeColor';

export type ThemedTextProps = TextProps & {
  variant?: 'h1' | 'h2' | 'h3' | 'body' | 'bodySmall' | 'bodyLarge' | 'button' | 'caption' | 'label' | 'labelSmall' | 'labelMedium' | 'labelLarge' | 'displaySmall' | 'displayMedium' | 'headlineLarge';
  color?: 'primary' | 'secondary' | 'tertiary' | 'accent' | 'inverse' | 'disabled' | 'success' | 'warning' | 'error';
  semiBold?: boolean;
  center?: boolean;
};

export function ThemedText({
  style,
  variant = 'body',
  color = 'primary',
  semiBold = false,
  center = false,
  ...rest
}: ThemedTextProps) {
  const typography = useTypography();
  const colors = useColors();

  const getTextColor = () => {
    switch (color) {
      case 'primary': return colors.text;
      case 'secondary': return colors.textSecondary;
      case 'tertiary': return colors.textTertiary;
      case 'accent': return colors.primary;
      case 'inverse': return colors.textInverse;
      case 'disabled': return colors.textDisabled;
      case 'success': return colors.success;
      case 'warning': return colors.warning;
      case 'error': return colors.error;
      default: return colors.text;
    }
  };

  const getTypographyStyle = () => {
    // Map new variants to existing typography styles
    const variantMap: Record<string, any> = {
      // Existing variants
      h1: typography.h1,
      h2: typography.h2,
      h3: typography.h3,
      body: typography.body,
      bodySmall: typography.bodySmall,
      button: typography.button,
      caption: typography.caption,
      label: typography.label,
      
      // New variants mapped to existing styles
      bodyLarge: typography.body,
      labelSmall: typography.caption,
      labelMedium: typography.label,
      labelLarge: typography.label,
      displaySmall: typography.h2,
      displayMedium: typography.h1,
      headlineLarge: typography.h1,
    };
    
    return variantMap[variant] || typography.body;
  };

  return (
    <Text
      style={[
        getTypographyStyle(),
        { color: getTextColor() },
        semiBold && { fontWeight: '600' },
        center && { textAlign: 'center' },
        style,
      ]}
      {...rest}
    />
  );
}