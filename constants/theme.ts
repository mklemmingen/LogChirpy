import {TextStyle} from "react-native";

// Font weights for React Native Text components
const baseFonts = {
    regular: 'normal' as TextStyle['fontWeight'],
    medium: '500' as TextStyle['fontWeight'],
    light: '300' as TextStyle['fontWeight'],
    thin: '100' as TextStyle['fontWeight'],
    bold: 'bold' as TextStyle['fontWeight'],
    heavy: '800' as TextStyle['fontWeight'],
};

const baseSpacing = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
};

const baseBorderRadius = {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
};

const baseTypography = {
    h1: {
        fontSize: 32,
        fontWeight: 'bold' as TextStyle['fontWeight'],
    },
    h2: {
        fontSize: 24,
        fontWeight: 'bold' as TextStyle['fontWeight'],
    },
    body: {
        fontSize: 16,
    },
    small: {
        fontSize: 14,
    },
};

const baseShadows = {
    sm: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    md: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 4,
    },
};

export const theme = {
    spacing: baseSpacing,
    borderRadius: baseBorderRadius,
    typography: baseTypography,
    shadows: baseShadows,
    light: {
        colors: {
            // Nature-inspired greens with good contrast
            primary: '#2E7D32',        // Forest green - better contrast
            secondary: '#388E3C',      // Lighter forest green
            tertiary: '#4CAF50',       // Fresh green accent

            // Warm earth tones for accents
            accent: '#D84315',         // Burnt orange (like robin breast)
            accentSoft: '#FF8A65',     // Soft orange

            // Neutral grays with better contrast
            background: '#FAFAFA',     // Very light gray (not pure white)
            surface: '#FFFFFF',        // Pure white for cards
            surfaceVariant: '#F5F5F5', // Light gray for secondary surfaces

            // Border and dividers
            border: '#E0E0E0',         // Light gray borders
            divider: '#EEEEEE',        // Very light dividers

            // Text with proper contrast ratios
            text: {
                primary: '#212121',     // Almost black (WCAG AA compliant)
                secondary: '#757575',   // Medium gray
                tertiary: '#9E9E9E',    // Light gray
                inverse: '#FFFFFF',     // White text for dark backgrounds
                onPrimary: '#FFFFFF',   // White text on primary color
            },

            // Status colors
            success: '#4CAF50',        // Green for success states
            warning: '#FF9800',        // Orange for warnings
            error: '#F44336',          // Red for errors
            info: '#2196F3',           // Blue for information

            // Interactive states
            ripple: 'rgba(46, 125, 50, 0.12)',  // Primary with 12% opacity
            hover: 'rgba(46, 125, 50, 0.08)',   // Primary with 8% opacity
            pressed: 'rgba(46, 125, 50, 0.16)', // Primary with 16% opacity

            // Special UI elements
            tabBarBackground: '#FFFFFF',
            statusBar: 'dark-content',
            backdrop: 'rgba(0, 0, 0, 0.5)',
        },
        fonts: baseFonts,
    },
    dark: {
        colors: {
            // Sophisticated dark greens inspired by night forest
            primary: '#66BB6A',        // Bright green that pops on dark
            secondary: '#4CAF50',      // Vibrant green
            tertiary: '#81C784',       // Light green accent

            // Warm accents that work well in dark mode
            accent: '#FF7043',         // Warm orange (like sunset)
            accentSoft: '#FFAB91',     // Soft peach

            // Dark theme backgrounds with subtle contrast
            background: '#0F1419',     // Deep dark blue-gray (like pre-dawn sky)
            surface: '#1A1F24',        // Slightly lighter for cards
            surfaceVariant: '#242A30', // Medium dark for secondary surfaces

            // Borders that aren't too harsh
            border: '#2D3339',         // Subtle dark borders
            divider: '#1E2328',        // Very subtle dividers

            // High contrast text for dark mode
            text: {
                primary: '#FFFFFF',     // Pure white for main text
                secondary: '#B0BEC5',   // Light blue-gray
                tertiary: '#78909C',    // Medium blue-gray
                inverse: '#000000',     // Black text for light backgrounds
                onPrimary: '#000000',   // Black text on bright primary
            },

            // Status colors adjusted for dark mode
            success: '#4CAF50',        // Bright green
            warning: '#FFB74D',        // Warm orange
            error: '#EF5350',          // Bright red
            info: '#42A5F5',           // Light blue

            // Dark mode interactive states
            ripple: 'rgba(102, 187, 106, 0.16)',  // Brighter primary with opacity
            hover: 'rgba(102, 187, 106, 0.12)',   // Subtle hover
            pressed: 'rgba(102, 187, 106, 0.20)', // More pronounced press

            // Special UI elements for dark mode
            tabBarBackground: 'rgba(26, 31, 36, 0.95)',
            statusBar: 'light-content',
            backdrop: 'rgba(0, 0, 0, 0.7)',
        },
        fonts: baseFonts,
    },
} as const;

export type Theme = typeof theme;

export const createStyles = <T extends Record<string, any>>(styles: (theme: Theme) => T) => styles;

// Helper function to get color with opacity
export const withOpacity = (color: string, opacity: number): string => {
    // Convert hex to rgba
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

// Semantic color helpers
export const getSemanticColors = (isDark: boolean) => {
    const colors = isDark ? theme.dark.colors : theme.light.colors;
    return {
        // Card backgrounds with proper contrast
        cardPrimary: colors.surface,
        cardSecondary: colors.surfaceVariant,
        cardTertiary: isDark ? colors.background : colors.surfaceVariant,

        // Button variants
        buttonPrimary: colors.primary,
        buttonSecondary: colors.surfaceVariant,
        buttonGhost: 'transparent',

        // Input fields
        inputBackground: colors.surfaceVariant,
        inputBorder: colors.border,
        inputFocusBorder: colors.primary,

        // List items
        listItemBackground: colors.surface,
        listItemPressed: colors.pressed,
        listItemBorder: colors.divider,
    };
};