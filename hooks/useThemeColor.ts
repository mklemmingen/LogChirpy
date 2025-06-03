import { useColorScheme } from 'react-native';
import { theme, type Theme, type ColorSystem, createColorVariant } from '@/constants/theme';

// Type-safe color path helper
type ColorPath<T> = T extends string
    ? []
    : {
      [K in keyof T]: [K, ...ColorPath<T[K]>]
    }[keyof T];

type GetColorByPath<T, P extends readonly unknown[]> = P extends readonly [infer Head, ...infer Tail]
    ? Head extends keyof T
        ? GetColorByPath<T[Head], Tail>
        : never
    : T;

// Enhanced theme hook with better TypeScript support
export function useTheme(): Theme {
  const colorScheme = useColorScheme() ?? 'light';
  return theme[colorScheme];
}

// Get colors with dot notation support
export function useThemeColor<P extends ColorPath<ColorSystem>>(
    colorPath: P,
    fallback?: string
): GetColorByPath<ColorSystem, P> {
  const currentTheme = useTheme();

  try {
    let result: any = currentTheme.colors;
    for (const key of colorPath) {
      result = result[key];
      if (result === undefined) break;
    }
    return result ?? fallback ?? '#000000';
  } catch {
    return fallback ?? '#000000' as any;
  }
}

// Semantic color shortcuts for common use cases
export function useSemanticColors() {
  const colors = useTheme().colors;

  return {
    // Surfaces
    background: colors.surface.primary,
    backgroundSecondary: colors.surface.secondary,
    backgroundTertiary: colors.surface.tertiary,
    backgroundElevated: colors.surface.elevated,
    overlay: colors.surface.overlay,

    // Content
    text: colors.content.primary,
    textSecondary: colors.content.secondary,
    textTertiary: colors.content.tertiary,
    textInverse: colors.content.inverse,
    textDisabled: colors.content.disabled,

    // Interactive
    primary: colors.brand.primary,
    primaryContainer: colors.brand.primaryContainer,
    onPrimary: colors.brand.onPrimary,
    onPrimaryContainer: colors.brand.onPrimaryContainer,

    accent: colors.accent.primary,
    accentContainer: colors.accent.primaryContainer,
    onAccent: colors.accent.onPrimary,
    onAccentContainer: colors.accent.onPrimaryContainer,

    // States
    hover: colors.interactive.hover,
    pressed: colors.interactive.pressed,
    focus: colors.interactive.focus,
    disabled: colors.interactive.disabled,

    // Borders
    border: colors.border.primary,
    borderSecondary: colors.border.secondary,
    borderFocus: colors.border.focus,

    // Semantic
    success: colors.semantic.success,
    warning: colors.semantic.warning,
    error: colors.semantic.error,
    info: colors.semantic.info,
    successContainer: colors.semantic.successContainer,
    warningContainer: colors.semantic.warningContainer,
    errorContainer: colors.semantic.errorContainer,
    infoContainer: colors.semantic.infoContainer,
  };
}

// Create color variants with opacity
export function useColorVariants() {
  const colors = useSemanticColors();

  return {
    // Primary variants
    primarySubtle: createColorVariant(colors.primary, 0.1),
    primaryMuted: createColorVariant(colors.primary, 0.2),
    primaryHover: createColorVariant(colors.primary, 0.8),
    primaryPressed: createColorVariant(colors.primary, 0.9),

    // Accent variants
    accentSubtle: createColorVariant(colors.accent, 0.1),
    accentMuted: createColorVariant(colors.accent, 0.2),
    accentHover: createColorVariant(colors.accent, 0.8),
    accentPressed: createColorVariant(colors.accent, 0.9),

    // Text variants
    textSubtle: createColorVariant(colors.text, 0.6),
    textMuted: createColorVariant(colors.text, 0.4),

    // Surface variants
    surfaceHover: createColorVariant(colors.text, 0.05),
    surfacePressed: createColorVariant(colors.text, 0.1),
    surfaceSelected: createColorVariant(colors.primary, 0.15),
  };
}

// Component-specific theme helpers
export function useCardTheme() {
  const theme = useTheme();
  const semanticColors = useSemanticColors();
  const variants = useColorVariants();

  return {
    default: {
      backgroundColor: semanticColors.backgroundElevated,
      borderColor: semanticColors.border,
      ...theme.shadows.sm,
    },
    elevated: {
      backgroundColor: semanticColors.backgroundElevated,
      borderColor: 'transparent',
      ...theme.shadows.md,
    },
    outlined: {
      backgroundColor: 'transparent',
      borderColor: semanticColors.border,
      borderWidth: 1,
    },
    filled: {
      backgroundColor: semanticColors.backgroundSecondary,
      borderColor: 'transparent',
    },
    primary: {
      backgroundColor: variants.primarySubtle,
      borderColor: variants.primaryMuted,
      borderWidth: 1,
    },
    accent: {
      backgroundColor: variants.accentSubtle,
      borderColor: variants.accentMuted,
      borderWidth: 1,
    },
  };
}

export function useButtonTheme() {
  const theme = useTheme();
  const semanticColors = useSemanticColors();
  const variants = useColorVariants();

  return {
    primary: {
      backgroundColor: semanticColors.primary,
      color: semanticColors.onPrimary,
      borderColor: 'transparent',
      ...theme.shadows.sm,
    },
    secondary: {
      backgroundColor: semanticColors.backgroundSecondary,
      color: semanticColors.text,
      borderColor: semanticColors.border,
      borderWidth: 1,
    },
    tertiary: {
      backgroundColor: 'transparent',
      color: semanticColors.primary,
      borderColor: 'transparent',
    },
    destructive: {
      backgroundColor: semanticColors.error,
      color: semanticColors.onPrimary,
      borderColor: 'transparent',
      ...theme.shadows.sm,
    },
    ghost: {
      backgroundColor: 'transparent',
      color: semanticColors.text,
      borderColor: 'transparent',
    },
    outline: {
      backgroundColor: 'transparent',
      color: semanticColors.text,
      borderColor: semanticColors.border,
      borderWidth: 1,
    },
  };
}

// Animation/transition helpers
export function useMotionValues() {
  const { motion } = useTheme();
  return {
    ...motion,
    // Common animation presets
    fadeIn: {
      opacity: 1,
      duration: motion.duration.medium,
    },
    fadeOut: {
      opacity: 0,
      duration: motion.duration.fast,
    },
    slideUp: {
      transform: [{ translateY: 0 }],
      duration: motion.duration.medium,
    },
    slideDown: {
      transform: [{ translateY: 20 }],
      duration: motion.duration.medium,
    },
    scale: {
      transform: [{ scale: 1.05 }],
      duration: motion.duration.fast,
    },
  };
}

// Typography helpers
export function useTypography() {
  const { typography } = useTheme();
  const semanticColors = useSemanticColors();

  return {
    // Display styles
    displayLarge: { ...typography.display.large, color: semanticColors.text },
    displayMedium: { ...typography.display.medium, color: semanticColors.text },
    displaySmall: { ...typography.display.small, color: semanticColors.text },

    // Headlines
    headlineLarge: { ...typography.headline.large, color: semanticColors.text },
    headlineMedium: { ...typography.headline.medium, color: semanticColors.text },
    headlineSmall: { ...typography.headline.small, color: semanticColors.text },

    // Body text
    bodyLarge: { ...typography.body.large, color: semanticColors.text },
    bodyMedium: { ...typography.body.medium, color: semanticColors.text },
    bodySmall: { ...typography.body.small, color: semanticColors.text },

    // Labels
    labelLarge: { ...typography.label.large, color: semanticColors.textSecondary },
    labelMedium: { ...typography.label.medium, color: semanticColors.textSecondary },
    labelSmall: { ...typography.label.small, color: semanticColors.textSecondary },

    // Special
    caption: { ...typography.caption, color: semanticColors.textTertiary },
    overline: { ...typography.overline, color: semanticColors.textTertiary },
  };
}