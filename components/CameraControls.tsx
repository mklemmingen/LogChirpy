import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { BlurView } from 'expo-blur';
import { ThemedIcon } from './ThemedIcon';
import * as Haptics from 'expo-haptics';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
    interpolate,
} from 'react-native-reanimated';

import { useUnifiedColors } from '@/hooks/useUnifiedColors';
import { useResponsiveDimensions } from '@/hooks/useResponsiveDimensions';
import {
    useTheme,
    useSemanticColors,
    useColorVariants,
    useMotionValues,
} from '@/hooks/useThemeColor';

interface EnhancedCameraControlsProps {
    onCapture: () => void;
    onFlip: () => void;
    isRecording?: boolean;
    isFlipDisabled?: boolean;
    style?: object;
    // Enhanced props for design system consistency
    size?: 'small' | 'medium' | 'large';
    variant?: 'default' | 'glass';
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function EnhancedCameraControls({
                                           onCapture,
                                           onFlip,
                                           isRecording = false,
                                           isFlipDisabled = false,
                                           style,
                                           size = 'large',
                                           variant = 'glass',
                                       }: EnhancedCameraControlsProps) {
    const theme = useTheme();
    const colors = useUnifiedColors();
    const dimensions = useResponsiveDimensions();
    const semanticColors = useSemanticColors();
    const variants = useColorVariants();
    const motion = useMotionValues();

    // Animation values
    const captureScale = useSharedValue(1);
    const captureGlow = useSharedValue(0);
    const flipScale = useSharedValue(1);
    const flipRotation = useSharedValue(0);

    // Size configurations following responsive design system
    const getSizeConfig = () => {
        const baseSize = dimensions.touchTarget.large;
        const multiplier = dimensions.multipliers.size;
        
        switch (size) {
            case 'small':
                return {
                    captureSize: Math.max(baseSize * 0.75 * multiplier, 48),
                    captureInner: Math.max(baseSize * 0.6 * multiplier, 40),
                    flipSize: Math.max(baseSize * 0.5 * multiplier, 32),
                    flipIcon: dimensions.icon.sm,
                    containerPadding: dimensions.layout.componentSpacing
                };
            case 'medium':
                return {
                    captureSize: Math.max(baseSize * 0.875 * multiplier, 56),
                    captureInner: Math.max(baseSize * 0.7 * multiplier, 48),
                    flipSize: Math.max(baseSize * 0.6 * multiplier, 40),
                    flipIcon: dimensions.icon.md,
                    containerPadding: dimensions.layout.componentSpacing * 1.25
                };
            case 'large':
            default:
                return {
                    captureSize: Math.max(baseSize * multiplier, 64),
                    captureInner: Math.max(baseSize * 0.8 * multiplier, 56),
                    flipSize: Math.max(baseSize * 0.7 * multiplier, 48),
                    flipIcon: dimensions.icon.lg,
                    containerPadding: dimensions.layout.componentSpacing * 1.5
                };
        }
    };

    const sizeConfig = getSizeConfig();

    // Enhanced capture button interaction
    const handleCapturePress = () => {
        // Haptic feedback matching app patterns
        Haptics.impactAsync(
            isRecording
                ? Haptics.ImpactFeedbackStyle.Heavy
                : Haptics.ImpactFeedbackStyle.Medium
        );

        // Spring animation matching design system
        captureScale.value = withSpring(0.95, {
            damping: 15,
            stiffness: 300
        }, () => {
            captureScale.value = withSpring(1, {
                damping: 15,
                stiffness: 300
            });
        });

        // Glow effect for visual feedback
        if (!isRecording) {
            captureGlow.value = withTiming(1, {
                duration: 150
            }, () => {
                captureGlow.value = withTiming(0, {
                    duration: 200
                });
            });
        }

        onCapture();
    };

    // Enhanced flip button interaction
    const handleFlipPress = () => {
        if (isFlipDisabled) return;

        Haptics.selectionAsync();

        flipScale.value = withSpring(0.9, {
            damping: 15,
            stiffness: 300
        }, () => {
            flipScale.value = withSpring(1, {
                damping: 15,
                stiffness: 300
            });
        });

        // Smooth rotation animation
        flipRotation.value = withTiming(
            flipRotation.value + 180,
            { duration: 200 }
        );

        onFlip();
    };

    // Animated styles using design system motion values
    const captureAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: captureScale.value }],
    }));

    const captureGlowStyle = useAnimatedStyle(() => ({
        opacity: captureGlow.value * 0.6,
        transform: [{
            scale: interpolate(captureGlow.value, [0, 1], [1, 1.15])
        }],
    }));

    const flipAnimatedStyle = useAnimatedStyle(() => ({
        transform: [
            { scale: flipScale.value },
            { rotate: `${flipRotation.value}deg` }
        ],
        opacity: isFlipDisabled ? 0.4 : 1,
    }));

    return (
        <View style={[
            styles.container,
            { paddingHorizontal: sizeConfig.containerPadding },
            style
        ]}>
            {/* Left spacer for balance */}
            <View style={styles.section} />

            {/* Enhanced Capture Button */}
            <View style={styles.section}>
                <Animated.View style={captureAnimatedStyle}>
                    {/* Glow effect using design system colors */}
                    <Animated.View
                        style={[
                            styles.glowEffect,
                            {
                                width: sizeConfig.captureSize + 20,
                                height: sizeConfig.captureSize + 20,
                                borderRadius: (sizeConfig.captureSize + 20) / 2,
                                backgroundColor: isRecording
                                    ? semanticColors.error
                                    : semanticColors.primary,
                            },
                            captureGlowStyle,
                        ]}
                    />

                    <AnimatedPressable
                        onPress={handleCapturePress}
                        accessibilityRole="button"
                        accessibilityLabel={isRecording ? "Stop recording" : "Take photo"}
                        accessibilityHint={isRecording ? "Stop video recording" : "Capture a photo"}
                        style={[
                            styles.captureButton,
                            {
                                width: sizeConfig.captureSize,
                                height: sizeConfig.captureSize,
                                borderRadius: sizeConfig.captureSize / 2,
                                borderColor: isRecording
                                    ? semanticColors.error
                                    : semanticColors.primary,
                            }
                        ]}
                        android_ripple={{
                            color: isRecording
                                ? variants.primary.dark
                                : variants.primary.dark,
                            borderless: true
                        }}
                    >
                        {/* Glass effect matching app aesthetic */}
                        {variant === 'glass' && (
                            <BlurView
                                intensity={60}
                                tint={colors.isDark ? 'dark' : 'light'}
                                style={StyleSheet.absoluteFillObject}
                            />
                        )}

                        <View
                            style={[
                                styles.captureInner,
                                {
                                    backgroundColor: isRecording
                                        ? semanticColors.error
                                        : semanticColors.primary,
                                    width: sizeConfig.captureInner,
                                    height: sizeConfig.captureInner,
                                    borderRadius: isRecording
                                        ? theme.borderRadius.md
                                        : sizeConfig.captureInner / 2,
                                }
                            ]}
                        />
                    </AnimatedPressable>
                </Animated.View>
            </View>

            {/* Enhanced Flip Camera Button */}
            <View style={styles.section}>
                <Animated.View style={flipAnimatedStyle}>
                    <AnimatedPressable
                        onPress={handleFlipPress}
                        disabled={isFlipDisabled}
                        accessibilityRole="button"
                        accessibilityLabel="Flip camera"
                        accessibilityHint="Switch between front and back camera"
                        accessibilityState={{ disabled: isFlipDisabled }}
                        style={[
                            styles.flipButton,
                            {
                                width: sizeConfig.flipSize,
                                height: sizeConfig.flipSize,
                                borderRadius: sizeConfig.flipSize / 2,
                                backgroundColor: variant === 'glass'
                                    ? colors.interactive.ghost
                                    : theme.colors.overlay.light,
                                borderColor: `${colors.border.secondary}33`, // 20% opacity
                            }
                        ]}
                        android_ripple={{
                            color: variants.neutral.dark,
                            borderless: true
                        }}
                    >
                        {/* Consistent glass effect */}
                        {variant === 'glass' && (
                            <BlurView
                                intensity={40}
                                tint={colors.isDark ? 'dark' : 'light'}
                                style={StyleSheet.absoluteFillObject}
                            />
                        )}

                        <ThemedIcon
                            name="refresh-ccw"
                            size={sizeConfig.flipIcon}
                            color="primary"
                        />
                    </AnimatedPressable>
                </Animated.View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 24,
    },
    section: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    glowEffect: {
        position: 'absolute',
        zIndex: -1,
    },
    captureButton: {
        borderWidth: 4,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    captureInner: {
        // Dynamic styles applied via props
    },
    flipButton: {
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        borderWidth: 1,
        // borderColor will be set dynamically using unified colors
    },
});