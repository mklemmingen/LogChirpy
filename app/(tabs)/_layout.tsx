import React from 'react';
import {Tabs} from 'expo-router';
import {Platform, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import SafeBlurView from '@/components/ui/SafeBlurView';
import * as Haptics from 'expo-haptics';

import {useTheme} from '@/hooks/useThemeColor';
import { useUnifiedColors } from '@/hooks/useUnifiedColors';
import { useResponsiveDimensions } from '@/hooks/useResponsiveDimensions';
import {ThemedView} from '@/components/ThemedView';
import {ThemedIcon} from '@/components/ThemedIcon';
import NavigationErrorBoundary from '@/components/NavigationErrorBoundary';

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
    const colors = useUnifiedColors();
    const dimensions = useResponsiveDimensions();
    
    // Responsive icon size
    const responsiveIconSize = Math.max(size * dimensions.multipliers.size, dimensions.icon.md);

    // Simple haptic feedback
    React.useEffect(() => {
        if (focused) {
            Haptics.selectionAsync();
        }
    }, [focused]);

    return (
        <View
            style={{
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                paddingHorizontal: dimensions.layout.componentSpacing / 4,
                paddingVertical: dimensions.layout.componentSpacing / 3,
                minHeight: dimensions.touchTarget.minimum,
            }}>
            {/* Main icon - no background, just scale and opacity changes */}
            <View 
                style={{
                    opacity: focused ? 1 : 0.7,
                    transform: [{ scale: focused ? 1 : 0.9 }]
                }}
            >
                <ThemedIcon
                    name={iconName as any}
                    size={responsiveIconSize}
                    color={focused ? 'primary' : 'secondary'}
                />
            </View>

            {/* Active indicator bar - more prominent than dot */}
            <View
                style={[
                    {
                        position: 'absolute',
                        bottom: 0,
                        height: dimensions.screen.isSmall ? 2 : 3,
                        borderRadius: dimensions.screen.isSmall ? 1 : 1.5,
                        backgroundColor: colors.interactive.primary,
                        width: focused ? dimensions.navigation.tabIconSize : 4,
                        opacity: focused ? 1 : 0,
                    },
                ]}
            />
        </View>
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
    const colors = useUnifiedColors();
    const dimensions = useResponsiveDimensions();

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
        <NavigationErrorBoundary>
            <Tabs
            screenOptions={({ route }) => ({
                // CRITICAL: View hierarchy stability props
                lazy: true,                                    // Load screens only when first accessed
                unmountOnBlur: route.name === 'archive' ||     // Unmount memory-intensive screens
                              route.name === 'smart-search',   // Smart search with heavy ML operations
                freezeOnBlur: route.name !== 'index',          // Keep home active for performance
                
                // View hierarchy and animation stability
                animation: 'none',                             // Prevent animation conflicts during navigation
                tabBarHideOnKeyboard: true,

                // Modern tab bar styling for Android
                tabBarStyle: {
                    backgroundColor: colors.background.secondary,
                    borderTopWidth: 1,
                    borderTopColor: colors.border.primary,
                    height: dimensions.navigation.tabBarHeight,
                    paddingBottom: dimensions.layout.componentSpacing / 2,
                    paddingTop: dimensions.layout.componentSpacing / 2,
                    paddingHorizontal: dimensions.layout.screenPadding.horizontal,
                    elevation: 8,
                    shadowColor: colors.text.primary,
                },

                // Enhanced color system with unified colors
                tabBarActiveTintColor: colors.text.primary,
                tabBarInactiveTintColor: colors.text.secondary,

                // Hide tab labels - icons only for cleaner interface
                tabBarShowLabel: false,

                // Android-only - no blur effect needed

                // Enhanced header styling with responsive colors
                headerStyle: {
                    backgroundColor: colors.background.secondary,
                    ...theme.shadows.sm,
                },
                headerTintColor: colors.text.primary,
                headerTitleStyle: {
                    ...theme.typography.h2,
                    fontWeight: '600',
                },
            })}
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
        </NavigationErrorBoundary>
    );
}