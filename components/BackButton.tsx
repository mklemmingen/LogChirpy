/**
 * BackButton Component
 * 
 * A reusable back button component that provides consistent styling and behavior
 * across all screens in the app. Handles safe area insets and provides proper
 * touch feedback.
 */

import React from 'react';
import {StyleSheet, View} from 'react-native';
import {router} from 'expo-router';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

// Components
import {ThemedPressable} from './ThemedPressable';
import {ThemedIcon} from './ThemedIcon';

// Theme
import {useColors, useTheme} from '@/hooks/useThemeColor';

interface BackButtonProps {
    onPress?: () => void;
    disabled?: boolean;
    variant?: 'default' | 'floating' | 'inline';
    iconSize?: number;
    color?: string;
    style?: any;
}

export function BackButton({
    onPress,
    disabled = false,
    variant = 'default',
    iconSize = 24,
    color = 'primary',
    style,
}: BackButtonProps) {
    const insets = useSafeAreaInsets();
    const colors = useColors();
    const theme = useTheme();

    const handlePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (onPress) {
            onPress();
        } else {
            router.back();
        }
    };

    // Different styles based on variant
    const getContainerStyle = () => {
        switch (variant) {
            case 'floating':
                return [
                    styles.floatingContainer,
                    {
                        top: insets.top + 10,
                        backgroundColor: colors.background + 'CC',
                    },
                ];
            case 'inline':
                return styles.inlineContainer;
            default:
                return [
                    styles.defaultContainer,
                    {
                        marginTop: insets.top + 10,
                    },
                ];
        }
    };

    const getButtonStyle = () => {
        switch (variant) {
            case 'floating':
                return [
                    styles.floatingButton,
                    {
                        backgroundColor: colors.backgroundSecondary + '99',
                        borderColor: colors.border,
                    },
                ];
            case 'inline':
                return styles.inlineButton;
            default:
                return styles.defaultButton;
        }
    };

    if (variant === 'inline') {
        return (
            <ThemedPressable
                variant="ghost"
                onPress={handlePress}
                disabled={disabled}
                style={[getButtonStyle(), style]}
            >
                <ThemedIcon 
                    name="arrow-left" 
                    size={iconSize} 
                    color={disabled ? 'secondary' : color as any} 
                />
            </ThemedPressable>
        );
    }

    return (
        <View style={[getContainerStyle(), style]}>
            <ThemedPressable
                variant="ghost"
                onPress={handlePress}
                disabled={disabled}
                style={getButtonStyle()}
            >
                <ThemedIcon 
                    name="arrow-left" 
                    size={iconSize} 
                    color={disabled ? 'secondary' : color as any} 
                />
            </ThemedPressable>
        </View>
    );
}

const styles = StyleSheet.create({
    // Default variant - used in regular headers
    defaultContainer: {
        paddingHorizontal: 20,
        alignSelf: 'flex-start',
    },
    defaultButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Floating variant - absolute positioned over content
    floatingContainer: {
        position: 'absolute',
        left: 20,
        zIndex: 10,
    },
    floatingButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },

    // Inline variant - used within other components
    inlineContainer: {
        // No container for inline
    },
    inlineButton: {
        padding: 8,
        borderRadius: 20,
    },
});