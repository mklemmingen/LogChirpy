import { FontStyle } from "react-native-svg";

const baseFonts = {
    regular: 'normal' as FontStyle,
    medium: 'normal' as FontStyle,
    light: 'normal' as FontStyle,
    thin: 'normal' as FontStyle,
    bold: 'bold' as FontStyle,
    heavy: 'bold' as FontStyle,
};

const baseSpacing = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
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
        fontWeight: 'bold',
    },
    h2: {
        fontSize: 24,
        fontWeight: 'bold',
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
        shadowOpacity: 0.2,
        shadowRadius: 1.41,
        elevation: 2,
    },
    md: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
};

export const theme = {
    spacing: baseSpacing,
    borderRadius: baseBorderRadius,
    typography: baseTypography,
    shadows: baseShadows,
    light: {
        colors: {
            primary: '#76A4B1',
            highlight: '#D1EEF4',
            shadow: '#C1D6D9',
            hover: '#5B8999',
            active: '#F7DED9',
            accent: '#D3B6B2',
            error: '#FF6B6B',
            background: '#FEFFF7',
            border: '#C1D6D9',
            tabBarBackground: 'rgba(255, 255, 255, 1)', // ⬅️ added for light mode
            text: {
                primary: '#76A4B1',
                secondary: '#5B8999',
                light: '#FEFFF7',
            },
            card: '#FFFFFF',
            link: '#FFFFFF',
            buttonText: '#FFFFFF',
            placeholder: '#FFFFFF',
        },
        fonts: baseFonts,
    },
    dark: {
        colors: {
            primary: '#517C87',
            highlight: '#537981',
            shadow: '#4E6367',
            hover: '#395D69',
            active: '#9D736E',
            accent: '#7D5754',
            error: '#FF6B6B',
            background: '#1C1E21',
            border: '#4E6367',
            tabBarBackground: 'rgba(28, 30, 33, 0.8)', // ⬅️ added for dark mode
            text: {
                primary: '#FFFFFF',
                secondary: '#537981',
                light: '#FEFFF7',
            },
            card: '#2C2F33',
            link: '#537981',
            buttonText: '#FEFFF7',
            placeholder: '#4E6367',
        },
        fonts: baseFonts,
    },
} as const;

export type Theme = typeof theme;

export const createStyles = <T extends Record<string, any>>(styles: (theme: Theme) => T) => styles;
