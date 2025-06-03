import React from 'react';
import { Feather } from '@expo/vector-icons';
import { useSemanticColors } from '@/hooks/useThemeColor';

interface ThemedIconProps {
    name: keyof typeof Feather.glyphMap;
    size?: number;
    color?: 'primary' | 'secondary' | 'tertiary' | 'accent' | 'error' | 'success';
    style?: any;
}

export function ThemedIcon({
                               name,
                               size = 24,
                               color = 'primary',
                               style
                           }: ThemedIconProps) {
    const semanticColors = useSemanticColors();

    const getColor = () => {
        switch (color) {
            case 'primary': return semanticColors.text;
            case 'secondary': return semanticColors.textSecondary;
            case 'tertiary': return semanticColors.textTertiary;
            case 'accent': return semanticColors.accent;
            case 'error': return semanticColors.error;
            case 'success': return semanticColors.success;
            default: return semanticColors.text;
        }
    };

    return <Feather name={name} size={size} color={getColor()} style={style} />;
}