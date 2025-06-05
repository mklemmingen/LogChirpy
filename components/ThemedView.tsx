import React from 'react';
import { View, type ViewProps } from 'react-native';
import { useColors, useBorderRadius, useShadows } from '@/hooks/useThemeColor';

export type ThemedViewProps = ViewProps & {
  background?: 'primary' | 'secondary' | 'tertiary' | 'surface' | 'transparent';
  bordered?: boolean;
  elevated?: boolean;
  rounded?: 'sm' | 'md' | 'lg' | 'xl';
  padding?: 'sm' | 'md' | 'lg' | 'xl';
};

export function ThemedView({
  style,
  background = 'primary',
  bordered = false,
  elevated = false,
  rounded,
  padding,
  ...otherProps
}: ThemedViewProps) {
  const colors = useColors();
  const borderRadius = useBorderRadius();
  const shadows = useShadows();

  const getBackgroundColor = () => {
    switch (background) {
      case 'primary': return colors.background;
      case 'secondary': return colors.backgroundSecondary;
      case 'tertiary': return colors.backgroundTertiary;
      case 'surface': return colors.surface;
      case 'transparent': return 'transparent';
      default: return colors.background;
    }
  };

  const getPadding = () => {
    if (!padding) return undefined;
    const paddingMap = { sm: 8, md: 16, lg: 24, xl: 32 };
    return paddingMap[padding];
  };

  const getBorderRadius = () => {
    if (!rounded) return undefined;
    return borderRadius[rounded];
  };

  return (
    <View
      style={[
        {
          backgroundColor: getBackgroundColor(),
          ...(bordered && {
            borderWidth: 1,
            borderColor: colors.border,
          }),
          ...(elevated && shadows.md),
          ...(rounded && { borderRadius: getBorderRadius() }),
          ...(padding && { padding: getPadding() }),
        },
        style,
      ]}
      {...otherProps}
    />
  );
}

// Common layout components
export function Card({ children, ...props }: ThemedViewProps) {
  return (
    <ThemedView
      background="surface"
      bordered
      rounded="lg"
      padding="md"
      {...props}
    >
      {children}
    </ThemedView>
  );
}

export function Container({ children, ...props }: ThemedViewProps) {
  return (
    <ThemedView
      background="primary"
      padding="md"
      {...props}
    >
      {children}
    </ThemedView>
  );
}