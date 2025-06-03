import React, { forwardRef } from 'react';
import { Pressable, ViewStyle, PressableProps } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import {
    useSemanticColors,
    useColorVariants,
    useButtonTheme,
    useTypography,
    useMotionValues,
    useTheme,
} from '@/hooks/useThemeColor';

// Enhanced variant system matching your button theme
type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'destructive' | 'ghost' | 'outline';
type ButtonSize = 'small' | 'medium' | 'large';

interface ThemedPressableProps extends Omit<PressableProps, 'style'> {
    children?: React.ReactNode;
    style?: ViewStyle | ViewStyle[];
    variant?: ButtonVariant;
    size?: ButtonSize;
    disabled?: boolean;
    loading?: boolean;
    fullWidth?: boolean;
    // Animation controls
    animateOnPress?: boolean;
    hapticFeedback?: boolean;
    glowOnHover?: boolean;
}

// Create AnimatedPressable correctly
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const ThemedPressable = forwardRef<
    React.ElementRef<typeof Pressable>,
    ThemedPressableProps
>(({
       children,
       style,
       variant = 'ghost',
       size = 'medium',
       disabled = false,
       loading = false,
       fullWidth = false,
       animateOnPress = true,
       hapticFeedback = true,
       glowOnHover = false,
       onPress,
       onPressIn,
       onPressOut,
       ...props
   }, ref) => {
    const semanticColors = useSemanticColors();
    const variants = useColorVariants();
    const buttonTheme = useButtonTheme();
    const typography = useTypography();
    const motion = useMotionValues();
    const theme = useTheme();

    // Animation values
    const scale = useSharedValue(1);
    const opacity = useSharedValue(1);
    const glowOpacity = useSharedValue(0);

    // Get variant-specific styling
    const variantStyle = buttonTheme[variant] || buttonTheme.ghost;

    // Size configurations
    const getSizeStyle = () => {
        switch (size) {
            case 'small':
                return {
                    paddingHorizontal: theme.spacing.sm,
                    paddingVertical: theme.spacing.xs,
                    minHeight: 32,
                    borderRadius: theme.borderRadius.sm,
                };
            case 'large':
                return {
                    paddingHorizontal: theme.spacing.xl,
                    paddingVertical: theme.spacing.md,
                    minHeight: 56,
                    borderRadius: theme.borderRadius.lg,
                };
            case 'medium':
            default:
                return {
                    paddingHorizontal: theme.spacing.md,
                    paddingVertical: theme.spacing.sm,
                    minHeight: 44,
                    borderRadius: theme.borderRadius.md,
                };
        }
    };

    // Animation styles
    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: opacity.value,
    }));

    const glowStyle = useAnimatedStyle(() => ({
        shadowOpacity: glowOpacity.value * 0.3,
        shadowRadius: glowOpacity.value * 8,
        shadowOffset: {
            width: 0,
            height: glowOpacity.value * 4
        },
        elevation: glowOpacity.value * 4,
    }));

    // Interaction handlers
    const handlePressIn = (event: any) => {
        if (animateOnPress && !disabled && !loading) {
            scale.value = withSpring(0.96, { damping: 15, stiffness: 300 });

            if (glowOnHover) {
                glowOpacity.value = withTiming(1, { duration: motion.duration.fast });
            }

            if (hapticFeedback) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
        }
        onPressIn?.(event);
    };

    const handlePressOut = (event: any) => {
        if (animateOnPress && !disabled && !loading) {
            scale.value = withSpring(1, { damping: 15, stiffness: 300 });

            if (glowOnHover) {
                glowOpacity.value = withTiming(0, { duration: motion.duration.medium });
            }
        }
        onPressOut?.(event);
    };

    const handlePress = (event: any) => {
        if (!disabled && !loading) {
            if (hapticFeedback) {
                Haptics.selectionAsync();
            }
            onPress?.(event);
        }
    };

    // Combined styles
    const combinedStyle = [
        // Base styles
        {
            alignItems: 'center' as const,
            justifyContent: 'center' as const,
            flexDirection: 'row' as const,
            overflow: 'hidden' as const,
            position: 'relative' as const,
            ...(fullWidth && { width: '100%' }),
        },
        // Variant styles
        variantStyle,
        // Size styles
        getSizeStyle(),
        // Disabled styles
        disabled && {
            opacity: 0.5,
            ...(variant === 'primary' && {
                backgroundColor: semanticColors.disabled,
            }),
        },
        // Loading styles
        loading && {
            opacity: 0.7,
        },
        // Animation styles
        animatedStyle,
        ...(glowOnHover ? [glowStyle] : []),
        // Custom styles
        style,
    ];

    // Ripple color for Android
    const getRippleColor = () => {
        switch (variant) {
            case 'primary':
                return variants.primaryPressed;
            case 'secondary':
                return variants.surfacePressed;
            case 'destructive':
                return 'rgba(255,255,255,0.2)';
            default:
                return variants.surfacePressed;
        }
    };

    return (
        <>
            {/* Glow effect background */}
            {glowOnHover && (
                <Animated.View
                    style={[
                        {
                            position: 'absolute',
                            top: -2,
                            left: -2,
                            right: -2,
                            bottom: -2,
                            borderRadius: getSizeStyle().borderRadius + 2,
                            backgroundColor: variants.primarySubtle,
                            zIndex: -1,
                        },
                        useAnimatedStyle(() => ({
                            opacity: glowOpacity.value * 0.5,
                            transform: [{ scale: 1 + glowOpacity.value * 0.05 }],
                        })),
                    ]}
                    pointerEvents="none"
                />
            )}

            <AnimatedPressable
                ref={ref}
                {...props}
                style={combinedStyle}
                onPress={handlePress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                disabled={disabled || loading}
                android_ripple={{
                    color: getRippleColor(),
                    borderless: false,
                }}
            >
                {children}
            </AnimatedPressable>
        </>
    );
});

ThemedPressable.displayName = 'ThemedPressable';

// Specialized button components for common use cases
export const PrimaryButton = forwardRef<
    React.ElementRef<typeof Pressable>,
    Omit<ThemedPressableProps, 'variant'>
>((props, ref) => {
    return <ThemedPressable ref={ref} variant="primary" hapticFeedback glowOnHover {...props} />;
});

PrimaryButton.displayName = 'PrimaryButton';

export const SecondaryButton = forwardRef<
    React.ElementRef<typeof Pressable>,
    Omit<ThemedPressableProps, 'variant'>
>((props, ref) => {
    return <ThemedPressable ref={ref} variant="secondary" {...props} />;
});

SecondaryButton.displayName = 'SecondaryButton';

export const DestructiveButton = forwardRef<
    React.ElementRef<typeof Pressable>,
    Omit<ThemedPressableProps, 'variant'>
>((props, ref) => {
    return <ThemedPressable ref={ref} variant="destructive" hapticFeedback {...props} />;
});

DestructiveButton.displayName = 'DestructiveButton';

export const GhostButton = forwardRef<
    React.ElementRef<typeof Pressable>,
    Omit<ThemedPressableProps, 'variant'>
>((props, ref) => {
    return <ThemedPressable ref={ref} variant="ghost" {...props} />;
});

GhostButton.displayName = 'GhostButton';