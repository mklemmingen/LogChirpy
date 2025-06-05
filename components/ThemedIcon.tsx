import React from 'react';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useThemeColor';

interface ThemedIconProps {
    name: keyof typeof Feather.glyphMap;
    size?: number;
    color?: 'primary' | 'secondary' | 'tertiary' | 'accent' | 'error' | 'success';
    style?: object;
}

export function ThemedIcon({
                               name,
                               size = 24,
                               color = 'primary',
                               style
                           }: ThemedIconProps) {
    const theme = useTheme();

    const getColor = () => {
        switch (color) {
            case 'primary': return theme.colors.text.primary;
            case 'secondary': return theme.colors.text.secondary;
            case 'tertiary': return theme.colors.text.tertiary;
            case 'accent': return theme.colors.border.secondary;
            case 'error': return theme.colors.status.error;
            case 'success': return theme.colors.status.success;
            default: return theme.colors.text.primary;
        }
    };

    return <Feather name={name} size={size} color={getColor()} style={style} />;
}