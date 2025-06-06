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

import {useTheme} from '@/hooks/useThemeColor';
import {ThemedView} from '@/components/ThemedView';
import {ThemedIcon} from '@/components/ThemedIcon';

// Enhanced Tab Icon Component
// Enhanced Tab Icon Component - Cleaner Design
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

    // Animation values
    const scale = useSharedValue(focused ? 1 : 0.9);
    const indicatorWidth = useSharedValue(focused ? 20 : 4);
    const opacity = useSharedValue(focused ? 1 : 0.7);

    React.useEffect(() => {
        // Smooth scale animation for icon
        scale.value = withSpring(focused ? 1 : 0.9, {
            damping: 15,
            stiffness: 300,
        });

        // Indicator animation
        indicatorWidth.value = withSpring(focused ? 20 : 4, {
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
            minHeight: 40,
        }}>
            {/* Main icon - no background, just scale and opacity changes */}
            <Animated.View style={iconAnimatedStyle}>
                <ThemedIcon
                    name={iconName as any}
                    size={size}
                    color={focused ? 'primary' : 'secondary'}
                />
            </Animated.View>

            {/* Active indicator bar - more prominent than dot */}
            <Animated.View
                style={[
                    {
                        position: 'absolute',
                        bottom: 0,
                        height: 2,
                        borderRadius: 1,
                        backgroundColor: theme.colors.text.primary,
                    },
                    indicatorAnimatedStyle,
                ]}
            />
        </ThemedView>
    );
}

// Enhanced Tab Background Component for iOS
function EnhancedTabBackground() {
    const theme = useTheme();

    return (
        <>
            {/* Blur effect */}
            <BlurView
                intensity={theme.colors.background.primary === '#FFFFFF' ? 100 : 80}
                tint={theme.colors.background.primary === '#FFFFFF' ? 'light' : 'dark'}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    bottom: 0,
                    right: 0,
                }}
            />

            {/* Subtle gradient overlay for depth */}
            <ThemedView
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 1,
                    backgroundColor: theme.colors.border.primary,
                    opacity: 0.5,
                }}
            />
        </>
    );
}

export default function ModernTabLayout() {
    const { t } = useTranslation();
    const theme = useTheme();

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
                // Modern tab bar styling with semantic colors
                tabBarStyle: {
                    backgroundColor: theme.colors.background.secondary,
                    borderTopWidth: 1,
                    borderTopColor: theme.colors.border.primary,
                    height: Platform.OS === 'ios' ? 95 : 80,
                    paddingBottom: Platform.OS === 'ios' ? 30 : 12,
                    paddingTop: 8,
                    paddingHorizontal: theme.spacing.md,

                    // Enhanced shadows for depth
                    ...theme.shadows.lg,

                    // Platform-specific enhancements
                    ...(Platform.OS === 'android' && {
                        elevation: 8,
                        shadowColor: theme.colors.text.primary,
                    }),
                },

                // Enhanced color system
                tabBarActiveTintColor: theme.colors.text.primary,
                tabBarInactiveTintColor: theme.colors.text.secondary,

                // Modern typography with proper hierarchy
                tabBarLabelStyle: {
                    fontSize: 11,
                    fontWeight: '500',
                    marginTop: 4,
                    marginBottom: 2,
                    letterSpacing: 0.3,
                },

                // Enhanced iOS blur effect
                ...(Platform.OS === 'ios' && {
                    tabBarBackground: () => <EnhancedTabBackground />,
                }),

                // Improved animations
                tabBarHideOnKeyboard: true,

                // Enhanced header styling
                headerStyle: {
                    backgroundColor: theme.colors.background.secondary,
                    ...theme.shadows.sm,
                },
                headerTintColor: theme.colors.text.primary,
                headerTitleStyle: {
                    ...theme.typography.h2,
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