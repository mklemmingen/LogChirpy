import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import SafeBlurView from '@/components/ui/SafeBlurView';

import {
    useTheme,
    useSemanticColors,
    useColorVariants,
    useTypography,
} from '../hooks/useThemeColor';

// Enhanced props interface
interface SectionProps {
    title?: string;
    children: React.ReactNode;
    style?: ViewStyle;
    variant?: 'default' | 'elevated' | 'glass' | 'outlined';
    spacing?: 'compact' | 'comfortable' | 'spacious';
    animated?: boolean;
}


export default function Section({
                                    title,
                                    children,
                                    style,
                                    variant = 'default',
                                    spacing = 'comfortable',
                                    animated = false,
                                }: SectionProps) {
    const theme = useTheme();
    const semanticColors = useSemanticColors();
    const variants = useColorVariants();
    const typography = useTypography();


    // Get variant-specific styling
    const getVariantStyle = () => {
        switch (variant) {
            case 'elevated':
                return {
                    backgroundColor: semanticColors.surface,
                    borderColor: 'transparent',
                    borderWidth: 0,
                    ...theme.shadows.sm,
                    useBlur: false,
                };
            case 'glass':
                return {
                    backgroundColor: 'transparent',
                    borderColor: variants.primary.light,
                    borderWidth: 1,
                    useBlur: true,
                };
            case 'outlined':
                return {
                    backgroundColor: 'transparent',
                    borderColor: semanticColors.secondary,
                    borderWidth: 1,
                    useBlur: false,
                };
            case 'default':
            default:
                return {
                    backgroundColor: semanticColors.background,
                    borderColor: semanticColors.secondary,
                    borderWidth: 1,
                    useBlur: false,
                };
        }
    };

    // Get spacing configuration
    const getSpacingStyle = () => {
        switch (spacing) {
            case 'compact':
                return {
                    paddingHorizontal: theme.spacing.sm,
                    paddingTop: theme.spacing.sm,
                    paddingBottom: theme.spacing.xs,
                    gap: theme.spacing.xs,
                };
            case 'spacious':
                return {
                    paddingHorizontal: theme.spacing.xl,
                    paddingTop: theme.spacing.xl,
                    paddingBottom: theme.spacing.lg,
                    gap: theme.spacing.lg,
                };
            case 'comfortable':
            default:
                return {
                    paddingHorizontal: theme.spacing.lg,
                    paddingTop: theme.spacing.lg,
                    paddingBottom: theme.spacing.md,
                    gap: theme.spacing.md,
                };
        }
    };

    const variantStyle = getVariantStyle();
    const spacingStyle = getSpacingStyle();

    // Extract useBlur and create clean style object
    const { useBlur, ...cleanVariantStyle } = variantStyle;

    const containerStyle = StyleSheet.flatten([
        styles.container,
        {
            borderRadius: theme.borderRadius.lg,
            marginBottom: theme.spacing.lg,
            ...cleanVariantStyle,
            ...spacingStyle,
        },
        style,
    ]);

    // Render with or without blur
    if (useBlur) {
        return (
            <SafeBlurView
                intensity={60}
                tint={semanticColors.background === '#FFFFFF' ? 'light' : 'dark'}
                style={containerStyle}
            >
                <View style={styles.content}>
                    {title && (
                        <Text style={[typography.headlineSmall, styles.title]}>
                            {title}
                        </Text>
                    )}
                    <View style={styles.childrenContainer}>
                        {children}
                    </View>
                </View>
            </SafeBlurView>
        );
    }

    return (
        <View style={containerStyle}>
            <View style={styles.content}>
                {title && (
                    <Text style={[typography.headlineSmall, styles.title]}>
                        {title}
                    </Text>
                )}
                <View style={styles.childrenContainer}>
                    {children}
                </View>
            </View>
        </View>
    );
}

// Specialized section components for common use cases
export function ElevatedSection(props: Omit<SectionProps, 'variant'>) {
    return <Section variant="elevated" {...props} />;
}

export function GlassSection(props: Omit<SectionProps, 'variant'>) {
    return <Section variant="glass" {...props} />;
}

export function OutlinedSection(props: Omit<SectionProps, 'variant'>) {
    return <Section variant="outlined" {...props} />;
}

const styles = StyleSheet.create({
    container: {
        overflow: 'hidden',
    },
    content: {
        flex: 1,
    },
    title: {
        fontWeight: '600',
    },
    childrenContainer: {
        flex: 1,
    },
});