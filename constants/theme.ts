import { TextStyle } from "react-native";

// Enhanced font system with better hierarchy
const typography = {
    // Display styles for hero sections
    display: {
        large: { fontSize: 32, fontWeight: '800' as TextStyle['fontWeight'], lineHeight: 40 },
        medium: { fontSize: 28, fontWeight: '700' as TextStyle['fontWeight'], lineHeight: 36 },
        small: { fontSize: 24, fontWeight: '600' as TextStyle['fontWeight'], lineHeight: 32 },
    },

    // Headline styles for section headers
    headline: {
        large: { fontSize: 22, fontWeight: '600' as TextStyle['fontWeight'], lineHeight: 28 },
        medium: { fontSize: 18, fontWeight: '600' as TextStyle['fontWeight'], lineHeight: 24 },
        small: { fontSize: 16, fontWeight: '600' as TextStyle['fontWeight'], lineHeight: 22 },
    },

    // Body text for content
    body: {
        large: { fontSize: 16, fontWeight: '400' as TextStyle['fontWeight'], lineHeight: 24 },
        medium: { fontSize: 14, fontWeight: '400' as TextStyle['fontWeight'], lineHeight: 20 },
        small: { fontSize: 12, fontWeight: '400' as TextStyle['fontWeight'], lineHeight: 16 },
    },

    // Label text for UI elements
    label: {
        large: { fontSize: 14, fontWeight: '500' as TextStyle['fontWeight'], lineHeight: 20 },
        medium: { fontSize: 12, fontWeight: '500' as TextStyle['fontWeight'], lineHeight: 16 },
        small: { fontSize: 10, fontWeight: '500' as TextStyle['fontWeight'], lineHeight: 14 },
    },

    // Special purpose
    caption: { fontSize: 12, fontWeight: '400' as TextStyle['fontWeight'], lineHeight: 16 },
    overline: { fontSize: 10, fontWeight: '600' as TextStyle['fontWeight'], lineHeight: 16, letterSpacing: 1.5 },
};

// Enhanced spacing system
const spacing = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
    xxxl: 64,
    // Component-specific spacing
    cardPadding: 20,
    sectionGap: 32,
    listItemGap: 12,
};

// Modern border radius system
const borderRadius = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
    // Special cases
    pill: 9999,
    card: 16,
    sheet: 24,
};

// Enhanced shadow system
const shadows = {
    none: {
        shadowColor: 'transparent',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0,
        shadowRadius: 0,
        elevation: 0,
    },
    xs: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    sm: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    md: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
    },
    lg: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
        elevation: 8,
    },
    xl: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.25,
        shadowRadius: 24,
        elevation: 12,
    },
};

// Motion values for animations
const motion = {
    duration: {
        fast: 200,
        medium: 300,
        slow: 500,
    },
    easing: {
        ease: 'ease',
        easeIn: 'ease-in',
        easeOut: 'ease-out',
        easeInOut: 'ease-in-out',
    },
};

// Enhanced color system with better semantic naming
const createColorSystem = (isDark: boolean) => {
    const baseColors = {
        // Core brand colors
        brand: {
            50: '#E8F5E8',
            100: '#C8E6C8',
            200: '#A5D6A5',
            300: '#82C582',
            400: '#66BB6A',
            500: '#4CAF50', // Primary green
            600: '#43A047',
            700: '#388E3C',
            800: '#2E7D32',
            900: '#1B5E20',
        },

        // Accent colors (warm orange for contrast)
        accent: {
            50: '#FFF3E0',
            100: '#FFE0B2',
            200: '#FFCC80',
            300: '#FFB74D',
            400: '#FFA726',
            500: '#FF9800', // Primary orange
            600: '#FB8C00',
            700: '#F57C00',
            800: '#EF6C00',
            900: '#E65100',
        },

        // Neutral grays
        neutral: {
            0: '#FFFFFF',
            50: '#FAFAFA',
            100: '#F5F5F5',
            200: '#EEEEEE',
            300: '#E0E0E0',
            400: '#BDBDBD',
            500: '#9E9E9E',
            600: '#757575',
            700: '#616161',
            800: '#424242',
            850: '#303030',
            900: '#212121',
            950: '#0F0F0F',
        },

        // Semantic colors
        success: '#4CAF50',
        warning: '#FF9800',
        error: '#F44336',
        info: '#2196F3',
    };

    return {
        // Surface colors
        surface: {
            primary: isDark ? baseColors.neutral[900] : baseColors.neutral[0],
            secondary: isDark ? baseColors.neutral[800] : baseColors.neutral[50],
            tertiary: isDark ? baseColors.neutral[700] : baseColors.neutral[100],
            elevated: isDark ? baseColors.neutral[850] : baseColors.neutral[0],
            overlay: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.4)',
        },

        // Content colors
        content: {
            primary: isDark ? baseColors.neutral[50] : baseColors.neutral[900],
            secondary: isDark ? baseColors.neutral[300] : baseColors.neutral[600],
            tertiary: isDark ? baseColors.neutral[400] : baseColors.neutral[500],
            inverse: isDark ? baseColors.neutral[900] : baseColors.neutral[50],
            disabled: isDark ? baseColors.neutral[600] : baseColors.neutral[400],
        },

        // Brand colors
        brand: {
            primary: baseColors.brand[500],
            primaryContainer: isDark ? baseColors.brand[800] : baseColors.brand[100],
            onPrimary: baseColors.neutral[0],
            onPrimaryContainer: isDark ? baseColors.brand[100] : baseColors.brand[800],
        },

        // Accent colors
        accent: {
            primary: baseColors.accent[500],
            primaryContainer: isDark ? baseColors.accent[800] : baseColors.accent[100],
            onPrimary: baseColors.neutral[0],
            onPrimaryContainer: isDark ? baseColors.accent[100] : baseColors.accent[800],
        },

        // Interactive states
        interactive: {
            primary: baseColors.brand[500],
            hover: isDark ? baseColors.brand[400] : baseColors.brand[600],
            pressed: isDark ? baseColors.brand[300] : baseColors.brand[700],
            disabled: isDark ? baseColors.neutral[700] : baseColors.neutral[300],
            focus: baseColors.brand[500],
        },

        // Border colors
        border: {
            primary: isDark ? baseColors.neutral[700] : baseColors.neutral[200],
            secondary: isDark ? baseColors.neutral[600] : baseColors.neutral[300],
            focus: baseColors.brand[500],
            error: baseColors.error,
        },

        // Semantic colors
        semantic: {
            success: baseColors.success,
            warning: baseColors.warning,
            error: baseColors.error,
            info: baseColors.info,
            successContainer: isDark ? '#1B5E20' : '#E8F5E8',
            warningContainer: isDark ? '#E65100' : '#FFF3E0',
            errorContainer: isDark ? '#B71C1C' : '#FFEBEE',
            infoContainer: isDark ? '#0D47A1' : '#E3F2FD',
        },

        // Legacy mappings for backward compatibility
        background: isDark ? baseColors.neutral[900] : baseColors.neutral[0],
        primary: baseColors.brand[500],
        secondary: baseColors.accent[500],
        text: {
            primary: isDark ? baseColors.neutral[50] : baseColors.neutral[900],
            secondary: isDark ? baseColors.neutral[300] : baseColors.neutral[600],
            tertiary: isDark ? baseColors.neutral[400] : baseColors.neutral[500],
        },
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

// Helper function to create responsive spacing
export const responsiveSpacing = (base: number) => ({
    mobile: base,
    tablet: base * 1.2,
    desktop: base * 1.5,
});

// Helper for creating color variants
export const createColorVariant = (baseColor: string, opacity: number) => {
    if (baseColor.startsWith('#')) {
        const hex = baseColor.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
    return baseColor;
};