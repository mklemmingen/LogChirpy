import React from 'react';
import { Tabs } from 'expo-router';
import { Platform, View, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
    interpolate,
} from 'react-native-reanimated';

import {
    useSemanticColors,
    useTheme,
    useTypography,
    useColorVariants,
    useMotionValues
} from '@/hooks/useThemeColor';

// Enhanced Tab Icon Component
function EnhancedTabIcon({
                             iconName,
                             color,
                             focused,
                             size
                         }: {
    iconName: string;
    color: string;
    focused: boolean;
    size: number;
}) {
    const semanticColors = useSemanticColors();
    const variants = useColorVariants();
    const theme = useTheme();
    const motion = useMotionValues();

    // Animation values
    const scale = useSharedValue(focused ? 1.1 : 1);
    const indicatorScale = useSharedValue(focused ? 1 : 0);
    const containerOpacity = useSharedValue(focused ? 1 : 0);

    React.useEffect(() => {
        // Smooth scale animation for icon
        scale.value = withSpring(focused ? 1.1 : 1, {
            damping: 15,
            stiffness: 300,
        });

        // Indicator animation
        indicatorScale.value = withTiming(focused ? 1 : 0, {
            duration: motion.duration.medium,
        });

        // Container background animation
        containerOpacity.value = withTiming(focused ? 1 : 0, {
            duration: motion.duration.medium,
        });

        // Haptic feedback on focus change
        if (focused) {
            Haptics.selectionAsync();
        }
    }, [focused]);

    const iconAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const containerAnimatedStyle = useAnimatedStyle(() => ({
        opacity: containerOpacity.value,
        transform: [{ scale: interpolate(containerOpacity.value, [0, 1], [0.8, 1]) }],
    }));

    const indicatorAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: indicatorScale.value }],
        opacity: indicatorScale.value,
    }));

    return (
        <View style={{
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            paddingHorizontal: theme.spacing.xs,
        }}>
            {/* Animated background container */}
            <Animated.View
                style={[
                    {
                        position: 'absolute',
                        width: 40,
                        height: 40,
                        borderRadius: theme.borderRadius.md,
                        backgroundColor: variants.primarySubtle,
                    },
                    containerAnimatedStyle,
                ]}
            />

            {/* Main icon */}
            <Animated.View style={iconAnimatedStyle}>
                <Feather
                    name={iconName as any}
                    size={size}
                    color={focused ? semanticColors.primary : color}
                />
            </Animated.View>

            {/* Active indicator dot */}
            <Animated.View
                style={[
                    {
                        position: 'absolute',
                        bottom: -6,
                        width: 4,
                        height: 4,
                        borderRadius: 2,
                        backgroundColor: semanticColors.primary,
                    },
                    indicatorAnimatedStyle,
                ]}
            />
        </View>
    );
}

// Enhanced Tab Background Component for iOS
function EnhancedTabBackground() {
    const semanticColors = useSemanticColors();
    const theme = useTheme();

    return (
        <>
            {/* Blur effect */}
            <BlurView
                intensity={semanticColors.background === '#FFFFFF' ? 100 : 80}
                tint={semanticColors.background === '#FFFFFF' ? 'light' : 'dark'}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    bottom: 0,
                    right: 0,
                }}
            />

            {/* Subtle gradient overlay for depth */}
            <View
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 1,
                    backgroundColor: semanticColors.border,
                    opacity: 0.5,
                }}
            />
        </>
    );
}

export default function ModernTabLayout() {
    const { t } = useTranslation();
    const semanticColors = useSemanticColors();
    const theme = useTheme();
    const typography = useTypography();
    const variants = useColorVariants();

    // Tab configuration with enhanced UX
    const tabsConfig = [
        {
            name: 'index',
            title: t('tabs.home'),
            icon: 'home',
            description: 'Home and overview',
        },
        {
            name: 'birdex',
            title: t('tabs.birdex'),
            icon: 'book-open',
            description: 'Bird encyclopedia',
        },
        {
            name: 'smart-search',
            title: t('tabs.smartSearch'),
            icon: 'search',
            description: 'Smart bird search',
        },
        {
            name: 'archive',
            title: t('tabs.archive'),
            icon: 'archive',
            description: 'Your bird archives',
        },
        {
            name: 'account',
            title: t('tabs.account'),
            icon: 'user',
            description: 'Account settings',
        },
        {
            name: 'settings',
            title: t('tabs.settings'),
            icon: 'settings',
            description: 'App settings',
        },
    ];

    return (
        <Tabs
            screenOptions={{
                // Modern tab bar styling with semantic colors
                tabBarStyle: {
                    backgroundColor: semanticColors.backgroundElevated,
                    borderTopWidth: 1,
                    borderTopColor: semanticColors.border,
                    height: Platform.OS === 'ios' ? 88 : 72,
                    paddingBottom: Platform.OS === 'ios' ? 24 : theme.spacing.sm,
                    paddingTop: theme.spacing.sm,
                    paddingHorizontal: theme.spacing.md,

                    // Enhanced shadows for depth
                    ...theme.shadows.lg,

                    // Platform-specific enhancements
                    ...(Platform.OS === 'android' && {
                        elevation: 8,
                        shadowColor: semanticColors.text,
                    }),
                },

                // Enhanced color system
                tabBarActiveTintColor: semanticColors.primary,
                tabBarInactiveTintColor: semanticColors.textSecondary,

                // Modern typography with proper hierarchy
                tabBarLabelStyle: {
                    ...typography.labelSmall,
                    fontWeight: '600',
                    marginTop: theme.spacing.xs,
                    letterSpacing: 0.5,
                    textTransform: 'uppercase' as const,
                },

                // Enhanced iOS blur effect
                ...(Platform.OS === 'ios' && {
                    tabBarBackground: () => <EnhancedTabBackground />,
                }),

                // Improved animations
                tabBarHideOnKeyboard: true,

                // Enhanced header styling
                headerStyle: {
                    backgroundColor: semanticColors.backgroundElevated,
                    ...theme.shadows.sm,
                },
                headerTintColor: semanticColors.text,
                headerTitleStyle: {
                    ...typography.headlineMedium,
                    fontWeight: '600',
                },
            }}
        >
            {/* Home Tab - Enhanced with priority */}
            <Tabs.Screen
                name="index"
                options={{
                    title: t('tabs.home'),
                    headerTitle: t('tabs.home'),
                    tabBarIcon: ({ color, focused, size }) => (
                        <EnhancedTabIcon
                            iconName="home"
                            color={color}
                            focused={focused}
                            size={size}
                        />
                    ),
                    tabBarLabel: t('tabs.home'),
                    headerShown: false,
                }}
            />

            {/* BirDex Tab - Enhanced with specialized icon */}
            <Tabs.Screen
                name="birdex"
                options={{
                    title: t('tabs.birdex'),
                    headerTitle: t('tabs.birdex'),
                    tabBarIcon: ({ color, focused, size }) => (
                        <EnhancedTabIcon
                            iconName="book-open"
                            color={color}
                            focused={focused}
                            size={size}
                        />
                    ),
                    tabBarLabel: t('tabs.birdex'),
                    headerShown: false,
                }}
            />

            {/* Smart Search Tab - Enhanced with search emphasis */}
            <Tabs.Screen
                name="smart-search"
                options={{
                    title: t('tabs.smartSearch'),
                    headerTitle: t('tabs.smartSearch'),
                    tabBarIcon: ({ color, focused, size }) => (
                        <EnhancedTabIcon
                            iconName="search"
                            color={color}
                            focused={focused}
                            size={size}
                        />
                    ),
                    tabBarLabel: t('tabs.smartSearch'),
                    headerShown: false,
                }}
            />

            {/* Archive Tab - Enhanced with archive visual */}
            <Tabs.Screen
                name="archive"
                options={{
                    title: t('tabs.archive'),
                    headerTitle: t('tabs.archive'),
                    tabBarIcon: ({ color, focused, size }) => (
                        <EnhancedTabIcon
                            iconName="archive"
                            color={color}
                            focused={focused}
                            size={size}
                        />
                    ),
                    tabBarLabel: t('tabs.archive'),
                    headerShown: false,
                }}
            />

            {/* Account Tab - Enhanced with user profile icon */}
            <Tabs.Screen
                name="account"
                options={{
                    title: t('tabs.account'),
                    headerTitle: t('tabs.account'),
                    tabBarIcon: ({ color, focused, size }) => (
                        <EnhancedTabIcon
                            iconName="user"
                            color={color}
                            focused={focused}
                            size={size}
                        />
                    ),
                    tabBarLabel: t('tabs.account'),
                    headerShown: false,
                }}
            />

            {/* Settings Tab - Enhanced with gear icon */}
            <Tabs.Screen
                name="settings"
                options={{
                    title: t('tabs.settings'),
                    headerTitle: t('tabs.settings'),
                    tabBarIcon: ({ color, focused, size }) => (
                        <EnhancedTabIcon
                            iconName="settings"
                            color={color}
                            focused={focused}
                            size={size}
                        />
                    ),
                    tabBarLabel: t('tabs.settings'),
                    headerShown: false,
                }}
            />
        </Tabs>
    );
}