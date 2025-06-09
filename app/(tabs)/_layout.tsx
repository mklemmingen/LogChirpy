import React from 'react';
import {Tabs} from 'expo-router';
import {Platform} from 'react-native';
import {useTranslation} from 'react-i18next';
import {BlurView} from 'expo-blur';
import * as Haptics from 'expo-haptics';
import Animated, {
    interpolate,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';

import {useTheme, useColors, useShadows} from '@/hooks/useThemeColor';
import {ThemedView} from '@/components/ThemedView';
import {ThemedIcon} from '@/components/ThemedIcon';

/**
 * Enhanced Tab Icon Component with responsive design and smooth animations
 * Provides visual feedback for tab navigation with accessibility support
 * 
 * @param {Object} props - Component props
 * @param {string} props.iconName - Name of the icon to display
 * @param {string} props.color - Icon color (not used, theme colors applied)
 * @param {boolean} props.focused - Whether the tab is currently active
 * @param {number} props.size - Base icon size (enhanced with responsive multipliers)
 * @returns {JSX.Element} Animated tab icon with indicator
 */
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
    const theme = useTheme();
    const colors = useColors();

    // Animation values with responsive sizing
    const scale = useSharedValue(focused ? 1 : 0.9);
    const indicatorWidth = useSharedValue(focused ? 24 : 4);
    const opacity = useSharedValue(focused ? 1 : 0.7);
    
    // Responsive icon size
    const responsiveIconSize = Math.max(size * 1.1, 20);

    React.useEffect(() => {
        // Smooth scale animation for icon
        scale.value = withSpring(focused ? 1 : 0.9, {
            damping: 15,
            stiffness: 300,
        });

        // Indicator animation with responsive width
        indicatorWidth.value = withSpring(focused ? 24 : 4, {
            damping: 15,
            stiffness: 300,
        });

        // Opacity animation
        opacity.value = withTiming(focused ? 1 : 0.7, {
            duration: theme.motion.duration.fast,
        });

        // Haptic feedback on focus change
        if (focused) {
            Haptics.selectionAsync();
        }
    }, [focused, indicatorWidth, opacity, scale, theme.motion.duration.fast]);

    const iconAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: opacity.value,
    }));

    const indicatorAnimatedStyle = useAnimatedStyle(() => ({
        width: indicatorWidth.value,
        opacity: focused ? 1 : 0,
    }));

    return (
        <ThemedView
            background="transparent"
            style={{
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                paddingHorizontal: 4,
                paddingVertical: 6,
                minHeight: 44,
            }}>
            {/* Main icon - no background, just scale and opacity changes */}
            <Animated.View style={iconAnimatedStyle}>
                <ThemedIcon
                    name={iconName as any}
                    size={responsiveIconSize}
                    color={focused ? 'primary' : 'secondary'}
                />
            </Animated.View>

            {/* Active indicator bar - more prominent than dot */}
            <Animated.View
                style={[
                    {
                        position: 'absolute',
                        bottom: 0,
                        height: 3,
                        borderRadius: 1.5,
                        backgroundColor: colors.primary,
                    },
                    indicatorAnimatedStyle,
                ]}
            />
        </ThemedView>
    );
}

/**
 * Enhanced Tab Background Component for iOS with themed styling
 * Provides translucent background effect with proper contrast support
 * 
 * @returns {JSX.Element} Tab bar background with border and themed colors
 */
function EnhancedTabBackground() {
    const colors = useColors();

    return (
        <>
            {/* Main background with proper theme support */}
            <ThemedView
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    bottom: 0,
                    right: 0,
                    backgroundColor: colors.backgroundSecondary,
                    opacity: 0.95,
                }}
            />

            {/* Subtle border for definition */}
            <ThemedView
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 1,
                    backgroundColor: colors.border,
                    opacity: 0.3,
                }}
            />
        </>
    );
}

/**
 * Modern Tab Layout Component with responsive design and accessibility
 * Main navigation layout providing tab-based navigation with enhanced theming
 * 
 * @returns {JSX.Element} Tab navigation layout with responsive styling
 */
export default function ModernTabLayout() {
    const { t } = useTranslation();
    const theme = useTheme();
    const colors = useColors();
    const shadows = useShadows();

    // Tab configuration available for future enhancements
    // const tabsConfig = [
    //     {
    //         name: 'index',
    //         title: t('tabs.home'),
    //         icon: 'home',
    //         description: t('navigation.home_description'),
    //     },
    //     {
    //         name: 'birdex',
    //         title: t('tabs.birdex'),
    //         icon: 'book-open',
    //         description: t('navigation.birdex_description'),
    //     },
    //     {
    //         name: 'smart-search',
    //         title: t('tabs.smartSearch'),
    //         icon: 'search',
    //         description: t('navigation.smart_search_description'),
    //     },
    //     {
    //         name: 'archive',
    //         title: t('tabs.archive'),
    //         icon: 'archive',
    //         description: t('navigation.archive_description'),
    //     },
    //     {
    //         name: 'account',
    //         title: t('tabs.account'),
    //         icon: 'user',
    //         description: t('navigation.account_description'),
    //     },
    //     {
    //         name: 'settings',
    //         title: t('tabs.settings'),
    //         icon: 'settings',
    //         description: t('navigation.settings_description'),
    //     },
    // ];

    return (
        <Tabs
            screenOptions={{
                // Modern tab bar styling with responsive semantic colors
                tabBarStyle: {
                    backgroundColor: colors.backgroundSecondary,
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                    height: 80,
                    paddingBottom: Platform.OS === 'ios' ? 20 : 8,
                    paddingTop: 8,
                    paddingHorizontal: 16,

                    // Enhanced shadows for depth
                    ...shadows.lg,

                    // Platform-specific enhancements
                    ...(Platform.OS === 'android' && {
                        elevation: 8,
                        shadowColor: colors.text,
                    }),
                },

                // Enhanced color system with unified colors
                tabBarActiveTintColor: colors.text,
                tabBarInactiveTintColor: colors.textSecondary,

                // Hide tab labels - icons only
                tabBarShowLabel: false,

                // Enhanced iOS blur effect
                ...(Platform.OS === 'ios' && {
                    tabBarBackground: () => <EnhancedTabBackground />,
                }),

                // Improved animations
                tabBarHideOnKeyboard: true,

                // Enhanced header styling with responsive colors
                headerStyle: {
                    backgroundColor: colors.backgroundSecondary,
                    ...shadows.sm,
                },
                headerTintColor: colors.text,
                headerTitleStyle: {
                    ...theme.typography.h2,
                    fontWeight: '600',
                },
            }}
        >
            {/* Home Tab - Enhanced with priority and accessibility */}
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
                    tabBarAccessibilityLabel: t('tabs.home'),
                    headerShown: false,
                }}
            />

            {/* BirDex Tab - Enhanced with specialized icon and accessibility */}
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
                    tabBarAccessibilityLabel: t('tabs.birdex'),
                    headerShown: false,
                }}
            />

            {/* Smart Search Tab - Enhanced with search emphasis and accessibility */}
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
                    tabBarAccessibilityLabel: t('tabs.smartSearch'),
                    headerShown: false,
                }}
            />

            {/* Archive Tab - Enhanced with archive visual and accessibility */}
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
                    tabBarAccessibilityLabel: t('tabs.archive'),
                    headerShown: false,
                }}
            />

            {/* Account Tab - Enhanced with user profile icon and accessibility */}
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
                    tabBarAccessibilityLabel: t('tabs.account'),
                    headerShown: false,
                }}
            />

            {/* Settings Tab - Enhanced with gear icon and accessibility */}
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
                    tabBarAccessibilityLabel: t('tabs.settings'),
                    headerShown: false,
                }}
            />
        </Tabs>
    );
}