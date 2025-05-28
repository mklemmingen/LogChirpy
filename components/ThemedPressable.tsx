import React from 'react';
import { Pressable, StyleSheet, useColorScheme, ViewStyle, PressableProps } from 'react-native';
import { theme } from '@/constants/theme';

interface ThemedPressableProps extends Omit<PressableProps, 'style'> {
    style?: ViewStyle | ViewStyle[];
    variant?: 'primary' | 'secondary' | 'ghost' | 'card';
    size?: 'small' | 'medium' | 'large';
    direction?: 'row' | 'column';
}

export function ThemedPressable({
                                    children,
                                    style,
                                    variant = 'ghost',
                                    size = 'medium',
                                    direction = 'row',
                                    disabled,
                                    ...props
                                }: ThemedPressableProps) {
    const scheme = useColorScheme() ?? 'light';
    const pal = theme[scheme];

    const getVariantStyle = () => {
        switch (variant) {
            case 'primary':
                return {
                    backgroundColor: pal.colors.primary,
                    ...theme.shadows.sm,
                };
            case 'secondary':
                return {
                    backgroundColor: pal.colors.statusBar,
                    borderWidth: 1,
                    borderColor: pal.colors.border,
                };
            case 'card':
                return {
                    backgroundColor: pal.colors.statusBar,
                    borderWidth: 1,
                    borderColor: pal.colors.border,
                    ...theme.shadows.sm,
                };
            case 'ghost':
            default:
                return {
                    backgroundColor: 'transparent',
                };
        }
    };

    const getSizeStyle = () => {
        switch (size) {
            case 'small':
                return {
                    paddingHorizontal: theme.spacing.sm,
                    paddingVertical: theme.spacing.xs,
                    minHeight: 32,
                };
            case 'large':
                return {
                    paddingHorizontal: theme.spacing.lg,
                    paddingVertical: theme.spacing.md,
                    minHeight: 56,
                };
            case 'medium':
            default:
                return {
                    paddingHorizontal: theme.spacing.md,
                    paddingVertical: theme.spacing.sm,
                    minHeight: 44,
                };
        }
    };

    const getPressedStyle = () => ({
        backgroundColor: variant === 'primary'
            ? pal.colors.hover
            : pal.colors.primary + '10',
        transform: [{ scale: 0.98 }],
    });

    return (
        <Pressable
            {...props}
            disabled={disabled}
            style={({ pressed }) => [
                styles.base,
                { flexDirection: direction },
                getVariantStyle(),
                getSizeStyle(),
                pressed && !disabled && getPressedStyle(),
                disabled && styles.disabled,
                style,
            ]}
            android_ripple={null} // Disable default Android ripple
        >
            {children}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    base: {
        borderRadius: theme.borderRadius.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    disabled: {
        opacity: 0.5,
    },
});