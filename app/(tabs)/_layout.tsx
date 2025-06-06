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
            duration: theme.motion.duration.normal,
        });

        // Container background animation
        containerOpacity.value = withTiming(focused ? 1 : 0, {
            duration: theme.motion.duration.normal,
        });

        // Haptic feedback on focus change
        if (focused) {
            Haptics.selectionAsync();
        }
    }, [focused, containerOpacity, indicatorScale, scale, theme.motion.duration.normal]);

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
        <ThemedView style={{
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
                        backgroundColor: theme.colors.text.primary,
                        opacity: 0.1,
                    },
                    containerAnimatedStyle,
                ]}
            />

            {/* Main icon */}
            <Animated.View style={iconAnimatedStyle}>
                <ThemedIcon
                    name={iconName as any}
                    size={size}
                    color={focused ? 'primary' : 'accent'}
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
                        backgroundColor: theme.colors.text.secondary,
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
                    height: Platform.OS === 'ios' ? 88 : 72,
                    paddingBottom: Platform.OS === 'ios' ? 24 : theme.spacing.sm,
                    paddingTop: theme.spacing.sm,
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
                    ...theme.typography.caption,
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