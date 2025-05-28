import React from 'react';
import { Tabs } from 'expo-router';
import { useColorScheme, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { BlurView } from 'expo-blur';

import { theme, getSemanticColors } from '@/constants/theme';

export default function TabLayout() {
    const { t } = useTranslation();
    const colorScheme = useColorScheme() ?? 'light';
    const pal = theme[colorScheme];
    const semanticColors = getSemanticColors(colorScheme === 'dark');

    return (
        <Tabs
            screenOptions={{
                // Tab bar styling
                tabBarStyle: {
                    backgroundColor: pal.colors.background,
                    borderTopWidth: 1,
                    borderTopColor: pal.colors.divider,
                    height: Platform.OS === 'ios' ? 88 : 68,
                    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
                    paddingTop: 8,
                    paddingHorizontal: 16,
                    // Add subtle shadow
                    ...theme.shadows.sm,
                },

                // Active tab styling
                tabBarActiveTintColor: pal.colors.primary,
                tabBarInactiveTintColor: pal.colors.text.primary,

                // Tab bar label styling
                tabBarLabelStyle: {
                    fontSize: 10,
                    fontWeight: '900',
                    marginTop: 4,
                },

                // Background for tab bar (iOS blur effect)
                ...(Platform.OS === 'ios' && {
                    tabBarBackground: () => (
                        <BlurView
                            intensity={colorScheme === 'dark' ? 80 : 100}
                            tint={colorScheme === 'dark' ? 'dark' : 'light'}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                bottom: 0,
                                right: 0,
                            }}
                        />
                    ),
                }),
            }}
        >
            {/* Home Tab */}
            <Tabs.Screen
                name="index"
                options={{
                    title: t('tabs.home'),
                    headerTitle: t('tabs.home'),
                    tabBarIcon: ({ color, focused, size }) => (
                        <Feather
                            name="feather"
                            size={focused ? size + 2 : size}
                            color={color}
                            style={{
                                transform: [{ scale: focused ? 1.1 : 1 }],
                            }}
                        />
                    ),
                    tabBarLabel: t('tabs.home'),
                    headerShown: false,
                }}
            />

            {/* BirDex Tab */}
            <Tabs.Screen
                name="birdex"
                options={{
                    title: t('tabs.birdex'),
                    headerTitle: t('tabs.birdex'),
                    tabBarIcon: ({ color, focused, size }) => (
                        <Feather
                            name="book-open"
                            size={focused ? size + 2 : size}
                            color={color}
                            style={{
                                transform: [{ scale: focused ? 1.1 : 1 }],
                            }}
                        />
                    ),
                    tabBarLabel: t('tabs.birdex'),
                    headerShown: false,
                }}
            />

            {/* Smart Search Tab */}
            <Tabs.Screen
                name="smart-search"
                options={{
                    title: t('tabs.smartSearch'),
                    headerTitle: t('tabs.smartSearch'),
                    tabBarIcon: ({ color, focused, size }) => (
                        <Feather
                            name="globe"
                            size={focused ? size + 2 : size}
                            color={color}
                            style={{
                                transform: [{ scale: focused ? 1.1 : 1 }],
                            }}
                        />
                    ),
                    tabBarLabel: t('tabs.smartSearch'),
                    headerShown: false,
                }}
            />

            {/* Archive Tab */}
            <Tabs.Screen
                name="archive"
                options={{
                    title: t('tabs.archive'),
                    headerTitle: t('tabs.archive'),
                    tabBarIcon: ({ color, focused, size }) => (
                        <Feather
                            name="archive"
                            size={focused ? size + 2 : size}
                            color={color}
                            style={{
                                transform: [{ scale: focused ? 1.1 : 1 }],
                            }}
                        />
                    ),
                    tabBarLabel: t('tabs.archive'),
                    headerShown: false,
                }}
            />

            {/* Account Tab */}
            <Tabs.Screen
                name="account"
                options={{
                    title: t('tabs.account'),
                    headerTitle: t('tabs.account'),
                    tabBarIcon: ({ color, focused, size }) => (
                        <Feather
                            name="database"
                            size={focused ? size + 2 : size}
                            color={color}
                            style={{
                                transform: [{ scale: focused ? 1.1 : 1 }],
                            }}
                        />
                    ),
                    tabBarLabel: t('tabs.account'),
                    headerShown: false,
                }}
            />

            {/* Settings Tab */}
            <Tabs.Screen
                name="settings"
                options={{
                    title: t('tabs.settings'),
                    headerTitle: t('tabs.settings'),
                    tabBarIcon: ({ color, focused, size }) => (
                        <Feather
                            name="settings"
                            size={focused ? size + 2 : size}
                            color={color}
                            style={{
                                transform: [{ scale: focused ? 1.1 : 1 }],
                            }}
                        />
                    ),
                    tabBarLabel: t('tabs.account'),
                    headerShown: false,
                }}
            />
        </Tabs>
    );
}