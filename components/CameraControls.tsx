import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
    interpolate,
} from 'react-native-reanimated';

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
    style?: any;
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
    const semanticColors = useSemanticColors();
    const variants = useColorVariants();
    const motion = useMotionValues();

    // Animation values
    const captureScale = useSharedValue(1);
    const captureGlow = useSharedValue(0);
    const flipScale = useSharedValue(1);
    const flipRotation = useSharedValue(0);

    // Size configurations following design system
    const getSizeConfig = () => {
        switch (size) {
            case 'small':
                return {
                    captureSize: 60,
                    captureInner: 48,
                    flipSize: 40,
                    flipIcon: 16,
                    containerPadding: 16
                };
            case 'medium':
                return {
                    captureSize: 70,
                    captureInner: 56,
                    flipSize: 48,
                    flipIcon: 20,
                    containerPadding: 20
                };
            case 'large':
            default:
                return {
                    captureSize: 80,
                    captureInner: 64,
                    flipSize: 56,
                    flipIcon: 24,
                    containerPadding: 24
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
                duration: motion.duration.fast
            }, () => {
                captureGlow.value = withTiming(0, {
                    duration: motion.duration.medium
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
            { duration: motion.duration.medium }
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
                                ? variants.primaryPressed
                                : variants.primaryPressed,
                            borderless: true
                        }}
                    >
                        {/* Glass effect matching app aesthetic */}
                        {variant === 'glass' && (
                            <BlurView
                                intensity={60}
                                tint={semanticColors.background === '#FFFFFF' ? 'light' : 'dark'}
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
                        style={[
                            styles.flipButton,
                            {
                                width: sizeConfig.flipSize,
                                height: sizeConfig.flipSize,
                                borderRadius: sizeConfig.flipSize / 2,
                                backgroundColor: variant === 'glass'
                                    ? 'transparent'
                                    : 'rgba(0,0,0,0.3)',
                            }
                        ]}
                        android_ripple={{
                            color: variants.surfacePressed,
                            borderless: true
                        }}
                    >
                        {/* Consistent glass effect */}
                        {variant === 'glass' && (
                            <BlurView
                                intensity={40}
                                tint={semanticColors.background === '#FFFFFF' ? 'light' : 'dark'}
                                style={StyleSheet.absoluteFillObject}
                            />
                        )}

                        <Feather
                            name="refresh-ccw"
                            size={sizeConfig.flipIcon}
                            color={semanticColors.text}
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
        borderColor: 'rgba(255,255,255,0.2)',
    },
});