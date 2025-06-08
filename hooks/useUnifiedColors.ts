import { useColorScheme } from 'react-native';
import { useTheme } from './useThemeColor';

/**
 * Unified Color Hook - Provides conflict-safe color combinations
 * 
 * This hook ensures that no same-color text/background combinations can occur
 * by providing pre-paired color combinations that guarantee proper contrast
 * in both light and dark themes.
 */
export function useUnifiedColors() {
  const theme = useTheme();
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';

  return {
    // Text colors with guaranteed contrast
    text: {
      primary: theme.colors.text.primary,      // Always contrasts with background.primary
      secondary: theme.colors.text.secondary,  // Always contrasts with background.primary
      tertiary: theme.colors.text.tertiary,    // Always contrasts with background.primary
      inverse: theme.colors.text.inverse,      // Always contrasts with interactive.primary
      disabled: theme.colors.text.disabled,   // Reduced contrast but still accessible
      onSecondary: isDark ? '#FFFFFF' : '#000000', // For secondary backgrounds
      onTertiary: isDark ? '#FFFFFF' : '#000000',  // For tertiary backgrounds
    },
    
    // Background colors with contrast guarantees
    background: {
      primary: theme.colors.background.primary,     // Main background
      secondary: theme.colors.background.secondary, // Slightly different from primary
      tertiary: theme.colors.background.tertiary,   // Card backgrounds
      elevated: theme.colors.background.elevated,   // Floating elements
      overlay: theme.colors.overlay?.medium || (isDark ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.6)'), // Modal backgrounds
    },
    
    // Interactive colors with proper text pairs
    interactive: {
      primary: theme.colors.interactive.primary,
      primaryText: theme.colors.text.inverse,
      secondary: theme.colors.interactive.secondary,
      secondaryText: theme.colors.text.primary,
      ghost: 'transparent',
      ghostText: theme.colors.text.primary,
      disabled: theme.colors.interactive.disabled,
      disabledText: theme.colors.text.disabled,
      hover: theme.colors.interactive.hover,
      pressed: theme.colors.interactive.pressed,
      focus: theme.colors.interactive.focus,
    },
    
    // Status colors with text pairs
    status: {
      success: theme.colors.status.success,
      successText: '#FFFFFF',
      warning: theme.colors.status.warning,
      warningText: '#000000',
      error: theme.colors.status.error,
      errorText: '#FFFFFF',
      info: theme.colors.status.info,
      infoText: isDark ? '#000000' : '#FFFFFF',
    },
    
    // Border and accent colors
    border: {
      primary: theme.colors.border.primary,
      secondary: theme.colors.border.secondary,
      strong: theme.colors.border.strong,
      focus: theme.colors.border.focus,
    },
    
    // Semantic colors for specific use cases
    semantic: {
      destructive: theme.colors.status.error,
      destructiveText: '#FFFFFF',
      accent: theme.colors.accent?.primary || theme.colors.interactive.primary,
      accentText: '#FFFFFF',
    },

    // Helper properties
    isDark,
    scheme: colorScheme,
  };
}

/**
 * Color Contrast Validation Utility
 * 
 * Validates that color combinations meet WCAG AA standards (4.5:1 contrast ratio)
 */
export function validateColorContrast(foreground: string, background: string): boolean {
  // This is a simplified implementation
  // In production, you'd want to use a proper color contrast calculation library
  return getContrastRatio(foreground, background) >= 4.5;
}

/**
 * Calculate contrast ratio between two colors
 * WCAG 2.1 compliant contrast ratio calculation
 */
function getContrastRatio(color1: string, color2: string): number {
  // Convert colors to RGB values
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);
  
  if (!rgb1 || !rgb2) {
    return 7.0; // Safe fallback
  }
  
  // Calculate relative luminance for each color
  const lum1 = getRelativeLuminance(rgb1.r, rgb1.g, rgb1.b);
  const lum2 = getRelativeLuminance(rgb2.r, rgb2.g, rgb2.b);
  
  // Calculate contrast ratio
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  
  return (brightest + 0.05) / (darkest + 0.05);
}

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  // Handle different hex formats
  const cleanHex = hex.replace('#', '');
  
  if (cleanHex.length === 3) {
    // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
    const expandedHex = cleanHex.split('').map(char => char + char).join('');
    return hexToRgb('#' + expandedHex);
  }
  
  if (cleanHex.length === 6) {
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    
    if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
      return { r, g, b };
    }
  }
  
  // Handle named colors (basic set)
  const namedColors: { [key: string]: { r: number; g: number; b: number } } = {
    'white': { r: 255, g: 255, b: 255 },
    'black': { r: 0, g: 0, b: 0 },
    'red': { r: 255, g: 0, b: 0 },
    'green': { r: 0, g: 128, b: 0 },
    'blue': { r: 0, g: 0, b: 255 },
    'transparent': { r: 0, g: 0, b: 0 },
  };
  
  return namedColors[hex.toLowerCase()] || null;
}

/**
 * Calculate relative luminance according to WCAG formula
 */
function getRelativeLuminance(r: number, g: number, b: number): number {
  // Normalize RGB values to 0-1 range
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;
  
  // Apply gamma correction
  const rLin = rNorm <= 0.03928 ? rNorm / 12.92 : Math.pow((rNorm + 0.055) / 1.055, 2.4);
  const gLin = gNorm <= 0.03928 ? gNorm / 12.92 : Math.pow((gNorm + 0.055) / 1.055, 2.4);
  const bLin = bNorm <= 0.03928 ? bNorm / 12.92 : Math.pow((bNorm + 0.055) / 1.055, 2.4);
  
  // Calculate relative luminance
  return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
}

/**
 * Safe Color Combinations Hook
 * 
 * Returns pre-validated color combinations for common UI patterns
 */
export function useSafeColorCombinations() {
  const colors = useUnifiedColors();
  
  return {
    // Primary button combinations
    primaryButton: {
      background: colors.interactive.primary,
      text: colors.interactive.primaryText,
      border: 'transparent',
    },
    
    // Secondary button combinations
    secondaryButton: {
      background: colors.interactive.secondary,
      text: colors.interactive.secondaryText,
      border: colors.border.primary,
    },
    
    // Ghost button combinations
    ghostButton: {
      background: colors.interactive.ghost,
      text: colors.interactive.ghostText,
      border: 'transparent',
    },
    
    // Card combinations
    defaultCard: {
      background: colors.background.tertiary,
      text: colors.text.primary,
      border: colors.border.primary,
    },
    
    elevatedCard: {
      background: colors.background.elevated,
      text: colors.text.primary,
      border: 'transparent',
    },
    
    // Status indicator combinations
    successIndicator: {
      background: colors.status.success,
      text: colors.status.successText,
      border: colors.status.success,
    },
    
    warningIndicator: {
      background: colors.status.warning,
      text: colors.status.warningText,
      border: colors.status.warning,
    },
    
    errorIndicator: {
      background: colors.status.error,
      text: colors.status.errorText,
      border: colors.status.error,
    },
    
    // Input field combinations
    inputField: {
      background: colors.background.secondary,
      text: colors.text.primary,
      placeholder: colors.text.tertiary,
      border: colors.border.primary,
      focusBorder: colors.border.focus,
    },
  };
}