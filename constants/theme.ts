// Minimal black and white design system
// Professional, clean, and accessible

import { TextStyle } from "react-native";

// Clean typography system
const typography = {
  // Headlines
  h1: { fontSize: 28, fontWeight: '700' as TextStyle['fontWeight'], lineHeight: 34 },
  h2: { fontSize: 22, fontWeight: '600' as TextStyle['fontWeight'], lineHeight: 28 },
  h3: { fontSize: 18, fontWeight: '600' as TextStyle['fontWeight'], lineHeight: 24 },
  
  // Body text
  body: { fontSize: 16, fontWeight: '400' as TextStyle['fontWeight'], lineHeight: 24 },
  bodySmall: { fontSize: 14, fontWeight: '400' as TextStyle['fontWeight'], lineHeight: 20 },
  
  // UI elements
  button: { fontSize: 16, fontWeight: '500' as TextStyle['fontWeight'], lineHeight: 24 },
  caption: { fontSize: 12, fontWeight: '400' as TextStyle['fontWeight'], lineHeight: 16 },
  label: { fontSize: 14, fontWeight: '500' as TextStyle['fontWeight'], lineHeight: 20 },
};

// Minimal spacing
const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

// Simple border radius
const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
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
};

// Smooth animations
const motion = {
  duration: {
    fast: 150,
    normal: 200,
    slow: 300,
  },
  easing: 'ease-out',
};

// Pure black and white color system
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
    },
  };

  return {
    // Backgrounds
    background: {
      primary: isDark ? colors.pure.black : colors.pure.white,
      secondary: isDark ? colors.gray[900] : colors.gray[50],
      tertiary: isDark ? colors.gray[800] : colors.gray[100],
      overlay: isDark ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.6)',
    },

    // Text colors
    text: {
      primary: isDark ? colors.pure.white : colors.pure.black,
      secondary: isDark ? colors.gray[300] : colors.gray[600],
      tertiary: isDark ? colors.gray[500] : colors.gray[400],
      inverse: isDark ? colors.pure.black : colors.pure.white,
      disabled: isDark ? colors.gray[600] : colors.gray[400],
    },

    // Interactive elements
    interactive: {
      primary: isDark ? colors.pure.white : colors.pure.black,
      secondary: isDark ? colors.gray[200] : colors.gray[800],
      hover: isDark ? colors.gray[100] : colors.gray[900],
      pressed: isDark ? colors.gray[300] : colors.gray[700],
      disabled: isDark ? colors.gray[700] : colors.gray[300],
    },

    // Borders
    border: {
      primary: isDark ? colors.gray[700] : colors.gray[200],
      secondary: isDark ? colors.gray[600] : colors.gray[300],
      strong: isDark ? colors.gray[500] : colors.gray[400],
    },

    // Status colors (minimal, only when necessary)
    status: {
      success: isDark ? '#22C55E' : '#16A34A',
      warning: isDark ? '#F59E0B' : '#D97706',
      error: isDark ? '#EF4444' : '#DC2626',
      info: isDark ? colors.gray[300] : colors.gray[600],
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
    color: isDark ? '#000000' : '#FFFFFF',
    borderColor: 'transparent',
    borderWidth: 0,
  }),
  secondary: (isDark: boolean) => ({
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: isDark ? '#FFFFFF' : '#000000',
    color: isDark ? '#FFFFFF' : '#000000',
  }),
  ghost: (isDark: boolean) => ({
    backgroundColor: 'transparent',
    color: isDark ? '#FFFFFF' : '#000000',
    borderColor: 'transparent',
    borderWidth: 0,
  }),
};