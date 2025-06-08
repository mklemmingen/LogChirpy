import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { ReactNode } from 'react';
import SafeBlurView from '@/components/ui/SafeBlurView';

import {
    useSemanticColors,
    useColorVariants,
    useTypography,
    useTheme,
    useMotionValues,
    useColors,
} from '../hooks/useThemeColor';

interface SettingsSectionProps {
    title?: string;
    subtitle?: string;
    children: ReactNode;
    variant?: 'default' | 'elevated' | 'outlined' | 'glass';
    style?: ViewStyle;
    animated?: boolean;
    delay?: number;
}


export default function SettingsSection({
                                            title,
                                            subtitle,
                                            children,
                                            variant = 'default',
                                            style,
                                            animated = true,
                                            delay = 0,
                                        }: SettingsSectionProps) {
    const semanticColors = useSemanticColors();
    const variants = useColorVariants();
    const typography = useTypography();
    const theme = useTheme();
    const motion = useMotionValues();
    const colors = useColors();


    // Get variant-specific styling
    const getVariantStyle = () => {
        switch (variant) {
            case 'elevated':
                return {
                    backgroundColor: semanticColors.surface,
                    borderWidth: 0,
                    ...theme.shadows.md,
                };
            case 'outlined':
                return {
                    backgroundColor: 'transparent',
                    borderWidth: 1,
                    borderColor: colors.border,
                };
            case 'glass':
                return {
                    backgroundColor: 'transparent',
                    borderWidth: 1,
                    borderColor: variants.primary.light,
                };
            default:
                return {
                    backgroundColor: semanticColors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    ...theme.shadows.sm,
                };
        }
    };

    const variantStyle = getVariantStyle();
    const isGlass = variant === 'glass';

    const containerContent = (
        <>
            {/* Header Section */}
            {(title || subtitle) && (
                <View style={styles.header}>
                    {title && (
                        <Text style={[typography.h2, styles.title]}>
                            {title}
                        </Text>
                    )}
                    {subtitle && (
                        <Text style={[typography.body, styles.subtitle, { color: semanticColors.secondary }]}>
                            {subtitle}
                        </Text>
                    )}
                </View>
            )}

            {/* Content */}
            <View style={styles.content}>
                {children}
            </View>
        </>
    );

    if (isGlass) {
        return (
            <View style={[styles.container, variantStyle, style]}>
                <SafeBlurView
                    intensity={60}
                    tint={semanticColors.background === '#FFFFFF' ? 'light' : 'dark'}
                    style={StyleSheet.absoluteFillObject}
                />
                {/* Subtle background overlay for glass effect */}
                <View
                    style={[
                        StyleSheet.absoluteFillObject,
                        {
                            backgroundColor: variants.primary.light,
                            opacity: 0.1,
                            borderRadius: theme.borderRadius.lg,
                        }
                    ]}
                />
                {containerContent}
            </View>
        );
    }

    return (
        <View style={[styles.container, variantStyle, style]}>
            {containerContent}
        </View>
    );
}

// Specialized variants for common use cases
export function ElevatedSettingsSection(props: Omit<SettingsSectionProps, 'variant'>) {
    return <SettingsSection variant="elevated" {...props} />;
}

export function GlassSettingsSection(props: Omit<SettingsSectionProps, 'variant'>) {
    return <SettingsSection variant="glass" {...props} />;
}

export function OutlinedSettingsSection(props: Omit<SettingsSectionProps, 'variant'>) {
    return <SettingsSection variant="outlined" {...props} />;
}

const styles = StyleSheet.create({
    container: {
        borderRadius: 16,
        marginBottom: 20,
        overflow: 'hidden',
        position: 'relative',
    },
    header: {
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 12,
    },
    title: {
        fontWeight: '600',
        marginBottom: 4,
    },
    subtitle: {
        lineHeight: 20,
    },
    content: {
        paddingHorizontal: 20,
        paddingBottom: 20,
        gap: 16,
    },
});