// Minimal theme hooks for black and white design
// Simple, clean, and professional

import { useColorScheme } from 'react-native';
import { theme, type Theme, buttonStyles } from '@/constants/theme';

export function useTheme(): Theme {
  const colorScheme = useColorScheme() ?? 'light';
  return theme[colorScheme];
}

export function useThemeColor(colorPath: string, fallback?: string): string {
  const currentTheme = useTheme();
  const keys = colorPath.split('.');
  
  try {
    let result: any = currentTheme.colors;
    for (const key of keys) {
      result = result[key];
      if (result === undefined) break;
    }
    return result ?? fallback ?? '#000000';
  } catch {
    return fallback ?? '#000000';
  }
}

// Core colors for the minimal design
export function useColors() {
  const colors = useTheme().colors;
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';

  return {
    // Backgrounds
    background: colors.background.primary,
    backgroundSecondary: colors.background.secondary,
    backgroundTertiary: colors.background.tertiary,
    surface: colors.surface,
    overlay: colors.background.overlay,

    // Text
    text: colors.text.primary,
    textSecondary: colors.text.secondary,
    textTertiary: colors.text.tertiary,
    textInverse: colors.text.inverse,
    textDisabled: colors.text.disabled,

    // Interactive
    primary: colors.interactive.primary,
    secondary: colors.interactive.secondary,
    hover: colors.interactive.hover,
    pressed: colors.interactive.pressed,
    disabled: colors.interactive.disabled,

    // Borders
    border: colors.border.primary,
    borderSecondary: colors.border.secondary,
    borderStrong: colors.border.strong,

    // Status (only when necessary)
    success: colors.status.success,
    warning: colors.status.warning,
    error: colors.status.error,
    info: colors.status.info,

    // Helpers
    isDark,
  };
}

// Button styling helper
export function useButtonStyles() {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  
  return {
    primary: buttonStyles.primary(isDark),
    secondary: buttonStyles.secondary(isDark),
    ghost: buttonStyles.ghost(isDark),
  };
}

// Typography with colors
export function useTypography() {
  const { typography } = useTheme();
  const colors = useColors();

  return {
    h1: { ...typography.h1, color: colors.text },
    h2: { ...typography.h2, color: colors.text },
    h3: { ...typography.h3, color: colors.text },
    body: { ...typography.body, color: colors.text },
    bodySmall: { ...typography.bodySmall, color: colors.textSecondary },
    button: { ...typography.button, color: colors.text },
    caption: { ...typography.caption, color: colors.textTertiary },
    label: { ...typography.label, color: colors.textSecondary },
  };
}

// Animation helpers
export function useAnimations() {
  const { motion } = useTheme();
  
  return {
    duration: motion.duration,
    easing: motion.easing,
    
    // Common presets
    fadeIn: {
      opacity: 1,
      duration: motion.duration.normal,
    },
    fadeOut: {
      opacity: 0,
      duration: motion.duration.fast,
    },
    slideUp: {
      transform: [{ translateY: 0 }],
      opacity: 1,
      duration: motion.duration.normal,
    },
    press: {
      transform: [{ scale: 0.98 }],
      duration: motion.duration.fast,
    },
  };
}

// Spacing helpers
export function useSpacing() {
  return useTheme().spacing;
}

// Border radius helpers
export function useBorderRadius() {
  return useTheme().borderRadius;
}

// Shadow helpers
export function useShadows() {
  return useTheme().shadows;
}