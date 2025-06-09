import React, { PropsWithChildren, useState } from 'react';
import { Pressable, StyleSheet, ViewStyle } from 'react-native';
// import { BlurView } from 'expo-blur';
import { ThemedIcon } from './ThemedIcon';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  // interpolate,
  Layout,
  FadeInDown,
  FadeOutUp,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import {
  useSemanticColors,
  useColorVariants,
  // useTypography,
  useTheme,
  useMotionValues,
  useColors,
} from '@/hooks/useThemeColor';

interface CollapsibleProps extends PropsWithChildren {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  variant?: 'default' | 'card' | 'outlined' | 'subtle';
  size?: 'small' | 'medium' | 'large';
  style?: ViewStyle;
  disabled?: boolean;
  icon?: string;
  onToggle?: (isOpen: boolean) => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Collapsible({
                              children,
                              title,
                              subtitle,
                              defaultOpen = false,
                              variant = 'default',
                              size = 'medium',
                              style,
                              disabled = false,
                              icon,
                              onToggle,
                            }: CollapsibleProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const semanticColors = useSemanticColors();
  const variants = useColorVariants();
  // const typography = useTypography();
  const theme = useTheme();
  const motion = useMotionValues();
  const colors = useColors();

  // Animation values
  const rotation = useSharedValue(defaultOpen ? 180 : 0);
  const scale = useSharedValue(1);
  const backgroundOpacity = useSharedValue(0);

  // Get variant-specific styling
  const getVariantStyle = () => {
    switch (variant) {
      case 'card':
        return {
          backgroundColor: semanticColors.surface,
          borderRadius: theme.borderRadius.lg,
          borderWidth: 0,
          ...theme.shadows.sm,
        };
      case 'outlined':
        return {
          backgroundColor: 'transparent',
          borderRadius: theme.borderRadius.md,
          borderWidth: 1,
          borderColor: colors.border,
        };
      case 'subtle':
        return {
          backgroundColor: variants.neutral.light,
          borderRadius: theme.borderRadius.md,
          borderWidth: 0,
        };
      default:
        return {
          backgroundColor: 'transparent',
          borderRadius: 0,
          borderWidth: 0,
        };
    }
  };

  // Get size-specific spacing
  const getSizeSpacing = () => {
    switch (size) {
      case 'small':
        return {
          headerPadding: theme.spacing.sm,
          contentPadding: theme.spacing.sm,
          iconSize: 16,
          gap: theme.spacing.xs,
        };
      case 'large':
        return {
          headerPadding: theme.spacing.lg,
          contentPadding: theme.spacing.lg,
          iconSize: 24,
          gap: theme.spacing.md,
        };
      default:
        return {
          headerPadding: theme.spacing.md,
          contentPadding: theme.spacing.md,
          iconSize: 20,
          gap: theme.spacing.sm,
        };
    }
  };

  const variantStyle = getVariantStyle();
  const sizeConfig = getSizeSpacing();

  // Handle toggle
  const handleToggle = () => {
    if (disabled) return;

    const newState = !isOpen;
    setIsOpen(newState);
    onToggle?.(newState);

    // Haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Animate chevron rotation
    rotation.value = withSpring(newState ? 180 : 0, {
      damping: 15,
      stiffness: 300,
    });

    // Subtle background highlight on interaction
    backgroundOpacity.value = withTiming(0.5, { duration: 100 }, () => {
      backgroundOpacity.value = withTiming(0, { duration: 200 });
    });
  };

  // Handle press animations
  const handlePressIn = () => {
    if (!disabled) {
      scale.value = withSpring(0.98, { damping: 15, stiffness: 300 });
    }
  };

  const handlePressOut = () => {
    if (!disabled) {
      scale.value = withSpring(1, { damping: 15, stiffness: 300 });
    }
  };

  // Animated styles
  const headerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const chevronAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const backgroundAnimatedStyle = useAnimatedStyle(() => ({
    opacity: backgroundOpacity.value,
  }));

  const rippleColor = variant === 'card'
      ? variants.neutral.dark
      : variants.primary.light;

  return (
      <ThemedView style={[styles.container, variantStyle, style]}>
        {/* Header */}
        <AnimatedPressable
            style={[
              styles.header,
              { padding: sizeConfig.headerPadding },
              headerAnimatedStyle,
            ]}
            onPress={handleToggle}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            disabled={disabled}
            android_ripple={{ color: rippleColor }}
            accessibilityRole="button"
            accessibilityState={{ expanded: isOpen }}
            accessibilityHint={`${isOpen ? 'Collapse' : 'Expand'} ${title} section`}
        >
          {/* Background highlight overlay */}
          <Animated.View
              style={[
                StyleSheet.absoluteFillObject,
                {
                  backgroundColor: variants.neutral.light,
                  borderRadius: variant === 'default' ? 0 : theme.borderRadius.md,
                },
                backgroundAnimatedStyle,
              ]}
              pointerEvents="none"
          />

          <ThemedView background="transparent" style={styles.headerContent}>
            {/* Leading icon (optional) */}
            {icon && (
                <ThemedView style={[
                  styles.leadingIcon,
                  { backgroundColor: variants.primary.light }
                ]}>
                  <ThemedIcon
                      name={icon as any}
                      size={sizeConfig.iconSize - 4}
                      color="accent"
                  />
                </ThemedView>
            )}

            {/* Title and subtitle */}
            <ThemedView background="transparent" style={styles.titleContainer}>
              <ThemedText
                  variant={size === 'large' ? 'h3' : 'body'}
                  style={[
                    styles.title,
                    { color: semanticColors.primary },
                    disabled && { opacity: 0.5 }
                  ]}
                  numberOfLines={1}
              >
                {title}
              </ThemedText>
              {subtitle && (
                  <ThemedText
                      variant={size === 'large' ? 'body' : 'bodySmall'}
                      color="secondary"
                      style={[
                        styles.subtitle,
                        disabled && { opacity: 0.5 }
                      ]}
                      numberOfLines={2}
                  >
                    {subtitle}
                  </ThemedText>
              )}
            </ThemedView>

            {/* Chevron icon */}
            <Animated.View style={chevronAnimatedStyle}>
              <ThemedIcon
                  name="chevron-down"
                  size={sizeConfig.iconSize}
                  color={disabled ? "tertiary" : "secondary"}
              />
            </Animated.View>
          </ThemedView>
        </AnimatedPressable>

        {/* Content */}
        {isOpen && (
            <Animated.View
                entering={FadeInDown.duration(200).springify()}
                exiting={FadeOutUp.duration(150).springify()}
                layout={Layout.springify()}
            >
                <ThemedView
                    style={[
                      styles.content,
                      {
                        padding: sizeConfig.contentPadding,
                        paddingTop: variant === 'default' ? sizeConfig.gap : 0,
                      }
                    ]}
                >
              {/* Subtle separator for default variant */}
              {variant === 'default' && (
                  <ThemedView
                      style={[
                        styles.separator,
                        { backgroundColor: colors.border }
                      ]}
                  />
              )}

              {children}
                </ThemedView>
            </Animated.View>
        )}
      </ThemedView>
  );
}

// Specialized variants for common use cases
export function CollapsibleCard({ children, ...props }: Omit<CollapsibleProps, 'variant'>) {
  return <Collapsible variant="card" {...props}>{children}</Collapsible>;
}

export function CollapsibleSection({ children, ...props }: Omit<CollapsibleProps, 'variant'>) {
  return <Collapsible variant="outlined" size="large" {...props}>{children}</Collapsible>;
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  header: {
    position: 'relative',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  leadingIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleContainer: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontWeight: '600',
  },
  subtitle: {
    lineHeight: 18,
  },
  content: {
    position: 'relative',
  },
  separator: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    opacity: 0.3,
  },
});