import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    Animated,
    PanResponder,
    Dimensions,
} from 'react-native';
import { ThemedIcon } from './ThemedIcon';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
    swipeToDismiss?: boolean;
}

// Icon mapping for variants
const VARIANT_ICONS: Record<SnackbarVariant, string> = {
    default: 'info',
    success: 'check',
    error: 'x',
    warning: 'alert-triangle',
    info: 'info',
};

// Simple variant colors
const VARIANT_COLORS = {
    default: {
        backgroundColor: '#333',
        borderColor: '#555',
        iconColor: '#007AFF',
    },
    success: {
        backgroundColor: '#10B981',
        borderColor: '#059669',
        iconColor: '#ffffff',
    },
    error: {
        backgroundColor: '#EF4444',
        borderColor: '#DC2626',
        iconColor: '#ffffff',
    },
    warning: {
        backgroundColor: '#F59E0B',
        borderColor: '#D97706',
        iconColor: '#ffffff',
    },
    info: {
        backgroundColor: '#3B82F6',
        borderColor: '#2563EB',
        iconColor: '#ffffff',
    },
};

export function ThemedSnackbar({
    visible,
    message,
    onHide,
    variant = 'default',
    duration = 4000,
    action,
    icon,
    position = 'bottom',
    swipeToDismiss = true,
}: ModernSnackbarProps) {
    const insets = useSafeAreaInsets();

    // Animation values using React Native's Animated API
    const translateY = useRef(new Animated.Value(100)).current;
    const opacity = useRef(new Animated.Value(0)).current;
    const translateX = useRef(new Animated.Value(0)).current;
    const scale = useRef(new Animated.Value(0.9)).current;

    // Auto-hide timer
    const hideTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Show animation
    const showSnackbar = useCallback(() => {
        Animated.parallel([
            Animated.timing(opacity, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }),
            Animated.timing(translateY, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }),
            Animated.timing(scale, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }),
        ]).start();

        // Haptic feedback
        Haptics.notificationAsync(
            variant === 'success' ? Haptics.NotificationFeedbackType.Success :
            variant === 'error' ? Haptics.NotificationFeedbackType.Error :
            Haptics.NotificationFeedbackType.Warning
        );
    }, [opacity, translateY, scale, variant]);

    // Hide animation
    const hideSnackbar = useCallback(() => {
        Animated.parallel([
            Animated.timing(opacity, {
                toValue: 0,
                duration: 250,
                useNativeDriver: true,
            }),
            Animated.timing(translateY, {
                toValue: position === 'bottom' ? 100 : -100,
                duration: 250,
                useNativeDriver: true,
            }),
            Animated.timing(scale, {
                toValue: 0.9,
                duration: 250,
                useNativeDriver: true,
            }),
        ]).start(() => {
            onHide();
            translateX.setValue(0); // Reset swipe position
        });
    }, [opacity, translateY, scale, position, onHide, translateX]);

    // Pan responder for swipe to dismiss
    const panResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (_, gestureState) => {
                return swipeToDismiss && Math.abs(gestureState.dx) > 10;
            },
            onPanResponderMove: (_, gestureState) => {
                translateX.setValue(gestureState.dx);
            },
            onPanResponderRelease: (_, gestureState) => {
                const { dx, vx } = gestureState;
                const shouldDismiss = Math.abs(dx) > SCREEN_WIDTH * 0.3 || Math.abs(vx) > 0.5;

                if (shouldDismiss) {
                    // Swipe off screen
                    Animated.parallel([
                        Animated.timing(translateX, {
                            toValue: dx > 0 ? SCREEN_WIDTH : -SCREEN_WIDTH,
                            duration: 200,
                            useNativeDriver: true,
                        }),
                        Animated.timing(opacity, {
                            toValue: 0,
                            duration: 200,
                            useNativeDriver: true,
                        }),
                    ]).start(() => {
                        onHide();
                        translateX.setValue(0);
                    });
                } else {
                    // Spring back to center
                    Animated.spring(translateX, {
                        toValue: 0,
                        useNativeDriver: true,
                    }).start();
                }
            },
        })
    ).current;

    // Handle visibility changes
    useEffect(() => {
        if (visible) {
            showSnackbar();
            
            // Set auto-hide timer
            if (duration > 0) {
                hideTimerRef.current = setTimeout(() => {
                    hideSnackbar();
                }, duration) as any;
            }
        } else {
            hideSnackbar();
        }

        return () => {
            if (hideTimerRef.current) {
                clearTimeout(hideTimerRef.current);
            }
        };
    }, [visible, duration, showSnackbar, hideSnackbar]);

    if (!visible) return null;

    const variantStyles = VARIANT_COLORS[variant];
    const displayIcon = icon || VARIANT_ICONS[variant];

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    [position]: insets[position] + 20,
                    transform: [
                        { translateY },
                        { translateX },
                        { scale },
                    ],
                    opacity,
                },
            ]}
            {...(swipeToDismiss ? panResponder.panHandlers : {})}
        >
            <View
                style={[
                    styles.content,
                    {
                        backgroundColor: variantStyles.backgroundColor,
                        borderColor: variantStyles.borderColor,
                    },
                ]}
            >
                {/* Icon */}
                {displayIcon && (
                    <ThemedIcon
                        name={displayIcon as any}
                        size={20}
                        color="primary"
                        style={[styles.icon, { tintColor: variantStyles.iconColor }]}
                    />
                )}

                {/* Message */}
                <Text
                    style={[styles.message, { color: 'white' }]}
                    numberOfLines={2}
                >
                    {message}
                </Text>

                {/* Action button */}
                {action && (
                    <Pressable
                        style={styles.actionButton}
                        onPress={() => {
                            action.onPress();
                            hideSnackbar();
                        }}
                    >
                        <Text
                            style={[
                                styles.actionText,
                                { color: variantStyles.iconColor },
                            ]}
                        >
                            {action.label}
                        </Text>
                    </Pressable>
                )}

                {/* Close button */}
                <Pressable
                    style={styles.closeButton}
                    onPress={hideSnackbar}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <ThemedIcon
                        name="x" 
                        size={16}
                        color="primary"
                        style={{ tintColor: 'rgba(255, 255, 255, 0.7)' }}
                    />
                </Pressable>
            </View>
        </Animated.View>
    );
}

// Hook for using snackbar in components
export function useSnackbar() {
    const [snackbarState, setSnackbarState] = useState({
        visible: false,
        message: '',
        variant: 'default' as SnackbarVariant,
    });

    const showSnackbar = useCallback((message: string, variant: SnackbarVariant = 'default') => {
        setSnackbarState({ visible: true, message, variant });
    }, []);

    const showSuccess = useCallback((message: string) => {
        showSnackbar(message, 'success');
    }, [showSnackbar]);

    const showError = useCallback((message: string) => {
        showSnackbar(message, 'error');
    }, [showSnackbar]);

    const hideSnackbar = useCallback(() => {
        setSnackbarState(prev => ({ ...prev, visible: false }));
    }, []);

    const SnackbarComponent = useCallback(() => (
        <ThemedSnackbar
            visible={snackbarState.visible}
            message={snackbarState.message}
            variant={snackbarState.variant}
            onHide={hideSnackbar}
        />
    ), [snackbarState, hideSnackbar]);

    return {
        showSnackbar,
        showSuccess,
        showError,
        hideSnackbar,
        SnackbarComponent,
    };
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: 16,
        right: 16,
        zIndex: 9999,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
    },
    icon: {
        marginRight: 12,
    },
    message: {
        flex: 1,
        fontSize: 14,
        fontWeight: '500',
        lineHeight: 20,
    },
    actionButton: {
        marginLeft: 12,
        paddingVertical: 4,
        paddingHorizontal: 8,
    },
    actionText: {
        fontSize: 14,
        fontWeight: '600',
    },
    closeButton: {
        marginLeft: 8,
        padding: 4,
    },
});

export default ThemedSnackbar;