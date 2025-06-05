import React, { useEffect, useRef, useCallback } from 'react';
import {
    ViewStyle,
    Pressable,
    Text,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { ThemedIcon } from './ThemedIcon';
import * as Haptics from 'expo-haptics';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    useAnimatedGestureHandler,
    withSpring,
    withTiming,
    runOnJS,
    interpolate,
    Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
    useTheme,
    useSemanticColors,
    useColorVariants,
    useTypography,
    useMotionValues,
} from '@/hooks/useThemeColor';
import {PanGestureHandler} from "react-native-gesture-handler";

// Snackbar variants with semantic meaning
type SnackbarVariant = 'default' | 'success' | 'error' | 'warning' | 'info';

// Enhanced props interface
interface ModernSnackbarProps {
    visible: boolean;
    message: string;
    onHide: () => void;
    variant?: SnackbarVariant;
    duration?: number;
    action?: {
        label: string;
        onPress: () => void;
    };
    icon?: string;
    position?: 'top' | 'bottom';
    style?: ViewStyle;
    swipeToDismiss?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function ThemedSnackbar({
                                   visible,
                                   message,
                                   onHide,
                                   variant = 'default',
                                   duration = 4000,
                                   action,
                                   icon,
                                   position = 'bottom',
                                   style,
                                   swipeToDismiss = true,
                               }: ModernSnackbarProps) {
    const theme = useTheme();
    const semanticColors = useSemanticColors();
    const variants = useColorVariants();
    const typography = useTypography();
    const motion = useMotionValues();
    const insets = useSafeAreaInsets();

    // Animation values
    const translateY = useSharedValue(position === 'bottom' ? 100 : -100);
    const opacity = useSharedValue(0);
    const scale = useSharedValue(0.9);
    const gestureTranslateY = useSharedValue(0);
    const gestureOpacity = useSharedValue(1);

    // Timer ref for auto-dismiss
    const timeoutRef = useRef<NodeJS.Timeout>();

    // Get variant-specific styling
    const getVariantStyle = () => {
        switch (variant) {
            case 'success':
                return {
                    backgroundColor: semanticColors.successContainer,
                    borderColor: semanticColors.success,
                    iconColor: semanticColors.success,
                    iconName: icon || 'check-circle',
                };
            case 'error':
                return {
                    backgroundColor: semanticColors.errorContainer,
                    borderColor: semanticColors.error,
                    iconColor: semanticColors.error,
                    iconName: icon || 'alert-circle',
                };
            case 'warning':
                return {
                    backgroundColor: semanticColors.warningContainer,
                    borderColor: semanticColors.warning,
                    iconColor: semanticColors.warning,
                    iconName: icon || 'alert-triangle',
                };
            case 'info':
                return {
                    backgroundColor: semanticColors.infoContainer,
                    borderColor: semanticColors.info,
                    iconColor: semanticColors.info,
                    iconName: icon || 'info',
                };
            default:
                return {
                    backgroundColor: 'transparent',
                    borderColor: variants.primaryMuted,
                    iconColor: semanticColors.primary,
                    iconName: icon || 'message-circle',
                };
        }
    };

    const variantStyle = getVariantStyle();

    // Enhanced entrance animation
    const showSnackbar = useCallback(() => {
        // Haptic feedback on show
        Haptics.notificationAsync(
            variant === 'error'
                ? Haptics.NotificationFeedbackType.Error
                : variant === 'success'
                    ? Haptics.NotificationFeedbackType.Success
                    : Haptics.NotificationFeedbackType.Warning
        );

        // Smooth spring entrance
        translateY.value = withSpring(0, {
            damping: 20,
            stiffness: 300,
            mass: 0.8,
        });

        opacity.value = withTiming(1, {
            duration: motion.duration.medium,
            easing: Easing.out(Easing.exp),
        });

        scale.value = withSpring(1, {
            damping: 15,
            stiffness: 400,
        });

        // Auto-dismiss timer
        if (duration > 0) {
            timeoutRef.current = setTimeout(() => {
                onHide();
            }, duration);
        }
    }, [variant, translateY, opacity, scale, motion.duration.medium, duration, onHide]);

    // Enhanced exit animation
    const hideSnackbar = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        translateY.value = withSpring(position === 'bottom' ? 100 : -100, {
            damping: 20,
            stiffness: 300,
        });

        opacity.value = withTiming(0, {
            duration: motion.duration.fast,
        });

        scale.value = withTiming(0.9, {
            duration: motion.duration.fast,
        });

        // Call onHide after animation
        setTimeout(onHide, motion.duration.fast);
    }, [position, translateY, opacity, scale, motion.duration.fast, onHide]);

    // Swipe to dismiss gesture handler
    const gestureHandler = useAnimatedGestureHandler({
        onStart: () => {
            if (timeoutRef.current) {
                runOnJS(clearTimeout)(timeoutRef.current);
            }
        },
        onActive: (event) => {
            if (!swipeToDismiss) return;

            const dismissDirection = position === 'bottom' ? 1 : -1;
            const translation = event.translationY * dismissDirection;

            if (translation > 0) {
                gestureTranslateY.value = translation;
                gestureOpacity.value = interpolate(
                    translation,
                    [0, 150],
                    [1, 0],
                    'clamp'
                );
            }
        },
        onEnd: (event) => {
            const dismissDirection = position === 'bottom' ? 1 : -1;
            const translation = event.translationY * dismissDirection;
            const velocity = event.velocityY * dismissDirection;

            if (translation > 50 || velocity > 500) {
                // Dismiss
                gestureTranslateY.value = withTiming(200 * dismissDirection, {
                    duration: motion.duration.fast,
                });
                gestureOpacity.value = withTiming(0, {
                    duration: motion.duration.fast,
                });

                setTimeout(() => runOnJS(onHide)(), motion.duration.fast);
            } else {
                // Snap back
                gestureTranslateY.value = withSpring(0);
                gestureOpacity.value = withSpring(1);

                // Restart auto-dismiss timer
                if (duration > 0) {
                    timeoutRef.current = setTimeout(() => {
                        runOnJS(hideSnackbar)();
                    }, duration);
                }
            }
        },
    });

    // Handle visibility changes
    useEffect(() => {
        if (visible) {
            showSnackbar();
        } else {
            hideSnackbar();
        }

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [visible, hideSnackbar, showSnackbar]);

    // Animated styles
    const containerStyle = useAnimatedStyle(() => ({
        transform: [
            { translateY: translateY.value + gestureTranslateY.value },
            { scale: scale.value },
        ],
        opacity: opacity.value * gestureOpacity.value,
    }));

    // Don't render if not visible
    if (!visible && opacity.value === 0) return null;

    const bottomOffset = insets.bottom + theme.spacing.lg;
    const topOffset = insets.top + theme.spacing.lg;

    return (
        <PanGestureHandler onGestureEvent={gestureHandler} enabled={swipeToDismiss}>
            <Animated.View
                style={[
                    {
                        position: 'absolute',
                        left: theme.spacing.md,
                        right: theme.spacing.md,
                        [position]: position === 'bottom' ? bottomOffset : topOffset,
                        zIndex: 1000,
                    },
                    containerStyle,
                    style,
                ]}
            >
                <BlurView
                    intensity={variant === 'default' ? 80 : 60}
                    tint={semanticColors.background === '#FFFFFF' ? 'light' : 'dark'}
                    style={{
                        borderRadius: theme.borderRadius.lg,
                        borderWidth: 1,
                        borderColor: variantStyle.borderColor,
                        overflow: 'hidden',
                        ...theme.shadows.lg,
                    }}
                >
                    {/* Background overlay for variant colors */}
                    {variant !== 'default' && (
                        <Animated.View
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                backgroundColor: variantStyle.backgroundColor,
                                opacity: 0.15,
                            }}
                        />
                    )}

                    <AnimatedPressable
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingVertical: theme.spacing.md,
                            paddingHorizontal: theme.spacing.md,
                            gap: theme.spacing.sm,
                        }}
                        onPress={action ? undefined : hideSnackbar}
                        android_ripple={!action ? { color: variants.surfacePressed } : null}
                    >
                        {/* Icon */}
                        {variantStyle.iconName && (
                            <ThemedIcon
                                name={variantStyle.iconName as any}
                                size={20}
                                color="accent"
                            />
                        )}

                        {/* Message */}
                        <Text
                            style={[
                                typography.bodyMedium,
                                {
                                    color: semanticColors.text,
                                    flex: 1,
                                    lineHeight: 20,
                                },
                            ]}
                            numberOfLines={2}
                        >
                            {message}
                        </Text>

                        {/* Action button */}
                        {action && (
                            <Pressable
                                style={{
                                    paddingVertical: theme.spacing.xs,
                                    paddingHorizontal: theme.spacing.sm,
                                    borderRadius: theme.borderRadius.sm,
                                    backgroundColor: variants.primarySubtle,
                                }}
                                onPress={() => {
                                    Haptics.selectionAsync();
                                    action.onPress();
                                    hideSnackbar();
                                }}
                                android_ripple={{ color: variants.primaryPressed }}
                            >
                                <Text
                                    style={[
                                        typography.labelMedium,
                                        {
                                            color: semanticColors.primary,
                                            fontWeight: '600',
                                        },
                                    ]}
                                >
                                    {action.label}
                                </Text>
                            </Pressable>
                        )}

                        {/* Close button for persistent snackbars */}
                        {duration === 0 && !action && (
                            <Pressable
                                style={{
                                    padding: theme.spacing.xs,
                                    borderRadius: theme.borderRadius.sm,
                                }}
                                onPress={hideSnackbar}
                                android_ripple={{ color: variants.surfacePressed }}
                            >
                                <ThemedIcon
                                    name="x"
                                    size={16}
                                    color="secondary"
                                />
                            </Pressable>
                        )}
                    </AnimatedPressable>

                    {/* Swipe indicator for touch targets */}
                    {swipeToDismiss && (
                        <Animated.View
                            style={{
                                position: 'absolute',
                                top: 4,
                                left: '50%',
                                marginLeft: -12,
                                width: 24,
                                height: 3,
                                borderRadius: 1.5,
                                backgroundColor: semanticColors.border,
                                opacity: 0.5,
                            }}
                        />
                    )}
                </BlurView>
            </Animated.View>
        </PanGestureHandler>
    );
}

// Convenience hooks for different variants
export const useSnackbar = () => {
    const [snackbarState, setSnackbarState] = React.useState<{
        visible: boolean;
        message: string;
        variant: SnackbarVariant;
        action?: { label: string; onPress: () => void };
    }>({
        visible: false,
        message: '',
        variant: 'default',
    });

    const show = React.useCallback((
        message: string,
        variant: SnackbarVariant = 'default',
        action?: { label: string; onPress: () => void }
    ) => {
        setSnackbarState({ visible: true, message, variant, action });
    }, []);

    const hide = React.useCallback(() => {
        setSnackbarState(prev => ({ ...prev, visible: false }));
    }, []);

    const showSuccess = React.useCallback((message: string, action?: { label: string; onPress: () => void }) => {
        show(message, 'success', action);
    }, [show]);

    const showError = React.useCallback((message: string, action?: { label: string; onPress: () => void }) => {
        show(message, 'error', action);
    }, [show]);

    const showWarning = React.useCallback((message: string, action?: { label: string; onPress: () => void }) => {
        show(message, 'warning', action);
    }, [show]);

    const showInfo = React.useCallback((message: string, action?: { label: string; onPress: () => void }) => {
        show(message, 'info', action);
    }, [show]);

    return {
        ...snackbarState,
        show,
        hide,
        showSuccess,
        showError,
        showWarning,
        showInfo,
        SnackbarComponent: () => (
            <ThemedSnackbar
                visible={snackbarState.visible}
                message={snackbarState.message}
                variant={snackbarState.variant}
                action={snackbarState.action}
                onHide={hide}
            />
        ),
    };
};