import React from 'react';
import {
    View,
    Text,
    Pressable,
    StyleSheet,
    ViewStyle,
    TextStyle,
    Image,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
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
    useCardTheme,
    useTypography,
    useMotionValues
} from '@/hooks/useThemeColor';
import { ImageSource } from "expo-image";

// Card variants
type CardVariant = 'default' | 'elevated' | 'outlined' | 'filled' | 'primary' | 'accent' | 'glass';

// Card component props
interface ModernCardProps {
    children?: React.ReactNode;
    variant?: CardVariant;
    onPress?: () => void;
    onLongPress?: () => void;
    disabled?: boolean;
    style?: ViewStyle;

    // Header props
    title?: string;
    subtitle?: string;
    headerAction?: React.ReactNode;

    // Media props
    image?: ImageSource;
    imageAspectRatio?: number;

    // Footer props
    footer?: React.ReactNode;

    // States
    isSelected?: boolean;
    isLoading?: boolean;

    // Layout control
    padding?: number | 'none' | 'sm' | 'md' | 'lg';
    noPadding?: boolean; // Quick override for no padding

    // Animations
    animateOnPress?: boolean;
    glowOnHover?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function ModernCard({
                               children,
                               variant = 'default',
                               onPress,
                               onLongPress,
                               disabled = false,
                               style,
                               title,
                               subtitle,
                               headerAction,
                               image,
                               imageAspectRatio = 16 / 9,
                               footer,
                               isSelected = false,
                               isLoading = false,
                               padding = 'md',
                               noPadding = false,
                               animateOnPress = true,
                               glowOnHover = false,
                           }: ModernCardProps) {
    const theme = useTheme();
    const semanticColors = useSemanticColors();
    const variants = useColorVariants();
    const cardTheme = useCardTheme();
    const typography = useTypography();
    const motion = useMotionValues();

    // Animation values
    const scale = useSharedValue(1);
    const opacity = useSharedValue(1);
    const glowOpacity = useSharedValue(0);

    // Get card style based on variant with improved shadows
    const getCardStyle = () => {
        const baseStyle = cardTheme[variant as keyof typeof cardTheme] || cardTheme.default;

        // Enhanced shadow system
        const getShadowStyle = () => {
            if (variant === 'glass' || variant === 'outlined') {
                return {}; // No shadow for glass/outlined variants
            }

            return {
                // iOS shadows
                shadowColor: semanticColors.text,
                shadowOffset: {
                    width: 0,
                    height: variant === 'elevated' ? 4 : 2,
                },
                shadowOpacity: variant === 'elevated' ? 0.15 : 0.1,
                shadowRadius: variant === 'elevated' ? 8 : 4,

                // Android elevation
                elevation: variant === 'elevated' ? 6 : 3,
            };
        };

        if (variant === 'glass') {
            return {
                backgroundColor: 'transparent',
                borderColor: variants.primaryMuted,
                borderWidth: 1,
                overflow: 'hidden' as const,
                ...getShadowStyle(),
            };
        }

        return {
            ...baseStyle,
            ...getShadowStyle(),
        };
    };

    // Get padding value
    const getPaddingValue = () => {
        if (noPadding) return 0;

        if (typeof padding === 'number') return padding;

        switch (padding) {
            case 'none': return 0;
            case 'sm': return theme.spacing.sm;
            case 'lg': return theme.spacing.lg;
            case 'md':
            default: return theme.spacing.md;
        }
    };

    // Animation styles
    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ scale: scale.value }],
            opacity: opacity.value,
        };
    });

    const glowStyle = useAnimatedStyle(() => {
        return {
            opacity: glowOpacity.value,
            transform: [{ scale: interpolate(glowOpacity.value, [0, 1], [0.95, 1.05]) }],
        };
    });

    // Handle press animations
    const handlePressIn = () => {
        if (animateOnPress && !disabled) {
            scale.value = withSpring(0.98, { damping: 15, stiffness: 300 });
            if (glowOnHover) {
                glowOpacity.value = withTiming(1, { duration: motion.duration.fast });
            }
        }
    };

    const handlePressOut = () => {
        if (animateOnPress && !disabled) {
            scale.value = withSpring(1, { damping: 15, stiffness: 300 });
            if (glowOnHover) {
                glowOpacity.value = withTiming(0, { duration: motion.duration.medium });
            }
        }
    };

    const paddingValue = getPaddingValue();

    // Render card content with consistent structure
    const renderCardContent = () => (
        <View style={styles.cardContainer}>
            {/* Glow effect */}
            {glowOnHover && (
                <Animated.View
                    style={[
                        StyleSheet.absoluteFillObject,
                        styles.glowEffect,
                        { backgroundColor: variants.primarySubtle },
                        glowStyle,
                    ]}
                    pointerEvents="none"
                />
            )}

            {/* Image - full width, no padding */}
            {image && (
                <View style={[styles.imageContainer, { aspectRatio: imageAspectRatio }]}>
                    <Image source={image} style={styles.image} resizeMode="cover" />
                    {isLoading && (
                        <View style={[styles.loadingOverlay, { backgroundColor: variants.surfaceHover }]}>
                            <Feather name="loader" size={24} color={semanticColors.textSecondary} />
                        </View>
                    )}
                </View>
            )}

            {/* Content wrapper with consistent padding */}
            <View style={[
                styles.contentWrapper,
                { padding: paddingValue }
            ]}>
                {/* Header */}
                {(title || subtitle || headerAction) && (
                    <View style={styles.header}>
                        <View style={styles.headerContent}>
                            {title && (
                                <Text
                                    style={[typography.headlineSmall, styles.title]}
                                    numberOfLines={2}
                                >
                                    {title}
                                </Text>
                            )}
                            {subtitle && (
                                <Text
                                    style={[typography.bodyMedium, styles.subtitle, { color: semanticColors.textSecondary }]}
                                    numberOfLines={1}
                                >
                                    {subtitle}
                                </Text>
                            )}
                        </View>
                        {headerAction && <View style={styles.headerAction}>{headerAction}</View>}
                    </View>
                )}

                {/* Main Content */}
                {children && (
                    <View style={[
                        styles.content,
                        (title || subtitle || headerAction) && styles.contentWithHeader
                    ]}>
                        {children}
                    </View>
                )}

                {/* Footer */}
                {footer && (
                    <View style={[
                        styles.footer,
                        (children || title || subtitle) && styles.footerWithContent
                    ]}>
                        {footer}
                    </View>
                )}
            </View>

            {/* Selection indicator */}
            {isSelected && (
                <View style={[styles.selectionIndicator, { backgroundColor: semanticColors.primary }]}>
                    <Feather name="check" size={16} color={semanticColors.onPrimary} />
                </View>
            )}
        </View>
    );

    // Render with glass effect
    if (variant === 'glass') {
        return (
            <AnimatedPressable
                style={[styles.card, getCardStyle(), style, animatedStyle]}
                onPress={onPress}
                onLongPress={onLongPress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                disabled={disabled || isLoading}
                android_ripple={null}
            >
                <BlurView
                    intensity={60}
                    tint={semanticColors.background === '#FFFFFF' ? 'light' : 'dark'}
                    style={StyleSheet.absoluteFillObject}
                />
                {renderCardContent()}
            </AnimatedPressable>
        );
    }

    // Regular card
    return (
        <AnimatedPressable
            style={[styles.card, getCardStyle(), style, animatedStyle]}
            onPress={onPress}
            onLongPress={onLongPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            disabled={disabled || isLoading}
            android_ripple={onPress ? { color: variants.surfacePressed } : null}
        >
            {renderCardContent()}
        </AnimatedPressable>
    );
}

// Specialized card components with better defaults
export function BirdSpottingCard({
                                     birdName,
                                     scientificName,
                                     date,
                                     location,
                                     image,
                                     hasAudio,
                                     hasVideo,
                                     isLogged,
                                     onPress,
                                     ...props
                                 }: {
    birdName: string;
    scientificName?: string | null;
    date: string;
    location?: string;
    image?: ImageSource;
    hasAudio?: boolean;
    hasVideo?: boolean;
    isLogged?: boolean;
    onPress?: () => void;
} & Partial<ModernCardProps>) {
    const typography = useTypography();
    const semanticColors = useSemanticColors();
    const variants = useColorVariants();

    return (
        <ModernCard
            variant="elevated"
            image={image}
            imageAspectRatio={4 / 3}
            title={birdName}
            subtitle={scientificName || ''}
            onPress={onPress}
            isSelected={isLogged}
            glowOnHover
            padding="md" // Explicit padding
            headerAction={
                isLogged ? (
                    <View style={[styles.badge, { backgroundColor: variants.primarySubtle }]}>
                        <Feather name="check" size={12} color={semanticColors.primary} />
                    </View>
                ) : undefined
            }
            footer={
                <View style={styles.spottingFooter}>
                    <View style={styles.spottingMeta}>
                        <Text style={[typography.labelSmall, { color: semanticColors.textTertiary }]}>
                            {date}
                        </Text>
                        {location && (
                            <View style={styles.locationContainer}>
                                <Feather name="map-pin" size={10} color={semanticColors.textTertiary} />
                                <Text
                                    style={[typography.labelSmall, { color: semanticColors.textTertiary }]}
                                    numberOfLines={1}
                                >
                                    {location}
                                </Text>
                            </View>
                        )}
                    </View>

                    <View style={styles.mediaIndicators}>
                        {hasAudio && <Feather name="mic" size={14} color={semanticColors.primary} />}
                        {hasVideo && <Feather name="video" size={14} color={semanticColors.primary} />}
                        <Feather name="chevron-right" size={16} color={semanticColors.textSecondary} />
                    </View>
                </View>
            }
            {...props}
        />
    );
}

export function BirdDexCard({
                                englishName,
                                scientificName,
                                family,
                                category,
                                isLogged,
                                onPress,
                                onWikipediaPress,
                                ...props
                            }: {
    englishName: string;
    scientificName: string;
    family?: string;
    category?: string;
    isLogged?: boolean;
    onPress?: () => void;
    onWikipediaPress?: () => void;
} & Partial<ModernCardProps>) {
    const typography = useTypography();
    const semanticColors = useSemanticColors();
    const variants = useColorVariants();

    return (
        <ModernCard
            variant={isLogged ? 'primary' : 'default'}
            title={englishName}
            subtitle={scientificName}
            onPress={onPress}
            animateOnPress
            padding="md" // Explicit padding
            headerAction={
                <View style={styles.cardActions}>
                    <Pressable
                        style={[styles.actionButton, { backgroundColor: variants.surfaceHover }]}
                        onPress={onWikipediaPress}
                        android_ripple={{ color: variants.surfacePressed }}
                    >
                        <Feather name="external-link" size={14} color={semanticColors.textSecondary} />
                    </Pressable>
                </View>
            }
            footer={
                <View style={styles.birdDexFooter}>
                    {category && (
                        <View style={[styles.categoryBadge, { backgroundColor: variants.accentSubtle }]}>
                            <Feather name="tag" size={10} color={semanticColors.accent} />
                            <Text style={[typography.labelSmall, { color: semanticColors.accent }]}>
                                {category}
                            </Text>
                        </View>
                    )}

                    {family && (
                        <Text
                            style={[typography.labelSmall, { color: semanticColors.textTertiary }]}
                            numberOfLines={1}
                        >
                            {family}
                        </Text>
                    )}

                    {isLogged && (
                        <View style={[styles.loggedBadge, { backgroundColor: semanticColors.primary }]}>
                            <Feather name="check" size={10} color={semanticColors.onPrimary} />
                        </View>
                    )}
                </View>
            }
            {...props}
        />
    );
}

const styles = StyleSheet.create({
    card: {
        borderRadius: 16,
        overflow: 'hidden',
    },
    cardContainer: {
        position: 'relative',
        flex: 1,
    },
    glowEffect: {
        borderRadius: 16,
        zIndex: -1,
    },

    // Content wrapper for consistent padding
    contentWrapper: {
        flex: 1,
    },

    // Image - full width, no padding applied here
    imageContainer: {
        position: 'relative',
        overflow: 'hidden',
        width: '100%',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
    },
    headerContent: {
        flex: 1,
        marginRight: 12,
    },
    headerAction: {
        flexShrink: 0,
    },
    title: {
        marginBottom: 4,
        fontWeight: '600',
    },
    subtitle: {
        fontStyle: 'italic',
    },

    // Content
    content: {
        // No additional padding - handled by contentWrapper
    },
    contentWithHeader: {
        marginTop: 12, // Spacing between header and content
    },

    // Footer
    footer: {
        // No additional padding - handled by contentWrapper
    },
    footerWithContent: {
        marginTop: 12, // Spacing between content and footer
    },

    // Selection indicator
    selectionIndicator: {
        position: 'absolute',
        top: 12,
        right: 12,
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },

    // Specialized card styles
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },

    spottingFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
    },
    spottingMeta: {
        flex: 1,
        gap: 2,
    },
    locationContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    mediaIndicators: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },

    cardActions: {
        flexDirection: 'row',
        gap: 8,
    },
    actionButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },

    birdDexFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
    },
    categoryBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
        gap: 4,
    },
    loggedBadge: {
        width: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
});