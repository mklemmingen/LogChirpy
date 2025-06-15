// Minimal black and white design system with accent colors
// Professional, clean, and accessible

import { TextStyle } from "react-native";

// Clean typography system
const typography = {
  // Headlines
  h1: { fontSize: 28, fontWeight: '700' as TextStyle['fontWeight'], lineHeight: 34, letterSpacing: -0.5 },
  h2: { fontSize: 22, fontWeight: '600' as TextStyle['fontWeight'], lineHeight: 28, letterSpacing: -0.3 },
  h3: { fontSize: 18, fontWeight: '600' as TextStyle['fontWeight'], lineHeight: 24, letterSpacing: -0.2 },

  // Body text
  body: { fontSize: 16, fontWeight: '400' as TextStyle['fontWeight'], lineHeight: 24, letterSpacing: 0 },
  bodySmall: { fontSize: 14, fontWeight: '400' as TextStyle['fontWeight'], lineHeight: 20, letterSpacing: 0.1 },

  // UI elements
  button: { fontSize: 16, fontWeight: '500' as TextStyle['fontWeight'], lineHeight: 24, letterSpacing: 0.2 },
  caption: { fontSize: 12, fontWeight: '400' as TextStyle['fontWeight'], lineHeight: 16, letterSpacing: 0.2 },
  label: { fontSize: 14, fontWeight: '500' as TextStyle['fontWeight'], lineHeight: 20, letterSpacing: 0.1 },
};

// Consistent spacing scale (4px base)
const spacing = {
  xs: 4,    // Tight spacing (1x)
  sm: 8,    // Small elements (2x)
  md: 12,   // Default spacing (3x)
  lg: 16,   // Standard gaps (4x)
  xl: 24,   // Section spacing (6x)
  xxl: 32,  // Large sections (8x)
  xxxl: 48, // Extra large gaps (12x)
  huge: 64, // Page-level spacing (16x)
};

// Comprehensive border radius scale
const borderRadius = {
  none: 0,    // No radius
  xs: 4,      // Subtle rounding
  sm: 8,      // Inputs, small cards
  md: 12,     // Buttons, medium cards
  lg: 16,     // Large cards, modals
  xl: 24,     // Extra large elements
  xxl: 32,    // Very large elements
  full: 9999, // Pills, circles
};

// Subtle shadows
const shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
};

// Smooth animations
const motion = {
  duration: {
    fast: 150,
    normal: 200,
    slow: 300,
    instant: 100,
  },
  easing: 'ease-out',
  // Modern easing curves as optional
  easingCurves: {
    standard: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
    decelerate: 'cubic-bezier(0.0, 0.0, 0.2, 1)',
    accelerate: 'cubic-bezier(0.4, 0.0, 1, 1)',
  },
};

// Pure black and white color system with accent colors
const createColorSystem = (isDark: boolean) => {
  // Base colors - only black, white, and necessary grays
  const colors = {
    pure: {
      black: '#000000',
      white: '#FFFFFF',
    },
    gray: {
      50: '#FAFAFA',
      100: '#F5F5F5',
      200: '#E5E5E5',
      300: '#D4D4D4',
      400: '#A3A3A3',
      500: '#737373',
      600: '#525252',
      700: '#404040',
      800: '#262626',
      900: '#171717',
      950: '#0A0A0A',
    },
  };

  // Accent colors for improved UX
  const accents = {
    blue: {
      light: '#3B82F6',
      main: '#2563EB',
      dark: '#1D4ED8',
    },
    green: {
      light: '#10B981',
      main: '#059669',
      dark: '#047857',
    },
    red: {
      light: '#EF4444',
      main: '#DC2626',
      dark: '#B91C1C',
    },
    amber: {
      light: '#F59E0B',
      main: '#D97706',
      dark: '#B45309',
    },
  };

  // Consistent overlay opacity values
  const overlayOpacity = {
    light: 0.1,    // Very subtle overlay
    medium: 0.3,   // Medium overlay
    heavy: 0.5,    // Heavy overlay
    dark: 0.8,     // Dark overlay
    full: 0.95,    // Almost opaque
  };

  return {
    // Backgrounds
    background: {
      primary: isDark ? colors.gray[900] : colors.pure.white,
      secondary: isDark ? colors.gray[800] : colors.gray[50],
      tertiary: isDark ? colors.gray[700] : colors.gray[100],
      overlay: isDark ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.6)',
      elevated: isDark ? colors.gray[800] : colors.pure.white,
    },

    // Overlay colors with consistent opacity
    overlay: {
      light: isDark ? `rgba(255,255,255,${overlayOpacity.light})` : `rgba(0,0,0,${overlayOpacity.light})`,
      medium: isDark ? `rgba(255,255,255,${overlayOpacity.medium})` : `rgba(0,0,0,${overlayOpacity.medium})`,
      heavy: isDark ? `rgba(255,255,255,${overlayOpacity.heavy})` : `rgba(0,0,0,${overlayOpacity.heavy})`,
      dark: isDark ? `rgba(0,0,0,${overlayOpacity.dark})` : `rgba(0,0,0,${overlayOpacity.dark})`,
      full: isDark ? `rgba(0,0,0,${overlayOpacity.full})` : `rgba(0,0,0,${overlayOpacity.full})`,
    },

    // Text colors
    text: {
      primary: isDark ? colors.pure.white : colors.pure.black,
      secondary: isDark ? colors.gray[300] : colors.gray[600],
      tertiary: isDark ? colors.gray[500] : colors.gray[400],
      inverse: isDark ? colors.pure.black : colors.pure.white,
      disabled: isDark ? colors.gray[600] : colors.gray[400],
      placeholder: isDark ? colors.gray[500] : colors.gray[500],
    },

    // Interactive elements
    interactive: {
      primary: isDark ? colors.pure.white : colors.pure.black,
      secondary: isDark ? colors.gray[200] : colors.gray[800],
      hover: isDark ? colors.gray[100] : colors.gray[900],
      pressed: isDark ? colors.gray[300] : colors.gray[700],
      disabled: isDark ? colors.gray[700] : colors.gray[300],
      focus: isDark ? accents.blue.light : accents.blue.main,
    },

    // Borders
    border: {
      primary: isDark ? colors.gray[700] : colors.gray[200],
      secondary: isDark ? colors.gray[600] : colors.gray[300],
      strong: isDark ? colors.gray[500] : colors.gray[400],
      focus: isDark ? accents.blue.light : accents.blue.main,
    },

    // Status colors (minimal, only when necessary)
    status: {
      success: isDark ? '#22C55E' : '#16A34A',
      warning: isDark ? '#F59E0B' : '#D97706',
      error: isDark ? '#EF4444' : '#DC2626',
      info: isDark ? colors.gray[300] : colors.gray[600],
    },

    // Accent colors for CTAs and important UI
    accent: {
      primary: isDark ? accents.blue.light : accents.blue.main,
      primaryHover: isDark ? accents.blue.main : accents.blue.dark,
      success: isDark ? accents.green.light : accents.green.main,
      warning: isDark ? accents.amber.light : accents.amber.main,
      error: isDark ? accents.red.light : accents.red.main,
    },

    // Legacy support
    primary: isDark ? colors.pure.white : colors.pure.black,
    surface: isDark ? colors.gray[900] : colors.pure.white,
  };
};

export const theme = {
  light: {
    colors: createColorSystem(false),
    typography,
    spacing,
    borderRadius,
    shadows,
    motion,
  },
  dark: {
    colors: createColorSystem(true),
    typography,
    spacing,
    borderRadius,
    shadows,
    motion,
  },
} as const;

export type Theme = typeof theme.light;
export type ColorSystem = Theme['colors'];

// Animation presets for common interactions
export const animations = {
  fadeIn: {
    from: { opacity: 0 },
    to: { opacity: 1 },
  },
  slideUp: {
    from: { transform: [{ translateY: 20 }], opacity: 0 },
    to: { transform: [{ translateY: 0 }], opacity: 1 },
  },
  scale: {
    from: { transform: [{ scale: 0.95 }] },
    to: { transform: [{ scale: 1 }] },
  },
  press: {
    from: { transform: [{ scale: 1 }] },
    to: { transform: [{ scale: 0.98 }] },
  },
};

// Helper for consistent button styles
export const buttonStyles = {
  primary: (isDark: boolean) => ({
    backgroundColor: isDark ? '#FFFFFF' : '#000000',
    textColor: isDark ? '#000000' : '#FFFFFF',
    borderColor: 'transparent',
    borderWidth: 0,
  }),
  secondary: (isDark: boolean) => ({
    backgroundColor: 'transparent',
    textColor: isDark ? '#FFFFFF' : '#000000',
    borderWidth: 1,
    borderColor: isDark ? '#FFFFFF' : '#000000',
  }),
  ghost: (isDark: boolean) => ({
    backgroundColor: 'transparent',
    textColor: isDark ? '#FFFFFF' : '#000000',
    borderColor: 'transparent',
    borderWidth: 0,
  }),
  // New accent button style for CTAs
  accent: (isDark: boolean) => ({
    backgroundColor: isDark ? '#3B82F6' : '#2563EB',
    textColor: '#FFFFFF',
    borderColor: 'transparent',
    borderWidth: 0,
  }),
};