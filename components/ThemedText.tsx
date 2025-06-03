import React from 'react';
import { Text, TextProps } from 'react-native';
import { useTypography, useSemanticColors } from '@/hooks/useThemeColor';

export type ThemedTextProps = TextProps & {
    variant?: 'displayLarge' | 'displayMedium' | 'displaySmall' |
        'headlineLarge' | 'headlineMedium' | 'headlineSmall' |
        'bodyLarge' | 'bodyMedium' | 'bodySmall' |
        'labelLarge' | 'labelMedium' | 'labelSmall' |
        'caption' | 'overline';
    color?: 'primary' | 'secondary' | 'tertiary' | 'inverse' | 'disabled' | 'accent' | 'error' | 'success';
    semiBold?: boolean;
    italic?: boolean;
};

export function ThemedText({
                               style,
                               variant = 'bodyMedium',
                               color = 'primary',
                               semiBold = false,
                               italic = false,
                               ...rest
                           }: ThemedTextProps) {
    const typography = useTypography();
    const semanticColors = useSemanticColors();

    const getTextColor = () => {
        switch (color) {
            case 'primary': return semanticColors.text;
            case 'secondary': return semanticColors.textSecondary;
            case 'tertiary': return semanticColors.textTertiary;
            case 'inverse': return semanticColors.textInverse;
            case 'disabled': return semanticColors.disabled;
            case 'accent': return semanticColors.accent;
            case 'error': return semanticColors.error;
            case 'success': return semanticColors.success;
            default: return semanticColors.text;
        }
    };

    const getTypographyStyle = () => {
        return typography[variant] || typography.bodyMedium;
    };

    return (
        <Text
            style={[
                getTypographyStyle(),
                { color: getTextColor() },
                semiBold && { fontWeight: '600' },
                italic && { fontStyle: 'italic' },
                style,
            ]}
            {...rest}
        />
    );
}