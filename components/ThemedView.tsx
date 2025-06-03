import React from 'react';
import { View, type ViewProps } from 'react-native';
import {
  useSemanticColors,
  useColorVariants,
  useTheme,
} from '@/hooks/useThemeColor';

// Surface variants that align with your theme system
type SurfaceVariant =
    | 'primary'
    | 'secondary'
    | 'tertiary'
    | 'elevated'
    | 'overlay'
    | 'transparent';

// Semantic color variants
type SemanticVariant =
    | 'brand'
    | 'accent'
    | 'success'
    | 'warning'
    | 'error'
    | 'info';

// Enhanced props that leverage your modern theme system
export type ThemedViewProps = ViewProps & {
  // Surface-based theming (preferred)
  surface?: SurfaceVariant;

  // Semantic color variants
  variant?: SemanticVariant;

  // Opacity modifier for subtle backgrounds
  opacity?: 'subtle' | 'muted' | 'normal';

  // Legacy color props for backward compatibility
  lightColor?: string;
  darkColor?: string;

  // Enhanced styling options
  elevated?: boolean;
  bordered?: boolean;
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'pill';
};

export function ThemedView({
                             style,
                             surface = 'primary',
                             variant,
                             opacity = 'normal',
                             elevated = false,
                             bordered = false,
                             rounded = 'none',
                             lightColor,
                             darkColor,
                             ...otherProps
                           }: ThemedViewProps) {
  const semanticColors = useSemanticColors();
  const variants = useColorVariants();
  const theme = useTheme();

  // Get background color based on surface variant
  const getSurfaceColor = (): string => {
    if (lightColor || darkColor) {
      // Legacy fallback - use semantic colors for consistency
      return lightColor || darkColor || semanticColors.background;
    }

    if (variant) {
      // Semantic variant colors
      switch (variant) {
        case 'brand':
          return opacity === 'subtle'
              ? variants.primarySubtle
              : opacity === 'muted'
                  ? variants.primaryMuted
                  : semanticColors.primaryContainer;

        case 'accent':
          return opacity === 'subtle'
              ? variants.accentSubtle
              : opacity === 'muted'
                  ? variants.accentMuted
                  : semanticColors.accentContainer;

        case 'success':
          return semanticColors.successContainer;

        case 'warning':
          return semanticColors.warningContainer;

        case 'error':
          return semanticColors.errorContainer;

        case 'info':
          return semanticColors.infoContainer;
      }
    }

    // Surface-based colors (default approach)
    switch (surface) {
      case 'primary':
        return semanticColors.background;
      case 'secondary':
        return semanticColors.backgroundSecondary;
      case 'tertiary':
        return semanticColors.backgroundTertiary;
      case 'elevated':
        return semanticColors.backgroundElevated;
      case 'overlay':
        return semanticColors.overlay;
      case 'transparent':
        return 'transparent';
      default:
        return semanticColors.background;
    }
  };

  // Get border radius
  const getBorderRadius = () => {
    if (rounded === 'none') return 0;
    return theme.borderRadius[rounded as keyof typeof theme.borderRadius] || 0;
  };

  // Compose styles
  const composedStyle = [
    {
      backgroundColor: getSurfaceColor(),
      ...(rounded !== 'none' && { borderRadius: getBorderRadius() }),
      ...(bordered && {
        borderWidth: 1,
        borderColor: semanticColors.border,
      }),
      ...(elevated && theme.shadows.sm),
    },
    style,
  ];

  return (
      <View style={composedStyle} {...otherProps} />
  );
}

// Convenience components for common use cases
export function ThemedSurface({ children, ...props }: ThemedViewProps) {
  return (
      <ThemedView
          surface="elevated"
          rounded="lg"
          elevated
          {...props}
      >
        {children}
      </ThemedView>
  );
}

export function ThemedCard({ children, ...props }: ThemedViewProps) {
  return (
      <ThemedView
          surface="elevated"
          rounded="lg"
          elevated
          bordered
          {...props}
      >
        {children}
      </ThemedView>
  );
}

export function ThemedContainer({ children, ...props }: ThemedViewProps) {
  return (
      <ThemedView
          surface="secondary"
          rounded="md"
          {...props}
      >
        {children}
      </ThemedView>
  );
}